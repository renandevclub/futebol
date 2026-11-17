import { supabase } from '@/lib/supabase';
import { MatchParticipant, Profile } from '@/types/database';

export interface AddPlayerResult {
  success: boolean;
  message?: string;
  participant?: MatchParticipant | null;
  error?: string;
}

export interface AddMultiplePlayersResult {
  success: boolean;
  addedCount: number;
  existingCount: number;
  errors: string[];
}

export interface LeaguePlayerItem extends Profile {
  member_id?: string;
  role_in_league?: string;
  rating_in_league?: number | null;
}

/**
 * Retorna o nome de exibição de um participante, seja registrado ou avulso (guest).
 */
export function getParticipantDisplayName(p: MatchParticipant): string {
  return p.user?.nome || p.guest_name || 'Jogador Sem Nome';
}

/**
 * Retorna o apelido se houver, ou nada.
 */
export function getParticipantNickname(p: MatchParticipant): string | null {
  return p.user?.apelido || null;
}

/**
 * Verifica se um participante é um jogador avulso (guest), sem conta no sistema.
 */
export function isGuestParticipant(p: MatchParticipant): boolean {
  return !p.user_id && !!p.guest_name;
}

/**
 * Busca jogadores já existentes vinculados à liga para autocompletar e sugestões rápidas
 */
export async function getLeagueExistingPlayers(leagueId: string): Promise<Profile[]> {
  if (!leagueId) return [];

  try {
    const { data: members, error } = await supabase
      .from('organization_members')
      .select('id, role, nivel_qualidade, user:user_id(*)')
      .eq('organization_id', leagueId);

    if (error || !members) return [];

    const profiles: Profile[] = members
      .map((m: any) => m.user)
      .filter((u: any): u is Profile => !!u && !!u.nome);

    // Ordenar alfabeticamente por nome
    return profiles.sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (err) {
    console.error('Erro ao buscar jogadores da liga:', err);
    return [];
  }
}

/**
 * Busca lista completa e detalhada de todos os jogadores da liga (com perfil, cargo na liga e rating)
 */
export async function getLeagueDetailedPlayers(leagueId: string): Promise<LeaguePlayerItem[]> {
  if (!leagueId) return [];

  try {
    const { data: members, error } = await supabase
      .from('organization_members')
      .select('id, role, nivel_qualidade, user:user_id(*)')
      .eq('organization_id', leagueId);

    if (error || !members) return [];

    const items: LeaguePlayerItem[] = members
      .filter((m: any) => m.user && m.user.nome)
      .map((m: any) => {
        const u = m.user as Profile;
        return {
          ...u,
          member_id: m.id,
          role_in_league: m.role || 'player',
          rating_in_league: m.nivel_qualidade ?? u.nivel_qualidade ?? null,
        };
      });

    // Ordenar por nome alfabético
    return items.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  } catch (err) {
    console.error('Erro ao buscar jogadores detalhados da liga:', err);
    return [];
  }
}

/**
 * Adiciona um membro cadastrado da liga diretamente à partida pelo seu user_id
 */
export async function addLeagueMemberToMatch({
  matchId,
  leagueId,
  userId,
  team,
}: {
  matchId: string;
  leagueId?: string | null;
  userId: string;
  team?: number | null;
}): Promise<AddPlayerResult> {
  if (!matchId || !userId) {
    return { success: false, error: 'Parâmetros inválidos.' };
  }

  try {
    // 1. Tentar executar via RPC segura
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_league_member_to_match', {
      p_match_id: matchId,
      p_user_id: userId,
      p_team: team ?? null,
    });

    if (!rpcError && rpcData?.success) {
      const { data: participantData } = await supabase
        .from('match_participants')
        .select('*, user:user_id(*)')
        .eq('id', rpcData.participant_id)
        .maybeSingle();

      return {
        success: true,
        message: rpcData.message || 'Membro da liga adicionado à partida!',
        participant: participantData as MatchParticipant,
      };
    }

    if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
      return { success: false, error: rpcError.message };
    }

    // 2. Fallback direto via Supabase Client
    // Verificar se já está na partida
    const { data: existingPart } = await supabase
      .from('match_participants')
      .select('*, user:user_id(*)')
      .eq('match_id', matchId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPart) {
      if (team !== undefined && team !== existingPart.team) {
        await supabase
          .from('match_participants')
          .update({ team })
          .eq('id', existingPart.id);
      }
      return {
        success: true,
        message: 'Jogador já estava na lista da partida!',
        participant: existingPart as MatchParticipant,
      };
    }

    // Se a partida tiver liga, garantir vínculo na organization_members
    if (leagueId) {
      await supabase
        .from('organization_members')
        .upsert(
          { organization_id: leagueId, user_id: userId, role: 'player' },
          { onConflict: 'organization_id,user_id' }
        );
    }

    // Inserir participante vinculado ao perfil
    const { data: insertedPart, error: partErr } = await supabase
      .from('match_participants')
      .insert({
        match_id: matchId,
        user_id: userId,
        guest_name: null,
        team: team ?? null,
        paid: false,
      })
      .select('*, user:user_id(*)')
      .single();

    if (partErr) {
      return { success: false, error: 'Erro ao adicionar membro à partida: ' + partErr.message };
    }

    return {
      success: true,
      message: 'Jogador adicionado à lista com sucesso!',
      participant: insertedPart as MatchParticipant,
    };
  } catch (err: any) {
    console.error('Erro ao adicionar membro da liga à partida:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao adicionar jogador.' };
  }
}

