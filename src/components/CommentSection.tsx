'use client';

import React, { useState, useEffect } from 'react';
import { Comment, Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/mediaCompressor';
import { Heart, Image as ImageIcon, Send, Trash2, Edit2, CornerDownRight, Smile, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { subscribeToTables } from '@/lib/realtime';
import { createNotification } from '@/lib/notifications';
import { motion } from 'framer-motion';

interface CommentSectionProps {
  postId: string;
  postAuthorId?: string;
  onOpenLogin: () => void;
}

const COMMON_EMOJIS = ['🏐', '🔥', '👏', '😍', '💪', '🏆', '🎉', '💯', '❤️', '⚡'];

export const CommentSection: React.FC<CommentSectionProps> = ({ postId, postAuthorId, onOpenLogin }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newCommentText, setNewCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToUser, setReplyToUser] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const fetchComments = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          user:user_id(*)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar comentários:', error);
        return;
      }

      // Buscar curtidas em comentários se o usuário estiver logado
      const commentIds = (data || []).map((c) => c.id);
      let userLikesSet = new Set<string>();

      if (user && commentIds.length > 0) {
        const { data: likesData } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', user.id);

        if (likesData) {
          likesData.forEach((l) => userLikesSet.add(l.comment_id));
        }
      }

      // Contar curtidas por comentário
      const { data: likesCounts } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds.length > 0 ? commentIds : ['00000000-0000-0000-0000-000000000000']);

      const countMap: Record<string, number> = {};
      (likesCounts || []).forEach((lc) => {
        countMap[lc.comment_id] = (countMap[lc.comment_id] || 0) + 1;
      });

      // Estruturar comentários principais e respostas
      const formattedComments: Comment[] = (data || []).map((c) => ({
        ...c,
        is_liked: userLikesSet.has(c.id),
        likes_count: countMap[c.id] || 0,
        replies: [],
      }));

      const topLevel: Comment[] = [];
      const repliesMap: Record<string, Comment[]> = {};

      formattedComments.forEach((c) => {
        if (c.parent_id) {
          if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
          repliesMap[c.parent_id].push(c);
        } else {
          topLevel.push(c);
        }
      });

      topLevel.forEach((c) => {
        c.replies = repliesMap[c.id] || [];
      });

      setComments(topLevel);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchComments(true);

    return subscribeToTables(
      `comments_post_${postId}`,
      [
        { table: 'comments' },
        { table: 'comment_likes' },
      ],
      () => fetchComments(),
    );
  }, [postId, user?.id]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setNewCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenLogin();
      return;
    }

    if (!newCommentText.trim() && !selectedImage) {
      toast.error('Digite um comentário ou selecione uma imagem.');
      return;
    }

    try {
      setSubmitting(true);
      let uploadedImageUrl: string | null = null;

      if (selectedImage) {
        const compressed = await compressImage(selectedImage);
        const fileName = `${user.id}_${Date.now()}.webp`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('posts')
          .upload(`comments/${fileName}`, compressed);

        if (uploadError) {
          toast.error('Erro ao enviar imagem do comentário.');
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('posts')
          .getPublicUrl(`comments/${fileName}`);

        uploadedImageUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: user.id,
        parent_id: replyToId,
        comentario: newCommentText.trim(),
        imagem_url: uploadedImageUrl,
      });

      if (error) {
        toast.error('Erro ao enviar comentário.');
      } else {
        toast.success('Comentário enviado!');

        if (postAuthorId && postAuthorId !== user.id) {
          const name = user.apelido || user.nome || 'Alguém';
          const textPreview = newCommentText.trim() ? ` "${newCommentText.trim().substring(0, 40)}..."` : '';
          void createNotification({
            userId: postAuthorId,
            type: 'comment',
            title: 'Novo Comentário 💬',
            message: `${name} comentou no seu post:${textPreview}`,
            link: `/?post=${postId}`,
            metadata: { post_id: postId, commenter_id: user.id },
          });
        }

        setNewCommentText('');
        setSelectedImage(null);
        setImagePreview(null);
        setReplyToId(null);
        setReplyToUser(null);
        fetchComments();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar comentário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLikeComment = async (commentId: string, currentLiked?: boolean) => {
    if (!user) {
      onOpenLogin();
      return;
    }

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }

    if (currentLiked) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id);
    } else {
      await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: user.id,
      });
    }

    fetchComments();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Deseja excluir este comentário?')) return;
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) toast.error('Erro ao excluir.');
    else {
      toast.success('Comentário excluído.');
      fetchComments();
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from('comments')
      .update({ comentario: editText.trim() })
      .eq('id', commentId);

    if (error) toast.error('Erro ao editar.');
    else {
      toast.success('Comentário atualizado.');
      setEditingCommentId(null);
      fetchComments();
    }
  };

  const renderSingleComment = (comment: Comment, isReply = false) => {
    const isOwner = user?.id === comment.user_id;
    const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
      addSuffix: true,
      locale: ptBR,
    });

    return (
      <div key={comment.id} className={`group flex gap-2.5 ${isReply ? 'ml-8 mt-2' : 'mt-3'}`}>
        {/* Avatar link para Perfil */}
        <Link href={`/profile/${comment.user_id}`} className="shrink-0">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs overflow-hidden border border-slate-300 dark:border-slate-600 hover:scale-105 transition-transform">
            {comment.user?.avatar_url ? (
              <img src={comment.user.avatar_url} alt={comment.user.nome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-slate-700 dark:text-slate-200">
                {comment.user?.nome?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
        </Link>

        <div className="flex-1 space-y-1">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 inline-block max-w-full">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/profile/${comment.user_id}`}
                className="font-extrabold text-xs text-slate-900 dark:text-white hover:text-brand-500 transition-colors"
              >
                {comment.user?.nome} {comment.user?.apelido ? `(${comment.user.apelido})` : ''}
              </Link>
              <span className="text-[10px] text-slate-400 font-medium">{timeAgo}</span>
            </div>

            {editingCommentId === comment.id ? (
              <div className="mt-1.5 space-y-1.5">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-brand-500 rounded-lg focus:outline-none"
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => setEditingCommentId(null)}
                    className="text-[10px] text-slate-500 hover:underline px-2 py-0.5"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSaveEdit(comment.id)}
                    className="text-[10px] bg-brand-500 text-white rounded px-2.5 py-0.5 font-bold"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                {comment.comentario}
              </p>
            )}

            {comment.imagem_url && (
              <div className="mt-2 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 dark:bg-black">
                <img src={comment.imagem_url} alt="Anexo do comentário" className="w-full h-auto object-contain max-h-72" />
              </div>
            )}
          </div>

          {/* Ações do Comentário */}
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 pl-1">
            <button
              onClick={() => handleToggleLikeComment(comment.id, comment.is_liked)}
              className={`flex items-center gap-1 hover:underline ${
                comment.is_liked ? 'text-red-500 font-extrabold' : ''
              }`}
            >
              <Heart className={`w-3 h-3 ${comment.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{comment.likes_count ? comment.likes_count : ''} Curtir</span>
            </button>

            {!isReply && (
              <button
                onClick={() => {
                  setReplyToId(comment.id);
                  setReplyToUser(comment.user?.nome || 'Usuário');
                }}
                className="flex items-center gap-1 hover:underline"
              >
                <CornerDownRight className="w-3 h-3" />
                <span>Responder</span>
              </button>
            )}

            {isOwner && editingCommentId !== comment.id && (
              <>
                <button
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditText(comment.comentario);
                  }}
                  className="hover:underline flex items-center gap-0.5"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="hover:underline text-red-400 flex items-center gap-0.5"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Excluir
                </button>
              </>
            )}
          </div>

          {/* Respostas Aninhadas */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="space-y-2 pt-1">
              {comment.replies.map((reply) => renderSingleComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
      {/* Lista de Comentários */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Carregando comentários...</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2 italic">
          Nenhum comentário ainda. Seja o primeiro a comentar!
        </p>
      ) : (
        <div className="space-y-1">{comments.map((c) => renderSingleComment(c))}</div>
      )}

      {/* Indicador de Resposta */}
      {replyToId && (
        <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-950/40 p-2 rounded-xl border border-brand-200 dark:border-brand-800 text-xs">
          <span className="font-semibold text-brand-700 dark:text-brand-300">
            Respondendo a <strong>{replyToUser}</strong>
          </span>
          <button
            onClick={() => {
              setReplyToId(null);
              setReplyToUser(null);
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input de Novo Comentário */}
      <form onSubmit={handleSubmitComment} className="space-y-2">
        {imagePreview && (
          <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <img src={imagePreview} alt="Preview" className="h-16 w-auto object-cover" />
            <button
              type="button"
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
              className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full hover:bg-black"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 sm:p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
          <input
            type="text"
            placeholder={user ? 'Escreva um comentário...' : 'Identifique-se para comentar'}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={submitting}
            className="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-white focus:outline-none px-2 min-h-[40px]"
          />

          {/* Anexar Imagem */}
          <label className="p-2 sm:p-2.5 text-slate-500 hover:text-brand-500 cursor-pointer rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation">
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </label>

          {/* Emojis Rápidos */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(10);
              }
              setShowEmojiPicker(!showEmojiPicker);
            }}
            className="p-2 sm:p-2.5 text-slate-500 hover:text-amber-500 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation cursor-pointer"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Enviar */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            type="submit"
            disabled={submitting}
            onClick={() => {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(12);
              }
            }}
            className="p-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </motion.button>
        </div>

        {/* Emoji Bar */}
        {showEmojiPicker && (
          <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-x-auto">
            {COMMON_EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                whileTap={{ scale: 0.8 }}
                whileHover={{ scale: 1.3 }}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="text-base p-1"
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};
