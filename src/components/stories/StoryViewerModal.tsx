'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Eye, 
  Heart,
  Send,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Story, StoryGroup, StoryOverlay } from '@/types/stories';
import { markStoryAsViewed, deleteStory, toggleStoryLike } from '@/lib/storiesHelper';
import { StoryViewersModal } from './StoryViewersModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyGroups: StoryGroup[];
  initialGroupIndex?: number;
  initialStoryIndex?: number;
  currentUserId?: string | null;
  isSuperAdmin?: boolean;
  onStoryDeleted?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  onClose,
  storyGroups,
  initialGroupIndex = 0,
  initialStoryIndex = 0,
  currentUserId,
  isSuperAdmin = false,
  onStoryDeleted,
}) => {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isViewersOpen, setIsViewersOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [, setForceUpdate] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);

  // Sincronizar índices iniciais quando abre o modal
  useEffect(() => {
    if (isOpen) {
      setGroupIndex(Math.min(Math.max(initialGroupIndex, 0), Math.max(storyGroups.length - 1, 0)));
      setStoryIndex(Math.min(Math.max(initialStoryIndex, 0), 100));
      setProgress(0);
      setIsPaused(false);
    }
  }, [isOpen, initialGroupIndex, initialStoryIndex, storyGroups.length]);

  const currentGroup = storyGroups[groupIndex];
  const currentStory: Story | undefined = currentGroup?.stories[storyIndex];

  // Marcar story atual como visualizado
  useEffect(() => {
    if (isOpen && currentStory && currentUserId) {
      void markStoryAsViewed(currentStory.id, currentUserId);
    }
  }, [isOpen, currentStory?.id, currentUserId]);

  // Avançar para próximo story
  const goToNextStory = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      // Chegou ao fim de todos os stories
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, storyGroups.length, onClose]);

  // Voltar para story anterior
  const goToPrevStory = useCallback(() => {
    if (progress > 20 && currentStory?.media_type === 'image') {
      // Se já avançou mais de 20%, reiniciar o atual
      setProgress(0);
      return;
    }

    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [progress, currentStory?.media_type, storyIndex, groupIndex, storyGroups]);

  // Gerenciador do timer para fotos
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused || isViewersOpen) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    if (currentStory.media_type === 'image') {
      const durationMs = (currentStory.duration_seconds || 5) * 1000;
      const stepMs = 50;
      const stepPercent = (stepMs / durationMs) * 100;

      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressIntervalRef.current!);
            goToNextStory();
            return 0;
          }
          return prev + stepPercent;
        });
      }, stepMs);

      return () => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      };
    }
  }, [isOpen, currentStory, isPaused, isViewersOpen, goToNextStory]);

  // Gerenciador de progresso para vídeos
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || isPaused) return;
    const duration = videoRef.current.duration;
    const current = videoRef.current.currentTime;
    if (duration > 0) {
      const pct = (current / duration) * 100;
      setProgress(pct);
    }
  };

  const handleVideoEnded = () => {
    goToNextStory();
  };

  // Gerenciar play/pause do elemento de vídeo
  useEffect(() => {
    if (videoRef.current) {
      if (isPaused || isViewersOpen) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, isViewersOpen, storyIndex, groupIndex]);

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isViewersOpen) {
          setIsViewersOpen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        goToNextStory();
      } else if (e.key === 'ArrowLeft') {
        goToPrevStory();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isViewersOpen, goToNextStory, goToPrevStory, onClose]);

  // Gestos de clique / toque (toque curto avança/volta; toque longo pausa)
  const handlePointerDown = () => {
    pointerDownTimeRef.current = Date.now();
    isPointerDownRef.current = true;
    setIsPaused(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pressDuration = Date.now() - pointerDownTimeRef.current;
    isPointerDownRef.current = false;
    setIsPaused(false);

    // Se foi clique curto (< 250ms), navega pelas zonas
    if (pressDuration < 250) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;

      if (clickX < width * 0.35) {
        goToPrevStory();
      } else {
        goToNextStory();
      }
    }
  };

  // Curtir / Descurtir Story com animação
  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory || !currentUserId) {
      toast.info('Identifique-se para curtir este story.');
      return;
    }

    if (isLiking) return;

    try {
      setIsLiking(true);
      const isCurrentlyLiked = Boolean(currentStory.is_liked);

      // Atualização otimista
      currentStory.is_liked = !isCurrentlyLiked;
      currentStory.likes_count = (currentStory.likes_count || 0) + (isCurrentlyLiked ? -1 : 1);
      setForceUpdate((prev) => prev + 1);

      // Dispara confetes se acabou de curtir
      if (!isCurrentlyLiked) {
        confetti({
          particleCount: 28,
          spread: 60,
          origin: { y: 0.88, x: 0.85 },
          colors: ['#ef4444', '#f43f5e', '#fb7185', '#fda4af'],
        });
      }

      await toggleStoryLike(currentStory.id);
    } catch (err: any) {
      toast.error('Erro ao curtir o story.');
    } finally {
      setIsLiking(false);
    }
  };

  // Exclusão de story
  const handleDelete = async () => {
    if (!currentStory || !currentUserId) return;
    if (!confirm('Deseja realmente excluir este story?')) return;

    try {
      setIsDeleting(true);
      const storyId = currentStory.id;
      await deleteStory(storyId, currentUserId);
      toast.success('Story excluído com sucesso.');
      onStoryDeleted?.(storyId);
      onClose();
    } catch (err: any) {
      toast.error('Erro ao excluir story: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !currentGroup || !currentStory) return null;

  const isAuthor = currentUserId === currentGroup.authorId;
  const canDelete = isAuthor || isSuperAdmin;
  const overlays: StoryOverlay[] = currentStory.metadata?.overlays || [];

  const timeAgo = formatDistanceToNow(new Date(currentStory.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 sm:bg-black/95 backdrop-blur-md select-none touch-none">
      {/* Botões de navegação lateral para desktop */}
      {groupIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setGroupIndex((prev) => prev - 1);
            setStoryIndex(0);
            setProgress(0);
          }}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center backdrop-blur-md border border-white/10 transition-all z-40 cursor-pointer shadow-lg"
          title="Grupo anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {groupIndex < storyGroups.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setGroupIndex((prev) => prev + 1);
            setStoryIndex(0);
            setProgress(0);
          }}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center backdrop-blur-md border border-white/10 transition-all z-40 cursor-pointer shadow-lg"
          title="Próximo grupo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Container Principal do Story (9:16 Aspect Ratio) */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full h-full sm:h-[90vh] sm:max-w-md sm:max-h-[850px] bg-black sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl border-0 sm:border sm:border-slate-800"
      >
        {/* Barras de Progresso Superiores */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 pt-3 sm:pt-4 flex items-center gap-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {currentGroup.stories.map((st, idx) => {
            let barWidth = 0;
            if (idx < storyIndex) barWidth = 100;
            else if (idx === storyIndex) barWidth = progress;

            return (
              <div
                key={st.id || idx}
                className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Cabeçalho com Informações do Autor e Controles */}
        <div className="absolute top-6 sm:top-7 inset-x-0 z-30 px-3 sm:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar do Autor */}
            <div className="w-9 h-9 rounded-full ring-2 ring-emerald-500 overflow-hidden bg-slate-800 shrink-0">
              {currentGroup.authorAvatar ? (
                <img
                  src={currentGroup.authorAvatar}
                  alt={currentGroup.authorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">
                  {currentGroup.authorName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-white truncate drop-shadow-md">
                  {currentGroup.authorApelido || currentGroup.authorName}
                </span>
                {currentGroup.isCurrentUser && (
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/80 text-[10px] font-black text-white shrink-0">
                    Você
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/75 flex items-center gap-1 drop-shadow-sm font-medium">
                <span>{timeAgo}</span>
              </p>
            </div>
          </div>

          {/* Controles do Topo (Pause, Mute, Delete, Close) */}
          <div className="flex items-center gap-1 text-white">
            {currentStory.media_type === 'video' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted((prev) => !prev);
                }}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors cursor-pointer"
                title={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused((prev) => !prev);
              }}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors cursor-pointer"
              title={isPaused ? 'Continuar' : 'Pausar'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete();
                }}
                disabled={isDeleting}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-red-500/80 flex items-center justify-center transition-colors cursor-pointer text-white/90 hover:text-white"
                title="Excluir story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors cursor-pointer ml-1"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zona Interativa de Toque / Mídia */}
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="relative flex-1 w-full h-full flex items-center justify-center cursor-pointer overflow-hidden bg-black"
        >
          {currentStory.media_type === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.media_url}
              playsInline
              autoPlay
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <img
              src={currentStory.media_url}
              alt="Story"
              className="w-full h-full object-contain pointer-events-none"
              loading="eager"
            />
          )}

          {/* OVERLAYS PERSONALIZADOS (TEXTOS E FIGURINHAS) */}
          {overlays.map((ov) => (
            <div
              key={ov.id}
              className="absolute pointer-events-none select-none z-20"
              style={{
                left: `${ov.x}%`,
                top: `${ov.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {ov.type === 'text' && (
                <div
                  className={`px-4 py-2 rounded-2xl font-black text-sm sm:text-base leading-tight shadow-xl drop-shadow-md whitespace-pre-wrap text-center ${
                    ov.style === 'pill'
                      ? 'bg-opacity-95'
                      : ov.style === 'neon'
                      ? 'border-2 border-emerald-400 text-emerald-400 bg-black/60 shadow-emerald-500/50'
                      : 'bg-black/60 text-white backdrop-blur-xs'
                  }`}
                  style={{
                    backgroundColor: ov.style === 'pill' ? ov.bgColor : undefined,
                    color: ov.color,
                  }}
                >
                  {ov.text}
                </div>
              )}

              {ov.type === 'sticker' && ov.label && (
                <div
                  className={`px-3.5 py-1.5 rounded-full font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xl ${
                    ov.bgColor || 'bg-emerald-500'
                  } ${ov.color || 'text-white'}`}
                >
                  <span className="text-base sm:text-lg">{ov.sticker}</span>
                  <span>{ov.label}</span>
                </div>
              )}

              {ov.type === 'sticker' && !ov.label && (
                <div className="text-5xl filter drop-shadow-lg">
                  {ov.sticker}
                </div>
              )}
            </div>
          ))}

          {/* Dica visual suave de toque */}
          <div className="absolute inset-0 pointer-events-none flex justify-between z-10 opacity-0 hover:opacity-10 transition-opacity">
            <div className="w-1/3 h-full bg-white/5" />
            <div className="w-2/3 h-full bg-white/5" />
          </div>
        </div>

        {/* =========================================================================
            RODAPÉ ESTILO INSTAGRAM: LEGENDA, BARRA DE RESPOSTA E CURTIDA COM CORAÇÃO
           ========================================================================= */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 pb-5 pt-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2.5 pointer-events-auto">
          {/* Legenda do Story se existir */}
          {currentStory.caption && (
            <div className="bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 max-h-20 overflow-y-auto">
              <p className="text-xs sm:text-sm text-white font-medium leading-relaxed break-words whitespace-pre-wrap">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* BARRA DE AÇÕES INFERIOR */}
          {isAuthor ? (
            /* VISÃO DO AUTOR: CONTADOR DE VISUALIZAÇÕES E CURTIDAS */
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsViewersOpen(true);
                }}
                className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white font-black text-xs flex items-center gap-2 transition-all border border-white/15 shadow-sm cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentStory.views_count || 0} visualizações</span>
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/20 text-rose-400 font-black text-xs">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>{currentStory.likes_count || 0}</span>
              </div>
            </div>
          ) : (
            /* VISÃO DE OUTROS USUÁRIOS: BARRA DE RESPOSTA E BOTÃO DE CURTIR COM CORAÇÃO */
            <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              {/* Campo falso de resposta para manter o visual exato do Instagram */}
              <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5 flex items-center justify-between text-xs text-white/70">
                <span className="truncate">
                  Responder a {currentGroup.authorApelido || currentGroup.authorName.split(' ')[0]}...
                </span>
                <Send className="w-3.5 h-3.5 text-white/40" />
              </div>

              {/* Botão de Curtir com Coração */}
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={handleToggleLike}
                className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${
                  currentStory.is_liked
                    ? 'bg-rose-500/20 border-rose-500/50 shadow-lg shadow-rose-500/20'
                    : 'bg-black/40 hover:bg-black/60 border-white/20'
                }`}
                title={currentStory.is_liked ? 'Descurtir' : 'Curtir story'}
              >
                <Heart
                  className={`w-6 h-6 transition-transform ${
                    currentStory.is_liked
                      ? 'fill-rose-500 text-rose-500 scale-110 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                      : 'text-white hover:text-rose-400'
                  }`}
                />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modal de Lista de Visualizadores */}
      {currentStory && (
        <StoryViewersModal
          storyId={currentStory.id}
          isOpen={isViewersOpen}
          onClose={() => setIsViewersOpen(false)}
        />
      )}
    </div>
  );
};
