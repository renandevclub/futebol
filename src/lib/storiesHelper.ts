import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/mediaCompressor';
import { Story, StoryGroup, StoryViewer, StoryMediaType, StoryOverlay } from '@/types/stories';

export interface CreateStoryParams {
  file: File;
  caption?: string;
  durationSeconds?: number;
  organizationId?: string | null;
  userId: string;
  overlays?: StoryOverlay[];
  onProgress?: (progress: number) => void;
}

/**
 * Busca todos os stories ativos agrupados por autor
 */
export async function fetchActiveStoryGroups(
  currentUserId?: string | null,
  leagueId?: string | null
): Promise<StoryGroup[]> {
  try {
    let stories: Story[] = [];

    if (currentUserId) {
      // 1. Tentar RPC v2 enriquecida com curtidas e metadata
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_active_stories_v2',
        { p_user_id: currentUserId }
      );

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        stories = rpcData.map((item: any) => ({
          id: item.story_id,
          author_id: item.author_id,
          organization_id: item.organization_id,
          media_url: item.media_url,
          media_type: item.media_type as StoryMediaType,
          caption: item.caption,
          duration_seconds: item.duration_seconds || 5,
          created_at: item.created_at,
          expires_at: item.expires_at,
          metadata: item.metadata || {},
          views_count: Number(item.views_count || 0),
          likes_count: Number(item.likes_count || 0),
          is_viewed: Boolean(item.is_viewed),
          is_liked: Boolean(item.is_liked),
          author: {
            id: item.author_id,
            nome: item.author_nome || 'Usuário',
            apelido: item.author_apelido,
            avatar_url: item.author_avatar,
          },
        }));
      } else {
        // Fallback: consulta direta via Supabase
        stories = await fetchStoriesDirect(currentUserId, leagueId);
      }
    } else {
      stories = await fetchStoriesDirect(null, leagueId);
    }

    // Filtrar por liga se fornecida
    if (leagueId) {
      stories = stories.filter(
        (s) => !s.organization_id || s.organization_id === leagueId
      );
    }

    // Agrupar stories por autor
    const groupMap = new Map<string, StoryGroup>();

    for (const story of stories) {
      const authorId = story.author_id;
      const authorName = story.author?.nome || 'Usuário';
      const authorApelido = story.author?.apelido;
      const authorAvatar = story.author?.avatar_url;

      if (!groupMap.has(authorId)) {
        groupMap.set(authorId, {
          authorId,
          authorName,
          authorApelido,
          authorAvatar,
          hasUnviewed: false,
          stories: [],
          lastStoryCreatedAt: story.created_at,
          isCurrentUser: currentUserId === authorId,
        });
      }

      const group = groupMap.get(authorId)!;
      group.stories.push(story);

      // Se qualquer story do grupo não foi visto, o grupo tem unviewed
      if (!story.is_viewed && currentUserId !== authorId) {
        group.hasUnviewed = true;
      }

      // Manter última data de publicação
      if (new Date(story.created_at) > new Date(group.lastStoryCreatedAt)) {
        group.lastStoryCreatedAt = story.created_at;
      }
    }

    // Ordenar stories internamente por data crescente (mais antigos primeiro para exibição contínua)
    for (const group of groupMap.values()) {
      group.stories.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    // Ordenar os grupos:
    // 1. Usuário atual primeiro (se tiver stories)
    // 2. Grupos com stories não visualizados
    // 3. Grupos com stories já visualizados
    // 4. Por data mais recente de story
    const groupsArray = Array.from(groupMap.values()).sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;

      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;

      return (
        new Date(b.lastStoryCreatedAt).getTime() -
        new Date(a.lastStoryCreatedAt).getTime()
      );
    });

    return groupsArray;
  } catch (err) {
    console.error('Erro ao buscar stories:', err);
    return [];
  }
}

/**
 * Consulta direta como fallback caso a RPC não esteja disponível
 */
