'use client';

import React, { useState, useEffect } from 'react';
import { MatchParticipant, Profile } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, HelpCircle, ArrowLeft, Target, Award } from 'lucide-react';
import { TeamBadge } from '@/components/TeamBadge';

interface SoccerQuickGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmGoal: (scorerId: string | null, assistId?: string | null) => void;
  teamNumber: number;
  teamName: string;
  teamEmoji: string;
  teamBadgeUrl?: string | null;
  teamColor?: string;
  players: MatchParticipant[];
  trackAssists?: boolean;
  isEditingExistingGoal?: boolean;
  initialScorerId?: string | null;
  initialAssistId?: string | null;
}

export const SoccerQuickGoalModal: React.FC<SoccerQuickGoalModalProps> = ({
  isOpen,
  onClose,
  onConfirmGoal,
  teamNumber,
  teamName,
  teamEmoji,
  teamBadgeUrl,
  teamColor,
  players,
  trackAssists = false,
  isEditingExistingGoal = false,
  initialScorerId = null,
  initialAssistId = null,
}) => {
  const [step, setStep] = useState<'scorer' | 'assist'>('scorer');
  const [selectedScorerId, setSelectedScorerId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('scorer');
      setSelectedScorerId(initialScorerId);
    }
  }, [isOpen, initialScorerId]);

  if (!isOpen) return null;

  const handleSelectScorer = (scorerId: string | null) => {
    setSelectedScorerId(scorerId);

    // Se NÃO rastreia assistência, finaliza imediatamente em 2 toques!
    if (!trackAssists) {
      onConfirmGoal(scorerId, null);
      return;
    }

    // Se rastreia assistência, vai para a etapa 2
    setStep('assist');
  };

  const handleSelectAssist = (assistId: string | null) => {
    onConfirmGoal(selectedScorerId, assistId);
  };

  const scorerPlayer = players.find((p) => p.user_id === selectedScorerId)?.user;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-slate-900 text-slate-100 rounded-t-[32px] sm:rounded-[32px] border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-600/20 border-b border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {step === 'assist' && trackAssists && (
                <button
                  type="button"
                  onClick={() => setStep('scorer')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700 shrink-0"
                  title="Voltar para seleção do autor do gol"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              <TeamBadge
                teamInfo={{
                  name: teamName,
                  emoji: teamEmoji,
                  badge_url: teamBadgeUrl,
                  color: teamColor,
                }}
                size="md"
                rounded="2xl"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-400">
                    {step === 'scorer'
                      ? isEditingExistingGoal
                        ? 'Editar Autor do Gol ⚽'
                        : '⚽ Quem Marcou o Gol?'
                      : '🎯 Quem Deu a Assistência?'}
                  </span>
                </div>
                <h3 className="font-black text-base sm:text-lg text-white truncate leading-tight mt-0.5">
                  {teamName}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subtitle / Orientação da etapa */}
          <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 text-center">
            {step === 'scorer' ? (
              <p className="text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Toque no jogador que fez o gol:</span>
              </p>
            ) : (
              <p className="text-xs text-teal-300 font-bold flex items-center justify-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-teal-400" />
                <span>Gol de: <strong>{scorerPlayer?.nome || 'Jogador'}</strong>. Escolha o passe decisivo:</span>
              </p>
            )}
          </div>

          {/* Lista de Jogadores da Equipe */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 overscroll-contain">
            {step === 'scorer' ? (
              /* ETAPA 1: AUTOR DO GOL */
              <>
                {players.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {players.map((p) => {
                      const nome = p.user?.nome || 'Jogador';
                      const apelido = p.user?.apelido;
                      const posicao = p.user?.futebol_position || p.user?.posicao || 'Linha';
                      const avatarUrl = p.user?.avatar_url;

                      return (
                        <motion.button
                          key={p.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => handleSelectScorer(p.user_id)}
                          className="group relative p-3 sm:p-4 rounded-2xl bg-slate-800/90 hover:bg-emerald-500/20 active:bg-emerald-500/30 border border-slate-700 hover:border-emerald-400/60 transition-all cursor-pointer flex flex-col items-center text-center space-y-2 shadow-md hover:shadow-emerald-500/10"
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={nome}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-600 group-hover:border-emerald-400 shadow-md"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-300 font-black text-lg flex items-center justify-center shadow-md">
                              {nome.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="w-full min-w-0">
                            <span className="font-black text-xs sm:text-sm text-white block truncate group-hover:text-emerald-200">
                              {nome}
                            </span>
                            {apelido && (
                              <span className="text-[11px] text-emerald-400/90 font-bold block truncate">
                                "{apelido}"
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              {posicao}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 text-center bg-slate-800/40 rounded-2xl border border-dashed border-slate-700">
                    <p className="text-xs text-slate-400">
                      Nenhum jogador escalado neste time.
                    </p>
                  </div>
                )}

                {/* Opção: Jogador Não Identificado */}
                <div className="pt-2 border-t border-slate-800/80">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelectScorer(null)}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border-2 border-dashed border-slate-600 hover:border-slate-400 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-3 shadow-md"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300">
                      <HelpCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-xs sm:text-sm block">
                        ⚪ Gol Coletivo / Sem Autor Específico
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Soma o gol no placar e permite editar o autor posteriormente
                      </span>
                    </div>
                  </motion.button>
                </div>
              </>
            ) : (
              /* ETAPA 2: ASSISTÊNCIA (SOMENTE SE TRACK_ASSISTS ATIVADO) */
              <>
                {/* Opção: Sem Assistência (Gol Individual / Pênalti / Falta) */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectAssist(null)}
                  className="w-full p-3.5 sm:p-4 rounded-2xl bg-slate-800/90 hover:bg-teal-500/20 active:bg-teal-500/30 border-2 border-dashed border-teal-500/40 text-teal-300 hover:text-teal-200 transition-all cursor-pointer flex items-center justify-center gap-3 shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-300">
                    <Award className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="text-left">
                    <span className="font-black text-xs sm:text-sm block text-white">
                      ⚪ Sem Assistência / Jogada Individual
                    </span>
                    <span className="text-[10px] text-teal-300/80 block">
                      Gol de pênalti, falta direta, rebote ou lance individual
                    </span>
                  </div>
                </motion.button>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2 text-center">
                    Ou selecione o jogador que deu o passe:
                  </span>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {players
                      .filter((p) => p.user_id !== selectedScorerId)
                      .map((p) => {
                        const nome = p.user?.nome || 'Jogador';
                        const apelido = p.user?.apelido;
                        const posicao = p.user?.futebol_position || p.user?.posicao || 'Linha';
                        const avatarUrl = p.user?.avatar_url;

                        return (
                          <motion.button
                            key={p.id}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleSelectAssist(p.user_id)}
                            className="group relative p-3 sm:p-4 rounded-2xl bg-slate-800/90 hover:bg-teal-500/20 active:bg-teal-500/30 border border-slate-700 hover:border-teal-400/60 transition-all cursor-pointer flex flex-col items-center text-center space-y-2 shadow-md hover:shadow-teal-500/10"
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={nome}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-600 group-hover:border-teal-400 shadow-md"
                              />
                            ) : (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-500/20 border-2 border-teal-500/40 text-teal-300 font-black text-lg flex items-center justify-center shadow-md">
                                {nome.substring(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div className="w-full min-w-0">
                              <span className="font-black text-xs sm:text-sm text-white block truncate group-hover:text-teal-200">
                                {nome}
                              </span>
                              {apelido && (
                                <span className="text-[11px] text-teal-400/90 font-bold block truncate">
                                  "{apelido}"
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                                {posicao}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Rodapé */}
          <div className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
