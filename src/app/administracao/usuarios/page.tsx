"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Profile, AuditLog, UserRole, League } from "@/types/database";
import { formatPhoneDisplay, cleanPhoneNumber } from "@/lib/phoneUtils";
import { notifyRoleUpdated } from "@/lib/notificationDispatcher";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  User,
  Users,
  Search,
  ArrowLeft,
  Lock,
  History,
  AlertTriangle,
  CheckCircle2,
  X,
  Smartphone,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Trophy,
  Ban,
  Unlock,
  PlusCircle,
  AlertCircle,
  FileText,
  Star,
  Filter,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  UserX,
  UserCheck,
  Check,
  RotateCcw,
  Sparkle,
  Activity,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlayerRatingModal } from "@/components/PlayerRatingModal";
import {
  ManageUserLeaguesModal,
  UserLeagueMembership,
} from "@/components/ManageUserLeaguesModal";
import { DeleteUserConfirmModal } from "@/components/admin/DeleteUserConfirmModal";
import { getPlayerRating, getRatingTier } from "@/lib/playerRatingHelper";
import { useLeague } from "@/context/LeagueContext";

export interface UserWithLeagueInfo extends Profile {
  league_id?: string;
  league_name?: string;
  league_rating?: number | null;
  organization_memberships?: UserLeagueMembership[];
  is_blocked?: boolean;
}

