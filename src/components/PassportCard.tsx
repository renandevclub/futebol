'use client';

import React, { useState } from 'react';
import { Sparkles, Trophy, Flame, ChevronRight, Zap, Award, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { PlayerProgress, calculatePlayerProgress } from '@/lib/levelSystem';
import { PassportModal } from '@/components/PassportModal';
import { Profile } from '@/types/database';

interface PassportCardProps {
  profile: Profile;
  stats: {
    matches_played: number;
    paid_matches_count?: number;
    gols?: number;
    pontos?: number;
    wins?: number;
    mvp_count?: number;
    championships_won?: number;
    win_streak?: number;
    monthly_frequency?: number;
  };
  className?: string;
  compact?: boolean;
}

export const PassportCard: React.FC<PassportCardProps> = ({
  profile,
  stats,
  className = '',
  compact = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const progress: PlayerProgress = calculatePlayerProgress({
    matches_played: stats.matches_played || 0,
    paid_matches_count: stats.paid_matches_count,
    gols: stats.gols || 0,
    pontos: stats.pontos || 0,
    wins: stats.wins || 0,
    mvp_count: stats.mvp_count || 0,
    championships_won: stats.championships_won || 0,
    win_streak: stats.win_streak || 0,
    monthly_frequency: stats.monthly_frequency || 0,
  });

  const { currentTier, nextTier, totalXp, xpInCurrentTier, xpRequiredForNextTier, progressPercentage } = progress;

  if (compact) {
    return (
      <>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/80 border ${currentTier.badgeBg} backdrop-blur-md shadow-sm transition-all ${className}`}
        >
          <span className="text-lg shrink-0">{currentTier.badgeEmoji}</span>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white">{currentTier.title}</span>
              <span className="text-[10px] px-1.5 py-px rounded bg-emerald-500/20 text-emerald-400 font-extrabold">
                Nv. {currentTier.level}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {totalXp.toLocaleString('pt-BR')} XP
            </div>
          </div>
        </motion.div>

        <PassportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          progress={progress}
          playerName={profile.nome}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-[#0a1612] to-slate-950 p-5 sm:p-6 text-white shadow-xl ${className}`}
      >
        {/* Glow de fundo */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />

        {/* Topo do Passaporte */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3.5">
            {/* Avatar com Badge de Nível */}
            <div className="relative">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-slate-800 border-2 border-emerald-400/40 overflow-hidden shadow-lg flex items-center justify-center text-xl font-bold text-white">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.nome} className="h-full w-full object-cover" />
                ) : (
                  profile.nome?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-sm shadow-md">
                {currentTier.badgeEmoji}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  Passaporte do Boleiro
                </span>
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-slate-400 font-bold">Oficial</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                {profile.nome} {profile.apelido ? `"${profile.apelido}"` : ''}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <span>{currentTier.title}</span>
                  <span className="text-[10px] px-1.5 py-px rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300">
                    Nível {currentTier.level}
                  </span>
                </span>
                {((profile.sport_types ? profile.sport_types.includes('futebol') : true) && (profile.futebol_position || profile.posicao)) && (
                  <span className="text-xs text-slate-400 font-medium">• ⚽ {profile.futebol_position || profile.posicao}</span>
                )}
                {(profile.sport_types?.includes('volei') || profile.volei_position) && (
                  <span className="text-xs text-slate-400 font-medium">• 🏐 {profile.volei_position || 'Vôlei'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Botão para ver Missões */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-sm group"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ver Missões & XP</span>
            <ChevronRight className="w-3.5 h-3.5 text-emerald-400/70 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>
        </div>

        {/* Barra de Progresso de XP */}
        <div className="relative z-10 pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Progresso de XP
            </span>
            <span className="text-emerald-400 font-black">
              {totalXp.toLocaleString('pt-BR')} XP Total
            </span>
          </div>

          <div className="relative h-3 w-full rounded-full bg-slate-950/80 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>{currentTier.badgeEmoji} {currentTier.title}</span>
            {nextTier ? (
              <span className="text-slate-300">
                Próximo: <strong className="text-white">{nextTier.badgeEmoji} {nextTier.title}</strong> (
                {progressPercentage}% concluído)
              </span>
            ) : (
              <span className="text-yellow-400 font-bold">Patente Máxima! 👑</span>
            )}
          </div>
        </div>

        {/* Mini Cards de Estatísticas com XP */}
        <div className="relative z-10 grid grid-cols-3 sm:grid-cols-4 gap-2 pt-4">
          <div className="p-2.5 rounded-2xl bg-slate-800/40 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Partidas</span>
            <span className="text-sm font-black text-white">{stats.matches_played || 0}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-800/40 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Gols Feitos</span>
            <span className="text-sm font-black text-amber-400">{stats.gols || 0} ⚽</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-800/40 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">Vitórias</span>
            <span className="text-sm font-black text-emerald-400">{stats.wins || 0} 🔥</span>
          </div>
          <div className="hidden sm:block p-2.5 rounded-2xl bg-slate-800/40 border border-slate-800/80 text-center">
            <span className="text-[10px] text-slate-400 block font-medium">MVP</span>
            <span className="text-sm font-black text-purple-400">{stats.mvp_count || 0} 🌟</span>
          </div>
        </div>
      </div>

      <PassportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        progress={progress}
        playerName={profile.nome}
      />
    </>
  );
};
