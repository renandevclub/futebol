import { Profile, League, Match } from '@/types/database';

/**
 * 🔐 MÓDULO CENTRAL DE AUTORIZAÇÃO E PERMISSÕES POR LIGA (RLS SPORTS)
 * 
 * Regra Principal:
 * - Super Administrador (role = 'super_admin') possui acesso global a todas as ligas.
 * - Administrador de Liga só pode administrar ligas onde é criador (owner_id) ou possui
 *   permissão na tabela de membros (organization_members com role 'owner' ou 'admin').
 * - Player (Jogador) não possui permissão administrativa em nenhuma liga.
 */

/**
 * Verifica se o usuário atual é Super Administrador do sistema
 */
export function isUserSuperAdmin(user: Profile | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'super_admin';
}

/**
 * Verifica se o usuário possui permissão administrativa em uma Liga específica
 * 
 * @param user Perfil do usuário atual
 * @param leagueId ID da liga a ser verificada
 * @param userAdminLeagueIds Lista de IDs de ligas onde o usuário é admin/owner (vindo do LeagueContext)
 * @param league Objeto opcional da liga para checar owner_id diretamente
 */
export function canManageLeague(
  user: Profile | null | undefined,
  leagueId: string | null | undefined,
  userAdminLeagueIds: string[] = [],
  league?: League | null
): boolean {
  if (!user) return false;

  // 1. Super Administrador possui acesso irrestrito global
  if (user.role === 'super_admin') {
    return true;
  }

  if (!leagueId && !league?.id) {
    return false;
  }

  const targetId = leagueId || league?.id;

  // 2. É o criador/owner direto da liga
  if (league && league.owner_id === user.id) {
    return true;
  }

  // 3. Possui permissão de admin/owner registrada no array de vínculos
  if (targetId && userAdminLeagueIds.includes(targetId)) {
    return true;
  }

  return false;
}

/**
 * Verifica se o usuário possui permissão administrativa para uma Partida específica
 * 
 * @param user Perfil do usuário atual
 * @param match Objeto da partida a ser verificada
 * @param userAdminLeagueIds Lista de IDs de ligas onde o usuário é admin/owner
 * @param league Objeto opcional da liga vinculada
 */
export function canManageMatch(
  user: Profile | null | undefined,
  match: Match | null | undefined,
  userAdminLeagueIds: string[] = [],
  league?: League | null
): boolean {
  if (!user || !match) return false;

  // 1. Super Admin pode administrar qualquer partida
  if (user.role === 'super_admin') {
    return true;
  }

  const matchLeagueId = match.organization_id;

  // Se a partida não tiver liga associada, somente Super Admin gerencia
  if (!matchLeagueId) {
    return isUserSuperAdmin(user);
  }

  // 2. Se a partida já trouxe o objeto da organização embutido com owner_id
  if (match.organization && match.organization.owner_id === user.id) {
    return true;
  }

  // 3. Checagem via canManageLeague
  return canManageLeague(user, matchLeagueId, userAdminLeagueIds, league);
}

/**
 * Retorna a lista filtrada de ligas que o usuário tem permissão para administrar
 */
export function getManagedLeagues(
  user: Profile | null | undefined,
  leagues: League[] = [],
  userAdminLeagueIds: string[] = []
): League[] {
  if (!user) return [];
  if (user.role === 'super_admin') return leagues;

  return leagues.filter(
    (l) => l.owner_id === user.id || userAdminLeagueIds.includes(l.id)
  );
}

/**
 * Retorna os IDs das ligas administradas pelo usuário
 */
export function getManagedLeagueIds(
  user: Profile | null | undefined,
  leagues: League[] = [],
  userAdminLeagueIds: string[] = []
): string[] {
  if (!user) return [];
  if (user.role === 'super_admin') return leagues.map((l) => l.id);

  const managed = getManagedLeagues(user, leagues, userAdminLeagueIds);
  return managed.map((l) => l.id);
}
