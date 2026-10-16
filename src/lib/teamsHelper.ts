import { Match } from '@/types/database';

export interface AvailableColorOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
  border: string;
  lightBg: string;
  text: string;
  hex: string;
}

export const AVAILABLE_TEAM_COLORS: AvailableColorOption[] = [
  { id: 'red', name: 'Vermelho', emoji: '🔴', color: 'bg-red-500', border: 'border-red-400', lightBg: 'bg-red-500/10', text: 'text-red-500', hex: '#ef4444' },
  { id: 'blue', name: 'Azul', emoji: '🔵', color: 'bg-blue-500', border: 'border-blue-400', lightBg: 'bg-blue-500/10', text: 'text-blue-500', hex: '#3b82f6' },
  { id: 'green', name: 'Verde', emoji: '🟢', color: 'bg-green-500', border: 'border-green-400', lightBg: 'bg-green-500/10', text: 'text-green-500', hex: '#22c55e' },
  { id: 'yellow', name: 'Amarelo', emoji: '🟡', color: 'bg-yellow-500', border: 'border-yellow-400', lightBg: 'bg-yellow-500/10', text: 'text-yellow-500', hex: '#eab308' },
  { id: 'purple', name: 'Roxo', emoji: '🟣', color: 'bg-purple-500', border: 'border-purple-400', lightBg: 'bg-purple-500/10', text: 'text-purple-500', hex: '#a855f7' },
  { id: 'orange', name: 'Laranja', emoji: '🟠', color: 'bg-orange-500', border: 'border-orange-400', lightBg: 'bg-orange-500/10', text: 'text-orange-500', hex: '#f97316' },
  { id: 'pink', name: 'Rosa', emoji: '🩷', color: 'bg-pink-500', border: 'border-pink-400', lightBg: 'bg-pink-500/10', text: 'text-pink-500', hex: '#ec4899' },
  { id: 'cyan', name: 'Ciano', emoji: '🩵', color: 'bg-cyan-500', border: 'border-cyan-400', lightBg: 'bg-cyan-500/10', text: 'text-cyan-500', hex: '#06b6d4' },
  { id: 'indigo', name: 'Índigo', emoji: '💜', color: 'bg-indigo-500', border: 'border-indigo-400', lightBg: 'bg-indigo-500/10', text: 'text-indigo-500', hex: '#6366f1' },
  { id: 'teal', name: 'Teal', emoji: '💚', color: 'bg-teal-500', border: 'border-teal-400', lightBg: 'bg-teal-500/10', text: 'text-teal-500', hex: '#14b8a6' },
  { id: 'black', name: 'Preto / Cinza', emoji: '⚫', color: 'bg-slate-700', border: 'border-slate-500', lightBg: 'bg-slate-700/10', text: 'text-slate-300 dark:text-slate-200', hex: '#334155' },
  { id: 'white', name: 'Branco / Ouro', emoji: '⚪', color: 'bg-amber-400', border: 'border-amber-300', lightBg: 'bg-amber-400/10', text: 'text-amber-500 dark:text-amber-400', hex: '#fbbf24' },
];

export const DEFAULT_TEAM_CONFIGS = [
  { name: 'Time A', colorId: 'red', emoji: '🔴' },
  { name: 'Time B', colorId: 'blue', emoji: '🔵' },
  { name: 'Time C', colorId: 'green', emoji: '🟢' },
  { name: 'Time D', colorId: 'yellow', emoji: '🟡' },
  { name: 'Time E', colorId: 'purple', emoji: '🟣' },
  { name: 'Time F', colorId: 'orange', emoji: '🟠' },
  { name: 'Time G', colorId: 'pink', emoji: '🩷' },
  { name: 'Time H', colorId: 'cyan', emoji: '🩵' },
  { name: 'Time I', colorId: 'indigo', emoji: '💜' },
  { name: 'Time J', colorId: 'teal', emoji: '💚' },
];

export interface CustomTeamItem {
  name: string;
  colorId: string;
  emoji?: string;
  badge_url?: string | null;
}

export type CustomTeamsConfig = Record<number | string, CustomTeamItem>;

export interface TeamVisualInfo {
  teamNumber: number;
  name: string;
  emoji: string;
  badge_url?: string | null;
  badgeUrl?: string | null;
  color: string;
  border: string;
  lightBg: string;
  text: string;
  hex: string;
  colorId: string;
}

/**
 * Valida se um arquivo é estritamente uma imagem PNG legítima através do cabeçalho binário (magic bytes).
 * Assinatura PNG padrão: 89 50 4E 47 0D 0A 1A 0A
 */
export async function validatePngFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' };
  }

  // 1. Validar extensão e MIME type
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.png') || (file.type && file.type !== 'image/png')) {
    return { valid: false, error: 'Apenas arquivos no formato PNG (.png) são aceitos.' };
  }

  // 2. Validar tamanho máximo (máximo 5MB para emblemas)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'O emblema deve ter no máximo 5MB.' };
  }

  // 3. Validar assinatura binária do cabeçalho (Magic Bytes)
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    if (bytes.length < 8) {
      return { valid: false, error: 'Arquivo PNG corrompido ou inválido.' };
    }

    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== pngHeader[i]) {
        return {
          valid: false,
          error: 'O arquivo selecionado não é um arquivo PNG legítimo ou foi renomeado.',
        };
      }
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Erro ao validar a integridade do arquivo PNG.' };
  }
}

/**
 * Retorna as informações visuais (nome, cor, emoji, emblema, classes Tailwind) de um time específico de uma partida.
 */
export function getTeamInfo(match: Match | null | undefined, teamNumber: number): TeamVisualInfo {
  const defaultIdx = (teamNumber - 1) % DEFAULT_TEAM_CONFIGS.length;
  const defaultConf = DEFAULT_TEAM_CONFIGS[defaultIdx] || { name: `Time ${teamNumber}`, colorId: 'blue', emoji: '⚽' };

  const customConf =
    match?.teams_custom_config ? (match.teams_custom_config as CustomTeamsConfig)[teamNumber] : undefined;

  const teamName = customConf?.name?.trim() || defaultConf.name;
  const colorId = customConf?.colorId || defaultConf.colorId;

  const colorOpt =
    AVAILABLE_TEAM_COLORS.find((c) => c.id === colorId) ||
    AVAILABLE_TEAM_COLORS[defaultIdx % AVAILABLE_TEAM_COLORS.length] ||
    AVAILABLE_TEAM_COLORS[0];

  const teamEmoji = customConf?.emoji || colorOpt.emoji || defaultConf.emoji || '⚽';
  const badgeUrl = customConf?.badge_url || null;

  return {
    teamNumber,
    name: teamName,
    emoji: teamEmoji,
    badge_url: badgeUrl,
    badgeUrl: badgeUrl,
    color: colorOpt.color,
    border: colorOpt.border,
    lightBg: colorOpt.lightBg,
    text: colorOpt.text,
    hex: colorOpt.hex,
    colorId: colorOpt.id,
  };
}

/**
 * Retorna a lista completa de informações visuais de todos os times da partida.
 */
export function getAllTeamsInfo(match: Match | null | undefined): TeamVisualInfo[] {
  if (!match || !match.num_times) return [];

  const list: TeamVisualInfo[] = [];
  for (let t = 1; t <= match.num_times; t++) {
    list.push(getTeamInfo(match, t));
  }
  return list;
}

