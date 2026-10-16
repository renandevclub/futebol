'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Plus, Minus, Check, ShieldAlert } from 'lucide-react';
import { TeamBadge } from '@/components/TeamBadge';

interface ManualScoreAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newScoreA: number, newScoreB: number, reason?: string) => Promise<void>;
  teamAInfo: {
    name: string;
    emoji: string;
    badge_url?: string | null;
    color?: string;
  };
  teamBInfo: {
    name: string;
    emoji: string;
    badge_url?: string | null;
    color?: string;
  };
  initialScoreA: number;
  initialScoreB: number;
  sportType?: 'futebol' | 'volei';
}

export const ManualScoreAdjustModal: React.FC<ManualScoreAdjustModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  teamAInfo,
  teamBInfo,
  initialScoreA,
  initialScoreB,
  sportType = 'volei',
}) => {
  const [scoreA, setScoreA] = useState<number>(initialScoreA);
  const [scoreB, setScoreB] = useState<number>(initialScoreB);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincronizar quando abrir
  React.useEffect(() => {
    if (isOpen) {
      setScoreA(initialScoreA);
      setScoreB(initialScoreB);
      setReason('');
    }
  }, [isOpen, initialScoreA, initialScoreB]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scoreA < 0 || scoreB < 0) return;
    setIsSubmitting(true);
    try {
      await onConfirm(scoreA, scoreB, reason.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVolei = sportType === 'volei';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="w-full max-w-md bg-slate-900 text-white rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">
                  Ajuste Administrativo
                </span>
                <h3 className="font-extrabold text-base text-white">
                  Ajustar Placar Manualmente
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
            {/* Aviso de Auditoria */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Esta alteração manual sobrescreverá diretamente os pontos no banco de dados. Use para correções de arbitragem.
              </span>
            </div>

            {/* Ajuste de Pontos dos Times */}
            <div className="grid grid-cols-2 gap-4">
              {/* Time A */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center text-center space-y-2">
                <TeamBadge teamInfo={teamAInfo} size="sm" rounded="xl" />
                <span className="font-black text-xs text-white truncate max-w-full">
                  {teamAInfo.name}
                </span>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScoreA((prev) => Math.max(0, prev - 1))}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    min={0}
                    value={scoreA}
                    onChange={(e) => setScoreA(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 h-10 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono font-black text-xl text-white focus:outline-none focus:border-amber-400"
                  />

                  <button
                    type="button"
                    onClick={() => setScoreA((prev) => prev + 1)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Time B */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center text-center space-y-2">
                <TeamBadge teamInfo={teamBInfo} size="sm" rounded="xl" />
                <span className="font-black text-xs text-white truncate max-w-full">
                  {teamBInfo.name}
                </span>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setScoreB((prev) => Math.max(0, prev - 1))}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    min={0}
                    value={scoreB}
                    onChange={(e) => setScoreB(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 h-10 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono font-black text-xl text-white focus:outline-none focus:border-amber-400"
                  />

                  <button
                    type="button"
                    onClick={() => setScoreB((prev) => prev + 1)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Motivo Opcional */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Motivo da correção (opcional):
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Erro de anotação na mesa"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-2 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-black text-xs shadow-lg shadow-purple-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar Novo Placar'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
