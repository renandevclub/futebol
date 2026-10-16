'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Award, X, Sparkles, Crown, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Tournament, TournamentTeam } from '@/types/database';
import { formatCurrency } from '@/lib/financeHelper';

interface TournamentChampionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  championTeam?: TournamentTeam | null;
  runnerUpTeam?: TournamentTeam | null;
  prizeAmount?: number;
}

export const TournamentChampionModal: React.FC<TournamentChampionModalProps> = ({
  isOpen,
  onClose,
  tournament,
  championTeam,
  runnerUpTeam,
  prizeAmount = 0,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Disparar confetes festivos
    const duration = 3.5 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#fbbf24', '#10b981', '#3b82f6', '#ec4899'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#fbbf24', '#10b981', '#3b82f6', '#ec4899'],
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [isOpen]);

  if (!isOpen || !championTeam) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl shadow-2xl p-6 text-center overflow-hidden my-6"
        >
          {/* Fundo radiante decorativo */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 blur-3xl pointer-events-none rounded-full" />

          {/* Botão fechar */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Troféu dourado animado */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.2, bounce: 0.5 }}
            className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/40 mb-4"
          >
            <Trophy className="w-10 h-10" />
          </motion.div>

          <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Campeão Consagrado!
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {championTeam.name}
          </h2>

          <p className="text-xs text-amber-200/80 font-medium mt-1">
            Conquistou o título do <strong>{tournament.name}</strong>
          </p>

          {/* Escudo do Campeão */}
          <div className="my-6">
            <div className="relative w-28 h-28 mx-auto rounded-3xl bg-slate-800/80 border-2 border-amber-400/50 p-3 shadow-2xl shadow-amber-500/20 flex items-center justify-center">
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
                <Crown className="w-5 h-5" />
              </div>
              {championTeam.badge_url ? (
                <img src={championTeam.badge_url} alt={championTeam.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-4xl">🏆</span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-400 mt-2">
              Técnico Campeão: <strong className="text-white">{championTeam.coach?.nome || 'Responsável'}</strong>
            </p>
          </div>

          {/* Premiação & Vice */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {prizeAmount > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-0.5">
                  Premiação Conquistada
                </span>
                <span className="text-lg font-black text-amber-300">
                  {formatCurrency(prizeAmount)}
                </span>
              </div>
            )}

            {runnerUpTeam && (
              <div className={`p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-center ${prizeAmount <= 0 ? 'col-span-2' : ''}`}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                  Vice-Campeão (2º Lugar)
                </span>
                <span className="text-sm font-black text-slate-200 truncate block">
                  🥈 {runnerUpTeam.name}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
          >
            Fechar e Celebrar 🏆
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