/**
 * Adiciona múltiplos membros cadastrados da liga de uma vez à partida
 */
export async function addMultipleLeagueMembersToMatch({
  matchId,
  leagueId,
  userIds,
  team,
}: {
  matchId: string;
  leagueId?: string | null;
  userIds: string[];
  team?: number | null;
}): Promise<AddMultiplePlayersResult> {
  const cleanIds = Array.from(new Set(userIds.filter(Boolean)));
  if (cleanIds.length === 0) {
    return { success: false, addedCount: 0, existingCount: 0, errors: ['Nenhum jogador selecionado.'] };
  }

  try {
    // 1. Tentar via RPC em lote
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_multiple_league_members_to_match', {
      p_match_id: matchId,
      p_user_ids: cleanIds,
      p_team: team ?? null,
    });

    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        addedCount: rpcData.added_count || 0,
        existingCount: rpcData.existing_count || 0,
        errors: [],
      };
    }
  } catch {
    // Seguir para o fallback
  }

  // Fallback: adicionar um a um
  let addedCount = 0;
  let existingCount = 0;
  const errors: string[] = [];

  for (const uid of cleanIds) {
    const res = await addLeagueMemberToMatch({ matchId, leagueId, userId: uid, team });
    if (res.success) {
      if (res.message?.includes('já estava')) {
        existingCount++;
      } else {
        addedCount++;
      }
    } else if (res.error) {
      errors.push(res.error);
    }
  }

  return {
    success: addedCount > 0 || existingCount > 0,
    addedCount,
    existingCount,
    errors,
  };
}

/**
 * Adiciona um jogador CONVIDADO (avulso, sem cadastro no app) diretamente à partida
 */
