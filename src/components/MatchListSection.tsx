"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Match, MatchParticipant } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Search,
  ChevronRight,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Shield,
  Share2,
  Shuffle,
  Sparkles,
  Hand,
  X,
  Info,
  QrCode,
  Navigation,
  Trophy,
  ArrowLeft,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { subscribeToTables } from "@/lib/realtime";
import dynamic from "next/dynamic";
import { MatchCountdown } from "@/components/MatchCountdown";
import { TEAM_COLORS } from "@/constants/teamColors";
import {
  getMatchChampionData,
  MatchChampionResult,
} from "@/lib/championHelper";
import { createNotification } from "@/lib/notifications";
import { motion } from "framer-motion";
import { useLeague } from "@/context/LeagueContext";
import type { LightboxPreviewData } from "@/components/ImageLightboxModal";

const ScratchCardModal = dynamic(
  () => import("@/components/ScratchCardModal").then((m) => m.ScratchCardModal),
  { ssr: false }
);
const PixPaymentModal = dynamic(
  () => import("@/components/PixPaymentModal").then((m) => m.PixPaymentModal),
  { ssr: false }
);
const ChampionModal = dynamic(
  () => import("@/components/ChampionModal").then((m) => m.ChampionModal),
  { ssr: false }
);
const CreateLeagueModal = dynamic(
  () => import("@/components/CreateLeagueModal").then((m) => m.CreateLeagueModal),
  { ssr: false }
);
const EditLeagueModal = dynamic(
  () => import("@/components/EditLeagueModal").then((m) => m.EditLeagueModal),
  { ssr: false }
);
const BlockedLeagueModal = dynamic(
  () => import("@/components/BlockedLeagueModal").then((m) => m.BlockedLeagueModal),
  { ssr: false }
);
const JoinLeaguePasswordModal = dynamic(
  () => import("@/components/JoinLeaguePasswordModal").then((m) => m.JoinLeaguePasswordModal),
  { ssr: false }
);
const ImageLightboxModal = dynamic(
  () => import("@/components/ImageLightboxModal").then((m) => m.ImageLightboxModal),
  { ssr: false }
);
import { League } from "@/types/database";

interface MatchListSectionProps {
  onOpenCreateMatch: () => void;
  onOpenLogin: () => void;
  onSelectMatch: (matchId: string) => void;
}

