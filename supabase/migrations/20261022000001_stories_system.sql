-- ============================================================
-- 📸 SISTEMA DE STORIES - F&V Sports
-- Migração para criar tabelas, políticas RLS, Storage e limpeza
-- ============================================================

-- 1. TABELA DE STORIES
-- Armazena cada story publicado por um usuário
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  duration_seconds integer not null default 5 check (duration_seconds between 3 and 30),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  is_deleted boolean not null default false
);

-- Comentários na tabela
comment on table public.stories is 'Stories temporários dos usuários (expiram em 24h)';
comment on column public.stories.media_url is 'URL pública da mídia no Supabase Storage';
comment on column public.stories.media_type is 'Tipo de mídia: image ou video';
comment on column public.stories.caption is 'Legenda opcional do story';
comment on column public.stories.duration_seconds is 'Duração de exibição para imagens (3-30s)';
comment on column public.stories.expires_at is 'Momento de expiração (24h após criação)';
comment on column public.stories.is_deleted is 'Soft-delete para exclusão pelo autor';

-- Índices para performance
create index if not exists idx_stories_author_id on public.stories(author_id);
create index if not exists idx_stories_organization_id on public.stories(organization_id) where organization_id is not null;
create index if not exists idx_stories_expires_at on public.stories(expires_at) where is_deleted = false;
create index if not exists idx_stories_active on public.stories(created_at desc) where is_deleted = false and expires_at > now();

-- 2. TABELA DE VISUALIZAÇÕES DE STORIES
-- Registra quais usuários visualizaram cada story
create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  constraint uq_story_view unique (story_id, viewer_id)
);

comment on table public.story_views is 'Registro de visualizações de stories (uma por usuário por story)';

-- Índices para performance
create index if not exists idx_story_views_story_id on public.story_views(story_id);
create index if not exists idx_story_views_viewer_id on public.story_views(viewer_id);

-- 3. HABILITAR RLS
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- 4. POLÍTICAS RLS PARA STORIES

-- SELECT: Usuário autenticado pode ver stories ativos (não expirados, não deletados)
create policy "stories_select_authenticated"
  on public.stories for select
  to authenticated
  using (
    is_deleted = false
    and expires_at > now()
    and (
      is_super_admin(auth.uid())
      or author_id = get_profile_id_by_auth(auth.uid())
      or author_id = auth.uid()
      or organization_id is null
      or is_league_participant(auth.uid(), organization_id)
    )
  );

-- INSERT: Usuário autenticado pode criar stories
create policy "stories_insert_authenticated"
  on public.stories for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (
      is_super_admin(auth.uid())
      or (
        (author_id = get_profile_id_by_auth(auth.uid()) or author_id = auth.uid())
        and (
          organization_id is null
          or is_league_participant(auth.uid(), organization_id)
        )
      )
    )
  );

-- UPDATE: Somente o autor pode atualizar (para soft-delete)
create policy "stories_update_own"
  on public.stories for update
  to authenticated
  using (
    author_id = get_profile_id_by_auth(auth.uid())
    or author_id = auth.uid()
    or is_super_admin(auth.uid())
  )
  with check (
    author_id = get_profile_id_by_auth(auth.uid())
    or author_id = auth.uid()
    or is_super_admin(auth.uid())
  );

-- DELETE: Somente autor ou super_admin pode deletar
create policy "stories_delete_admin"
  on public.stories for delete
  to authenticated
  using (
    author_id = get_profile_id_by_auth(auth.uid())
    or author_id = auth.uid()
    or is_super_admin(auth.uid())
  );

-- 5. POLÍTICAS RLS PARA STORY_VIEWS

-- SELECT: Autor do story pode ver quem visualizou; viewer pode ver suas próprias views
create policy "story_views_select"
  on public.story_views for select
  to authenticated
  using (
    viewer_id = get_profile_id_by_auth(auth.uid())
    or viewer_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_id
        and (s.author_id = get_profile_id_by_auth(auth.uid()) or s.author_id = auth.uid())
    )
    or is_super_admin(auth.uid())
  );

-- INSERT: Qualquer autenticado pode registrar visualização de um story visível
create policy "story_views_insert"
  on public.story_views for insert
  to authenticated
  with check (
    viewer_id = get_profile_id_by_auth(auth.uid())
    or viewer_id = auth.uid()
  );