export async function addGuestPlayerToMatch({
  matchId,
  guestName,
  team,
}: {
  matchId: string;
  guestName: string;
  team?: number | null;
}): Promise<AddPlayerResult> {
  const cleanName = guestName.trim();
  if (!cleanName) {
    return { success: false, error: 'O nome do convidado é obrigatório.' };
  }

  try {
    // 1. Tentar via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_guest_player_to_match', {
      p_match_id: matchId,
      p_guest_name: cleanName,
      p_team: team ?? null,
    });

    if (!rpcError && rpcData?.success) {
      const { data: participantData } = await supabase
        .from('match_participants')
        .select('*')
        .eq('id', rpcData.participant_id)
        .maybeSingle();

      return {
        success: true,
        message: rpcData.message || `Convidado "${cleanName}" adicionado! ⚽`,
        participant: participantData as MatchParticipant,
      };
    }

    if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
      return { success: false, error: rpcError.message };
    }

    // 2. Fallback direto: verificar duplicidade de convidado
    const { data: existingGuest } = await supabase
      .from('match_participants')
      .select('*')
      .eq('match_id', matchId)
      .is('user_id', null)
      .ilike('guest_name', cleanName)
      .maybeSingle();

    if (existingGuest) {
      return {
        success: true,
        message: `Convidado "${cleanName}" já estava na lista da partida!`,
        participant: existingGuest as MatchParticipant,
      };
    }

    // Inserir com user_id: null e guest_name
    const { data: guestPart, error: guestErr } = await supabase
      .from('match_participants')
      .insert({
        match_id: matchId,
        user_id: null,
        guest_name: cleanName,
        team: team ?? null,
        paid: false,
      })
      .select('*')
      .single();

    if (guestErr) {
      return { success: false, error: 'Erro ao adicionar convidado: ' + guestErr.message };
    }

    return {
      success: true,
      message: `Convidado "${cleanName}" adicionado à partida! ⚽`,
      participant: guestPart as MatchParticipant,
    };
  } catch (err: any) {
    console.error('Erro ao adicionar convidado:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao cadastrar convidado.' };
  }
}

/**
 * Adiciona múltiplos jogadores convidados de uma vez à partida
 */
export async function addMultipleGuestPlayersToMatch({
  matchId,
  guestNames,
  team,
}: {
  matchId: string;
  guestNames: string[];
  team?: number | null;
}): Promise<AddMultiplePlayersResult> {
  const cleanList = guestNames
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  let addedCount = 0;
  let existingCount = 0;
  const errors: string[] = [];

  for (const name of cleanList) {
    const res = await addGuestPlayerToMatch({ matchId, guestName: name, team });
    if (res.success) {
      if (res.message?.includes('já estava')) {
        existingCount++;
      } else {
        addedCount++;
      }
    } else if (res.error) {
      errors.push(`${name}: ${res.error}`);
    }
  }

  return {
    success: addedCount > 0 || existingCount > 0,
    addedCount,
    existingCount,
    errors,
  };
}

/**
 * Alterna o status de pagamento de um participante (Pago / Pendente)
 */
export async function toggleParticipantPaidStatus({
  matchId,
  participantId,
  newPaid,
}: {
  matchId: string;
  participantId: string;
  newPaid: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_toggle_participant_paid', {
      p_match_id: matchId,
      p_participant_id: participantId,
      p_paid: newPaid,
    });

    if (!rpcError && rpcData?.success) {
      return { success: true };
    }

    // Fallback direto
    const { error } = await supabase
      .from('match_participants')
      .update({
        paid: newPaid,
        payment_status: newPaid ? 'approved' : 'pending',
        paid_at: newPaid ? new Date().toISOString() : null,
      })
      .eq('id', participantId)
      .eq('match_id', matchId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao alternar pagamento:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao alterar status de pagamento.' };
  }
}

/**
 * Adiciona um jogador por nome na lista da partida (legado / inteligente).
 * - Se encontrar um perfil existente (por whatsapp ou nome na liga), vincula normalmente.
 * - Se não encontrar, adiciona como jogador convidado (avulso) SEM criar perfil fantasma.
 */
