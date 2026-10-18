'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Post, League } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { ReactionPicker } from '@/components/ReactionPicker';
import { CommentSection } from '@/components/CommentSection';
import { ShareModal } from '@/components/ShareModal';
import { GalleryModal, GalleryMediaItem } from '@/components/GalleryModal';
import { CreatePostModal } from '@/components/CreatePostModal';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import { 
  MessageSquare, 
  Trash2, 
  Pencil, 
  Trophy, 
  Shield, 
  Clock, 
  Share2, 
  Sparkles, 
  User, 
  Lock, 
  UserPlus, 
  KeyRound,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { subscribeToTables } from '@/lib/realtime';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedSectionProps {
  leagueId?: string | null;
  leagueName?: string | null;
  onOpenCreatePost: () => void;
  onOpenLogin: () => void;
  onJoinLeagueRequest?: () => void;
}

export const FeedSection: React.FC<FeedSectionProps> = ({ 
  leagueId, 
  leagueName, 
  onOpenCreatePost, 
  onOpenLogin,
  onJoinLeagueRequest,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { 
    currentLeague, 
    isLeagueMember, 
    canManageLeague, 
    leagues 
  } = useLeague();

  // Liga efetiva vinculada a esta instância do feed
  const effectiveLeagueId = leagueId || currentLeague?.id || null;
  const effectiveLeague: League | null = 
    (effectiveLeagueId ? leagues.find((l) => l.id === effectiveLeagueId) : null) || currentLeague || null;
  const effectiveLeagueName = leagueName || effectiveLeague?.name || 'Liga';

  // Verificação de permissões do usuário na liga
  const isMember = effectiveLeagueId 
    ? (isSuperAdmin || isLeagueMember(effectiveLeagueId)) 
    : false;
  const canManageThisLeague = effectiveLeagueId 
    ? (isSuperAdmin || canManageLeague(effectiveLeagueId, effectiveLeague)) 
    : false;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryMediaItem[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Lightbox para visualização de avatar do autor
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  const openImagePreview = (previewData: Omit<LightboxPreviewData, 'isOpen'>) => {
    setLightboxData({ ...previewData, isOpen: true });
  };

  const closeImagePreview = () => {
    setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null));
  };

  // Carregar publicações vinculadas exclusivamente à liga ativa
  const fetchPosts = useCallback(async (showLoader = false) => {
    if (!effectiveLeagueId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Se o usuário não for participante autorizado, não executa a consulta
    if (!isMember) {
      setPosts([]);
      setLoading(false);
      return;
    }

    try {
      if (showLoader) setLoading(true);

      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:author_id(*),
          original_post:original_post_id(*, author:author_id(*))
        `)
        .eq('organization_id', effectiveLeagueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar posts da liga:', error);
        toast.error('Erro ao carregar o feed da liga.');
        return;
      }

      setPosts(postsData || []);

      // Mídias para galeria exclusivas desta liga
      const mediaAcc: GalleryMediaItem[] = [];
      (postsData || []).forEach((p) => {
        if (p.imagem_url) mediaAcc.push({ id: p.id, url: p.imagem_url, type: 'image', title: p.texto || 'Foto do Feed' });
        if (p.video_url) mediaAcc.push({ id: p.id, url: p.video_url, type: 'video', title: p.texto || 'Vídeo do Feed' });
      });
      setGalleryItems(mediaAcc);
    } catch (e) {
      console.error('Erro na requisição do feed:', e);
    } finally {
      setLoading(false);
    }
  }, [effectiveLeagueId, isMember]);

  useEffect(() => {
    void fetchPosts(true);

    if (!effectiveLeagueId || !isMember) return;

    // Inscrição Realtime para atualizar o feed da liga
    return subscribeToTables(
      `league_feed_${effectiveLeagueId}`,
      [
        { table: 'posts' },
        { table: 'reactions' },
        { table: 'comments' },
        { table: 'comment_likes' },
        { table: 'shares' },
      ],
      () => {
        void fetchPosts();
      }
    );
  }, [fetchPosts, effectiveLeagueId, isMember]);

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    if (!confirm('Deseja realmente excluir esta publicação?')) return;

    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      toast.error('Erro ao excluir publicação: ' + error.message);
    } else {
      toast.success('Publicação excluída com sucesso!');
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  // CASO 1: Nenhuma liga selecionada
  if (!effectiveLeagueId) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          <Layers className="w-8 h-8 opacity-60" />
        </div>
        <h3 className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-slate-200">
          Nenhuma Liga Selecionada
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Selecione uma liga no topo para visualizar seu respectivo feed exclusivo de publicações, fotos e comentários.
        </p>
      </div>
    );
  }

  // CASO 2: USUÁRIO NÃO É PARTICIPANTE DA LIGA (Bloqueio Elegante de Acesso)
  if (!isMember) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-sm overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" />
        
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
          <Lock className="w-10 h-10" />
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Feed Privado da Liga</span>
          </div>

          <h3 className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
            Acesso Restrito aos Participantes
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            As publicações, fotos, vídeos e a resenha de <strong className="text-slate-900 dark:text-white font-bold">{effectiveLeagueName}</strong> são exclusivas para os jogadores e administradores autorizados desta liga.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {!user ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Conectar-se para Acessar</span>
            </motion.button>
          ) : (
            effectiveLeague?.has_password ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  if (onJoinLeagueRequest) onJoinLeagueRequest();
                  else toast.info('Utilize o botão "Entrar na Liga" no topo para inserir a senha.');
                }}
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <KeyRound className="w-4 h-4" />
                <span>Digitar Senha para Entrar</span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  if (onJoinLeagueRequest) onJoinLeagueRequest();
                  else toast.info('Acesse a liga na página inicial para se registrar como participante.');
                }}
                className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Entrar nesta Liga</span>
              </motion.button>
            )
          )}
        </div>
      </motion.div>
    );
  }

  // CASO 3: USUÁRIO É MEMBRO DA LIGA -> RENDERIZA FEED EXCLUSIVO
  return (
    <div className="space-y-6">
      {/* Indicador Superior do Feed da Liga */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
            Feed Oficial • {effectiveLeagueName}
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {posts.length} {posts.length === 1 ? 'publicação' : 'publicações'}
        </span>
      </div>

      {/* Botão de Criação de Post no Feed da Liga */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.01 }}
        onClick={() => {
          if (!user) onOpenLogin();
          else onOpenCreatePost();
        }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm cursor-pointer hover:border-brand-500 transition-all flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0 overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            user?.nome.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div className="flex-1 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-2xl text-xs text-slate-400 font-medium">
          Publicar no feed de {effectiveLeagueName}...
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="px-4 py-2 bg-brand-500 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Publicar</span>
        </motion.button>
      </motion.div>

      {/* Banner / Ação do Admin da Liga */}
      {canManageThisLeague && (
        <div className="bg-gradient-to-r from-brand-500 via-orange-500 to-amber-500 rounded-3xl p-5 text-white shadow-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-white/90" />
              Painel do Organizador • {effectiveLeagueName}
            </h3>
            <p className="text-xs text-white/80">
              Divulgue resultados, destaques da rodada e avisos oficiais exclusivamente para esta liga.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={onOpenCreatePost}
            className="px-4 py-2.5 bg-white text-brand-600 font-bold text-xs rounded-xl shadow-lg hover:bg-amber-50 transition-all cursor-pointer shrink-0"
          >
            + Nova Publicação
          </motion.button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2">
                  <div className="w-32 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-20 h-2 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
              <div className="w-full h-4 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-full h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-500">
            <Trophy className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">
            Nenhuma publicação nesta liga ainda
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Seja o primeiro a publicar fotos, avisos ou resultados no feed exclusivo de {effectiveLeagueName}!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => {
            const timeAgo = formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
              locale: ptBR,
            });
            const isAuthor = user?.id === post.author_id;
            const canDeleteThisPost = isAuthor || canManageThisLeague;
            const canEditThisPost = isAuthor || canManageThisLeague;

            return (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden space-y-4"
              >
                {/* Header do Post */}
                <div className="p-5 pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Foto de Perfil do Autor Ampliável */}
                    <button
                      type="button"
                      onClick={() => {
                        if (post.author?.avatar_url) {
                          openImagePreview({
                            imageUrl: post.author.avatar_url,
                            title: post.author.nome,
                            subtitle: `Autor da Publicação${post.author.cargo ? ` • ${post.author.cargo}` : ''}`,
                            type: 'avatar',
                            badge: post.author.role === 'super_admin' ? 'Super Admin' : post.author.role === 'admin' ? 'Organizador' : undefined,
                          });
                        }
                      }}
                      className={`w-10 h-10 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 transition-transform ${
                        post.author?.avatar_url
                          ? 'cursor-pointer hover:scale-105 active:scale-95 hover:ring-2 ring-brand-500/70'
                          : 'cursor-default'
                      }`}
                      title={post.author?.avatar_url ? 'Toque para ver a foto ampliada' : post.author?.nome}
                    >
                      {post.author?.avatar_url ? (
                        <img src={post.author.avatar_url} alt={post.author.nome} className="w-full h-full object-cover" />
                      ) : (
                        post.author?.nome?.charAt(0).toUpperCase() || 'U'
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/profile/${post.author_id}`}
                          className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-brand-500 hover:underline transition-colors"
                          title={`Ver perfil de ${post.author?.nome}`}
                        >
                          {post.author?.nome || 'Participante'}
                        </Link>
                        {post.author?.role === 'super_admin' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md flex items-center gap-0.5">
                            👑 Super Admin
                          </span>
                        )}
                        {post.author?.role === 'admin' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 rounded-md">
                            Organizador
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{timeAgo}</span>
                        {post.location && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-brand-500">{post.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {canDeleteThisPost && (
                    <div className="flex items-center gap-1">
                      {canEditThisPost && (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => setEditingPost(post)}
                          className="p-2 text-slate-400 hover:text-brand-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Editar Publicação"
                        >
                          <Pencil className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Excluir Publicação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Conteúdo em Texto */}
                {post.texto && (
                  <div className="px-5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {post.texto}
                  </div>
                )}

                {/* Post Compartilhado Preview */}
                {post.original_post && (
                  <div className="mx-5 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-brand-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {post.original_post.author?.nome || 'Participante'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {post.original_post.texto}
                    </p>
                  </div>
                )}

                {/* Mídias */}
                {post.imagem_url && (
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const idx = galleryItems.findIndex((m) => m.url === post.imagem_url);
                      setGalleryIndex(idx >= 0 ? idx : 0);
                      setIsGalleryOpen(true);
                    }}
                    className="w-full bg-slate-950 dark:bg-black max-h-[650px] flex items-center justify-center overflow-hidden cursor-pointer my-2 rounded-xl"
                  >
                    <img
                      src={post.imagem_url}
                      alt="Mídia"
                      className="w-full h-auto max-h-[650px] object-contain hover:scale-101 transition-transform"
                      loading="lazy"
                    />
                  </motion.div>
                )}

                {post.video_url && (
                  <div className="w-full bg-black max-h-[500px]">
                    <video src={post.video_url} controls playsInline className="w-full max-h-[500px] object-contain" />
                  </div>
                )}

                {/* Reações e Botões */}
                <div className="px-5 pb-4 space-y-3">
                  <div className="flex items-center justify-between border-t border-b border-slate-100 dark:border-slate-800 py-2">
                    <ReactionPicker
                      currentReaction={post.user_reaction}
                      onSelectReaction={async (type) => {
                        if (!user) return onOpenLogin();
                        await supabase.from('reactions').upsert({
                          post_id: post.id,
                          user_id: user.id,
                          type,
                        });
                        fetchPosts();
                      }}
                      onRemoveReaction={async () => {
                        if (!user) return;
                        await supabase
                          .from('reactions')
                          .delete()
                          .eq('post_id', post.id)
                          .eq('user_id', user.id);
                        fetchPosts();
                      }}
                    />

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() =>
                        setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Comentar</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setSharePost(post)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Compartilhar</span>
                    </motion.button>
                  </div>

                  {/* Seção de Comentários Aninhados */}
                  {activeCommentPostId === post.id && (
                    <CommentSection 
                      postId={post.id} 
                      postAuthorId={post.author_id}
                      onOpenLogin={onOpenLogin} 
                    />
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Modais da Seção */}
      {sharePost && (
        <ShareModal
          isOpen={!!sharePost}
          onClose={() => setSharePost(null)}
          post={sharePost}
          onShareSuccess={fetchPosts}
        />
      )}

      <GalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        items={galleryItems}
        initialIndex={galleryIndex}
      />

      {editingPost && (
        <CreatePostModal
          isOpen={!!editingPost}
          onClose={() => setEditingPost(null)}
          onPostCreated={() => {
            setEditingPost(null);
            fetchPosts();
          }}
          postToEdit={editingPost}
          leagueId={effectiveLeagueId}
          leagueName={effectiveLeagueName}
        />
      )}

      {/* Lightbox para Visualização de Foto de Perfil */}
      <ImageLightboxModal
        data={lightboxData}
        onClose={closeImagePreview}
      />
    </div>
  );
};
