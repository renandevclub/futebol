'use client';

import React, { useState } from 'react';
import { MatchParticipant } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Check, User } from 'lucide-react';
import { TeamBadge } from '@/components/TeamBadge';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (playerId: string | null) => void;
  teamNumber: number;
  teamName: string;
  teamEmoji: string;
  teamBadgeUrl?: string | null;
  teamColor?: string;
  players: MatchParticipant[];
  isSubmitting?: boolean;
  sportType?: 'futebol' | 'volei';
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  teamNumber,
  teamName,
  teamEmoji,
  teamBadgeUrl,
  teamColor,
  players,
  isSubmitting = false,
  sportType = 'futebol',
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const isVolei = sportType === 'volei';

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedPlayerId);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Cabeçalho */}
          <div className={`p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between ${
            isVolei
              ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-yellow-500/15'
              : 'bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-teal-500/10'
          }`}>
            <div className="flex items-center gap-2.5">
              <TeamBadge
                teamInfo={{
                  name: teamName,
                  emoji: teamEmoji,
                  badge_url: teamBadgeUrl,
                  color: teamColor,
                }}
                size="sm"
                rounded="xl"
              />
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  isVolei ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {isVolei ? '🏐 Registrar Ponto' : '⚽ Registrar Gol'}
                </span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                  {teamName}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo / Seleção de Jogador */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {isVolei
                ? 'Selecione o jogador que fez o ponto para contabilizar nas estatísticas:'
                : 'Selecione o jogador que marcou o gol para contabilizar na artilharia:'}
            </p>

            <div className="space-y-1.5">
              {/* Opção: Sem autor / Coletivo */}
              <button
                type="button"
                onClick={() => setSelectedPlayerId(null)}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                  selectedPlayerId === null
                    ? isVolei
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/30'
                      : 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    {isVolei ? '🏐' : '⚽'}
                  </div>
                  <div>
                    <span className="font-bold text-xs block">
                      {isVolei ? 'Ponto Geral / Erro Adversário' : 'Gol Geral / Sem Autor Específico'}
                    </span>
                    <span className="text-[10px] text-slate-400">Apenas soma no placar do time</span>
                  </div>
                </div>
                {selectedPlayerId === null && (
                  <Check className={`w-4 h-4 shrink-0 ${isVolei ? 'text-amber-500' : 'text-brand-500'}`} />
                )}
              </button>

              {/* Lista de jogadores do time */}
              {players.map((p) => {
                const isSelected = selectedPlayerId === p.user_id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlayerId(p.user_id)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? isVolei
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/30'
                          : 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {p.user?.avatar_url ? (
                        <img
                          src={p.user.avatar_url}
                          alt={p.user.nome}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isVolei
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {(p.user?.nome || p.guest_name)?.substring(0, 2).toUpperCase() || 'JG'}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-xs block text-slate-900 dark:text-white">
                          {p.user?.nome || p.guest_name || 'Jogador'}
                          {p.user?.apelido && (
                            <span className="text-slate-400 font-normal ml-1">
                              ({p.user.apelido})
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isVolei
                            ? (p.user?.volei_position || 'Atleta de Vôlei')
                            : (p.user?.futebol_position || p.user?.posicao || 'Jogador de linha')}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className={`w-4 h-4 shrink-0 ${isVolei ? 'text-amber-500' : 'text-emerald-500'}`} />
                    )}
                  </button>
                );
              })}

              {players.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Nenhum jogador escalado neste time ainda.
                </div>
              )}
            </div>
          </div>

          {/* Rodapé / Botão de Ação */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl transition-all"
            >
              Cancelar
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`flex-2 py-3 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 ${
                isVolei
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25'
              }`}
            >
              <span>
                {isSubmitting
                  ? 'Registrando...'
                  : isVolei
                  ? 'Confirmar Ponto 🏐'
                  : 'Confirmar Gol ⚽'}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
