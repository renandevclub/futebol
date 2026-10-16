import { supabase } from '@/lib/supabase';
import { LeaguePlayerRanking, Profile, Match, MatchParticipant, MatchGameGoal } from '@/types/database';

/**
 * Calcula e consolida as estatísticas individuais dos jogadores para uma liga específica.
 * Garante 100% de isolamento por organização/liga (organization_id).
 */
export async function fetchLeagueIndividualRankings(
  leagueId: string,
  sportType?: 'futebol' | 'volei'
): Promise<LeaguePlayerRanking[]> {
  try {
    if (!leagueId) return [];

    // 1. Buscar todas as partidas pertencentes exclusivamente a esta liga (e modalidade se especificada)
    let matchesQuery = supabase
      .from('matches')
      .select('id, mvp_player_id, aninga_player_id, status, sport_type')
      .eq('organization_id', leagueId);

    if (sportType) {
      matchesQuery = matchesQuery.eq('sport_type', sportType);
    }

    const { data: matchesData, error: matchesError } = await matchesQuery;

    if (matchesError || !matchesData || matchesData.length === 0) {
      return [];
    }

    const matchIds = matchesData.map((m) => m.id);

    // 2. Buscar participantes dessas partidas com perfil do usuário
    const { data: participantsData, error: participantsError } = await supabase
      .from('match_participants')
      .select(`
        id,
        match_id,
        user_id,
        team,
        is_mvp,
        is_aninga,
        user:user_id (*)
      `)
      .in('match_id', matchIds);

    if (participantsError || !participantsData) {
      return [];
    }

    // 3. Buscar todos os gols/pontos e assistências dessas partidas
    const { data: goalsData } = await supabase
      .from('match_game_goals')
      .select('id, match_id, player_id, assist_player_id, point_type, card_type')
      .in('match_id', matchIds);

    // 4. Buscar jogos finalizados exclusivamente dessas partidas para computar Vitórias, Empates e Derrotas dos atletas
    const { data: gamesData } = await supabase
      .from('match_games')
      .select('id, match_id, team_a, team_b, score_a, score_b, winner_team, is_draw, status')
      .in('match_id', matchIds)
      .eq('status', 'finished');

    // 5. Mapear MVPs e ANINGAs diretos das partidas
    const matchMvpMap: Record<string, string> = {};
    const matchAningaMap: Record<string, string> = {};
    matchesData.forEach((m) => {
      if (m.mvp_player_id) matchMvpMap[m.id] = m.mvp_player_id;
      if (m.aninga_player_id) matchAningaMap[m.id] = m.aninga_player_id;
    });

    // 6. Estruturar o mapa consolidado de estatísticas por usuário e mapear jogadores por partida/time
    const playerStatsMap: Record<string, LeaguePlayerRanking> = {};
    const matchTeamUsersMap: Record<string, Record<number, string[]>> = {};

    participantsData.forEach((p) => {
      if (!p.user || !p.user_id) return;
      const uid = p.user_id;

      if (!playerStatsMap[uid]) {
        const userProfile = (Array.isArray(p.user) ? p.user[0] : p.user) as unknown as Profile;
        playerStatsMap[uid] = {
          user_id: uid,
          user: userProfile,
          matches_played: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          points: 0,
          aces: 0,
          blocks: 0,
          mvp_count: 0,
          aninga_count: 0,
          wins: 0,
          draws: 0,
          losses: 0,
        };
      }

      // Contabilizar partida disputada
      playerStatsMap[uid].matches_played += 1;

      // Mapear time do jogador nesta partida
      if (p.team) {
        if (!matchTeamUsersMap[p.match_id]) {
          matchTeamUsersMap[p.match_id] = {};
        }
        if (!matchTeamUsersMap[p.match_id][p.team]) {
          matchTeamUsersMap[p.match_id][p.team] = [];
        }
        matchTeamUsersMap[p.match_id][p.team].push(uid);
      }

      // Verificar se foi MVP ou ANINGA nesta partida
      const isMvp = p.is_mvp || matchMvpMap[p.match_id] === uid;
      const isAninga = p.is_aninga || matchAningaMap[p.match_id] === uid;

      if (isMvp) playerStatsMap[uid].mvp_count += 1;
      if (isAninga) playerStatsMap[uid].aninga_count += 1;
    });

    // 7. Computar Vitórias, Empates e Derrotas a partir dos jogos finalizados
    if (gamesData && gamesData.length > 0) {
      const isVoleiLeague = sportType === 'volei';

      gamesData.forEach((g) => {
        const teamAUsers = matchTeamUsersMap[g.match_id]?.[g.team_a] || [];
        const teamBUsers = matchTeamUsersMap[g.match_id]?.[g.team_b] || [];

        if (!isVoleiLeague && (g.is_draw || g.score_a === g.score_b)) {
          // Empate (Futebol): 1 ponto para cada jogador
          teamAUsers.forEach((uid) => {
            if (playerStatsMap[uid]) {
              playerStatsMap[uid].draws += 1;
              playerStatsMap[uid].points += 1;
            }
          });
          teamBUsers.forEach((uid) => {
            if (playerStatsMap[uid]) {
              playerStatsMap[uid].draws += 1;
              playerStatsMap[uid].points += 1;
            }
          });
        } else if (g.winner_team === g.team_a || g.score_a > g.score_b) {
          // Vitória do Time A
          teamAUsers.forEach((uid) => {
            if (playerStatsMap[uid]) {
              playerStatsMap[uid].wins += 1;
              if (!isVoleiLeague) playerStatsMap[uid].points += 3;
            }
          });
          teamBUsers.forEach((uid) => {
            if (playerStatsMap[uid]) {
              playerStatsMap[uid].losses += 1;
            }
          });
        } else {
          // Vitória do Time B
          teamBUsers.forEach((uid) => {
            if (playerStatsMap[uid]) {
              playerStatsMap[uid].wins += 1;
              if (!isVoleiLeague) playerStatsMap[uid].points += 3;
            }
          });
          teamAUsers.forEach((uid) => {
            if (playerStatsMap[uid]) {
              playerStatsMap[uid].losses += 1;
            }
          });
        }
      });
    }

    // 8. Computar gols, assistências, cartões e pontos individuais
    if (goalsData && goalsData.length > 0) {
      goalsData.forEach((g) => {
        // Goleador / Pontuador
        if (g.player_id && playerStatsMap[g.player_id]) {
          const stats = playerStatsMap[g.player_id];
          const pt = (g.point_type || '').toLowerCase();

          if (pt.includes('ace') || pt.includes('saque')) {
            stats.aces += 1;
            stats.points += 1;
          } else if (pt.includes('bloqueio') || pt.includes('block')) {
            stats.blocks += 1;
            stats.points += 1;
          } else if (pt.includes('ataque') || pt.includes('ponto') || pt.includes('point')) {
            stats.points += 1;
          } else {
            // Futebol: Gol comum
            stats.goals += 1;
          }

          // Cartões
          if (g.card_type === 'yellow') stats.yellow_cards += 1;
          if (g.card_type === 'red') stats.red_cards += 1;
        }

        // Assistente / Garçom (Futebol)
        if (g.assist_player_id && playerStatsMap[g.assist_player_id]) {
          playerStatsMap[g.assist_player_id].assists += 1;
        }
      });
    }

    // 9. Calcular médias e converter para lista
    const rankingsList: LeaguePlayerRanking[] = Object.values(playerStatsMap).map((stat) => ({
      ...stat,
      goals_per_match:
        stat.matches_played > 0 ? Number((stat.goals / stat.matches_played).toFixed(2)) : 0,
      points_per_match:
        stat.matches_played > 0 ? Number((stat.points / stat.matches_played).toFixed(2)) : 0,
    }));

    return rankingsList;
  } catch (err) {
    console.error('Erro ao buscar rankings individuais da liga:', err);
    return [];
  }
}

