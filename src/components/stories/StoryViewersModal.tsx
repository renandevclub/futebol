'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Users, Clock, Heart } from 'lucide-react';
import { fetchStoryViewers } from '@/lib/storiesHelper';
import { StoryViewer } from '@/types/stories';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StoryViewersModalProps {
  storyId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const StoryViewersModal: React.FC<StoryViewersModalProps> = ({
  storyId,
  isOpen,
  onClose,
}) => {
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !storyId) return;

    let isMounted = true;
    setLoading(true);

    fetchStoryViewers(storyId)
      .then((data) => {
        if (isMounted) {
          setViewers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar visualizadores:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [storyId, isOpen]);

  if (!isOpen) return null;

  const totalLikes = viewers.filter((v) => v.has_liked).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Visualizações</span>
                  {totalLikes > 0 && (
                    <span className="flex items-center gap-1 text-xs text-rose-500 font-bold">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      <span>{totalLikes}</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {viewers.length} {viewers.length === 1 ? 'pessoa visualizou' : 'pessoas visualizaram'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-1 flex-1">
                      <div className="w-32 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="w-20 h-2.5 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : viewers.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Nenhuma visualização ainda
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Assim que outros membros da liga ou amigos assistirem seu story, eles aparecerão aqui.
                </p>
              </div>
            ) : (
              viewers.map((viewer) => {
                const displayName = viewer.viewer_apelido
                  ? `${viewer.viewer_nome} (${viewer.viewer_apelido})`
                  : viewer.viewer_nome;

                const timeAgo = formatDistanceToNow(new Date(viewer.viewed_at), {
                  addSuffix: true,
                  locale: ptBR,
                });

                return (
                  <div
                    key={viewer.viewer_id}
                    className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                        {viewer.viewer_avatar ? (
                          <img
                            src={viewer.viewer_avatar}
                            alt={viewer.viewer_nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs">
                            {viewer.viewer_nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo}</span>
                        </p>
                      </div>
                    </div>

                    {/* Indicador de Curtida com Coração */}
                    {viewer.has_liked && (
                      <div 
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-black shrink-0"
                        title="Curtiu este story"
                      >
                        <Heart className="w-3.5 h-3.5 fill-rose-500" />
                        <span className="hidden sm:inline text-[10px]">Curtiu</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