export const MatchListSection: React.FC<MatchListSectionProps> = ({
  onOpenCreateMatch,
  onOpenLogin,
  onSelectMatch,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const {
    leagues,
    currentLeague,
    selectLeague,
    clearSelectedLeague,
    refreshLeagues,
    isLoading: isLeaguesLoading,
    isLeagueMember,
    canManageLeague,
    canCreateLeagues,
  } = useLeague();

  // Verifica se o usuário é administrador especificamente da Liga Ativa (ou Super Admin)
  const isCurrentLeagueAdmin = useMemo(() => {
    if (!currentLeague) return false;
    return isSuperAdmin || canManageLeague(currentLeague.id, currentLeague);
  }, [currentLeague, isSuperAdmin, canManageLeague]);

  // Jogador na Liga Ativa = NÃO é administrador desta liga específica
  const isPlayer = !isCurrentLeagueAdmin;

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [leagueSearchTerm, setLeagueSearchTerm] = useState("");
  const [userJoinedMap, setUserJoinedMap] = useState<Record<string, boolean>>(
    {},
  );
  const [userPaidMap, setUserPaidMap] = useState<Record<string, boolean>>({});
  const [userParticipantMap, setUserParticipantMap] = useState<
    Record<string, MatchParticipant>
  >({});
  const [participantsCountMap, setParticipantsCountMap] = useState<
    Record<string, number>
  >({});

  // Estados para Modais de Ligas
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isEditLeagueOpen, setIsEditLeagueOpen] = useState(false);
  const [leagueToEdit, setLeagueToEdit] = useState<League | null>(null);
  const [blockedLeagueToView, setBlockedLeagueToView] = useState<League | null>(
    null,
  );
  const [leagueToEnterWithPassword, setLeagueToEnterWithPassword] =
    useState<League | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [leagueLightboxData, setLeagueLightboxData] =
    useState<LightboxPreviewData | null>(null);

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
          : "Liga de Futebol"),
      badge:
        league.matches_count !== undefined
          ? `${league.matches_count} ${league.matches_count === 1 ? "partida agendada" : "partidas agendadas"}`
          : "Liga Oficial",
      badgeColor: "emerald",
      type: "league_logo",
    });
  };

  // Estados para Modal de PIX direto no card
  const [isPixOpen, setIsPixOpen] = useState(false);
  const [pixMatch, setPixMatch] = useState<Match | null>(null);
  const [pixParticipant, setPixParticipant] = useState<MatchParticipant | null>(
    null,
  );

  // Estados para o fluxo de Raspadinha direto
  const [isScratchOpen, setIsScratchOpen] = useState(false);
  const [scratchMatch, setScratchMatch] = useState<Match | null>(null);
  const [scratchParticipants, setScratchParticipants] = useState<
    MatchParticipant[]
  >([]);
  const [scratchCurrentParticipant, setScratchCurrentParticipant] =
    useState<MatchParticipant | null>(null);

  // Estados para o modal "Já Sorteou" / "Vaga Preenchida"
  const [isAlreadyDrawnOpen, setIsAlreadyDrawnOpen] = useState(false);
  const [alreadyDrawnInfo, setAlreadyDrawnInfo] = useState<{
    matchId: string;
    matchTitle: string;
    teamNumber: number;
    teamHasSpace: boolean;
  } | null>(null);

  // Estados para o Modal de Campeão da Partida
  const [isChampionOpen, setIsChampionOpen] = useState(false);
  const [championData, setChampionData] = useState<MatchChampionResult | null>(
    null,
  );
  const [championLoading, setChampionLoading] = useState(false);

  const handleOpenChampionModal = async (
    match: Match,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setIsChampionOpen(true);
    setChampionLoading(true);
    try {
      const data = await getMatchChampionData(match.id, match);
      setChampionData(data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados do campeão.");
    } finally {
      setChampionLoading(false);
    }
  };

  const isMatchEnded = (match: Match) => {
    if (match.status === "finalizada") return true;
    if (match.status === "cancelada") return false;
    if (!match.data || !match.horario) return false;
    const [year, month, day] = match.data.split("-").map(Number);
    const [hours, minutes] = match.horario.split(":").map(Number);
    const matchDate = new Date(
      year,
      month - 1,
      day,
      hours || 0,
      minutes || 0,
      0,
    );
    const durationMs = 2 * 60 * 60 * 1000;
    return Date.now() - matchDate.getTime() >= durationMs;
  };

  const fetchMatches = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);

      // Filtrar pela liga atual quando disponível para evitar buscar TODAS as partidas
      let query = supabase
        .from("matches")
        .select("*")
        .order("data", { ascending: true })
        .order("horario", { ascending: true });

      if (currentLeague?.id) {
        query = query.eq("organization_id", currentLeague.id);
      }

      const { data: matchesData, error } = await query;

      if (error) {
        console.error("Erro ao buscar partidas:", error);
        toast.error("Erro ao carregar lista de partidas.");
        return;
      }

      setMatches(matchesData || []);

      if (matchesData && matchesData.length > 0) {
        const matchIds = matchesData.map((m) => m.id);

        // Buscar apenas campos essenciais de participantes para a listagem
        const { data: participantsData } = await supabase
          .from("match_participants")
          .select("id, match_id, user_id, team, paid, status, position, created_at")
          .in("match_id", matchIds);

        const counts: Record<string, number> = {};
        const userJoined: Record<string, boolean> = {};
        const userPaid: Record<string, boolean> = {};
        const userPartsMap: Record<string, MatchParticipant> = {};

        participantsData?.forEach((p) => {
          counts[p.match_id] = (counts[p.match_id] || 0) + 1;
          if (user && p.user_id === user.id) {
            userJoined[p.match_id] = true;
            userPaid[p.match_id] = !!p.paid;
            userPartsMap[p.match_id] = p as unknown as MatchParticipant;
          }
        });

        setParticipantsCountMap(counts);
        setUserJoinedMap(userJoined);
        setUserPaidMap(userPaid);
        setUserParticipantMap(userPartsMap);
      } else {
        setParticipantsCountMap({});
        setUserJoinedMap({});
        setUserPaidMap({});
        setUserParticipantMap({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMatches(true);

    // Debounce no realtime para evitar refetches em cascata
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchMatches(), 400);
    };

    const unsub = subscribeToTables(
      "public_matches",
      [{ table: "matches" }, { table: "match_participants" }],
      debouncedFetch,
    );

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [user?.id, currentLeague?.id]);

  // Callback do ScratchCardModal: salvar time e histórico
  const handleScratchAssignTeam = async (targetTeam: number) => {
    if (!scratchCurrentParticipant || !user || !scratchMatch) return;

    let chosenTeam = targetTeam;
    const maxCapacity = scratchMatch.jogadores_por_time || 6;

    // Verificar se o time alvo ainda possui vaga em tempo real
    const { data: parts, error: fetchErr } = await supabase
      .from("match_participants")
      .select("team")
      .eq("match_id", scratchMatch.id);

    if (!fetchErr && parts) {
      const countInTarget = parts.filter((p) => p.team === targetTeam).length;
      if (countInTarget >= maxCapacity) {
        // O time alvo completou as vagas no milissegundo anterior
        const teamCounts: Record<number, number> = {};
        parts.forEach((p) => {
          if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        });

        const openTeams: number[] = [];
        for (let t = 1; t <= scratchMatch.num_times; t++) {
          if ((teamCounts[t] || 0) < maxCapacity) {
            openTeams.push(t);
          }
        }

        if (openTeams.length === 0) {
          toast.error("Todas as vagas dos times já foram preenchidas!");
          return;
        }

        // Sortear aleatoriamente entre os times ainda disponíveis
        chosenTeam = openTeams[Math.floor(Math.random() * openTeams.length)];
        toast.info(
          `O Time ${targetTeam} já preencheu as vagas. Você foi alocado no Time ${chosenTeam}!`,
        );
      }
    }

    const { error: updateErr } = await supabase
      .from("match_participants")
      .update({ team: chosenTeam })
      .eq("id", scratchCurrentParticipant.id);

    if (updateErr) {
      toast.error("Erro ao salvar time.");
      return;
    }

    const { error: histErr } = await supabase
      .from("match_scratch_history")
      .upsert(
        {
          match_id: scratchMatch.id,
          user_id: user.id,
          team: chosenTeam,
        },
        { onConflict: "match_id,user_id" },
      );

    if (histErr) {
      console.error("Erro ao gravar histórico:", histErr);
    }

    await fetchMatches();
  };

  // Ação: Voltar ao time antigo (vaga disponível)
  const handleRejoinWithTeam = async () => {
    if (!alreadyDrawnInfo || !user) return;

    const { error } = await supabase.from("match_participants").insert({
      match_id: alreadyDrawnInfo.matchId,
      user_id: user.id,
      team: alreadyDrawnInfo.teamNumber,
    });

    if (error) {
      toast.error("Erro ao se inscrever na partida.");
    } else {
      const teamName =
        TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.name ||
        `Time ${alreadyDrawnInfo.teamNumber}`;
      toast.success(`Você voltou ao ${teamName}! Boa partida! ⚽`);
      setUserJoinedMap((prev) => ({
        ...prev,
        [alreadyDrawnInfo.matchId]: true,
      }));
      setParticipantsCountMap((prev) => ({
        ...prev,
        [alreadyDrawnInfo.matchId]: (prev[alreadyDrawnInfo.matchId] || 0) + 1,
      }));
    }

    setIsAlreadyDrawnOpen(false);
    setAlreadyDrawnInfo(null);
  };

  // Ação: Entrar na lista de reserva (time cheio)
  const handleJoinAsReserve = async () => {
    if (!alreadyDrawnInfo || !user) return;

    const { error } = await supabase.from("match_participants").insert({
      match_id: alreadyDrawnInfo.matchId,
      user_id: user.id,
      team: null,
    });

    if (error) {
      toast.error("Erro ao entrar na lista de reserva.");
    } else {
      toast.success(
        "Você entrou na lista de reserva! Aguarde atribuição do organizador.",
      );
      setUserJoinedMap((prev) => ({
        ...prev,
        [alreadyDrawnInfo.matchId]: true,
      }));
      setParticipantsCountMap((prev) => ({
        ...prev,
        [alreadyDrawnInfo.matchId]: (prev[alreadyDrawnInfo.matchId] || 0) + 1,
      }));
    }

    setIsAlreadyDrawnOpen(false);
    setAlreadyDrawnInfo(null);
  };

  const handleToggleJoin = async (e: React.MouseEvent, match: Match) => {
    e.stopPropagation(); // Não disparar clique do card

    if (!user) {
      onOpenLogin();
      toast.info("Por favor, informe seu Nome e WhatsApp para se inscrever!");
      return;
    }

    const isJoined = !!userJoinedMap[match.id];
    const currentCount = participantsCountMap[match.id] || 0;

    if (!isJoined && currentCount >= match.limite_participantes) {
      toast.error("Esta partida já está lotada!");
      return;
    }

    if (isJoined) {
      // Cancelar participação
      const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("match_id", match.id)
        .eq("user_id", user.id);

      if (error) {
        toast.error("Erro ao cancelar participação.");
      } else {
        toast.success("Sua inscrição foi cancelada.");
        setUserJoinedMap((prev) => ({ ...prev, [match.id]: false }));
        setParticipantsCountMap((prev) => ({
          ...prev,
          [match.id]: Math.max(0, (prev[match.id] || 1) - 1),
        }));

        void createNotification({
          userId: user.id,
          type: "player_left",
          title: "Inscrição Cancelada",
          message: `Você cancelou sua inscrição na partida "${match.titulo}".`,
          link: `/matches/${match.id}`,
          metadata: { match_id: match.id },
        });
      }
      return;
    }

    // ──────────────────────────────────────────────────────────
    // FLUXO DE INSCRIÇÃO: "Quero Participar"
    // ──────────────────────────────────────────────────────────

    // Se a partida tem raspadinha ativa → fluxo especial
    if (match.sorteio_raspadinha_ativo) {
      // 1. Verificar se já existe histórico de raspadinha
      const { data: historyData } = await supabase
        .from("match_scratch_history")
        .select("team")
        .eq("match_id", match.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (historyData?.team) {
        // ── JÁ SORTEOU ANTES ──
        // Verificar se o time antigo ainda tem vaga
        const { data: partsData } = await supabase
          .from("match_participants")
          .select("id, team")
          .eq("match_id", match.id);

        const teamCount = (partsData || []).filter(
          (p) => p.team === historyData.team,
        ).length;
        const teamHasSpace = teamCount < match.jogadores_por_time;

        setAlreadyDrawnInfo({
          matchId: match.id,
          matchTitle: match.titulo,
          teamNumber: historyData.team,
          teamHasSpace,
        });
        setIsAlreadyDrawnOpen(true);
        return;
      }

      // ── PRIMEIRA VEZ: inscrever e abrir raspadinha direto ──
      const { error } = await supabase.from("match_participants").insert({
        match_id: match.id,
        user_id: user.id,
        team: null,
      });

      if (error) {
        toast.error("Erro ao se inscrever na partida.");
        return;
      }

      if (match.organization_id) {
        try {
          await supabase.rpc("ensure_league_participant", {
            p_league_id: match.organization_id,
            p_user_id: user.id,
          });
        } catch (e) {
          console.warn("Erro ao vincular membro à liga:", e);
        }
      }

      // Buscar participantes completos para o modal de raspadinha
      const { data: partsData } = await supabase
        .from("match_participants")
        .select("*, user:user_id(*)")
        .eq("match_id", match.id)
        .order("created_at", { ascending: true });

      const currentPart = partsData?.find((p) => p.user_id === user.id) || null;

      setScratchMatch(match);
      setScratchParticipants(partsData || []);
      setScratchCurrentParticipant(currentPart);
      setIsScratchOpen(true);

      setUserJoinedMap((prev) => ({ ...prev, [match.id]: true }));
      setParticipantsCountMap((prev) => ({
        ...prev,
        [match.id]: (prev[match.id] || 0) + 1,
      }));

      toast.success("Inscrição confirmada! Abra sua raspadinha! 🎰");

      void createNotification({
        userId: user.id,
        type: "player_joined",
        title: "Inscrição Confirmada! ⚽",
        message: `Sua vaga para a partida "${match.titulo}" foi confirmada. Raspadinha liberada!`,
        link: `/matches/${match.id}`,
        metadata: { match_id: match.id },
      });
      return;
    }

    // ── PARTIDA SEM RASPADINHA: fluxo normal ──
    const { error } = await supabase.from("match_participants").insert({
      match_id: match.id,
      user_id: user.id,
      team: null,
    });

    if (error) {
      toast.error("Erro ao se inscrever na partida.");
    } else {
      if (match.organization_id) {
        try {
          await supabase.rpc("ensure_league_participant", {
            p_league_id: match.organization_id,
            p_user_id: user.id,
          });
        } catch (e) {
          console.warn("Erro ao vincular membro à liga:", e);
        }
      }

      toast.success("Inscrição confirmada! Vaga garantida.");
      setUserJoinedMap((prev) => ({ ...prev, [match.id]: true }));
      setParticipantsCountMap((prev) => ({
        ...prev,
        [match.id]: (prev[match.id] || 0) + 1,
      }));

      void createNotification({
        userId: user.id,
        type: "player_joined",
        title: "Inscrição Confirmada! ⚽",
        message: `Sua vaga para a partida "${match.titulo}" foi confirmada. Bom jogo!`,
        link: `/matches/${match.id}`,
        metadata: { match_id: match.id },
      });
    }
  };

  // Partidas filtradas pela Liga ativa
  const leagueMatches = currentLeague
    ? matches.filter((m) => m.organization_id === currentLeague.id)
    : matches;

  const filteredMatches = leagueMatches.filter((m) => {
    const query = searchTerm.toLowerCase();
    return (
      m.titulo.toLowerCase().includes(query) ||
      m.local.toLowerCase().includes(query) ||
      (m.endereco && m.endereco.toLowerCase().includes(query))
    );
  });

  const filteredLeagues = leagues.filter((lg) => {
    const query = leagueSearchTerm.toLowerCase();
    return (
      lg.name.toLowerCase().includes(query) ||
      (lg.description && lg.description.toLowerCase().includes(query)) ||
      (lg.owner?.nome && lg.owner.nome.toLowerCase().includes(query)) ||
      (lg.owner?.apelido && lg.owner.apelido.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════
          TELA DE PARTIDAS DA LIGA ATIVA
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6 sm:space-y-7">
        {/* Top Controls: Busca & Informações da Lista */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 p-3 sm:p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-sm font-black shrink-0">
              ⚽
            </div>
            <div>
              <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                Partidas Agendadas
              </h3>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {filteredMatches.length}{" "}
                {filteredMatches.length === 1
                  ? "partida encontrada"
                  : "partidas encontradas"}
              </span>
            </div>
          </div>

          {/* Controles: Busca (para todos) e Botão Nova Partida (apenas para Admin da Liga) */}
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={currentLeague ? `Buscar em ${currentLeague.name}...` : "Buscar partidas..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white shadow-inner font-medium placeholder:text-slate-400"
              />
            </div>

              {isCurrentLeagueAdmin && !currentLeague?.is_blocked && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={onOpenCreateMatch}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  title="Criar Nova Partida nesta Liga"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Nova Partida</span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Grid de Partidas com Espaçamento e Separação Visual Aprimorada */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 animate-pulse space-y-4 shadow-sm"
                >
                  <div className="w-3/4 h-5 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="w-1/2 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-full h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                  <div className="w-full h-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
                <Calendar className="w-8 h-8 opacity-60" />
              </div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 text-base sm:text-lg">
                Nenhuma partida agendada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
                {searchTerm
                  ? "Nenhum jogo encontrado com esse termo."
                  : "O organizador postará as próximas partidas em breve!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
              {filteredMatches.map((match, idx) => {
                const count = participantsCountMap[match.id] || 0;
                const remaining = Math.max(
                  0,
                  match.limite_participantes - count,
                );
                const isFull = remaining === 0;
                const isJoined = !!userJoinedMap[match.id];
                const isEnded = isMatchEnded(match);

                // Formatação de data
                const dateParts = match.data.split("-");
                const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                // URL do mapa (usado pelo Admin no botão GPS e pelo Jogador no "COMO CHEGAR")
                const mapUrl =
                  match.maps_url ||
                  (() => {
                    const locLower = match.local.toLowerCase();
                    if (locLower.includes("arena 500"))
                      return "https://maps.app.goo.gl/Muxi7iWHoeY2PkTB8";
                    if (locLower.includes("nu rio"))
                      return "https://maps.app.goo.gl/axspwsn9hK2kAek19";
                    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.local + (match.endereco ? " " + match.endereco : ""))}`;
                  })();

                {
                  /* ═══ CARD DE PARTIDA ENCERRADA ═══ */
                }
                if (isEnded) {
                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.1 }}
                      transition={{
                        duration: 0.35,
                        delay: Math.min((idx % 4) * 0.06, 0.2),
                        ease: "easeOut",
                      }}
                      whileTap={{ scale: 0.98 }}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => onSelectMatch(match.id)}
                      className="bg-white/95 dark:bg-[#0e1614] border-2 border-amber-500/30 dark:border-amber-500/25 hover:border-amber-500/60 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-xl dark:shadow-black/40 transition-all duration-200 cursor-pointer group relative overflow-hidden flex flex-col justify-between space-y-4"
                    >
                      {/* Barra superior dourada */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]" />

                      <div className="space-y-3.5 pt-1">
                        {/* Selo "Partida Encerrada" + Botão "Ver Time Campeão" */}
                        <MatchCountdown
                          match={match}
                          onOpenChampion={() => handleOpenChampionModal(match)}
                        />

                        {/* Título da Partida */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.3)] shrink-0" />
                          <h3 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors leading-tight tracking-tight truncate">
                            {match.titulo}
                          </h3>
                        </div>

                        {/* Informações da Partida Encerrada */}
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span>{match.horario.substring(0, 5)}h</span>
                          </div>

                          <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                            <span>Ver detalhes</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                {
                  /* ═══ CARD DE PARTIDA NORMAL (ativa/futura) ═══ */
                }
                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min((idx % 4) * 0.06, 0.2),
                      ease: "easeOut",
                    }}
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => onSelectMatch(match.id)}
                    className={`bg-white/95 dark:bg-[#0c1512] border-2 ${
                      isJoined
                        ? "border-emerald-500/40 dark:border-emerald-500/30 ring-1 ring-emerald-500/20"
                        : "border-slate-200/90 dark:border-emerald-950/80 hover:border-emerald-500/50"
                    } rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-2xl dark:shadow-black/50 dark:hover:shadow-emerald-950/25 transition-all duration-200 cursor-pointer group flex flex-col justify-between relative overflow-hidden space-y-4.5`}
                  >
                    {/* Efeito visual superior de cor */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1.5 ${
                        isJoined
                          ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                          : isFull
                            ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                            : "bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                      }`}
                    />

                    <div className="space-y-3 pt-1">
                      {/* 1. TOP BAR DO CARD: Modalidade + Vagas + Badges + GPS */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          {/* Badge de Modalidade (Futebol ou Vôlei) */}
                          <div
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0 border ${
                              match.sport_type === "volei"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            <span>
                              {match.sport_type === "volei"
                                ? "🏐 Vôlei"
                                : "⚽ Futebol"}
                            </span>
                          </div>

                          {/* Badge de Vagas */}
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs shrink-0 ${
                              isFull
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {!isFull ? (
                              <>
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                <span>
                                  {remaining}{" "}
                                  {remaining === 1 ? "vaga" : "vagas"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>Lotada</span>
                              </>
                            )}
                          </div>

                          {/* Badge Raspadinha */}
                          {match.sorteio_raspadinha_ativo && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs shrink-0">
                              <Sparkles
                                className="w-3 h-3 text-amber-500 animate-spin"
                                style={{ animationDuration: "6s" }}
                              />
                              <span>Raspadinha</span>
                            </div>
                          )}

                          {/* Badge de Usuário Inscrito */}
                          {isJoined && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Inscrito</span>
                            </div>
                          )}
                        </div>

                        {/* Botão de Localização / GPS compacto */}
                        {(() => {
                          const getMapUrl = () => {
                            if (match.maps_url) return match.maps_url;
                            const locLower = match.local.toLowerCase();
                            if (locLower.includes("arena 500"))
                              return "https://maps.app.goo.gl/Muxi7iWHoeY2PkTB8";
                            if (locLower.includes("nu rio"))
                              return "https://maps.app.goo.gl/axspwsn9hK2kAek19";
                            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.local + (match.endereco ? " " + match.endereco : ""))}`;
                          };
                          const mapUrl = getMapUrl();

                          return (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.94 }}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(mapUrl, "_blank");
                              }}
                              className="group/gps inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/70 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/20 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/40 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-300 transition-all duration-200 shadow-xs max-w-[130px] sm:max-w-[200px] shrink-0 cursor-pointer"
                              title="Abrir rota no Google Maps / GPS"
                            >
                              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="font-extrabold text-[11px] sm:text-xs tracking-tight truncate">
                                {match.local}
                              </span>
                            </motion.button>
                          );
                        })()}
                      </div>

                      {/* 2. TÍTULO DO CONFRONTO UNIFICADO */}
                      <div className="flex items-center gap-2.5 min-w-0 pt-0.5">
                        <div
                          className={`w-2 h-7 sm:h-8 rounded-full shrink-0 ${
                            match.sport_type === "volei"
                              ? "bg-gradient-to-b from-amber-400 via-orange-500 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                              : "bg-gradient-to-b from-brand-400 via-emerald-500 to-teal-600 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                          }`}
                        />
                        <h3 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors leading-tight tracking-tight truncate">
                          {match.titulo}
                        </h3>
                      </div>

                      {/* 3. CRONÔMETRO REGRESSIVO */}
                      <div>
                        <MatchCountdown match={match} />
                      </div>

                      {/* Painel de 4 Informações Essenciais */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 text-xs">
                        {/* DATA */}
                        <div className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs">
                          <span className="text-[10px] text-sky-500 font-black uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-500" /> Data
                          </span>
                          <span className="font-black text-slate-800 dark:text-slate-100 mt-1 text-xs sm:text-[13px]">
                            {formattedDate}
                          </span>
                        </div>

                        {/* HORÁRIO */}
                        <div className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs">
                          <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" /> Horário
                          </span>
                          <span className="font-black text-slate-800 dark:text-slate-100 mt-1 text-xs sm:text-[13px]">
                            {match.horario.substring(0, 5)}h
                          </span>
                        </div>

                        {/* VALOR */}
                        <div className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs">
                          <span className="text-[10px] text-emerald-500 font-black uppercase tracking-wider flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-500" />{" "}
                            Valor
                          </span>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 mt-1 text-xs sm:text-[13px]">
                            {match.valor > 0
                              ? `R$ ${match.valor.toFixed(2)}`
                              : "Grátis"}
                          </span>
                        </div>

                        {/* FORMATO (Destacado: 4 Times / 5 Participantes) */}
                        <div className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs">
                          <span className="text-[10px] text-purple-500 font-black uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3 h-3 text-purple-500" />{" "}
                            Formato
                          </span>
                          <span className="font-black text-purple-600 dark:text-purple-400 text-[11px] sm:text-xs leading-tight mt-1">
                            {match.num_times} Times / {match.jogadores_por_time}{" "}
                            Participantes
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer do Card: Vagas + Progresso + Botões de Ação */}
                    <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/80">
                      {/* Contador de Confirmados e Vagas */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-black text-slate-900 dark:text-white">
                            {count}
                          </span>
                          <span className="text-slate-400 font-semibold">
                            / {match.limite_participantes} confirmados
                          </span>
                        </div>

                        <span className="text-[11px] font-black text-slate-400">
                          {Math.round(
                            (count / match.limite_participantes) * 100,
                          )}
                          %
                        </span>
                      </div>

                      {/* Barra visual de vagas preenchidas */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-800">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isFull
                              ? "bg-rose-500"
                              : isJoined
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "bg-gradient-to-r from-emerald-500 to-teal-400"
                          }`}
                          style={{
                            width: `${Math.min(100, (count / match.limite_participantes) * 100)}%`,
                          }}
                        />
                      </div>

                      {/* STATUS DE PAGAMENTO OU BOTÃO PIX NO CARD DA PARTIDA */}
                      {isJoined && match.valor > 0 && (
                        <div className="pt-0.5">
                          {userPaidMap[match.id] ? (
                            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>Pagamento confirmado</span>
                              </div>
                              <span className="text-[10px] opacity-80 font-bold">
                                R$ {match.valor.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              whileHover={{ scale: 1.02 }}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPixMatch(match);
                                setPixParticipant(
                                  userParticipantMap[match.id] || null,
                                );
                                setIsPixOpen(true);
                              }}
                              className="w-full py-3 px-3.5 rounded-2xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <QrCode className="w-4 h-4 shrink-0" />
                              <span>
                                Pagar via PIX (R$ {match.valor.toFixed(2)})
                              </span>
                            </motion.button>
                          )}
                        </div>
                      )}

                      {/* BOTÕES: DETALHES + QUERO PARTICIPAR */}
                      <div className="flex items-center gap-2.5 pt-0.5">
                        {/* Botão DETALHES DA PARTIDA */}
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          whileHover={{ scale: 1.02 }}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                              try { navigator.vibrate(15); } catch {}
                            }
                            onSelectMatch(match.id);
                          }}
                          className="flex-1 min-h-[44px] py-2.5 px-3 rounded-2xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Info className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="truncate">Detalhes</span>
                        </motion.button>

                        {/* Botão QUERO PARTICIPAR / INSCRITO */}
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          whileHover={{ scale: 1.02 }}
                          type="button"
                          onClick={(e) => {
                            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                              try { navigator.vibrate(25); } catch {}
                            }
                            handleToggleJoin(e, match);
                          }}
                          disabled={!isJoined && isFull}
                          className={`flex-1 min-h-[44px] py-2.5 px-3 rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                            isJoined
                              ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"
                              : isFull
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                                : "bg-gradient-to-r from-emerald-500 via-brand-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/25"
                          }`}
                        >
                          {isJoined ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span className="truncate">Inscrito (Sair)</span>
                            </>
                          ) : isFull ? (
                            <span className="truncate">Partida Lotada</span>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
                              <span className="truncate">Quero Participar</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MODAL DE RASPADINHA VIRTUAL (disparado pelo "Quero Participar") */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {scratchMatch && (
            <ScratchCardModal
              isOpen={isScratchOpen}
              onClose={() => {
                setIsScratchOpen(false);
                setScratchMatch(null);
                setScratchParticipants([]);
                setScratchCurrentParticipant(null);
              }}
              match={scratchMatch}
              participants={scratchParticipants}
              currentParticipant={scratchCurrentParticipant}
              onSelectTeam={handleScratchAssignTeam}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MODAL "JÁ SORTEOU" / "VAGA PREENCHIDA"                   */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {isAlreadyDrawnOpen && alreadyDrawnInfo && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
              onClick={() => {
                setIsAlreadyDrawnOpen(false);
                setAlreadyDrawnInfo(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center relative"
              >
                <button
                  onClick={() => {
                    setIsAlreadyDrawnOpen(false);
                    setAlreadyDrawnInfo(null);
                  }}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {alreadyDrawnInfo.teamHasSpace ? (
                  /* ── TIME COM VAGA: pode voltar ── */
                  <>
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
                      {TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.emoji ||
                        "⚽"}
                    </div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">
                      Você já participou! 🎉
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Você já realizou o sorteio da raspadinha na partida{" "}
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        &quot;{alreadyDrawnInfo.matchTitle}&quot;
                      </span>{" "}
                      e foi sorteado para o{" "}
                      <span
                        className={`font-black ${TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.text || "text-brand-500"}`}
                      >
                        {TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.name ||
                          `Time ${alreadyDrawnInfo.teamNumber}`}
                      </span>
                      . Sua vaga ainda está disponível!
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={handleRejoinWithTeam}
                        className="w-full py-3 rounded-2xl font-black text-sm bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Voltar ao{" "}
                        {TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.name ||
                          `Time ${alreadyDrawnInfo.teamNumber}`}
                      </motion.button>
                      <button
                        onClick={() => {
                          setIsAlreadyDrawnOpen(false);
                          setAlreadyDrawnInfo(null);
                        }}
                        className="w-full py-2.5 rounded-2xl font-bold text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        Não, Obrigado
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── TIME CHEIO: vaga preenchida ── */
                  <>
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
                      😔
                    </div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">
                      Vaga Preenchida
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Você havia sido sorteado para o{" "}
                      <span
                        className={`font-black ${TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.text || "text-brand-500"}`}
                      >
                        {TEAM_COLORS[alreadyDrawnInfo.teamNumber - 1]?.name ||
                          `Time ${alreadyDrawnInfo.teamNumber}`}
                      </span>
                      , mas ao sair da partida, sua vaga foi preenchida por
                      outro participante.
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Você pode entrar na lista de reserva e aguardar uma nova
                      atribuição pelo organizador.
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={handleJoinAsReserve}
                        className="w-full py-3 rounded-2xl font-black text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        Entrar na Lista de Reserva
                      </motion.button>
                      <button
                        onClick={() => {
                          setIsAlreadyDrawnOpen(false);
                          setAlreadyDrawnInfo(null);
                        }}
                        className="w-full py-2.5 rounded-2xl font-bold text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        Não, Obrigado
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* MODAL DE PAGAMENTO PIX DIRETO DO CARD */}
          {pixMatch && (
            <PixPaymentModal
              isOpen={isPixOpen}
              onClose={() => setIsPixOpen(false)}
              match={pixMatch}
              participant={pixParticipant}
              onUpdate={fetchMatches}
            />
          )}

          {/* MODAL DO TIME CAMPEÃO */}
          {isChampionOpen && (
            <ChampionModal
              isOpen={isChampionOpen}
              onClose={() => {
                setIsChampionOpen(false);
                setChampionData(null);
              }}
              championData={championData}
              loading={championLoading}
            />
          )}
        </div>

      {/* MODAIS DE GESTÃO DE LIGAS */}
      {isCreateLeagueOpen && (
        <CreateLeagueModal
          isOpen={isCreateLeagueOpen}
          onClose={() => setIsCreateLeagueOpen(false)}
          onLeagueCreated={(newLeagueId) => {
            selectLeague(newLeagueId);
            setIsCreateLeagueOpen(false);
          }}
        />
      )}

      {isEditLeagueOpen && (
        <EditLeagueModal
          isOpen={isEditLeagueOpen}
          onClose={() => {
            setIsEditLeagueOpen(false);
            setLeagueToEdit(null);
          }}
          league={leagueToEdit}
        />
      )}

      {!!blockedLeagueToView && (
        <BlockedLeagueModal
          isOpen={!!blockedLeagueToView}
          onClose={() => setBlockedLeagueToView(null)}
          league={blockedLeagueToView}
        />
      )}

      {isPasswordModalOpen && (
        <JoinLeaguePasswordModal
          isOpen={isPasswordModalOpen}
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
};