/**
 * Registra o Melhor da Partida (MVP) e o Pior da Partida (ANINGA) de uma partida.
 */
export async function saveMatchHighlights(
  matchId: string,
  mvpUserId: string | null,
  aningaUserId: string | null,
  mvpNotes?: string,
  aningaNotes?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const { data, error } = await supabase.rpc('set_match_highlights', {
      p_match_id: matchId,
      p_mvp_user_id: mvpUserId,
      p_aninga_user_id: aningaUserId,
      p_mvp_notes: mvpNotes || null,
      p_aninga_notes: aningaNotes || null,
    });

    if (error) {
      console.warn('Fallback para update direto em matches:', error);
      // Fallback: update direto
      const { error: matchUpdateErr } = await supabase
        .from('matches')
        .update({
          mvp_player_id: mvpUserId,
          aninga_player_id: aningaUserId,
          mvp_notes: mvpNotes || null,
          aninga_notes: aningaNotes || null,
        })
        .eq('id', matchId);

      if (matchUpdateErr) throw matchUpdateErr;

      // Atualizar flags em match_participants
      if (mvpUserId) {
        await supabase
          .from('match_participants')
          .update({ is_mvp: true })
          .eq('match_id', matchId)
          .eq('user_id', mvpUserId);
      }
      if (aningaUserId) {
        await supabase
          .from('match_participants')
          .update({ is_aninga: true })
          .eq('match_id', matchId)
          .eq('user_id', aningaUserId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao salvar destaques da partida:', err);
    return { success: false, error: err?.message || err };
  }
}
