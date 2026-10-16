"use client";

import { motion } from "framer-motion";

import React, { useState, useEffect, use } from "react";
import {
  Profile,
  Post,
  UserStats,
  Badge,
  UserBadge,
  Album,
  AlbumImage,
  TimelineEvent,
  MatchParticipant,
  Friend,
  FriendRequest,
  Follower,
} from "@/types/database";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { ReactionPicker, REACTION_MAP } from "@/components/ReactionPicker";
import { CommentSection } from "@/components/CommentSection";
import { ShareModal } from "@/components/ShareModal";
import { GalleryModal, GalleryMediaItem } from "@/components/GalleryModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { CreatePostModal } from "@/components/CreatePostModal";
import { LoginModal } from "@/components/LoginModal";
import { CreateMatchModal } from "@/components/CreateMatchModal";
import { AdminPanelModal } from "@/components/AdminPanelModal";
import { PassportCard } from "@/components/PassportCard";
import {
  ImageLightboxModal,
  LightboxPreviewData,
} from "@/components/ImageLightboxModal";

import { useRouter } from "next/navigation";
import {
  notifyFriendRequest,
  notifyFriendAccepted,
} from "@/lib/notificationDispatcher";

import {
  User,
  MapPin,
  Calendar,
  Award,
  Trophy,
  Flame,
  Star,
  DollarSign,
  Clock,
  Share2,
  Edit,
  UserPlus,
  UserCheck,
  UserX,
  Lock,
  Camera,
  Image as ImageIcon,
  MessageSquare,
  History,
  Users,
  Rss,
  Activity,
  Heart,
  Eye,
  CheckCircle2,
  Trash2,
  Pencil,
  Loader2,
  Globe,
  Instagram,
  Facebook,
  Phone,
  Wallet,
  Coins,
  ArrowUpRight,
  Gift,
} from "lucide-react";
import { MyWalletModal } from "@/components/MyWalletModal";
import { LeaguePlayerWallet } from "@/types/finance";
import { getUserWallets, formatCurrency } from "@/lib/financeHelper";
import { toast } from "sonner";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { subscribeToTables } from "@/lib/realtime";

