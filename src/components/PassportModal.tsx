'use client';

import React from 'react';
import { X, Trophy, Sparkles, Zap, Award, Flame, CheckCircle2, Shield, Info, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LEVEL_TIERS, XP_RULES, PlayerProgress } from '@/lib/levelSystem';

interface PassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: PlayerProgress;
  playerName?: string;
}

export const PassportModal: React.FC<PassportModalProps> = ({
  isOpen,
  onClose,
  progress,
  playerName = 'Craque',
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-6 text-white"
        >
          {/* Header estilizado */}
          <div className="relative px-6 pt-6 pb-5 bg-gradient-to-r from-emerald-900/60 via-slate-900 to-amber-900/40 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner">
                {progress.currentTier.badgeEmoji}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Passaporte do Boleiro
                </div>
                <h3 className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                  <span>{progress.currentTier.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold">
                    Nível {progress.currentTier.level}
                  </span>
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Card de Progresso do Jogador */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">XP Acumulado</span>
                <span className="text-amber-400 font-black text-sm">
                  {progress.totalXp.toLocaleString('pt-BR')} XP Total
                </span>
              </div>

              {/* Barra de Progresso */}
              <div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.progressPercentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
                  <span>{progress.currentTier.title} ({progress.currentTier.minXp} XP)</span>
                  {progress.nextTier ? (
                    <span className="text-emerald-400 font-bold">
                      Faltam {progress.xpRequiredForNextTier - progress.xpInCurrentTier} XP para {progress.nextTier.title}
                    </span>
                  ) : (
                    <span className="text-yellow-400 font-bold">Nível Máximo Atingido! 👑</span>
                  )}
                </div>
              </div>
            </div>

            {/* Extrato de Pontuação (Breakdown) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Extrato de Conquistas de {playerName}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Partidas Jogadas</span>
                  <span className="text-sm font-black text-emerald-400">+{progress.breakdown.matchesXp} XP</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">PIX em Dia</span>
                  <span className="text-sm font-black text-teal-400">+{progress.breakdown.paidXp} XP</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Gols Marcados (Futebol)</span>
                  <span className="text-sm font-black text-amber-400">+{progress.breakdown.goalsXp} XP</span>
                </div>
                {(progress.breakdown.pointsXp || 0) > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Pontos (Vôlei)</span>
                    <span className="text-sm font-black text-amber-400">+{progress.breakdown.pointsXp} XP</span>
                  </div>
                )}
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Vitórias em Campo</span>
                  <span className="text-sm font-black text-sky-400">+{progress.breakdown.winsXp} XP</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Prêmios de MVP</span>
                  <span className="text-sm font-black text-purple-400">+{progress.breakdown.mvpXp} XP</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Frequência/Streak</span>
                  <span className="text-sm font-black text-rose-400">+{progress.breakdown.streakXp} XP</span>
                </div>
              </div>
            </div>

            {/* Como Ganhar XP (Regras) */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Como Ganhar XP na Pelada
              </h4>
              <div className="space-y-1.5">
                {XP_RULES.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{rule.icon}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-200 block truncate">{rule.action}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{rule.desc}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-400 shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      {rule.xp}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Todas as Patentes & Títulos */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-400" />
                Patentes do Boleiro
              </h4>
              <div className="space-y-2">
                {LEVEL_TIERS.map((tier) => {
                  const isCurrent = progress.currentTier.level === tier.level;
                  const isUnlocked = progress.totalXp >= tier.minXp;

                  return (
                    <div
                      key={tier.level}
                      className={`p-3 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950/50'
                          : isUnlocked
                          ? 'bg-slate-800/30 border-slate-700/50 opacity-90'
                          : 'bg-slate-900/30 border-slate-800/50 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{tier.badgeEmoji}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white">{tier.title}</span>
                              <span className="text-[10px] px-1.5 py-px rounded bg-slate-800 text-slate-400 font-bold">
                                Nível {tier.level}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black uppercase">
                                  Seu Nível
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{tier.description}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-black text-slate-300 shrink-0 ml-2">
                          {tier.minXp.toLocaleString('pt-BR')} XP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              Entendido, Partiu Jogar! ⚽
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
