import { supabase } from '@/lib/supabase';
import { Match, MatchGame, MatchGameGoal, MatchParticipant, TeamStanding, SportType } from '@/types/database';
import { getTeamInfo, TeamVisualInfo } from '@/lib/teamsHelper';

export interface ChampionPlayerData {
  id: string;
  user_id: string | null;
  nome: string;
  apelido?: string | null;
  avatar_url?: string | null;
  posicao?: string | null;
  goalsCount: number;
}

export interface MatchChampionResult {
  matchId: string;
  matchTitle: string;
  matchDate: string;
  matchLocation: string;
  sportType: SportType;
  isVolei: boolean;
  teamNumber: number;
  teamInfo: TeamVisualInfo;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  players: ChampionPlayerData[];
  topScorer?: {
    playerId: string;
    nome: string;
    apelido?: string | null;
    avatar_url?: string | null;
    goals: number;
    teamNumber: number;
  } | null;
  allStandings: TeamStanding[];
  hasFinishedGames: boolean;
}

const VOLEI_POSITIONS = ['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero', 'Ponta', 'Meio de Rede'];

function resolvePlayerPosition(u: any, isVolei: boolean): string | null {
  if (isVolei) {
    if (u?.volei_position) return u.volei_position;
    if (u?.posicao && VOLEI_POSITIONS.some((vp) => vp.toLowerCase() === u.posicao.toLowerCase())) {
      return u.posicao;
    }
    return null; // Nunca exibe posições exclusivas de futebol (Zagueiro, Volante, Atacante) no vôlei
  }
  return u?.futebol_position || u?.posicao || null;
}

/**
 * Calcula ou busca todos os dados do time campeão de uma partida, respeitando a modalidade (Futebol ou Vôlei).
 */
export async function getMatchChampionData(
  matchId: string,
  passedMatch?: Match | null
): Promise<MatchChampionResult | null> {
  try {
    let match = passedMatch;
    if (!match || !match.organization) {
      const { data: matchData, error: matchErr } = await supabase
        .from('matches')
        .select('*, organization:organization_id(*)')
        .eq('id', matchId)
        .single();
      if (!matchErr && matchData) {
        match = matchData;
      }
    }

    if (!match) return null;

    const sportType: SportType = match.sport_type || match.organization?.sport_type || 'futebol';
    const isVolei = sportType === 'volei';

    // 1. Buscar jogos finalizados
    const { data: gamesData } = await supabase
      .from('match_games')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'finished')
      .order('ended_at', { ascending: true });

    const games: MatchGame[] = gamesData || [];

    // 2. Buscar gols / pontos registrados
    const { data: goalsData } = await supabase
      .from('match_game_goals')
      .select(`
        *,
        player:player_id(*)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    const goals: MatchGameGoal[] = goalsData || [];

    // 3. Buscar participantes completos
    const { data: partsData } = await supabase
      .from('match_participants')
      .select(`
        *,
        user:user_id(*)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    const participants: MatchParticipant[] = partsData || [];

    // Mapeamento de gols / pontos por jogador (ignorar cartões)
    const playerGoalsMap: Record<string, number> = {};
    goals.forEach((g) => {
      if (g.point_type === 'card') return;
      if (g.player_id) {
        playerGoalsMap[g.player_id] = (playerGoalsMap[g.player_id] || 0) + 1;
      }
    });

    // 4. Montar classificação dos times (consistente com a tabela de classificação)
    const numTeams = match.num_times || 4;
    const statsMap: Record<number, TeamStanding> = {};

    for (let t = 1; t <= numTeams; t++) {
      const info = getTeamInfo(match, t);
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

    games.forEach((game) => {
      const { team_a, team_b, score_a, score_b, winner_team, is_draw } = game;

      [team_a, team_b].forEach((t) => {
        if (!statsMap[t]) {
          const info = getTeamInfo(match, t);
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

      statsMap[team_a].matchesPlayed += 1;
      statsMap[team_a].goalsFor += score_a;
      statsMap[team_a].goalsAgainst += score_b;

      statsMap[team_b].matchesPlayed += 1;
      statsMap[team_b].goalsFor += score_b;
      statsMap[team_b].goalsAgainst += score_a;

      if (!isVolei && (is_draw || score_a === score_b)) {
        statsMap[team_a].draws += 1;
        statsMap[team_a].points += 1;
        statsMap[team_a].form.push('D');

        statsMap[team_b].draws += 1;
        statsMap[team_b].points += 1;
        statsMap[team_b].form.push('D');
      } else if (winner_team === team_a || score_a > score_b) {
        statsMap[team_a].wins += 1;
        statsMap[team_a].points += 3;
        statsMap[team_a].form.push('W');

        statsMap[team_b].losses += 1;
        statsMap[team_b].form.push('L');
      } else {
        statsMap[team_b].wins += 1;
        statsMap[team_b].points += 3;
        statsMap[team_b].form.push('W');

        statsMap[team_a].losses += 1;
        statsMap[team_a].form.push('L');
      }
    });

    const standings = Object.values(statsMap).map((s) => ({
      ...s,
      goalDifference: s.goalsFor - s.goalsAgainst,
      form: s.form.slice(-5),
    }));

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.goalsAgainst - b.goalsAgainst;
    });

    // 5. Determinar time campeão
    const leader = standings[0] || {
      team: 1,
      teamName: getTeamInfo(match, 1).name,
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    };

    const championTeamNum = leader.team;
    const championTeamInfo = getTeamInfo(match, championTeamNum);

    // 6. Extrair jogadores do time campeão com posições adequadas ao esporte
    const champPlayers: ChampionPlayerData[] = participants
      .filter((p) => p.team === championTeamNum)
      .map((p) => {
        const u = p.user;
        const gCount = p.user_id ? playerGoalsMap[p.user_id] || 0 : 0;
        return {
          id: p.id,
          user_id: p.user_id,
          nome: u?.nome || p.guest_name || 'Jogador',
          apelido: u?.apelido || null,
          avatar_url: u?.avatar_url || null,
          posicao: resolvePlayerPosition(u, isVolei),
          goalsCount: gCount,
        };
      })
      .sort((a, b) => b.goalsCount - a.goalsCount);

    // 7. Encontrar artilheiro ou maior pontuador geral
    let topScorer = null;
    let maxGoals = 0;
    goals.forEach((g) => {
      if (g.point_type === 'card') return;
      if (g.player_id && g.player) {
        const c = playerGoalsMap[g.player_id] || 0;
        if (c > maxGoals) {
          maxGoals = c;
          topScorer = {
            playerId: g.player_id,
            nome: g.player.nome,
            apelido: g.player.apelido || null,
            avatar_url: g.player.avatar_url || null,
            goals: c,
            teamNumber: g.team,
          };
        }
      }
    });

    return {
      matchId: match.id,
      matchTitle: match.titulo,
      matchDate: match.data,
      matchLocation: match.local,
      sportType,
      isVolei,
      teamNumber: championTeamNum,
      teamInfo: championTeamInfo,
      points: leader.points,
      matchesPlayed: leader.matchesPlayed,
      wins: leader.wins,
      draws: leader.draws,
      losses: leader.losses,
      goalsFor: leader.goalsFor,
      goalsAgainst: leader.goalsAgainst,
      goalDifference: leader.goalDifference,
      players: champPlayers,
      topScorer,
      allStandings: standings,
      hasFinishedGames: games.length > 0,
    };
  } catch (error) {
    console.error('Erro ao calcular campeão da partida:', error);
    return null;
  }
}