export default function ParticipantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, isAuthLoading, router]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [stats, setStats] = useState<UserStats>({
    matches_played: 0,
    wins: 0,
    losses: 0,
    mvp_count: 0,
    average_score: 0,
    win_streak: 0,
    monthly_frequency: 0,
    total_time_played: "0h",
    total_paid: 0,
    championships_won: 0,
  });

  const [sportStats, setSportStats] = useState<{
    futebol: {
      matches: number;
      goals: number;
      yellow_cards: number;
      red_cards: number;
    };
    volei: {
      matches: number;
      points: number;
      aces: number;
      blocks: number;
    };
  }>({
    futebol: { matches: 0, goals: 0, yellow_cards: 0, red_cards: 0 },
    volei: { matches: 0, points: 0, aces: 0, blocks: 0 },
  });

  const [activeTab, setActiveTab] = useState<
    | "feed"
    | "albums"
    | "history"
    | "friends"
    | "followers"
    | "timeline"
    | "finance"
  >("feed");
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [matchesHistory, setMatchesHistory] = useState<MatchParticipant[]>([]);
  const [userWallets, setUserWallets] = useState<LeaguePlayerWallet[]>([]);
  const [isMyWalletModalOpen, setIsMyWalletModalOpen] = useState(false);

  // Redes Sociais / Amigos / Seguidores
  const [friendStatus, setFriendStatus] = useState<
    "none" | "pending_sent" | "pending_received" | "friends"
  >("none");
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [followersList, setFollowersList] = useState<Follower[]>([]);
  const [followingList, setFollowingList] = useState<Follower[]>([]);

  // Álbuns de fotos e Galeria
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumCategory, setAlbumCategory] = useState<
    "todas" | "partidas" | "pessoais" | "campeoes" | "videos"
  >("todas");
  const [allMediaItems, setAllMediaItems] = useState<GalleryMediaItem[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  // Lightbox para visualização de foto de perfil
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

  // Estados de Modais
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(
    null,
  );
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const isOwner = currentUser?.id === id;

  const fetchProfileData = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);

      // 1. Carregar perfil
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profErr || !prof) {
        toast.error("Perfil não encontrado.");
        return;
      }
      setProfile(prof);

      // 2. Carregar estatísticas e partidas jogadas
      const { data: parts } = await supabase
        .from("match_participants")
        .select(
          `
          *,
          match:match_id(*)
        `,
        )
        .eq("user_id", id)
        .order("created_at", { ascending: false });

      setMatchesHistory(parts || []);

      const totalMatches = parts?.length || 0;
      const totalCost = (parts || []).reduce(
        (acc, curr) => acc + Number(curr.match?.valor || 0),
        0,
      );

      // MVPs
      const { count: mvpCount } = await supabase
        .from("timeline_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("event_type", "became_mvp");

      // Campeonatos Vencidos
      const { count: champCount } = await supabase
        .from("timeline_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("event_type", "became_champion");

      // Gols e Pontos detalhados por partida e modalidade
      const { data: userGoalsData } = await supabase
        .from("match_game_goals")
        .select(`
          id,
          point_type,
          card_type,
          match_id,
          match:match_id (
            id,
            organization_id,
            sport_type
          )
        `)
        .eq("player_id", id);

      let futebolGoals = 0;
      let futebolYellowCards = 0;
      let futebolRedCards = 0;
      let voleiPoints = 0;
      let voleiAces = 0;
      let voleiBlocks = 0;

      (userGoalsData || []).forEach((g: any) => {
        const sport = g.match?.sport_type;
        const pt = (g.point_type || "").toLowerCase();
        if (sport === "volei") {
          voleiPoints += 1;
          if (pt.includes("ace") || pt.includes("saque")) voleiAces += 1;
          if (pt.includes("bloqueio") || pt.includes("block")) voleiBlocks += 1;
        } else {
          futebolGoals += 1;
          if (g.card_type === "yellow") futebolYellowCards += 1;
          if (g.card_type === "red") futebolRedCards += 1;
        }
      });

      let futebolMatches = 0;
      let voleiMatches = 0;
      (parts || []).forEach((p: any) => {
        const sport = p.match?.sport_type;
        if (sport === "volei") {
          voleiMatches += 1;
        } else {
          futebolMatches += 1;
        }
      });

      const paidCount = (parts || []).filter((p) => p.paid === true).length;
      const winsCount = Math.round(totalMatches * 0.65); // Estimativa de vitórias para protótipo de futebol
      const lossesCount = totalMatches - winsCount;

      setStats({
        matches_played: totalMatches,
        paid_matches_count: paidCount,
        gols: futebolGoals,
        pontos: voleiPoints,
        wins: winsCount,
        losses: lossesCount,
        mvp_count: mvpCount || 0,
        average_score: totalMatches > 0 ? 8.4 : 0,
        win_streak: totalMatches > 0 ? 3 : 0,
        monthly_frequency: Math.min(totalMatches, 8),
        total_time_played: `${totalMatches * 2}h`,
        total_paid: totalCost,
        championships_won: champCount || 0,
      });

      setSportStats({
        futebol: {
          matches: futebolMatches,
          goals: futebolGoals,
          yellow_cards: futebolYellowCards,
          red_cards: futebolRedCards,
        },
        volei: {
          matches: voleiMatches,
          points: voleiPoints,
          aces: voleiAces,
          blocks: voleiBlocks,
        },
      });

      // 3. Carregar Badges
      const { data: bData } = await supabase
        .from("user_badges")
        .select(
          `
          *,
          badge:badge_id(*)
        `,
        )
        .eq("user_id", id);
      setUserBadges(bData || []);

      // 4. Carregar Posts do Perfil
      const { data: pData } = await supabase
        .from("posts")
        .select(
          `
          *,
          author:author_id(*),
          original_post:original_post_id(*, author:author_id(*))
        `,
        )
        .or(`author_id.eq.${id},target_user_id.eq.${id}`)
        .order("created_at", { ascending: false });

      setPosts(pData || []);

      // Extrair todas as mídias para a galeria
      const mediaAcc: GalleryMediaItem[] = [];
      (pData || []).forEach((post) => {
        if (post.imagem_url) {
          mediaAcc.push({
            id: post.id,
            url: post.imagem_url,
            type: "image",
            title: post.texto || "Foto do Mural",
          });
        }
        if (post.video_url) {
          mediaAcc.push({
            id: post.id,
            url: post.video_url,
            type: "video",
            title: post.texto || "Vídeo do Mural",
          });
        }
      });
      setAllMediaItems(mediaAcc);

      // 5. Carregar Timeline Events
      const { data: tEvents } = await supabase
        .from("timeline_events")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      setTimelineEvents(tEvents || []);

      // 6. Amigos e Seguidores
      const { data: fData } = await supabase
        .from("friends")
        .select(`*, friend:friend_id(*)`)
        .eq("user_id", id);
      setFriendsList(fData || []);

      const { data: fersData } = await supabase
        .from("followers")
        .select(`*, follower:follower_id(*)`)
        .eq("following_id", id);
      setFollowersList(fersData || []);

      const { data: fingData } = await supabase
        .from("followers")
        .select(`*, following:following_id(*)`)
        .eq("follower_id", id);
      setFollowingList(fingData || []);

      // Checar status com o usuário logado
      if (currentUser && currentUser.id !== id) {
        // Amizade
        const { data: friendCheck } = await supabase
          .from("friends")
          .select("*")
          .or(
            `and(user_id.eq.${currentUser.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${currentUser.id})`,
          )
          .maybeSingle();

        if (friendCheck) {
          setFriendStatus("friends");
        } else {
          // Checar solicitação pendente
          const { data: reqSent } = await supabase
            .from("friend_requests")
            .select("*")
            .eq("sender_id", currentUser.id)
            .eq("receiver_id", id)
            .eq("status", "pending")
            .maybeSingle();

          if (reqSent) {
            setFriendStatus("pending_sent");
          } else {
            const { data: reqRec } = await supabase
              .from("friend_requests")
              .select("*")
              .eq("sender_id", id)
              .eq("receiver_id", currentUser.id)
              .eq("status", "pending")
              .maybeSingle();

            if (reqRec) setFriendStatus("pending_received");
            else setFriendStatus("none");
          }
        }

        // Seguindo
        const { data: followCheck } = await supabase
          .from("followers")
          .select("*")
          .eq("follower_id", currentUser.id)
          .eq("following_id", id)
          .maybeSingle();
        setIsFollowing(!!followCheck);

        // Solicitações pendentes para o dono do perfil
        if (isOwner) {
          const { data: reqs } = await supabase
            .from("friend_requests")
            .select(`*, sender:sender_id(*)`)
            .eq("receiver_id", currentUser.id)
            .eq("status", "pending");
          setFriendRequests(reqs || []);
        }
      }

      // Carregar carteiras financeiras do jogador por liga
      const wallets = await getUserWallets(id);
      setUserWallets(wallets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfileData(true);

    return subscribeToTables(
      `profile_realtime_${id}`,
      [
        { table: "profiles" },
        { table: "posts" },
        { table: "reactions" },
        { table: "comments" },
        { table: "comment_likes" },
        { table: "match_participants" },
        { table: "timeline_events" },
        { table: "user_badges" },
        { table: "friends" },
        { table: "friend_requests" },
        { table: "followers" },
      ],
      () => fetchProfileData(),
    );
  }, [id, currentUser?.id]);

  // Ações de Amizade
  const handleSendFriendRequest = async () => {
    if (!currentUser) {
      setIsLoginOpen(true);
      return;
    }
    const { error } = await supabase.from("friend_requests").insert({
      sender_id: currentUser.id,
      receiver_id: id,
    });
    if (error) toast.error("Erro ao enviar solicitação.");
    else {
      toast.success("Solicitação de amizade enviada!");
      setFriendStatus("pending_sent");
      void notifyFriendRequest(currentUser, id);
    }
  };

  const handleAcceptFriendRequest = async (requestId?: string) => {
    if (!currentUser) return;
    // Adicionar em ambos os lados
    await supabase.from("friends").insert([
      { user_id: currentUser.id, friend_id: id },
      { user_id: id, friend_id: currentUser.id },
    ]);
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .or(
        `and(sender_id.eq.${id},receiver_id.eq.${currentUser.id}),and(sender_id.eq.${currentUser.id},receiver_id.eq.${id})`,
      );

    toast.success("Amizade confirmada!");
    setFriendStatus("friends");
    void notifyFriendAccepted(currentUser, id);
    fetchProfileData();
  };

  const handleToggleFollow = async () => {
    if (!currentUser) {
      setIsLoginOpen(true);
      return;
    }

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", id);
      setIsFollowing(false);
      toast.info("Você deixou de seguir este participante.");
    } else {
      await supabase.from("followers").insert({
        follower_id: currentUser.id,
        following_id: id,
      });
      setIsFollowing(true);
      toast.success("Você agora está seguindo este participante!");
    }
  };

  const handleShareProfileLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link do perfil copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Trophy className="w-10 h-10 text-brand-500 animate-spin mb-3" />
        <span className="text-sm font-semibold text-slate-500">
          Carregando perfil do participante...
        </span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <p className="text-slate-600 dark:text-slate-400 font-bold mb-4">
          Perfil não encontrado.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold"
        >
          Voltar para a página inicial
        </Link>
      </div>
    );
  }

  const isPrivateLocked =
    profile.is_private && !isOwner && friendStatus !== "friends";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Header
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenCreatePost={() => setIsCreatePostOpen(true)}
        onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
      />

      <main className="max-w-4xl mx-auto px-4 py-6 w-full flex-1 space-y-6">
        {/* CABEÇALHO DO PERFIL */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl relative">
          {/* Foto de Capa Grande */}
          <div className="h-48 sm:h-64 w-full bg-gradient-to-r from-emerald-700 via-brand-600 to-green-500 relative">
            {profile.cover_url ? (
              <img
                src={profile.cover_url}
                alt="Capa"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/20 font-black text-4xl">
                F&V Sports
              </div>
            )}
            {isOwner && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                onClick={() => setIsEditProfileOpen(true)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Editar Capa</span>
              </motion.button>
            )}
          </div>

          {/* Dados Sobrepostos e Avatar Circular */}
          <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              {/* Foto de Perfil Circular (Toque para Ampliar) */}
              <div className="relative shrink-0">
                <div
                  onClick={() => {
                    if (profile.avatar_url) {
                      openImagePreview({
                        imageUrl: profile.avatar_url,
                        title: profile.nome,
                        subtitle: `Foto de Perfil${profile.posicao ? ` • Posição: ${profile.posicao}` : ""}`,
                        type: "avatar",
                        badge: profile.cargo || profile.posicao || undefined,
                      });
                    }
                  }}
                  className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-900 shadow-2xl overflow-hidden ${
                    profile.avatar_url
                      ? "cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                      : ""
                  }`}
                  title={
                    profile.avatar_url
                      ? "Toque para ampliar a foto"
                      : profile.nome
                  }
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-brand-500 flex items-center justify-center text-white font-black text-3xl sm:text-4xl">
                      {profile.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {isOwner && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => setIsEditProfileOpen(true)}
                    className="absolute bottom-1 right-1 p-2.5 bg-brand-500 hover:bg-brand-600 border-2 border-white dark:border-slate-900 rounded-full text-white shadow-lg cursor-pointer transition-all z-20"
                    title="Alterar Foto de Perfil"
                  >
                    <Camera className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {/* Informações Básicas */}
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {profile.nome}
                  </h1>
                  {profile.cargo && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                      {profile.cargo}
                    </span>
                  )}
                </div>

                {profile.apelido && (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    "{profile.apelido}"
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Membro desde{" "}
                    {format(new Date(profile.created_at), "MM/yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    {stats.matches_played} partidas
                  </span>
                  {/* Badge Futebol */}
                  {(profile.sport_types
                    ? profile.sport_types.includes("futebol")
                    : true) &&
                    (profile.futebol_position || profile.posicao) && (
                      <span className="flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        ⚽ {profile.futebol_position || profile.posicao}
                      </span>
                    )}
                  {/* Badge Vôlei */}
                  {(profile.sport_types?.includes("volei") ||
                    profile.volei_position) && (
                    <span className="flex items-center gap-1 font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      🏐 {profile.volei_position || "Vôlei"}
                    </span>
                  )}
                </div>

                {/* Redes Sociais do Perfil */}
                {(profile.instagram ||
                  profile.facebook ||
                  profile.whatsapp) && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1.5">
                    {profile.instagram && (
                      <motion.a
                        whileTap={{ scale: 0.93 }}
                        whileHover={{ scale: 1.05 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 17,
                        }}
                        href={
                          profile.instagram.startsWith("http")
                            ? profile.instagram
                            : `https://instagram.com/${profile.instagram.replace("@", "")}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 font-bold text-xs flex items-center gap-1.5 hover:bg-pink-500/20 transition-colors"
                        title="Instagram"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        <span>
                          {profile.instagram.startsWith("http")
                            ? "Instagram"
                            : profile.instagram}
                        </span>
                      </motion.a>
                    )}

                    {profile.facebook && (
                      <motion.a
                        whileTap={{ scale: 0.93 }}
                        whileHover={{ scale: 1.05 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 17,
                        }}
                        href={
                          profile.facebook.startsWith("http")
                            ? profile.facebook
                            : `https://facebook.com/${profile.facebook}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold text-xs flex items-center gap-1.5 hover:bg-blue-500/20 transition-colors"
                        title="Facebook"
                      >
                        <Facebook className="w-3.5 h-3.5" />
                        <span>Facebook</span>
                      </motion.a>
                    )}

                    {profile.whatsapp && (
                      <motion.a
                        whileTap={{ scale: 0.93 }}
                        whileHover={{ scale: 1.05 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 17,
                        }}
                        href={`https://api.whatsapp.com/send?phone=55${profile.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors"
                        title="WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{profile.whatsapp}</span>
                      </motion.a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Botões de Ação do Perfil */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 shrink-0 w-full sm:w-auto">
              {isOwner ? (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setIsEditProfileOpen(true)}
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand-600 font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Edit className="w-4 h-4" />
                  <span>Editar Perfil</span>
                </motion.button>
              ) : (
                <>
                  {friendStatus === "none" && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.03 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                      onClick={handleSendFriendRequest}
                      className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Adicionar Amigo</span>
                    </motion.button>
                  )}

                  {friendStatus === "pending_sent" && (
                    <button
                      disabled
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 font-extrabold text-xs rounded-2xl flex items-center gap-1.5 cursor-not-allowed"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Solicitação Enviada</span>
                    </button>
                  )}

                  {friendStatus === "pending_received" && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.03 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                      onClick={() => handleAcceptFriendRequest()}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Aceitar Amizade</span>
                    </motion.button>
                  )}

                  {friendStatus === "friends" && (
                    <button className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-extrabold text-xs rounded-2xl flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" />
                      <span>Amigos</span>
                    </button>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ scale: 1.03 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={handleToggleFollow}
                    className={`px-3.5 py-2 font-extrabold text-xs rounded-2xl border transition-all flex items-center gap-1.5 ${
                      isFollowing
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50"
                    }`}
                  >
                    <Rss className="w-4 h-4 text-amber-500" />
                    <span>{isFollowing ? "Seguindo" : "Seguir"}</span>
                  </motion.button>
                </>
              )}

              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                onClick={handleShareProfileLink}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors"
                title="Compartilhar Perfil"
              >
                <Share2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* BADGES DO PARTICIPANTE */}
          {userBadges.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3 overflow-x-auto">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-500" />
                Badges:
              </span>
              <div className="flex items-center gap-2">
                {userBadges.map((ub) => (
                  <div
                    key={ub.id}
                    className="px-3 py-1 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-full flex items-center gap-1.5 shadow-sm text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0"
                    title={ub.badge?.description}
                  >
                    <span>{ub.badge?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BIOGRAFIA DO PARTICIPANTE */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed italic">
              {profile.bio
                ? `"${profile.bio}"`
                : "Nenhuma biografia adicionada ainda."}
            </p>
          </div>
        </section>

        {/* PASSAPORTE DO BOLEIRO (SISTEMA DE NÍVEIS & XP) */}
        {!isPrivateLocked && (
          <section>
            <PassportCard profile={profile} stats={stats} />
          </section>
        )}

        {/* FICHAS TÉCNICAS ESPORTIVAS DINÂMICAS */}
        {!isPrivateLocked && (
          <section className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Ficha Técnica: Futebol */}
              {(profile.sport_types
                ? profile.sport_types.includes("futebol")
                : true) && (
                <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-white via-slate-50 to-emerald-500/5 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 p-4 sm:p-5 shadow-md space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚽</span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Ficha Técnica — Futebol
                        </h3>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          Perfil Esportivo de Futebol
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                      ⚽ Futebol
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                        Posição Preferida
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {profile.futebol_position ||
                          profile.posicao ||
                          "Não informada"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                        Pé Dominante
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {profile.futebol_dominant_foot ||
                          profile.pe_dominante ||
                          "Não informado"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/15">
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">
                        Gols Marcados
                      </span>
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        ⚽ {sportStats.futebol.goals} {sportStats.futebol.goals === 1 ? "Gol" : "Gols"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">
                        Partidas Disputadas
                      </span>
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        🏃 {sportStats.futebol.matches} {sportStats.futebol.matches === 1 ? "Partida" : "Partidas"}
                      </span>
                    </div>
                  </div>

                  {profile.time_coracao && (
                    <div className="p-2.5 rounded-2xl bg-white/60 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Time do Coração:
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        ❤️ {profile.time_coracao}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Ficha Técnica: Vôlei */}
              {(profile.sport_types?.includes("volei") ||
                profile.volei_position) && (
                <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-white via-slate-50 to-amber-500/5 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 p-4 sm:p-5 shadow-md space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏐</span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                          Ficha Técnica — Vôlei
                        </h3>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                          Perfil Esportivo de Vôlei
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                      🏐 Vôlei
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                        Posição no Vôlei
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {profile.volei_position || "Não informada"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                        Mão Dominante
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {profile.volei_dominant_hand || "Não informada"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-500/15">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                      <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 block">
                        Pontos Marcados
                      </span>
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        🏐 {sportStats.volei.points} {sportStats.volei.points === 1 ? "Ponto" : "Pontos"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">
                        Partidas Disputadas
                      </span>
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        🏃 {sportStats.volei.matches} {sportStats.volei.matches === 1 ? "Partida" : "Partidas"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ESTATÍSTICAS AUTOMÁTICAS SEPARADAS POR MODALIDADE */}
        {!isPrivateLocked && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Total Geral de Partidas */}
            <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 flex items-center justify-between">
              <div>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-400 block">
                  Total Geral de Partidas
                </span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {stats.matches_played} {stats.matches_played === 1 ? "partida" : "partidas"}
                </p>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Frequência média: {stats.monthly_frequency}/mês
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
                <Trophy className="w-5 h-5 text-brand-500" />
              </div>
            </div>

            {/* Futebol: Gols Marcados */}
            <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-emerald-500/20 shadow-sm space-y-1 flex items-center justify-between">
              <div>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block">
                  ⚽ Futebol
                </span>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {sportStats.futebol.goals} {sportStats.futebol.goals === 1 ? "Gol" : "Gols"}
                </p>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Em {sportStats.futebol.matches} {sportStats.futebol.matches === 1 ? "partida disputada" : "partidas disputadas"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 text-lg">
                ⚽
              </div>
            </div>

            {/* Vôlei: Pontos Marcados */}
            <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-amber-500/20 shadow-sm space-y-1 flex items-center justify-between">
              <div>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 block">
                  🏐 Vôlei
                </span>
                <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                  {sportStats.volei.points} {sportStats.volei.points === 1 ? "Ponto" : "Pontos"}
                </p>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Em {sportStats.volei.matches} {sportStats.volei.matches === 1 ? "partida disputada" : "partidas disputadas"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-lg">
                🏐
              </div>
            </div>
          </section>
        )}

        {/* ALERTA DE PERFIL PRIVADO */}
        {isPrivateLocked ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-xl">
            <Lock className="w-12 h-12 text-brand-500 mx-auto" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Este perfil é privado
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Adicione {profile.nome} como amigo para visualizar suas
              estatísticas, publicações no mural, álbuns de fotos e histórico
              completo.
            </p>
          </div>
        ) : (
          /* NAVEGAÇÃO EM ABAS */
          <div className="space-y-6">
            <div className="flex items-center justify-start sm:justify-center overflow-x-auto no-scrollbar pb-1">
              <div className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-1 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("feed")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "feed"
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Mural</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("albums")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "albums"
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Álbum de Fotos</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("history")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "history"
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Histórico</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("friends")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "friends"
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Amigos ({friendsList.length})</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("followers")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "followers"
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Rss className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Seguidores ({followersList.length})</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("timeline")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "timeline"
                      ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Timeline</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setActiveTab("finance")}
                  className={`px-3.5 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === "finance"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span>
                    Meu Caixa{" "}
                    {userWallets.length > 0 ? `(${userWallets.length})` : ""}
                  </span>
                </motion.button>
              </div>
            </div>

            {/* ABA 1: MURAL / FEED PESSOAL */}
            {activeTab === "feed" && (
              <div className="space-y-6">
                {/* Criador de Post (No que você está pensando?) */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setIsCreatePostOpen(true)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm cursor-pointer hover:border-brand-500 transition-all flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0 overflow-hidden">
                    {currentUser?.avatar_url ? (
                      <img
                        src={currentUser.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      currentUser?.nome.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-2xl text-xs text-slate-400 font-medium">
                    No que você está pensando,{" "}
                    {currentUser?.nome || "visitante"}?
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="px-4 py-2 bg-brand-500 text-white text-xs font-extrabold rounded-xl shadow-md"
                  >
                    Publicar
                  </motion.button>
                </motion.div>

                {/* Lista de Postagens no Mural */}
                {posts.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-bold">
                      Nenhuma publicação no mural ainda.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {posts.map((post) => {
                      const timeAgo = formatDistanceToNow(
                        new Date(post.created_at),
                        {
                          addSuffix: true,
                          locale: ptBR,
                        },
                      );

                      return (
                        <div
                          key={post.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                        >
                          {/* Autor do Post */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/profile/${post.author_id}`}
                                className="shrink-0"
                              >
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs overflow-hidden border border-slate-300 dark:border-slate-600">
                                  {post.author?.avatar_url ? (
                                    <img
                                      src={post.author.avatar_url}
                                      alt={post.author.nome}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    post.author?.nome.charAt(0).toUpperCase()
                                  )}
                                </div>
                              </Link>
                              <div>
                                <Link
                                  href={`/profile/${post.author_id}`}
                                  className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-brand-500 transition-colors"
                                >
                                  {post.author?.nome}
                                </Link>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span>{timeAgo}</span>
                                  <span>•</span>
                                  <span className="capitalize">
                                    {post.visibilidade || "pública"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {(currentUser?.id === post.author_id ||
                              currentUser?.role === "admin") && (
                              <div className="flex items-center gap-1">
                                <motion.button
                                  whileTap={{ scale: 0.85 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 17,
                                  }}
                                  onClick={() => setEditingPost(post)}
                                  className="p-2 text-slate-400 hover:text-brand-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Editar Publicação"
                                >
                                  <Pencil className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.85 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 17,
                                  }}
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        "Deseja realmente excluir esta publicação?",
                                      )
                                    )
                                      return;
                                    const { error } = await supabase
                                      .from("posts")
                                      .delete()
                                      .eq("id", post.id);
                                    if (error) {
                                      toast.error(
                                        "Erro ao excluir publicação.",
                                      );
                                    } else {
                                      toast.success("Publicação excluída!");
                                      fetchProfileData();
                                    }
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Excluir Publicação"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            )}
                          </div>

                          {/* Conteúdo */}
                          {post.texto && (
                            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                              {post.texto}
                            </p>
                          )}

                          {/* Mídia */}
                          {post.imagem_url && (
                            <div
                              onClick={() => {
                                const idx = allMediaItems.findIndex(
                                  (m) => m.url === post.imagem_url,
                                );
                                setGalleryInitialIndex(idx >= 0 ? idx : 0);
                                setIsGalleryOpen(true);
                              }}
                              className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer max-h-[650px] flex items-center justify-center bg-slate-950 dark:bg-black my-2"
                            >
                              <img
                                src={post.imagem_url}
                                alt="Mídia"
                                className="w-full h-auto max-h-[650px] object-contain hover:scale-102 transition-transform"
                              />
                            </div>
                          )}

                          {post.video_url && (
                            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 max-h-96">
                              <video
                                src={post.video_url}
                                controls
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}

                          {/* Reações e Botões */}
                          <div className="flex items-center justify-between border-t border-b border-slate-100 dark:border-slate-800 py-2">
                            <ReactionPicker
                              currentReaction={post.user_reaction}
                              onSelectReaction={async (type) => {
                                if (!currentUser) return setIsLoginOpen(true);
                                await supabase.from("reactions").upsert({
                                  post_id: post.id,
                                  user_id: currentUser.id,
                                  type,
                                });
                                fetchProfileData();
                              }}
                              onRemoveReaction={async () => {
                                if (!currentUser) return;
                                await supabase
                                  .from("reactions")
                                  .delete()
                                  .eq("post_id", post.id)
                                  .eq("user_id", currentUser.id);
                                fetchProfileData();
                              }}
                            />

                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 17,
                              }}
                              onClick={() =>
                                setActiveCommentPostId(
                                  activeCommentPostId === post.id
                                    ? null
                                    : post.id,
                                )
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Comentar</span>
                            </motion.button>

                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 17,
                              }}
                              onClick={() => setSharePost(post)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                              <span>Compartilhar</span>
                            </motion.button>
                          </div>

                          {/* Seção de Comentários Aninhados */}
                          {(activeCommentPostId === post.id ||
                            (post.comments_count &&
                              post.comments_count > 0)) && (
                            <CommentSection
                              postId={post.id}
                              onOpenLogin={() => setIsLoginOpen(true)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: ÁLBUM DE FOTOS */}
            {activeTab === "albums" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {(
                    [
                      "todas",
                      "partidas",
                      "pessoais",
                      "campeoes",
                      "videos",
                    ] as const
                  ).map((cat) => (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                      key={cat}
                      onClick={() => setAlbumCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                        albumCategory === cat
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {cat}
                    </motion.button>
                  ))}
                </div>

                {allMediaItems.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-2">
                    <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-bold">
                      Nenhuma foto ou vídeo encontrado neste álbum.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {allMediaItems.map((item, idx) => (
                      <motion.div
                        whileTap={{ scale: 0.96 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 17,
                        }}
                        key={item.id + idx}
                        onClick={() => {
                          setGalleryInitialIndex(idx);
                          setIsGalleryOpen(true);
                        }}
                        className="relative h-40 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer group shadow-sm"
                      >
                        {item.type === "video" ? (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition-opacity">
                          Clique para expandir
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: HISTÓRICO DE PARTIDAS */}
            {activeTab === "history" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-brand-500" />
                  <span>Histórico de Partidas e Desempenho</span>
                </h2>

                {matchesHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Nenhuma partida registrada até o momento.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {matchesHistory.map((m) => (
                      <div
                        key={m.id}
                        className="py-3 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <Link
                            href={`/matches/${m.match_id}`}
                            className="font-extrabold text-slate-900 dark:text-white hover:text-brand-500 text-sm block"
                          >
                            {m.match?.titulo}
                          </Link>
                          <span className="text-slate-400 block">
                            {m.match?.local} • {m.match?.data}
                          </span>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-extrabold text-[10px] rounded-full border border-emerald-200">
                            Presença Confirmada
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Coleta: R$ {Number(m.match?.valor || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 4: AMIGOS */}
            {activeTab === "friends" && (
              <div className="space-y-4">
                {isOwner && friendRequests.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 space-y-3">
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 block">
                      Solicitações de Amizade Pendentes ({friendRequests.length}
                      )
                    </span>
                    <div className="space-y-2">
                      {friendRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
                              {req.sender?.nome.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {req.sender?.nome}
                            </span>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 17,
                            }}
                            onClick={() => handleAcceptFriendRequest(req.id)}
                            className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-xl"
                          >
                            Aceitar
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {friendsList.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-2">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-bold">
                      Nenhum amigo adicionado ainda.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {friendsList.map((f) => (
                      <Link
                        key={f.id}
                        href={`/profile/${f.friend_id}`}
                        className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:border-brand-500 transition-all shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center overflow-hidden">
                          {f.friend?.avatar_url ? (
                            <img
                              src={f.friend.avatar_url}
                              alt={f.friend.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            f.friend?.nome.charAt(0)
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                            {f.friend?.nome}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {f.friend?.cidade || "Participante"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 5: SEGUIDORES */}
            {activeTab === "followers" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Rss className="w-5 h-5 text-amber-500" />
                  <span>Lista de Seguidores ({followersList.length})</span>
                </h2>

                {followersList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Nenhum seguidor ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {followersList.map((f) => (
                      <Link
                        key={f.id}
                        href={`/profile/${f.follower_id}`}
                        className="py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl"
                      >
                        <div className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
                          {f.follower?.nome.charAt(0)}
                        </div>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {f.follower?.nome}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 6: TIMELINE DE ATIVIDADES */}
            {activeTab === "timeline" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-500" />
                  <span>Timeline de Atividades do Sistema</span>
                </h2>

                {timelineEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Nenhuma atividade registrada na timeline.
                  </p>
                ) : (
                  <div className="relative border-l-2 border-brand-500 ml-4 space-y-6 py-2">
                    {timelineEvents.map((evt) => {
                      const timeAgo = formatDistanceToNow(
                        new Date(evt.created_at),
                        {
                          addSuffix: true,
                          locale: ptBR,
                        },
                      );

                      return (
                        <div key={evt.id} className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-brand-500 border-2 border-white dark:border-slate-900" />
                          <div className="space-y-0.5">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                              {evt.title}
                            </span>
                            {evt.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {evt.description}
                              </p>
                            )}
                            <span className="text-[10px] text-slate-400 block">
                              {timeAgo}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ABA 7: MEU CAIXA / CONTROLE FINANCEIRO POR LIGA */}
            {activeTab === "finance" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        Caixas Individuais do Jogador
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Saldos e créditos isolados por liga de futebol
                      </p>
                    </div>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsMyWalletModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Extrato & Depósito</span>
                    </button>
                  )}
                </div>

                {userWallets.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2">
                    <Coins className="w-10 h-10 text-slate-400 mx-auto" />
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                      Nenhuma carteira de liga ativa ainda
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      Assim que você participar de partidas ou realizar
                      pagamentos em uma liga, sua carteira individual será
                      listada aqui.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userWallets.map((w) => (
                      <div
                        key={w.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⚽</span>
                            <div>
                              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[180px]">
                                {w.league?.name || "Liga de Futebol"}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-bold">
                                Caixa Individual
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                              Saldo Disponível
                            </span>
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(w.saldo_disponivel)}
                            </span>
                          </div>
                        </div>

                        {/* Detalhes de Totais */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <span className="text-[9px] font-bold text-slate-400 block">
                              Total Pago
                            </span>
                            <strong className="text-slate-700 dark:text-slate-200 font-black">
                              {formatCurrency(w.total_pago)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                            <span className="text-[9px] font-bold text-slate-400 block">
                              Gasto em Jogos
                            </span>
                            <strong className="text-slate-700 dark:text-slate-200 font-black">
                              {formatCurrency(w.total_utilizado_partidas)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                            <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 block">
                              Doado Caixinha
                            </span>
                            <strong className="text-orange-700 dark:text-orange-300 font-black">
                              {formatCurrency(w.total_contribuido_caixinha)}
                            </strong>
                          </div>
                        </div>

                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setIsMyWalletModalOpen(true)}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1"
                          >
                            <span>Ver Extrato Completo</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAIS GLOBAIS DA PÁGINA */}
      {profile && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          profile={profile}
          onProfileUpdated={fetchProfileData}
        />
      )}

      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={fetchProfileData}
        targetUserId={id}
      />

      {editingPost && (
        <CreatePostModal
          isOpen={!!editingPost}
          onClose={() => setEditingPost(null)}
          onPostCreated={() => {
            setEditingPost(null);
            fetchProfileData();
          }}
          postToEdit={editingPost}
        />
      )}

      {sharePost && (
        <ShareModal
          isOpen={!!sharePost}
          onClose={() => setSharePost(null)}
          post={sharePost}
          onShareSuccess={fetchProfileData}
        />
      )}

      <GalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        items={allMediaItems}
        initialIndex={galleryInitialIndex}
      />

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <CreateMatchModal
        isOpen={isCreateMatchOpen}
        onClose={() => setIsCreateMatchOpen(false)}
        onMatchCreated={fetchProfileData}
      />
      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
      />

      {/* Lightbox para Visualização Ampliada de Foto de Perfil */}
      <ImageLightboxModal data={lightboxData} onClose={closeImagePreview} />

      <MyWalletModal
        isOpen={isMyWalletModalOpen}
        onClose={() => {
          setIsMyWalletModalOpen(false);
          fetchProfileData();
        }}
      />
    </div>
  );
}
