"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { LightboxPreviewData } from "@/components/ImageLightboxModal";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Calendar,
  MessageSquare,
  Trophy,
  Users,
  User,
  Edit3,
  ChevronRight,
  ChevronDown,
  Zap,
  Dices,
  QrCode,
  MessageCircle,
  Sparkles,
  Search,
  PlusCircle,
  ArrowLeft,
  Shield,
  Star,
  Activity,
  Compass,
  Award,
  Flame,
  Layers,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLeague } from "@/context/LeagueContext";
import { motion, AnimatePresence } from "framer-motion";
import { League, Profile } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const LoginModal = dynamic(
  () => import("@/components/LoginModal").then((module) => module.LoginModal),
  { ssr: false },
);
const CreatePostModal = dynamic(
  () => import("@/components/CreatePostModal").then((module) => module.CreatePostModal),
  { ssr: false },
);
const CreateMatchModal = dynamic(
  () => import("@/components/CreateMatchModal").then((module) => module.CreateMatchModal),
  { ssr: false },
);
const AdminPanelModal = dynamic(
  () => import("@/components/AdminPanelModal").then((module) => module.AdminPanelModal),
  { ssr: false },
);
const EditProfileModal = dynamic(
  () => import("@/components/EditProfileModal").then((module) => module.EditProfileModal),
  { ssr: false },
);
const CreateLeagueModal = dynamic(
  () => import("@/components/CreateLeagueModal").then((module) => module.CreateLeagueModal),
  { ssr: false },
);
const EditLeagueModal = dynamic(
  () => import("@/components/EditLeagueModal").then((module) => module.EditLeagueModal),
  { ssr: false },
);
const BlockedLeagueModal = dynamic(
  () => import("@/components/BlockedLeagueModal").then((module) => module.BlockedLeagueModal),
  { ssr: false },
);
const JoinLeaguePasswordModal = dynamic(
  () => import("@/components/JoinLeaguePasswordModal").then((module) => module.JoinLeaguePasswordModal),
  { ssr: false },
);
const ImageLightboxModal = dynamic(
  () => import("@/components/ImageLightboxModal").then((module) => module.ImageLightboxModal),
  { ssr: false },
);
const FeedSection = dynamic(
  () => import("@/components/FeedSection").then((m) => m.FeedSection),
  { ssr: false },
);
const MatchListSection = dynamic(
  () => import("@/components/MatchListSection").then((m) => m.MatchListSection),
  { ssr: false },
);
const StandingsTable = dynamic(
  () => import("@/components/StandingsTable").then((m) => m.StandingsTable),
  { ssr: false },
);
const LeagueIndividualRankings = dynamic(
  () => import("@/components/LeagueIndividualRankings").then((m) => m.LeagueIndividualRankings),
  { ssr: false },
);
const TournamentListSection = dynamic(
  () => import("@/components/tournaments/TournamentListSection").then((m) => m.TournamentListSection),
  { ssr: false },
);
const LeagueCard = dynamic(
  () => import("@/components/LeagueCard").then((m) => m.LeagueCard),
  { ssr: false },
);
const LeagueSelector = dynamic(
  () => import("@/components/LeagueSelector").then((m) => m.LeagueSelector),
  { ssr: false },
);

