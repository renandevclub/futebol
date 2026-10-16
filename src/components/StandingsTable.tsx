'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Match, MatchGame, MatchGameGoal, Profile, TeamStanding, PlayerScorer } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { getTeamInfo } from '@/lib/teamsHelper';
import { subscribeToTables } from '@/lib/realtime';
import { TeamBadge } from '@/components/TeamBadge';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Award,
  Medal,
  Activity,
  User,
  Shield,
  CheckCircle2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface StandingsTableProps {
  matchId?: string | null;
  leagueId?: string | null;
  sportType?: 'futebol' | 'volei' | string | null;
  numTeams?: number;
  showTopScorers?: boolean;
}

export const StandingsTable: React.FC<StandingsTableProps> = ({
  matchId,
  leagueId,
  sportType,
  numTeams = 4,
  showTopScorers = true,
}) => {
  const [games, setGames] = useState<MatchGame[]>([]);
  const [goals, setGoals] = useState<MatchGameGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);

  // Estado do Modal de Visualização Ampliada (Lightbox)
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  const openImagePreview = (previewData: Omit<LightboxPreviewData, 'isOpen'>) => {
    setLightboxData({ ...previewData, isOpen: true });
  };

  const closeImagePreview = () => {
    setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null));
  };

  const fetchStandingsData = async () => {
    try {
      setLoading(true);

      // 1. Caso seja uma partida específica selecionada
      if (matchId) {
        const { data: matchData } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();
        if (matchData) {
          setMatch(matchData);
        }

        // Buscar jogos finalizados da partida
        const { data: gamesData, error: gamesError } = await supabase
          .from('match_games')
          .select('*')
          .eq('match_id', matchId)
          .eq('status', 'finished')
          .order('ended_at', { ascending: true });

        if (gamesError) {
          console.error('Erro ao buscar jogos para classificação:', gamesError);
          setGames([]);
        } else {
          setGames(gamesData || []);
        }

        // Buscar gols para artilharia da partida
        const { data: goalsData, error: goalsError } = await supabase
          .from('match_game_goals')
          .select(`
            *,
            player:player_id(*)
          `)
          .eq('match_id', matchId)
          .order('created_at', { ascending: false });

        if (!goalsError) {
          setGoals(goalsData || []);
        } else {
          setGoals([]);
        }
        return;
      }

      // 2. Caso seja classificação da liga (acumulado da liga selecionada)
      if (leagueId) {
        let matchesQuery = supabase
          .from('matches')
          .select('id, sport_type, num_times, teams_custom_config, organization_id')
          .eq('organization_id', leagueId);

        if (sportType) {
          matchesQuery = matchesQuery.eq('sport_type', sportType);
        }

        const { data: leagueMatches, error: leagueMatchesError } = await matchesQuery;

        if (leagueMatchesError || !leagueMatches || leagueMatches.length === 0) {
          setGames([]);
          setGoals([]);
          setMatch(null);
          return;
        }

        // Definir modelo para nomes/cores de times e modalidade
        const firstMatch = leagueMatches[0];
        setMatch({
          ...firstMatch,
          sport_type: sportType || firstMatch.sport_type || 'futebol',
        } as Match);

        const matchIds = leagueMatches.map((m) => m.id);

        // Buscar jogos finalizados exclusivamente das partidas desta liga
        const { data: gamesData, error: gamesError } = await supabase
          .from('match_games')
          .select('*')
          .in('match_id', matchIds)
          .eq('status', 'finished')
          .order('ended_at', { ascending: true });

        if (gamesError) {
          console.error('Erro ao buscar jogos da liga:', gamesError);
          setGames([]);
        } else {
          setGames(gamesData || []);
        }

        // Buscar gols exclusivamente das partidas desta liga
        const { data: goalsData, error: goalsError } = await supabase
          .from('match_game_goals')
          .select(`
            *,
            player:player_id(*)
          `)
          .in('match_id', matchIds)
          .order('created_at', { ascending: false });

        if (!goalsError) {
          setGoals(goalsData || []);
        } else {
          setGoals([]);
        }
        return;
      }

      // 3. Se nem matchId nem leagueId forem fornecidos, NUNCA executar consulta global irrestrita
      setGames([]);
      setGoals([]);
      setMatch(null);
    } catch (e) {
      console.error(e);
      setGames([]);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStandingsData();

    const channelKey = matchId
      ? `standings_match_${matchId}`
      : `standings_league_${leagueId || 'none'}`;

    const unsubscribe = subscribeToTables(
      channelKey,
      [
        { table: 'match_games', ...(matchId ? { filter: `match_id=eq.${matchId}` } : {}) },
        { table: 'match_game_goals', ...(matchId ? { filter: `match_id=eq.${matchId}` } : {}) },
        { table: 'matches', ...(matchId ? { filter: `id=eq.${matchId}` } : leagueId ? { filter: `organization_id=eq.${leagueId}` } : {}) },
      ],
      () => {
        void fetchStandingsData();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [matchId, leagueId, sportType]);

  // Informações visuais dos times
  const getTeamInfoForTable = (teamNum: number) => {
    return getTeamInfo(match, teamNum);
  };

  const isVolei = sportType === 'volei' || match?.sport_type === 'volei';

  // Calcular Tabela de Classificação
  const standings: TeamStanding[] = useMemo(() => {
    const statsMap: Record<number, TeamStanding> = {};

    // Determinar quais times devem aparecer na tabela
    const maxTeam = numTeams || 4;
    for (let t = 1; t <= maxTeam; t++) {
      const info = getTeamInfoForTable(t);
      statsMap[t] = {
        team: t,
        teamName: info.name,
        teamColor: info.color,
        teamEmoji: info.emoji,
        teamBadgeUrl: info.badge_url,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [],
      };
    }

    // Processar cada jogo finalizado
    games.forEach((game) => {
      const { team_a, team_b, score_a, score_b, winner_team, is_draw } = game;

      // Garantir que os times existem no mapa
      [team_a, team_b].forEach((t) => {
        if (!statsMap[t]) {
          const info = getTeamInfoForTable(t);
          statsMap[t] = {
            team: t,
            teamName: info.name,
            teamColor: info.color,
            teamEmoji: info.emoji,
            teamBadgeUrl: info.badge_url,
            matchesPlayed: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            form: [],
          };
        }
      });

      // Time A stats
      statsMap[team_a].matchesPlayed += 1;
      statsMap[team_a].goalsFor += score_a;
      statsMap[team_a].goalsAgainst += score_b;

      // Time B stats
      statsMap[team_b].matchesPlayed += 1;
      statsMap[team_b].goalsFor += score_b;
      statsMap[team_b].goalsAgainst += score_a;

      if (!isVolei && (is_draw || score_a === score_b)) {
        // Empate no Futebol (1 ponto para cada)
        statsMap[team_a].draws += 1;
        statsMap[team_a].points += 1;
        statsMap[team_a].form.push('D');

        statsMap[team_b].draws += 1;
        statsMap[team_b].points += 1;
        statsMap[team_b].form.push('D');
      } else if (winner_team === team_a || score_a > score_b) {
        // Vitória do Time A (3 pontos)
        statsMap[team_a].wins += 1;
        statsMap[team_a].points += 3;
        statsMap[team_a].form.push('W');

        statsMap[team_b].losses += 1;
        statsMap[team_b].form.push('L');
      } else {
        // Vitória do Time B (3 pontos)
        statsMap[team_b].wins += 1;
        statsMap[team_b].points += 3;
        statsMap[team_b].form.push('W');

        statsMap[team_a].losses += 1;
        statsMap[team_a].form.push('L');
      }
    });

    // Calcular Saldo de Gols / Saldo de Pontos e ordenar
    const list = Object.values(statsMap).map((s) => ({
      ...s,
      goalDifference: s.goalsFor - s.goalsAgainst,
      form: s.form.slice(-5), // últimos 5 jogos
    }));

    return list.sort((a, b) => {
      // 1. Pontos na Tabela
      if (b.points !== a.points) return b.points - a.points;
      // 2. Vitórias
      if (b.wins !== a.wins) return b.wins - a.wins;
      // 3. Saldo de Gols / Pontos
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      // 4. Gols / Pontos Pró
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // 5. Menos Gols / Pontos Contra
      return a.goalsAgainst - b.goalsAgainst;
    });
  }, [games, numTeams, isVolei]);

  // Calcular Artilheiros
  const topScorers: PlayerScorer[] = useMemo(() => {
    const map: Record<string, PlayerScorer> = {};

    goals.forEach((g) => {
      if (g.player_id && g.player) {
        if (!map[g.player_id]) {
          map[g.player_id] = {
            playerId: g.player_id,
            player: g.player,
            team: g.team,
            goalsCount: 0,
          };
        }
        map[g.player_id].goalsCount += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.goalsCount - a.goalsCount);
  }, [goals]);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════
          TABELA DE CLASSIFICAÇÃO
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isVolei ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
            }`}>
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                {isVolei ? 'Tabela de Classificação do Vôlei 🏐' : 'Tabela de Classificação ⚽'}
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {isVolei
                  ? 'Atualizada automaticamente a cada ponto (3 pts por vitória, sem empates)'
                  : 'Atualizada automaticamente a cada gol e encerramento de jogo'}
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tempo Real</span>
          </div>
        </div>

        {/* Tabela Responsiva */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Pos</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-2 text-center" title="Partidas Disputadas">J</th>
                <th className="py-2.5 px-2 text-center" title="Vitórias">V</th>
                {!isVolei && (
                  <th className="py-2.5 px-2 text-center" title="Empates">E</th>
                )}
                <th className="py-2.5 px-2 text-center" title="Derrotas">D</th>
                <th className="py-2.5 px-2 text-center" title={isVolei ? 'Pontos Pró' : 'Gols Pró'}>{isVolei ? 'PP' : 'GP'}</th>
                <th className="py-2.5 px-2 text-center" title={isVolei ? 'Pontos Contra' : 'Gols Contra'}>{isVolei ? 'PC' : 'GC'}</th>
                <th className="py-2.5 px-2 text-center" title={isVolei ? 'Saldo de Pontos' : 'Saldo de Gols'}>{isVolei ? 'SP' : 'SG'}</th>
                <th className="py-2.5 px-3 text-center text-brand-600 dark:text-brand-400 font-black" title="Pontos na Classificação">PTS</th>
                <th className="py-2.5 px-3 text-center">Forma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {standings.map((st, idx) => {
                const pos = idx + 1;
                const isLeader = pos === 1 && st.points > 0;
                return (
                  <tr
                    key={st.team}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isLeader ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                    }`}
                  >
                    {/* Posição */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                            pos === 1
                              ? 'bg-amber-400 text-slate-950 shadow-xs'
                              : pos === 2
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                              : pos === 3
                              ? 'bg-amber-700/30 text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {pos}º
                        </span>
                      </div>
                    </td>

                    {/* Nome do Time */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <TeamBadge
                          teamInfo={{
                            name: st.teamName,
                            emoji: st.teamEmoji,
                            badge_url: st.teamBadgeUrl,
                            color: st.teamColor,
                          }}
                          size="xs"
                          rounded="md"
                          showBorder={false}
                          onClick={(e) => {
                            if (st.teamBadgeUrl) {
                              e.stopPropagation();
                              openImagePreview({
                                imageUrl: st.teamBadgeUrl,
                                title: st.teamName,
                                subtitle: 'Emblema da Equipe • Tabela de Classificação',
                                type: 'team_badge',
                                badge: `${st.points} pts`,
                              });
                            }
                          }}
                        />
                        <div>
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                            {st.teamName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Estatísticas */}
                    <td className="py-3 px-2 text-center font-medium text-slate-600 dark:text-slate-300">
                      {st.matchesPlayed}
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {st.wins}
                    </td>
                    {!isVolei && (
                      <td className="py-3 px-2 text-center font-medium text-amber-600 dark:text-amber-400">
                        {st.draws}
                      </td>
                    )}
                    <td className="py-3 px-2 text-center font-medium text-rose-500">
                      {st.losses}
                    </td>
                    <td className="py-3 px-2 text-center font-medium text-slate-500">
                      {st.goalsFor}
                    </td>
                    <td className="py-3 px-2 text-center font-medium text-slate-500">
                      {st.goalsAgainst}
                    </td>
                    <td
                      className={`py-3 px-2 text-center font-bold ${
                        st.goalDifference > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : st.goalDifference < 0
                          ? 'text-rose-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 font-black text-sm font-mono">
                        {st.points}
                      </span>
                    </td>

                    {/* Forma Recente */}
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {st.form.length === 0 ? (
                          <span className="text-[10px] text-slate-400">-</span>
                        ) : (
                          st.form.map((res, i) => (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white ${
                                res === 'W'
                                  ? 'bg-emerald-500'
                                  : res === 'D'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              title={res === 'W' ? 'Vitória' : res === 'D' ? 'Empate' : 'Derrota'}
                            >
                              {res === 'W' ? 'V' : res === 'D' ? 'E' : 'D'}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {games.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            {isVolei
              ? 'Nenhum jogo de vôlei finalizado ainda nesta rodada. A classificação será computada conforme os sets forem concluídos!'
              : 'Nenhuma partida finalizada ainda nesta rodada. O placar e a classificação serão computados assim que os jogos forem concluídos!'}
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          RANKING DE ARTILHARIA / MAIORES PONTUADORES
      ═══════════════════════════════════════════════════════════════════ */}
      {showTopScorers && topScorers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isVolei ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
              }`}>
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isVolei ? 'Maiores Pontuadores do Vôlei 🏐' : 'Artilharia da Resenha ⚽'}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {isVolei
                    ? 'Jogadores com mais pontos registrados no placar'
                    : 'Jogadores com mais gols registrados no placar'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {topScorers.map((scorer, idx) => {
              const tInfo = getTeamInfoForTable(scorer.team);
              return (
                <div
                  key={scorer.playerId}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-black text-xs text-slate-400 w-5 text-center">
                      {idx + 1}º
                    </span>

                    {scorer.player?.avatar_url ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (scorer.player?.avatar_url) {
                            openImagePreview({
                              imageUrl: scorer.player.avatar_url,
                              title: scorer.player.nome,
                              subtitle: isVolei
                                ? `Top Pontuador • ${scorer.goalsCount} ponto${scorer.goalsCount > 1 ? 's' : ''}`
                                : `Top Artilheiro • ${scorer.goalsCount} gol${scorer.goalsCount > 1 ? 's' : ''}`,
                              type: 'avatar',
                              badge: `${idx + 1}º Lugar`,
                            });
                          }
                        }}
                        className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                        title="Toque para ampliar foto"
                      >
                        <img
                          src={scorer.player.avatar_url}
                          alt={scorer.player.nome}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isVolei ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {scorer.player?.nome?.substring(0, 2).toUpperCase() || 'JG'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate">
                        <Link
                          href={`/profile/${scorer.playerId}`}
                          className="font-black text-xs text-slate-900 dark:text-white hover:text-brand-500 hover:underline transition-colors truncate"
                          title={`Ver perfil de ${scorer.player?.nome}`}
                        >
                          {scorer.player?.nome}
                        </Link>
                        {scorer.player?.apelido && (
                          <span className="text-slate-400 font-normal text-xs shrink-0">
                            ({scorer.player.apelido})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <TeamBadge
                          teamInfo={tInfo}
                          size="2xs"
                          rounded="md"
                          showBorder={false}
                          onClick={(e) => {
                            if (tInfo.badge_url) {
                              e.stopPropagation();
                              openImagePreview({
                                imageUrl: tInfo.badge_url,
                                title: tInfo.name,
                                subtitle: 'Emblema do Time',
                                type: 'team_badge',
                              });
                            }
                          }}
                        />
                        <span className={`text-[10px] font-bold ${tInfo.text} truncate`}>
                          {tInfo.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-1.5 px-3 py-1 border rounded-xl shrink-0 ${
                    isVolei
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                  }`}>
                    <span className="text-sm">{isVolei ? '🏐' : '⚽'}</span>
                    <span className="font-black text-sm font-mono">{scorer.goalsCount}</span>
                    <span className="text-[10px] font-bold">
                      {isVolei
                        ? `ponto${scorer.goalsCount > 1 ? 's' : ''}`
                        : `gol${scorer.goalsCount > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Lightbox para Imagens Ampliadas */}
      <ImageLightboxModal
        data={lightboxData}
        onClose={closeImagePreview}
      />
    </div>
  );
};
