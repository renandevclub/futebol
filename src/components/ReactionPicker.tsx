'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ReactionType } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';

export const REACTION_MAP: Record<ReactionType, { emoji: string; label: string; color: string }> = {
  like: { emoji: '❤️', label: 'Curtir', color: 'text-red-500' },
  love: { emoji: '😍', label: 'Amei', color: 'text-pink-500' },
  strength: { emoji: '💪', label: 'Força', color: 'text-amber-500' },
  congrats: { emoji: '👏', label: 'Parabéns', color: 'text-emerald-500' },
  sad: { emoji: '😢', label: 'Triste', color: 'text-blue-500' },
};

interface ReactionPickerProps {
  currentReaction?: ReactionType | null;
  onSelectReaction: (type: ReactionType) => void;
  onRemoveReaction: () => void;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  currentReaction,
  onSelectReaction,
  onRemoveReaction,
}) => {
  const [isOpenPopover, setIsOpenPopover] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reactions: ReactionType[] = ['like', 'love', 'strength', 'congrats', 'sad'];

  // Fecha popover ao tocar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpenPopover(false);
      }
    };

    if (isOpenPopover) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpenPopover]);

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
      setIsOpenPopover(true);
    }, 350);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClickMainButton = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    if (isOpenPopover) {
      setIsOpenPopover(false);
      return;
    }
    if (currentReaction) {
      onRemoveReaction();
    } else {
      onSelectReaction('like');
    }
  };

  const handleSelectType = (type: ReactionType) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    onSelectReaction(type);
    setIsOpenPopover(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpenPopover(true)}
      onMouseLeave={() => setIsOpenPopover(false)}
    >
      {/* Popover com Emojis Estilo Instagram / Facebook */}
      <AnimatePresence>
        {isOpenPopover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute bottom-full left-0 mb-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-2xl flex items-center gap-1.5 z-50 select-none"
          >
            {reactions.map((type) => (
              <motion.button
                key={type}
                whileTap={{ scale: 0.8 }}
                whileHover={{ scale: 1.35, y: -2 }}
                onClick={() => handleSelectType(type)}
                className="w-9 h-9 flex items-center justify-center text-xl transition-transform focus:outline-none cursor-pointer rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                title={REACTION_MAP[type].label}
              >
                {REACTION_MAP[type].emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão de Reagir */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleClickMainButton}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[38px] touch-manipulation cursor-pointer ${
          currentReaction
            ? 'bg-slate-100 dark:bg-slate-800 ' + REACTION_MAP[currentReaction].color
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span className="text-sm">{currentReaction ? REACTION_MAP[currentReaction].emoji : '❤️'}</span>
        <span>{currentReaction ? REACTION_MAP[currentReaction].label : 'Curtir'}</span>
      </motion.button>
    </div>
  );
};
