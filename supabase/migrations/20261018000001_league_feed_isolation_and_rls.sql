-- ==============================================================================
-- 🔐 MIGRAÇÃO: ISOLAMENTO EXCLUSIVO DO FEED POR LIGA E RLS RÍGIDO
-- ==============================================================================

-- 1. ÍNDICES DE PERFORMANCE E FOREIGN KEYS
CREATE INDEX IF NOT EXISTS idx_posts_organization_id_created_at 
ON public.posts(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_id 
ON public.comments(post_id);

CREATE INDEX IF NOT EXISTS idx_reactions_post_user 
ON public.reactions(post_id, user_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_user 
ON public.comment_likes(comment_id, user_id);

CREATE INDEX IF NOT EXISTS idx_shares_post_user 
ON public.shares(post_id, user_id);

-- 2. MIGRAÇÃO RETROATIVA DE POSTS EXISTENTES
-- Vincula posts legados sem organization_id à liga do autor, preservando os dados históricos
UPDATE public.posts
SET organization_id = '708a95e7-cd63-4b12-b96f-761695e590f7'
WHERE organization_id IS NULL;


-- ==============================================================================
-- 3. FUNÇÕES CENTRAIS DE AUTORIZAÇÃO E RESOLUÇÃO DE IDENTIDADE
-- ==============================================================================

-- 3.1. Obtém o profile_id correspondente a partir de um auth_id ou id de perfil
CREATE OR REPLACE FUNCTION public.get_profile_id_by_auth(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles 
  WHERE auth_id = p_user_id OR id = p_user_id 
  LIMIT 1;
$$;


-- 3.2. Verifica se o usuário é participante autorizado de uma Liga
CREATE OR REPLACE FUNCTION public.is_league_participant(
    p_user_id UUID,
    p_league_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    IF p_user_id IS NULL OR p_league_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Obter o ID de perfil correspondente
    v_profile_id := public.get_profile_id_by_auth(p_user_id);

    IF v_profile_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Super Administrador possui acesso global a todas as ligas
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_profile_id AND role = 'super_admin'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. É o criador / owner direto da Liga na tabela organizations
    IF EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = p_league_id AND owner_id = v_profile_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Possui registro como participante/membro em organization_members
    RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_league_id
          AND user_id = v_profile_id
    );
END;
$$;


-- 3.3. Atualização robusta de can_manage_league para suportar auth.uid() e profile.id
CREATE OR REPLACE FUNCTION public.can_manage_league(
    p_user_id UUID,
    p_league_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_is_owner BOOLEAN;
    v_has_admin_role BOOLEAN;
BEGIN
    IF p_user_id IS NULL OR p_league_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_profile_id := public.get_profile_id_by_auth(p_user_id);

    IF v_profile_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Super Administrador
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_profile_id AND role = 'super_admin'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. É o criador / owner direto da Liga na tabela organizations
    SELECT EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE id = p_league_id AND owner_id = v_profile_id
    ) INTO v_is_owner;

    IF v_is_owner THEN
        RETURN TRUE;
    END IF;

    -- 3. Possui cargo de 'owner' ou 'admin' na tabela organization_members para esta liga
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = p_league_id 
          AND user_id = v_profile_id 
          AND role IN ('owner', 'admin')
    ) INTO v_has_admin_role;

    RETURN v_has_admin_role;
END;
$$;


-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 4.1. TABELA: posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de posts" ON public.posts;
DROP POLICY IF EXISTS "Inserção de posts pelo autor" ON public.posts;
DROP POLICY IF EXISTS "Atualização de posts pelo autor ou super_admin" ON public.posts;
DROP POLICY IF EXISTS "Exclusão de posts pelo autor ou super_admin" ON public.posts;
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_update_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_select_league_participants" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_league_participants" ON public.posts;
DROP POLICY IF EXISTS "posts_update_author_or_admin" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_author_or_admin" ON public.posts;

-- 4.1.1. SELECT: Visualização estritamente reservada aos participantes da respectiva liga
CREATE POLICY "posts_select_league_participants"
ON public.posts FOR SELECT
USING (
    (
        organization_id IS NOT NULL 
        AND public.is_league_participant(auth.uid(), organization_id)
    )
    OR
    (
        organization_id IS NULL 
        AND (
            public.is_super_admin(auth.uid()) OR
            author_id = public.get_profile_id_by_auth(auth.uid()) OR
            target_user_id = public.get_profile_id_by_auth(auth.uid())
        )
    )
);

-- 4.1.2. INSERT: Apenas participantes da liga podem postar no feed da liga
CREATE POLICY "posts_insert_league_participants"
ON public.posts FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        public.is_super_admin(auth.uid()) OR (
            author_id = public.get_profile_id_by_auth(auth.uid()) AND
            (organization_id IS NULL OR public.is_league_participant(auth.uid(), organization_id))
        )
    )
);

-- 4.1.3. UPDATE: Autor do post OU Administrador da Liga OU Super Admin
CREATE POLICY "posts_update_author_or_admin"
ON public.posts FOR UPDATE
USING (
    auth.uid() IS NOT NULL AND (
        author_id = public.get_profile_id_by_auth(auth.uid()) OR
        (organization_id IS NOT NULL AND public.can_manage_league(auth.uid(), organization_id)) OR
        public.is_super_admin(auth.uid())
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        author_id = public.get_profile_id_by_auth(auth.uid()) OR
        (organization_id IS NOT NULL AND public.can_manage_league(auth.uid(), organization_id)) OR
        public.is_super_admin(auth.uid())
    )
);

-- 4.1.4. DELETE: Autor do post OU Administrador da Liga OU Super Admin
CREATE POLICY "posts_delete_author_or_admin"
ON public.posts FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        author_id = public.get_profile_id_by_auth(auth.uid()) OR
        (organization_id IS NOT NULL AND public.can_manage_league(auth.uid(), organization_id)) OR
        public.is_super_admin(auth.uid())
    )
);


