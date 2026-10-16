'use client';

import React from 'react';
import { MatchParticipant } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserCheck, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { TeamBadge } from '@/components/TeamBadge';

interface VolleyQuickPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (playerId: string | null) => void;
  teamNumber: number;
  teamName: string;
  teamEmoji: string;
  teamBadgeUrl?: string | null;
  teamColor?: string;
  players: MatchParticipant[];
  isEditingExistingPoint?: boolean;
  currentPointNumber?: number;
}

export const VolleyQuickPointModal: React.FC<VolleyQuickPointModalProps> = ({
  isOpen,
  onClose,
  onSelectPlayer,
  teamNumber,
  teamName,
  teamEmoji,
  teamBadgeUrl,
  teamColor,
  players,
  isEditingExistingPoint = false,
  currentPointNumber,
}) => {
  if (!isOpen) return null;

  const handlePlayerClick = (playerId: string | null) => {
    onSelectPlayer(playerId);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-slate-900 text-slate-100 rounded-t-[32px] sm:rounded-[32px] border border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top Bar Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-yellow-500/20 border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
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
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400">
                    {isEditingExistingPoint
                      ? `Corrigir Jogador ${currentPointNumber ? `(Ponto #${currentPointNumber})` : ''}`
                      : '🏐 Quem Marcou o Ponto?'}
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

          {/* Subtitle / Guia de Ação Rápida */}
          <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 text-center">
            <p className="text-xs text-amber-300 font-bold flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Toque no jogador para registrar o ponto instantaneamente:</span>
            </p>
          </div>

          {/* Grid de Jogadores do Time (2 Toques Diretos) */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 overscroll-contain">
            {players.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {players.map((p) => {
                  const nome = p.user?.nome || 'Jogador';
                  const apelido = p.user?.apelido;
                  const posicao = p.user?.volei_position || 'Atleta';
                  const avatarUrl = p.user?.avatar_url;

                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handlePlayerClick(p.user_id)}
                      className="group relative p-3 sm:p-4 rounded-2xl bg-slate-800/90 hover:bg-amber-500/20 active:bg-amber-500/30 border border-slate-700 hover:border-amber-400/60 transition-all cursor-pointer flex flex-col items-center text-center space-y-2 shadow-md hover:shadow-amber-500/10"
                    >
                      {/* Avatar / Iniciais */}
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={nome}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-slate-600 group-hover:border-amber-400 shadow-md"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-300 font-black text-lg flex items-center justify-center shadow-md">
                          {nome.substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Nome e Apelido */}
                      <div className="w-full min-w-0">
                        <span className="font-black text-xs sm:text-sm text-white block truncate group-hover:text-amber-200">
                          {nome}
                        </span>
                        {apelido && (
                          <span className="text-[11px] text-amber-400/90 font-bold block truncate">
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
                  Nenhum jogador escalado formalmente neste time.
                </p>
              </div>
            )}

            {/* Opção Destacada: Jogador Não Identificado */}
            <div className="pt-2 border-t border-slate-800/80">
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePlayerClick(null)}
                className="w-full p-3.5 sm:p-4 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border-2 border-dashed border-slate-600 hover:border-slate-400 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-3 shadow-md"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300">
                  <HelpCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-left">
                  <span className="font-black text-xs sm:text-sm block">
                    ⚪ Jogador não identificado / Ponto de Equipe
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Soma o ponto no placar e permite editar o autor posteriormente
                  </span>
                </div>
              </motion.button>
            </div>
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
