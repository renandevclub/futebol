'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StandingsTable } from '@/components/StandingsTable';
import { LeagueIndividualRankings } from '@/components/LeagueIndividualRankings';
import dynamic from 'next/dynamic';
import { Match, League } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useLeague } from '@/context/LeagueContext';
import { Trophy, Filter, ArrowLeft, Users, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const LoginModal = dynamic(
  () => import('@/components/LoginModal').then((module) => module.LoginModal),
  { ssr: false },
);
const CreatePostModal = dynamic(
  () => import('@/components/CreatePostModal').then((module) => module.CreatePostModal),
  { ssr: false },
);
const CreateMatchModal = dynamic(
  () => import('@/components/CreateMatchModal').then((module) => module.CreateMatchModal),
  { ssr: false },
);
const AdminPanelModal = dynamic(
  () => import('@/components/AdminPanelModal').then((module) => module.AdminPanelModal),
  { ssr: false },
);

export default function StandingsPage() {
  const { leagues, currentLeague, selectLeague } = useLeague();

  // Liga selecionada na página de classificação
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Tipo de Visualização: 'individual' (Rankings dos Jogadores) ou 'teams' (Classificação dos Times)
  const [viewMode, setViewMode] = useState<'individual' | 'teams'>('individual');

  // Modais de Header
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Sincronizar liga inicial
  useEffect(() => {
    if (!selectedLeagueId) {
      if (currentLeague) {
        setSelectedLeagueId(currentLeague.id);
      } else if (leagues.length > 0) {
        setSelectedLeagueId(leagues[0].id);
      }
    }
  }, [currentLeague, leagues, selectedLeagueId]);

  const selectedLeague = useMemo(() => {
    return leagues.find((l) => l.id === selectedLeagueId) || currentLeague || leagues[0];
  }, [leagues, selectedLeagueId, currentLeague]);

  // Carregar partidas da liga selecionada
  useEffect(() => {
    if (!selectedLeague?.id) return;

    const fetchMatches = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('organization_id', selectedLeague.id)
          .order('data', { ascending: false });

        if (!error && data) {
          setMatches(data);
        } else {
          setMatches([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    void fetchMatches();
  }, [selectedLeague?.id]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);
  const isVolei = selectedLeague?.sport_type === 'volei';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Header
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenCreatePost={() => setIsCreatePostOpen(true)}
        onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      <main className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-6 w-full flex-1 space-y-5">
        {/* Banner do Topo */}
        <div
          className={`relative overflow-hidden rounded-3xl border shadow-2xl p-5 sm:p-7 space-y-4 text-white ${
            isVolei
              ? 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/30'
              : 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/30'
          }`}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Trophy className="w-56 h-56 text-amber-400" />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <Link
                href="/"
                className={`inline-flex items-center gap-1.5 text-xs font-extrabold transition-colors mb-1 ${
                  isVolei ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Início</span>
              </Link>

              <div className="flex items-center gap-2">
                <span className="text-2xl">{isVolei ? '🏐' : '⚽'}</span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Rankings & Classificação
                </h1>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
                Estatísticas individuais oficiais, artilharia, garçons, craques da rodada e o divertido{' '}
                <strong>Mural do ANINGA 🐍</strong> por liga.
              </p>
            </div>

            {/* Seletor de Ligas */}
            {leagues.length > 0 && (
              <div className="relative z-10 bg-slate-900/90 border border-slate-700/80 p-3 rounded-2xl shrink-0 space-y-1.5 shadow-lg">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span>Selecionar Liga:</span>
                </label>
                <select
                  value={selectedLeagueId}
                  onChange={(e) => {
                    setSelectedLeagueId(e.target.value);
                    setSelectedMatchId('all');
                    selectLeague(e.target.value);
                  }}
                  className="bg-slate-950 border border-slate-700 text-xs font-bold text-white rounded-xl p-2 w-full min-w-[200px] focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {leagues.map((lg) => (
                    <option key={lg.id} value={lg.id}>
                      {lg.sport_type === 'volei' ? '🏐' : '⚽'} {lg.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Alternador Principal de Visualização: Rankings Individuais vs Tabela dos Times */}
          <SegmentedControl
            id="standings-view"
            ariaLabel="Visualização da classificação"
            value={viewMode}
            onValueChange={setViewMode}
            className="relative z-10 pt-2 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 border-t border-slate-800/80"
            buttonClassName={(_, isActive) =>
              `w-full sm:w-auto min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                isActive
                  ? isVolei
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                    : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`
            }
            options={[
              { value: 'individual', icon: <Sparkles className="w-3.5 h-3.5 shrink-0" />, label: <span className="truncate">Rankings Individuais</span> },
              { value: 'teams', icon: <Trophy className="w-3.5 h-3.5 shrink-0" />, label: <span className="truncate">Tabela dos Times</span> },
            ]}
          />
        </div>

        {/* 1. VISUALIZAÇÃO: RANKINGS INDIVIDUAIS POR LIGA */}
        {viewMode === 'individual' && selectedLeague && (
          <LeagueIndividualRankings league={selectedLeague} />
        )}

        {/* 2. VISUALIZAÇÃO: CLASSIFICAÇÃO DOS TIMES */}
        {viewMode === 'teams' && (
          <div className="space-y-4">
            {/* Filtro por Partida da Liga */}
            {matches.length > 0 && (
              <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Filtrar Confrontos:
                  </span>
                </div>

                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white rounded-xl p-2 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="all">🏆 Todos os Jogos da Liga (Acumulado)</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.titulo} ({m.data})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <StandingsTable
              matchId={selectedMatchId === 'all' ? undefined : selectedMatchId}
              leagueId={selectedLeague?.id}
              sportType={selectedLeague?.sport_type}
              numTeams={selectedMatch?.num_times || 4}
              showTopScorers={true}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-5 text-center space-y-1 mt-auto">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5">
          <span>🏆</span>
          <span className="font-black">F&V Sports</span>
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          Classificação individual e por equipes 100% isolada e automatizada por liga.
        </p>
      </footer>

      {/* Modais Globais */}
      {isLoginOpen && (
        <LoginModal isOpen onClose={() => setIsLoginOpen(false)} />
      )}
      {isCreatePostOpen && (
        <CreatePostModal
          isOpen
          onClose={() => setIsCreatePostOpen(false)}
          onPostCreated={() => {}}
        />
      )}
      {isCreateMatchOpen && (
        <CreateMatchModal
          isOpen
          onClose={() => setIsCreateMatchOpen(false)}
          onMatchCreated={() => {}}
        />
      )}
      {isAdminPanelOpen && (
        <AdminPanelModal isOpen onClose={() => setIsAdminPanelOpen(false)} />
      )}
    </div>
  );
}
