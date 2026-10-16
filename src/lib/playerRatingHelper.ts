import { MatchParticipant, Profile } from '@/types/database';

export interface RatingTier {
  level: number;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
  colorHex: string;
  description: string;
  emoji: string;
}

export const RATING_TIERS: Record<number, RatingTier> = {
  1: {
    level: 1,
    label: 'Iniciante',
    shortLabel: 'Nível 1',
    badgeBg: 'bg-slate-500/15',
    badgeColor: 'text-slate-400',
    borderColor: 'border-slate-500/30',
    colorHex: '#94a3b8',
    description: 'Pouca experiência ou jogando raramente.',
    emoji: '🌱',
  },
  2: {
    level: 2,
    label: 'Básico',
    shortLabel: 'Nível 2',
    badgeBg: 'bg-zinc-500/15',
    badgeColor: 'text-zinc-400',
    borderColor: 'border-zinc-500/30',
    colorHex: '#a1a1aa',
    description: 'Em fase de aprendizado dos fundamentos.',
    emoji: '👟',
  },
  3: {
    level: 3,
    label: 'Abaixo da Média',
    shortLabel: 'Nível 3',
    badgeBg: 'bg-orange-500/15',
    badgeColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    colorHex: '#fb923c',
    description: 'Participativo, com aspectos a evoluir.',
    emoji: '🏃',
  },
  4: {
    level: 4,
    label: 'Regular',
    shortLabel: 'Nível 4',
    badgeBg: 'bg-amber-500/15',
    badgeColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    colorHex: '#f59e0b',
    description: 'Jogador útil e disciplinado taticamente.',
    emoji: '⚡',
  },
  5: {
    level: 5,
    label: 'Média Padrão',
    shortLabel: 'Nível 5',
    badgeBg: 'bg-sky-500/15',
    badgeColor: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    colorHex: '#38bdf8',
    description: 'Nível médio equilibrado da resenha.',
    emoji: '⚽',
  },
  6: {
    level: 6,
    label: 'Bom',
    shortLabel: 'Nível 6',
    badgeBg: 'bg-teal-500/15',
    badgeColor: 'text-teal-400',
    borderColor: 'border-teal-500/30',
    colorHex: '#2dd4bf',
    description: 'Bom passe, bom posicionamento e visão de jogo.',
    emoji: '🎯',
  },
  7: {
    level: 7,
    label: 'Muito Bom',
    shortLabel: 'Nível 7',
    badgeBg: 'bg-emerald-500/15',
    badgeColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    colorHex: '#34d399',
    description: 'Diferenciado, dita o ritmo e cria chances de gol.',
    emoji: '🔥',
  },
  8: {
    level: 8,
    label: 'Destaque',
    shortLabel: 'Nível 8',
    badgeBg: 'bg-indigo-500/15',
    badgeColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    colorHex: '#818cf8',
    description: 'Alto nível técnico e físico, protagonista.',
    emoji: '🌟',
  },
  9: {
    level: 9,
    label: 'Craque',
    shortLabel: 'Nível 9',
    badgeBg: 'bg-purple-500/15',
    badgeColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    colorHex: '#c084fc',
    description: 'Habilidade superior, decide partidas e clássicos.',
    emoji: '🎩',
  },
  10: {
    level: 10,
    label: 'Elite / Profissional',
    shortLabel: 'Nível 10',
    badgeBg: 'bg-amber-400/20',
    badgeColor: 'text-amber-300',
    borderColor: 'border-amber-400/50',
    colorHex: '#fcd34d',
    description: 'Nível máximo de qualidade e excelência em campo.',
    emoji: '👑',
  },
};

/**
 * Obtém a nota de qualidade do jogador (1 a 10). Se houver nota específica na liga, ela tem prioridade.
 * Fallback para nota geral do perfil ou padrão 5.
 */
export function getPlayerRating(user?: Profile | null, leagueRating?: number | null): number {
  // 1. Prioridade máxima: nota na liga específica
  if (typeof leagueRating === 'number' && !isNaN(leagueRating) && leagueRating >= 1 && leagueRating <= 10) {
    return Math.round(leagueRating);
  }

  if (!user) return 5;

  // 2. Nota global do usuário
  if (typeof user.nivel_qualidade === 'number' && !isNaN(user.nivel_qualidade) && user.nivel_qualidade >= 1 && user.nivel_qualidade <= 10) {
    return Math.round(user.nivel_qualidade);
  }

  // 3. Fallback se estiver no campo level legado
  if (user.level && !isNaN(Number(user.level))) {
    const parsed = Math.round(Number(user.level));
    if (parsed >= 1 && parsed <= 10) return parsed;
  }

  return 5;
}

