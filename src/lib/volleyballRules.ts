export type VolleyWinnerSide = 'a' | 'b';

export interface VolleyWinRule {
  targetScore: number;
  requireTwoPointAdvantage: boolean;
}

/**
 * Identifica o vencedor de um jogo de vôlei que atingiu a pontuação-meta.
 * Sem vantagem obrigatória, preserva a regra legada: chegou à meta, venceu.
 */
export function getVolleyWinnerSide(
  scoreA: number,
  scoreB: number,
  { targetScore, requireTwoPointAdvantage }: VolleyWinRule,
): VolleyWinnerSide | null {
  if (Math.max(scoreA, scoreB) < targetScore) {
    return null;
  }

  if (requireTwoPointAdvantage && Math.abs(scoreA - scoreB) < 2) {
    return null;
  }

  if (scoreA === scoreB) {
    return null;
  }

  return scoreA > scoreB ? 'a' : 'b';
}

export function getVolleyWinRuleLabel({
  targetScore,
  requireTwoPointAdvantage,
}: VolleyWinRule): string {
  return requireTwoPointAdvantage
    ? `${targetScore} Pts + 2 de vantagem`
    : `${targetScore} Pts para vencer`;
}
