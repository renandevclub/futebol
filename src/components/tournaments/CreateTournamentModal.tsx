'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Calendar, DollarSign, Users, Shield, Award, HelpCircle, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { createTournament } from '@/lib/tournamentsHelper';
import { formatCurrency } from '@/lib/financeHelper';
import { TournamentFormat, SportType } from '@/types/database';
import { toast } from 'sonner';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTournamentCreated?: () => void;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  onTournamentCreated,
}) => {
  const { user } = useAuth();
  const { currentLeague } = useLeague();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState<SportType>(currentLeague?.sport_type || 'futebol');
  const [format, setFormat] = useState<TournamentFormat>('knockout');
  const [maxTeams, setMaxTeams] = useState<number>(8);
  const [playersPerTeam, setPlayersPerTeam] = useState<number>(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryFee, setEntryFee] = useState<number>(100);
  const [societyCost, setSocietyCost] = useState<number>(400);
  const [rules, setRules] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cálculos dinâmicos em tempo real
  const totalCollectedEstimate = (Number(maxTeams) || 0) * (Number(entryFee) || 0);
  const prizePoolEstimate = Math.max(0, totalCollectedEstimate - (Number(societyCost) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLeague?.id || !user?.id) {
      toast.error('Liga não selecionada ou usuário não autenticado.');
      return;
    }

    if (!name.trim()) {
      toast.error('Informe o nome do campeonato.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTournament({
        league_id: currentLeague.id,
        name: name.trim(),
        description: description.trim() || undefined,
        sport_type: sportType,
        format,
        max_teams: Number(maxTeams),
        players_per_team: Number(playersPerTeam),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        entry_fee: Number(entryFee) || 0,
        society_cost: Number(societyCost) || 0,
        rules: rules.trim() || undefined,
        created_by: user.id,
      });

      if (res.success) {
        onClose();
        if (onTournamentCreated) {
          onTournamentCreated();
        }
      } else {
        toast.error(res.error || 'Erro ao criar campeonato.');
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
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Novo Torneio / Campeonato
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Organize competições completas na liga {currentLeague?.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Nome e Descrição */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Nome do Campeonato *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Copa Resenha de Ouro 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve apresentação, temática ou mensagem do torneio..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
                />
              </div>
            </div>

            {/* Modalidade e Formato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Modalidade Esportiva
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSportType('futebol')}
                    className={`px-3 py-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      sportType === 'futebol'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>⚽ Futebol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSportType('volei')}
                    className={`px-3 py-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      sportType === 'volei'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>🏐 Vôlei</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Formato da Competição
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('knockout')}
                    className={`px-3 py-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      format === 'knockout'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-2 ring-purple-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>⚔️ Mata-Mata</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('round_robin')}
                    className={`px-3 py-2.5 rounded-2xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      format === 'round_robin'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>📊 Pontos Corridos</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Limites de Equipes e Jogadores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Quantidade de Equipes *
                  </label>
                  <span className="text-[11px] font-bold text-emerald-500">
                    {format === 'round_robin' ? 'Pares e Ímpares aceitos' : 'Qualquer quantidade'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="number"
                      min={2}
                      max={32}
                      required
                      value={maxTeams}
                      onChange={(e) => setMaxTeams(Math.max(2, Math.min(32, Number(e.target.value) || 2)))}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      times
                    </span>
                  </div>

                  {/* Atalhos rápidos (pares e ímpares) */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[3, 4, 5, 6, 7, 8, 9, 10, 12, 16].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxTeams(num)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          maxTeams === num
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  {format === 'round_robin' && maxTeams % 2 !== 0 && (
                    <p className="text-[11px] text-amber-500 font-semibold flex items-center gap-1 mt-1">
                      <span>💡</span>
                      Com {maxTeams} equipes, 1 time descansará (folga) a cada rodada automaticamente.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Jogadores por Equipe (Máx.)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={playersPerTeam}
                  onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Data de Término (Opcional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>
            </div>

            {/* Sistema Financeiro & Premiação */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-5 h-5" />
                <h4 className="text-sm font-black uppercase tracking-wide">
                  Financeiro & Premiação Automática
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Valor da Inscrição por Time (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={entryFee}
                    onChange={(e) => setEntryFee(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Custo Total Society / Arena (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={societyCost}
                    onChange={(e) => setSocietyCost(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
                  />
                </div>
              </div>

              {/* Card de Simulação Financeira */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">
                    Arrecadação Estimada ({maxTeams} times × {formatCurrency(entryFee)}):
                  </span>
                  <span className="font-black text-slate-900 dark:text-white">
                    {formatCurrency(totalCollectedEstimate)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">
                    Custo Arena / Society:
                  </span>
                  <span className="font-black text-red-500">
                    - {formatCurrency(societyCost)}
                  </span>
                </div>
                <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between text-sm">
                  <span className="font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Award className="w-4 h-4" /> Premiação Líquida Estimada:
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(prizePoolEstimate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Regulamento */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Regras e Informações Adicionais (Opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Critérios de desempate, tempo de jogo, tolerância de atraso, regras de conduta..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
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
                  <span>Criando campeonato...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Criar Campeonato</span>
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