/**
 * Retorna as informações visuais e rótulo do nível do jogador.
 */
export function getRatingTier(rating: number): RatingTier {
  const clamped = Math.max(1, Math.min(10, Math.round(rating || 5)));
  return RATING_TIERS[clamped] || RATING_TIERS[5];
}

/**
 * Embaralha um array (Fisher-Yates) preservando aleatoriedade para elementos equivalentes.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface BalancedTeamResult {
  teamBuckets: { id: string; user_id: string; team: number; rating: number; genero?: 'masculino' | 'feminino' | null }[][];
  reserves: MatchParticipant[];
  teamStats: {
    teamNumber: number;
    playerCount: number;
    menCount: number;
    femCount: number;
    totalRating: number;
    averageRating: number;
  }[];
  femWarning?: string;
  menWarning?: string;
}

export interface BalanceParticipantsParams {
  participants: MatchParticipant[];
  numTeams: number;
  playersPerTeam: number;
  minFemPerTeam?: number | null;
  maxMenPerTeam?: number | null;
  maxFemPerTeam?: number | null;
  sportType?: 'futebol' | 'volei';
  leagueRatingsMap?: Record<string, number>; // Map de user_id -> rating na liga
}

/**
 * Algoritmo avançado de sorteio equilibrado de times por avaliação de qualidade (1 a 10)
 * e regras específicas por modalidade esportiva (Vôlei e Futebol).
 * 
 * Para Vôlei:
 * 1. Separa estritamente participantes masculinos e femininos.
 * 2. Respeita as cotas máximas configuradas por time (max_homens_por_time e max_mulheres_por_time).
 * 3. Se houver escassez de algum gênero, distribui equitativamente (diferença máx de 1 entre times).
 * 4. Aplica compensação gulosa de notas técnicas por gênero.
 * 5. Executa refinamento 2-Opt trocando pares do mesmo gênero para equalizar as médias técnicas.
 * 
 * Para Futebol:
 * 1. Respeita a cota mínima feminina opcional (min_mulheres_por_time) e distribui os demais por nível técnico.
 */