export default function UserManagementPage() {
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, isLoading: isAuthLoading } = useAuth();
  const { myLeagues } = useLeague();

  // Estados de dados principais
  const [usersList, setUsersList] = useState<UserWithLeagueInfo[]>([]);
  const [leaguesList, setLeaguesList] = useState<League[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "history">("users");

  // Estado do Acordeon de Usuários (Apenas 1 aberto por vez para performance e limpeza)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Estado do Painel de Filtros Retrátil
  const [isFiltersAccordionOpen, setIsFiltersAccordionOpen] = useState(false);

  // Filtros e Busca
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "player" | "admin" | "super_admin"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "blocked" | "pending"
  >("all");
  const [selectedLeagueFilter, setSelectedLeagueFilter] =
    useState<string>("all");
  const [sportFilter, setSportFilter] = useState<"all" | "futebol" | "volei">(
    "all",
  );
  const [sortFilter, setSortFilter] = useState<
    | "name_asc"
    | "name_desc"
    | "recent"
    | "oldest"
    | "rating_high"
    | "rating_low"
  >("name_asc");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modais
  const [selectedRatingUser, setSelectedRatingUser] = useState<Profile | null>(
    null,
  );
  const [selectedRatingLeagueId, setSelectedRatingLeagueId] = useState<
    string | null
  >(null);
  const [selectedRatingLeagueName, setSelectedRatingLeagueName] = useState<
    string | null
  >(null);
  const [selectedRatingInitial, setSelectedRatingInitial] = useState<
    number | null
  >(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  // Modal Gerenciamento de Ligas (Super Admin)
  const [manageLeaguesUser, setManageLeaguesUser] =
    useState<UserWithLeagueInfo | null>(null);
  const [isManageLeaguesModalOpen, setIsManageLeaguesModalOpen] =
    useState(false);

  // Modal Alteração de Cargo Global (Super Admin)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("player");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Modal Bloqueio/Desbloqueio de Liga (Super Admin)
  const [leagueToToggleBlock, setLeagueToToggleBlock] = useState<League | null>(
    null,
  );
  const [blockReason, setBlockReason] = useState("");
  const [isProcessingLeagueBlock, setIsProcessingLeagueBlock] = useState(false);

  // Modal Bloqueio de Criação de Ligas (Super Admin)
  const [adminToToggleCreation, setAdminToToggleCreation] =
    useState<Profile | null>(null);
  const [isProcessingCreationToggle, setIsProcessingCreationToggle] =
    useState(false);

  // Modal Exclusão Segura de Usuário (Super Admin)
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Debounce para o campo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Redefinir página atual quando qualquer filtro mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, statusFilter, selectedLeagueFilter, sportFilter, sortFilter]);

  // Carregar dados dos usuários, ligas e auditoria
  const loadData = useCallback(async () => {
    if (!isAdmin || !user) return;
    setIsLoadingData(true);
    try {
      if (isSuperAdmin) {
        // SUPER ADMIN: Acesso global completo
        const [
          { data: profilesData, error: profilesError },
          { data: logsData, error: logsError },
          { data: leaguesData },
          { data: matchesData },
          { data: membersData },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("audit_logs")
            .select("*, user:user_id(*)")
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("organizations")
            .select("*, owner:owner_id(*)")
            .order("created_at", { ascending: true }),
          supabase.from("matches").select("id, organization_id"),
          supabase
            .from("organization_members")
            .select("*, user:user_id(*), organization:organization_id(*)"),
        ]);

        if (profilesError) {
          console.error("Erro ao carregar usuários:", profilesError);
          toast.error("Erro ao carregar lista de usuários.");
        }

        if (!logsError && logsData) {
          setAuditLogs(logsData);
        }

        // Mapear contagem de partidas por liga
        const matchCountMap: Record<string, number> = {};
        matchesData?.forEach((m) => {
          if (m.organization_id) {
            matchCountMap[m.organization_id] =
              (matchCountMap[m.organization_id] || 0) + 1;
          }
        });

        // Mapear administradores por liga
        const adminsByOrg: Record<string, any[]> = {};
        membersData?.forEach((m: any) => {
          if (
            m.organization_id &&
            m.user &&
            (m.role === "owner" || m.role === "admin")
          ) {
            if (!adminsByOrg[m.organization_id])
              adminsByOrg[m.organization_id] = [];
            if (
              !adminsByOrg[m.organization_id].some(
                (u: any) => u.id === m.user.id,
              )
            ) {
              adminsByOrg[m.organization_id].push(m.user);
            }
          }
        });

        const formattedLeagues: League[] = (leaguesData || []).map((org) => {
          const orgAdmins = [...(adminsByOrg[org.id] || [])];
          if (org.owner && !orgAdmins.some((u: any) => u.id === org.owner.id)) {
            orgAdmins.unshift(org.owner);
          }
          return {
            ...org,
            matches_count: matchCountMap[org.id] || 0,
            admins:
              orgAdmins.length > 0 ? orgAdmins : org.owner ? [org.owner] : [],
          };
        });
        setLeaguesList(formattedLeagues);

        // Agrupar associações de ligas por usuário
        const membershipsByUser: Record<string, UserLeagueMembership[]> = {};
        membersData?.forEach((m: any) => {
          if (m.user_id && m.organization_id) {
            if (!membershipsByUser[m.user_id])
              membershipsByUser[m.user_id] = [];
            membershipsByUser[m.user_id].push({
              league_id: m.organization_id,
              league_name: m.organization?.name || "Liga",
              role: m.role || "player",
              rating: m.nivel_qualidade,
            });
          }
        });

        const formattedUsers: UserWithLeagueInfo[] = (profilesData || []).map(
          (p) => {
            const userMemberships = membershipsByUser[p.id] || [];
            return {
              ...p,
              organization_memberships: userMemberships,
              league_id: userMemberships[0]?.league_id,
              league_name: userMemberships[0]?.league_name,
              league_rating: userMemberships[0]?.rating ?? p.nivel_qualidade,
            };
          },
        );

        setUsersList(formattedUsers);

        setManageLeaguesUser((prev) =>
          prev ? formattedUsers.find((u) => u.id === prev.id) || prev : null,
        );
      } else {
        // ADMINISTRADOR DE LIGA: Visualiza participantes de suas ligas
        const myLeagueIds = myLeagues.map((l) => l.id);

        if (myLeagueIds.length === 0) {
          setLeaguesList([]);
          setUsersList([]);
          setIsLoadingData(false);
          return;
        }

        const [{ data: matchesData }, { data: membersData }] =
          await Promise.all([
            supabase
              .from("matches")
              .select("id, organization_id")
              .in("organization_id", myLeagueIds),
            supabase
              .from("organization_members")
              .select("*, user:user_id(*), organization:organization_id(*)")
              .in("organization_id", myLeagueIds),
          ]);

        const matchCountMap: Record<string, number> = {};
        matchesData?.forEach((m) => {
          if (m.organization_id) {
            matchCountMap[m.organization_id] =
              (matchCountMap[m.organization_id] || 0) + 1;
          }
        });

        const adminsByOrg: Record<string, any[]> = {};
        membersData?.forEach((m: any) => {
          if (
            m.organization_id &&
            m.user &&
            (m.role === "owner" || m.role === "admin")
          ) {
            if (!adminsByOrg[m.organization_id])
              adminsByOrg[m.organization_id] = [];
            if (
              !adminsByOrg[m.organization_id].some(
                (u: any) => u.id === m.user.id,
              )
            ) {
              adminsByOrg[m.organization_id].push(m.user);
            }
          }
        });

        const formattedLeagues: League[] = myLeagues.map((org) => {
          const orgAdmins = [...(adminsByOrg[org.id] || [])];
          if (org.owner && !orgAdmins.some((u: any) => u.id === org.owner?.id)) {
            orgAdmins.unshift(org.owner);
          }
          return {
            ...org,
            matches_count: matchCountMap[org.id] || 0,
            admins:
              orgAdmins.length > 0 ? orgAdmins : org.owner ? [org.owner] : [],
          };
        });
        setLeaguesList(formattedLeagues);

        const userMap = new Map<string, UserWithLeagueInfo>();
        membersData?.forEach((m: any) => {
          if (m.user) {
            const existing = userMap.get(m.user.id);
            const membership: UserLeagueMembership = {
              league_id: m.organization_id,
              league_name: m.organization?.name || "Liga",
              role: m.role || "player",
              rating: m.nivel_qualidade,
            };

            if (existing) {
              existing.organization_memberships = [
                ...(existing.organization_memberships || []),
                membership,
              ];
            } else {
              userMap.set(m.user.id, {
                ...m.user,
                league_id: m.organization_id,
                league_name: m.organization?.name || "Liga",
                league_rating: m.nivel_qualidade ?? m.user.nivel_qualidade,
                organization_memberships: [membership],
              });
            }
          }
        });

        setUsersList(Array.from(userMap.values()));
      }
    } catch (err) {
      console.error("Exceção ao carregar dados administrativos:", err);
      toast.error("Ocorreu um erro ao carregar os dados.");
    } finally {
      setIsLoadingData(false);
    }
  }, [isAdmin, isSuperAdmin, user?.id, myLeagues]);

  useEffect(() => {
    if (!isAuthLoading && isAdmin) {
      loadData();
    }
  }, [isAuthLoading, isAdmin, loadData]);

  // Contadores e Métricas Reais do Sistema
  const counters = useMemo(() => {
    const total = usersList.length;
    const players = usersList.filter(
      (u) => u.role === "player" || u.role === "participant",
    ).length;
    const admins = usersList.filter((u) => u.role === "admin").length;
    const superAdmins = usersList.filter(
      (u) => u.role === "super_admin",
    ).length;

    // Status real
    const blocked = usersList.filter(
      (u) => u.can_create_leagues === false || u.is_blocked === true,
    ).length;
    const pending = usersList.filter(
      (u) =>
        !u.organization_memberships ||
        u.organization_memberships.length === 0,
    ).length;
    const active = total - blocked - pending;

    return {
      total,
      players,
      admins,
      superAdmins,
      active: active > 0 ? active : 0,
      blocked,
      pending,
    };
  }, [usersList]);

  // Mapeamento de ligas sob responsabilidade por administrador
  const leaguesByAdminMap = useMemo(() => {
    const map: Record<string, League[]> = {};
    leaguesList.forEach((lg) => {
      if (lg.owner_id) {
        if (!map[lg.owner_id]) map[lg.owner_id] = [];
        map[lg.owner_id].push(lg);
      }
    });
    return map;
  }, [leaguesList]);

  // Helper para determinar o status real do usuário
  const getUserStatus = (u: UserWithLeagueInfo): "active" | "blocked" | "pending" => {
    if (u.can_create_leagues === false || u.is_blocked === true) {
      return "blocked";
    }
    if (
      !u.organization_memberships ||
      u.organization_memberships.length === 0
    ) {
      return "pending";
    }
    return "active";
  };

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch.trim()) count++;
    if (roleFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (selectedLeagueFilter !== "all") count++;
    if (sportFilter !== "all") count++;
    if (sortFilter !== "name_asc") count++;
    return count;
  }, [
    debouncedSearch,
    roleFilter,
    statusFilter,
    selectedLeagueFilter,
    sportFilter,
    sortFilter,
  ]);

  // Função para limpar todos os filtros
  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSelectedLeagueFilter("all");
    setSportFilter("all");
    setSortFilter("name_asc");
    setCurrentPage(1);
  };

  // Filtragem e Ordenação Completa
  const filteredUsers = useMemo(() => {
    let result = usersList.filter((u) => {
      // 1. Filtro por Liga
      if (selectedLeagueFilter !== "all") {
        const belongsToSelected = (u.organization_memberships || []).some(
          (m) => m.league_id === selectedLeagueFilter,
        );
        if (!belongsToSelected) return false;
      }

      // 2. Filtro por Modalidade / Esporte
      if (sportFilter !== "all") {
        const hasSport =
          u.sport_types?.includes(sportFilter) ||
          (sportFilter === "futebol" && !!u.futebol_position) ||
          (sportFilter === "volei" && !!u.volei_position);
        if (!hasSport) return false;
      }

      // 3. Filtro por Tipo / Cargo
      if (roleFilter !== "all") {
        if (
          roleFilter === "player" &&
          u.role !== "player" &&
          u.role !== "participant"
        )
          return false;
        if (roleFilter === "admin" && u.role !== "admin") return false;
        if (roleFilter === "super_admin" && u.role !== "super_admin")
          return false;
      }

      // 4. Filtro por Status
      if (statusFilter !== "all") {
        const uStatus = getUserStatus(u);
        if (uStatus !== statusFilter) return false;
      }

      // 5. Busca por texto (Nome, Apelido, WhatsApp / Telefone)
      if (debouncedSearch.trim()) {
        const cleanQuery = debouncedSearch.toLowerCase().trim();
        const digitsQuery = cleanPhoneNumber(cleanQuery);

        const matchesName = u.nome?.toLowerCase().includes(cleanQuery);
        const matchesNick = u.apelido?.toLowerCase().includes(cleanQuery);
        const matchesPhone =
          digitsQuery.length >= 2 &&
          cleanPhoneNumber(u.whatsapp || "").includes(digitsQuery);

        if (!matchesName && !matchesNick && !matchesPhone) {
          return false;
        }
      }

      return true;
    });

    // Ordenação
    result = [...result].sort((a, b) => {
      if (sortFilter === "name_asc") {
        return (a.nome || "").localeCompare(b.nome || "");
      }
      if (sortFilter === "name_desc") {
        return (b.nome || "").localeCompare(a.nome || "");
      }
      if (sortFilter === "recent") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortFilter === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortFilter === "rating_high") {
        return (
          (b.league_rating ?? getPlayerRating(b)) -
          (a.league_rating ?? getPlayerRating(a))
        );
      }
      if (sortFilter === "rating_low") {
        return (
          (a.league_rating ?? getPlayerRating(a)) -
          (b.league_rating ?? getPlayerRating(b))
        );
      }
      return 0;
    });

    return result;
  }, [
    usersList,
    debouncedSearch,
    roleFilter,
    statusFilter,
    selectedLeagueFilter,
    sportFilter,
    sortFilter,
  ]);

  // Paginação dos usuários
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Toggle do Acordeon do Usuário (Fecha os outros e abre somente o clicado)
  const toggleUserAccordion = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  // Abrir Modal de Avaliação
  const handleOpenRatingModal = (targetUser: UserWithLeagueInfo) => {
    setSelectedRatingUser(targetUser);
    const targetLgId =
      selectedLeagueFilter !== "all"
        ? selectedLeagueFilter
        : targetUser.league_id || null;
    const targetLg = leaguesList.find((l) => l.id === targetLgId);
    setSelectedRatingLeagueId(targetLgId);
    setSelectedRatingLeagueName(
      targetLg?.name || targetUser.league_name || null,
    );
    setSelectedRatingInitial(
      targetUser.league_rating ?? getPlayerRating(targetUser),
    );
    setIsRatingModalOpen(true);
  };

  const handleRatingUpdated = (
    userId: string,
    newRating: number,
    targetLeagueId?: string | null,
  ) => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updatedMemberships = (u.organization_memberships || []).map(
            (m) =>
              m.league_id === targetLeagueId ? { ...m, rating: newRating } : m,
          );
          return {
            ...u,
            nivel_qualidade:
              isSuperAdmin && !targetLeagueId ? newRating : u.nivel_qualidade,
            league_rating: newRating,
            organization_memberships: updatedMemberships,
          };
        }
        return u;
      }),
    );
  };

  // Abrir Modal de Gerenciamento de Vínculos de Ligas
  const handleOpenManageLeaguesModal = (targetUser: UserWithLeagueInfo) => {
    setManageLeaguesUser(targetUser);
    setIsManageLeaguesModalOpen(true);
  };

  // Abrir Modal de Alteração de Cargo Global (Super Admin)
  const handleOpenRoleModal = (targetUser: Profile) => {
    if (!isSuperAdmin) return;
    if (targetUser.id === user?.id) {
      toast.info("Você não pode alterar seu próprio nível de acesso.");
      return;
    }
    setSelectedUser(targetUser);
    setSelectedRole(
      (targetUser.role === "participant"
        ? "player"
        : targetUser.role) as UserRole,
    );
  };

  const handleSaveRoleChange = async () => {
    if (!selectedUser || isUpdatingRole || !isSuperAdmin) return;

    if (selectedUser.id === user?.id) {
      toast.error("Você não pode alterar seu próprio nível de acesso.");
      return;
    }

    if (selectedUser.role === selectedRole) {
      toast.info("O usuário já possui este cargo.");
      setSelectedUser(null);
      return;
    }

    try {
      setIsUpdatingRole(true);

      const { error } = await supabase.rpc("update_user_role", {
        target_user_id: selectedUser.id,
        new_role: selectedRole,
      });

      if (error) {
        console.error("Erro na RPC update_user_role:", error);
        toast.error(error.message || "Falha ao alterar o cargo do usuário.");
        return;
      }

      toast.success(
        `Nível de acesso de ${selectedUser.nome} alterado para ${getRoleLabel(selectedRole)}!`,
      );
      void notifyRoleUpdated(selectedUser.id, selectedRole);
      setSelectedUser(null);
      await loadData();
    } catch (err) {
      console.error("Erro inesperado ao salvar cargo:", err);
      toast.error("Ocorreu um erro ao atualizar o cargo.");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Alternar Bloqueio de Liga (Super Admin)
  const handleExecuteToggleLeagueBlock = async () => {
    if (!leagueToToggleBlock || isProcessingLeagueBlock || !isSuperAdmin)
      return;

    try {
      setIsProcessingLeagueBlock(true);
      const isCurrentlyBlocked = !!leagueToToggleBlock.is_blocked;
      const targetState = !isCurrentlyBlocked;

      const { error } = await supabase.rpc("toggle_league_block", {
        league_id: leagueToToggleBlock.id,
        block: targetState,
        reason: targetState
          ? blockReason.trim() || "Bloqueada pelo Super Administrador"
          : null,
      });

      if (error) {
        console.error("Erro ao alternar bloqueio da liga:", error);
        toast.error("Falha ao atualizar status da liga: " + error.message);
        return;
      }

      toast.success(
        targetState
          ? `Liga "${leagueToToggleBlock.name}" foi bloqueada com sucesso!`
          : `Liga "${leagueToToggleBlock.name}" foi desbloqueada com sucesso!`,
      );

      setLeagueToToggleBlock(null);
      setBlockReason("");
      await loadData();
    } catch (err: any) {
      console.error("Exceção ao alternar bloqueio:", err);
      toast.error("Erro inesperado ao alternar status da liga.");
    } finally {
      setIsProcessingLeagueBlock(false);
    }
  };

  // Alternar Permissão de Criação de Ligas (Super Admin)
  const handleExecuteToggleCreation = async () => {
    if (!adminToToggleCreation || isProcessingCreationToggle || !isSuperAdmin)
      return;

    const targetAdmin = adminToToggleCreation;
    const isCurrentlyBlocked = targetAdmin.can_create_leagues === false;
    const targetCanCreate = isCurrentlyBlocked;

    try {
      setIsProcessingCreationToggle(true);

      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetAdmin.id
            ? { ...u, can_create_leagues: targetCanCreate }
            : u,
        ),
      );

      const { error } = await supabase.rpc("toggle_admin_league_creation", {
        target_user_id: targetAdmin.id,
        can_create: targetCanCreate,
      });

      if (error) {
        console.error("Erro ao alterar permissão de criação:", error);
        toast.error("Falha ao atualizar permissão: " + error.message);
        await loadData();
        return;
      }

      toast.success(
        targetCanCreate
          ? `Permissão para criar ligas liberada para ${targetAdmin.nome}! 🏆`
          : `Criação de novas ligas bloqueada para ${targetAdmin.nome}! 🚫`,
      );

      setAdminToToggleCreation(null);
      await loadData();
    } catch (err: any) {
      console.error("Exceção ao alterar permissão:", err);
      toast.error("Erro inesperado ao alterar permissão.");
      await loadData();
    } finally {
      setIsProcessingCreationToggle(false);
    }
  };

  // Abrir Modal de Exclusão de Usuário (Super Admin)
  const handleOpenDeleteModal = (targetUser: Profile) => {
    if (!isSuperAdmin) return;
    if (targetUser.id === user?.id) {
      toast.error("Você não pode excluir sua própria conta.");
      return;
    }
    setUserToDelete(targetUser);
    setIsDeleteModalOpen(true);
  };

  // Badges e Helpers Visuais
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "Super Administrador";
      case "admin":
        return "Administrador";
      case "player":
      case "participant":
      default:
        return "Jogador";
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "super_admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs shadow-amber-500/20">
            <Crown className="w-3 h-3" />
            <span>Super Admin</span>
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3" />
            <span>Administrador</span>
          </span>
        );
      case "player":
      case "participant":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <User className="w-3 h-3" />
            <span>Jogador</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: "active" | "blocked" | "pending") => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ativo</span>
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <Ban className="w-3 h-3" />
            <span>Bloqueado</span>
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Pendente</span>
          </span>
        );
    }
  };

  // 1. Estado de Carregamento Inicial da Autenticação
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Verificando credenciais de segurança...
        </p>
      </div>
    );
  }

  // 2. Proteção de Rota: Não Autenticado
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-xl space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Autenticação Necessária
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Você precisa estar autenticado com uma conta autorizada para acessar
            o painel de administração.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold rounded-2xl text-xs shadow-lg shadow-brand-500/25 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Página Inicial</span>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Proteção de Rota: Não é Administrador
  if (!isSuperAdmin && (!isAdmin || myLeagues.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-red-500/20 dark:border-red-500/30 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full">
              403 • Acesso Restrito
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white pt-2">
              Acesso Não Permitido
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {isAdmin
              ? "Você não possui vínculo de administrador em nenhuma liga cadastrada para gerenciar participantes."
              : `A página de Gerenciamento é de acesso exclusivo para Administradores de Liga e Super Administradores. Seu cargo atual (${getRoleLabel(user.role)}) não possui permissões.`}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-extrabold rounded-2xl text-xs shadow-lg transition-all hover:opacity-90"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o F&V Sports</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* ──────────────────────────────────────────────────────────────────────
          1. CABEÇALHO ADMINISTRATIVO COMPACTO E INTUITIVO
      ────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              title="Voltar para a Página Inicial"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-white truncate">
                  <span>👑 Administração Geral</span>
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                    isSuperAdmin
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {isSuperAdmin ? "Super Administrador" : "Admin da Liga"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Gerencie usuários, permissões, status de acesso e informações das contas cadastradas no F&V Sports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/administracao/financeiro"
              className="px-3 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-black text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Abrir Painel Financeiro e Caixinha"
            >
              <span className="hidden xs:inline">💰 Painel Financeiro</span>
              <span className="xs:hidden">💰 Finanças</span>
            </Link>

            <button
              onClick={loadData}
              disabled={isLoadingData}
              className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingData ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Descrição Mobile */}
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">
          Gerencie usuários, permissões, status de acesso e informações das contas cadastradas no F&V Sports.
        </p>

        {/* ──────────────────────────────────────────────────────────────────────
            2. RESUMO DOS USUÁRIOS (MÉTRICAS REAIS DO SISTEMA)
        ────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Usuários Totais */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-center justify-between"
          >
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                👥 Usuários
              </span>
              <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
                {counters.total}
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Ativos */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/20 shadow-xs flex items-center justify-between bg-gradient-to-br from-emerald-500/5 to-transparent"
          >
            <div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                🟢 Ativos
              </span>
              <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {counters.active}
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Bloqueados */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-red-500/20 shadow-xs flex items-center justify-between bg-gradient-to-br from-red-500/5 to-transparent"
          >
            <div>
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 block mb-0.5">
                🔴 Bloqueados
              </span>
              <div className="text-lg sm:text-2xl font-black text-red-600 dark:text-red-400">
                {counters.blocked}
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Ban className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Pendentes */}
          <motion.div
            whileHover={{ y: -2 }}
            className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-xs flex items-center justify-between bg-gradient-to-br from-amber-500/5 to-transparent"
          >
            <div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                🟡 Pendentes
              </span>
              <div className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {counters.pending}
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          </motion.div>
        </div>

        {/* Abas: Usuários vs Histórico de Auditoria (Super Admin) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 p-1 bg-slate-200/60 dark:bg-slate-850 rounded-2xl max-w-sm">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "users"
                  ? "bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuários ({counters.total})</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Auditoria ({auditLogs.length})</span>
            </button>
          </div>
        )}

        {activeTab === "users" ? (
          <div className="space-y-4">
            {/* ──────────────────────────────────────────────────────────────────────
                3. PAINEL DE FILTROS AVANÇADO EM ACORDEON
            ────────────────────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
              {/* Topo do Painel de Filtros: Barra de Busca + Botão Expansor */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="🔎 Buscar por nome, apelido ou telefone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white transition-all shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-end">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-white">
                      {filteredUsers.length}
                    </strong>{" "}
                    {filteredUsers.length === 1
                      ? "usuário encontrado"
                      : "usuários encontrados"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setIsFiltersAccordionOpen(!isFiltersAccordionOpen)
                    }
                    className={`px-3 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isFiltersAccordionOpen || activeFiltersCount > 0
                        ? "bg-brand-500 text-white border-brand-500 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filtros</span>
                    {activeFiltersCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 text-white font-black">
                        {activeFiltersCount}
                      </span>
                    )}
                    {isFiltersAccordionOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Corpo Expansível do Acordeon de Filtros */}
              <AnimatePresence>
                {isFiltersAccordionOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      {/* 1. Tipo de Usuário */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Tipo de Usuário
                        </label>
                        <select
                          value={roleFilter}
                          onChange={(e) =>
                            setRoleFilter(e.target.value as any)
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="all">Todos os tipos ({counters.total})</option>
                          <option value="player">
                            Jogador ({counters.players})
                          </option>
                          {isSuperAdmin && (
                            <>
                              <option value="admin">
                                Administrador ({counters.admins})
                              </option>
                              <option value="super_admin">
                                Super Administrador ({counters.superAdmins})
                              </option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* 2. Status */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Status
                        </label>
                        <select
                          value={statusFilter}
                          onChange={(e) =>
                            setStatusFilter(e.target.value as any)
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="all">Todos os status</option>
                          <option value="active">🟢 Ativo ({counters.active})</option>
                          <option value="blocked">🔴 Bloqueado ({counters.blocked})</option>
                          <option value="pending">🟡 Pendente ({counters.pending})</option>
                        </select>
                      </div>

                      {/* 3. Liga */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Liga
                        </label>
                        <select
                          value={selectedLeagueFilter}
                          onChange={(e) =>
                            setSelectedLeagueFilter(e.target.value)
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="all">
                            {isSuperAdmin
                              ? "Todas as Ligas"
                              : "Todas as Minhas Ligas"}
                          </option>
                          {leaguesList.map((lg) => (
                            <option key={lg.id} value={lg.id}>
                              🏆 {lg.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 4. Modalidade */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Modalidade
                        </label>
                        <select
                          value={sportFilter}
                          onChange={(e) =>
                            setSportFilter(e.target.value as any)
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="all">Todas as modalidades</option>
                          <option value="futebol">⚽ Futebol</option>
                          <option value="volei">🏐 Vôlei</option>
                        </select>
                      </div>

                      {/* 5. Ordenar por */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Ordenar por
                        </label>
                        <select
                          value={sortFilter}
                          onChange={(e) =>
                            setSortFilter(e.target.value as any)
                          }
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="name_asc">Nome A–Z</option>
                          <option value="name_desc">Nome Z–A</option>
                          <option value="recent">Mais recentes</option>
                          <option value="oldest">Mais antigos</option>
                          <option value="rating_high">
                            Maior Nível de Qualidade (10 → 1) ⭐
                          </option>
                          <option value="rating_low">
                            Menor Nível de Qualidade (1 → 10)
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Botões do Painel de Filtros */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-xs text-slate-400 font-medium">
                        {activeFiltersCount > 0 ? (
                          <span>
                            🔎 <strong>{activeFiltersCount}</strong> filtros ativos
                          </span>
                        ) : (
                          <span>Nenhum filtro adicional aplicado</span>
                        )}
                      </span>

                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Limpar filtros</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ──────────────────────────────────────────────────────────────────────
                4. LISTAGEM DE USUÁRIOS COM ACORDEONS INDIVIDUAIS
            ────────────────────────────────────────────────────────────────────── */}
            {isLoadingData ? (
              /* SKELETON LOADING ELEGANTE */
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl animate-pulse flex items-center justify-between gap-3 h-18"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                      <div className="space-y-1.5">
                        <div className="w-36 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="w-24 h-2.5 bg-slate-100 dark:bg-slate-850 rounded" />
                      </div>
                    </div>
                    <div className="w-20 h-6 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              /* ESTADO QUANDO NENHUM USUÁRIO FOR ENCONTRADO */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  🔎 Nenhum jogador encontrado
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Não encontramos usuários correspondentes aos filtros selecionados.
                </p>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar filtros</span>
                  </button>
                )}
              </div>
            ) : (
              /* LISTA DE CARDS EM ACORDEON */
              <div className="space-y-2.5">
                {paginatedUsers.map((item) => {
                  const isExpanded = expandedUserId === item.id;
                  const isCurrentUser = item.id === user?.id;
                  const userStatus = getUserStatus(item);
                  const playerRating =
                    item.league_rating ?? getPlayerRating(item);
                  const ratingTier = getRatingTier(playerRating);
                  const memberships = item.organization_memberships || [];
                  const userLeagues = leaguesByAdminMap[item.id] || [];
                  const isLeagueCreationBlocked =
                    item.can_create_leagues === false;
                  const isAdminRole =
                    item.role === "admin" || item.role === "super_admin";

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white dark:bg-slate-900 border rounded-3xl transition-all shadow-xs overflow-hidden ${
                        isExpanded
                          ? "ring-2 ring-brand-500/20 border-brand-500/40 dark:border-brand-500/40"
                          : item.role === "super_admin"
                            ? "border-amber-500/40 dark:border-amber-500/30 hover:border-amber-500"
                            : item.role === "admin"
                              ? "border-blue-500/40 dark:border-blue-500/30 hover:border-blue-500"
                              : "border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {/* ──────────────────────────────────────────────────────────
                          CABEÇALHO DO ACORDEON (LINHA COMPACTA FECHADA)
                      ────────────────────────────────────────────────────────── */}
                      <button
                        type="button"
                        onClick={() => toggleUserAccordion(item.id)}
                        className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-850/50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 flex items-center justify-center font-black text-xs text-brand-600 dark:text-brand-400 shrink-0 overflow-hidden shadow-xs">
                            {item.avatar_url ? (
                              <img
                                src={item.avatar_url}
                                alt={item.nome}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.nome.charAt(0).toUpperCase()
                            )}
                          </div>

                          {/* Dados Rápidos */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {item.nome}
                              </h3>
                              {item.apelido && (
                                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate">
                                  ({item.apelido})
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-[9px] font-black text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.2 rounded-full border border-brand-500/30">
                                  Você
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                              <span>{getRoleLabel(item.role)}</span>
                              <span className="text-slate-300 dark:text-slate-600">
                                •
                              </span>
                              <span>
                                {userStatus === "active"
                                  ? "🟢 Ativo"
                                  : userStatus === "blocked"
                                    ? "🔴 Bloqueado"
                                    : "🟡 Pendente"}
                              </span>
                              {memberships.length > 0 && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600 hidden xs:inline">
                                    •
                                  </span>
                                  <span className="hidden xs:inline text-slate-400">
                                    🏆 {memberships.length}{" "}
                                    {memberships.length === 1 ? "liga" : "ligas"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badges + Seta do Acordeon */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="hidden sm:flex items-center gap-1.5">
                            {getRoleBadge(item.role)}
                            {getStatusBadge(userStatus)}
                          </div>

                          <div
                            className={`w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 bg-brand-500/10 text-brand-600" : ""
                            }`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </button>

                      {/* ──────────────────────────────────────────────────────────
                          CONTEÚDO DO ACORDEON (QUANDO ABERTO)
                      ────────────────────────────────────────────────────────── */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50"
                          >
                            {/* Badges Mobile */}
                            <div className="flex sm:hidden items-center gap-1.5 flex-wrap pb-1">
                              {getRoleBadge(item.role)}
                              {getStatusBadge(userStatus)}
                            </div>

                            {/* 1. Informações da Conta */}
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shadow-xs">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <User className="w-3 h-3" />
                                <span>Informações da Conta</span>
                              </span>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    Nome Completo:
                                  </span>
                                  <span className="font-extrabold text-slate-900 dark:text-white">
                                    {item.nome}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    Apelido:
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {item.apelido || "Não informado"}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    WhatsApp / Telefone:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {formatPhoneDisplay(item.whatsapp)}
                                    </span>
                                    {item.whatsapp && (
                                      <a
                                        href={`https://wa.me/55${cleanPhoneNumber(
                                          item.whatsapp,
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-500 hover:text-emerald-600 p-0.5"
                                        title="Abrir no WhatsApp"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    Tipo / Cargo Global:
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {getRoleLabel(item.role)}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    Status de Acesso:
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {userStatus === "active"
                                      ? "🟢 Ativo e Regular"
                                      : userStatus === "blocked"
                                        ? "🔴 Bloqueado"
                                        : "🟡 Pendente de Vínculo"}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[11px] text-slate-400 block font-medium">
                                    Data de Cadastro:
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {format(
                                      new Date(item.created_at),
                                      "dd/MM/yyyy HH:mm",
                                      { locale: ptBR },
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 2. Ligas Relacionadas */}
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shadow-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                  <Trophy className="w-3 h-3 text-amber-500" />
                                  <span>
                                    Ligas & Papéis ({memberships.length})
                                  </span>
                                </span>

                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenManageLeaguesModal(item)
                                    }
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                    title="Gerenciar vínculos de ligas e transferências"
                                  >
                                    <Layers className="w-3 h-3" />
                                    <span>Gerenciar Ligas</span>
                                  </button>
                                )}
                              </div>

                              {memberships.length === 0 ? (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                                  Nenhuma liga vinculada a este usuário no momento.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {memberships.map((m) => {
                                    const isLeagueAdmin =
                                      m.role === "admin" || m.role === "owner";
                                    return (
                                      <div
                                        key={m.league_id}
                                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                          isLeagueAdmin
                                            ? "bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30"
                                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750"
                                        }`}
                                      >
                                        <div className="min-w-0">
                                          <p className="font-extrabold text-slate-900 dark:text-white truncate">
                                            🏆 {m.league_name}
                                          </p>
                                          <span className="text-[10px] text-slate-400">
                                            Papel:{" "}
                                            <strong
                                              className={
                                                isLeagueAdmin
                                                  ? "text-blue-600 dark:text-blue-400"
                                                  : "text-slate-600 dark:text-slate-300"
                                              }
                                            >
                                              {isLeagueAdmin
                                                ? "Administrador da Liga"
                                                : "Membro / Jogador"}
                                            </strong>
                                          </span>
                                        </div>

                                        {isLeagueAdmin && (
                                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                                            Admin
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 3. Permissões Reais do Usuário */}
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shadow-xs">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <Shield className="w-3 h-3" />
                                <span>Permissões do Sistema</span>
                              </span>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                                  {item.role === "super_admin" ||
                                  (item.role === "admin" &&
                                    !isLeagueCreationBlocked) ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <Ban className="w-4 h-4 text-red-500 shrink-0" />
                                  )}
                                  <span className="text-[11px] font-bold">
                                    Criar Ligas
                                  </span>
                                </div>

                                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                                  {isAdminRole ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <span className="text-[11px] font-bold">
                                    Administrar Ligas
                                  </span>
                                </div>

                                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                                  {isAdminRole ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <span className="text-[11px] font-bold">
                                    Gerenciar Usuários
                                  </span>
                                </div>

                                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                                  {isAdminRole ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <span className="text-[11px] font-bold">
                                    Criar Partidas
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 4. Avaliação de Qualidade (Nível 1 a 10) */}
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5 border border-amber-500/25 flex items-center justify-between gap-3 shadow-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-base shrink-0">
                                  {ratingTier.emoji}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                      Nível de Qualidade:
                                    </span>
                                    <span className="text-xs font-black text-slate-900 dark:text-white">
                                      {playerRating} • {ratingTier.label}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-medium block truncate">
                                    {ratingTier.description}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenRatingModal(item)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                                title="Definir/Alterar nota de qualidade (1 a 10)"
                              >
                                <Star className="w-3.5 h-3.5 fill-slate-950" />
                                <span>Avaliar</span>
                              </button>
                            </div>

                            {/* 5. Ligas sob Responsabilidade (Para Administradores) */}
                            {isSuperAdmin && isAdminRole && (
                              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                    <Trophy className="w-3 h-3 text-blue-500" />
                                    <span>
                                      Ligas sob sua Responsabilidade (
                                      {userLeagues.length})
                                    </span>
                                  </span>

                                  {item.role === "admin" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAdminToToggleCreation(item)
                                      }
                                      className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                                        isLeagueCreationBlocked
                                          ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs"
                                          : "bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900 text-red-700 dark:text-red-300"
                                      }`}
                                      title={
                                        isLeagueCreationBlocked
                                          ? "Liberar criação de ligas para este administrador"
                                          : "Bloquear criação de novas ligas para este administrador"
                                      }
                                    >
                                      {isLeagueCreationBlocked ? (
                                        <>
                                          <Unlock className="w-3 h-3" />
                                          <span>Liberar Criação</span>
                                        </>
                                      ) : (
                                        <>
                                          <Ban className="w-3 h-3" />
                                          <span>Bloquear Criação</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {userLeagues.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                                    Nenhuma liga criada por este administrador até o momento.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {userLeagues.map((lg) => {
                                      const isBlocked = !!lg.is_blocked;
                                      return (
                                        <div
                                          key={lg.id}
                                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                            isBlocked
                                              ? "bg-red-500/5 dark:bg-red-950/20 border-red-500/30"
                                              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750"
                                          }`}
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-slate-900 dark:text-white truncate">
                                                {lg.name}
                                              </span>
                                              {isBlocked ? (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                                                  Bloqueada
                                                </span>
                                              ) : (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                  Ativa
                                                </span>
                                              )}
                                            </div>
                                            {isBlocked && lg.blocked_reason && (
                                              <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5 truncate">
                                                Motivo: {lg.blocked_reason}
                                              </p>
                                            )}
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setLeagueToToggleBlock(lg)
                                            }
                                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all shrink-0 cursor-pointer ${
                                              isBlocked
                                                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs"
                                                : "bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                                            }`}
                                          >
                                            {isBlocked
                                              ? "Desbloquear"
                                              : "Bloquear"}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 6. Barra de Ações do Super Administrador */}
                            {isSuperAdmin && (
                              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[11px] text-slate-400">
                                  ID: {item.id.slice(0, 8)}...
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Gerenciar Vínculos */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenManageLeaguesModal(item)
                                    }
                                    className="px-2.5 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1 border border-brand-500/20"
                                    title="Gerenciar vínculos e papéis de ligas"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Vínculos</span>
                                  </button>

                                  {/* Alterar Cargo Global */}
                                  {!isCurrentUser && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRoleModal(item)}
                                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Alterar Cargo</span>
                                    </button>
                                  )}

                                  {/* Excluir Usuário */}
                                  {!isCurrentUser && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenDeleteModal(item)
                                      }
                                      className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1 border border-red-200 dark:border-red-800"
                                      title="Excluir este usuário do sistema com confirmação"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                      <span>Excluir</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ──────────────────────────────────────────────────────────────────────
                5. PAGINAÇÃO INTELIGENTE
            ────────────────────────────────────────────────────────────────────── */}
            {filteredUsers.length > 0 && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold order-2 sm:order-1">
                  Mostrando{" "}
                  <strong>
                    {(currentPage - 1) * itemsPerPage + 1}–
                    {Math.min(currentPage * itemsPerPage, filteredUsers.length)}
                  </strong>{" "}
                  de <strong>{filteredUsers.length}</strong> usuários
                </span>

                <div className="flex items-center gap-1 order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.max(1, p - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        if (totalPages <= 5) return true;
                        return (
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - currentPage) <= 1
                        );
                      })
                      .map((p, idx, arr) => {
                        const showEllipsis =
                          idx > 0 && p - arr[idx - 1] > 1;

                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && (
                              <span className="px-1 text-slate-400">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`w-7 h-7 rounded-xl font-black text-xs transition-all cursor-pointer ${
                                currentPage === p
                                  ? "bg-brand-500 text-white shadow-xs"
                                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="hidden sm:inline">Próximo</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ──────────────────────────────────────────────────────────────────────
              6. ABA DE HISTÓRICO DE AUDITORIA (SUPER ADMIN)
          ────────────────────────────────────────────────────────────────────── */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Registro de Auditoria de Ações Administrativas
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-bold">
                {auditLogs.length} registros
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Nenhum registro de auditoria encontrado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.metadata?.actor_name ||
                            log.user?.nome ||
                            "Administrador"}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-brand-600 dark:text-brand-400 font-semibold">
                          {log.action}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {log.metadata?.target_name
                          ? `Alvo: ${log.metadata.target_name}`
                          : ""}
                        {log.metadata?.league_name
                          ? ` • Liga: ${log.metadata.league_name}`
                          : ""}
                        {log.metadata?.from_league && log.metadata?.to_league
                          ? ` • Transferido de "${log.metadata.from_league}" para "${log.metadata.to_league}"`
                          : ""}
                        {log.metadata?.role
                          ? ` • Papel: ${log.metadata.role}`
                          : ""}
                        {log.metadata?.rating
                          ? ` • Nota: ${log.metadata.rating}/10`
                          : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ──────────────────────────────────────────────────────────────────────
          MODAIS ADMINISTRATIVOS INTEGRADOS
      ────────────────────────────────────────────────────────────────────── */}

      {/* Modal de Gerenciamento de Ligas e Vínculos */}
      <ManageUserLeaguesModal
        isOpen={isManageLeaguesModalOpen}
        onClose={() => {
          setIsManageLeaguesModalOpen(false);
          setManageLeaguesUser(null);
        }}
        targetUser={manageLeaguesUser}
        userMemberships={manageLeaguesUser?.organization_memberships || []}
        allLeagues={leaguesList}
        onMembershipsUpdated={loadData}
      />

      {/* Modal de Avaliação de Qualidade */}
      <PlayerRatingModal
        isOpen={isRatingModalOpen}
        onClose={() => {
          setIsRatingModalOpen(false);
          setSelectedRatingUser(null);
          setSelectedRatingLeagueId(null);
          setSelectedRatingLeagueName(null);
          setSelectedRatingInitial(null);
        }}
        targetUser={selectedRatingUser}
        leagueId={selectedRatingLeagueId}
        leagueName={selectedRatingLeagueName}
        initialRating={selectedRatingInitial}
        onRatingUpdated={handleRatingUpdated}
      />

      {/* Modal de Exclusão Segura de Usuário */}
      <DeleteUserConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        targetUser={userToDelete}
        currentUserId={user?.id}
        onUserDeleted={loadData}
      />

      {/* Modal de Alteração de Cargo Global (Super Admin) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Alterar Nível de Acesso
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {selectedUser.nome}
              </p>
              <p className="text-[11px] text-slate-500">
                📱 {formatPhoneDisplay(selectedUser.whatsapp)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Selecione o novo cargo:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["player", "admin", "super_admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRole(r)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedRole === r
                        ? "bg-brand-500 text-white shadow-md"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {getRoleLabel(r)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRoleChange}
                disabled={isUpdatingRole}
                className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-xl text-xs shadow-md cursor-pointer"
              >
                {isUpdatingRole ? "Salvando..." : "Salvar Alteração"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Bloqueio de Liga (Super Admin) */}
      {leagueToToggleBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              {leagueToToggleBlock.is_blocked
                ? "Desbloquear Liga"
                : "Bloquear Liga"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {leagueToToggleBlock.is_blocked
                ? `Deseja reativar a liga "${leagueToToggleBlock.name}"?`
                : `Ao bloquear a liga "${leagueToToggleBlock.name}", partidas e novos cadastros ficarão suspensos.`}
            </p>

            {!leagueToToggleBlock.is_blocked && (
              <input
                type="text"
                placeholder="Motivo do bloqueio (opcional)..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setLeagueToToggleBlock(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteToggleLeagueBlock}
                disabled={isProcessingLeagueBlock}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl text-xs shadow-md cursor-pointer"
              >
                {isProcessingLeagueBlock ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Bloqueio/Desbloqueio de Criação de Ligas (Super Admin) */}
      {adminToToggleCreation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {adminToToggleCreation.can_create_leagues === false ? (
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                    <Unlock className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
                    <Ban className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    {adminToToggleCreation.can_create_leagues === false
                      ? "Liberar Criação de Ligas"
                      : "Bloquear Criação de Ligas"}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Controle de Administrador
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAdminToToggleCreation(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dados do Administrador Alvo */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500 font-black text-sm shrink-0 overflow-hidden">
                {adminToToggleCreation.avatar_url ? (
                  <img
                    src={adminToToggleCreation.avatar_url}
                    alt={adminToToggleCreation.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  adminToToggleCreation.nome.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {adminToToggleCreation.nome}
                  {adminToToggleCreation.apelido && (
                    <span className="text-slate-400 font-semibold ml-1">
                      ({adminToToggleCreation.apelido})
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  📱 {formatPhoneDisplay(adminToToggleCreation.whatsapp)}
                </p>
              </div>
            </div>

            {/* Explicação da Ação */}
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                adminToToggleCreation.can_create_leagues === false
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
              }`}
            >
              {adminToToggleCreation.can_create_leagues === false ? (
                <p>
                  Ao <strong>liberar a criação</strong>, este administrador poderá
                  cadastrar novas ligas normalmente no sistema através do botão &ldquo;Nova Liga&rdquo;.
                </p>
              ) : (
                <p>
                  Ao <strong>bloquear a criação</strong>, este administrador não
                  poderá mais criar novas ligas no sistema. As ligas e partidas já
                  existentes sob sua responsabilidade continuarão ativas normalmente.
                </p>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAdminToToggleCreation(null)}
                disabled={isProcessingCreationToggle}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteToggleCreation}
                disabled={isProcessingCreationToggle}
                className={`flex-1 py-2.5 text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  adminToToggleCreation.can_create_leagues === false
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {isProcessingCreationToggle ? (
                  <span>Processando...</span>
                ) : adminToToggleCreation.can_create_leagues === false ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Liberar Criação</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirmar Bloqueio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
