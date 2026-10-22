'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { League, Profile, SportType, Match } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTables } from '@/lib/realtime';
import { toast } from 'sonner';
import {
  canManageLeague as checkCanManageLeague,
  canManageMatch as checkCanManageMatch,
  getManagedLeagues,
} from '@/lib/permissions';

interface CreateLeagueParams {
  name: string;
  sport_type?: SportType;
  description?: string;
  chave_pix_padrao?: string;
  nome_recebedor_pix?: string;
  organizer_whatsapp?: string;
  logo_url?: string;
  cover_url?: string;
  access_password?: string;
}

export type LeagueTab = "matches" | "tournaments" | "standings" | "feed" | "members";

interface LeagueContextType {
  leagues: League[];
  currentLeague: League | null;
  selectedLeagueId: string | null;
  activeTab: LeagueTab;
  setActiveTab: (tab: LeagueTab) => void;
  myLeagues: League[];
  userParticipatingLeagues: League[];
  userMemberLeagueIds: string[];
  userAdminLeagueIds: string[];
  isLoading: boolean;
  canCreateLeagues: boolean;
  isLeagueMember: (leagueId: string) => boolean;
  isLeagueAdmin: (leagueId: string | null | undefined) => boolean;
  canManageLeague: (leagueId: string | null | undefined, league?: League | null) => boolean;
  canManageMatch: (match: Match | null | undefined) => boolean;
  selectLeague: (leagueId: string | null) => void;
  clearSelectedLeague: () => void;
  refreshLeagues: () => Promise<void>;
  joinLeagueWithPassword: (leagueId: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  createLeague: (params: CreateLeagueParams) => Promise<{ success: boolean; league?: League; error?: string }>;
  updateLeague: (id: string, params: Partial<League>) => Promise<{ success: boolean; error?: string }>;
  deleteLeague: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleLeagueBlock: (id: string, block: boolean, reason?: string) => Promise<{ success: boolean; error?: string }>;
  toggleAdminLeagueCreation: (userId: string, canCreate: boolean) => Promise<{ success: boolean; error?: string }>;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

const LOCAL_STORAGE_LEAGUE_KEY = 'futresenha_selected_league_id';

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [activeTab, setActiveTabState] = useState<LeagueTab>("matches");
  const [userMemberLeagueIds, setUserMemberLeagueIds] = useState<string[]>([]);
  const [userAdminLeagueIds, setUserAdminLeagueIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sincronizar activeTab inicial a partir da URL e com o histórico (botão voltar/avançar)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const parseTabFromUrl = (): LeagueTab | null => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "feed" || params.has("post")) return "feed";
      if (tabParam === "matches") return "matches";
      if (tabParam === "standings" || tabParam === "ranking") return "standings";
      if (tabParam === "tournaments") return "tournaments";
      if (tabParam === "members" || tabParam === "jogadores") return "members";
      return null;
    };

    const initial = parseTabFromUrl();
    if (initial) setActiveTabState(initial);

