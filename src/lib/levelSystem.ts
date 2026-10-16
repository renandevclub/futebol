export interface PlayerLevelInfo {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  badgeEmoji: string;
  badgeName: string;
  color: string;
  badgeBg: string;
  borderHover: string;
  gradient: string;
  description: string;
}

export const LEVEL_TIERS: PlayerLevelInfo[] = [
  {
    level: 1,
    title: 'Estreante',
    minXp: 0,
    maxXp: 299,
    badgeEmoji: '🩴',
    badgeName: 'Chuteira de Pano',
    color: 'text-amber-600 dark:text-amber-500',
    badgeBg: 'bg-amber-600/15 border-amber-600/30',
    borderHover: 'hover:border-amber-500/50',
    gradient: 'from-amber-700/80 via-amber-600/40 to-slate-900',
    description: 'Chegando agora na resenha. Mostre seu valor dentro de campo!',
  },
  {
    level: 2,
    title: 'Aprendiz',
    minXp: 300,
    maxXp: 799,
    badgeEmoji: '👟',
    badgeName: 'Boleiro em Evolução',
    color: 'text-orange-500 dark:text-orange-400',
    badgeBg: 'bg-orange-500/15 border-orange-500/30',
    borderHover: 'hover:border-orange-500/50',
    gradient: 'from-orange-600/80 via-orange-500/40 to-slate-900',
    description: 'Ganhando ritmo de jogo e entrosamento com a rapaziada a cada partida.',
  },
  {
    level: 3,
    title: 'Titular',
    minXp: 800,
    maxXp: 1599,
    badgeEmoji: '⚽',
    badgeName: 'Dono da Posição',
    color: 'text-sky-400 dark:text-sky-300',
    badgeBg: 'bg-sky-500/15 border-sky-500/30',
    borderHover: 'hover:border-sky-400/50',
    gradient: 'from-sky-600/80 via-sky-500/40 to-slate-900',
    description: 'Presença garantida toda semana, não foge da dividida e joga com raça!',
  },
  {
    level: 4,
    title: 'Camisa 10',
    minXp: 1600,
    maxXp: 2799,
    badgeEmoji: '🎩',
    badgeName: 'Maestro do Meio',
    color: 'text-emerald-400 dark:text-emerald-300',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30',
    borderHover: 'hover:border-emerald-400/50',
    gradient: 'from-emerald-600/80 via-emerald-500/40 to-slate-900',
    description: 'Dita o ritmo do jogo, distribui assistências e coloca os atacantes na cara do gol.',
  },
  {
    level: 5,
    title: 'Craque',
    minXp: 2800,
    maxXp: 4499,
    badgeEmoji: '🌟',
    badgeName: 'Estrela da Pelada',
    color: 'text-purple-400 dark:text-purple-300',
    badgeBg: 'bg-purple-500/15 border-purple-500/30',
    borderHover: 'hover:border-purple-400/50',
    gradient: 'from-purple-600/80 via-purple-500/40 to-slate-900',
    description: 'Decide clássicos nos minutos finais e sempre concorre ao prêmio de MVP.',
  },
  {
    level: 6,
    title: 'Lenda',
    minXp: 4500,
    maxXp: 999999,
    badgeEmoji: '👑',
    badgeName: 'Rei do Futebol Society',
    color: 'text-amber-300 dark:text-yellow-300',
    badgeBg: 'bg-yellow-500/20 border-yellow-400/50',
    borderHover: 'hover:border-yellow-400',
    gradient: 'from-amber-500/90 via-yellow-500/50 to-slate-900',
    description: 'Estatuto no clube, respeito absoluto de todos e lenda viva da resenha.',
  },
];

export interface XpBreakdown {
  matchesXp: number;
  paidXp: number;
  goalsXp: number;
  pointsXp: number;
  winsXp: number;
  mvpXp: number;
  champXp: number;
  streakXp: number;
  totalXp: number;
}

export interface PlayerProgress {
  currentTier: PlayerLevelInfo;
  nextTier: PlayerLevelInfo | null;
  totalXp: number;
  xpInCurrentTier: number;
  xpRequiredForNextTier: number;
  progressPercentage: number;
  breakdown: XpBreakdown;
}

/**
 * Calcula os pontos de XP detalhados e o progresso do jogador
 */
export function calculatePlayerProgress(stats: {
  matches_played: number;
  paid_matches_count?: number;
  gols?: number;
  pontos?: number;
  wins?: number;
  mvp_count?: number;
  championships_won?: number;
  win_streak?: number;
  monthly_frequency?: number;
}): PlayerProgress {
  const matchesXp = (stats.matches_played || 0) * 100;
  const paidXp = (stats.paid_matches_count ?? stats.matches_played ?? 0) * 50;
  const goalsXp = (stats.gols || 0) * 40;
  const pointsXp = (stats.pontos || 0) * 20;
  const winsXp = (stats.wins || 0) * 30;
  const mvpXp = (stats.mvp_count || 0) * 150;
  const champXp = (stats.championships_won || 0) * 200;
  
  // Streak / Frequência semanal
  const streak = stats.monthly_frequency || stats.win_streak || 0;
  const streakXp = streak * 25;

  const totalXp = matchesXp + paidXp + goalsXp + pointsXp + winsXp + mvpXp + champXp + streakXp;

  // Encontrar o Tier atual
  let currentTier = LEVEL_TIERS[0];
  let nextTier: PlayerLevelInfo | null = LEVEL_TIERS[1];

  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_TIERS[i].minXp) {
      currentTier = LEVEL_TIERS[i];
      nextTier = i < LEVEL_TIERS.length - 1 ? LEVEL_TIERS[i + 1] : null;
      break;
    }
  }

  let xpInCurrentTier = 0;
  let xpRequiredForNextTier = 100;
  let progressPercentage = 100;

  if (nextTier) {
    xpInCurrentTier = totalXp - currentTier.minXp;
    xpRequiredForNextTier = nextTier.minXp - currentTier.minXp;
    progressPercentage = Math.min(100, Math.max(0, Math.round((xpInCurrentTier / xpRequiredForNextTier) * 100)));
  }

  return {
    currentTier,
    nextTier,
    totalXp,
    xpInCurrentTier,
    xpRequiredForNextTier,
    progressPercentage,
    breakdown: {
      matchesXp,
      paidXp,
      goalsXp,
      pointsXp,
      winsXp,
      mvpXp,
      champXp,
      streakXp,
      totalXp,
    },
  };
}

/**
 * Retorna as regras de XP para o guia de missões
 */
export const XP_RULES = [
  { action: 'Presença Confirmada em Partida', xp: '+100 XP', icon: '⚽', desc: 'Garanta sua vaga e jogue a partida' },
  { action: 'PIX Pago & Aprovado', xp: '+50 XP', icon: '💸', desc: 'Pague a coleta pelo app no prazo' },
  { action: 'Gol Marcado no Placar', xp: '+40 XP', icon: '🎯', desc: 'Balançou as redes no LiveScoreboard' },
  { action: 'Vitória de Jogo', xp: '+30 XP', icon: '🔥', desc: 'Seu time venceu o confronto' },
  { action: 'Craque da Rodada (MVP)', xp: '+150 XP', icon: '🌟', desc: 'Eleito o melhor jogador em campo' },
  { action: 'Campeão da Rodada', xp: '+200 XP', icon: '🏆', desc: 'Seu time foi o 1º colocado geral da noite' },
  { action: 'Frequência / Sequência Ativa', xp: '+25 XP/partida', icon: '⚡', desc: 'Bônus por jogar com regularidade no mês' },
];
