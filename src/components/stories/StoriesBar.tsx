'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Story, StoryGroup } from '@/types/stories';
import { fetchActiveStoryGroups } from '@/lib/storiesHelper';
import { subscribeToTables } from '@/lib/realtime';
import { StoryViewerModal } from './StoryViewerModal';
import { CreateStoryModal } from './CreateStoryModal';

interface StoriesBarProps {
  leagueId?: string | null;
  leagueName?: string | null;
  onOpenLogin?: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  leagueId,
  leagueName,
  onOpenLogin,
}) => {
  const { user, isSuperAdmin } = useAuth();

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais de Criação e Visualização
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Carregar stories do usuário e da comunidade/liga
  const loadStories = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const groups = await fetchActiveStoryGroups(user?.id || null, leagueId || null);
      setStoryGroups(groups);
    } catch (err) {
      console.error('Erro ao carregar stories:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [user?.id, leagueId]);

  // Efeito inicial + inscrição realtime para stories
  useEffect(() => {
    void loadStories(true);

    // Inscrição Realtime na tabela stories e story_views
    const unsubscribe = subscribeToTables(
      `stories_channel_${leagueId || 'all'}`,
      [{ table: 'stories' }, { table: 'story_views' }],
      () => {
        void loadStories(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [loadStories, leagueId]);

  // Verificar capacidade de rolagem horizontal
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [storyGroups]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -240 : 240;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(checkScroll, 300);
  };

  // Encontrar o grupo do usuário atual (se houver)
  const currentUserGroup = storyGroups.find((g) => g.isCurrentUser);
  // Outros grupos (de outros usuários)
  const otherGroups = storyGroups.filter((g) => !g.isCurrentUser);

  const handleOpenMyStory = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      onOpenLogin?.();
      return;
    }

    if (currentUserGroup && currentUserGroup.stories.length > 0) {
      // Abre os stories do usuário
      const myGroupIdx = storyGroups.findIndex((g) => g.isCurrentUser);
      setSelectedGroupIndex(myGroupIdx >= 0 ? myGroupIdx : 0);
      setIsViewerOpen(true);
    } else {
      // Abre o modal para criar story
      setIsCreateOpen(true);
    }
  };

  const handleOpenGroup = (groupIndex: number) => {
    setSelectedGroupIndex(groupIndex);
    setIsViewerOpen(true);
  };

  return (
    <>
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm overflow-hidden group/bar">
        {/* Setas de navegação desktop */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Container Horizontal com Scroll Oculto */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* ITEM 1: Criar Story / Seu Story */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
            <div className="relative cursor-pointer group" onClick={handleOpenMyStory}>
              {/* Círculo do Avatar */}
              <div
                className={`w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full p-[2.5px] transition-transform duration-200 group-hover:scale-105 ${
                  currentUserGroup && currentUserGroup.stories.length > 0
                    ? 'bg-gradient-to-tr from-brand-500 via-emerald-400 to-amber-400 shadow-sm shadow-brand-500/20'
                    : 'border-2 border-dashed border-slate-300 dark:border-slate-700'
                }`}
              >
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 p-[2px] overflow-hidden flex items-center justify-center">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="Seu avatar"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-extrabold text-sm sm:text-base">
                      {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Adição (+) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!user) onOpenLogin?.();
                  else setIsCreateOpen(true);
                }}
                className="absolute bottom-0 right-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md transition-transform group-hover:scale-110 cursor-pointer"
                title="Criar novo story"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              </button>
            </div>

            <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[72px] text-center">
              {currentUserGroup && currentUserGroup.stories.length > 0
                ? 'Seu Story'
                : 'Criar Story'}
            </span>
          </div>

          {/* SKELETON LOADING */}
          {loading && (
            <div className="flex items-center gap-3.5 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
                  <div className="w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full bg-slate-200 dark:bg-slate-800 p-[2.5px]" />
                  <div className="w-12 h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* STORIES DE OUTROS USUÁRIOS */}
          {!loading &&
            otherGroups.map((group) => {
              // Índice real no array storyGroups
              const globalIndex = storyGroups.findIndex((g) => g.authorId === group.authorId);

              return (
                <motion.div
                  key={group.authorId}
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={() => handleOpenGroup(globalIndex)}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer select-none group"
                >
                  <div className="relative">
                    {/* Anel de destaque (gradiente se não visto; cinza sutil se já visto) */}
                    <div
                      className={`w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full p-[2.5px] transition-all duration-200 ${
                        group.hasUnviewed
                          ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-500 shadow-md shadow-rose-500/20'
                          : 'border-2 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 p-[2px] overflow-hidden flex items-center justify-center">
                        {group.authorAvatar ? (
                          <img
                            src={group.authorAvatar}
                            alt={group.authorName}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-extrabold text-sm sm:text-base">
                            {group.authorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badge com contagem de stories do autor se mais de 1 */}
                    {group.stories.length > 1 && (
                      <div className="absolute top-0 right-0 px-1.5 py-0.2 rounded-full bg-brand-500 text-white text-[9px] font-black border-2 border-white dark:border-slate-900 shadow-sm">
                        {group.stories.length}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[11px] sm:text-xs font-semibold truncate max-w-[72px] text-center transition-colors ${
                      group.hasUnviewed
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {group.authorApelido || group.authorName.split(' ')[0]}
                  </span>
                </motion.div>
              );
            })}

          {/* Dica para primeiro story se não houver stories de outros usuários */}
          {!loading && otherGroups.length === 0 && (!currentUserGroup || currentUserGroup.stories.length === 0) && (
            <div className="hidden sm:flex items-center gap-2 pl-2 text-xs text-slate-400 font-medium">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Publique o primeiro Story da resenha hoje!</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Criar Story */}
      {isCreateOpen && user && (
        <CreateStoryModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          currentUserId={user.id}
          userAvatar={user.avatar_url}
          userName={user.nome}
          leagueId={leagueId}
          leagueName={leagueName}
          onStoryCreated={() => {
            void loadStories(false);
          }}
        />
      )}

      {/* Modal para Visualizar Stories em Tela Cheia */}
      {isViewerOpen && storyGroups.length > 0 && (
        <StoryViewerModal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          storyGroups={storyGroups}
          initialGroupIndex={selectedGroupIndex}
          currentUserId={user?.id || null}
          isSuperAdmin={isSuperAdmin}
          onStoryDeleted={(deletedId) => {
            setStoryGroups((prev) =>
              prev
                .map((g) => ({
                  ...g,
                  stories: g.stories.filter((s) => s.id !== deletedId),
                }))
                .filter((g) => g.stories.length > 0)
            );
            void loadStories(false);
          }}
        />
      )}
    </>
  );
};
