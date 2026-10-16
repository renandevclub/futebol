'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  PlusCircle,
  Search,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
  Award,
  Crown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import {
  fetchLeagueTournaments,
  formatTournamentStatus,
  formatTournamentFormat,
} from '@/lib/tournamentsHelper';
import { formatCurrency } from '@/lib/financeHelper';
import { Tournament, TournamentStatus } from '@/types/database';
import { subscribeToTables } from '@/lib/realtime';
import { CreateTournamentModal } from './CreateTournamentModal';
import { TournamentDetailModal } from './TournamentDetailModal';

export const TournamentListSection: React.FC = () => {
  const { user } = useAuth();
  const { currentLeague, canManageLeague } = useLeague();

  const isAdmin = currentLeague ? canManageLeague(currentLeague.id, currentLeague) : false;

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | TournamentStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  const loadTournaments = useCallback(async () => {
    if (!currentLeague?.id) return;
    setIsLoading(true);
    try {
      const data = await fetchLeagueTournaments(currentLeague.id);
      setTournaments(data);
    } finally {
      setIsLoading(false);
    }
  }, [currentLeague?.id]);

  useEffect(() => {
    loadTournaments();

    return subscribeToTables(
      'tournaments_realtime_sync',
      [{ table: 'tournaments' }, { table: 'tournament_teams' }],
      () => {
        void loadTournaments();
      }
    );
  }, [loadTournaments]);

  // Filtragem
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        t.name.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.rules?.toLowerCase().includes(term)
      );
    });
  }, [tournaments, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Barra de Título e Ação de Criar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Torneios & Campeonatos</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Competições organizadas dentro da liga {currentLeague?.name}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Campeonato</span>
          </button>
        )}
      </div>

      {/* Filtros e Busca */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none pb-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Todos ({tournaments.length})
          </button>
          <button
            onClick={() => setStatusFilter('registration_open')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              statusFilter === 'registration_open'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Inscrições Abertas
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              statusFilter === 'in_progress'
                ? 'bg-blue-500 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Em Andamento
          </button>
          <button
            onClick={() => setStatusFilter('finished')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              statusFilter === 'finished'
                ? 'bg-purple-500 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Finalizados
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar campeonato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Lista de Campeonatos */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold">Carregando campeonatos da liga...</p>
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="p-10 sm:p-14 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-2xl shadow-xs">
            🏆
          </div>
          <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
            Nenhum campeonato encontrado
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'Nenhum torneio corresponde aos filtros selecionados.'
              : 'Nenhum campeonato foi cadastrado nesta liga até o momento.'}
          </p>
          {isAdmin && !searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Primeiro Campeonato</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredTournaments.map((t) => {
            const status = formatTournamentStatus(t.status);
            const format = formatTournamentFormat(t.format);
            const approvedTeams = t.teams_count || 0;
            const progressPct = Math.min(100, Math.round((approvedTeams / t.max_teams) * 100));
            const estimatedPrize = Math.max(0, t.max_teams * t.entry_fee - t.society_cost);

            return (
              <motion.div
                key={t.id}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedTournamentId(t.id)}
                className="group relative p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                {/* Badges no Topo */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${status.bg} ${status.text} ${status.border}`}
                      >
                        {status.label}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {format.icon} {format.label}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-slate-400">
                      {t.sport_type === 'volei' ? '🏐 Vôlei' : '⚽ Futebol'}
                    </span>
                  </div>

                  {/* Título & Descrição */}
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {t.name}
                    </h4>
                    {t.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 mt-1">
                        {t.description}
                      </p>
                    )}
                  </div>

                  {/* Campeão Conquistado (Se Finalizado) */}
                  {t.champion_team && (
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 block">
                          Campeão Oficial
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                          {t.champion_team.name}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Progresso de Inscrição */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500 dark:text-slate-400">Vagas de Equipes:</span>
                      <span className="text-slate-900 dark:text-white font-black">
                        {approvedTeams} / {t.max_teams} times
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer do Card com Valores Financeiros */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Premiação Estimada
                    </span>
                    <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(estimatedPrize)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 transition-colors">
                    <span>Ver Detalhes</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {isCreateModalOpen && (
        <CreateTournamentModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onTournamentCreated={() => {
            setIsCreateModalOpen(false);
            loadTournaments();
          }}
        />
      )}

      {selectedTournamentId && (
        <TournamentDetailModal
          isOpen={Boolean(selectedTournamentId)}
          onClose={() => setSelectedTournamentId(null)}
          tournamentId={selectedTournamentId}
          onTournamentUpdated={() => {
            loadTournaments();
          }}
        />
      )}
    </div>
  );
};