-- 6. STORAGE BUCKET PARA STORIES
-- Criar bucket público para mídias dos stories
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stories',
  'stories',
  true,
  52428800, -- 50MB limite
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

-- Políticas de Storage para o bucket stories

-- Upload: usuário autenticado pode fazer upload
create policy "stories_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stories');

-- Leitura: qualquer um pode ler (bucket público)
create policy "stories_storage_select"
  on storage.objects for select
  to public
  using (bucket_id = 'stories');

-- Update: autenticado pode atualizar seus arquivos
create policy "stories_storage_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'stories');

-- Delete: autenticado pode deletar seus arquivos
create policy "stories_storage_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'stories');

-- 7. GRANT EXPLÍCITO para garantir acesso via Data API
grant select, insert, update on public.stories to authenticated;
grant select, insert on public.story_views to authenticated;
grant select on public.stories to anon;

-- 8. FUNCTION PARA BUSCAR STORIES COM CONTAGEM DE VIEWS
-- Otimiza a busca principal do feed de stories
create or replace function public.get_active_stories_for_user(p_user_id uuid)
returns table (
  story_id uuid,
  author_id uuid,
  author_nome text,
  author_apelido text,
  author_avatar text,
  media_url text,
  media_type text,
  caption text,
  duration_seconds integer,
  created_at timestamptz,
  expires_at timestamptz,
  organization_id uuid,
  views_count bigint,
  is_viewed boolean
)
language sql
stable
security invoker
as $$
  select
    s.id as story_id,
    s.author_id,
    p.nome as author_nome,
    p.apelido as author_apelido,
    p.avatar_url as author_avatar,
    s.media_url,
    s.media_type,
    s.caption,
    s.duration_seconds,
    s.created_at,
    s.expires_at,
    s.organization_id,
    coalesce(vc.cnt, 0) as views_count,
    exists(
      select 1 from public.story_views sv
      where sv.story_id = s.id and sv.viewer_id = p_user_id
    ) as is_viewed
  from public.stories s
  inner join public.profiles p on p.id = s.author_id
  left join lateral (
    select count(*) as cnt from public.story_views sv2 where sv2.story_id = s.id
  ) vc on true
  where s.is_deleted = false
    and s.expires_at > now()
    and (
      s.organization_id is null
      or s.organization_id in (
        select om.organization_id
        from public.organization_members om
        where om.user_id = p_user_id
      )
      or s.author_id = p_user_id
    )
  order by s.created_at desc;
$$;

comment on function public.get_active_stories_for_user is 'Retorna stories ativos visíveis para o usuário, com contagem de views e status de visualização';

-- 9. FUNCTION PARA VISUALIZADORES DE UM STORY (SOMENTE O AUTOR PODE VER)
create or replace function public.get_story_viewers(p_story_id uuid)
returns table (
  viewer_id uuid,
  viewer_nome text,
  viewer_apelido text,
  viewer_avatar text,
  viewed_at timestamptz
)
language sql
stable
security definer
as $$
  select
    p.id as viewer_id,
    p.nome as viewer_nome,
    p.apelido as viewer_apelido,
    p.avatar_url as viewer_avatar,
    sv.viewed_at
  from public.story_views sv
  inner join public.stories s on s.id = sv.story_id
  inner join public.profiles p on p.id = sv.viewer_id
  where sv.story_id = p_story_id
    and (s.author_id = auth.uid() or exists(select 1 from public.profiles where id = auth.uid() and role = 'super_admin'))
  order by sv.viewed_at desc;
$$;

comment on function public.get_story_viewers is 'Retorna a lista de pessoas que visualizaram o story (acessível pelo autor do story)';

-- 10. FUNCTION PARA EXCLUSÃO SEGURA DE STORY (AUTOR OU SUPER_ADMIN)
create or replace function public.delete_story_secure(p_story_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.get_profile_id_by_auth(auth.uid());
  
  update public.stories
  set is_deleted = true
  where id = p_story_id
    and (
      author_id = v_profile_id
      or author_id = auth.uid()
      or public.is_super_admin(auth.uid())
    );
    
  return found;
end;
$$;

grant execute on function public.delete_story_secure(uuid) to authenticated;
comment on function public.delete_story_secure is 'Realiza exclusão lógica segura de um story pelo próprio autor ou administrador';
