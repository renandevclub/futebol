'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Calendar,
  DollarSign,
  Users,
  Shield,
  Award,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
  Play,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Eye,
  FileText,
  UserPlus,
  Layers,
  ChevronRight,
  Flame,
  ArrowRight,
  HelpCircle,
  Crown,
  Settings,
  Edit2,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import {
  fetchTournamentDetails,
  fetchTournamentTeams,
  fetchTournamentMatches,
  calculateTournamentFinancialSummary,
  calculateTournamentStandings,
  approveTournamentTeam,
  rejectTournamentTeam,
  cancelTournamentTeam,
  updateTeamPaymentStatus,
  generateRoundRobinFixtures,
  generateKnockoutFixtures,
  updateTournament,
  resetTournamentMatch,
  formatTournamentStatus,
  formatTournamentFormat,
} from '@/lib/tournamentsHelper';
import { formatCurrency } from '@/lib/financeHelper';
import {
  Tournament,
  TournamentTeam,
  TournamentMatch,
  TournamentStandingRow,
  TournamentFinancialSummary,
  TournamentTeamPaymentStatus,
} from '@/types/database';
import { RegisterTournamentTeamModal } from './RegisterTournamentTeamModal';
import { ManageTournamentRosterModal } from './ManageTournamentRosterModal';
import { TournamentMatchResultModal } from './TournamentMatchResultModal';
import { TournamentChampionModal } from './TournamentChampionModal';
import { EditTournamentModal } from './EditTournamentModal';
import { EditTournamentTeamModal } from './EditTournamentTeamModal';
import { subscribeToTables } from '@/lib/realtime';
import { toast } from 'sonner';

interface TournamentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  onTournamentUpdated?: () => void;
}

