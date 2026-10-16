'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { League, LeaguePlayerRanking, Profile } from '@/types/database';
import { fetchLeagueIndividualRankings } from '@/lib/leagueRankingsHelper';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Award,
  Flame,
  Search,
  Sparkles,
  User,
  Shield,
  Activity,
  ArrowUpDown,
  Filter,
  Medal,
  Crown,
} from 'lucide-react';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import Link from 'next/link';

interface LeagueIndividualRankingsProps {
  league: League;
}

export const LeagueIndividualRankings: React.FC<LeagueIndividualRankingsProps> = ({ league }) => {
  const [rankings, setRankings] = useState<LeaguePlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const isVolei = league.sport_type === 'volei';

  // Abas disponíveis
  // Futebol: 'goals' | 'assists' | 'mvp' | 'aninga' | 'general'
  // Volei: 'points' | 'mvp' | 'aninga' | 'general'
  const [activeTab, setActiveTab] = useState<
    'goals' | 'assists' | 'points' | 'mvp' | 'aninga' | 'general'
  >(isVolei ? 'points' : 'goals');

  // Estado do Modal Lightbox
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  useEffect(() => {
    // Definir aba padrão dependendo do esporte
    if (isVolei && (activeTab === 'goals' || activeTab === 'assists')) {
      setActiveTab('points');
    } else if (!isVolei && activeTab === 'points') {
      setActiveTab('goals');
    }
  }, [isVolei]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const data = await fetchLeagueIndividualRankings(league.id, league.sport_type);
      setRankings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRankings();
  }, [league.id]);

  // Filtragem por busca
  const filteredRankings = useMemo(() => {
    if (!searchTerm.trim()) return rankings;
    const query = searchTerm.toLowerCase();
    return rankings.filter((r) => {
      const name = r.user.nome?.toLowerCase() || '';
      const apelido = r.user.apelido?.toLowerCase() || '';
      return name.includes(query) || apelido.includes(query);
    });
  }, [rankings, searchTerm]);

  // Listas ordenadas por categoria
  const sortedByGoals = useMemo(() => {
    return [...filteredRankings]
      .filter((r) => r.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.matches_played - a.matches_played);
  }, [filteredRankings]);

  const sortedByAssists = useMemo(() => {
    return [...filteredRankings]
      .filter((r) => r.assists > 0)
      .sort((a, b) => b.assists - a.assists || b.matches_played - a.matches_played);
  }, [filteredRankings]);

  const sortedByPoints = useMemo(() => {
    return [...filteredRankings]
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points || b.matches_played - a.matches_played);
  }, [filteredRankings]);

  const sortedByMvp = useMemo(() => {
    return [...filteredRankings]
      .filter((r) => r.mvp_count > 0)
      .sort((a, b) => b.mvp_count - a.mvp_count || b.matches_played - a.matches_played);
  }, [filteredRankings]);

  const sortedByAninga = useMemo(() => {
    return [...filteredRankings]
      .filter((r) => r.aninga_count > 0)
      .sort((a, b) => b.aninga_count - a.aninga_count || b.matches_played - a.matches_played);
  }, [filteredRankings]);

  const sortedGeneral = useMemo(() => {
    return [...filteredRankings].sort((a, b) => {
      if (isVolei) {
        return b.points - a.points || b.mvp_count - a.mvp_count || b.matches_played - a.matches_played;
      }
      return b.goals - a.goals || b.assists - a.assists || b.mvp_count - a.mvp_count || b.matches_played - a.matches_played;
    });
  }, [filteredRankings, isVolei]);

  // Pódio Top 3 Helper Component
  const renderPodium = (
    items: LeaguePlayerRanking[],
    metricLabel: string,
    getMetricValue: (r: LeaguePlayerRanking) => number | string,
    theme: 'gold' | 'silver' | 'bronze' | 'snake'
  ) => {
    if (items.length === 0) return null;
    const top3 = items.slice(0, 3);
    const first = top3[0];
    const second = top3[1];
    const third = top3[2];

    return (
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 pb-2 items-end">
        {/* 2º Lugar */}
        {second ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center text-center p-3 sm:p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md relative"
          >
            <div className="relative mb-2">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-800 border-2 border-slate-400 overflow-hidden flex items-center justify-center font-black text-white text-sm shadow-md">
                {second.user.avatar_url ? (
                  <img
                    src={second.user.avatar_url}
                    alt={second.user.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  second.user.nome.charAt(0).toUpperCase()
                )}
              </div>
              <span className="absolute -top-2 -right-2 text-base sm:text-lg">🥈</span>
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400">2º Lugar</span>
            <h4 className="font-black text-xs sm:text-sm text-white truncate max-w-[90px] sm:max-w-[130px]">
              {second.user.nome}
            </h4>
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-black text-xs">
              {getMetricValue(second)} <span className="text-[10px] font-semibold">{metricLabel}</span>
            </div>
          </motion.div>
        ) : (
          <div />
        )}

        {/* 1º Lugar (Campeão / Destaque Máximo) */}
        {first ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`flex flex-col items-center text-center p-4 sm:p-5 rounded-3xl border shadow-xl relative -mt-3 sm:-mt-4 ${
              theme === 'snake'
                ? 'bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/50 shadow-emerald-500/10'
                : 'bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/50 shadow-amber-500/10'
            }`}
          >
            <div className="relative mb-2">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 overflow-hidden flex items-center justify-center font-black text-white text-base sm:text-lg shadow-lg ${
                  theme === 'snake'
                    ? 'bg-emerald-500/20 border-emerald-400 shadow-emerald-500/30'
                    : 'bg-amber-500/20 border-amber-400 shadow-amber-500/30'
                }`}
              >
                {first.user.avatar_url ? (
                  <img
                    src={first.user.avatar_url}
                    alt={first.user.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  first.user.nome.charAt(0).toUpperCase()
                )}
              </div>
              <span className="absolute -top-3 -right-2 text-xl sm:text-2xl">
                {theme === 'snake' ? '🐍' : '👑'}
              </span>
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                theme === 'snake' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {theme === 'snake' ? '🐍 Maior ANINGA' : '🥇 Líder Absoluto'}
            </span>
            <h4 className="font-black text-sm sm:text-base text-white truncate max-w-[100px] sm:max-w-[150px]">
              {first.user.nome}
            </h4>
            <div
              className={`mt-1.5 px-3 py-1 rounded-full font-black text-xs sm:text-sm shadow-md ${
                theme === 'snake'
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-amber-500/30'
              }`}
            >
              {getMetricValue(first)} <span className="text-[10px] sm:text-xs font-bold">{metricLabel}</span>
            </div>
          </motion.div>
        ) : (
          <div />
        )}

        {/* 3º Lugar */}
        {third ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center text-center p-3 sm:p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-md relative"
          >
            <div className="relative mb-2">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-800 border-2 border-amber-700/60 overflow-hidden flex items-center justify-center font-black text-white text-sm shadow-md">
                {third.user.avatar_url ? (
                  <img
                    src={third.user.avatar_url}
                    alt={third.user.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  third.user.nome.charAt(0).toUpperCase()
                )}
              </div>
              <span className="absolute -top-2 -right-2 text-base sm:text-lg">🥉</span>
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400">3º Lugar</span>
            <h4 className="font-black text-xs sm:text-sm text-white truncate max-w-[90px] sm:max-w-[130px]">
              {third.user.nome}
            </h4>
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-black text-xs">
              {getMetricValue(third)} <span className="text-[10px] font-semibold">{metricLabel}</span>
            </div>
          </motion.div>
        ) : (
          <div />
        )}
      </div>
    );
  };

  // Render da Tabela
  const renderTable = (
    items: LeaguePlayerRanking[],
    metricLabel: string,
    renderMetric: (r: LeaguePlayerRanking) => React.ReactNode,
    emptyMessage: string
  ) => {
    if (items.length === 0) {
      return (
        <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xl">
            📊
          </div>
          <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                <th className="py-3 px-3.5 text-center w-12">#</th>
                <th className="py-3 px-3">Jogador</th>
                <th className="py-3 px-3 text-center">Partidas</th>
                <th className="py-3 px-3.5 text-right font-black">{metricLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((r, idx) => {
                const pos = idx + 1;
                return (
                  <tr
                    key={r.user_id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3 px-3.5 text-center font-black">
                      {pos === 1 ? (
                        <span className="text-amber-400 font-black text-sm">🥇 1</span>
                      ) : pos === 2 ? (
                        <span className="text-slate-300 font-black text-sm">🥈 2</span>
                      ) : pos === 3 ? (
                        <span className="text-amber-600 font-black text-sm">🥉 3</span>
                      ) : (
                        <span className="text-slate-500 font-bold">{pos}</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <Link
                        href={`/profile/${r.user_id}`}
                        className="flex items-center gap-2.5 group/player"
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                          {r.user.avatar_url ? (
                            <img
                              src={r.user.avatar_url}
                              alt={r.user.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            r.user.nome.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="block font-black text-xs text-white group-hover/player:text-amber-400 transition-colors truncate">
                            {r.user.nome}
                          </span>
                          {r.user.apelido && (
                            <span className="text-[10px] text-slate-400 font-medium truncate block">
                              ({r.user.apelido})
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-300">
                      {r.matches_played}
                    </td>

                    <td className="py-3 px-3.5 text-right font-black text-white">
                      {renderMetric(r)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Barra de Navegação de Abas do Ranking Individual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-2 sm:p-2.5 rounded-3xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {!isVolei ? (
            <>
              {/* Futebol: Artilharia */}
              <button
                onClick={() => setActiveTab('goals')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'goals'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>⚽</span>
                <span>Artilharia</span>
              </button>

              {/* Futebol: Assistências */}
              <button
                onClick={() => setActiveTab('assists')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'assists'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>🎯</span>
                <span>Assistências</span>
              </button>
            </>
          ) : (
            <>
              {/* Vôlei: Pontuadores */}
              <button
                onClick={() => setActiveTab('points')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'points'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>🏐</span>
                <span>Pontuadores</span>
              </button>
            </>
          )}

          {/* Craque da Partida (MVP 🏆) */}
          <button
            onClick={() => setActiveTab('mvp')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'mvp'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🏆</span>
            <span>Hall dos Craques</span>
          </button>

          {/* Mural do ANINGA 🐍 */}
          <button
            onClick={() => setActiveTab('aninga')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'aninga'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-700 to-green-800 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🐍</span>
            <span>Mural do ANINGA</span>
          </button>

          {/* Geral / Completo */}
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'general'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>📊</span>
            <span>Geral</span>
          </button>
        </div>

        {/* Busca de Jogadores */}
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar jogador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-slate-900/60 rounded-3xl border border-slate-800 animate-pulse">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-800" />
          <p className="text-xs text-slate-400 font-bold">Carregando estatísticas da liga...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* 1. ABA: ARTILHARIA (FUTEBOL) */}
          {activeTab === 'goals' && (
            <motion.div
              key="tab-goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {renderPodium(
                sortedByGoals,
                'Gols',
                (r) => `${r.goals} ⚽`,
                'gold'
              )}

              {renderTable(
                sortedByGoals,
                'Gols / Média',
                (r) => (
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-emerald-400">{r.goals} gols</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {r.goals_per_match} gol/jogo
                    </span>
                  </div>
                ),
                'Nenhum gol registrado nas partidas desta liga ainda.'
              )}
            </motion.div>
          )}

          {/* 2. ABA: ASSISTÊNCIAS (FUTEBOL) */}
          {activeTab === 'assists' && (
            <motion.div
              key="tab-assists"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {renderPodium(
                sortedByAssists,
                'Assist.',
                (r) => `${r.assists} 🎯`,
                'silver'
              )}

              {renderTable(
                sortedByAssists,
                'Assistências',
                (r) => (
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-blue-400">{r.assists} passes</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {r.matches_played > 0
                        ? (r.assists / r.matches_played).toFixed(2)
                        : 0}{' '}
                      assist/jogo
                    </span>
                  </div>
                ),
                'Nenhuma assistência registrada nas partidas desta liga ainda.'
              )}
            </motion.div>
          )}

          {/* 3. ABA: PONTUADORES (VÔLEI) */}
          {activeTab === 'points' && (
            <motion.div
              key="tab-points"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {renderPodium(
                sortedByPoints,
                'Pontos',
                (r) => `${r.points} 🏐`,
                'gold'
              )}

              {renderTable(
                sortedByPoints,
                'Pontos / Detalhes',
                (r) => (
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-amber-400">{r.points} pts</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {r.aces > 0 ? `${r.aces} aces` : ''}{' '}
                      {r.blocks > 0 ? `• ${r.blocks} blocks` : ''}
                    </span>
                  </div>
                ),
                'Nenhum ponto registrado nas partidas desta liga ainda.'
              )}
            </motion.div>
          )}

          {/* 4. ABA: HALL DOS CRAQUES (MVP 🏆) */}
          {activeTab === 'mvp' && (
            <motion.div
              key="tab-mvp"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {renderPodium(
                sortedByMvp,
                'x Craque',
                (r) => `${r.mvp_count} 🏆`,
                'gold'
              )}

              {renderTable(
                sortedByMvp,
                'Títulos de Craque',
                (r) => (
                  <div className="flex items-center gap-1 text-amber-400 font-black text-sm">
                    <Trophy className="w-4 h-4" />
                    <span>{r.mvp_count}x Melhor em Campo</span>
                  </div>
                ),
                'Nenhum Craque da Partida (MVP) eleito nas rodadas desta liga ainda.'
              )}
            </motion.div>
          )}

          {/* 5. ABA: MURAL DO ANINGA 🐍 (PIOR DA PARTIDA) */}
          {activeTab === 'aninga' && (
            <motion.div
              key="tab-aninga"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Banner Temático do ANINGA */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-green-950 border border-emerald-500/30 text-white shadow-xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-emerald-400">
                    <span>🐍 Mural Oficial do ANINGA</span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium max-w-lg">
                    Quem mais colecionou tropeços, caneladas e zicas nas rodadas desta liga.
                    A zoeira é livre, mas o respeito prevalece! 😂
                  </p>
                </div>
                <div className="text-3xl sm:text-4xl shrink-0">🐍</div>
              </div>

              {renderPodium(
                sortedByAninga,
                'x ANINGA',
                (r) => `${r.aninga_count} 🐍`,
                'snake'
              )}

              {renderTable(
                sortedByAninga,
                'Vezes Eleito ANINGA',
                (r) => (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-black text-sm">
                    <span>🐍</span>
                    <span>{r.aninga_count}x ANINGA da Rodada</span>
                  </div>
                ),
                'Nenhum jogador eleito como ANINGA nas partidas desta liga até o momento! 🐍'
              )}
            </motion.div>
          )}

          {/* 6. ABA: GERAL / TABELA COMPLETA */}
          {activeTab === 'general' && (
            <motion.div
              key="tab-general"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      <th className="py-3 px-3.5 text-center w-12">#</th>
                      <th className="py-3 px-3">Jogador</th>
                      <th className="py-3 px-3 text-center">Jogos</th>
                      {!isVolei ? (
                        <>
                          <th className="py-3 px-3 text-center">Gols</th>
                          <th className="py-3 px-3 text-center">Assist.</th>
                        </>
                      ) : (
                        <th className="py-3 px-3 text-center">Pontos</th>
                      )}
                      <th className="py-3 px-3 text-center text-amber-400">🏆 Craque</th>
                      <th className="py-3 px-3 text-center text-emerald-400">🐍 ANINGA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortedGeneral.map((r, idx) => (
                      <tr
                        key={r.user_id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <Link
                            href={`/profile/${r.user_id}`}
                            className="flex items-center gap-2.5 group/player"
                          >
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-xs shrink-0">
                              {r.user.avatar_url ? (
                                <img
                                  src={r.user.avatar_url}
                                  alt={r.user.nome}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                r.user.nome.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-extrabold text-xs text-white group-hover/player:text-amber-400 transition-colors truncate">
                              {r.user.nome}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-300">
                          {r.matches_played}
                        </td>
                        {!isVolei ? (
                          <>
                            <td className="py-3 px-3 text-center font-black text-emerald-400">
                              {r.goals}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-blue-400">
                              {r.assists}
                            </td>
                          </>
                        ) : (
                          <td className="py-3 px-3 text-center font-black text-amber-400">
                            {r.points}
                          </td>
                        )}
                        <td className="py-3 px-3 text-center font-black text-amber-400">
                          {r.mvp_count > 0 ? `${r.mvp_count}x` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-emerald-400">
                          {r.aninga_count > 0 ? `${r.aninga_count}x` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Lightbox Modal */}
      <ImageLightboxModal data={lightboxData} onClose={() => setLightboxData(null)} />
    </div>
  );
};
