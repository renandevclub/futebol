import { supabase } from './supabase';
import {
  Tournament,
  TournamentTeam,
  TournamentTeamPlayer,
  TournamentMatch,
  TournamentMatchEvent,
  TournamentStandingRow,
  TournamentFinancialSummary,
  TournamentFormat,
  TournamentStatus,
  TournamentTeamRegistrationStatus,
  TournamentTeamPaymentStatus,
  TournamentMatchStatus,
  TournamentMatchEventType,
  SportType,
  Profile,
} from '@/types/database';
import { toast } from 'sonner';

// ==============================================================================
// 1. FORMATAÇÃO E CÁLCULOS FINANCEIROS
// ==============================================================================

export function formatTournamentStatus(status: TournamentStatus) {
  switch (status) {
    case 'registration_open':
      return { label: 'Inscrições Abertas', color: 'emerald', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' };
    case 'registration_closed':
      return { label: 'Inscrições Encerradas', color: 'amber', bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' };
    case 'in_progress':
      return { label: 'Em Andamento', color: 'blue', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' };
    case 'finished':
      return { label: 'Finalizado', color: 'purple', bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30' };
    default:
      return { label: 'Desconhecido', color: 'slate', bg: 'bg-slate-500/10', text: 'text-slate-500', border: 'border-slate-500/30' };
  }
}

export function formatTournamentFormat(format: TournamentFormat) {
  switch (format) {
    case 'round_robin':
      return { label: 'Pontos Corridos', icon: '📊', description: 'Todos contra todos em classificação única' };
    case 'knockout':
      return { label: 'Mata-Mata', icon: '⚔️', description: 'Eliminatória direta com chaveamento' };
    default:
      return { label: format, icon: '🏆', description: '' };
  }
}

/**
 * Calcula os totais financeiros e a premiação do campeonato
 */
export function calculateTournamentFinancialSummary(
  tournament: Tournament,
  teams: TournamentTeam[]
): TournamentFinancialSummary {
  const approvedTeams = teams.filter((t) => t.registration_status === 'approved');
  const count = approvedTeams.length;
  const entryFee = Number(tournament.entry_fee) || 0;
  const societyCost = Number(tournament.society_cost) || 0;

  const totalCollected = count * entryFee;
  const prizePool = Math.max(0, totalCollected - societyCost);

  const paidAmount = approvedTeams
    .filter((t) => t.payment_status === 'paid')
    .reduce((acc, t) => acc + (Number(t.payment_amount) || entryFee), 0);

  const pendingAmount = approvedTeams
    .filter((t) => t.payment_status === 'pending')
    .reduce((acc, _) => acc + entryFee, 0);

  const netBalance = paidAmount - societyCost;

  return {
    teams_count: count,
    entry_fee_per_team: entryFee,
    total_collected: totalCollected,
    society_cost: societyCost,
    prize_pool: prizePool,
    paid_amount: paidAmount,
    pending_amount: pendingAmount,
    net_balance: netBalance,
  };
}

// ==============================================================================
// 2. CRUD DE TORNEIOS
// ==============================================================================

export interface CreateTournamentParams {
  league_id: string;
  name: string;
  description?: string;
  sport_type?: SportType;
  start_date?: string;
  end_date?: string;
  max_teams: number;
  players_per_team: number;
  format: TournamentFormat;
  entry_fee: number;
  society_cost: number;
  rules?: string;
  created_by?: string;
}

export async function fetchLeagueTournaments(leagueId: string): Promise<Tournament[]> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        champion_team:tournament_teams!fk_tournaments_champion(id, name, badge_url, color),
        runner_up_team:tournament_teams!fk_tournaments_runner_up(id, name, badge_url, color),
        teams:tournament_teams!tournament_teams_tournament_id_fkey(id, registration_status, payment_status)
      `)
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar torneios:', error);
      return [];
    }

    return (data || []).map((t: any) => ({
      ...t,
      teams_count: (t.teams || []).filter((team: any) => team.registration_status === 'approved').length,
    })) as Tournament[];
  } catch (err) {
    console.error('Exceção ao buscar torneios:', err);
    return [];
  }
}

export async function fetchTournamentDetails(tournamentId: string): Promise<Tournament | null> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select(`
        *,
        league:league_id(*),
        champion_team:tournament_teams!fk_tournaments_champion(*),
        runner_up_team:tournament_teams!fk_tournaments_runner_up(*)
      `)
      .eq('id', tournamentId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar detalhes do torneio:', error);
      return null;
    }

    return (data as Tournament) || null;
  } catch (err) {
    console.error('Exceção em fetchTournamentDetails:', err);
    return null;
  }
}

export async function createTournament(params: CreateTournamentParams): Promise<{ success: boolean; tournament?: Tournament; error?: string }> {
  try {
    if (!params.name.trim()) {
      return { success: false, error: 'O nome do campeonato é obrigatório.' };
    }
    if (params.max_teams < 2) {
      return { success: false, error: 'O número mínimo de equipes é 2.' };
    }
    if (params.players_per_team < 1) {
      return { success: false, error: 'O número de jogadores por equipe deve ser de no mínimo 1.' };
    }

    const insertPayload = {
      league_id: params.league_id,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      sport_type: params.sport_type || 'futebol',
      start_date: params.start_date || null,
      end_date: params.end_date || null,
      max_teams: Number(params.max_teams),
      players_per_team: Number(params.players_per_team),
      format: params.format,
      entry_fee: Number(params.entry_fee) || 0,
      society_cost: Number(params.society_cost) || 0,
      rules: params.rules?.trim() || null,
      status: 'registration_open' as TournamentStatus,
      created_by: params.created_by || null,
    };

    const { data, error } = await supabase
      .from('tournaments')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar torneio:', error);
      return { success: false, error: error.message };
    }

    toast.success('Campeonato criado com sucesso! 🏆');
    return { success: true, tournament: data as Tournament };
  } catch (err: any) {
    console.error('Exceção ao criar torneio:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function updateTournament(id: string, updates: Partial<Tournament>): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    // Remover relações aninhadas se existirem
    delete payload.league;
    delete payload.champion_team;
    delete payload.runner_up_team;
    delete payload.teams;
    delete payload.teams_count;
    delete payload.matches_count;

    const { error } = await supabase.from('tournaments').update(payload).eq('id', id);

    if (error) {
      console.error('Erro ao atualizar campeonato:', error);
      return { success: false, error: error.message };
    }

    toast.success('Campeonato atualizado!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function deleteTournament(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir campeonato:', error);
      return { success: false, error: error.message };
    }
    toast.success('Campeonato excluído.');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function declareTournamentChampion(
  tournamentId: string,
  championTeamId: string,
  runnerUpTeamId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tournaments')
      .update({
        champion_team_id: championTeamId,
        runner_up_team_id: runnerUpTeamId || null,
        status: 'finished',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tournamentId);

    if (error) {
      console.error('Erro ao declarar campeão:', error);
      return { success: false, error: error.message };
    }

    toast.success('Campeão declarado com honras e sucesso! 🏆✨');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

// ==============================================================================
// 3. GESTÃO DE TIMES E INSCRIÇÕES
// ==============================================================================

export async function fetchTournamentTeams(tournamentId: string): Promise<TournamentTeam[]> {
  try {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select(`
        *,
        coach:profiles!tournament_teams_coach_id_fkey(*),
        players:tournament_team_players(id, user_id, number, position, is_captain, user:user_id(*))
      `)
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar times do torneio:', error);
      return [];
    }

    return (data || []).map((team: any) => ({
      ...team,
      players_count: (team.players || []).length,
    })) as TournamentTeam[];
  } catch (err) {
    console.error('Exceção ao buscar times:', err);
    return [];
  }
}

export interface RegisterTeamParams {
  tournament_id: string;
  league_id: string;
  name: string;
  badge_url?: string | null;
  color?: string;
  coach_id: string;
  coach_profile?: Profile;
}

export async function registerTeamInTournament(params: RegisterTeamParams): Promise<{ success: boolean; team?: TournamentTeam; error?: string }> {
  try {
    if (!params.name.trim()) {
      return { success: false, error: 'O nome da equipe é obrigatório.' };
    }

    // 1. Verificar se o campeonato ainda aceita inscrições
    const { data: tournament, error: tError } = await supabase
      .from('tournaments')
      .select('status, max_teams, entry_fee')
      .eq('id', params.tournament_id)
      .single();

    if (tError || !tournament) {
      return { success: false, error: 'Campeonato não encontrado.' };
    }

    if (tournament.status !== 'registration_open') {
      return { success: false, error: 'As inscrições para este campeonato estão encerradas ou em andamento.' };
    }

    // 2. Verificar quantidade de times já inscritos/aprovados
    const { count: currentTeamsCount } = await supabase
      .from('tournament_teams')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', params.tournament_id)
      .in('registration_status', ['pending', 'approved']);

    if (currentTeamsCount && currentTeamsCount >= tournament.max_teams) {
      return { success: false, error: `O limite máximo de ${tournament.max_teams} equipes já foi atingido.` };
    }

    // 3. Cadastrar equipe com coach_id (técnico oficial)
    const { data: newTeam, error: teamError } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: params.tournament_id,
        league_id: params.league_id,
        name: params.name.trim(),
        badge_url: params.badge_url || null,
        color: params.color || 'blue',
        coach_id: params.coach_id,
        registration_status: 'pending',
        payment_status: 'pending',
        payment_amount: tournament.entry_fee || 0,
      })
      .select('*')
      .single();

    if (teamError) {
      console.error('Erro ao registrar time:', teamError);
      return { success: false, error: teamError.message };
    }

    // 4. Adicionar automaticamente o técnico como capitão/jogador inicial do elenco
    await supabase.from('tournament_team_players').insert({
      tournament_id: params.tournament_id,
      tournament_team_id: newTeam.id,
      user_id: params.coach_id,
      is_captain: true,
      position: 'Técnico / Jogador',
    });

    toast.success(`Equipe "${newTeam.name}" inscrita! Aguardando aprovação do administrador.`);
    return { success: true, team: newTeam as TournamentTeam };
  } catch (err: any) {
    console.error('Exceção ao registrar equipe:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function approveTournamentTeam(teamId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tournament_teams')
      .update({
        registration_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: adminId,
      })
      .eq('id', teamId);

    if (error) {
      return { success: false, error: error.message };
    }

    toast.success('Equipe aprovada no campeonato!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function rejectTournamentTeam(teamId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tournament_teams')
      .update({
        registration_status: 'rejected',
        rejection_reason: reason || null,
      })
      .eq('id', teamId);

    if (error) {
      return { success: false, error: error.message };
    }

    toast.info('Inscrição da equipe foi recusada.');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function cancelTournamentTeam(teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tournament_teams')
      .update({
        registration_status: 'cancelled',
      })
      .eq('id', teamId);

    if (error) {
      return { success: false, error: error.message };
    }

    toast.info('Inscrição cancelada.');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function updateTeamPaymentStatus(
  teamId: string,
  paymentStatus: TournamentTeamPaymentStatus,
  amount?: number,
  proofUrl?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, any> = {
      payment_status: paymentStatus,
    };
    if (amount !== undefined) payload.payment_amount = Number(amount);
    if (proofUrl !== undefined) payload.payment_proof_url = proofUrl;
    if (notes !== undefined) payload.payment_notes = notes;

    const { error } = await supabase
      .from('tournament_teams')
      .update(payload)
      .eq('id', teamId);

    if (error) {
      return { success: false, error: error.message };
    }

    toast.success(`Status de pagamento atualizado: ${paymentStatus === 'paid' ? 'Pago ✅' : paymentStatus}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Permite ao Super Admin ou Administrador da Liga inscrever qualquer equipe manualmente
 */
export async function createTeamManuallyByAdmin(params: {
  tournament_id: string;
  league_id: string;
  name: string;
  badge_url?: string | null;
  color?: string;
  coach_id: string;
  registration_status?: TournamentTeamRegistrationStatus;
  payment_status?: TournamentTeamPaymentStatus;
}): Promise<{ success: boolean; team?: TournamentTeam; error?: string }> {
  try {
    if (!params.name?.trim()) {
      return { success: false, error: 'O nome da equipe é obrigatório.' };
    }

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('entry_fee')
      .eq('id', params.tournament_id)
      .single();

    const regStatus = params.registration_status || 'approved';
    const payStatus = params.payment_status || 'paid';

    const { data: newTeam, error: teamError } = await supabase
      .from('tournament_teams')
      .insert({
        tournament_id: params.tournament_id,
        league_id: params.league_id,
        name: params.name.trim(),
        badge_url: params.badge_url || null,
        color: params.color || 'blue',
        coach_id: params.coach_id,
        registration_status: regStatus,
        payment_status: payStatus,
        payment_amount: tournament?.entry_fee || 0,
        approved_at: regStatus === 'approved' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (teamError) {
      console.error('Erro ao cadastrar equipe manualmente:', teamError);
      return { success: false, error: teamError.message };
    }

    // Auto-inscrever o técnico como capitão se ele for informado
    if (params.coach_id) {
      await supabase.from('tournament_team_players').insert({
        tournament_id: params.tournament_id,
        tournament_team_id: newTeam.id,
        user_id: params.coach_id,
        is_captain: true,
        position: 'Técnico / Capitão',
      });
    }

    toast.success(`Equipe "${newTeam.name}" cadastrada com sucesso! 🏆`);
    return { success: true, team: newTeam as TournamentTeam };
  } catch (err: any) {
    console.error('Exceção ao cadastrar equipe manualmente:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Atualiza os dados de uma equipe inscrita (Nome, Escudo, Cor, Técnico, Status)
 */
export async function updateTournamentTeam(
  teamId: string,
  params: Partial<TournamentTeam>
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, any> = { ...params };
    delete payload.coach;
    delete payload.players;
    delete payload.tournament;

    const { error } = await supabase
      .from('tournament_teams')
      .update(payload)
      .eq('id', teamId);

    if (error) {
      console.error('Erro ao atualizar equipe:', error);
      return { success: false, error: error.message };
    }

    toast.success('Equipe atualizada com sucesso!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Remove uma equipe do campeonato com limpeza de partidas vinculadas
 */
export async function deleteTournamentTeam(teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Limpar partidas onde esse time está vinculado
    await supabase
      .from('tournament_matches')
      .update({ home_team_id: null })
      .eq('home_team_id', teamId);

    await supabase
      .from('tournament_matches')
      .update({ away_team_id: null })
      .eq('away_team_id', teamId);

    await supabase
      .from('tournament_matches')
      .update({ winner_team_id: null })
      .eq('winner_team_id', teamId);

    // 2. Excluir o time
    const { error } = await supabase
      .from('tournament_teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      console.error('Erro ao excluir equipe:', error);
      return { success: false, error: error.message };
    }

    toast.success('Equipe removida do campeonato.');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

// ==============================================================================
// 4. GESTÃO DE JOGADORES E ELENCO
// ==============================================================================

export async function fetchLeagueMembersForSelection(leagueId: string): Promise<Profile[]> {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('user:user_id(*)')
      .eq('organization_id', leagueId);

    if (error) {
      console.error('Erro ao buscar membros da liga:', error);
      return [];
    }

    return (data || []).map((m: any) => m.user).filter(Boolean) as Profile[];
  } catch (err) {
    console.error('Exceção ao buscar membros:', err);
    return [];
  }
}

export async function fetchAllProfilesForSelection(query?: string): Promise<Profile[]> {
  try {
    let q = supabase
      .from('profiles')
      .select('*')
      .order('nome', { ascending: true })
      .limit(50);

    if (query && query.trim()) {
      q = q.or(`nome.ilike.%${query.trim()}%,apelido.ilike.%${query.trim()}%,whatsapp.ilike.%${query.trim()}%`);
    }

    const { data, error } = await q;
    if (error) {
      console.error('Erro ao buscar todos os perfis:', error);
      return [];
    }
    return (data || []) as Profile[];
  } catch (err) {
    console.error('Exceção ao buscar todos os perfis:', err);
    return [];
  }
}

export async function addPlayerToTeam(params: {
  tournament_id: string;
  tournament_team_id: string;
  user_id: string;
  number?: number | null;
  position?: string | null;
  is_captain?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obter regras do torneio
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('players_per_team, league_id')
      .eq('id', params.tournament_id)
      .single();

    if (tErr || !tournament) {
      return { success: false, error: 'Campeonato não encontrado.' };
    }

    // 2. Verificar se o jogador é membro da liga. Se não for, auto-inscrever para não travar o Super Admin/Admin
    const { data: memberCheck } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', tournament.league_id)
      .eq('user_id', params.user_id)
      .maybeSingle();

    if (!memberCheck) {
      await supabase
        .from('organization_members')
        .insert({
          organization_id: tournament.league_id,
          user_id: params.user_id,
          role: 'member',
        });
    }

    // 3. Verificar se o jogador já está em OUTRO time deste campeonato
    const { data: existingPlayer } = await supabase
      .from('tournament_team_players')
      .select('id, tournament_team:tournament_team_id(name)')
      .eq('tournament_id', params.tournament_id)
      .eq('user_id', params.user_id)
      .maybeSingle();

    if (existingPlayer) {
      const teamName = (existingPlayer as any).tournament_team?.name || 'outra equipe';
      return { success: false, error: `Este jogador já está inscrito na equipe "${teamName}" neste mesmo campeonato.` };
    }

    // 4. Verificar se a equipe já atingiu o limite de jogadores
    const { count: squadCount } = await supabase
      .from('tournament_team_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_team_id', params.tournament_team_id);

    if (squadCount && squadCount >= tournament.players_per_team) {
      return { success: false, error: `Limite máximo de ${tournament.players_per_team} jogadores atingido para este time.` };
    }

    // 5. Inserir jogador no elenco
    const { error: insertError } = await supabase
      .from('tournament_team_players')
      .insert({
        tournament_id: params.tournament_id,
        tournament_team_id: params.tournament_team_id,
        user_id: params.user_id,
        number: params.number || null,
        position: params.position?.trim() || null,
        is_captain: Boolean(params.is_captain),
      });

    if (insertError) {
      console.error('Erro ao adicionar jogador:', insertError);
      return { success: false, error: insertError.message };
    }

    toast.success('Jogador adicionado ao elenco com sucesso! ⚽');
    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao adicionar jogador:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function updatePlayerInTeam(
  teamPlayerId: string,
  params: {
    number?: number | null;
    position?: string | null;
    is_captain?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, any> = {};
    if (params.number !== undefined) payload.number = params.number;
    if (params.position !== undefined) payload.position = params.position?.trim() || null;
    if (params.is_captain !== undefined) payload.is_captain = params.is_captain;

    const { error } = await supabase
      .from('tournament_team_players')
      .update(payload)
      .eq('id', teamPlayerId);

    if (error) {
      console.error('Erro ao atualizar jogador no elenco:', error);
      return { success: false, error: error.message };
    }

    toast.success('Jogador atualizado!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

export async function removePlayerFromTeam(teamPlayerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tournament_team_players')
      .delete()
      .eq('id', teamPlayerId);

    if (error) {
      return { success: false, error: error.message };
    }

    toast.info('Jogador removido do elenco.');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

// ==============================================================================
// 5. PARTIDAS, CHAVEAMENTO E MATA-MATA
// ==============================================================================

export async function fetchTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
  try {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        home_team:tournament_teams!tournament_matches_home_team_id_fkey(*),
        away_team:tournament_teams!tournament_matches_away_team_id_fkey(*),
        winner_team:tournament_teams!tournament_matches_winner_team_id_fkey(*),
        events:tournament_match_events(*, player:profiles!tournament_match_events_player_id_fkey(*), assist_player:profiles!tournament_match_events_assist_player_id_fkey(*))
      `)
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar partidas do torneio:', error);
      return [];
    }

    return (data || []) as TournamentMatch[];
  } catch (err) {
    console.error('Exceção ao buscar partidas:', err);
    return [];
  }
}

/**
 * Gerador de confrontos de Pontos Corridos (Round-Robin com algoritmo Berger)
 */
export async function generateRoundRobinFixtures(
  tournamentId: string,
  leagueId: string,
  teams: TournamentTeam[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const approvedTeams = teams.filter((t) => t.registration_status === 'approved');
    if (approvedTeams.length < 2) {
      return { success: false, error: 'É necessário ter pelo menos 2 equipes aprovadas para gerar as rodadas.' };
    }

    const teamList = [...approvedTeams];
    // Se o número de times for ímpar, adiciona um time "fantasma" para folgas
    const hasGhost = teamList.length % 2 !== 0;
    if (hasGhost) {
      teamList.push({ id: '__bye__' } as any);
    }

    const numTeams = teamList.length;
    const totalRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;

    const matchesToInsert: any[] = [];

    // Algoritmo Round-Robin canônico
    for (let round = 0; round < totalRounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const homeIdx = (round + match) % (numTeams - 1);
        let awayIdx = (numTeams - 1 - match + round) % (numTeams - 1);

        if (match === 0) {
          awayIdx = numTeams - 1;
        }

        const home = teamList[homeIdx];
        const away = teamList[awayIdx];

        // Ignora partida com time fantasma (folga da rodada)
        if (home.id === '__bye__' || away.id === '__bye__') {
          continue;
        }

        matchesToInsert.push({
          tournament_id: tournamentId,
          league_id: leagueId,
          phase: `Rodada ${round + 1}`,
          round_number: round + 1,
          home_team_id: home.id,
          away_team_id: away.id,
          status: 'scheduled',
        });
      }
    }

    // Deletar partidas anteriores ainda não jogadas para regenerar
    await supabase
      .from('tournament_matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('status', 'scheduled');

    const { error: insertError } = await supabase
      .from('tournament_matches')
      .insert(matchesToInsert);

    if (insertError) {
      console.error('Erro ao salvar confrontos:', insertError);
      return { success: false, error: insertError.message };
    }

    // Atualizar status do campeonato para 'in_progress'
    await supabase
      .from('tournaments')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', tournamentId);

    toast.success(`${matchesToInsert.length} partidas geradas com sucesso para os Pontos Corridos! ⚽📊`);
    return { success: true, count: matchesToInsert.length };
  } catch (err: any) {
    console.error('Exceção ao gerar rodadas:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Gerador de Chaveamento de Mata-Mata (Knockout Bracket)
 * Suporta 2, 4, 8 ou 16 equipes
 */
export async function generateKnockoutFixtures(
  tournamentId: string,
  leagueId: string,
  teams: TournamentTeam[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const approvedTeams = teams.filter((t) => t.registration_status === 'approved');
    if (approvedTeams.length < 2) {
      return { success: false, error: 'É necessário ter pelo menos 2 equipes aprovadas para gerar o mata-mata.' };
    }

    // Deletar partidas anteriores não jogadas
    await supabase
      .from('tournament_matches')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('status', 'scheduled');

    // Determinar a fase inicial com base no número de equipes
    // 2 times: Final (1 jogo)
    // 3-4 times: Semifinal (2 jogos) + Final (1 jogo)
    // 5-8 times: Quartas de final (4 jogos) + Semifinal (2 jogos) + Final (1 jogo)
    // 9-16 times: Oitavas de final (8 jogos) + Quartas (4 jogos) + Semifinal (2 jogos) + Final (1 jogo)
    const count = approvedTeams.length;
    let phases: Array<{ name: string; round: number; matchCount: number }> = [];

    if (count <= 2) {
      phases = [{ name: 'Final', round: 1, matchCount: 1 }];
    } else if (count <= 4) {
      phases = [
        { name: 'Semifinal', round: 1, matchCount: 2 },
        { name: 'Final', round: 2, matchCount: 1 },
      ];
    } else if (count <= 8) {
      phases = [
        { name: 'Quartas de Final', round: 1, matchCount: 4 },
        { name: 'Semifinal', round: 2, matchCount: 2 },
        { name: 'Final', round: 3, matchCount: 1 },
      ];
    } else {
      phases = [
        { name: 'Oitavas de Final', round: 1, matchCount: 8 },
        { name: 'Quartas de Final', round: 2, matchCount: 4 },
        { name: 'Semifinal', round: 3, matchCount: 2 },
        { name: 'Final', round: 4, matchCount: 1 },
      ];
    }

    // Criar as partidas de trás para frente (Final primeiro para obter os IDs de next_match_id)
    let nextRoundMatches: Array<{ id: string; bracketIndex: number }> = [];
    const createdMatchesTotal: any[] = [];

    for (let p = phases.length - 1; p >= 0; p--) {
      const currentPhase = phases[p];
      const isFirstRound = p === 0;
      const currentRoundMatchesToInsert: any[] = [];

      for (let m = 0; m < currentPhase.matchCount; m++) {
        // Encontrar a partida da fase seguinte onde o vencedor deste jogo irá jogar
        let targetNextMatchId: string | null = null;
        if (nextRoundMatches.length > 0) {
          const parentIndex = Math.floor(m / 2);
          targetNextMatchId = nextRoundMatches[parentIndex]?.id || null;
        }

        // Se for a primeira rodada, preencher com os times cadastrados
        let homeTeamId: string | null = null;
        let awayTeamId: string | null = null;

        if (isFirstRound) {
          const homeIndex = m * 2;
          const awayIndex = m * 2 + 1;
          homeTeamId = approvedTeams[homeIndex]?.id || null;
          awayTeamId = approvedTeams[awayIndex]?.id || null;
        }

        currentRoundMatchesToInsert.push({
          tournament_id: tournamentId,
          league_id: leagueId,
          phase: currentPhase.name,
          round_number: currentPhase.round,
          bracket_match_number: m + 1,
          next_match_id: targetNextMatchId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          status: 'scheduled',
        });
      }

      const { data: inserted, error: insErr } = await supabase
        .from('tournament_matches')
        .insert(currentRoundMatchesToInsert)
        .select('id, bracket_match_number');

      if (insErr) {
        console.error('Erro ao inserir chaveamento:', insErr);
        return { success: false, error: insErr.message };
      }

      createdMatchesTotal.push(...(inserted || []));
      nextRoundMatches = (inserted || []).map((im, idx) => ({
        id: im.id,
        bracketIndex: idx,
      }));
    }

    // Atualizar status do torneio
    await supabase
      .from('tournaments')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', tournamentId);

    toast.success('Chaveamento de Mata-Mata gerado com sucesso! ⚔️🏆');
    return { success: true, count: createdMatchesTotal.length };
  } catch (err: any) {
    console.error('Exceção ao gerar chaveamento:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Salva o resultado de uma partida e avança o vencedor automaticamente no chaveamento
 */
export async function saveMatchResult(params: {
  match_id: string;
  home_score: number;
  away_score: number;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
  status?: TournamentMatchStatus;
  notes?: string;
  events?: Array<{
    team_id: string;
    player_id?: string;
    assist_player_id?: string;
    event_type: TournamentMatchEventType;
    minute?: number;
  }>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Buscar a partida para verificar dados e chaveamento
    const { data: currentMatch, error: mErr } = await supabase
      .from('tournament_matches')
      .select('*, tournament:tournament_id(format, status)')
      .eq('id', params.match_id)
      .single();

    if (mErr || !currentMatch) {
      return { success: false, error: 'Partida não encontrada.' };
    }

    const homeScore = Number(params.home_score) || 0;
    const awayScore = Number(params.away_score) || 0;
    const penHome = params.penalty_home_score != null ? Number(params.penalty_home_score) : null;
    const penAway = params.penalty_away_score != null ? Number(params.penalty_away_score) : null;

    // Determinar vencedor
    let winnerId: string | null = null;
    if (homeScore > awayScore) {
      winnerId = currentMatch.home_team_id;
    } else if (awayScore > homeScore) {
      winnerId = currentMatch.away_team_id;
    } else if (penHome != null && penAway != null) {
      if (penHome > penAway) winnerId = currentMatch.home_team_id;
      else if (penAway > penHome) winnerId = currentMatch.away_team_id;
    }

    const matchStatus: TournamentMatchStatus = params.status || 'finished';

    // 2. Atualizar partida atual
    const { error: updateErr } = await supabase
      .from('tournament_matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        penalty_home_score: penHome,
        penalty_away_score: penAway,
        winner_team_id: winnerId,
        status: matchStatus,
        notes: params.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.match_id);

    if (updateErr) {
      console.error('Erro ao atualizar placar:', updateErr);
      return { success: false, error: updateErr.message };
    }

    // 3. Salvar eventos de gols / cartões se informados
    if (params.events && params.events.length > 0) {
      // Remover eventos anteriores e reinserir
      await supabase.from('tournament_match_events').delete().eq('tournament_match_id', params.match_id);

      const eventsPayload = params.events.map((e) => ({
        tournament_match_id: params.match_id,
        team_id: e.team_id,
        player_id: e.player_id || null,
        assist_player_id: e.assist_player_id || null,
        event_type: e.event_type,
        minute: e.minute || null,
      }));

      await supabase.from('tournament_match_events').insert(eventsPayload);
    }

    // 4. AVANÇO AUTOMÁTICO NO CHAVEAMENTO DO MATA-MATA
    if (matchStatus === 'finished' && winnerId && currentMatch.next_match_id) {
      const nextMatchId = currentMatch.next_match_id;
      const { data: nextMatch } = await supabase
        .from('tournament_matches')
        .select('id, home_team_id, away_team_id, bracket_match_number')
        .eq('id', nextMatchId)
        .single();

      if (nextMatch) {
        // Se a partida atual for ímpar (1, 3, 5...), ocupa o home_team_id. Se par (2, 4...), ocupa o away_team_id
        const isHomeSlot = (currentMatch.bracket_match_number || 1) % 2 !== 0;
        const updateNextPayload: Record<string, any> = {};

        if (isHomeSlot || !nextMatch.home_team_id) {
          updateNextPayload.home_team_id = winnerId;
        } else {
          updateNextPayload.away_team_id = winnerId;
        }

        await supabase
          .from('tournament_matches')
          .update(updateNextPayload)
          .eq('id', nextMatchId);
      }
    }

    // 5. Se for a grande Final e terminou, sugere ou define o campeão!
    if (matchStatus === 'finished' && winnerId && currentMatch.phase?.toLowerCase().includes('final')) {
      const runnerUpId = winnerId === currentMatch.home_team_id ? currentMatch.away_team_id : currentMatch.home_team_id;
      await declareTournamentChampion(currentMatch.tournament_id, winnerId, runnerUpId);
    }

    toast.success('Resultado e placar registrados com sucesso! ⚽🥅');
    return { success: true };
  } catch (err: any) {
    console.error('Exceção ao salvar resultado:', err);
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

/**
 * Permite ao Super Admin / Admin reabrir uma partida (resetar placar e voltar para scheduled)
 */
export async function resetTournamentMatch(matchId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: match, error: mErr } = await supabase
      .from('tournament_matches')
      .select('id, next_match_id, winner_team_id, tournament_id')
      .eq('id', matchId)
      .single();

    if (mErr || !match) {
      return { success: false, error: 'Partida não encontrada.' };
    }

    // Se avançou vencedor em mata-mata, remover o time da partida seguinte
    if (match.next_match_id && match.winner_team_id) {
      const { data: nextMatch } = await supabase
        .from('tournament_matches')
        .select('id, home_team_id, away_team_id')
        .eq('id', match.next_match_id)
        .single();

      if (nextMatch) {
        const updates: any = {};
        if (nextMatch.home_team_id === match.winner_team_id) updates.home_team_id = null;
        if (nextMatch.away_team_id === match.winner_team_id) updates.away_team_id = null;
        if (Object.keys(updates).length > 0) {
          await supabase.from('tournament_matches').update(updates).eq('id', match.next_match_id);
        }
      }
    }

    // Excluir eventos associados
    await supabase.from('tournament_match_events').delete().eq('tournament_match_id', matchId);

    // Resetar status e placar
    const { error: resetErr } = await supabase
      .from('tournament_matches')
      .update({
        home_score: null,
        away_score: null,
        penalty_home_score: null,
        penalty_away_score: null,
        winner_team_id: null,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (resetErr) {
      return { success: false, error: resetErr.message };
    }

    toast.success('Partida resetada para agendada com sucesso.');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro inesperado' };
  }
}

// ==============================================================================
// 6. CÁLCULO DE CLASSIFICAÇÃO (PONTOS CORRIDOS)
// ==============================================================================

export function calculateTournamentStandings(
  teams: TournamentTeam[],
  matches: TournamentMatch[]
): TournamentStandingRow[] {
  const approvedTeams = teams.filter((t) => t.registration_status === 'approved');
  const standingsMap: Record<string, TournamentStandingRow> = {};

  approvedTeams.forEach((t) => {
    standingsMap[t.id] = {
      team_id: t.id,
      team_name: t.name,
      team_badge: t.badge_url,
      team_color: t.color || 'blue',
      coach_name: t.coach?.nome || null,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_diff: 0,
      points: 0,
      form: [],
    };
  });

  const finishedMatches = matches.filter((m) => m.status === 'finished');

  finishedMatches.forEach((m) => {
    if (!m.home_team_id || !m.away_team_id) return;
    const home = standingsMap[m.home_team_id];
    const away = standingsMap[m.away_team_id];
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;

    home.goals_for += m.home_score;
    home.goals_against += m.away_score;
    away.goals_for += m.away_score;
    away.goals_against += m.home_score;

    if (m.home_score > m.away_score) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
      home.form.push('W');
      away.form.push('L');
    } else if (m.away_score > m.home_score) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
      away.form.push('W');
      home.form.push('L');
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push('D');
      away.form.push('D');
    }
  });

  // Calcular saldo de gols e ordenar
  const list = Object.values(standingsMap).map((row) => ({
    ...row,
    goal_diff: row.goals_for - row.goals_against,
    form: row.form.slice(-5), // últimos 5 jogos
  }));

  list.sort((a, b) => {
    // 1. Pontos
    if (b.points !== a.points) return b.points - a.points;
    // 2. Vitórias
    if (b.won !== a.won) return b.won - a.won;
    // 3. Saldo de gols
    if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
    // 4. Gols marcados
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.team_name.localeCompare(b.team_name);
  });

  return list;
}