export const TournamentDetailModal: React.FC<TournamentDetailModalProps> = ({
  isOpen,
  onClose,
  tournamentId,
  onTournamentUpdated,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { currentLeague, canManageLeague } = useLeague();

  const isAdmin = Boolean(isSuperAdmin) || (currentLeague ? canManageLeague(currentLeague.id, currentLeague) : false);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'bracket' | 'matches' | 'teams' | 'finance'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Modais Secundários
  const [isRegisterTeamOpen, setIsRegisterTeamOpen] = useState(false);
  const [isAdminRegisterTeamOpen, setIsAdminRegisterTeamOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<TournamentTeam | null>(null);
  const [isEditTournamentOpen, setIsEditTournamentOpen] = useState(false);
  const [rosterModalTeam, setRosterModalTeam] = useState<TournamentTeam | null>(null);
  const [matchResultToEdit, setMatchResultToEdit] = useState<TournamentMatch | null>(null);
  const [isChampionModalOpen, setIsChampionModalOpen] = useState(false);

  // Carregar dados completos do campeonato
  const loadData = useCallback(async () => {
    if (!tournamentId) return;
    setIsLoading(true);
    try {
      const [tData, teamsData, matchesData] = await Promise.all([
        fetchTournamentDetails(tournamentId),
        fetchTournamentTeams(tournamentId),
        fetchTournamentMatches(tournamentId),
      ]);
      setTournament(tData);
      setTeams(teamsData);
      setMatches(matchesData);
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (isOpen) {
      loadData();

      return subscribeToTables(
        `tournament_detail_${tournamentId}`,
        [
          { table: 'tournaments' },
          { table: 'tournament_teams' },
          { table: 'tournament_team_players' },
          { table: 'tournament_matches' },
        ],
        () => {
          void loadData();
        }
      );
    }
  }, [isOpen, tournamentId, loadData]);

  // Cálculos dinâmicos
  const financialSummary: TournamentFinancialSummary = useMemo(() => {
    if (!tournament) {
      return {
        teams_count: 0,
        entry_fee_per_team: 0,
        total_collected: 0,
        society_cost: 0,
        prize_pool: 0,
        paid_amount: 0,
        pending_amount: 0,
        net_balance: 0,
      };
    }
    return calculateTournamentFinancialSummary(tournament, teams);
  }, [tournament, teams]);

  const standings: TournamentStandingRow[] = useMemo(() => {
    if (!tournament || tournament.format !== 'round_robin') return [];
    return calculateTournamentStandings(teams, matches);
  }, [tournament, teams, matches]);

  // Agrupamento de partidas por fase
  const matchesByPhase = useMemo(() => {
    const map: Record<string, TournamentMatch[]> = {};
    matches.forEach((m) => {
      const phaseKey = m.phase || 'Geral';
      if (!map[phaseKey]) map[phaseKey] = [];
      map[phaseKey].push(m);
    });
    return map;
  }, [matches]);

  // Verificar se o usuário já inscreveu algum time neste campeonato
  const userTeam = useMemo(() => {
    if (!user?.id) return null;
    return teams.find((t) => t.coach_id === user.id) || null;
  }, [teams, user?.id]);

  const isRegistrationOpen = tournament?.status === 'registration_open';
  const approvedTeamsCount = teams.filter((t) => t.registration_status === 'approved').length;
  const isFull = tournament ? approvedTeamsCount >= tournament.max_teams : false;

  // Ações de Admin
  const handleApproveTeam = async (teamId: string) => {
    if (!user?.id) return;
    const res = await approveTournamentTeam(teamId, user.id);
    if (res.success) {
      loadData();
      if (onTournamentUpdated) onTournamentUpdated();
    }
  };

  const handleRejectTeam = async (teamId: string) => {
    const reason = window.prompt('Informe o motivo da recusa (opcional):');
    const res = await rejectTournamentTeam(teamId, reason || undefined);
    if (res.success) {
      loadData();
      if (onTournamentUpdated) onTournamentUpdated();
    }
  };

  const handleGenerateFixtures = async () => {
    if (!tournament || !currentLeague) return;
    const approved = teams.filter((t) => t.registration_status === 'approved');
    if (approved.length < 2) {
      toast.error('É necessário ter pelo menos 2 equipes aprovadas para gerar as partidas.');
      return;
    }

    if (!window.confirm(`Deseja gerar a tabela oficial de jogos com ${approved.length} equipes aprovadas?`)) {
      return;
    }

    if (tournament.format === 'round_robin') {
      const res = await generateRoundRobinFixtures(tournament.id, currentLeague.id, teams);
      if (res.success) {
        loadData();
        setActiveTab('matches');
        if (onTournamentUpdated) onTournamentUpdated();
      }
    } else {
      const res = await generateKnockoutFixtures(tournament.id, currentLeague.id, teams);
      if (res.success) {
        loadData();
        setActiveTab('bracket');
        if (onTournamentUpdated) onTournamentUpdated();
      }
    }
  };

  const handleCloseRegistrations = async () => {
    if (!tournament) return;
    const res = await updateTournament(tournament.id, { status: 'registration_closed' });
    if (res.success) {
      loadData();
      if (onTournamentUpdated) onTournamentUpdated();
    }
  };

  const handleOpenRegistrations = async () => {
    if (!tournament) return;
    const res = await updateTournament(tournament.id, { status: 'registration_open' });
    if (res.success) {
      loadData();
      if (onTournamentUpdated) onTournamentUpdated();
    }
  };

  const handleUpdatePayment = async (teamId: string, newStatus: TournamentTeamPaymentStatus) => {
    const res = await updateTeamPaymentStatus(teamId, newStatus);
    if (res.success) {
      loadData();
    }
  };

  if (!isOpen) return null;

  const statusBadge = tournament ? formatTournamentStatus(tournament.status) : null;
  const formatInfo = tournament ? formatTournamentFormat(tournament.format) : null;

  return (
    <>
      <AnimatePresence>
        <div key="tournament-detail-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-950/75 backdrop-blur-md">
          <motion.div
            key="tournament-detail-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]"
          >
          {/* Header Superior com Banner do Torneio */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/15 via-blue-500/10 to-purple-500/15 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 text-2xl shrink-0">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {statusBadge && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                        {statusBadge.label}
                      </span>
                    )}
                    {formatInfo && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {formatInfo.icon} {formatInfo.label}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
                      {tournament?.sport_type === 'volei' ? '🏐 Vôlei' : '⚽ Futebol'}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {tournament?.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Liga: <strong>{tournament?.league?.name || currentLeague?.name}</strong> •{' '}
                    {approvedTeamsCount} / {tournament?.max_teams} Equipes Confirmadas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && (
                  <button
                    onClick={() => setIsEditTournamentOpen(true)}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Editar configurações do campeonato (Super Admin)"
                  >
                    <Settings className="w-4 h-4 text-emerald-500" />
                    <span className="hidden sm:inline">Editar Campeonato</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ações Rápidas de Inscrição / Campeão */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                {tournament?.champion_team && (
                  <button
                    onClick={() => setIsChampionModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/25 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Ver Campeão: {tournament.champion_team.name}</span>
                  </button>
                )}
                {userTeam && (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <span>Você é o técnico de:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{userTeam.name}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isRegistrationOpen && !userTeam && !isFull && (
                  <button
                    onClick={() => setIsRegisterTeamOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-600/25 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Inscrever Minha Equipe</span>
                  </button>
                )}

                {isAdmin && matches.length === 0 && (
                  <button
                    onClick={handleGenerateFixtures}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Gerar Jogos Oficialmente</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Abas */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar scrollbar-none scroll-smooth shrink-0">
            <button
              onClick={(e) => {
                setActiveTab('overview');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className={`py-3 px-3.5 border-b-2 text-xs font-black whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overview'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Visão Geral</span>
            </button>

            <button
              onClick={(e) => {
                setActiveTab('bracket');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className={`py-3 px-3.5 border-b-2 text-xs font-black whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'bracket'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{tournament?.format === 'round_robin' ? 'Classificação' : 'Chaveamento'}</span>
            </button>

            <button
              onClick={(e) => {
                setActiveTab('matches');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className={`py-3 px-3.5 border-b-2 text-xs font-black whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'matches'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Partidas ({matches.length})</span>
            </button>

            <button
              onClick={(e) => {
                setActiveTab('teams');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className={`py-3 px-3.5 border-b-2 text-xs font-black whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'teams'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Equipes & Elencos ({teams.length})</span>
            </button>

            <button
              onClick={(e) => {
                setActiveTab('finance');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              className={`py-3 px-3.5 border-b-2 text-xs font-black whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'finance'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Financeiro & Premiação</span>
            </button>
          </div>

          {/* Conteúdo Dinâmico das Abas */}
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
            {/* ═════════════════════════════════════════════════════════════
                ABA 1: VISÃO GERAL
            ═════════════════════════════════════════════════════════════ */}
            {activeTab === 'overview' && tournament && (
              <div className="space-y-6">
                {/* Cards de Métricas Principais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Premiação Líquida
                    </span>
                    <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(financialSummary.prize_pool)}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Inscrição por Time
                    </span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(tournament.entry_fee)}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Equipes Inscritas
                    </span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {approvedTeamsCount} / {tournament.max_teams}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Elenco por Time
                    </span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      Até {tournament.players_per_team} atletas
                    </span>
                  </div>
                </div>

                {/* Descrição e Apresentação */}
                {tournament.description && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Sobre o Campeonato
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-pre-line leading-relaxed">
                      {tournament.description}
                    </p>
                  </div>
                )}

                {/* Regulamento Oficial */}
                {tournament.rules && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span>Regulamento & Critérios de Competição</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-pre-line leading-relaxed">
                      {tournament.rules}
                    </p>
                  </div>
                )}

                {/* Painel Administrativo de Controle do Campeonato */}
                {isAdmin && (
                  <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>Controle do Administrador da Liga</span>
                    </h4>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isRegistrationOpen ? (
                        <button
                          onClick={handleCloseRegistrations}
                          className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Encerrar Inscrições
                        </button>
                      ) : (
                        <button
                          onClick={handleOpenRegistrations}
                          className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Reabrir Inscrições
                        </button>
                      )}

                      {matches.length === 0 && (
                        <button
                          onClick={handleGenerateFixtures}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer shadow-md transition-all"
                        >
                          Gerar Chaveamento / Rodadas
                        </button>
                      )}

                      {tournament.status !== 'finished' && (
                        <button
                          onClick={() => {
                            if (window.confirm('Deseja marcar este campeonato como Finalizado?')) {
                              updateTournament(tournament.id, { status: 'finished' }).then(() => loadData());
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold cursor-pointer transition-colors"
                        >
                          Finalizar Campeonato
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════
                ABA 2: CLASSIFICAÇÃO (Pontos Corridos) ou CHAVEAMENTO (Mata-Mata)
            ═════════════════════════════════════════════════════════════ */}
            {activeTab === 'bracket' && (
              <div className="space-y-6">
                {tournament?.format === 'round_robin' ? (
                  /* TABELA DE PONTOS CORRIDOS */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Classificação Geral</span>
                      </h3>
                      <span className="text-xs text-slate-400 font-bold">
                        Critérios: Pontos &gt; Vitórias &gt; Saldo &gt; Gols Pró
                      </span>
                    </div>

                    {teams.filter((t) => t.registration_status === 'approved').length % 2 !== 0 && (
                      <div className="p-3 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-2">
                        <span className="text-base shrink-0">💡</span>
                        <span>
                          <strong>Formato com número ímpar ({teams.filter((t) => t.registration_status === 'approved').length} equipes):</strong> Cada equipe terá exatamente 1 folga por turno no calendário de jogos, garantindo que todas se enfrentem em rodadas balanceadas.
                        </span>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px]">
                          <tr>
                            <th className="py-3 px-3 text-center w-10">Pos</th>
                            <th className="py-3 px-3">Equipe</th>
                            <th className="py-3 px-2 text-center">J</th>
                            <th className="py-3 px-2 text-center">V</th>
                            <th className="py-3 px-2 text-center">E</th>
                            <th className="py-3 px-2 text-center">D</th>
                            <th className="py-3 px-2 text-center">GP</th>
                            <th className="py-3 px-2 text-center">GC</th>
                            <th className="py-3 px-2 text-center">SG</th>
                            <th className="py-3 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">PTS</th>
                            <th className="py-3 px-3 text-center hidden sm:table-cell">Últimos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-bold">
                          {standings.map((row, idx) => (
                            <tr
                              key={row.team_id || `standing-${idx}`}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                                idx === 0 ? 'bg-amber-500/5' : ''
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`w-6 h-6 rounded-lg text-xs font-black inline-flex items-center justify-center ${
                                    idx === 0
                                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                                      : idx === 1
                                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {row.team_badge ? (
                                      <img src={row.team_badge} alt={row.team_name} className="w-full h-full object-contain" />
                                    ) : (
                                      <span>⚽</span>
                                    )}
                                  </div>
                                  <span className="text-slate-900 dark:text-white font-extrabold truncate">
                                    {row.team_name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center text-slate-600 dark:text-slate-300">{row.played}</td>
                              <td className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400">{row.won}</td>
                              <td className="py-3 px-2 text-center text-slate-500">{row.drawn}</td>
                              <td className="py-3 px-2 text-center text-red-500">{row.lost}</td>
                              <td className="py-3 px-2 text-center text-slate-500">{row.goals_for}</td>
                              <td className="py-3 px-2 text-center text-slate-500">{row.goals_against}</td>
                              <td className="py-3 px-2 text-center font-black text-slate-700 dark:text-slate-200">
                                {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                              </td>
                              <td className="py-3 px-3 text-center text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {row.points}
                              </td>
                              <td className="py-3 px-3 text-center hidden sm:table-cell">
                                <div className="flex items-center justify-center gap-1">
                                  {row.form.map((res, i) => (
                                    <span
                                      key={i}
                                      className={`w-4 h-4 rounded-full text-[9px] font-black inline-flex items-center justify-center text-white ${
                                        res === 'W' ? 'bg-emerald-500' : res === 'D' ? 'bg-slate-400' : 'bg-red-500'
                                      }`}
                                    >
                                      {res}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* ÁRVORE DE MATA-MATA (KNOCKOUT BRACKET) */
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Chaveamento Eliminatório</span>
                      </h3>
                      <span className="text-xs text-slate-400 font-bold">
                        Vencedores avançam automaticamente para a próxima fase
                      </span>
                    </div>

                    {matches.length === 0 ? (
                      <div className="p-10 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
                        <Trophy className="w-10 h-10 mx-auto opacity-30 text-purple-500" />
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
                          Chaveamento ainda não gerado
                        </h4>
                        <p className="text-xs max-w-sm mx-auto">
                          Aguardando a confirmação das equipes inscritas pelo organizador para iniciar as partidas do mata-mata.
                        </p>
                        {isAdmin && (
                          <button
                            onClick={handleGenerateFixtures}
                            className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-md cursor-pointer transition-all"
                          >
                            Gerar Chaveamento Oficial
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Exibição em Colunas de Fases (Oitavas -> Quartas -> Semis -> Final) */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(matchesByPhase).map(([phaseName, phaseMatches], phaseIdx) => (
                          <div key={phaseName || `phase-${phaseIdx}`} className="space-y-3">
                            <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 text-center border border-slate-200 dark:border-slate-700">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                {phaseName}
                              </span>
                            </div>

                            <div className="space-y-3">
                              {phaseMatches.map((m, mIdx) => {
                                const isHomeWinner = m.winner_team_id === m.home_team_id;
                                const isAwayWinner = m.winner_team_id === m.away_team_id;

                                return (
                                  <div
                                    key={m.id || `pmatch-${mIdx}`}
                                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2"
                                  >
                                    {/* Mandante */}
                                    <div
                                      className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                                        isHomeWinner ? 'bg-emerald-500/10 font-black' : 'font-bold'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] shrink-0">
                                          {m.home_team?.badge_url ? (
                                            <img src={m.home_team.badge_url} alt="H" className="w-full h-full object-contain" />
                                          ) : (
                                            <span>⚽</span>
                                          )}
                                        </div>
                                        <span className="text-xs text-slate-900 dark:text-white truncate">
                                          {m.home_team?.name || 'A definir'}
                                        </span>
                                      </div>
                                      <span className="text-sm font-black text-slate-900 dark:text-white ml-2">
                                        {m.status === 'finished' ? m.home_score : '-'}
                                      </span>
                                    </div>

                                    {/* Visitante */}
                                    <div
                                      className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                                        isAwayWinner ? 'bg-emerald-500/10 font-black' : 'font-bold'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] shrink-0">
                                          {m.away_team?.badge_url ? (
                                            <img src={m.away_team.badge_url} alt="A" className="w-full h-full object-contain" />
                                          ) : (
                                            <span>⚽</span>
                                          )}
                                        </div>
                                        <span className="text-xs text-slate-900 dark:text-white truncate">
                                          {m.away_team?.name || 'A definir'}
                                        </span>
                                      </div>
                                      <span className="text-sm font-black text-slate-900 dark:text-white ml-2">
                                        {m.status === 'finished' ? m.away_score : '-'}
                                      </span>
                                    </div>

                                    {/* Informações Extras & Botão de Edição */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                                      <span>
                                        {m.status === 'finished'
                                          ? 'Encerrada'
                                          : m.status === 'in_progress'
                                          ? 'Ao Vivo 🔴'
                                          : 'Agendada'}
                                      </span>

                                      {isAdmin && (
                                        <div className="flex items-center gap-2">
                                          {m.status === 'finished' && (
                                            <button
                                              onClick={async () => {
                                                if (window.confirm(`Deseja resetar o resultado desta partida (${m.home_team?.name || 'Time 1'} × ${m.away_team?.name || 'Time 2'})?`)) {
                                                  const res = await resetTournamentMatch(m.id);
                                                  if (res.success) {
                                                    loadData();
                                                    if (onTournamentUpdated) onTournamentUpdated();
                                                  }
                                                }
                                              }}
                                              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-0.5"
                                              title="Resetar partida eliminatória"
                                            >
                                              <RotateCcw className="w-3 h-3" />
                                              <span>Resetar</span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => setMatchResultToEdit(m)}
                                            className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                          >
                                            Placar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════
                ABA 3: TODAS AS PARTIDAS
            ═════════════════════════════════════════════════════════════ */}
            {activeTab === 'matches' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Calendário de Jogos
                  </h3>
                  {isAdmin && (
                    <button
                      onClick={handleGenerateFixtures}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                    >
                      {matches.length === 0 ? 'Gerar Jogos' : 'Regenerar Jogos'}
                    </button>
                  )}
                </div>

                {matches.length === 0 ? (
                  <div className="p-10 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
                    <Calendar className="w-10 h-10 mx-auto opacity-30 text-emerald-500" />
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
                      Nenhuma partida cadastrada ainda
                    </h4>
                    <p className="text-xs max-w-sm mx-auto">
                      O organizador poderá gerar os confrontos assim que as inscrições estiverem confirmadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(matchesByPhase).map(([phaseName, phaseMatches], pIdx) => {
                      const approvedTeams = teams.filter((t) => t.registration_status === 'approved');
                      const isOddRoundRobin = tournament?.format === 'round_robin' && approvedTeams.length % 2 !== 0;
                      const playingIds = new Set(phaseMatches.flatMap((m) => [m.home_team_id, m.away_team_id]));
                      const restingTeam = isOddRoundRobin ? approvedTeams.find((t) => !playingIds.has(t.id)) : null;

                      return (
                        <div key={phaseName || `phase-all-${pIdx}`} className="space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                {phaseName}
                              </h4>
                            </div>
                            {restingTeam && (
                              <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-black flex items-center gap-1.5 shadow-xs">
                                <span>⏸️ Folga na Rodada:</span>
                                <span className="underline">{restingTeam.name}</span>
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {phaseMatches.map((m, mIdx) => (
                              <div
                                key={m.id || `match-all-${mIdx}`}
                                className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
                              >
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="font-bold">{m.phase}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                      m.status === 'finished'
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : m.status === 'in_progress'
                                        ? 'bg-red-500/10 text-red-500 animate-pulse'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                    }`}
                                  >
                                    {m.status === 'finished' ? 'Finalizada' : m.status === 'in_progress' ? 'Ao Vivo' : 'Agendada'}
                                  </span>
                                </div>

                                {/* Placar */}
                                <div className="grid grid-cols-5 items-center gap-2">
                                  <div className="col-span-2 text-right font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                    {m.home_team?.name || 'A definir'}
                                  </div>
                                  <div className="col-span-1 text-center font-black text-sm sm:text-base text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 py-1 rounded-xl">
                                    {m.status === 'finished' ? `${m.home_score} × ${m.away_score}` : 'vs'}
                                  </div>
                                  <div className="col-span-2 text-left font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                    {m.away_team?.name || 'A definir'}
                                  </div>
                                </div>

                                {/* Ação de Súmula e Reset */}
                                {isAdmin && (
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                                    {m.status === 'finished' && (
                                      <button
                                        onClick={async () => {
                                          if (window.confirm(`Deseja resetar o resultado deste jogo (${m.home_team?.name || 'Time 1'} × ${m.away_team?.name || 'Time 2'}) de volta para agendada?`)) {
                                            const res = await resetTournamentMatch(m.id);
                                            if (res.success) {
                                              loadData();
                                              if (onTournamentUpdated) onTournamentUpdated();
                                            }
                                          }
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                        title="Resetar resultado da partida para agendada"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Resetar</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setMatchResultToEdit(m)}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black transition-colors cursor-pointer"
                                    >
                                      Editar Súmula & Placar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════
                ABA 4: EQUIPES & ELENCOS
            ═════════════════════════════════════════════════════════════ */}
            {activeTab === 'teams' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Equipes Cadastradas ({teams.length})
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      O responsável pela inscrição é o técnico oficial da equipe no torneio.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                      <button
                        onClick={() => setIsAdminRegisterTeamOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                        title="Cadastrar e inscrever equipe diretamente (Super Admin / Admin)"
                      >
                        <Plus className="w-4 h-4" />
                        <span>➕ Inscrever Equipe (Admin)</span>
                      </button>
                    )}

                    {isRegistrationOpen && !userTeam && !isFull && (
                      <button
                        onClick={() => setIsRegisterTeamOpen(true)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Inscrever Minha Equipe</span>
                      </button>
                    )}
                  </div>
                </div>

                {teams.length === 0 ? (
                  <div className="p-10 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
                    <Shield className="w-10 h-10 mx-auto opacity-30 text-blue-500" />
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
                      Nenhuma equipe inscrita ainda
                    </h4>
                    <p className="text-xs max-w-sm mx-auto">
                      Membros da liga podem inscrever seus times enquanto as inscrições estiverem abertas.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teams.map((t, tIdx) => {
                      const isCoachOfThisTeam = user?.id === t.coach_id;
                      const canManageRoster = isCoachOfThisTeam || isAdmin;

                      return (
                        <div
                          key={t.id || `team-card-${tIdx}`}
                          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs border border-slate-200 dark:border-slate-600">
                                {t.badge_url ? (
                                  <img src={t.badge_url} alt={t.name} className="w-full h-full object-contain" />
                                ) : (
                                  <span className="text-xl">⚽</span>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                  {t.name}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                  Técnico: <strong>{t.coach?.nome || 'Responsável'}</strong>
                                </p>
                              </div>
                            </div>

                            {/* Badge de Status da Inscrição */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                t.registration_status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : t.registration_status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}
                            >
                              {t.registration_status === 'approved'
                                ? 'Aprovada'
                                : t.registration_status === 'pending'
                                ? 'Pendente'
                                : 'Recusada'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl">
                            <span>Elenco: <strong>{t.players_count || 0} atletas</strong></span>
                            <span>
                              Pagamento:{' '}
                              <strong
                                className={
                                  t.payment_status === 'paid' ? 'text-emerald-500' : 'text-amber-500'
                                }
                              >
                                {t.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                              </strong>
                            </span>
                          </div>

                          {/* Botões de Ação */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {/* Gerenciar Elenco */}
                              <button
                                onClick={() => setRosterModalTeam(t)}
                                className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{canManageRoster ? 'Gerenciar Elenco' : 'Ver Elenco'}</span>
                              </button>

                              {/* Editar Equipe (Admin) */}
                              {isAdmin && (
                                <button
                                  onClick={() => setTeamToEdit(t)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Editar dados da equipe, brasão, técnico e status (Admin)"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Editar</span>
                                </button>
                              )}
                            </div>

                            {/* Ações de Aprovação para o Administrador */}
                            {isAdmin && t.registration_status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleApproveTeam(t.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-xs hover:bg-emerald-600 transition-colors cursor-pointer"
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => handleRejectTeam(t.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Recusar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════
                ABA 5: FINANCEIRO & PREMIAÇÃO
            ═════════════════════════════════════════════════════════════ */}
            {activeTab === 'finance' && (
              <div className="space-y-6">
                {/* Dashboard Financeira do Torneio */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="w-5 h-5" />
                      <h4 className="text-sm font-black uppercase tracking-wider">
                        Balanço & Premiação da Competição
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-bold">
                      Calculado automaticamente
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Total Arrecadado ({financialSummary.teams_count} times)
                      </span>
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {formatCurrency(financialSummary.total_collected)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Custo Society / Arena
                      </span>
                      <span className="text-base sm:text-lg font-black text-red-500">
                        {formatCurrency(financialSummary.society_cost)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                        Premiação Líquida Final
                      </span>
                      <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(financialSummary.prize_pool)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Total Efetivamente Pago
                      </span>
                      <span className="text-base sm:text-lg font-black text-blue-500">
                        {formatCurrency(financialSummary.paid_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Fórmula Explícita */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/15 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>Fórmula:</strong> Premiação = ({financialSummary.teams_count} times × {formatCurrency(financialSummary.entry_fee_per_team)}) − {formatCurrency(financialSummary.society_cost)} (Society) = <strong>{formatCurrency(financialSummary.prize_pool)}</strong>
                    </span>
                  </div>
                </div>

                {/* Controle de Pagamentos de Inscrição por Equipe */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Controle de Pagamentos das Equipes
                  </h4>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Equipe</th>
                          <th className="py-3 px-3">Técnico / Responsável</th>
                          <th className="py-3 px-3">Valor</th>
                          <th className="py-3 px-3 text-center">Status</th>
                          {isAdmin && <th className="py-3 px-3 text-center">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-bold">
                        {teams.map((t, tIdx) => (
                          <tr key={t.id || `team-payment-${tIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 text-slate-900 dark:text-white font-black">
                              {t.name}
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                              {t.coach?.nome || 'Responsável'}
                            </td>
                            <td className="py-3 px-3 text-slate-900 dark:text-white font-black">
                              {formatCurrency(tournament?.entry_fee || 0)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  t.payment_status === 'paid'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}
                              >
                                {t.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-3 text-center">
                                {t.payment_status === 'paid' ? (
                                  <button
                                    onClick={() => handleUpdatePayment(t.id, 'pending')}
                                    className="text-[11px] font-bold text-slate-400 hover:text-amber-500 cursor-pointer transition-colors"
                                  >
                                    Marcar Pendente
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdatePayment(t.id, 'paid')}
                                    className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer transition-colors"
                                  >
                                    Confirmar Pago ✅
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-400 font-medium">
              ID: {tournament?.id.slice(0, 8)}...
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Fechar Painel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>

    {/* Modais Aninhados */}
    {isRegisterTeamOpen && tournament && (
      <RegisterTournamentTeamModal
        key={`reg-team-modal-${tournament.id}`}
        isOpen={isRegisterTeamOpen}
        onClose={() => setIsRegisterTeamOpen(false)}
        tournament={tournament}
        onTeamRegistered={() => {
          setIsRegisterTeamOpen(false);
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
      />
    )}

    {isAdminRegisterTeamOpen && tournament && (
      <RegisterTournamentTeamModal
        key={`admin-reg-team-modal-${tournament.id}`}
        isOpen={isAdminRegisterTeamOpen}
        onClose={() => setIsAdminRegisterTeamOpen(false)}
        tournament={tournament}
        isAdminMode={true}
        onTeamRegistered={() => {
          setIsAdminRegisterTeamOpen(false);
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
      />
    )}

    {teamToEdit && tournament && (
      <EditTournamentTeamModal
        key={`edit-team-modal-${teamToEdit.id}`}
        isOpen={Boolean(teamToEdit)}
        onClose={() => setTeamToEdit(null)}
        tournament={tournament}
        team={teamToEdit}
        onTeamUpdated={() => {
          setTeamToEdit(null);
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
        onTeamRemoved={() => {
          setTeamToEdit(null);
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
      />
    )}

    {isEditTournamentOpen && tournament && (
      <EditTournamentModal
        key={`edit-tournament-modal-${tournament.id}`}
        isOpen={isEditTournamentOpen}
        onClose={() => setIsEditTournamentOpen(false)}
        tournament={tournament}
        onTournamentUpdated={() => {
          setIsEditTournamentOpen(false);
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
        onTournamentDeleted={() => {
          setIsEditTournamentOpen(false);
          onClose();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
      />
    )}

    {rosterModalTeam && tournament && (
      <ManageTournamentRosterModal
        key={`roster-modal-${rosterModalTeam.id}`}
        isOpen={Boolean(rosterModalTeam)}
        onClose={() => setRosterModalTeam(null)}
        tournament={tournament}
        team={rosterModalTeam}
        onRosterUpdated={() => {
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
      />
    )}

    {matchResultToEdit && tournament && (
      <TournamentMatchResultModal
        key={`match-result-modal-${matchResultToEdit.id}`}
        isOpen={Boolean(matchResultToEdit)}
        onClose={() => setMatchResultToEdit(null)}
        match={matchResultToEdit}
        isKnockout={tournament.format === 'knockout'}
        onMatchSaved={() => {
          setMatchResultToEdit(null);
          loadData();
          if (onTournamentUpdated) onTournamentUpdated();
        }}
      />
    )}

    {isChampionModalOpen && tournament && (
      <TournamentChampionModal
        key={`champion-modal-${tournament.id}`}
        isOpen={isChampionModalOpen}
        onClose={() => setIsChampionModalOpen(false)}
        tournament={tournament}
        championTeam={tournament.champion_team}
        runnerUpTeam={tournament.runner_up_team}
        prizeAmount={financialSummary.prize_pool}
      />
    )}
  </>
  );
};
