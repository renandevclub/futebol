'use client';

import React, { useState } from 'react';
import { ReactionType } from '@/types/database';
import { motion } from 'framer-motion';

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

  const reactions: ReactionType[] = ['like', 'love', 'strength', 'congrats', 'sad'];

  const handleClickMainButton = () => {
    if (currentReaction) {
      onRemoveReaction();
    } else {
      onSelectReaction('like');
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpenPopover(true)}
      onMouseLeave={() => setIsOpenPopover(false)}
    >
      {/* Popover com Emojis Estilo Facebook */}
      {isOpenPopover && (
        <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-2xl flex items-center gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          {reactions.map((type) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.75 }}
              whileHover={{ scale: 1.35, y: -2 }}
              onClick={() => {
                onSelectReaction(type);
                setIsOpenPopover(false);
              }}
              className="p-1.5 text-xl transition-all focus:outline-none"
              title={REACTION_MAP[type].label}
            >
              {REACTION_MAP[type].emoji}
            </motion.button>
          ))}
        </div>
      )}

      {/* Botão de Reagir */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleClickMainButton}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
          currentReaction
            ? 'bg-slate-100 dark:bg-slate-800 ' + REACTION_MAP[currentReaction].color
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span>{currentReaction ? REACTION_MAP[currentReaction].emoji : '❤️'}</span>
        <span>{currentReaction ? REACTION_MAP[currentReaction].label : 'Curtir'}</span>
      </motion.button>
    </div>
  );
};