export async function addPlayerToMatch({
  matchId,
  leagueId,
  playerName,
  whatsapp,
  team,
}: {
  matchId: string;
  leagueId?: string | null;
  playerName: string;
  whatsapp?: string | null;
  team?: number | null;
}): Promise<AddPlayerResult> {
  const cleanName = playerName.trim();
  if (!cleanName) {
    return { success: false, error: 'O nome do jogador é obrigatório.' };
  }

  try {
    const cleanPhone = whatsapp?.trim() ? whatsapp.trim() : null;

    // 1. Tentar executar via RPC segura no banco
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_match_player', {
      p_match_id: matchId,
      p_player_name: cleanName,
      p_whatsapp: cleanPhone,
      p_team: team ?? null,
    });

    if (!rpcError && rpcData?.success) {
      const { data: participantData } = await supabase
        .from('match_participants')
        .select('*, user:user_id(*)')
        .eq('id', rpcData.participant_id)
        .maybeSingle();

      return {
        success: true,
        message: rpcData.message || 'Jogador adicionado à lista!',
        participant: participantData as MatchParticipant,
      };
    }

    // 2. Fallback resiliente — NUNCA cria perfil fantasma
    let targetUserId: string | null = null;

    if (cleanPhone) {
      const { data: byPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp', cleanPhone)
        .maybeSingle();
      if (byPhone) targetUserId = byPhone.id;
    }

    if (!targetUserId && leagueId) {
      const { data: byName } = await supabase
        .from('organization_members')
        .select('user_id, user:user_id(nome)')
        .eq('organization_id', leagueId);

      const foundMember = byName?.find((m: any) => m.user?.nome?.toLowerCase() === cleanName.toLowerCase());
      if (foundMember) targetUserId = foundMember.user_id;
    }

    // Se encontrou um perfil existente, vincular normalmente
    if (targetUserId) {
      return addLeagueMemberToMatch({ matchId, leagueId, userId: targetUserId, team });
    }

    // NÃO ENCONTROU perfil — adicionar como CONVIDADO (avulso) sem criar profile
    return addGuestPlayerToMatch({ matchId, guestName: cleanName, team });
  } catch (err: any) {
    console.error('Exceção ao adicionar jogador:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao cadastrar jogador.' };
  }
}

/**
 * Adiciona múltiplos jogadores de uma vez na partida
 */
export async function addMultiplePlayersToMatch({
  matchId,
  leagueId,
  playerNames,
}: {
  matchId: string;
  leagueId?: string | null;
  playerNames: string[];
}): Promise<AddMultiplePlayersResult> {
  const cleanList = playerNames
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  let addedCount = 0;
  let existingCount = 0;
  const errors: string[] = [];

  for (const name of cleanList) {
    const res = await addPlayerToMatch({
      matchId,
      leagueId,
      playerName: name,
    });

    if (res.success) {
      if (res.message?.includes('já estava')) {
        existingCount++;
      } else {
        addedCount++;
      }
    } else if (res.error) {
      errors.push(`${name}: ${res.error}`);
    }
  }

  return {
    success: addedCount > 0 || existingCount > 0,
    addedCount,
    existingCount,
    errors,
  };
}

/**
 * Atualiza o nome de um jogador (registrado ou avulso)
 */
export async function updatePlayerName({
  matchId,
  participantId,
  profileId,
  newName,
  isGuest,
}: {
  matchId: string;
  participantId: string;
  profileId?: string | null;
  newName: string;
  isGuest?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const cleanName = newName.trim();
  if (!cleanName) {
    return { success: false, error: 'O nome não pode ficar vazio.' };
  }

  try {
    // 1. Tentar via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_match_player_name', {
      p_match_id: matchId,
      p_user_id: profileId || null,
      p_new_name: cleanName,
      p_participant_id: participantId,
    });

    if (!rpcError && rpcData?.success) {
      return { success: true };
    }

    // 2. Fallback direto
    if (isGuest || !profileId) {
      const { error } = await supabase
        .from('match_participants')
        .update({ guest_name: cleanName })
        .eq('id', participantId)
        .eq('match_id', matchId);

      if (error) {
        return { success: false, error: 'Erro ao atualizar nome do jogador convidado: ' + error.message };
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ nome: cleanName })
        .eq('id', profileId);

      if (error) {
        return { success: false, error: 'Erro ao atualizar nome: ' + error.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao atualizar nome do jogador:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao salvar alterações.' };
  }
}

/**
 * Remove um jogador da lista da partida
 */
export async function removePlayerFromMatch({
  matchId,
  participantId,
}: {
  matchId: string;
  participantId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Tentar via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_remove_match_player', {
      p_match_id: matchId,
      p_participant_id: participantId,
    });

    if (!rpcError && rpcData?.success) {
      return { success: true };
    }

    // 2. Fallback direto
    const { error } = await supabase
      .from('match_participants')
      .delete()
      .eq('id', participantId)
      .eq('match_id', matchId);

    if (error) {
      return { success: false, error: 'Erro ao remover participante: ' + error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao remover jogador:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao remover jogador.' };
  }
}