export function balanceParticipantsIntoTeams(params: BalanceParticipantsParams): BalancedTeamResult {
  const {
    participants,
    numTeams,
    playersPerTeam,
    minFemPerTeam = 0,
    maxMenPerTeam,
    maxFemPerTeam,
    sportType = 'futebol',
    leagueRatingsMap = {},
  } = params;

  // Inicializar baldes dos times
  type AllocatedMember = {
    id: string;
    user_id: string;
    team: number;
    rating: number;
    genero?: 'masculino' | 'feminino' | null;
  };

  const teamBuckets: AllocatedMember[][] = [];
  for (let t = 0; t < numTeams; t++) {
    teamBuckets.push([]);
  }

  // Função auxiliar para calcular nota com leve jitter para desempate não-determinístico
  const withJitter = (p: MatchParticipant) => {
    const userRating = getPlayerRating(p.user, leagueRatingsMap[p.user_id]);
    return {
      participant: p,
      rating: userRating,
      sortScore: userRating + (Math.random() * 0.16 - 0.08),
    };
  };

  const isVolei =
    sportType === 'volei' ||
    (typeof maxMenPerTeam === 'number' && maxMenPerTeam > 0) ||
    (typeof maxFemPerTeam === 'number' && maxFemPerTeam > 0);

  // =========================================================================
  // FLUXO EXCLUSIVO: MODALIDADE VÔLEI (Regras rígidas de cotas por gênero)
  // =========================================================================
  if (isVolei) {
    const targetFemPerTeam =
      typeof maxFemPerTeam === 'number' && maxFemPerTeam > 0
        ? maxFemPerTeam
        : typeof minFemPerTeam === 'number' && minFemPerTeam > 0
        ? minFemPerTeam
        : 0;

    const targetMenPerTeam =
      typeof maxMenPerTeam === 'number' && maxMenPerTeam > 0
        ? maxMenPerTeam
        : Math.max(1, playersPerTeam - targetFemPerTeam);

    const teamMaxCapacity =
      targetFemPerTeam > 0 || targetMenPerTeam > 0
        ? targetFemPerTeam + targetMenPerTeam
        : playersPerTeam;

    const femininas = participants.filter((p) => p.user?.genero === 'feminino');
    const masculinos = participants.filter((p) => p.user?.genero !== 'feminino');

    const femSorted = femininas
      .map(withJitter)
      .sort((a, b) => b.sortScore - a.sortScore)
      .map((item) => ({ participant: item.participant, rating: item.rating }));

    const menSorted = masculinos
      .map(withJitter)
      .sort((a, b) => b.sortScore - a.sortScore)
      .map((item) => ({ participant: item.participant, rating: item.rating }));

    let femWarning: string | undefined;
    let menWarning: string | undefined;

    const totalFemTarget = targetFemPerTeam * numTeams;
    const totalMenTarget = targetMenPerTeam * numTeams;

    if (targetFemPerTeam > 0 && femSorted.length < totalFemTarget) {
      femWarning = `⚠️ Vôlei: Há ${femSorted.length} jogadora${femSorted.length !== 1 ? 's' : ''} para ${numTeams} times (cota ideal: ${totalFemTarget}, ${targetFemPerTeam} por time). As jogadoras foram distribuídas com máxima equidade.`;
    }

    if (targetMenPerTeam > 0 && menSorted.length < totalMenTarget) {
      menWarning = `⚠️ Vôlei: Há ${menSorted.length} jogador${menSorted.length !== 1 ? 'es' : ''} masculino${menSorted.length !== 1 ? 's' : ''} para ${numTeams} times (cota ideal: ${totalMenTarget}, ${targetMenPerTeam} por time). Os jogadores foram distribuídos com máxima equidade.`;
    }

    // 1. Distribuição das Jogadoras Femininas
    if (targetFemPerTeam > 0) {
      for (const femItem of femSorted) {
        // Encontrar times que ainda têm vaga feminina e vaga total
        const candidateTeams: { index: number; femCount: number; sumRating: number }[] = [];
        for (let t = 0; t < numTeams; t++) {
          const currentFemCount = teamBuckets[t].filter((p) => p.genero === 'feminino').length;
          if (currentFemCount < targetFemPerTeam && teamBuckets[t].length < teamMaxCapacity) {
            const sumRating = teamBuckets[t].reduce((acc, cur) => acc + cur.rating, 0);
            candidateTeams.push({ index: t, femCount: currentFemCount, sumRating });
          }
        }

        if (candidateTeams.length === 0) {
          // Todas as cotas femininas foram preenchidas, jogadoras extras irão para reservas
          break;
        }

        // Prioridade: menor contagem de mulheres no time (equidade), depois menor soma de notas
        candidateTeams.sort((a, b) => {
          if (a.femCount !== b.femCount) return a.femCount - b.femCount;
          return a.sumRating - b.sumRating;
        });

        const chosenIndex = candidateTeams[0].index;
        teamBuckets[chosenIndex].push({
          id: femItem.participant.id,
          user_id: femItem.participant.user_id,
          team: chosenIndex + 1,
          rating: femItem.rating,
          genero: 'feminino',
        });
      }
    }

    // 2. Distribuição dos Jogadores Masculinos
    if (targetMenPerTeam > 0) {
      for (const menItem of menSorted) {
        // Encontrar times que ainda têm vaga masculina e vaga total
        const candidateTeams: { index: number; menCount: number; sumRating: number }[] = [];
        for (let t = 0; t < numTeams; t++) {
          const currentMenCount = teamBuckets[t].filter((p) => p.genero !== 'feminino').length;
          if (currentMenCount < targetMenPerTeam && teamBuckets[t].length < teamMaxCapacity) {
            const sumRating = teamBuckets[t].reduce((acc, cur) => acc + cur.rating, 0);
            candidateTeams.push({ index: t, menCount: currentMenCount, sumRating });
          }
        }

        if (candidateTeams.length === 0) {
          // Todas as cotas masculinas foram preenchidas, jogadores extras irão para reservas
          break;
        }

        // Prioridade: menor contagem de homens no time (equidade), depois menor soma de notas geral para compensação
        candidateTeams.sort((a, b) => {
          if (a.menCount !== b.menCount) return a.menCount - b.menCount;
          return a.sumRating - b.sumRating;
        });

        const chosenIndex = candidateTeams[0].index;
        teamBuckets[chosenIndex].push({
          id: menItem.participant.id,
          user_id: menItem.participant.user_id,
          team: chosenIndex + 1,
          rating: menItem.rating,
          genero: menItem.participant.user?.genero || 'masculino',
        });
      }
    }

    // 3. OTIMIZAÇÃO 2-OPT (Trocas entre participantes do MESMO gênero para minimizar desvio técnico)
    const computeTeamMeansVariance = (buckets: AllocatedMember[][]) => {
      const means = buckets.map((b) => (b.length > 0 ? b.reduce((s, x) => s + x.rating, 0) / b.length : 0));
      const overallMean = means.reduce((s, m) => s + m, 0) / (means.length || 1);
      return means.reduce((s, m) => s + Math.pow(m - overallMean, 2), 0);
    };

    let improved = true;
    let iterations = 0;
    const MAX_ITERATIONS = 40;

    while (improved && iterations < MAX_ITERATIONS) {
      improved = false;
      iterations++;
      let currentVariance = computeTeamMeansVariance(teamBuckets);

      for (let t1 = 0; t1 < numTeams; t1++) {
        for (let t2 = t1 + 1; t2 < numTeams; t2++) {
          // Testar trocas entre jogadoras femininas de t1 e t2
          const fems1 = teamBuckets[t1].filter((p) => p.genero === 'feminino');
          const fems2 = teamBuckets[t2].filter((p) => p.genero === 'feminino');

          for (const p1 of fems1) {
            for (const p2 of fems2) {
              if (p1.rating === p2.rating) continue;
              // Troca simulada
              const idx1 = teamBuckets[t1].findIndex((p) => p.id === p1.id);
              const idx2 = teamBuckets[t2].findIndex((p) => p.id === p2.id);

              teamBuckets[t1][idx1] = { ...p2, team: t1 + 1 };
              teamBuckets[t2][idx2] = { ...p1, team: t2 + 1 };

              const newVariance = computeTeamMeansVariance(teamBuckets);
              if (newVariance < currentVariance - 0.0001) {
                currentVariance = newVariance;
                improved = true;
              } else {
                // Reverter
                teamBuckets[t1][idx1] = p1;
                teamBuckets[t2][idx2] = p2;
              }
            }
          }

          // Testar trocas entre jogadores masculinos de t1 e t2
          const mens1 = teamBuckets[t1].filter((p) => p.genero !== 'feminino');
          const mens2 = teamBuckets[t2].filter((p) => p.genero !== 'feminino');

          for (const p1 of mens1) {
            for (const p2 of mens2) {
              if (p1.rating === p2.rating) continue;
              const idx1 = teamBuckets[t1].findIndex((p) => p.id === p1.id);
              const idx2 = teamBuckets[t2].findIndex((p) => p.id === p2.id);

              teamBuckets[t1][idx1] = { ...p2, team: t1 + 1 };
              teamBuckets[t2][idx2] = { ...p1, team: t2 + 1 };

              const newVariance = computeTeamMeansVariance(teamBuckets);
              if (newVariance < currentVariance - 0.0001) {
                currentVariance = newVariance;
                improved = true;
              } else {
                // Reverter
                teamBuckets[t1][idx1] = p1;
                teamBuckets[t2][idx2] = p2;
              }
            }
          }
        }
      }
    }

    // Identificar participantes não alocados (reservas)
    const assignedIds = new Set(teamBuckets.flat().map((u) => u.id));
    const reserves = participants.filter((p) => !assignedIds.has(p.id));

    // Calcular estatísticas dos times de Vôlei
    const teamStats = teamBuckets.map((bucket, idx) => {
      const totalRating = bucket.reduce((sum, p) => sum + p.rating, 0);
      const playerCount = bucket.length;
      const menCount = bucket.filter((p) => p.genero !== 'feminino').length;
      const femCount = bucket.filter((p) => p.genero === 'feminino').length;
      const averageRating = playerCount > 0 ? Number((totalRating / playerCount).toFixed(1)) : 0;
      return {
        teamNumber: idx + 1,
        playerCount,
        menCount,
        femCount,
        totalRating,
        averageRating,
      };
    });

    return {
      teamBuckets,
      reserves,
      teamStats,
      femWarning,
      menWarning,
    };
  }

  // =========================================================================
  // FLUXO PADRÃO: MODALIDADE FUTEBOL (Distribuição com cota mínima feminina)
  // =========================================================================
  const safeMinFem = minFemPerTeam || 0;

  // Separar jogadoras femininas e masculinos/outros
  const femininas = participants.filter((p) => p.user?.genero === 'feminino');
  const outros = participants.filter((p) => p.user?.genero !== 'feminino');

  const femSorted = femininas
    .map(withJitter)
    .sort((a, b) => b.sortScore - a.sortScore)
    .map((item) => item.participant);

  let femWarning: string | undefined;
  const totalFemNeeded = safeMinFem * numTeams;
  if (safeMinFem > 0 && femSorted.length < totalFemNeeded) {
    femWarning = `⚠️ Aviso: Há apenas ${femSorted.length} jogadora${femSorted.length !== 1 ? 's' : ''} para ${numTeams} times (mínimo exigido: ${totalFemNeeded}). As jogadoras foram distribuídas com o melhor equilíbrio de nível possível.`;
  }

  // 1. Distribuir a cota feminina mínima usando snake draft por habilidade
  let femAllocatedCount = 0;
  for (let round = 0; round < safeMinFem; round++) {
    const order =
      round % 2 === 0
        ? Array.from({ length: numTeams }, (_, i) => i)
        : Array.from({ length: numTeams }, (_, i) => numTeams - 1 - i);

    for (const t of order) {
      if (femAllocatedCount < femSorted.length && teamBuckets[t].length < playersPerTeam) {
        const p = femSorted[femAllocatedCount];
        const rating = getPlayerRating(p.user, leagueRatingsMap[p.user_id]);
        teamBuckets[t].push({
          id: p.id,
          user_id: p.user_id,
          team: t + 1,
          rating,
          genero: 'feminino',
        });
        femAllocatedCount++;
      }
    }
  }

  // 2. Coletar todas as femininas restantes + masculinos
  const remainingFem = femSorted.slice(femAllocatedCount);
  const poolToBalance = [...remainingFem, ...outros];

  // Ordenar todo o pool restante por qualidade decrescente
  const poolSorted = poolToBalance.map(withJitter).sort((a, b) => b.sortScore - a.sortScore);

  // 3. Distribuição gulosa baseada na menor soma de notas do time com vaga
  for (const item of poolSorted) {
    const p = item.participant;
    const rating = item.rating;

    const candidateTeams: { index: number; currentSum: number; count: number }[] = [];
    for (let t = 0; t < numTeams; t++) {
      if (teamBuckets[t].length < playersPerTeam) {
        const currentSum = teamBuckets[t].reduce((acc, cur) => acc + cur.rating, 0);
        candidateTeams.push({ index: t, currentSum, count: teamBuckets[t].length });
      }
    }

    if (candidateTeams.length === 0) {
      break;
    }

    candidateTeams.sort((a, b) => {
      if (a.currentSum !== b.currentSum) {
        return a.currentSum - b.currentSum;
      }
      return a.count - b.count;
    });

    const bestTeamIndex = candidateTeams[0].index;
    teamBuckets[bestTeamIndex].push({
      id: p.id,
      user_id: p.user_id,
      team: bestTeamIndex + 1,
      rating,
      genero: p.user?.genero || 'masculino',
    });
  }

  // 4. Identificar participantes não alocados (reservas)
  const assignedIds = new Set(teamBuckets.flat().map((u) => u.id));
  const reserves = participants.filter((p) => !assignedIds.has(p.id));

  // 5. Calcular estatísticas de equilíbrio dos times de Futebol
  const teamStats = teamBuckets.map((bucket, idx) => {
    const totalRating = bucket.reduce((sum, p) => sum + p.rating, 0);
    const playerCount = bucket.length;
    const menCount = bucket.filter((p) => p.genero !== 'feminino').length;
    const femCount = bucket.filter((p) => p.genero === 'feminino').length;
    const averageRating = playerCount > 0 ? Number((totalRating / playerCount).toFixed(1)) : 0;
    return {
      teamNumber: idx + 1,
      playerCount,
      menCount,
      femCount,
      totalRating,
      averageRating,
    };
  });

  return {
    teamBuckets,
    reserves,
    teamStats,
    femWarning,
  };
}

