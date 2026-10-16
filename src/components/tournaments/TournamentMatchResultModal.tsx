'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Check, Plus, Trash2, Clock, Shield, AlertCircle } from 'lucide-react';
import { TournamentMatch, TournamentMatchEventType, TournamentMatchStatus } from '@/types/database';
import { saveMatchResult } from '@/lib/tournamentsHelper';
import { toast } from 'sonner';

interface TournamentMatchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: TournamentMatch;
  isKnockout?: boolean;
  onMatchSaved?: () => void;
}

interface MatchEventDraft {
  team_id: string;
  player_id?: string;
  assist_player_id?: string;
  event_type: TournamentMatchEventType;
  minute?: number;
}

export const TournamentMatchResultModal: React.FC<TournamentMatchResultModalProps> = ({
  isOpen,
  onClose,
  match,
  isKnockout = false,
  onMatchSaved,
}) => {
  const [homeScore, setHomeScore] = useState<number>(match.home_score || 0);
  const [awayScore, setAwayScore] = useState<number>(match.away_score || 0);
  const [penaltyHome, setPenaltyHome] = useState<string>(
    match.penalty_home_score != null ? String(match.penalty_home_score) : ''
  );
  const [penaltyAway, setPenaltyAway] = useState<string>(
    match.penalty_away_score != null ? String(match.penalty_away_score) : ''
  );
  const [status, setStatus] = useState<TournamentMatchStatus>(match.status || 'finished');
  const [notes, setNotes] = useState<string>(match.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Eventos rápidos (gols/pontos)
  const [events, setEvents] = useState<MatchEventDraft[]>(
    (match.events || []).map((e) => ({
      team_id: e.team_id,
      player_id: e.player_id || undefined,
      assist_player_id: e.assist_player_id || undefined,
      event_type: e.event_type,
      minute: e.minute || undefined,
    }))
  );

  const isTie = homeScore === awayScore;
  const showPenalties = isKnockout && isTie;

  const handleAddEvent = (teamId: string, type: TournamentMatchEventType) => {
    setEvents((prev) => [
      ...prev,
      {
        team_id: teamId,
        event_type: type,
        minute: 0,
      },
    ]);
  };

  const handleRemoveEvent = (index: number) => {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (showPenalties && (penaltyHome === '' || penaltyAway === '')) {
      toast.error('Em partidas eliminatórias que terminam empatadas, informe o placar dos pênaltis.');
      return;
    }

    if (showPenalties && Number(penaltyHome) === Number(penaltyAway)) {
      toast.error('A disputa de pênaltis não pode terminar empatada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveMatchResult({
        match_id: match.id,
        home_score: Number(homeScore),
        away_score: Number(awayScore),
        penalty_home_score: penaltyHome !== '' ? Number(penaltyHome) : undefined,
        penalty_away_score: penaltyAway !== '' ? Number(penaltyAway) : undefined,
        status,
        notes: notes.trim() || undefined,
        events,
      });

      if (res.success) {
        onClose();
        if (onMatchSaved) {
          onMatchSaved();
        }
      } else {
        toast.error(res.error || 'Erro ao salvar resultado da partida.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {match.phase} • Súmula da Partida
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Registrar Placar & Resultado
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Placar Principal */}
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-5 items-center gap-3 text-center">
                {/* Time Mandante */}
                <div className="col-span-2 space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black shadow-xs overflow-hidden">
                    {match.home_team?.badge_url ? (
                      <img src={match.home_team.badge_url} alt="Home" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>⚽</span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white line-clamp-2">
                    {match.home_team?.name || 'A definir'}
                  </h4>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    required
                    value={homeScore}
                    onChange={(e) => setHomeScore(Number(e.target.value))}
                    className="w-16 sm:w-20 mx-auto text-center py-2 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 text-2xl font-black text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                  />
                </div>

                {/* VS */}
                <div className="col-span-1 space-y-1">
                  <span className="text-xs font-black text-slate-400 uppercase">VS</span>
                  <div className="h-0.5 bg-slate-200 dark:bg-slate-800 w-6 mx-auto" />
                </div>

                {/* Time Visitante */}
                <div className="col-span-2 space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black shadow-xs overflow-hidden">
                    {match.away_team?.badge_url ? (
                      <img src={match.away_team.badge_url} alt="Away" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span>⚽</span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white line-clamp-2">
                    {match.away_team?.name || 'A definir'}
                  </h4>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    required
                    value={awayScore}
                    onChange={(e) => setAwayScore(Number(e.target.value))}
                    className="w-16 sm:w-20 mx-auto text-center py-2 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 text-2xl font-black text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Decisão por Pênaltis (se Mata-Mata e Empatou) */}
              {showPenalties && (
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Partida Eliminatória Empatada • Decisão por Pênaltis</span>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Pênaltis Mandante:</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        placeholder="0"
                        value={penaltyHome}
                        onChange={(e) => setPenaltyHome(e.target.value)}
                        className="w-14 text-center py-1.5 rounded-xl border border-amber-500/50 bg-white dark:bg-slate-900 font-black text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                    <span className="font-bold text-slate-400">×</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        placeholder="0"
                        value={penaltyAway}
                        onChange={(e) => setPenaltyAway(e.target.value)}
                        className="w-14 text-center py-1.5 rounded-xl border border-amber-500/50 bg-white dark:bg-slate-900 font-black text-sm text-slate-900 dark:text-white"
                      />
                      <span className="text-xs font-bold text-slate-500">Pênaltis Visitante:</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status da Partida */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Status da Partida
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('finished')}
                  className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    status === 'finished'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Finalizada
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('in_progress')}
                  className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    status === 'in_progress'
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Em Andamento
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('scheduled')}
                  className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    status === 'scheduled'
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Agendada
                </button>
              </div>
            </div>

            {/* Observações da Súmula */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Observações / Relato do Árbitro (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Destaques, substituições, ocorrências disciplinares..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-xs font-medium resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Salvando resultado...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Placar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
