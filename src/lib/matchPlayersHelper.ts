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

/**
 * Retorna o nome de exibição de um participante, seja registrado ou avulso (guest).
 */
export function getParticipantDisplayName(p: MatchParticipant): string {
  return p.user?.nome || p.guest_name || 'Jogador Sem Nome';
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
      .select('user:user_id(*)')
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
 * Adiciona um jogador por nome na lista da partida.
 * - Se encontrar um perfil existente (por whatsapp ou nome na liga), vincula normalmente.
 * - Se não encontrar, adiciona como jogador avulso (guest) SEM criar perfil.
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
      // Buscar dados completos do participante inserido
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

    // Buscar se já existe alguém com esse whatsapp
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
      // Verificar se já está na partida
      const { data: existingPart } = await supabase
        .from('match_participants')
        .select('*, user:user_id(*)')
        .eq('match_id', matchId)
        .eq('user_id', targetUserId)
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

      // Inserir participante vinculado a perfil existente
      const { data: insertedPart, error: partErr } = await supabase
        .from('match_participants')
        .insert({
          match_id: matchId,
          user_id: targetUserId,
          team: team ?? null,
          paid: false,
        })
        .select('*, user:user_id(*)')
        .single();

      if (partErr) {
        return { success: false, error: 'Erro ao inscrever jogador na partida: ' + partErr.message };
      }

      return {
        success: true,
        message: 'Jogador adicionado à lista com sucesso!',
        participant: insertedPart as MatchParticipant,
      };
    }

    // NÃO ENCONTROU perfil — adicionar como GUEST (avulso) sem criar profile
    // Verificar se já existe guest com esse nome na partida
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
        message: 'Jogador avulso já estava na lista da partida!',
        participant: existingGuest as MatchParticipant,
      };
    }

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
      return { success: false, error: 'Erro ao adicionar jogador avulso: ' + guestErr.message };
    }

    return {
      success: true,
      message: 'Jogador avulso adicionado à partida! ⚽',
      participant: guestPart as MatchParticipant,
    };
  } catch (err: any) {
    console.error('Exceção ao adicionar jogador:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao cadastrar jogador.' };
  }
}

/**
 * Adiciona múltiplos jogadores de uma vez na partida (a partir de lista ou nomes separados por vírgula/quebra de linha)
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
    // 1. Tentar via RPC (suporta ambos os tipos)
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
      // Jogador avulso: atualizar guest_name no match_participants
      const { error } = await supabase
        .from('match_participants')
        .update({ guest_name: cleanName })
        .eq('id', participantId)
        .eq('match_id', matchId);

      if (error) {
        return { success: false, error: 'Erro ao atualizar nome do jogador avulso: ' + error.message };
      }
    } else {
      // Jogador registrado: atualizar profiles
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