async function fetchStoriesDirect(
  currentUserId?: string | null,
  leagueId?: string | null
): Promise<Story[]> {
  let query = supabase
    .from('stories')
    .select(`
      id,
      author_id,
      organization_id,
      media_url,
      media_type,
      caption,
      metadata,
      duration_seconds,
      created_at,
      expires_at,
      author:author_id(id, nome, apelido, avatar_url),
      story_views(viewer_id),
      story_likes(user_id)
    `)
    .eq('is_deleted', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (leagueId) {
    query = query.or(`organization_id.is.null,organization_id.eq.${leagueId}`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((item: any) => {
    const views = item.story_views || [];
    const likes = item.story_likes || [];
    const isViewed = currentUserId
      ? views.some((v: any) => v.viewer_id === currentUserId)
      : false;
    const isLiked = currentUserId
      ? likes.some((l: any) => l.user_id === currentUserId)
      : false;

    return {
      id: item.id,
      author_id: item.author_id,
      organization_id: item.organization_id,
      media_url: item.media_url,
      media_type: item.media_type,
      caption: item.caption,
      metadata: item.metadata || {},
      duration_seconds: item.duration_seconds || 5,
      created_at: item.created_at,
      expires_at: item.expires_at,
      views_count: views.length,
      likes_count: likes.length,
      is_viewed: isViewed,
      is_liked: isLiked,
      author: item.author,
    };
  });
}

/**
 * Registrar que um story foi visualizado pelo usuário
 */
export async function markStoryAsViewed(storyId: string, userId: string): Promise<void> {
  if (!storyId || !userId) return;

  try {
    const { error } = await supabase
      .from('story_views')
      .upsert(
        { story_id: storyId, viewer_id: userId },
        { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
      );

    if (error && error.code !== '23505') {
      console.warn('Erro ao marcar story como visto:', error);
    }
  } catch (err) {
    console.warn('Falha silenciosa ao registrar view:', err);
  }
}

/**
 * Alternar curtida (like/unlike) em um story
 */
export async function toggleStoryLike(
  storyId: string
): Promise<{ is_liked: boolean; likes_count: number }> {
  try {
    const { data, error } = await supabase.rpc('toggle_story_like', {
      p_story_id: storyId,
    });

    if (error) {
      console.error('Erro ao alternar curtida do story:', error);
      throw new Error(error.message);
    }

    return {
      is_liked: Boolean(data?.is_liked),
      likes_count: Number(data?.likes_count || 0),
    };
  } catch (err) {
    console.error('Falha em toggleStoryLike:', err);
    throw err;
  }
}

/**
 * Criar e publicar um novo Story com suporte a overlays de texto e figurinhas
 */
export async function publishStory(params: CreateStoryParams): Promise<Story> {
  const { file, caption, durationSeconds = 5, organizationId, userId, overlays, onProgress } = params;

  onProgress?.(10);

  const isVideo = file.type.startsWith('video/');
  const mediaType: StoryMediaType = isVideo ? 'video' : 'image';

  // Gerar nome único para o arquivo no bucket
  const fileExt = isVideo
    ? file.name.split('.').pop() || 'mp4'
    : 'webp';
  const fileName = `story_${userId}_${Date.now()}.${fileExt}`;

  let fileToUpload: File = file;

  if (!isVideo) {
    onProgress?.(25);
    // Comprimir imagens para webp com alta qualidade
    fileToUpload = await compressImage(file, 1440, 2560, 0.85);
  }

  onProgress?.(50);

  // Upload para o bucket 'stories'
  const { error: uploadError } = await supabase.storage
    .from('stories')
    .upload(fileName, fileToUpload, {
      contentType: fileToUpload.type,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Erro ao enviar mídia: ${uploadError.message}`);
  }

  onProgress?.(80);

  // Obter URL pública
  const { data: publicData } = supabase.storage
    .from('stories')
    .getPublicUrl(fileName);

  if (!publicData?.publicUrl) {
    throw new Error('Não foi possível obter a URL pública da mídia.');
  }

  const mediaUrl = publicData.publicUrl;

  const metadata = {
    overlays: overlays && overlays.length > 0 ? overlays : [],
  };

  // Inserir registro na tabela stories (expira em 24h automaticamente por default do banco)
  const { data: inserted, error: insertError } = await supabase
    .from('stories')
    .insert({
      author_id: userId,
      organization_id: organizationId || null,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption?.trim() || null,
      metadata: metadata,
      duration_seconds: Math.min(Math.max(durationSeconds, 3), 30),
    })
    .select(`
      id,
      author_id,
      organization_id,
      media_url,
      media_type,
      caption,
      metadata,
      duration_seconds,
      created_at,
      expires_at
    `)
    .single();

  if (insertError || !inserted) {
    throw new Error(`Erro ao salvar story no banco: ${insertError?.message || 'Falha desconhecida'}`);
  }

  onProgress?.(100);

  return {
    ...inserted,
    views_count: 0,
    likes_count: 0,
    is_viewed: true,
    is_liked: false,
  };
}

/**
 * Excluir um story próprio (soft-delete seguro)
 */
export async function deleteStory(storyId: string, userId: string): Promise<boolean> {
  // 1. Tentar primeiro via RPC segura com verificação de autor/admin
  const { data, error: rpcError } = await supabase.rpc('delete_story_secure', {
    p_story_id: storyId,
  });

  if (!rpcError) {
    return true;
  }

  console.warn('RPC delete_story_secure falhou, tentando update direto:', rpcError);

  // 2. Fallback: update direto na tabela stories
  const { error: updateError } = await supabase
    .from('stories')
    .update({ is_deleted: true })
    .eq('id', storyId);

  if (updateError) {
    console.error('Erro ao excluir story:', updateError);
    throw new Error(updateError.message);
  }

  return true;
}

/**
 * Buscar lista de visualizadores de um story com indicador de curtida (disponível para o autor)
 */
export async function fetchStoryViewers(storyId: string): Promise<StoryViewer[]> {
  try {
    // Tenta primeiro a RPC v2 que inclui has_liked
    const { data: v2Data, error: v2Error } = await supabase.rpc('get_story_viewers_v2', {
      p_story_id: storyId,
    });

    if (!v2Error && v2Data) {
      return v2Data.map((item: any) => ({
        viewer_id: item.viewer_id,
        viewer_nome: item.viewer_nome || 'Usuário',
        viewer_apelido: item.viewer_apelido,
        viewer_avatar: item.viewer_avatar,
        viewed_at: item.viewed_at,
        has_liked: Boolean(item.has_liked),
      }));
    }

    // Fallback: RPC v1
    const { data, error } = await supabase.rpc('get_story_viewers', {
      p_story_id: storyId,
    });

    if (error) {
      console.error('Erro ao buscar visualizadores do story:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      viewer_id: item.viewer_id,
      viewer_nome: item.viewer_nome || 'Usuário',
      viewer_apelido: item.viewer_apelido,
      viewer_avatar: item.viewer_avatar,
      viewed_at: item.viewed_at,
      has_liked: false,
    }));
  } catch (err) {
    console.error('Erro ao chamar get_story_viewers:', err);
    return [];
  }
}
