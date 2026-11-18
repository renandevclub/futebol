"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { Match, MatchParticipant } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  DollarSign,
  ArrowLeft,
  Share2,
  CheckCircle2,
  XCircle,
  Trash2,
  Shield,
  Megaphone,
  Trophy,
  Shuffle,
  UserPlus,
  Sparkles,
  ChevronDown,
  Receipt,
  MessageSquare,
  QrCode,
  Edit3,
  Flame,
  Navigation,
  Tv,
  FileDown,
  Radio,
  MessageCircle,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LoginModal } from "@/components/LoginModal";
import { CreatePostModal } from "@/components/CreatePostModal";
import { CreateMatchModal } from "@/components/CreateMatchModal";
import { AdminPanelModal } from "@/components/AdminPanelModal";
import { ScratchCardModal } from "@/components/ScratchCardModal";
import { MatchFinanceModal } from "@/components/MatchFinanceModal";
import { WhatsAppNotifierModal } from "@/components/WhatsAppNotifierModal";
import { PixPaymentModal } from "@/components/PixPaymentModal";
import { EditMatchModal } from "@/components/EditMatchModal";
import { EditTeamsModal } from "@/components/EditTeamsModal";
import { MatchHighlightsModal } from "@/components/MatchHighlightsModal";
import { MatchPlayerManagerModal } from "@/components/MatchPlayerManagerModal";
import { updatePlayerName } from "@/lib/matchPlayersHelper";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { StandingsTable } from "@/components/StandingsTable";
import { ShareLiveBroadcastModal } from "@/components/ShareLiveBroadcastModal";
import { subscribeToTables } from "@/lib/realtime";
import {
  createNotification,
  createBatchNotifications,
} from "@/lib/notifications";
import { MatchCountdown } from "@/components/MatchCountdown";
import { generateMatchPdf } from "@/lib/pdfGenerator";
import { useLeague } from "@/context/LeagueContext";
import { getTeamInfo } from "@/lib/teamsHelper";
import { motion, AnimatePresence } from "framer-motion";
import { ChampionModal } from "@/components/ChampionModal";
import GradientText from "@/components/GradientText";
import { MatchStandingsModal } from "@/components/MatchStandingsModal";
import {
  getMatchChampionData,
  MatchChampionResult,
} from "@/lib/championHelper";
import { TeamBadge } from "@/components/TeamBadge";
import {
  ImageLightboxModal,
  LightboxPreviewData,
} from "@/components/ImageLightboxModal";
import { balanceParticipantsIntoTeams } from "@/lib/playerRatingHelper";