export default function Home() {
  const router = useRouter();
  const { user, refreshUser, isSuperAdmin, isAdmin, isLoading: isAuthLoading } = useAuth();
  const {
    leagues,
    currentLeague,
    userMemberLeagueIds,
    userAdminLeagueIds,
    selectLeague,
    clearSelectedLeague,
    activeTab,
    setActiveTab,
    isLoading: isLeaguesLoading,
    canManageLeague,
    canCreateLeagues,
    joinLeagueWithPassword,
  } = useLeague();

  // Abas dentro do Ambiente da Liga Ativa
  const leagueTab = activeTab;
  const setLeagueTab = setActiveTab;

  // Estados dos acordeões das categorias de ligas (recolhidos por padrão)
  const [openAccordions, setOpenAccordions] = useState<{
    member: boolean;
    admin: boolean;
    explore: boolean;
  }>({
    member: false,
    admin: false,
    explore: false,
  });

  const toggleAccordion = (section: "member" | "admin" | "explore") => {
    setOpenAccordions((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Estatísticas reais do usuário para a mini dashboard com separação estrita por modalidade
  const [userStats, setUserStats] = useState<{
    matchesCount: number;
    futebolMatchesCount: number;
    voleiMatchesCount: number;
    futebolGoalsCount: number;
    voleiPointsCount: number;
    mvpCount: number;
  }>({
    matchesCount: 0,
    futebolMatchesCount: 0,
    voleiMatchesCount: 0,
    futebolGoalsCount: 0,
    voleiPointsCount: 0,
    mvpCount: 0,
  });

  useEffect(() => {
    // Só busca stats quando a dashboard pessoal está visível (sem liga selecionada)
    if (!user?.id || currentLeague) return;
    const fetchUserStats = async () => {
      try {
        const [
          { data: partsData },
          { data: goalsData },
          { count: mvpCount },
        ] = await Promise.all([
          supabase
            .from("match_participants")
            .select("match:match_id(sport_type)")
            .eq("user_id", user.id),
          supabase
            .from("match_game_goals")
            .select("match:match_id(sport_type)")
            .eq("player_id", user.id),
          supabase
            .from("timeline_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("event_type", "became_mvp"),
        ]);

        let futebolMatches = 0;
        let voleiMatches = 0;
        (partsData || []).forEach((p: any) => {
          const sport = p.match?.sport_type;
          if (sport === "volei") {
            voleiMatches += 1;
          } else {
            futebolMatches += 1;
          }
        });

        let futebolGoals = 0;
        let voleiPoints = 0;
        (goalsData || []).forEach((g: any) => {
          const sport = g.match?.sport_type;
          if (sport === "volei") {
            voleiPoints += 1;
          } else {
            futebolGoals += 1;
          }
        });

        setUserStats({
          matchesCount: (partsData || []).length,
          futebolMatchesCount: futebolMatches,
          voleiMatchesCount: voleiMatches,
          futebolGoalsCount: futebolGoals,
          voleiPointsCount: voleiPoints,
          mvpCount: mvpCount || 0,
        });
      } catch (err) {
        console.error("Erro ao carregar resumo de atividades:", err);
      }
    };

    void fetchUserStats();
  }, [user?.id, currentLeague]);

    // Sincronizar abertura do acordeão de exploração de ligas via URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("explore") === "1") {
      setOpenAccordions((prev) => ({ ...prev, explore: true }));
    }
  }, []);

  // A resenha é uma área autenticada. Links antigos com ?tab=feed voltam
  // para partidas assim que a autenticação inicial terminar de carregar.
  useEffect(() => {
    if (!isAuthLoading && !user && leagueTab === "feed") {
      setLeagueTab("matches");
    }
  }, [isAuthLoading, user, leagueTab]);

  // Modais de Controle
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginInitialMode, setLoginInitialMode] = useState<"login" | "register">("register");

  const openRegisterModal = () => {
    setLoginInitialMode("register");
    setIsLoginOpen(true);
  };
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isEditLeagueOpen, setIsEditLeagueOpen] = useState(false);
  const [leagueToEdit, setLeagueToEdit] = useState<League | null>(null);
  const [blockedLeagueToView, setBlockedLeagueToView] = useState<League | null>(null);
  const [leagueToEnterWithPassword, setLeagueToEnterWithPassword] = useState<League | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [leagueLightboxData, setLeagueLightboxData] = useState<LightboxPreviewData | null>(null);
  const [leagueSearchTerm, setLeagueSearchTerm] = useState("");

  // Membros da Liga Ativa
  const [leagueMembers, setLeagueMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Carregar membros da liga ativa quando a aba "members" for acessada
  useEffect(() => {
    if (!currentLeague?.id || leagueTab !== "members") return;

    const fetchLeagueMembers = async () => {
      setLoadingMembers(true);
      try {
        const { data, error } = await supabase
          .from("organization_members")
          .select(`
            id,
            role,
            nivel_qualidade,
            created_at,
            user:user_id(*)
          `)
          .eq("organization_id", currentLeague.id)
          .order("created_at", { ascending: true });

        if (!error && data) {
          setLeagueMembers(data);
        } else {
          setLeagueMembers([]);
        }
      } catch (err) {
        console.error("Erro ao buscar participantes da liga:", err);
      } finally {
        setLoadingMembers(false);
      }
    };

    void fetchLeagueMembers();
  }, [currentLeague?.id, leagueTab]);

  const handleSelectMatch = (matchId: string) => {
    router.push(`/matches/${matchId}`);
  };

  const handlePreviewLeagueLogo = (league: League) => {
    if (!league.logo_url) return;
    setLeagueLightboxData({
      isOpen: true,
      imageUrl: league.logo_url,
      title: league.name,
      subtitle:
        league.description ||
        (league.owner?.nome
          ? `Organizador: ${league.owner.nome}${league.owner.apelido ? ` (${league.owner.apelido})` : ""}`
          : "Liga Oficial"),
      badge:
        league.matches_count !== undefined
          ? `${league.matches_count} ${league.matches_count === 1 ? "partida agendada" : "partidas agendadas"}`
          : "Liga Oficial",
      badgeColor: league.sport_type === "volei" ? "amber" : "emerald",
      type: "league_logo",
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  // CLASSIFICAÇÃO DAS LIGAS CONFORME O VÍNCULO DO USUÁRIO
  // ═══════════════════════════════════════════════════════════════════

  // 1. "Ligas que Administro" -> O usuário possui permissão administrativa (Dono, Admin ou Super Admin)
  const adminLeagues = useMemo(() => {
    if (!user) return [];
    return leagues.filter((lg) => {
      if (isSuperAdmin) return true;
      return lg.owner_id === user.id || userAdminLeagueIds.includes(lg.id);
    });
  }, [leagues, user, isSuperAdmin, userAdminLeagueIds]);

  // 2. "Minhas Ligas" -> O usuário participa como membro/jogador e NÃO é administrador desta liga
  const memberLeagues = useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) return []; // Super Admin já gerencia todas na seção de administração
    return leagues.filter((lg) => {
      const isAdm = lg.owner_id === user.id || userAdminLeagueIds.includes(lg.id);
      if (isAdm) return false; // Prioridade para "Ligas que Administro" (sem duplicidade)
      return userMemberLeagueIds.includes(lg.id);
    });
  }, [leagues, user, isSuperAdmin, userAdminLeagueIds, userMemberLeagueIds]);

  // 3. "Explorar Ligas" -> Ligas disponíveis onde o usuário NÃO possui nenhum vínculo
  const exploreLeagues = useMemo(() => {
    if (!user) return leagues;
    if (isSuperAdmin) return []; // Super Admin já possui acesso a todas
    return leagues.filter((lg) => {
      const isAdm = lg.owner_id === user.id || userAdminLeagueIds.includes(lg.id);
      const isMbr = userMemberLeagueIds.includes(lg.id);
      return !isAdm && !isMbr;
    });
  }, [leagues, user, isSuperAdmin, userAdminLeagueIds, userMemberLeagueIds]);

  // Função auxiliar de busca
  const filterListBySearch = (list: League[]) => {
    const query = leagueSearchTerm.toLowerCase().trim();
    if (!query) return list;
    return list.filter((lg) => {
      return (
        lg.name.toLowerCase().includes(query) ||
        (lg.description && lg.description.toLowerCase().includes(query)) ||
        (lg.owner?.nome && lg.owner.nome.toLowerCase().includes(query)) ||
        (lg.owner?.apelido && lg.owner.apelido.toLowerCase().includes(query)) ||
        (lg.sport_type && lg.sport_type.toLowerCase().includes(query))
      );
    });
  };

  const filteredAdminLeagues = useMemo(() => filterListBySearch(adminLeagues), [adminLeagues, leagueSearchTerm]);
  const filteredMemberLeagues = useMemo(() => filterListBySearch(memberLeagues), [memberLeagues, leagueSearchTerm]);
  const filteredExploreLeagues = useMemo(() => filterListBySearch(exploreLeagues), [exploreLeagues, leagueSearchTerm]);

  // Total de ligas em que o usuário participa
  const userTotalLeagues = memberLeagues.length + adminLeagues.length;

  // Total geral de ligas encontradas na busca
  const totalFilteredCount = filteredAdminLeagues.length + filteredMemberLeagues.length + filteredExploreLeagues.length;
  const isSearching = Boolean(leagueSearchTerm.trim().length > 0);

  // Status de abertura (se estiver buscando, abre automaticamente as que contêm resultados; caso contrário, segue o estado do acordeão)
  const isMemberExpanded = isSearching ? filteredMemberLeagues.length > 0 : openAccordions.member;
  const isAdminExpanded = isSearching ? filteredAdminLeagues.length > 0 : openAccordions.admin;
  const isExploreExpanded = isSearching ? filteredExploreLeagues.length > 0 : openAccordions.explore;

  // Primeiro nome para saudação acolhedora
  const userFirstName = user?.nome ? user.nome.trim().split(" ")[0] : "Atleta";
  const isCurrentLeagueVolei = currentLeague?.sport_type === "volei";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Header
        onOpenLogin={openRegisterModal}
        onOpenCreatePost={() => setIsCreatePostOpen(true)}
        onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          ESTADO 1: VISITANTE (NÃO AUTENTICADO) — LANDING PAGE PÚBLICA
      ═══════════════════════════════════════════════════════════════════ */}
      {!user && (
        <div className="flex-1 flex flex-col">
          {/* HERO SECTION DE APRESENTAÇÃO PÚBLICA */}
          <section className="relative isolate overflow-hidden border-b border-emerald-900/40 bg-[#05110a] text-white py-14 sm:py-20 lg:py-24">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.22),transparent_70%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(34,197,94,0.1),transparent_60%)]" />
            <div className="pointer-events-none absolute -right-12 top-6 opacity-[0.03] select-none">
              <Trophy className="h-80 w-80 text-emerald-400" />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6 sm:space-y-8"
              >
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-black uppercase tracking-wider backdrop-blur-md">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Futebol ⚽ • Vôlei 🏐 • Multi-Esportes</span>
                  </div>
                  <span className="block text-xl sm:text-3xl lg:text-4xl text-slate-200 font-black italic tracking-wider">
                    CHEGOU A HORA DE
                  </span>
                  <span className="block text-4xl sm:text-6xl lg:text-7xl font-black italic uppercase tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(16,185,129,0.35)] leading-none">
                    VIVER O ESPORTE!
                  </span>
                </div>

                <p className="text-sm sm:text-base lg:text-lg text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto">
                  A plataforma completa para organizar, participar e gerenciar suas ligas esportivas.
                  Confirmação no WhatsApp, sorteio com raspadinha virtual de times, PIX direto e placar em tempo real.{" "}
                  <span className="text-emerald-400 font-bold">
                    Simples, rápido e 100% otimizado para celular.
                  </span>
                </p>

                {/* Botão Principal de Login / Cadastro */}
                <div className="w-full max-w-md pt-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={openRegisterModal}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-base sm:text-lg shadow-xl shadow-emerald-500/30 transition-all cursor-pointer group"
                  >
                    <MessageCircle className="w-6 h-6 text-white" />
                    <span>Cadastre-se Grátis com WhatsApp</span>
                    <ChevronRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-2">
                    Crie sua conta em 30 segundos • 100% Gratuito e sem senhas
                  </p>
                </div>

                {/* Barra de 4 Recursos em Cápsula */}
                <div className="w-full pt-4 sm:pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/40 backdrop-blur-md shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1.5">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Confirme no</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-300">WhatsApp</span>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/40 backdrop-blur-md shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 mb-1.5">
                        <Dices className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Raspadinha &</span>
                      <span className="text-xs sm:text-sm font-black text-amber-300">Sorteio de Times</span>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/40 backdrop-blur-md shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 mb-1.5">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Pagamento</span>
                      <span className="text-xs sm:text-sm font-black text-teal-300">via PIX</span>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/40 backdrop-blur-md shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1.5">
                        <Zap className="w-4 h-4 fill-emerald-400" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Placar ao Vivo</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-300">Tempo Real</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* SEÇÃO MODALIDADES: FUTEBOL & VÔLEI */}
          <section className="py-12 sm:py-16 px-4 max-w-5xl mx-auto w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Multi-Esportes Integrado
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Feito para quem Ama o Esporte
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto">
                Toda a estrutura necessária para partidas casuais, peladas semanais ou torneios completos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Card Futebol */}
              <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-white via-emerald-50/40 to-white dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 p-6 sm:p-8 shadow-lg space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-sm">
                  ⚽
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Futebol & Peladas
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                    Liga de Futebol
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Gerencie gols, assistências, cartões, artilharia individual, sorteio com raspadinha interativa,
                  melhor da partida (MVP) e o divertido <strong>Mural do ANINGA 🐍</strong>.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">⚽ Artilharia</span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">👟 Assistências</span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">🏆 MVP</span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">🎰 Raspadinha</span>
                </div>
              </div>

              {/* Card Vôlei */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-white via-amber-50/40 to-white dark:from-slate-900 dark:via-amber-950/20 dark:to-slate-900 p-6 sm:p-8 shadow-lg space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-3xl shadow-sm">
                  🏐
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Vôlei de Quadra & Areia
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                    Liga de Vôlei
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Placar ao vivo ponto a ponto, controle de sets, contagem de aces, bloqueios,
                  pontuadores da rodada e estatísticas exclusivas para equipes de vôlei.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">🏐 Pontos</span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">⚡ Aces</span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">🛡️ Bloqueios</span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">📈 Sets ao Vivo</span>
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO COMO FUNCIONA (PASSO A PASSO) */}
          <section className="py-12 sm:py-16 px-4 bg-slate-100/70 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800">
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Simples & Rápido
                </span>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Como Funciona o F&V Sports
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                    01
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Cadastre-se Grátis
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Crie sua conta em 30 segundos usando seu WhatsApp, sem senhas complicadas.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                    02
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Escolha sua Liga
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Entre no ambiente exclusivo da sua turma ou crie sua própria liga esportiva.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                    03
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Garanta sua Vaga
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Confirme presença, faça a raspadinha para descobrir seu time e pague pelo PIX.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                    04
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Viva o Jogo
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Acompanhe o placar ao vivo, veja o time campeão, artilheiros e fotos na resenha.
                  </p>
                </div>
              </div>

              <div className="text-center pt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={openRegisterModal}
                  className="w-full sm:w-auto max-w-md mx-auto px-7 sm:px-9 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-500/25 inline-flex items-center justify-center gap-2.5 cursor-pointer transition-all"
                >
                  <MessageCircle className="w-5 h-5 shrink-0" />
                  <span>Criar Minha Conta Grátis</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </motion.button>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
                  Participe das peladas da sua turma ou crie sua própria liga esportiva
                </p>
              </div>
            </div>
          </section>

          {/* FOOTER EXCLUSIVO DA PÁGINA PÚBLICA */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center space-y-1 mt-auto">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5">
              <span>🏆</span>
              <span className="font-black">F&V Sports</span>
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium max-w-sm mx-auto">
              Partidas de futebol e vôlei com confirmação pelo WhatsApp, raspadinha de times, PIX e rankings.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              © 2026 F&V Sports • Todos os direitos reservados
            </p>
          </footer>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ESTADO 2: DASHBOARD PESSOAL DO USUÁRIO — BOAS-VINDAS, ATIVIDADES E LIGAS
      ═══════════════════════════════════════════════════════════════════ */}
      {user && !currentLeague && (
        <main className="mx-auto w-full max-w-4xl flex-1 px-3.5 sm:px-4 py-5 sm:py-8 space-y-6 sm:space-y-7">
          {/* ═══════════════════════════════════════════════════════════════
              1 & 2: SEÇÃO DE BOAS-VINDAS E CARD PESSOAL DO JOGADOR
          ═══════════════════════════════════════════════════════════════ */}
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white via-slate-50 to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border border-slate-200/90 dark:border-slate-800 shadow-md backdrop-blur-md p-5 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {/* Avatar Maior e Destacado */}
                <div className="relative shrink-0">
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.nome || "Atleta"}
                      width={80}
                      height={80}
                      priority
                      unoptimized={user.avatar_url.startsWith('blob:') || user.avatar_url.startsWith('data:')}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover border-2 border-emerald-500/50 ring-4 ring-emerald-500/15 shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 flex items-center justify-center text-white font-black text-2xl sm:text-3xl border-2 border-emerald-400/50 ring-4 ring-emerald-500/15 shadow-md">
                      {userFirstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-xl bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-[10px] shadow-sm">
                    ⚽
                  </div>
                </div>

                {/* Saudação Humanizada e Dinâmica */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                      Olá, {userFirstName}! 👋
                    </h1>
                    {user.apelido && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                        {user.apelido}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    Que bom ter você por aqui!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed max-w-lg hidden sm:block">
                    Organize suas partidas, acompanhe suas ligas e venha viver a resenha com a galera. ⚽🏐
                  </p>
                </div>
              </div>

              {/* Botões Discretos e Modernos de Perfil */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
                <Link
                  href={`/profile/${user.id}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs font-black text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-xs"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Ver Perfil</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Editar Perfil</span>
                </button>
              </div>
            </div>

            {/* Texto Motivacional no Mobile */}
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed sm:hidden pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
              Organize suas partidas, acompanhe suas ligas e venha viver a resenha com a galera. ⚽🏐
            </p>

            {/* ═══════════════════════════════════════════════════════════
                3: PEQUENA ÁREA DE RESUMO (DADOS REAIS DE ATIVIDADES)
            ═══════════════════════════════════════════════════════════════ */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Suas Atividades
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>Ativo</span>
                </span>
              </div>

              <div
                className={`grid ${
                  userStats.futebolGoalsCount > 0 && userStats.voleiPointsCount > 0
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-3"
                } gap-2 sm:gap-3`}
              >
                {/* Ligas */}
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80 flex flex-col items-center justify-center text-center shadow-xs">
                  <span className="text-sm sm:text-base">🏆</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {userTotalLeagues} {userTotalLeagues === 1 ? "Liga" : "Ligas"}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                    Cadastradas
                  </span>
                </div>

                {/* Partidas */}
                <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80 flex flex-col items-center justify-center text-center shadow-xs">
                  <span className="text-sm sm:text-base">⚡</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {userStats.matchesCount}{" "}
                    {userStats.matchesCount === 1 ? "Partida" : "Partidas"}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                    Disputadas
                  </span>
                </div>

                {/* Gols Marcados (Futebol) */}
                {(userStats.futebolGoalsCount > 0 || userStats.voleiPointsCount === 0) && (
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-emerald-500/20 dark:border-emerald-500/20 flex flex-col items-center justify-center text-center shadow-xs">
                    <span className="text-sm sm:text-base">⚽</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {userStats.futebolGoalsCount}{" "}
                      {userStats.futebolGoalsCount === 1 ? "Gol" : "Gols"}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                      Gols Marcados
                    </span>
                  </div>
                )}

                {/* Pontos Marcados (Vôlei) */}
                {userStats.voleiPointsCount > 0 && (
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-950/60 border border-amber-500/20 dark:border-amber-500/20 flex flex-col items-center justify-center text-center shadow-xs">
                    <span className="text-sm sm:text-base">🏐</span>
                    <span className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {userStats.voleiPointsCount}{" "}
                      {userStats.voleiPointsCount === 1 ? "Ponto" : "Pontos"}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                      Pontos Marcados
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              7: CAMPO DE PESQUISA MODERNO
          ═══════════════════════════════════════════════════════════════ */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-emerald-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="🔎 Buscar ligas por nome, modalidade ou organizador..."
              value={leagueSearchTerm}
              onChange={(e) => setLeagueSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm font-medium transition-all"
            />
            {leagueSearchTerm && (
              <button
                onClick={() => setLeagueSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Limpar
              </button>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              4, 5 & 6: ACORDEÕES EXPANSÍVEIS DE LIGAS COM DIFERENCIAÇÃO VISUAL
          ═══════════════════════════════════════════════════════════════ */}
          {isLeaguesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 animate-pulse flex items-center justify-between"
                >
                  <div className="w-48 h-6 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : totalFilteredCount === 0 && leagueSearchTerm ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl text-slate-400">
                🔍
              </div>
              <h3 className="font-black text-base sm:text-lg text-slate-800 dark:text-slate-200">
                Nenhuma liga encontrada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Nenhuma liga corresponde à busca por "{leagueSearchTerm}".
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {/* ═══════════════════════════════════════════════════════════════
                  ACORDEÃO 1: 🏆 MINHAS LIGAS (Ligas das quais participo)
              ═══════════════════════════════════════════════════════════════ */}
              <div
                className={`rounded-[2rem] border transition-all duration-300 overflow-hidden shadow-xs ${
                  isMemberExpanded
                    ? "border-emerald-500/50 bg-white/95 dark:bg-slate-900/95 shadow-md shadow-emerald-500/5"
                    : "border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:border-emerald-500/30"
                }`}
              >
                {/* Cabeçalho Clicável do Acordeão */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleAccordion("member")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAccordion("member");
                    }
                  }}
                  aria-expanded={isMemberExpanded}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left cursor-pointer group select-none transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-lg sm:text-xl font-black shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                      🏆
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Minhas Ligas
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                          {filteredMemberLeagues.length}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">
                        Suas ligas e partidas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 hidden sm:inline group-hover:text-emerald-500 transition-colors">
                      {isMemberExpanded ? "Recolher" : `Ver ${filteredMemberLeagues.length}`}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-transform duration-300 ${
                        isMemberExpanded ? "rotate-180 bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : ""
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Conteúdo Expansível das Ligas */}
                <AnimatePresence initial={false}>
                  {isMemberExpanded && (
                    <motion.div
                      key="member-leagues-content"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: 1,
                        height: "auto",
                        transition: {
                          height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                          opacity: { duration: 0.25, delay: 0.05 },
                        },
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                        transition: {
                          height: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
                          opacity: { duration: 0.15 },
                        },
                      }}
                      className="overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30 p-4 sm:p-5"
                    >
                      {filteredMemberLeagues.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                          {filteredMemberLeagues.map((lg) => (
                            <LeagueCard
                              key={lg.id}
                              league={lg}
                              onSelect={(selected) => {
                                if (selected.is_blocked) {
                                  setBlockedLeagueToView(selected);
                                } else {
                                  selectLeague(selected.id);
                                }
                              }}
                              onPreviewLogo={handlePreviewLeagueLogo}
                            />
                          ))}
                        </div>
                      ) : (
                        /* 9: ESTADO VAZIO BONITO E ACOLHEDOR */
                        <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-2xl flex items-center justify-center mx-auto">
                            🏆
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200">
                              Você ainda não participa de nenhuma liga
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                              Explore as ligas disponíveis e encontre sua próxima resenha esportiva!
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenAccordions((prev) => ({ ...prev, explore: true }));
                            }}
                            className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md inline-flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Explorar Ligas Disponíveis</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  ACORDEÃO 2: ⚙️ LIGAS QUE ADMINISTRO (Permissão Administrativa)
              ═══════════════════════════════════════════════════════════════ */}
              {(filteredAdminLeagues.length > 0 || canCreateLeagues || isSuperAdmin || isAdmin) && (
                <div
                  className={`rounded-[2rem] border transition-all duration-300 overflow-hidden shadow-xs ${
                    isAdminExpanded
                      ? "border-amber-500/50 bg-white/95 dark:bg-slate-900/95 shadow-md shadow-amber-500/5"
                      : "border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:border-amber-500/30"
                  }`}
                >
                  {/* Cabeçalho Clicável do Acordeão */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleAccordion("admin")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleAccordion("admin");
                      }
                    }}
                    aria-expanded={isAdminExpanded}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left cursor-pointer group select-none transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 text-lg sm:text-xl font-black shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                        ⚙️
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            Ligas que Administro
                          </h2>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
                            {filteredAdminLeagues.length}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">
                          Ligas nas quais possuo permissão administrativa
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canCreateLeagues && (
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCreateLeagueOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-sm flex items-center gap-1 cursor-pointer"
                          title="Cadastrar uma nova Liga"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Criar Liga</span>
                        </motion.button>
                      )}

                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 hidden sm:inline group-hover:text-amber-500 transition-colors">
                        {isAdminExpanded ? "Recolher" : `Ver ${filteredAdminLeagues.length}`}
                      </span>

                      <div
                        className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-transform duration-300 ${
                          isAdminExpanded ? "rotate-180 bg-amber-500/15 text-amber-600 border-amber-500/30" : ""
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo Expansível das Ligas Administradas */}
                  <AnimatePresence initial={false}>
                    {isAdminExpanded && (
                      <motion.div
                        key="admin-leagues-content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                          transition: {
                            height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                            opacity: { duration: 0.25, delay: 0.05 },
                          },
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          transition: {
                            height: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
                            opacity: { duration: 0.15 },
                          },
                        }}
                        className="overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30 p-4 sm:p-5"
                      >
                        {filteredAdminLeagues.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            {filteredAdminLeagues.map((lg) => (
                              <LeagueCard
                                key={lg.id}
                                league={lg}
                                onSelect={(selected) => {
                                  selectLeague(selected.id);
                                }}
                                onEdit={(toEdit) => {
                                  setLeagueToEdit(toEdit);
                                  setIsEditLeagueOpen(true);
                                }}
                                onPreviewLogo={handlePreviewLeagueLogo}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-2xl flex items-center justify-center mx-auto text-amber-500">
                              ⚙️
                            </div>
                            <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200">
                              Você ainda não criou nenhuma liga
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                              Crie sua primeira liga esportiva para organizar partidas, equipes e gerenciar participantes.
                            </p>
                            {canCreateLeagues && (
                              <button
                                type="button"
                                onClick={() => setIsCreateLeagueOpen(true)}
                                className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md inline-flex items-center gap-1.5 mt-1 cursor-pointer transition-all"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Criar Nova Liga Agora</span>
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  ACORDEÃO 3: 🌎 EXPLORAR LIGAS (Descubra Novas Ligas)
              ═══════════════════════════════════════════════════════════════ */}
              {!isSuperAdmin && (
                <div
                  className={`rounded-[2rem] border transition-all duration-300 overflow-hidden shadow-xs ${
                    isExploreExpanded
                      ? "border-blue-500/50 bg-white/95 dark:bg-slate-900/95 shadow-md shadow-blue-500/5"
                      : "border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:border-blue-500/30"
                  }`}
                >
                  {/* Cabeçalho Clicável do Acordeão */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleAccordion("explore")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleAccordion("explore");
                      }
                    }}
                    aria-expanded={isExploreExpanded}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left cursor-pointer group select-none transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 text-lg sm:text-xl font-black shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                        🌎
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Explorar Ligas
                          </h2>
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-black">
                            {filteredExploreLeagues.length}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1 mt-0.5">
                          Descubra novas ligas e participe da resenha
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 hidden sm:inline group-hover:text-blue-500 transition-colors">
                        {isExploreExpanded ? "Recolher" : `Ver ${filteredExploreLeagues.length}`}
                      </span>

                      <div
                        className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-transform duration-300 ${
                          isExploreExpanded ? "rotate-180 bg-blue-500/15 text-blue-600 border-blue-500/30" : ""
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo Expansível de Explorar Ligas */}
                  <AnimatePresence initial={false}>
                    {isExploreExpanded && (
                      <motion.div
                        key="explore-leagues-content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                          transition: {
                            height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                            opacity: { duration: 0.25, delay: 0.05 },
                          },
                        }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          transition: {
                            height: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
                            opacity: { duration: 0.15 },
                          },
                        }}
                        className="overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30 p-4 sm:p-5"
                      >
                        {filteredExploreLeagues.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            {filteredExploreLeagues.map((lg) => (
                              <LeagueCard
                                key={lg.id}
                                league={lg}
                                onSelect={(selected) => {
                                  if (selected.is_blocked) {
                                    setBlockedLeagueToView(selected);
                                  } else if (selected.has_password) {
                                    setLeagueToEnterWithPassword(selected);
                                    setIsPasswordModalOpen(true);
                                  } else {
                                    selectLeague(selected.id);
                                  }
                                }}
                                onPreviewLogo={handlePreviewLeagueLogo}
                              />
                            ))}
                          </div>
                        ) : (
                          /* 9: ESTADO VAZIO QUANDO NÃO HÁ MAIS LIGAS PARA EXPLORAR */
                          <div className="p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-2xl flex items-center justify-center mx-auto text-blue-500">
                              🌎
                            </div>
                            <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200">
                              Nenhuma nova liga encontrada
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                              {leagueSearchTerm
                                ? "Nenhuma liga encontrada com os termos pesquisados."
                                : "No momento você já faz parte de todas as ligas cadastradas no sistema! 🏆"}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ESTADO 3: AMBIENTE INDEPENDENTE DA LIGA (Com Liga Selecionada)
      ═══════════════════════════════════════════════════════════════════ */}
      {user && currentLeague && (
        <main className="mx-auto w-full max-w-4xl flex-1 px-2 py-4 sm:px-4 sm:py-6 space-y-5">
          {/* Botão de Voltar para a Tela "Minhas Ligas" */}
          <div className="flex items-center justify-between gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={clearSelectedLeague}
              className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-200 shadow-xs backdrop-blur-md cursor-pointer text-xs font-black"
              title="Voltar para a lista de Minhas Ligas"
            >
              <div className="w-6 h-6 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500 transition-all">
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white transition-colors" />
              </div>
              <span>← Minhas Ligas</span>
            </motion.button>

            <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 hidden sm:inline">
              Ambiente da Liga: <strong>{currentLeague.name}</strong>
            </span>
          </div>

          {/* Top Card da Liga Ativa */}
          <LeagueSelector
            onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onEditLeague={() => {
              setLeagueToEdit(currentLeague);
              setIsEditLeagueOpen(true);
            }}
            onPreviewLogo={handlePreviewLeagueLogo}
          />

          {/* Alternador de Abas do Ambiente da Liga (Mobile-First com Rolagem Lateral Fluida) */}
          <div className="w-full overflow-x-auto no-scrollbar scrollbar-none scroll-smooth pb-1 pt-0.5">
            <div className="flex items-center justify-start sm:justify-center min-w-full w-max px-3 sm:px-0">
              <SegmentedControl
                id="league-sections"
                ariaLabel="Seções da liga"
                value={leagueTab}
                onValueChange={setLeagueTab}
                scrollActiveIntoView
                className="p-1 sm:p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-1 shrink-0"
                buttonClassName={(_, isActive) =>
                  `min-h-[44px] px-3 sm:px-4.5 py-2 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? isCurrentLeagueVolei
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                        : "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
                options={[
                  { value: "matches", icon: <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: <span>{isCurrentLeagueVolei ? "🏐 Partidas" : "⚽ Partidas"}</span> },
                  { value: "tournaments", icon: <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: <span>🏆 Campeonatos</span> },
                  { value: "standings", icon: <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: <span>🥇 Rankings</span> },
                  ...(user
                    ? [{ value: "feed" as const, icon: <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: <span>📱 Feed</span> }]
                    : []),
                  { value: "members", icon: <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />, label: <span>👥 Jogadores</span> },
                ]}
              />
            </div>
          </div>

          {/* CONTEÚDO DA ABA SELECIONADA */}
          <section className="transition-all duration-300">
            {/* ABA 1: PARTIDAS */}
            {leagueTab === "matches" && (
              <MatchListSection
                onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
                onOpenLogin={() => setIsLoginOpen(true)}
                onSelectMatch={handleSelectMatch}
              />
            )}

            {/* ABA 2: TORNEIOS & CAMPEONATOS */}
            {leagueTab === "tournaments" && (
              <TournamentListSection />
            )}

            {/* ABA 2: RANKINGS & CLASSIFICAÇÃO */}
            {leagueTab === "standings" && (
              <div className="space-y-6">
                <LeagueIndividualRankings league={currentLeague} />
                <div className="pt-4">
                  <StandingsTable
                    leagueId={currentLeague?.id}
                    sportType={currentLeague?.sport_type}
                    numTeams={4}
                    showTopScorers={false}
                  />
                </div>
              </div>
            )}

            {/* ABA 3: FEED & RESENHA EXCLUSIVO DA LIGA */}
            {user && leagueTab === "feed" && (
              <FeedSection
                leagueId={currentLeague?.id}
                leagueName={currentLeague?.name}
                onOpenCreatePost={() => setIsCreatePostOpen(true)}
                onOpenLogin={() => setIsLoginOpen(true)}
                onJoinLeagueRequest={async () => {
                  if (!currentLeague) return;
                  if (currentLeague.is_blocked) {
                    setBlockedLeagueToView(currentLeague);
                  } else if (currentLeague.has_password) {
                    setLeagueToEnterWithPassword(currentLeague);
                    setIsPasswordModalOpen(true);
                  } else {
                    const res = await joinLeagueWithPassword(currentLeague.id);
                    if (res.success) {
                      toast.success('Você entrou na liga com sucesso! 🏆');
                    }
                  }
                }}
              />
            )}

            {/* ABA 4: JOGADORES / PARTICIPANTES DA LIGA */}
            {leagueTab === "members" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                        Participantes da Liga ({leagueMembers.length})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      Atletas e organizadores cadastrados em <strong>{currentLeague.name}</strong>.
                    </p>
                  </div>

                  {/* Convidar Amigos para a Liga */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Fala galera! Venha participar da nossa liga *"${currentLeague.name}"* no F&V Sports! 🏆⚽🏐`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] font-black text-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Convidar no WhatsApp</span>
                  </a>
                </div>

                {loadingMembers ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-pulse space-y-2"
                      >
                        <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="w-1/3 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                    ))}
                  </div>
                ) : leagueMembers.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Nenhum participante listado ainda nesta liga.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {leagueMembers.map((member) => {
                      const athlete: Profile | undefined = member.user;
                      const isOwnerRole = member.role === "owner";
                      const isAdminRole = member.role === "admin";

                      return (
                        <div
                          key={member.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {athlete?.avatar_url ? (
                              <Image
                                src={athlete.avatar_url}
                                alt={athlete.nome || "Atleta"}
                                width={40}
                                height={40}
                                unoptimized={athlete.avatar_url.startsWith('blob:') || athlete.avatar_url.startsWith('data:')}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 font-black text-sm flex items-center justify-center shrink-0">
                                {(athlete?.nome || "A").charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/profile/${athlete?.id}`}
                                  className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-emerald-500 truncate"
                                >
                                  {athlete?.nome || "Atleta"}
                                </Link>
                                {athlete?.apelido && (
                                  <span className="text-[10px] text-emerald-500 font-bold shrink-0">
                                    ({athlete.apelido})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {isOwnerRole
                                  ? "👑 Criador / Dono"
                                  : isAdminRole
                                  ? "🛡️ Organizador"
                                  : "⚽ Jogador"}
                              </span>
                            </div>
                          </div>

                          {athlete?.whatsapp && (
                            <a
                              href={`https://api.whatsapp.com/send?phone=${athlete.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors shrink-0"
                              title="Falar no WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {/* MODAIS GLOBAIS */}
      {isLoginOpen && (
        <LoginModal
          isOpen
          initialMode={loginInitialMode}
          onClose={() => setIsLoginOpen(false)}
        />
      )}

      {isCreatePostOpen && (
        <CreatePostModal
          isOpen
          onClose={() => setIsCreatePostOpen(false)}
          onPostCreated={() => {}}
          leagueId={currentLeague?.id}
          leagueName={currentLeague?.name}
        />
      )}

      {isCreateMatchOpen && (
        <CreateMatchModal
          isOpen
          onClose={() => setIsCreateMatchOpen(false)}
          onMatchCreated={() => {}}
        />
      )}

      {isAdminPanelOpen && (
        <AdminPanelModal isOpen onClose={() => setIsAdminPanelOpen(false)} />
      )}

      {user && isEditProfileOpen && (
        <EditProfileModal
          isOpen
          onClose={() => setIsEditProfileOpen(false)}
          profile={user}
          onProfileUpdated={refreshUser}
        />
      )}

      {/* MODAIS DE GESTÃO DE LIGAS */}
      {isCreateLeagueOpen && (
        <CreateLeagueModal
          isOpen
          onClose={() => setIsCreateLeagueOpen(false)}
          onLeagueCreated={(newLeagueId) => {
            selectLeague(newLeagueId);
            setIsCreateLeagueOpen(false);
          }}
        />
      )}

      {isEditLeagueOpen && leagueToEdit && (
        <EditLeagueModal
          isOpen
          onClose={() => {
            setIsEditLeagueOpen(false);
            setLeagueToEdit(null);
          }}
          league={leagueToEdit}
        />
      )}

      {blockedLeagueToView && (
        <BlockedLeagueModal
          isOpen
          onClose={() => setBlockedLeagueToView(null)}
          league={blockedLeagueToView}
        />
      )}

      {isPasswordModalOpen && leagueToEnterWithPassword && (
        <JoinLeaguePasswordModal
          isOpen
          onClose={() => {
            setIsPasswordModalOpen(false);
            setLeagueToEnterWithPassword(null);
          }}
          league={leagueToEnterWithPassword}
          onPreviewLogo={handlePreviewLeagueLogo}
          onSuccess={(leagueId) => {
            selectLeague(leagueId);
            setIsPasswordModalOpen(false);
            setLeagueToEnterWithPassword(null);
          }}
        />
      )}

      {/* Modal Lightbox para visualização de Foto de Perfil de Ligas */}
      {leagueLightboxData && (
        <ImageLightboxModal
          data={leagueLightboxData}
          onClose={() => setLeagueLightboxData(null)}
        />
      )}
    </div>
  );
}
