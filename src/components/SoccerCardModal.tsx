'use client';

import React, { useState } from 'react';
import { MatchParticipant } from '@/types/database';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Sparkles } from 'lucide-react';
import { TeamBadge } from '@/components/TeamBadge';

interface SoccerCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCard: (teamNum: number, cardType: 'yellow' | 'red', playerId: string | null) => void;
  teams: {
    teamNumber: number;
    teamName: string;
    teamEmoji: string;
    teamBadgeUrl?: string | null;
    teamColor?: string;
    players: MatchParticipant[];
  }[];
  defaultTeamNumber?: number;
}

export const SoccerCardModal: React.FC<SoccerCardModalProps> = ({
  isOpen,
  onClose,
  onConfirmCard,
  teams,
  defaultTeamNumber,
}) => {
  const [selectedTeamNum, setSelectedTeamNum] = useState<number>(defaultTeamNumber || teams[0]?.teamNumber || 1);
  const [cardType, setCardType] = useState<'yellow' | 'red'>('yellow');

  React.useEffect(() => {
    if (isOpen) {
      if (defaultTeamNumber) {
        setSelectedTeamNum(defaultTeamNumber);
      }
      setCardType('yellow');
    }
  }, [isOpen, defaultTeamNumber]);

  if (!isOpen) return null;

  const currentTeam = teams.find((t) => t.teamNumber === selectedTeamNum) || teams[0];
  const players = currentTeam?.players || [];

  const handlePlayerClick = (playerId: string | null) => {
    onConfirmCard(selectedTeamNum, cardType, playerId);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-slate-900 text-slate-100 rounded-t-[32px] sm:rounded-[32px] border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-yellow-500/20 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <span className="text-base">🟨🟥</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                  Disciplina da Partida
                </span>
                <h3 className="font-extrabold text-base text-white">
                  Registrar Cartão na Partida
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

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {/* Escolha do Time (se houver mais de 1 no confronto ativo) */}
            {teams.length > 1 && (
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  Selecione o Time:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {teams.map((t) => (
                    <button
                      key={t.teamNumber}
                      type="button"
                      onClick={() => setSelectedTeamNum(t.teamNumber)}
                      className={`p-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedTeamNum === t.teamNumber
                          ? 'border-brand-500 bg-brand-500/20 text-white shadow-md'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <TeamBadge
                        teamInfo={{
                          name: t.teamName,
                          emoji: t.teamEmoji,
                          badge_url: t.teamBadgeUrl,
                          color: t.teamColor,
                        }}
                        size="2xs"
                        rounded="md"
                        showBorder={false}
                      />
                      <span className="truncate">{t.teamName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Escolha do Tipo de Cartão (Amarelo ou Vermelho) */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                Tipo do Cartão:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCardType('yellow')}
                  className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-black transition-all cursor-pointer ${
                    cardType === 'yellow'
                      ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 ring-2 ring-yellow-400/40 shadow-lg shadow-yellow-500/10'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-yellow-400'
                  }`}
                >
                  <span className="w-4 h-6 rounded-xs bg-yellow-400 border border-yellow-200 shadow-sm" />
                  <span>Cartão Amarelo 🟨</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardType('red')}
                  className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-black transition-all cursor-pointer ${
                    cardType === 'red'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/10'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-rose-400'
                  }`}
                >
                  <span className="w-4 h-6 rounded-xs bg-rose-500 border border-rose-300 shadow-sm" />
                  <span>Cartão Vermelho 🟥</span>
                </button>
              </div>
            </div>

            {/* Seleção do Jogador Punido */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-300 font-bold block mb-2">
                Toque no atleta do <strong>{currentTeam.teamName}</strong> que recebeu o cartão:
              </span>

              {players.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {players.map((p) => {
                    const nome = p.user?.nome || p.guest_name || 'Jogador';
                    const apelido = p.user?.apelido;
                    const avatarUrl = p.user?.avatar_url;

                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => handlePlayerClick(p.user_id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 shadow-md ${
                          cardType === 'yellow'
                            ? 'bg-slate-800/80 hover:bg-yellow-500/20 border-slate-700 hover:border-yellow-400/60'
                            : 'bg-slate-800/80 hover:bg-rose-500/20 border-slate-700 hover:border-rose-400/60'
                        }`}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={nome}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-600 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {nome.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-xs text-white block truncate">
                            {nome}
                          </span>
                          {apelido && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              "{apelido}"
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl border border-dashed border-slate-800">
                  Nenhum jogador cadastrado neste time.
                </div>
              )}
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