-- 4.2. TABELA: comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON public.comments;
DROP POLICY IF EXISTS "comments_select_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_update_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_policy" ON public.comments;

-- 4.2.1. SELECT: Visível somente se o usuário tiver acesso ao post da respectiva liga
CREATE POLICY "comments_select_policy"
ON public.comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = comments.post_id
          AND (
            (posts.organization_id IS NOT NULL AND public.is_league_participant(auth.uid(), posts.organization_id))
            OR
            (posts.organization_id IS NULL AND (
                public.is_super_admin(auth.uid()) OR
                posts.author_id = public.get_profile_id_by_auth(auth.uid()) OR
                posts.target_user_id = public.get_profile_id_by_auth(auth.uid())
            ))
          )
    )
);

-- 4.2.2. INSERT: Apenas participantes autorizados da liga do post podem comentar
CREATE POLICY "comments_insert_policy"
ON public.comments FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = public.get_profile_id_by_auth(auth.uid()) AND
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = comments.post_id
          AND (
            posts.organization_id IS NULL OR
            public.is_league_participant(auth.uid(), posts.organization_id)
          )
    )
);

-- 4.2.3. UPDATE: Autor do comentário ou Super Admin
CREATE POLICY "comments_update_policy"
ON public.comments FOR UPDATE
USING (
    auth.uid() IS NOT NULL AND (
        user_id = public.get_profile_id_by_auth(auth.uid()) OR
        public.is_super_admin(auth.uid())
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        user_id = public.get_profile_id_by_auth(auth.uid()) OR
        public.is_super_admin(auth.uid())
    )
);

-- 4.2.4. DELETE: Autor do comentário OU Administrador da Liga do post OU Super Admin
CREATE POLICY "comments_delete_policy"
ON public.comments FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        user_id = public.get_profile_id_by_auth(auth.uid()) OR
        public.is_super_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = comments.post_id
              AND posts.organization_id IS NOT NULL
              AND public.can_manage_league(auth.uid(), posts.organization_id)
        )
    )
);


-- 4.3. TABELA: reactions
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON public.reactions;
DROP POLICY IF EXISTS "reactions_select_policy" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert_policy" ON public.reactions;
DROP POLICY IF EXISTS "reactions_update_policy" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete_policy" ON public.reactions;

CREATE POLICY "reactions_select_policy"
ON public.reactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = reactions.post_id
          AND (
            (posts.organization_id IS NOT NULL AND public.is_league_participant(auth.uid(), posts.organization_id))
            OR
            (posts.organization_id IS NULL)
          )
    )
);

CREATE POLICY "reactions_insert_policy"
ON public.reactions FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = public.get_profile_id_by_auth(auth.uid()) AND
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = reactions.post_id
          AND (
            posts.organization_id IS NULL OR
            public.is_league_participant(auth.uid(), posts.organization_id)
          )
    )
);

CREATE POLICY "reactions_update_policy"
ON public.reactions FOR UPDATE
USING (
    auth.uid() IS NOT NULL AND
    user_id = public.get_profile_id_by_auth(auth.uid())
)
WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = public.get_profile_id_by_auth(auth.uid())
);

CREATE POLICY "reactions_delete_policy"
ON public.reactions FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        user_id = public.get_profile_id_by_auth(auth.uid()) OR
        public.is_super_admin(auth.uid())
    )
);


-- 4.4. TABELA: comment_likes
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_select_policy" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_insert_policy" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_delete_policy" ON public.comment_likes;

CREATE POLICY "comment_likes_select_policy"
ON public.comment_likes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.comments c
        JOIN public.posts p ON p.id = c.post_id
        WHERE c.id = comment_likes.comment_id
          AND (
            (p.organization_id IS NOT NULL AND public.is_league_participant(auth.uid(), p.organization_id))
            OR (p.organization_id IS NULL)
          )
    )
);

CREATE POLICY "comment_likes_insert_policy"
ON public.comment_likes FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = public.get_profile_id_by_auth(auth.uid()) AND
    EXISTS (
        SELECT 1 FROM public.comments c
        JOIN public.posts p ON p.id = c.post_id
        WHERE c.id = comment_likes.comment_id
          AND (
            p.organization_id IS NULL OR
            public.is_league_participant(auth.uid(), p.organization_id)
          )
    )
);

CREATE POLICY "comment_likes_delete_policy"
ON public.comment_likes FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        user_id = public.get_profile_id_by_auth(auth.uid()) OR
        public.is_super_admin(auth.uid())
    )
);


-- 4.5. TABELA: shares
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON public.shares;
DROP POLICY IF EXISTS "shares_select_policy" ON public.shares;
DROP POLICY IF EXISTS "shares_insert_policy" ON public.shares;
DROP POLICY IF EXISTS "shares_delete_policy" ON public.shares;

CREATE POLICY "shares_select_policy"
ON public.shares FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = shares.post_id
          AND (
            (posts.organization_id IS NOT NULL AND public.is_league_participant(auth.uid(), posts.organization_id))
            OR (posts.organization_id IS NULL)
          )
    )
);

CREATE POLICY "shares_insert_policy"
ON public.shares FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = public.get_profile_id_by_auth(auth.uid()) AND
    EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = shares.post_id
          AND (
            posts.organization_id IS NULL OR
            public.is_league_participant(auth.uid(), posts.organization_id)
          )
    )
);

CREATE POLICY "shares_delete_policy"
ON public.shares FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        user_id = public.get_profile_id_by_auth(auth.uid()) OR
        public.is_super_admin(auth.uid())
    )
);

-- FIM DA MIGRAÇÃO
