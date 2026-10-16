'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, AlertTriangle, Trash2, Save, Calendar, Users, DollarSign, ShieldAlert } from 'lucide-react';
import { updateTournament, deleteTournament } from '@/lib/tournamentsHelper';
import { Tournament, TournamentFormat, TournamentStatus, SportType } from '@/types/database';
import { toast } from 'sonner';

interface EditTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  onTournamentUpdated?: () => void;
  onTournamentDeleted?: () => void;
}

export const EditTournamentModal: React.FC<EditTournamentModalProps> = ({
  isOpen,
  onClose,
  tournament,
  onTournamentUpdated,
  onTournamentDeleted,
}) => {
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description || '');
  const [sportType, setSportType] = useState<SportType>(tournament.sport_type || 'futebol');
  const [format, setFormat] = useState<TournamentFormat>(tournament.format);
  const [maxTeams, setMaxTeams] = useState<number>(tournament.max_teams);
  const [playersPerTeam, setPlayersPerTeam] = useState<number>(tournament.players_per_team);
  const [startDate, setStartDate] = useState(tournament.start_date || '');
  const [endDate, setEndDate] = useState(tournament.end_date || '');
  const [entryFee, setEntryFee] = useState<number>(tournament.entry_fee || 0);
  const [societyCost, setSocietyCost] = useState<number>(tournament.society_cost || 0);
  const [rules, setRules] = useState(tournament.rules || '');
  const [status, setStatus] = useState<TournamentStatus>(tournament.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (tournament) {
      setName(tournament.name);
      setDescription(tournament.description || '');
      setSportType(tournament.sport_type || 'futebol');
      setFormat(tournament.format);
      setMaxTeams(tournament.max_teams);
      setPlayersPerTeam(tournament.players_per_team);
      setStartDate(tournament.start_date || '');
      setEndDate(tournament.end_date || '');
      setEntryFee(tournament.entry_fee || 0);
      setSocietyCost(tournament.society_cost || 0);
      setRules(tournament.rules || '');
      setStatus(tournament.status);
    }
  }, [tournament]);

  // Cálculos financeiros em tempo real
  const estimatedCollection = maxTeams * (Number(entryFee) || 0);
  const estimatedPrizePool = Math.max(0, estimatedCollection - (Number(societyCost) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome do campeonato.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateTournament(tournament.id, {
        name: name.trim(),
        description: description.trim() || null,
        sport_type: sportType,
        format,
        max_teams: Number(maxTeams),
        players_per_team: Number(playersPerTeam),
        start_date: startDate || null,
        end_date: endDate || null,
        entry_fee: Number(entryFee) || 0,
        society_cost: Number(societyCost) || 0,
        rules: rules.trim() || null,
        status,
      });

      if (res.success) {
        onClose();
        if (onTournamentUpdated) onTournamentUpdated();
      } else {
        toast.error(res.error || 'Erro ao atualizar campeonato.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmMsg = `ATENÇÃO SUPER ADMIN:\nTem certeza que deseja EXCLUIR PERMANENTEMENTE o campeonato "${tournament.name}"?\nTodas as equipes, partidas e estatísticas vinculadas serão apagadas.`;
    if (!window.confirm(confirmMsg)) return;

    const secondConfirm = window.prompt(`Para confirmar a exclusão, digite o nome do campeonato exatamente: "${tournament.name}"`);
    if (secondConfirm !== tournament.name) {
      toast.info('Exclusão cancelada (nome não conferiu).');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteTournament(tournament.id);
      if (res.success) {
        onClose();
        if (onTournamentDeleted) onTournamentDeleted();
      } else {
        toast.error(res.error || 'Erro ao excluir campeonato.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Editar Campeonato</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Super Admin
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gerenciamento de regras, limites, custos e configurações
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Status do Campeonato */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Status Atual da Competição
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'registration_open', label: '🟢 Inscrições Abertas' },
                  { id: 'registration_closed', label: '🔒 Inscrições Encerradas' },
                  { id: 'in_progress', label: '🔴 Em Andamento' },
                  { id: 'finished', label: '🏆 Finalizado' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id as TournamentStatus)}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                      status === s.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nome e Descrição */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Nome do Campeonato *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Descrição
                </label>
                <textarea
                  rows={2}
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
                  Modalidade
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

            {/* Quantidade de Equipes e Jogadores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Máximo de Equipes *
                  </label>
                  <span className="text-[11px] font-bold text-emerald-500">
                    {format === 'round_robin' ? 'Pares e Ímpares' : 'Qualquer valor'}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="number"
                    min={2}
                    max={32}
                    required
                    value={maxTeams}
                    onChange={(e) => setMaxTeams(Math.max(2, Math.min(32, Number(e.target.value) || 2)))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
                  />

                  {/* Atalhos rápidos */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[3, 4, 5, 6, 7, 8, 9, 10, 12, 16].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxTeams(num)}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                          maxTeams === num
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
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
                  required
                  value={playersPerTeam}
                  onChange={(e) => setPlayersPerTeam(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
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
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Data de Encerramento (Previsão)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Configurações Financeiras */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                <span>Financeiro & Premiação</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Taxa de Inscrição por Time (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={entryFee}
                    onChange={(e) => setEntryFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Custo Total Society / Arena (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={societyCost}
                    onChange={(e) => setSocietyCost(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Simulação em Tempo Real */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-500/20 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Total Arrecadado Est.:</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedCollection)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block">Premiação Líquida Est.:</span>
                  <span className="font-black text-emerald-500 text-sm">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedPrizePool)}
                  </span>
                </div>
              </div>
            </div>

            {/* Regulamento */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Regulamento e Informações Adicionais
              </label>
              <textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Regras disciplinares, critérios de desempate, horários e tolerância..."
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium resize-none"
              />
            </div>

            {/* Botões de Ação */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
                className="px-4 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Excluindo...' : 'Excluir Campeonato'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting || isDeleting}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
