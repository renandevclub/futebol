'use client';

import React, { useState } from 'react';
import { Shield } from 'lucide-react';

export interface TeamBadgeInfo {
  name: string;
  emoji?: string;
  badge_url?: string | null;
  badgeUrl?: string | null;
  color?: string;
  border?: string;
  lightBg?: string;
  text?: string;
}

export type TeamBadgeSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';

interface TeamBadgeProps {
  teamInfo?: TeamBadgeInfo | null;
  size?: TeamBadgeSize;
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  showBorder?: boolean;
  showBackground?: boolean;
  className?: string;
  fallbackEmoji?: string;
  imgClassName?: string;
  priority?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const SIZE_MAP: Record<
  TeamBadgeSize,
  {
    container: string;
    emoji: string;
    imgPadding: string;
  }
> = {
  '2xs': {
    container: 'w-5 h-5 min-w-[20px] min-h-[20px]',
    emoji: 'text-[11px]',
    imgPadding: 'p-0.5',
  },
  xs: {
    container: 'w-6 h-6 min-w-[24px] min-h-[24px]',
    emoji: 'text-xs',
    imgPadding: 'p-0.5',
  },
  sm: {
    container: 'w-8 h-8 min-w-[32px] min-h-[32px]',
    emoji: 'text-base',
    imgPadding: 'p-1',
  },
  md: {
    container: 'w-11 h-11 min-w-[44px] min-h-[44px]',
    emoji: 'text-xl',
    imgPadding: 'p-1.5',
  },
  lg: {
    container: 'w-14 h-14 sm:w-18 sm:h-18 min-w-[56px] min-h-[56px]',
    emoji: 'text-2xl sm:text-3xl',
    imgPadding: 'p-2',
  },
  xl: {
    container: 'w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 min-w-[64px] min-h-[64px]',
    emoji: 'text-3xl sm:text-4xl lg:text-5xl',
    imgPadding: 'p-2 sm:p-2.5',
  },
  '2xl': {
    container: 'w-24 h-24 sm:w-28 sm:h-28 min-w-[96px] min-h-[96px]',
    emoji: 'text-5xl sm:text-6xl',
    imgPadding: 'p-3',
  },
  custom: {
    container: '',
    emoji: 'text-xl',
    imgPadding: 'p-1.5',
  },
};

const ROUNDED_MAP = {
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  '2xl': 'rounded-3xl',
  '3xl': 'rounded-[28px]',
  full: 'rounded-full',
};

/**
 * Componente padronizado para exibição uniforme de emblemas de times.
 * Mantém a proporção exata 1:1, sem distorção e com visual adaptado para desktop e mobile.
 */
export const TeamBadge: React.FC<TeamBadgeProps> = ({
  teamInfo,
  size = 'md',
  rounded = '2xl',
  showBorder = true,
  showBackground = true,
  className = '',
  fallbackEmoji,
  imgClassName = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const badgeUrl = teamInfo?.badge_url || teamInfo?.badgeUrl || null;
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const roundedClass = ROUNDED_MAP[rounded] || ROUNDED_MAP['2xl'];

  const borderClass = showBorder
    ? teamInfo?.border
      ? `border-2 ${teamInfo.border}`
      : 'border-2 border-slate-300 dark:border-slate-700'
    : '';

  const bgClass = showBackground
    ? teamInfo?.lightBg
      ? teamInfo.lightBg
      : teamInfo?.color
      ? `${teamInfo.color}/15`
      : 'bg-slate-100 dark:bg-slate-800'
    : 'bg-transparent';

  const interactiveClass = onClick
    ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all group'
    : '';

  const emojiDisplay = fallbackEmoji || teamInfo?.emoji || '⚽';

  // Se houver URL de emblema e não houver erro no carregamento
  if (badgeUrl && !imageError) {
    return (
      <div
        onClick={onClick}
        className={`relative inline-flex items-center justify-center shrink-0 aspect-square select-none overflow-hidden backdrop-blur-xs shadow-xs transition-transform duration-200 ${sizeConfig.container} ${roundedClass} ${borderClass} ${bgClass} ${interactiveClass} ${className}`}
        title={teamInfo?.name ? `${teamInfo.name}${onClick ? ' (Clique para ampliar)' : ''}` : 'Emblema do Time'}
      >
        <img
          src={badgeUrl}
          alt={teamInfo?.name ? `Emblema ${teamInfo.name}` : 'Emblema do Time'}
          onError={() => setImageError(true)}
          className={`w-full h-full object-contain ${sizeConfig.imgPadding} transition-all duration-300 drop-shadow-md group-hover:scale-105 ${imgClassName}`}
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback caso não haja emblema (exibe o emoji estilizado no container padronizado)
  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 aspect-square select-none overflow-hidden shadow-xs transition-transform duration-200 ${sizeConfig.container} ${roundedClass} ${borderClass} ${bgClass} ${interactiveClass} ${className}`}
      title={teamInfo?.name || 'Time'}
    >
      <span className={`leading-none flex items-center justify-center ${sizeConfig.emoji} drop-shadow-xs`}>
        {emojiDisplay}
      </span>
    </div>
  );
};