    const handlePopState = () => {
      const tab = parseTabFromUrl();
      if (tab) setActiveTabState(tab);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setActiveTab = useCallback((tab: LeagueTab) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  // Carregar lista de Ligas com perfis de administradores e contagem de partidas
  const fetchLeagues = useCallback(async () => {
    try {
      // Buscar tudo em paralelo: ligas, admins, e membros do usuário
      const leaguesPromise = supabase
        .from('organizations')
        .select(`
          *,
          owner:owner_id(*),
          matches_count:matches(count)
        `)
        .order('created_at', { ascending: true });

      const adminMembersPromise = supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          user:user_id(id, nome, apelido, avatar_url, whatsapp)
        `)
        .in('role', ['owner', 'admin']);

      const userMembersPromise = user?.id
        ? supabase
            .from('organization_members')
            .select('organization_id, role')
            .eq('user_id', user.id)
        : Promise.resolve({ data: null });

      const [
        { data: leaguesData, error: leaguesError },
        { data: adminMembersData },
        { data: membersData },
      ] = await Promise.all([leaguesPromise, adminMembersPromise, userMembersPromise]);

      if (leaguesError) {
        console.error('Erro ao buscar ligas:', leaguesError);
        return;
      }

      // Mapear administradores por organização
      const adminsByOrgMap: Record<string, any[]> = {};
      adminMembersData?.forEach((m: any) => {
        if (m.organization_id && m.user) {
          if (!adminsByOrgMap[m.organization_id]) {
            adminsByOrgMap[m.organization_id] = [];
          }
          // Evitar duplicidade de usuário
          if (!adminsByOrgMap[m.organization_id].some((u: any) => u.id === m.user.id)) {
            adminsByOrgMap[m.organization_id].push(m.user);
          }
        }
      });

      const formattedLeagues: League[] = (leaguesData || []).map((org: any) => {
        const orgAdmins = [...(adminsByOrgMap[org.id] || [])];
        // Garantir que se o criador/owner original existir, ele esteja presente na lista de administradores
        if (org.owner && !orgAdmins.some((u: any) => u.id === org.owner.id)) {
          orgAdmins.unshift(org.owner);
        }

        // Extrair contagem de partidas do supabase aggregate count
        const matchCount = Array.isArray(org.matches_count)
          ? org.matches_count[0]?.count ?? 0
          : 0;

        return {
          ...org,
          matches_count: matchCount,
          has_password: Boolean(org.access_password && org.access_password.trim().length > 0),
          admins: orgAdmins.length > 0 ? orgAdmins : org.owner ? [org.owner] : [],
        };
      });

      setLeagues(formattedLeagues);

      // Processar membros do usuário (já buscados em paralelo acima)
      if (membersData) {
        setUserMemberLeagueIds(membersData.map((m: any) => m.organization_id));
        setUserAdminLeagueIds(
          membersData
            .filter((m: any) => m.role === 'owner' || m.role === 'admin')
            .map((m: any) => m.organization_id)
        );
      }

      // Se há um selectedLeagueId salvo no localStorage ou estado, verificar se ainda existe
      if (typeof window !== 'undefined') {
        const savedLeagueId = localStorage.getItem(LOCAL_STORAGE_LEAGUE_KEY);
        if (savedLeagueId && formattedLeagues.some((l) => l.id === savedLeagueId)) {
          setSelectedLeagueId(savedLeagueId);
        } else if (formattedLeagues.length === 1) {
          // Se só tem 1 liga, pode selecioná-la por padrão
          setSelectedLeagueId(formattedLeagues[0].id);
          localStorage.setItem(LOCAL_STORAGE_LEAGUE_KEY, formattedLeagues[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados das ligas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLeagues();

    // Debounce no Realtime para evitar cascata de refetches quando múltiplos eventos chegam juntos
    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        void fetchLeagues();
      }, 500);
    };

    // Inscrição Realtime para manter Ligas, Membros e Partidas atualizadas
    const unsub = subscribeToTables(
      'leagues_realtime_sync',
      [{ table: 'organizations' }, { table: 'organization_members' }, { table: 'matches' }],
      debouncedFetch,
    );

    return () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      unsub();
    };
  }, [fetchLeagues]);

  // Função para selecionar a Liga ativa
  const selectLeague = useCallback((leagueId: string | null) => {
    setSelectedLeagueId(leagueId);
    if (typeof window !== 'undefined') {
      if (leagueId) {
        localStorage.setItem(LOCAL_STORAGE_LEAGUE_KEY, leagueId);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_LEAGUE_KEY);
      }
    }
  }, []);

  // Limpar a Liga selecionada (voltar para a tela de escolha)
  const clearSelectedLeague = useCallback(() => {
    selectLeague(null);
  }, [selectLeague]);

  // Obter o objeto da Liga ativa atual
  const currentLeague = React.useMemo(() => {
    if (!selectedLeagueId) return null;
    return leagues.find((l) => l.id === selectedLeagueId) || null;
  }, [leagues, selectedLeagueId]);

  // Ligas gerenciadas pelo usuário atual (dono ou administrador em organization_members)
  const myLeagues = React.useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) return leagues;
    return leagues.filter((l) => l.owner_id === user.id || userAdminLeagueIds.includes(l.id));
  }, [leagues, user, isSuperAdmin, userAdminLeagueIds]);

  // Todas as ligas das quais o usuário participa (membro, organizador ou administrador)
  const userParticipatingLeagues = React.useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) return leagues;
    return leagues.filter((l) => {
      const isOwner = l.owner_id === user.id;
      const isMember = userMemberLeagueIds.includes(l.id);
      const isAdminRole = userAdminLeagueIds.includes(l.id);
      return isOwner || isMember || isAdminRole;
    });
  }, [leagues, user, isSuperAdmin, userMemberLeagueIds, userAdminLeagueIds]);

  // Verificar se o usuário atual pode criar ligas
  const canCreateLeagues = isSuperAdmin || (isAdmin && user?.can_create_leagues !== false);

  // Verificar se o usuário atual é membro ou administrador da liga
  const isLeagueMember = useCallback(
    (leagueId: string) => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      const targetLeague = leagues.find((l) => l.id === leagueId);
      if (targetLeague && (targetLeague.owner_id === user.id || userAdminLeagueIds.includes(leagueId))) return true;
      return userMemberLeagueIds.includes(leagueId);
    },
    [user, isSuperAdmin, leagues, userAdminLeagueIds, userMemberLeagueIds]
  );

  // Entrar em uma liga utilizando a senha (validação backend via RPC)
  const joinLeagueWithPassword = async (leagueId: string, password?: string) => {
    if (!user) {
      toast.error('Você precisa estar conectado para entrar na liga.');
      return { success: false, message: 'Usuário não autenticado.' };
    }

    try {
      const { data, error } = await supabase.rpc('join_league_with_password', {
        p_league_id: leagueId,
        p_password: password?.trim() || null,
        p_user_id: user.id,
      });

      if (error) {
        console.error('Erro na RPC join_league_with_password:', error);
        toast.error('Erro ao validar acesso à liga: ' + error.message);
        return { success: false, message: error.message };
      }

      if (data && typeof data === 'object') {
        const res = data as { success: boolean; message?: string };
        if (res.success) {
          toast.success(res.message || 'Você entrou na liga com sucesso! 🏆');
          setUserMemberLeagueIds((prev) => Array.from(new Set([...prev, leagueId])));
          await fetchLeagues();
          selectLeague(leagueId);
          return { success: true, message: res.message };
        } else {
          toast.error(res.message || 'Senha de acesso incorreta.');
          return { success: false, message: res.message };
        }
      }

      return { success: false, message: 'Resposta inválida do servidor.' };
    } catch (err: any) {
      console.error('Exceção ao entrar na liga com senha:', err);
      toast.error('Ocorreu um erro ao entrar na liga.');
      return { success: false, message: err?.message || 'Erro inesperado' };
    }
  };

  // Criar uma nova Liga
  const createLeague = async (params: CreateLeagueParams) => {
    if (!user || !isAdmin) {
      toast.error('Apenas administradores podem criar Ligas.');
      return { success: false, error: 'Permissão negada.' };
    }

    if (!canCreateLeagues) {
      toast.error('Sua permissão para criar novas ligas foi bloqueada pelo Super Administrador.');
      return { success: false, error: 'Permissão de criação de ligas bloqueada.' };
    }

    if (!params.name.trim()) {
      toast.error('O nome da Liga é obrigatório.');
      return { success: false, error: 'Nome obrigatório.' };
    }

    try {
      // Gerar slug amigável
      const baseSlug = params.name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

      const insertPayload: Record<string, any> = {
        name: params.name.trim(),
        slug: uniqueSlug,
        sport_type: params.sport_type || 'futebol',
        description: params.description?.trim() || null,
        owner_id: user.id, // Associação automática ao admin criador
        chave_pix_padrao: params.chave_pix_padrao?.trim() || null,
        nome_recebedor_pix: params.nome_recebedor_pix?.trim() || null,
        organizer_whatsapp: params.organizer_whatsapp?.trim() || user.whatsapp,
        logo_url: params.logo_url?.trim() || null,
        cover_url: params.cover_url?.trim() || null,
        access_password: params.access_password?.trim() || null,
      };

      let { data: newOrg, error } = await supabase
        .from('organizations')
        .insert(insertPayload)
        .select(`
          *,
          owner:owner_id(*)
        `)
        .single();

      // Fallback caso a coluna sport_type ainda não tenha sido criada no banco
      if (error && error.message?.includes('sport_type')) {
        delete insertPayload.sport_type;
        const retry = await supabase
          .from('organizations')
          .insert(insertPayload)
          .select(`
            *,
            owner:owner_id(*)
          `)
          .single();
        newOrg = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao criar liga:', error);
        toast.error('Erro ao cadastrar a Liga: ' + error.message);
        return { success: false, error: error.message };
      }

      // Adicionar automaticamente o criador na tabela de membros como owner
      await supabase.from('organization_members').insert({
        organization_id: newOrg.id,
        user_id: user.id,
        role: 'owner',
      });

      toast.success(`Liga "${newOrg.name}" criada com sucesso! 🏆`);
      setUserMemberLeagueIds((prev) => Array.from(new Set([...prev, newOrg.id])));
      await fetchLeagues();
      selectLeague(newOrg.id);

      return { success: true, league: newOrg as League };
    } catch (err: any) {
      console.error('Exceção ao criar liga:', err);
      toast.error('Ocorreu um erro ao criar a Liga.');
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  };

  // Bloquear ou desbloquear uma liga (Super Admin)
  const toggleLeagueBlock = async (id: string, block: boolean, reason?: string) => {
    try {
      const { error } = await supabase.rpc('toggle_league_block', {
        league_id: id,
        block,
        reason: reason || null,
      });

      if (error) {
        console.error('Erro ao alternar bloqueio da liga:', error);
        toast.error('Falha ao atualizar status da liga: ' + error.message);
        return { success: false, error: error.message };
      }

      toast.success(block ? 'Liga bloqueada com sucesso.' : 'Liga desbloqueada com sucesso.');
      await fetchLeagues();
      return { success: true };
    } catch (err: any) {
      console.error('Exceção ao alternar bloqueio da liga:', err);
      toast.error('Ocorreu um erro ao alternar o bloqueio da liga.');
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  };

  // Bloquear ou desbloquear permissão de criação de ligas de um admin (Super Admin)
  const toggleAdminLeagueCreation = async (userId: string, canCreate: boolean) => {
    try {
      const { error } = await supabase.rpc('toggle_admin_league_creation', {
        target_user_id: userId,
        can_create: canCreate,
      });

      if (error) {
        console.error('Erro ao alterar permissão de criação:', error);
        toast.error('Falha ao atualizar permissão: ' + error.message);
        return { success: false, error: error.message };
      }

      toast.success(
        canCreate
          ? 'Permissão para criar ligas liberada com sucesso.'
          : 'Criação de ligas bloqueada para este administrador.'
      );
      return { success: true };
    } catch (err: any) {
      console.error('Exceção ao alterar permissão de criação:', err);
      toast.error('Ocorreu um erro ao alterar a permissão de criação.');
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  };

  // Editar uma Liga existente
  const updateLeague = async (id: string, params: Partial<League>) => {
    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updatePayload.name = params.name.trim();
      if (params.sport_type !== undefined) updatePayload.sport_type = params.sport_type;
      if (params.description !== undefined) updatePayload.description = params.description?.trim() || null;
      if (params.chave_pix_padrao !== undefined) updatePayload.chave_pix_padrao = params.chave_pix_padrao?.trim() || null;
      if (params.nome_recebedor_pix !== undefined) updatePayload.nome_recebedor_pix = params.nome_recebedor_pix?.trim() || null;
      if (params.organizer_whatsapp !== undefined) updatePayload.organizer_whatsapp = params.organizer_whatsapp?.trim() || null;
      if (params.logo_url !== undefined) updatePayload.logo_url = params.logo_url?.trim() || null;
      if (params.cover_url !== undefined) updatePayload.cover_url = params.cover_url?.trim() || null;
      if (params.access_password !== undefined) updatePayload.access_password = params.access_password?.trim() || null;

      let { error } = await supabase
        .from('organizations')
        .update(updatePayload)
        .eq('id', id);

      // Fallback caso a coluna sport_type ainda não tenha sido criada no banco
      if (error && error.message?.includes('sport_type')) {
        delete updatePayload.sport_type;
        const retry = await supabase
          .from('organizations')
          .update(updatePayload)
          .eq('id', id);
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao atualizar liga:', error);
        toast.error('Erro ao salvar alterações da Liga.');
        return { success: false, error: error.message };
      }

      toast.success('Liga atualizada com sucesso!');
      await fetchLeagues();
      return { success: true };
    } catch (err: any) {
      console.error('Exceção ao atualizar liga:', err);
      toast.error('Ocorreu um erro ao atualizar a Liga.');
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  };

  // Excluir uma Liga
  const deleteLeague = async (id: string) => {
    try {
      // Verificar se possui partidas associadas
      const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id);

      if (count && count > 0) {
        const confirmMsg = `Esta Liga possui ${count} partida(s) vinculada(s). Excluir a Liga moverá ou excluirá essas partidas. Deseja continuar?`;
        if (!window.confirm(confirmMsg)) {
          return { success: false, error: 'Operação cancelada pelo usuário.' };
        }
      }

      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir liga:', error);
        toast.error('Erro ao excluir a Liga.');
        return { success: false, error: error.message };
      }

      toast.success('Liga excluída com sucesso.');
      if (selectedLeagueId === id) {
        clearSelectedLeague();
      }
      await fetchLeagues();
      return { success: true };
    } catch (err: any) {
      console.error('Exceção ao excluir liga:', err);
      toast.error('Ocorreu um erro ao excluir a Liga.');
      return { success: false, error: err?.message || 'Erro inesperado' };
    }
  };

  // Verificar se o usuário atual é administrador de uma liga
  const isLeagueAdmin = useCallback(
    (leagueId: string | null | undefined) => {
      if (!user || !leagueId) return false;
      if (isSuperAdmin) return true;
      const targetLeague = leagues.find((l) => l.id === leagueId);
      if (targetLeague && targetLeague.owner_id === user.id) return true;
      return userAdminLeagueIds.includes(leagueId);
    },
    [user, isSuperAdmin, leagues, userAdminLeagueIds]
  );

  // Verificar se o usuário pode administrar uma liga específica
  const canManageLeague = useCallback(
    (leagueId: string | null | undefined, league?: League | null) => {
      const targetLeague = league || (leagueId ? leagues.find((l) => l.id === leagueId) : null);
      return checkCanManageLeague(user, leagueId, userAdminLeagueIds, targetLeague);
    },
    [user, leagues, userAdminLeagueIds]
  );

  // Verificar se o usuário pode administrar uma partida específica
  const canManageMatch = useCallback(
    (match: Match | null | undefined) => {
      return checkCanManageMatch(user, match, userAdminLeagueIds);
    },
    [user, userAdminLeagueIds]
  );

  return (
    <LeagueContext.Provider
      value={{
        leagues,
        currentLeague,
        selectedLeagueId,
        activeTab,
        setActiveTab,
        myLeagues,
        userParticipatingLeagues,
        userMemberLeagueIds,
        userAdminLeagueIds,
        isLoading,
        canCreateLeagues,
        isLeagueMember,
        isLeagueAdmin,
        canManageLeague,
        canManageMatch,
        selectLeague,
        clearSelectedLeague,
        refreshLeagues: fetchLeagues,
        joinLeagueWithPassword,
        createLeague,
        updateLeague,
        deleteLeague,
        toggleLeagueBlock,
        toggleAdminLeagueCreation,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
};

export const useLeague = () => {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error('useLeague deve ser usado dentro de um LeagueProvider');
  }
  return context;
};