const TEAM_COLORS = [
  {
    name: "Time A",
    color: "bg-red-500",
    border: "border-red-400",
    lightBg: "bg-red-500/10",
    text: "text-red-500",
    emoji: "🔴",
  },
  {
    name: "Time B",
    color: "bg-blue-500",
    border: "border-blue-400",
    lightBg: "bg-blue-500/10",
    text: "text-blue-500",
    emoji: "🔵",
  },
  {
    name: "Time C",
    color: "bg-green-500",
    border: "border-green-400",
    lightBg: "bg-green-500/10",
    text: "text-green-500",
    emoji: "🟢",
  },
  {
    name: "Time D",
    color: "bg-yellow-500",
    border: "border-yellow-400",
    lightBg: "bg-yellow-500/10",
    text: "text-yellow-500",
    emoji: "🟡",
  },
  {
    name: "Time E",
    color: "bg-purple-500",
    border: "border-purple-400",
    lightBg: "bg-purple-500/10",
    text: "text-purple-500",
    emoji: "🟣",
  },
  {
    name: "Time F",
    color: "bg-orange-500",
    border: "border-orange-400",
    lightBg: "bg-orange-500/10",
    text: "text-orange-500",
    emoji: "🟠",
  },
  {
    name: "Time G",
    color: "bg-pink-500",
    border: "border-pink-400",
    lightBg: "bg-pink-500/10",
    text: "text-pink-500",
    emoji: "🩷",
  },
  {
    name: "Time H",
    color: "bg-cyan-500",
    border: "border-cyan-400",
    lightBg: "bg-cyan-500/10",
    text: "text-cyan-500",
    emoji: "🩵",
  },
  {
    name: "Time I",
    color: "bg-indigo-500",
    border: "border-indigo-400",
    lightBg: "bg-indigo-500/10",
    text: "text-indigo-500",
    emoji: "💜",
  },
  {
    name: "Time J",
    color: "bg-teal-500",
    border: "border-teal-400",
    lightBg: "bg-teal-500/10",
    text: "text-teal-500",
    emoji: "💚",
  },
];

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isSuperAdmin } = useAuth();
  const { canManageMatch } = useLeague();

  const [match, setMatch] = useState<Match | null>(null);
  const [isObservationShown, setIsObservationShown] = useState(false);
  const canManageThisMatch = useMemo(() => {
    return canManageMatch(match);
  }, [canManageMatch, match]);
  const isAdmin = canManageThisMatch; // Administrador contextual desta partida
  const isPlayer = !canManageThisMatch; // Jogador = NÃO é administrador desta partida/liga
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchTab, setMatchTab] = useState<"info" | "scoreboard" | "standings">(
    "info",
  );
  const [isJoined, setIsJoined] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [isScratchCardOpen, setIsScratchCardOpen] = useState(false);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [isEditMatchOpen, setIsEditMatchOpen] = useState(false);
  const [isShareLiveOpen, setIsShareLiveOpen] = useState(false);
  const [isEditTeamsOpen, setIsEditTeamsOpen] = useState(false);
  const [isHighlightsModalOpen, setIsHighlightsModalOpen] = useState(false);
  const [isPlayerManagerOpen, setIsPlayerManagerOpen] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<
    string | null
  >(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [isEditingPlayerLoading, setIsEditingPlayerLoading] = useState(false);

  const [leagueRatingsMap, setLeagueRatingsMap] = useState<
    Record<string, number>
  >({});

  // Estados para o Modal do Time Campeão
  const [isChampionModalOpen, setIsChampionModalOpen] = useState(false);
  const [championData, setChampionData] = useState<MatchChampionResult | null>(
    null,
  );
  const [championLoading, setChampionLoading] = useState(false);

  // Estados para o Modal de Tabela de Classificação Final
  const [isStandingsModalOpen, setIsStandingsModalOpen] = useState(false);

  const handleOpenChampionModal = async () => {
    if (!match) return;
    setIsChampionModalOpen(true);
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

  const isEnded = useMemo(() => {
    if (!match) return false;
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
    const durationMs = (match.jogadores_por_time || 6) * 10 * 60 * 1000;
    return Date.now() - matchDate.getTime() >= durationMs;
  }, [match]);

  const isMatchVolei = useMemo(() => {
    return (
      match?.sport_type === "volei" ||
      match?.organization?.sport_type === "volei"
    );
  }, [match]);

  const mapUrl = useMemo(() => {
    if (!match) return "";
    if (match.maps_url) return match.maps_url;
    const locLower = (match.local || "").toLowerCase();
    if (locLower.includes("arena 500"))
      return "https://maps.app.goo.gl/Muxi7iWHoeY2PkTB8";
    if (locLower.includes("nu rio"))
      return "https://maps.app.goo.gl/axspwsn9hK2kAek19";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      (match.local || "") + (match.endereco ? " " + match.endereco : ""),
    )}`;
  }, [match]);

  // Controle de Acordeão dos Times (inicialmente todos recolhidos)
  const [expandedTeams, setExpandedTeams] = useState<number[]>([]);
  const [isReservesExpanded, setIsReservesExpanded] = useState(false);

  const toggleTeamAccordion = (teamNum: number) => {
    setExpandedTeams((prev) =>
      prev.includes(teamNum)
        ? prev.filter((t) => t !== teamNum)
        : [...prev, teamNum],
    );
  };

  const handleExpandAllTeams = () => {
    if (match?.num_times) {
      setExpandedTeams(
        Array.from({ length: match.num_times }, (_, i) => i + 1),
      );
    }
  };

  const handleCollapseAllTeams = () => {
    setExpandedTeams([]);
  };

  // Estado do Modal de Visualização Ampliada (Lightbox) de Emblemas e Avatares
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(
    null,
  );

  const openImagePreview = (
    previewData: Omit<LightboxPreviewData, "isOpen">,
  ) => {
    setLightboxData({ ...previewData, isOpen: true });
  };

  const closeImagePreview = () => {
    setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam === "scoreboard" ||
        tabParam === "standings" ||
        tabParam === "info"
      ) {
        setMatchTab(tabParam);
      }
    }
  }, []);

  useEffect(() => {
    if (!match?.observacoes) {
      setIsObservationShown(false);
      return;
    }

    setIsObservationShown(false);
    const frame = window.requestAnimationFrame(() => {
      setIsObservationShown(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [match?.id, match?.observacoes]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "sort" | "clear";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "sort",
    title: "",
    message: "",
  });

  // Modais estáticos para Header
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Estado para modal "Vaga Preenchida" (time cheio ao tentar voltar)
  const [isTeamFullModalOpen, setIsTeamFullModalOpen] = useState(false);
  const [teamFullInfo, setTeamFullInfo] = useState<{
    teamNumber: number;
  } | null>(null);

  const fetchMatchDetails = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          `
          *,
          organization:organization_id(*, owner:owner_id(*)),
          mvp_player:mvp_player_id(*),
          aninga_player:aninga_player_id(*)
        `,
        )
        .eq("id", id)
        .single();

      if (matchError || !matchData) {
        toast.error("Partida não encontrada.");
        return;
      }

      setMatch(matchData);

      // Buscar lista de participantes com profiles completos
      const { data: partsData } = await supabase
        .from("match_participants")
        .select(
          `
          *,
          user:user_id(*)
        `,
        )
        .eq("match_id", id)
        .order("created_at", { ascending: true });

      setParticipants(partsData || []);

      // Se a partida pertencer a uma liga, buscar as notas dos membros nessa liga
      if (matchData.organization_id) {
        const { data: membersRatings } = await supabase
          .from("organization_members")
          .select("user_id, nivel_qualidade")
          .eq("organization_id", matchData.organization_id);

        if (membersRatings) {
          const map: Record<string, number> = {};
          membersRatings.forEach((mr) => {
            if (mr.user_id && typeof mr.nivel_qualidade === "number") {
              map[mr.user_id] = mr.nivel_qualidade;
            }
          });
          setLeagueRatingsMap(map);
        }
      }

      if (user && partsData) {
        setIsJoined(partsData.some((p) => p.user_id === user.id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMatchDetails(true);

    return subscribeToTables(
      `match_detail_${id}`,
      [
        { table: "match_participants" },
        { table: "matches" },
        { table: "match_scratch_history" },
        { table: "match_expenses" },
      ],
      () => fetchMatchDetails(),
    );
  }, [id, user?.id]);

  // Participante atual logado
  const currentParticipant = useMemo(() => {
    if (!user) return null;
    return participants.find((p) => p.user_id === user.id) || null;
  }, [user, participants]);

  // Organizar participantes por time
  const { teamGroups, reserves } = useMemo(() => {
    if (!match) return { teamGroups: {}, reserves: [] };

    const groups: Record<number, MatchParticipant[]> = {};
    const reserveList: MatchParticipant[] = [];

    participants.forEach((p) => {
      if (p.team != null && p.team >= 1 && p.team <= match.num_times) {
        if (!groups[p.team]) groups[p.team] = [];
        groups[p.team].push(p);
      } else {
        reserveList.push(p);
      }
    });

    return { teamGroups: groups, reserves: reserveList };
  }, [participants, match]);

  const hasTeamsAssigned = useMemo(() => {
    return participants.some((p) => p.team != null && p.team >= 1);
  }, [participants]);

  // Ação: entrar como reserva (usado quando o time antigo está cheio)
  const handleJoinAsReserveDetail = async () => {
    if (!user || !match) return;

    const { error } = await supabase.from("match_participants").insert({
      match_id: id,
      user_id: user.id,
      team: null,
    });

    if (error) {
      toast.error("Erro ao entrar na lista de reserva.");
    } else {
      // Garantir que o usuário fica vinculado à liga desta partida
      if (match.organization_id) {
        try {
          await supabase.rpc("ensure_league_participant", {
            p_league_id: match.organization_id,
            p_user_id: user.id,
          });
        } catch (e) {
          console.warn("Erro ao registrar membro na liga:", e);
        }
      }

      toast.success(
        "Você entrou na lista de reserva! Aguarde atribuição do organizador.",
      );
      setIsJoined(true);
      await fetchMatchDetails();
    }

    setIsTeamFullModalOpen(false);
    setTeamFullInfo(null);
  };

  const handleToggleJoin = async () => {
    if (!user) {
      setIsLoginOpen(true);
      toast.info("Por favor, informe seu Nome e WhatsApp para se inscrever!");
      return;
    }

    if (!match) return;

    if (!isJoined && participants.length >= match.limite_participantes) {
      toast.error("Esta partida está lotada!");
      return;
    }

    if (isJoined) {
      const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("match_id", id)
        .eq("user_id", user.id);

      if (error) {
        toast.error("Erro ao cancelar participação.");
      } else {
        toast.success("Inscrição cancelada.");
        setIsJoined(false);
        void fetchMatchDetails();

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

    // ── FLUXO DE INSCRIÇÃO ──

    // Helper para auto-vínculo com a liga
    const autoLinkLeague = async () => {
      if (match.organization_id) {
        try {
          await supabase.rpc("ensure_league_participant", {
            p_league_id: match.organization_id,
            p_user_id: user.id,
          });
        } catch (e) {
          console.warn("Erro ao auto-vincular participante na liga:", e);
        }
      }
    };

    // Verificar histórico de raspadinha
    const { data: historyData } = await supabase
      .from("match_scratch_history")
      .select("team")
      .eq("match_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    const historicTeam = historyData?.team || null;

    // Se raspadinha ativa e já sorteou antes
    if (match.sorteio_raspadinha_ativo && historicTeam != null) {
      // Verificar se o time antigo ainda tem vaga
      const teamCount = participants.filter(
        (p) => p.team === historicTeam,
      ).length;
      const teamHasSpace = teamCount < match.jogadores_por_time;

      if (teamHasSpace) {
        // Re-inscrever com time antigo
        const { error } = await supabase.from("match_participants").insert({
          match_id: id,
          user_id: user.id,
          team: historicTeam,
        });

        if (error) {
          toast.error("Erro ao confirmar vaga.");
        } else {
          await autoLinkLeague();
          const tName =
            TEAM_COLORS[historicTeam - 1]?.name || `Time ${historicTeam}`;
          toast.success(`Você voltou ao ${tName}! Boa partida! ⚽`);
          setIsJoined(true);
          void fetchMatchDetails();

          void createNotification({
            userId: user.id,
            type: "player_joined",
            title: "Inscrição Confirmada! ⚽",
            message: `Sua vaga para a partida "${match.titulo}" foi confirmada no ${tName}.`,
            link: `/matches/${match.id}`,
            metadata: { match_id: match.id },
          });
        }
      } else {
        // Time cheio → mostrar modal
        setTeamFullInfo({ teamNumber: historicTeam });
        setIsTeamFullModalOpen(true);
      }
      return;
    }

    // Se raspadinha ativa e nunca sorteou → inscrever e abrir raspadinha direto
    if (match.sorteio_raspadinha_ativo && historicTeam == null) {
      const { error } = await supabase.from("match_participants").insert({
        match_id: id,
        user_id: user.id,
        team: null,
      });

      if (error) {
        toast.error("Erro ao confirmar vaga.");
      } else {
        await autoLinkLeague();
        toast.success("Inscrição confirmada! Abra sua raspadinha! 🎰");
        setIsJoined(true);
        await fetchMatchDetails();
        // Abrir raspadinha automaticamente
        setIsScratchCardOpen(true);

        void createNotification({
          userId: user.id,
          type: "player_joined",
          title: "Inscrição Confirmada! ⚽",
          message: `Sua vaga para a partida "${match.titulo}" foi confirmada. Raspadinha liberada!`,
          link: `/matches/${match.id}`,
          metadata: { match_id: match.id },
        });
      }
      return;
    }

    // ── PARTIDA SEM RASPADINHA: fluxo normal ──
    const { error } = await supabase.from("match_participants").insert({
      match_id: id,
      user_id: user.id,
      team: null,
    });

    if (error) {
      toast.error("Erro ao confirmar vaga.");
    } else {
      await autoLinkLeague();
      toast.success("Vaga garantida! Boa partida!");
      setIsJoined(true);

      // Registrar evento automático na Timeline do Usuário
      await supabase.from("timeline_events").insert({
        user_id: user.id,
        event_type: "join_match",
        title: `Confirmou presença na partida "${match.titulo}"`,
        description: `Local: ${match.local} às ${match.horario.substring(0, 5)}`,
        metadata: { match_id: match.id },
      });

      void createNotification({
        userId: user.id,
        type: "player_joined",
        title: "Inscrição Confirmada! ⚽",
        message: `Sua vaga para a partida "${match.titulo}" foi confirmada. Bom jogo!`,
        link: `/matches/${match.id}`,
        metadata: { match_id: match.id },
      });

      void fetchMatchDetails();
    }
  };

  // Participante escolhe seu time manualmente (quando raspadinha desativada)
  const handleSelectTeamManual = async (teamNumber: number) => {
    if (!user || !currentParticipant || !match) return;

    // Verificar se o time escolhido já atingiu o limite de vagas
    const currentTeamPlayers = teamGroups[teamNumber]?.length || 0;
    if (
      currentParticipant.team !== teamNumber &&
      currentTeamPlayers >= match.jogadores_por_time
    ) {
      toast.error(
        `O ${TEAM_COLORS[teamNumber - 1]?.name || "Time"} já está com todas as vagas preenchidas!`,
      );
      return;
    }

    // Se já estiver no mesmo time, sai do time
    const newTeam = currentParticipant.team === teamNumber ? null : teamNumber;

    const { error } = await supabase
      .from("match_participants")
      .update({ team: newTeam })
      .eq("id", currentParticipant.id);

    if (error) {
      toast.error("Erro ao atualizar seu time.");
    } else {
      const teamName =
        TEAM_COLORS[teamNumber - 1]?.name || `Time ${teamNumber}`;
      if (newTeam === null) {
        toast.info(`Você saiu do ${teamName}.`);
      } else {
        toast.success(`Você entrou no ${teamName}! 🏐`);
      }
      await fetchMatchDetails();
    }
  };

  // Atribuir time via Raspadinha Virtual (callback)
  const handleAssignTeamFromScratch = async (targetTeam: number) => {
    if (!currentParticipant || !user || !match) return;

    let chosenTeam = targetTeam;
    const maxCapacity = match.jogadores_por_time || 6;

    // Verificar se o time alvo ainda possui vaga em tempo real
    const { data: parts, error: fetchErr } = await supabase
      .from("match_participants")
      .select("team")
      .eq("match_id", match.id);

    if (!fetchErr && parts) {
      const countInTarget = parts.filter((p) => p.team === targetTeam).length;
      if (countInTarget >= maxCapacity) {
        // O time alvo completou as vagas no milissegundo anterior
        const teamCounts: Record<number, number> = {};
        parts.forEach((p) => {
          if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
        });

        const openTeams: number[] = [];
        for (let t = 1; t <= match.num_times; t++) {
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

    // 1. Atualizar o time do participante na tabela de participantes da partida
    const { error: updateErr } = await supabase
      .from("match_participants")
      .update({ team: chosenTeam })
      .eq("id", currentParticipant.id);

    if (updateErr) {
      console.error("Erro ao atualizar match_participants:", updateErr);
      toast.error("Erro ao salvar time no seu cadastro.");
      return;
    }

    // 2. Gravar no histórico permanente da raspadinha
    const { error: histErr } = await supabase
      .from("match_scratch_history")
      .upsert(
        {
          match_id: match.id,
          user_id: user.id,
          team: chosenTeam,
        },
        { onConflict: "match_id,user_id" },
      );

    if (histErr) {
      console.error("Erro ao gravar em match_scratch_history:", histErr);
      toast.error(
        `Atenção: Time alocado, mas erro no histórico do banco (${histErr.message}). Verifique as permissões (RLS) no Supabase.`,
      );
    }

    await fetchMatchDetails();
  };

  // Administrador altera time de qualquer participante manualmente
  const handleAdminChangeTeam = async (
    participantId: string,
    newTeam: number | null,
  ) => {
    if (!isAdmin || !match) return;

    const targetPart = participants.find((p) => p.id === participantId);

    const { error } = await supabase
      .from("match_participants")
      .update({ team: newTeam })
      .eq("id", participantId);

    if (error) {
      toast.error("Erro ao alterar time do participante.");
    } else {
      if (targetPart) {
        if (newTeam === null) {
          // Limpar histórico se admin resetou para Sem Time / Reserva
          await supabase
            .from("match_scratch_history")
            .delete()
            .eq("match_id", match.id)
            .eq("user_id", targetPart.user_id);
          toast.success(
            "Raspadinha do participante foi resetada e liberada com sucesso!",
          );
        } else {
          // Atualizar no histórico
          await supabase.from("match_scratch_history").upsert(
            {
              match_id: match.id,
              user_id: targetPart.user_id,
              team: newTeam,
            },
            { onConflict: "match_id,user_id" },
          );
          toast.success("Time do participante atualizado com sucesso!");
        }
      }
      await fetchMatchDetails();
    }
  };

  // Administrador ativa/desativa o Sorteio por Raspadinha Virtual
  const handleToggleScratchMode = async () => {
    if (!isAdmin || !match) return;

    const nextState = !match.sorteio_raspadinha_ativo;
    const { error } = await supabase
      .from("matches")
      .update({ sorteio_raspadinha_ativo: nextState })
      .eq("id", match.id);

    if (error) {
      toast.error("Erro ao alterar modo de raspadinha.");
    } else {
      setMatch({ ...match, sorteio_raspadinha_ativo: nextState });
      toast.success(
        nextState
          ? "🎰 Raspadinha Virtual Ativada! Os participantes sortearão seus times raspando blocos."
          : "✋ Modo Escolha Manual Ativado! Os participantes poderão escolher seus times.",
      );
    }
  };

  const handleStartEditPlayer = (p: MatchParticipant) => {
    if (!isAdmin) return;
    setEditingParticipantId(p.id);
    setEditingNameValue(p.user?.nome || p.guest_name || "");
  };

  const handleSavePlayerName = async (participant: MatchParticipant) => {
    if (!isAdmin || !match) return;
    const cleanName = editingNameValue.trim();
    if (!cleanName) {
      toast.error("O nome do jogador não pode ficar vazio.");
      return;
    }

    const currentName = participant.user?.nome || participant.guest_name || "";
    if (cleanName === currentName) {
      setEditingParticipantId(null);
      return;
    }

    try {
      setIsEditingPlayerLoading(true);
      const res = await updatePlayerName({
        matchId: match.id,
        participantId: participant.id,
        profileId: participant.user_id,
        newName: cleanName,
        isGuest: !participant.user_id,
      });

      if (res.success) {
        toast.success(`Nome atualizado para "${cleanName}"! ✅`);
        setEditingParticipantId(null);
        void fetchMatchDetails();
      } else {
        toast.error(res.error || "Erro ao atualizar nome.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao atualizar nome do jogador.");
    } finally {
      setIsEditingPlayerLoading(false);
    }
  };

  const handleRemoveParticipant = async (
    participantId: string,
    name: string,
  ) => {
    if (!isAdmin) return;
    if (!confirm(`Remover ${name} desta partida?`)) return;

    const { error } = await supabase
      .from("match_participants")
      .delete()
      .eq("id", participantId);

    if (error) {
      toast.error("Erro ao remover participante.");
    } else {
      toast.success("Participante removido pelo organizador.");
      void fetchMatchDetails();
    }
  };

  const handleSortTeams = async () => {
    if (!isAdmin || !match) return;

    const isMatchVolei =
      match.sport_type === "volei" ||
      match.organization?.sport_type === "volei";
    const customGenderLimits = (match.teams_custom_config as any)
      ?.gender_limits;
    const maxMen =
      match.max_homens_por_time ?? customGenderLimits?.max_homens_por_time;
    const maxFem =
      match.max_mulheres_por_time ?? customGenderLimits?.max_mulheres_por_time;

    const totalSlots = match.num_times * match.jogadores_por_time;

    setIsSorting(true);

    try {
      // Sorteio inteligente e balanceado por níveis de qualidade (1 a 10) na liga e cotas de gênero
      const result = balanceParticipantsIntoTeams({
        participants,
        numTeams: match.num_times,
        playersPerTeam: match.jogadores_por_time,
        minFemPerTeam: match.min_mulheres_por_time,
        maxMenPerTeam: isMatchVolei ? maxMen : null,
        maxFemPerTeam: isMatchVolei ? maxFem : null,
        sportType: isMatchVolei ? "volei" : "futebol",
        leagueRatingsMap,
      });

      const updates: { id: string; team: number | null }[] = [];

      result.teamBuckets.forEach((bucket) => {
        bucket.forEach((item) => {
          updates.push({ id: item.id, team: item.team });
        });
      });

      result.reserves.forEach((res) => {
        updates.push({ id: res.id, team: null });
      });

      // Aplicar no banco de dados
      for (const u of updates) {
        await supabase
          .from("match_participants")
          .update({ team: u.team })
          .eq("id", u.id);
      }

      if (result.femWarning) {
        toast.warning(result.femWarning, { duration: 8000 });
      }

      if (result.menWarning) {
        toast.warning(result.menWarning, { duration: 8000 });
      }

      toast.success(
        `Times sorteados e equilibrados! ${Math.min(participants.length, totalSlots)} jogadores distribuídos em ${match.num_times} times.`,
      );

      // Notificar todos os participantes sobre o sorteio dos times
      const participantUserIds = participants
        .map((p) => p.user_id)
        .filter((id): id is string => !!id);
      if (participantUserIds.length > 0) {
        void createBatchNotifications(participantUserIds, {
          type: "match_update",
          title: "Times Sorteados! 🎲",
          message: `Os times da partida "${match.titulo}" acabaram de ser sorteados pelo organizador. Confira a sua escalação!`,
          link: `/matches/${match.id}`,
          metadata: { match_id: match.id },
        });
      }

      await fetchMatchDetails();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao sortear times.");
    } finally {
      setIsSorting(false);
    }
  };

  const promptSortTeams = () => {
    if (!isAdmin || !match) return;
    setConfirmModal({
      isOpen: true,
      type: "sort",
      title: hasTeamsAssigned
        ? "Confirmação de Segurança: Ressortear Times"
        : "Confirmação de Segurança: Sortear Times",
      message: hasTeamsAssigned
        ? "Tem certeza que deseja RESSORTEAR TODOS OS TIMES?\n\nEsta ação irá redistribuir novamente todos os participantes em novos times e alterar a formação atual."
        : "Tem certeza que deseja realizar o SORTEIO AUTOMÁTICO de todos os participantes nos times agora?",
    });
  };

  const promptClearTeams = () => {
    if (!isAdmin || !match) return;
    setConfirmModal({
      isOpen: true,
      type: "clear",
      title: "Confirmação de Segurança: Desfazer Times",
      message:
        "Tem certeza que deseja DESFAZER TODOS OS TIMES?\n\n• Todos os participantes voltarão a ficar sem time alocado.\n• O histórico de raspadinhas virtuais será resetado.\n• Os inscritos continuarão confirmados na partida.",
    });
  };

  const handleClearTeams = async () => {
    if (!isAdmin || !match) return;

    setIsSorting(true);
    try {
      for (const p of participants) {
        await supabase
          .from("match_participants")
          .update({ team: null })
          .eq("id", p.id);
      }
      // Limpar histórico de raspadinha desta partida
      await supabase
        .from("match_scratch_history")
        .delete()
        .eq("match_id", match.id);

      toast.success("Times desfeitos e raspadinhas resetadas para todos.");
      await fetchMatchDetails();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao limpar times.");
    } finally {
      setIsSorting(false);
    }
  };

  const handleShareWhatsapp = () => {
    if (!match) return;

    const dateParts = match.data.split("-");
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const pageUrl = window.location.href;

    const text = `🏐 *${match.titulo}*\n📍 *Local:* ${match.local}\n📅 *Data:* ${formattedDate} às ${match.horario.substring(0, 5)}\n💰 *Valor:* R$ ${match.valor.toFixed(2)}\n👥 *Vagas:* ${participants.length}/${match.limite_participantes} confirmados\n🏟️ *Times:* ${match.num_times} times × ${match.jogadores_por_time} jogadores\n\nInscreva-se aqui: ${pageUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleContactOrganizer = () => {
    if (!match) return;
    const owner = match.organization?.owner;
    if (!owner) {
      toast.info("Informações do organizador não disponíveis.");
      return;
    }

    const ownerPhone = (owner.whatsapp || "").replace(/\D/g, "");
    const cleanPhone = ownerPhone.startsWith("55")
      ? ownerPhone
      : ownerPhone
        ? `55${ownerPhone}`
        : "";

    const dateParts = match.data.split("-");
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const timeFormatted = match.horario.substring(0, 5);

    const message = `Olá, ${owner.nome}! Tenho algumas dúvidas sobre a partida "${match.titulo}" agendada para ${formattedDate} às ${timeFormatted}h no ${match.local}. Poderia me orientar?`;

    const whatsappUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank");
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!match) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading(
      "Gerando PDF com a escalação oficial da partida...",
    );
    try {
      // Pequeno timeout para permitir que a UI renderize o estado de carregamento
      await new Promise((resolve) => setTimeout(resolve, 250));
      generateMatchPdf({ match, participants });
      toast.success("PDF dos times e jogadores baixado com sucesso! 📄", {
        id: toastId,
      });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o arquivo PDF.", { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Trophy className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <span className="text-sm font-semibold text-slate-500">
          Carregando detalhes da partida...
        </span>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <p className="text-slate-600 dark:text-slate-400 font-bold mb-4">
          Partida não encontrada.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold"
        >
          Voltar para o App
        </Link>
      </div>
    );
  }

  const remaining = Math.max(
    0,
    match.limite_participantes - participants.length,
  );
  const isFull = remaining === 0;

  const dateParts = match.data.split("-");
  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

  const getPositionInfo = (
    posicao?: string | null,
    isVolei: boolean = false,
  ) => {
    if (!posicao || !posicao.trim()) return null;
    const cleanPos = posicao.trim();

    if (isVolei) {
      switch (cleanPos) {
        case "Levantador":
          return {
            label: "Levantador",
            emoji: "🤲",
            color:
              "text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30",
          };
        case "Ponteiro":
          return {
            label: "Ponteiro",
            emoji: "⚡",
            color:
              "text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/30",
          };
        case "Oposto":
          return {
            label: "Oposto",
            emoji: "💥",
            color:
              "text-purple-600 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/30",
          };
        case "Central":
          return {
            label: "Central",
            emoji: "🛡️",
            color:
              "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30",
          };
        case "Líbero":
          return {
            label: "Líbero",
            emoji: "🧤",
            color:
              "text-amber-500 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30",
          };
        default:
          return {
            label: cleanPos,
            emoji: "🏐",
            color:
              "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
          };
      }
    } else {
      switch (cleanPos) {
        case "Goleiro":
          return {
            label: "Goleiro",
            emoji: "🧤",
            color:
              "text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30",
          };
        case "Zagueiro":
          return {
            label: "Zagueiro",
            emoji: "🛡️",
            color:
              "text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/30",
          };
        case "Lateral":
          return {
            label: "Lateral",
            emoji: "🏃",
            color:
              "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/30",
          };
        case "Volante":
          return {
            label: "Volante",
            emoji: "⚓",
            color:
              "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/30",
          };
        case "Meia":
          return {
            label: "Meio-campo",
            emoji: "🎯",
            color:
              "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30",
          };
        case "Atacante":
          return {
            label: "Atacante",
            emoji: "⚡",
            color:
              "text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/15 border-red-500/30",
          };
        case "Ponta":
          return {
            label: "Ponta",
            emoji: "⚡",
            color:
              "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30",
          };
        default:
          return {
            label: cleanPos,
            emoji: "⚽",
            color:
              "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
          };
      }
    }
  };

  const renderParticipantRow = (
    p: MatchParticipant,
    index: number,
    teamColor?: (typeof TEAM_COLORS)[0],
  ) => {
    const displayName = p.user?.apelido
      ? `${p.user.nome} (${p.user.apelido})`
      : p.user?.nome || p.guest_name || "Jogador";

    const isMatchVolei =
      match?.sport_type === "volei" ||
      match?.organization?.sport_type === "volei";

    // Posição e dominância estritamente contextuais conforme a modalidade da partida/liga
    const rawPosition = isMatchVolei
      ? p.user?.volei_position
      : p.user?.futebol_position || p.user?.posicao;

    const dominance = isMatchVolei
      ? p.user?.volei_dominant_hand
      : p.user?.futebol_dominant_foot || p.user?.pe_dominante;

    const posInfo = getPositionInfo(rawPosition, isMatchVolei);

    const posSubtitle = posInfo ? `Posição: ${posInfo.label}` : "";
    const domSubtitle = dominance
      ? isMatchVolei
        ? `Mão: ${dominance}`
        : `Pé: ${dominance}`
      : "";
    const combinedSubtitle =
      [posSubtitle, domSubtitle].filter(Boolean).join(" • ") ||
      "Participante Confirmado";

    return (
      <div
        key={p.id}
        className="p-3 mb-2 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
      >
        {/* Informações do Jogador */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={`w-6 h-6 rounded-full shrink-0 ${teamColor ? teamColor.color : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"} text-white font-black flex items-center justify-center text-[11px] shadow-xs`}
          >
            {index + 1}
          </span>

          {/* Foto de Perfil Ampliável com Lightbox (Ação Exclusiva de Imagem) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (p.user?.avatar_url) {
                openImagePreview({
                  imageUrl: p.user.avatar_url,
                  title: displayName,
                  subtitle: combinedSubtitle,
                  type: "avatar",
                  badge: posInfo?.label || undefined,
                });
              }
            }}
            className={`w-10 h-10 rounded-full ${
              !p.user_id && p.guest_name ? "bg-amber-500" : "bg-brand-500"
            } text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 transition-all border-2 border-white dark:border-slate-800 shadow-sm ${
              p.user?.avatar_url
                ? "cursor-pointer hover:scale-110 active:scale-95 hover:ring-2 ring-brand-500/80 hover:shadow-md"
                : "cursor-default"
            }`}
            title={
              p.user?.avatar_url
                ? "Toque para ver a foto ampliada"
                : displayName
            }
          >
            {p.user?.avatar_url ? (
              <img
                src={p.user.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              (p.user?.nome || p.guest_name)?.charAt(0).toUpperCase() || "J"
            )}
          </button>

          {/* Dados do Jogador com Link Exclusivo no Nome ou Campo de Edição */}
          <div className="min-w-0 flex-1">
            {isAdmin && editingParticipantId === p.id ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSavePlayerName(p);
                    if (e.key === "Escape") setEditingParticipantId(null);
                  }}
                  className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-brand-500 rounded-lg text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSavePlayerName(p)}
                  disabled={isEditingPlayerLoading}
                  className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shrink-0"
                  title="Salvar alteração de nome"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingParticipantId(null)}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors shrink-0"
                  title="Cancelar"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {p.user_id ? (
                  <>
                    <Link
                      href={`/profile/${p.user_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-black text-slate-900 dark:text-white text-xs sm:text-sm hover:text-brand-500 hover:underline transition-colors leading-tight inline-block cursor-pointer"
                      title={`Ver perfil de ${displayName}`}
                    >
                      {displayName}
                    </Link>
                    <span
                      className="px-1.5 py-px rounded-md text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hidden sm:inline-flex items-center gap-0.5 select-none"
                      title="Membro cadastrado na liga"
                    >
                      Membro
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm leading-tight inline-block">
                      {displayName}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1 select-none"
                      title="Jogador convidado avulso (sem cadastro no aplicativo)"
                    >
                      <span>Convidado</span>
                    </span>
                  </div>
                )}

                {p.paid ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-0.5 select-none">
                    Pago ✅
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 flex items-center gap-0.5 select-none">
                    Pendente ⏳
                  </span>
                )}
              </div>
            )}

            {(posInfo || dominance) && (
              <div className="flex items-center gap-1.5 mt-1">
                {posInfo && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] sm:text-[11px] font-bold shadow-2xs ${posInfo.color} select-none`}
                  >
                    <span>{posInfo.emoji}</span>
                    <span>{posInfo.label}</span>
                  </span>
                )}
                {dominance && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold select-none">
                    • {dominance}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Menu de Alteração de Time e Ações do Admin */}
        {isAdmin && (
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 mt-0.5 sm:mt-0">
            <select
              value={p.team ?? ""}
              onChange={(e) => {
                const val =
                  e.target.value === "" ? null : parseInt(e.target.value);
                handleAdminChangeTeam(p.id, val);
              }}
              className="flex-1 sm:flex-none px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs cursor-pointer"
              title="Mover de time (Admin)"
            >
              <option value="">Reserva / Sem Time</option>
              {Array.from({ length: match.num_times }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {TEAM_COLORS[i]?.name || `Time ${i + 1}`}
                </option>
              ))}
            </select>

            {editingParticipantId !== p.id && (
              <button
                type="button"
                onClick={() => handleStartEditPlayer(p)}
                className="p-1.5 text-slate-400 hover:text-amber-500 rounded-xl hover:bg-amber-500/10 transition-colors"
                title="Editar Nome do Jogador"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => handleRemoveParticipant(p.id, displayName)}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-colors"
              title="Remover Jogador"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Header
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenCreatePost={() => setIsCreatePostOpen(true)}
        onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      <main className="w-full flex-1 pb-28 sm:pb-12 pb-safe">
        <div className="grid grid-cols-1 gap-y-5 sm:gap-y-6 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 sm:pt-5">
          {/* ═══════════════════════════════════════════════════════════════════
              1. CABEÇALHO DA PARTIDA (Navegação, Liga, Organizador e Ações Rápidas)
              Mobile First: Compacto, integrado à tela, sem cards gigantes.
          ═══════════════════════════════════════════════════════════════════ */}
          <header className="lg:col-span-12 space-y-3">
            <div className="flex items-center justify-between gap-2">
              {/* Botão Voltar Touch-friendly */}
              <Link
                href="/"
                className="inline-flex min-h-[40px] items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-brand-500 hover:border-brand-500/40 text-xs font-bold transition-all shadow-xs shrink-0"
                title="Voltar para todas as partidas"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden xs:inline">Voltar</span>
              </Link>

              {/* Ações Rápidas de Topo com Descrição Visível */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* 1. Compartilhar */}
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={handleShareWhatsapp}
                  className="inline-flex min-h-[40px] items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Compartilhar detalhes da partida no WhatsApp"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                  <span>Compartilhar</span>
                </motion.button>

                {/* 2. Financeiro */}
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={() => setIsFinanceModalOpen(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Visualizar prestação de contas da partida"
                >
                  <Receipt className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  <span>Financeiro</span>
                </motion.button>

                {/* 3. Modo Telão */}
                <Link
                  href={`/matches/${match.id}/tv`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-xs shrink-0"
                  title="Abrir transmissão do placar e escalação em tela cheia para TV"
                >
                  <Tv className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                  <span>Telão</span>
                </Link>
              </div>
            </div>

            {/* Organizador e disponibilidade de vagas */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-2.5 dark:border-slate-800/60 w-full">
              {match.organization?.owner && (
                <div className="flex min-w-0 flex-1 sm:flex-initial items-center justify-between sm:justify-start gap-2 px-2.5 py-1.5 h-[46px] rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Foto de Perfil com Lightbox Clicável */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (match.organization?.owner?.avatar_url) {
                            openImagePreview({
                              imageUrl: match.organization.owner.avatar_url,
                              title: match.organization.owner.nome,
                              subtitle: `Organizador Oficial • ${match.titulo || "Partida"}`,
                              type: "avatar",
                              badge: "Organizador",
                            });
                          }
                        }}
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all shadow-xs ${
                          match.organization.owner.avatar_url
                            ? "cursor-pointer border-brand-500/50 hover:border-brand-500 hover:scale-105 active:scale-95"
                            : "border-slate-200 dark:border-slate-800 bg-brand-500/15 text-brand-600 dark:text-brand-400"
                        }`}
                        title={
                          match.organization.owner.avatar_url
                            ? "Toque para ampliar a foto do organizador"
                            : match.organization.owner.nome
                        }
                      >
                        {match.organization.owner.avatar_url ? (
                          <img
                            src={match.organization.owner.avatar_url}
                            alt={match.organization.owner.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-black text-[11px]">
                            {match.organization.owner.nome
                              .substring(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </button>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-xs border border-white dark:border-slate-900"
                        title="Organizador Oficial"
                      >
                        <Shield className="w-2 h-2" />
                      </div>
                    </div>

                    {/* Informações do Organizador */}
                    <div className="min-w-0 leading-tight">
                      <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Organizador
                      </span>
                      <strong className="block truncate text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 max-w-[85px] xs:max-w-[120px] sm:max-w-[180px]">
                        {match.organization.owner.nome}
                      </strong>
                    </div>
                  </div>

                  {/* Botão de Contato com Mensagem Personalizada para Dúvidas */}
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    type="button"
                    onClick={handleContactOrganizer}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-all shadow-xs cursor-pointer shrink-0"
                    title="Enviar mensagem com dúvidas sobre a partida diretamente no WhatsApp do organizador"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Dúvidas</span>
                  </motion.button>
                </div>
              )}

              {/* Status de Vagas com o mesmo alinhamento e design */}
              <div
                role="status"
                aria-live="polite"
                aria-label={
                  isFull
                    ? "Partida lotada, nenhuma vaga restante"
                    : `${remaining} ${remaining === 1 ? "vaga restante" : "vagas restantes"}`
                }
                className="flex items-center gap-2 px-3 py-1.5 h-[46px] rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs shrink-0"
              >
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isFull
                        ? "bg-rose-400 animate-ping"
                        : "bg-emerald-400 animate-ping"
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      isFull ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                  />
                </span>
                <div className="flex flex-col justify-center leading-tight">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Vagas
                  </span>
                  <span
                    className={`text-xs font-black ${
                      isFull ? "text-rose-500" : "text-emerald-500"
                    } whitespace-nowrap`}
                  >
                    {isFull ? (
                      "Lotada"
                    ) : (
                      <>
                        <strong className="tabular-nums">{remaining}</strong>{" "}
                        {remaining === 1 ? "restante" : "restantes"}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* ═══════════════════════════════════════════════════════════════════
              2. INFORMAÇÕES DA PARTIDA (HERO ESPORTIVO)
          ═══════════════════════════════════════════════════════════════════ */}
          <section className="lg:col-span-7 space-y-4">
            {/* Título da partida */}
            <div className="space-y-2.5">
              {/* Composição por gênero para vôlei */}
              {isMatchVolei &&
                (() => {
                  const customGenderLimits = (match.teams_custom_config as any)
                    ?.gender_limits;
                  const maxH =
                    match.max_homens_por_time ??
                    customGenderLimits?.max_homens_por_time;
                  const maxM =
                    match.max_mulheres_por_time ??
                    customGenderLimits?.max_mulheres_por_time;
                  if (
                    maxH !== undefined &&
                    maxM !== undefined &&
                    (maxH > 0 || maxM > 0)
                  ) {
                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-black tracking-wider">
                        ⚖️ ♂️ {maxH} Homens + ♀️ {maxM} Mulheres / time
                      </span>
                    );
                  }
                  return null;
                })()}

              {/* Título Oficial com GradientText */}
              <div className="flex flex-col items-center justify-center text-center py-2 sm:py-3 min-w-0">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="titulo-logo text-2xl sm:text-3xl md:text-4xl !tracking-[0.08em] leading-tight line-clamp-2 px-2"
                >
                  <GradientText
                    colors={
                      isMatchVolei
                        ? ["#fbbf24", "#ffffff", "#d97706"]
                        : ["#58ff00", "#ffffff", "#086415"]
                    }
                    animationSpeed={2}
                    variant="flow"
                    glow={0.5}
                    className="titulo-logo text-2xl sm:text-3xl md:text-4xl !tracking-[0.08em]"
                  >
                    {match.titulo}
                  </GradientText>
                </motion.h1>
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "4rem", opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  className={`h-1.5 rounded-full mx-auto mt-3 ${
                    isMatchVolei
                      ? "bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                      : "bg-gradient-to-r from-[#58ff00] via-emerald-500 to-[#086415] shadow-[0_0_12px_rgba(88,255,0,0.5)]"
                  }`}
                  style={{ width: "4rem" }}
                />
              </div>
            </div>

            {/* Cronômetro Esportivo */}
            <MatchCountdown
              match={match}
              onOpenChampion={isEnded ? handleOpenChampionModal : undefined}
              onOpenStandings={
                isEnded ? () => setIsStandingsModalOpen(true) : undefined
              }
            />

            {/* Grade de Estatísticas e Métricas da Partida */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
              {/* Data */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Data
                  </span>
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  {formattedDate}
                </span>
              </div>

              {/* Horário */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Horário
                  </span>
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  {match.horario.substring(0, 5)}
                </span>
              </div>

              {/* Coleta */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Coleta
                  </span>
                </div>
                <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                  {match.valor > 0 ? `R$ ${match.valor.toFixed(2)}` : "Grátis"}
                </span>
              </div>

              {/* Inscritos */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Inscritos
                  </span>
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  {participants.length} / {match.limite_participantes}
                </span>
              </div>

              {/* Formação */}
              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Formação
                  </span>
                </div>
                <span className="font-black text-xs sm:text-sm text-brand-500 leading-tight">
                  {match.num_times} times × {match.jogadores_por_time} jog.
                </span>
              </div>
            </div>

            {/* Localização & Rota (Como Chegar) */}
            <motion.a
              whileTap={{ scale: 0.98 }}
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 transition-all shadow-xs group cursor-pointer"
              title="Abrir rota no Google Maps / GPS"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-500 group-hover:scale-105 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 text-left">
                  <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 block truncate">
                    {match.local}
                  </span>
                  {match.endereco && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">
                      {match.endereco}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-500 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0 shadow-xs group-hover:bg-emerald-600 transition-colors">
                <Navigation className="w-3 h-3 shrink-0" />
                <span>Como Chegar</span>
              </div>
            </motion.a>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              3. ÁREA DE DESTAQUES & SITUAÇÃO PESSOAL DO JOGADOR
          ═══════════════════════════════════════════════════════════════════ */}
          <section className="lg:col-span-5 space-y-3.5">
            {/* BANNER DE RASPADINHA PARA O PARTICIPANTE INSCRITO */}
            {isJoined &&
              currentParticipant &&
              match.sorteio_raspadinha_ativo && (
                <div
                  className={`hidden sm:block p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-2.5 text-center animate-in fade-in duration-300 border shadow-xs ${
                    currentParticipant.team != null
                      ? "bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30"
                      : "bg-gradient-to-r from-amber-500/20 via-brand-500/20 to-purple-500/20 border-amber-400/40"
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs ${
                      currentParticipant.team != null
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/20 text-amber-500 dark:text-amber-400"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {currentParticipant.team != null
                        ? "🔒 Sorteio da Raspadinha Concluído"
                        : "🎰 Raspadinha da Sorte Ativada!"}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    {currentParticipant.team != null &&
                      (() => {
                        const teamNum = currentParticipant.team;
                        const tInfo = getTeamInfo(match, teamNum);
                        return (
                          <TeamBadge
                            teamInfo={tInfo}
                            size="md"
                            rounded="full"
                            className="shadow-sm"
                            onClick={(e) => {
                              if (tInfo.badge_url) {
                                e.stopPropagation();
                                openImagePreview({
                                  imageUrl: tInfo.badge_url,
                                  title: tInfo.name,
                                  subtitle: `Seu Time Oficial • ${match.titulo || "Partida"}`,
                                  type: "team_badge",
                                  badge: "Seu Time",
                                });
                              }
                            }}
                          />
                        );
                      })()}
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      {currentParticipant.team != null
                        ? `Seu Time Oficial: ${getTeamInfo(match, currentParticipant.team).name}`
                        : "Você ainda não possui um time nesta partida!"}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed font-medium">
                    {currentParticipant.team != null
                      ? "Seu sorteio por raspadinha já foi registrado e vinculado permanentemente no banco de dados para esta partida."
                      : "Clique no botão abaixo para abrir sua raspadinha individual e descobrir o seu time."}
                  </p>

                  {/* Botão de Abrir Raspadinha exibido APENAS se team for NULL e partida não encerrada */}
                  {!isEnded && currentParticipant.team == null && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setIsScratchCardOpen(true)}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-600 hover:to-brand-600 text-white font-black rounded-xl text-xs shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2 mx-auto mt-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Abrir Minha Raspadinha Virtual</span>
                    </motion.button>
                  )}
                </div>
              )}

            {/* CARD DE STATUS DE PAGAMENTO PIX PARA INSCRITO */}
            {isJoined && currentParticipant && match.valor > 0 && (
              <div
                className={`hidden sm:flex p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border flex-col sm:flex-row items-center justify-between gap-3 shadow-xs ${
                  currentParticipant.paid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      currentParticipant.paid
                        ? "bg-emerald-500/20"
                        : "bg-amber-500/20"
                    }`}
                  >
                    {currentParticipant.paid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <QrCode className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-black text-xs block">
                      {currentParticipant.paid
                        ? "Pagamento Confirmado! ✅"
                        : isEnded
                          ? "Partida Encerrada"
                          : "Pagamento da Inscrição Pendente ⏳"}
                    </span>
                    <span className="text-[11px] opacity-80 block font-medium">
                      {currentParticipant.paid
                        ? `Sua taxa de R$ ${match.valor.toFixed(2)} já foi baixada no sistema.`
                        : isEnded
                          ? "O evento já foi realizado."
                          : `Realize o pagamento de R$ ${match.valor.toFixed(2)} via PIX para garantir sua vaga.`}
                    </span>
                  </div>
                </div>

                {!isEnded && !currentParticipant.paid && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsPixModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Pagar R$ {match.valor.toFixed(2)} via PIX</span>
                  </motion.button>
                )}
              </div>
            )}

            {/* BOTÃO PRINCIPAL DE INSCRIÇÃO NO DESKTOP */}
            {!isEnded && (
              <div className="hidden sm:block">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={handleToggleJoin}
                  disabled={!isJoined && isFull}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    isJoined
                      ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/25"
                      : isFull
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/30"
                  }`}
                >
                  {isJoined ? (
                    <>
                      <XCircle className="w-5 h-5" />
                      <span>Cancelar Minha Participação</span>
                    </>
                  ) : isFull ? (
                    <span>Partida Lotada (Sem vagas disponíveis)</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Quero Participar! Garanta Minha Vaga</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* AVISO DA ORGANIZAÇÃO */}
            {match.observacoes && (
              <aside
                role="note"
                aria-labelledby="match-observation-title"
                className="relative isolate overflow-hidden rounded-[1.6rem] border border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-[0_10px_30px_rgba(245,158,11,0.16)] dark:border-amber-300/35 dark:from-[#211706] dark:via-[#111827] dark:to-[#25100b] dark:shadow-[0_12px_34px_rgba(245,158,11,0.12)]"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500"
                />
                <div
                  aria-hidden="true"
                  className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-amber-300/30 blur-3xl dark:bg-orange-400/15"
                />

                <div className="relative flex items-start gap-3.5 p-4 sm:gap-4 sm:p-5">
                  <div className="relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25">
                    <Megaphone className="h-5 w-5" strokeWidth={2.5} />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-full w-full rounded-full bg-amber-500/70 motion-safe:animate-ping" />
                      <span className="relative h-2.5 w-2.5 rounded-full border-2 border-amber-50 bg-emerald-400 dark:border-slate-900" />
                    </span>
                  </div>

                  <div
                    className={`min-w-0 flex-1 t-stagger ${
                      isObservationShown ? "is-shown" : ""
                    }`}
                  >
                    <span
                      id="match-observation-title"
                      className="t-stagger-line t-stagger-line--1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300"
                    >
                      Aviso da organização
                      <span className="ml-2 inline-flex items-center rounded-full border border-amber-500/25 bg-amber-400/20 px-2 py-0.5 align-middle text-[9px] tracking-[0.1em] text-amber-800 dark:text-amber-200">
                        Para todos
                      </span>
                    </span>
                    <p className="t-stagger-line t-stagger-line--2 mt-2 text-[15px] font-extrabold leading-relaxed text-slate-900 dark:text-white sm:text-base">
                      {match.observacoes}
                    </p>
                  </div>
                </div>
              </aside>
            )}

            {/* DESTAQUES DA RODADA: CRAQUE DA PARTIDA (MVP) & ANINGA 🐍 */}
            {(match.mvp_player || match.aninga_player || isAdmin) && (
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-lg space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                        Destaques da Rodada
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Eleição oficial do Melhor e Pior em campo
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsHighlightsModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>
                        {match.mvp_player || match.aninga_player
                          ? "Alterar Destaques"
                          : "Eleger Destaques"}
                      </span>
                    </button>
                  )}
                </div>

                {match.mvp_player || match.aninga_player ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Card do Craque da Partida (MVP) */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-amber-600/5 border border-amber-500/30 flex items-center gap-3.5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                        <Trophy className="w-16 h-16 text-amber-400" />
                      </div>

                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 font-black text-sm overflow-hidden shadow-md shadow-amber-500/20">
                          {match.mvp_player?.avatar_url ? (
                            <img
                              src={match.mvp_player.avatar_url}
                              alt={match.mvp_player.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            match.mvp_player?.nome?.charAt(0).toUpperCase() ||
                            "🏆"
                          )}
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 text-base">
                          👑
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                            🏆 Craque da Partida (MVP)
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white truncate">
                          {match.mvp_player
                            ? match.mvp_player.nome
                            : "Ainda não definido"}
                          {match.mvp_player?.apelido && (
                            <span className="text-amber-300 font-bold ml-1 text-xs">
                              ({match.mvp_player.apelido})
                            </span>
                          )}
                        </h4>
                        {match.mvp_notes && (
                          <p className="text-[11px] text-amber-200/90 font-medium italic truncate mt-0.5">
                            "{match.mvp_notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card do ANINGA (Pior da Partida) */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-600/5 border border-emerald-500/30 flex items-center gap-3.5 relative overflow-hidden group">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-black text-sm overflow-hidden shadow-md shadow-emerald-500/20">
                          {match.aninga_player?.avatar_url ? (
                            <img
                              src={match.aninga_player.avatar_url}
                              alt={match.aninga_player.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            match.aninga_player?.nome
                              ?.charAt(0)
                              .toUpperCase() || "🐍"
                          )}
                        </div>
                        <span className="absolute -top-1.5 -right-1.5 text-base">
                          🐍
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                            🐍 ANINGA da Rodada
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white truncate">
                          {match.aninga_player
                            ? match.aninga_player.nome
                            : "Ainda não definido"}
                          {match.aninga_player?.apelido && (
                            <span className="text-emerald-300 font-bold ml-1 text-xs">
                              ({match.aninga_player.apelido})
                            </span>
                          )}
                        </h4>
                        {match.aninga_notes && (
                          <p className="text-[11px] text-emerald-200/90 font-medium italic truncate mt-0.5">
                            "{match.aninga_notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400 font-medium">
                      O organizador ainda não elegeu o{" "}
                      <strong>Craque da Partida 🏆</strong> e o{" "}
                      <strong>ANINGA 🐍</strong> desta rodada.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              4. ÁREA DE NAVEGAÇÃO ENTRE ABAS (MOBILE FIRST TABS)
          ═══════════════════════════════════════════════════════════════════ */}
          <nav
            aria-label="Navegação da partida"
            className="lg:col-span-12 w-full flex justify-center py-1.5 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-y border-slate-200/70 dark:border-slate-800/70 sm:border sm:rounded-2xl sm:shadow-sm"
          >
            <div className="mx-auto p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center justify-between gap-1 w-full max-w-[520px]">
              {/* Aba 1: Times & Presença */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                aria-pressed={matchTab === "info"}
                onClick={() => {
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate(10);
                  }
                  setMatchTab("info");
                }}
                className={`px-2 sm:px-5 py-2.5 rounded-xl font-black text-xs transition-all flex flex-1 items-center justify-center gap-1.5 min-w-0 min-h-[46px] touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset ${
                  matchTab === "info"
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span className="sm:hidden">Times</span>
                <span className="hidden sm:inline">Times & Presença</span>
              </motion.button>

              {/* Aba 2: Placar ao Vivo */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                aria-pressed={matchTab === "scoreboard"}
                onClick={() => {
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate(10);
                  }
                  setMatchTab("scoreboard");
                }}
                className={`px-2 sm:px-5 py-2.5 rounded-xl font-black text-xs transition-all flex flex-1 items-center justify-center gap-1.5 min-w-0 min-h-[46px] touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${
                  matchTab === "scoreboard"
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="sm:hidden">Ao vivo</span>
                <span className="hidden sm:inline">🏟️ Placar ao Vivo</span>
              </motion.button>

              {/* Aba 3: Classificação */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                aria-pressed={matchTab === "standings"}
                onClick={() => {
                  if (typeof window !== "undefined" && "vibrate" in navigator) {
                    navigator.vibrate(10);
                  }
                  setMatchTab("standings");
                }}
                className={`px-2 sm:px-5 py-2.5 rounded-xl font-black text-xs transition-all flex flex-1 items-center justify-center gap-1.5 min-w-0 min-h-[46px] touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset ${
                  matchTab === "standings"
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span className="sm:hidden">Tabela</span>
                <span className="hidden sm:inline">Classificação</span>
              </motion.button>
            </div>
          </nav>

          {/* ═══════════════════════════════════════════════════════════════════
              5. CONTEÚDO DAS ABAS
          ═══════════════════════════════════════════════════════════════════ */}
          {/* ABA: PLACAR AO VIVO */}
          {matchTab === "scoreboard" && (
            <div className="lg:col-span-12">
              <LiveScoreboard
                match={match}
                participants={participants}
                onGameFinished={() => fetchMatchDetails()}
              />
            </div>
          )}

          {/* ABA: CLASSIFICAÇÃO AUTOMÁTICA */}
          {matchTab === "standings" && (
            <div className="lg:col-span-12">
              <StandingsTable
                matchId={match.id}
                leagueId={match.organization_id}
                sportType={match.sport_type}
                numTeams={match.num_times}
                showTopScorers={true}
              />
            </div>
          )}

          {/* ABA: TIMES & PRESENÇA */}
          {matchTab === "info" && (
            <div className="lg:col-span-12 space-y-4 sm:space-y-5">
              {/* 5.1 ÁREA ADMINISTRATIVA (Apenas Administrador / Organizador) */}
              {isAdmin && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-brand-500 shrink-0" />
                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-white">
                          Gerenciamento da Partida & Times (Admin)
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Controles operacionais e distribuição de equipes
                        </p>
                      </div>
                    </div>

                    {/* Toggle Sorteio via Raspadinha */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Sorteio por Raspadinha
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={match.sorteio_raspadinha_ativo}
                        onClick={handleToggleScratchMode}
                        className={`relative inline-flex h-9 w-[60px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                          match.sorteio_raspadinha_ativo
                            ? "bg-amber-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        }`}
                        title="Ativar/Desativar Raspadinha Virtual"
                      >
                        <span
                          className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            match.sorteio_raspadinha_ativo
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Ações Administrativas de Times */}
                  <div className="grid grid-cols-2 items-stretch gap-2 sm:flex sm:flex-wrap">
                    <Link
                      href={`/matches/${match.id}/control`}
                      className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-brand-600 hover:from-emerald-500 hover:to-brand-500 text-white font-black text-xs leading-tight text-center rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Mesa de controle da arbitragem ao vivo"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Mesa de Controle ao Vivo</span>
                    </Link>

                    {participants.length > 0 && (
                      <button
                        type="button"
                        onClick={promptSortTeams}
                        disabled={isSorting}
                        className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs leading-tight text-center rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>
                          {isSorting
                            ? "Sorteando..."
                            : hasTeamsAssigned
                              ? "Ressortear Times"
                              : "Sortear Automaticamente"}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsEditTeamsOpen(true)}
                      className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs leading-tight text-center rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5 text-brand-500" />
                      <span>Personalizar Times & Cores</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPlayerManagerOpen(true)}
                      className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs leading-tight text-center rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Adicionar jogadores manualmente"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
                      <span>+ Adicionar Jogador</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditMatchOpen(true)}
                      className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-3.5 py-2 sm:py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold leading-tight text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                      <span>Editar Partida</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-3.5 py-2 sm:py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold leading-tight text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Avisar no WhatsApp</span>
                    </button>

                    {hasTeamsAssigned && (
                      <button
                        type="button"
                        onClick={promptClearTeams}
                        disabled={isSorting}
                        className="w-full sm:w-auto min-h-16 sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs leading-tight text-center rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 border border-rose-500/25 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Desfazer Times</span>
                      </button>
                    )}
                  </div>

                  {/* Exportação em PDF da Escalação Oficial */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <FileDown className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-white">
                          Escalação Oficial & Vagas
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {participants.length} confirmado
                          {participants.length !== 1 ? "s" : ""} •{" "}
                          {match.num_times} times configurados
                        </p>
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={handleDownloadPdf}
                      disabled={isGeneratingPdf}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>
                        {isGeneratingPdf
                          ? "Gerando Documento..."
                          : "Gerar PDF dos Times"}
                      </span>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* 5.2 TIMES ORGANIZADOS (Acordeão Moderno com Emblemas em Destaque) */}
              {hasTeamsAssigned && (
                <div className="space-y-3.5">
                  {/* Barra de Ações Rápidas do Acordeão */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-brand-500" />
                      <span>Times Escalados ({match.num_times})</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExpandAllTeams}
                        className="min-h-9 px-2 text-[11px] font-bold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer"
                      >
                        Expandir Todos
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">
                        •
                      </span>
                      <button
                        type="button"
                        onClick={handleCollapseAllTeams}
                        className="min-h-9 px-2 text-[11px] font-bold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer"
                      >
                        Recolher Todos
                      </button>
                    </div>
                  </div>

                  {/* Abas Rápidas de Navegação entre Times no Mobile */}
                  <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
                    <button
                      type="button"
                      onClick={handleExpandAllTeams}
                      className={`px-3 min-h-10 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                        expandedTeams.length === match.num_times
                          ? "bg-brand-500 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Todos ({participants.length})
                    </button>
                    {Array.from({ length: match.num_times }).map((_, idx) => {
                      const tNum = idx + 1;
                      const tConf = getTeamInfo(match, tNum);
                      const tCount = teamGroups[tNum]?.length || 0;
                      const isSelected =
                        expandedTeams.length === 1 && expandedTeams[0] === tNum;
                      return (
                        <button
                          key={tNum}
                          type="button"
                          onClick={() => setExpandedTeams([tNum])}
                          className={`px-3 min-h-10 rounded-xl text-xs font-black shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isSelected
                              ? `${tConf.border} bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs`
                              : "border-transparent bg-slate-100 dark:bg-slate-800/60 text-slate-500"
                          }`}
                        >
                          <span>{tConf.emoji || "⚽"}</span>
                          <span>{tConf.name}</span>
                          <span className="text-[10px] opacity-75 font-bold">
                            ({tCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                    {Array.from({ length: match.num_times }).map(
                      (_, teamIdx) => {
                        const teamNum = teamIdx + 1;
                        const teamConfig = getTeamInfo(match, teamNum);
                        const teamPlayers = teamGroups[teamNum] || [];
                        const isMyTeam = currentParticipant?.team === teamNum;
                        const isTeamFull =
                          teamPlayers.length >= match.jogadores_por_time;
                        const isExpanded = expandedTeams.includes(teamNum);

                        return (
                          <div
                            key={teamNum}
                            className={`bg-white dark:bg-slate-900/90 border-2 ${teamConfig.border} rounded-2xl sm:rounded-3xl shadow-xs relative overflow-hidden transition-all duration-200`}
                          >
                            {/* Barra de cor do time */}
                            <div
                              className={`absolute top-0 left-0 right-0 h-1.5 ${teamConfig.color}`}
                            />

                            {/* Cabeçalho do Acordeão: Emblema em Destaque + Nome + Chevron */}
                            <button
                              type="button"
                              onClick={() => toggleTeamAccordion(teamNum)}
                              aria-expanded={isExpanded}
                              className="w-full min-h-[84px] sm:min-h-[92px] p-3 sm:p-5 text-left flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
                            >
                              <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                                <TeamBadge
                                  teamInfo={teamConfig}
                                  size="lg"
                                  rounded="full"
                                  className="shadow-md shrink-0 border-2"
                                  imgClassName="p-0.5 scale-[1.52]"
                                  onClick={(e) => {
                                    if (teamConfig.badge_url) {
                                      e.stopPropagation();
                                      openImagePreview({
                                        imageUrl: teamConfig.badge_url,
                                        title: teamConfig.name,
                                        subtitle: `Emblema Oficial • ${match.titulo || "Partida"}`,
                                        type: "team_badge",
                                        badge: `${teamPlayers.length}/${match.jogadores_por_time} Jogadores`,
                                      });
                                    }
                                  }}
                                />

                                <div className="min-w-0">
                                  <h3
                                    className={`font-black text-sm sm:text-base ${teamConfig.text} truncate leading-tight`}
                                  >
                                    {teamConfig.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span
                                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                                        isTeamFull
                                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                          : `${teamConfig.lightBg} ${teamConfig.text}`
                                      }`}
                                    >
                                      {teamPlayers.length}/
                                      {match.jogadores_por_time} jogadores
                                    </span>
                                    {isMatchVolei && (
                                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                        ♂️{" "}
                                        {
                                          teamPlayers.filter(
                                            (p) =>
                                              p.user?.genero !== "feminino",
                                          ).length
                                        }{" "}
                                        · ♀️{" "}
                                        {
                                          teamPlayers.filter(
                                            (p) =>
                                              p.user?.genero === "feminino",
                                          ).length
                                        }
                                      </span>
                                    )}
                                    {isMyTeam && (
                                      <span className="text-[10px] font-black uppercase bg-brand-500/15 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-full border border-brand-500/25">
                                        Seu Time
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Botão de Expansão com Chevron Animado */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                                  {isExpanded ? "Recolher" : "Ver Jogadores"}
                                </span>
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 transition-transform duration-300 ${
                                    isExpanded
                                      ? "rotate-180 bg-brand-500/15 text-brand-600 dark:text-brand-400"
                                      : ""
                                  }`}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </div>
                              </div>
                            </button>

                            {/* Conteúdo Animado do Acordeão (Lista de Jogadores) */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  key={`team-content-${teamNum}`}
                                  id={`team-players-${teamNum}`}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{
                                    duration: 0.25,
                                    ease: "easeInOut",
                                  }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                                    {teamPlayers.length === 0 ? (
                                      <p className="text-xs text-slate-400 text-center py-4 italic">
                                        Nenhum jogador escalado neste time
                                        ainda.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5 pt-1">
                                        {teamPlayers.map((p, idx) =>
                                          renderParticipantRow(
                                            p,
                                            idx,
                                            teamConfig,
                                          ),
                                        )}
                                      </div>
                                    )}

                                    {/* BOTÃO DE ESCOLHA MANUAL PELO JOGADOR (QUANDO RASPADINHA DESATIVADA) */}
                                    {isJoined &&
                                      currentParticipant &&
                                      !match.sorteio_raspadinha_ativo && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                          <button
                                            onClick={() =>
                                              handleSelectTeamManual(teamNum)
                                            }
                                            disabled={!isMyTeam && isTeamFull}
                                            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                              isMyTeam
                                                ? "bg-red-500 hover:bg-red-600 text-white shadow-md"
                                                : isTeamFull
                                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                                  : "bg-brand-500 hover:bg-brand-600 text-white shadow-md hover:scale-[1.01]"
                                            }`}
                                          >
                                            {isMyTeam ? (
                                              <span>
                                                Sair do {teamConfig.name}
                                              </span>
                                            ) : isTeamFull ? (
                                              <span>Time Lotado</span>
                                            ) : (
                                              <span>
                                                Entrar no {teamConfig.name}
                                              </span>
                                            )}
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {/* Reservas / Suplentes (Acordeão) */}
                  {reserves.length > 0 && (
                    <div className="bg-white dark:bg-slate-900/90 border border-amber-300 dark:border-amber-700 rounded-2xl sm:rounded-3xl shadow-xs overflow-hidden transition-all duration-200">
                      <button
                        type="button"
                        onClick={() =>
                          setIsReservesExpanded(!isReservesExpanded)
                        }
                        aria-expanded={isReservesExpanded}
                        className="w-full min-h-[72px] p-4 sm:p-5 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-xs">
                            <UserPlus className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-sm sm:text-base text-amber-600 dark:text-amber-400">
                              Reservas / Suplentes
                            </h3>
                            <span className="text-xs font-bold text-slate-400 block mt-0.5">
                              {reserves.length} jogador
                              {reserves.length > 1 ? "es" : ""} aguardando vaga
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                            {isReservesExpanded ? "Recolher" : "Ver Reservas"}
                          </span>
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 transition-transform duration-300 ${
                              isReservesExpanded ? "rotate-180" : ""
                            }`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isReservesExpanded && (
                          <motion.div
                            id="match-reserves-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-amber-200/60 dark:border-amber-900/60 space-y-1.5">
                              {reserves.map((p, idx) =>
                                renderParticipantRow(p, idx),
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}

              {/* 5.4 LISTA SIMPLES (Quando não há times sorteados ainda) */}
              {!hasTeamsAssigned && (
                <div className="space-y-4">
                  {/* Opção de Escolha Manual nos cards de times quando desativada raspadinha */}
                  {!match.sorteio_raspadinha_ativo && isJoined && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.from({ length: match.num_times }).map(
                        (_, teamIdx) => {
                          const teamNum = teamIdx + 1;
                          const teamConfig = getTeamInfo(match, teamNum);
                          const teamPlayers = teamGroups[teamNum] || [];
                          const isMyTeam = currentParticipant?.team === teamNum;
                          const isTeamFull =
                            teamPlayers.length >= match.jogadores_por_time;

                          return (
                            <div
                              key={teamNum}
                              className={`p-4 rounded-2xl border ${teamConfig.border} bg-white dark:bg-slate-900/90 flex items-center justify-between gap-2 shadow-xs`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <TeamBadge
                                  teamInfo={teamConfig}
                                  size="md"
                                  rounded="full"
                                  className="shadow-sm"
                                  onClick={(e) => {
                                    if (teamConfig.badge_url) {
                                      e.stopPropagation();
                                      openImagePreview({
                                        imageUrl: teamConfig.badge_url,
                                        title: teamConfig.name,
                                        subtitle: "Emblema Oficial",
                                        type: "team_badge",
                                      });
                                    }
                                  }}
                                />
                                <div className="min-w-0">
                                  <span
                                    className={`font-black text-xs block ${teamConfig.text} truncate`}
                                  >
                                    {teamConfig.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {teamPlayers.length}/
                                    {match.jogadores_por_time} jogadores
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleSelectTeamManual(teamNum)}
                                disabled={!isMyTeam && isTeamFull}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                  isMyTeam
                                    ? "bg-red-500 text-white"
                                    : isTeamFull
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-brand-500 text-white hover:scale-105"
                                }`}
                              >
                                {isMyTeam
                                  ? "Sair"
                                  : isTeamFull
                                    ? "Lotado"
                                    : "Escolher"}
                              </button>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h2 className="font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-brand-500" />
                        <span>
                          Lista de Jogadores Confirmados ({participants.length})
                        </span>
                      </h2>
                      {isAdmin ? (
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() => setIsPlayerManagerOpen(true)}
                          className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Adicionar</span>
                        </motion.button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Atualização em tempo real
                        </span>
                      )}
                    </div>

                    {participants.length === 0 ? (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-xs text-slate-500 font-medium">
                          Nenhum jogador inscrito ainda. Seja o primeiro a
                          garantir a vaga!
                        </p>
                        {isAdmin && (
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            type="button"
                            onClick={() => setIsPlayerManagerOpen(true)}
                            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/25 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>+ Adicionar jogador</span>
                          </motion.button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {participants.map((p, index) =>
                            renderParticipantRow(p, index),
                          )}
                        </div>

                        {/* Botão de Adicionar Jogador no rodapé da lista para o Admin */}
                        {isAdmin && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              type="button"
                              onClick={() => setIsPlayerManagerOpen(true)}
                              className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span>+ Adicionar Jogador</span>
                            </motion.button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BARRA FIXA INFERIOR MOBILE (STICKY THUMB ZONE ACTION BAR) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 px-3.5 py-2.5 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
          {!user ? (
            <div className="w-full flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-none">
                  Partida Aberta
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">
                  {remaining > 0
                    ? `${remaining} vagas restantes`
                    : "Vagas esgotadas"}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsLoginOpen(true)}
                className="h-9 sm:h-10 px-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 shrink-0"
              >
                <span>Entrar / Cadastrar</span>
              </motion.button>
            </div>
          ) : isEnded ? (
            <div className="w-full flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 block leading-none">
                    Encerrada
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                    Partida Finalizada
                  </span>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsChampionModalOpen(true)}
                className="h-9 sm:h-10 px-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md shrink-0 flex items-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Ver Campeão</span>
              </motion.button>
            </div>
          ) : isJoined ? (
            <div className="w-full flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {currentParticipant?.team != null ? (
                  <>
                    <TeamBadge
                      teamInfo={getTeamInfo(match, currentParticipant.team)}
                      size="sm"
                      rounded="full"
                      className="shadow-sm shrink-0 ring-1 ring-slate-200/80 dark:ring-slate-700/80"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 block leading-none truncate">
                        Você está no
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate block leading-tight mt-0.5">
                        {getTeamInfo(match, currentParticipant.team).name}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                      <Shuffle className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 block leading-none truncate">
                        Inscrição Ativa
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate block leading-tight mt-0.5">
                        Aguardando Sorteio
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {match.sorteio_raspadinha_ativo &&
                  currentParticipant?.team == null && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setIsScratchCardOpen(true)}
                      className="h-9 px-2.5 sm:px-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-1.5 animate-pulse shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>Raspadinha</span>
                    </motion.button>
                  )}

                {match.valor > 0 && !currentParticipant?.paid && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setIsPixModalOpen(true)}
                    className="h-9 px-2.5 sm:px-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0 transition-all"
                  >
                    <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Pagar PIX</span>
                  </motion.button>
                )}

                {match.valor > 0 && currentParticipant?.paid && (
                  <div className="h-9 px-2.5 sm:px-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center gap-1.5 shrink-0 select-none shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Pago</span>
                  </div>
                )}

                {match.valor === 0 && (
                  <div className="h-9 px-2.5 sm:px-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center gap-1.5 shrink-0 select-none shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Grátis</span>
                  </div>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={handleToggleJoin}
                  className="h-9 px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/30 transition-colors font-bold text-xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  aria-label="Desistir da partida"
                  title="Desistir da partida"
                >
                  <XCircle className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span className="hidden min-[360px]:inline text-xs font-bold">
                    Desistir
                  </span>
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${isFull ? "bg-rose-500" : "bg-emerald-500 animate-ping"}`}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {isFull ? "Esgotado" : `${remaining} vagas livres`}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                  {match.valor > 0
                    ? `R$ ${match.valor.toFixed(2)}`
                    : "Inscrição Grátis"}
                </span>
              </div>

              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.02 }}
                disabled={isFull}
                onClick={handleToggleJoin}
                className={`flex-1 max-w-[210px] min-h-11 py-2.5 px-3 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${
                  isFull
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 via-brand-500 to-teal-500 text-white shadow-emerald-500/25"
                }`}
              >
                {isFull ? (
                  <span>Lotada</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="truncate">Quero Participar</span>
                  </>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE RASPADINHA VIRTUAL INDIVIDUAL */}
      {match && (
        <ScratchCardModal
          isOpen={isScratchCardOpen}
          onClose={() => setIsScratchCardOpen(false)}
          match={match}
          participants={participants}
          currentParticipant={currentParticipant}
          onSelectTeam={handleAssignTeamFromScratch}
        />
      )}

      {/* MODAL DE RESUMO FINANCEIRO TRANSPARENTE */}
      {match && (
        <MatchFinanceModal
          isOpen={isFinanceModalOpen}
          onClose={() => setIsFinanceModalOpen(false)}
          match={match}
          participants={participants}
          onUpdate={fetchMatchDetails}
        />
      )}

      {/* MODAL DE NOTIFICAÇÕES WHATSAPP */}
      {match && (
        <WhatsAppNotifierModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          match={match}
          participants={participants}
        />
      )}

      {/* MODAL DE PAGAMENTO PIX */}
      {match && (
        <PixPaymentModal
          isOpen={isPixModalOpen}
          onClose={() => setIsPixModalOpen(false)}
          match={match}
          participant={currentParticipant}
          onUpdate={fetchMatchDetails}
        />
      )}

      {/* MODAL DE GERENCIAMENTO MANUAL DE JOGADORES (ADMIN) */}
      {match && (
        <MatchPlayerManagerModal
          isOpen={isPlayerManagerOpen}
          onClose={() => setIsPlayerManagerOpen(false)}
          match={match}
          participants={participants}
          onUpdate={fetchMatchDetails}
        />
      )}

      {/* Modais Globais */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={fetchMatchDetails}
      />
      <CreateMatchModal
        isOpen={isCreateMatchOpen}
        onClose={() => setIsCreateMatchOpen(false)}
        onMatchCreated={fetchMatchDetails}
      />
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
      />

      {/* MODAL DE CONFIRMAÇÃO DE SEGURANÇA (ADMIN) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
                confirmModal.type === "clear"
                  ? "bg-red-100 dark:bg-red-950/60 text-red-500"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-500"
              }`}
            >
              {confirmModal.type === "clear" ? (
                <XCircle className="w-7 h-7" />
              ) : (
                <Shuffle className="w-7 h-7" />
              )}
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line leading-relaxed">
                {confirmModal.message}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({ ...confirmModal, isOpen: false })
                }
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  if (confirmModal.type === "sort") {
                    void handleSortTeams();
                  } else {
                    void handleClearTeams();
                  }
                }}
                className={`flex-1 py-2.5 px-4 text-white font-extrabold text-xs rounded-xl shadow-md transition-all ${
                  confirmModal.type === "clear"
                    ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                    : "bg-brand-500 hover:bg-brand-600 shadow-brand-500/20"
                }`}
              >
                Sim, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL "VAGA PREENCHIDA" (time cheio ao tentar voltar) */}
      {isTeamFullModalOpen && teamFullInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => {
            setIsTeamFullModalOpen(false);
            setTeamFullInfo(null);
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
              😔
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              Vaga Preenchida
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Você havia sido sorteado para o{" "}
              <span
                className={`font-black ${TEAM_COLORS[teamFullInfo.teamNumber - 1]?.text || "text-brand-500"}`}
              >
                {TEAM_COLORS[teamFullInfo.teamNumber - 1]?.name ||
                  `Time ${teamFullInfo.teamNumber}`}
              </span>
              , mas ao sair da partida, sua vaga foi preenchida por outro
              participante.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Você pode entrar na lista de reserva e aguardar uma nova
              atribuição pelo organizador.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleJoinAsReserveDetail}
                className="w-full py-3 rounded-2xl font-black text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Entrar na Lista de Reserva
              </motion.button>
              <button
                onClick={() => {
                  setIsTeamFullModalOpen(false);
                  setTeamFullInfo(null);
                }}
                className="w-full py-2.5 rounded-2xl font-bold text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Não, Obrigado
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* MODAL DE EDIÇÃO DA PARTIDA */}
      <EditMatchModal
        isOpen={isEditMatchOpen}
        onClose={() => setIsEditMatchOpen(false)}
        match={match}
        onMatchUpdated={() => void fetchMatchDetails()}
      />

      {/* MODAL DE COMPARTILHAMENTO DA TRANSMISSÃO AO VIVO */}
      {match && (
        <ShareLiveBroadcastModal
          isOpen={isShareLiveOpen}
          onClose={() => setIsShareLiveOpen(false)}
          match={match}
        />
      )}

      {/* MODAL DE PERSONALIZAÇÃO DOS TIMES PELO ADMINISTRADOR */}
      {match && (
        <EditTeamsModal
          isOpen={isEditTeamsOpen}
          onClose={() => setIsEditTeamsOpen(false)}
          match={match}
          onTeamsUpdated={() => void fetchMatchDetails()}
        />
      )}

      {/* MODAL DE VISUALIZAÇÃO AMPLIADA (LIGHTBOX) DE EMBLEMAS E AVATARES */}
      <ImageLightboxModal data={lightboxData} onClose={closeImagePreview} />

      {/* MODAL DO TIME CAMPEÃO */}
      <ChampionModal
        isOpen={isChampionModalOpen}
        onClose={() => {
          setIsChampionModalOpen(false);
          setChampionData(null);
        }}
        championData={championData}
        loading={championLoading}
      />

      {/* MODAL DA TABELA DE CLASSIFICAÇÃO DA PARTIDA ENCERRADA */}
      {isStandingsModalOpen && match && (
        <MatchStandingsModal
          isOpen={isStandingsModalOpen}
          onClose={() => setIsStandingsModalOpen(false)}
          match={match}
          onOpenChampion={handleOpenChampionModal}
        />
      )}

      {/* MODAL DE DESTAQUES DA RODADA (MVP & ANINGA 🐍) */}
      {match && (
        <MatchHighlightsModal
          isOpen={isHighlightsModalOpen}
          onClose={() => setIsHighlightsModalOpen(false)}
          match={match}
          participants={participants}
          onSaved={() => void fetchMatchDetails()}
        />
      )}
    </div>
  );
}
