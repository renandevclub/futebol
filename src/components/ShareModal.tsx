'use client';

import { motion } from 'framer-motion';

import React, { useState, useEffect } from 'react';
import { Post, Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Share2, Globe, User, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onShareSuccess?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post, onShareSuccess }) => {
  const { user } = useAuth();
  const [shareTarget, setShareTarget] = useState<'main_feed' | 'wall' | 'friend_wall'>('main_feed');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [shareText, setShareText] = useState<string>('');
  const [participants, setParticipants] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Buscar outros participantes para a opção "mural de outro participante"
      const fetchParticipants = async () => {
        const { data } = await supabase.from('profiles').select('*').order('nome');
        if (data) {
          setParticipants(data.filter((p) => p.id !== user?.id));
        }
      };
      fetchParticipants();
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!user) {
      toast.error('Você precisa estar identificado para compartilhar.');
      return;
    }

    try {
      setLoading(true);

      // Criar nova postagem com referência ao post original
      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          target_user_id: shareTarget === 'friend_wall' ? targetUserId : null,
          texto: shareText.trim() || `Compartilhou uma publicação de ${post.author?.nome || 'um participante'}.`,
          original_post_id: post.id,
          visibilidade: 'publica',
        })
        .select()
        .single();

      if (postError) {
        throw postError;
      }

      // Registrar compartilhamento na tabela shares
      await supabase.from('shares').insert({
        post_id: post.id,
        user_id: user.id,
        target_type: shareTarget,
        target_user_id: shareTarget === 'friend_wall' ? targetUserId : null,
      });

      toast.success('Publicação compartilhada com sucesso!');
      onShareSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao compartilhar a publicação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 relative">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-500" />
            <span>Compartilhar Publicação</span>
          </h2>
          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Escolha do Destino */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
            Onde você deseja compartilhar?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="button"
              onClick={() => setShareTarget('main_feed')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                shareTarget === 'main_feed'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Feed Principal</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="button"
              onClick={() => setShareTarget('wall')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                shareTarget === 'wall'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Meu Mural</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="button"
              onClick={() => setShareTarget('friend_wall')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                shareTarget === 'friend_wall'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Mural de Amigo</span>
            </motion.button>
          </div>
        </div>

        {/* Seleção do Amigo */}
        {shareTarget === 'friend_wall' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Selecione o participante:
            </label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
            >
              <option value="">Selecione um participante...</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.apelido ? `(${p.apelido})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mensagem Opcional */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Escreva algo sobre este post (opcional):
          </label>
          <textarea
            rows={3}
            placeholder="No que você está pensando?"
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white focus:outline-none resize-none"
          />
        </div>

        {/* Preview do Post Original */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-brand-500">
            {post.author?.nome || 'Participante'}
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
            {post.texto || 'Mídia compartilhada'}
          </p>
        </div>

        {/* Botão de Ação */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={handleShare}
          disabled={loading || (shareTarget === 'friend_wall' && !targetUserId)}
          className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Compartilhar Agora</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
