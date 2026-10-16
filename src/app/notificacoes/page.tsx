"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  UserPlus,
  UserMinus,
  MessageSquare,
  Award,
  Info,
  CheckCheck,
  Smartphone,
  ExternalLink,
  Trash2,
  Search,
  Filter,
  ArrowLeft,
  Flame,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppNotification, NotificationCategory } from "@/types/database";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/lib/notifications";
import { subscribeToTables } from "@/lib/realtime";
import {
  isPushSupported,
  getNotificationPermissionState,
  subscribeUserToPush,
} from "@/lib/pushSubscriptionHelper";
import { Header } from "@/components/Header";
import { NotificationPreferencesModal } from "@/components/NotificationPreferencesModal";
import { Settings } from "lucide-react";
import { toast } from "sonner";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [categoryFilter, setCategoryFilter] = useState<
    NotificationCategory | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pushStatus, setPushStatus] =
    useState<NotificationPermission>("default");
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await getNotifications(user.id, 100);
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user?.id) {
      void fetchNotifications();
      setPushStatus(getNotificationPermissionState());
    } else if (!isLoading) {
      setLoading(false);
    }
  }, [user?.id, isLoading]);

  // Inscrição Realtime com filtro estrito por user_id
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToTables(
      `user-notifications-page-${user.id}`,
      [{ table: "notifications", filter: `user_id=eq.${user.id}` }],
      () => {
        void fetchNotifications();
      },
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const handleMarkAsRead = async (id: string, link?: string | null) => {
    const success = await markNotificationAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n,
        ),
      );
    }
    if (link) {
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    const success = await markAllNotificationsAsRead(user.id);
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Todas as notificações foram marcadas como lidas!");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const success = await deleteNotification(id);
    if (success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notificação removida");
    }
  };

  const handleEnablePush = async () => {
    if (!user?.id) return;
    setIsEnablingPush(true);
    const result = await subscribeUserToPush(user.id);
    setIsEnablingPush(false);

    if (result.success) {
      setPushStatus("granted");
      toast.success("🔔 Notificações no celular ativadas com sucesso!");
    } else {
      toast.error(
        result.error || "Não foi possível ativar notificações no navegador.",
      );
      setPushStatus(getNotificationPermissionState());
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "unread" && n.read) return false;
      if (categoryFilter !== "all") {
        const cat = n.category || "system";
        if (cat !== categoryFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchMsg = n.message.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg) return false;
      }
      return true;
    });
  }, [notifications, filter, categoryFilter, searchQuery]);

  const getStyleForType = (type: string, priority?: string) => {
    switch (type) {
      case "payment_confirmed":
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/30",
          badge: "Pagamento Confirmado",
          badgeColor:
            "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
      case "payment_pending":
      case "payment_rejected":
        return {
          icon: <DollarSign className="w-5 h-5 text-amber-400" />,
          bg: "bg-amber-500/10 border-amber-500/30",
          badge:
            type === "payment_pending"
              ? "Cobrança Pendente"
              : "Pagamento Recusado",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        };
      case "match_cancelled":
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          bg: "bg-rose-500/10 border-rose-500/30",
          badge: "Partida Cancelada",
          badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        };
      case "match_update":
      case "match_created":
      case "match_reminder":
        return {
          icon: <Calendar className="w-5 h-5 text-sky-400" />,
          bg: "bg-sky-500/10 border-sky-500/30",
          badge: type === "match_created" ? "Nova Partida" : "Partida",
          badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
        };
      case "teams_drawn":
      case "team_assigned":
        return {
          icon: <Sparkles className="w-5 h-5 text-purple-400" />,
          bg: "bg-purple-500/10 border-purple-500/30",
          badge: "Sorteio / Times",
          badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        };
      case "goal_scored":
      case "champion_declared":
        return {
          icon: <Flame className="w-5 h-5 text-amber-400" />,
          bg: "bg-amber-500/15 border-amber-500/35",
          badge: type === "champion_declared" ? "🏆 Campeão" : "⚽ Gol Marcado",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        };
      case "role_updated":
        return {
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/30",
          badge: "Cargo Atualizado",
          badgeColor:
            "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
      case "comment":
      case "post_reaction":
        return {
          icon: <MessageSquare className="w-5 h-5 text-cyan-400" />,
          bg: "bg-cyan-500/10 border-cyan-500/30",
          badge: "Resenha / Feed",
          badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-slate-400" />,
          bg: "bg-slate-800/40 border-slate-700/60",
          badge: "Aviso do Sistema",
          badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      <Header
        onOpenLogin={() => {}}
        onOpenCreatePost={() => {}}
        onOpenCreateMatch={() => {}}
        onOpenAdminPanel={() => {}}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Central de Notificações
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-black bg-rose-500 text-white rounded-full">
                    {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Histórico completo de partidas, presenças, pagamentos e resenha
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-emerald-400 transition-all active:scale-95"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>Marcar todas como lidas</span>
              </button>
            )}

            {user && (
              <button
                onClick={() => setIsPreferencesOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95"
                title="Configurar preferências de notificação"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Preferências</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner de Web Push no celular */}
        {mounted && pushStatus === "default" && isPushSupported() && (
          <div className="mb-6 p-4 bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Ative as Notificações no Celular
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Receba avisos de partidas, confirmação de PIX e sorteio de
                  times mesmo com o app fechado.
                </p>
              </div>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={isEnablingPush}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 shrink-0 flex items-center justify-center gap-2"
            >
              {isEnablingPush ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Ativando...</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Ativar Agora</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Barra de Busca e Filtros de Leitura */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 sm:p-4 mb-4 backdrop-blur-md space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="notifications-search-input"
                name="notifications-search"
                aria-label="Buscar notificações"
                placeholder="Buscar por texto da notificação..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Filtro Status (Todas / Não Lidas) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0 w-full sm:w-auto justify-center">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  filter === "all"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  filter === "unread"
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Não Lidas ({unreadCount})
              </button>
            </div>
          </div>

          {/* Categorias */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs font-bold text-slate-400">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === "all"
                  ? "bg-slate-800 text-white border border-slate-700"
                  : "hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              Todas Categorias
            </button>
            <button
              onClick={() => setCategoryFilter("matches")}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === "matches"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                  : "hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              ⚽ Partidas
            </button>
            <button
              onClick={() => setCategoryFilter("payments")}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === "payments"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              💵 Pagamentos
            </button>
            <button
              onClick={() => setCategoryFilter("teams")}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === "teams"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                  : "hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              🎲 Times & Raspadinha
            </button>
            <button
              onClick={() => setCategoryFilter("feed")}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === "feed"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              💬 Resenha & Feed
            </button>
            <button
              onClick={() => setCategoryFilter("system")}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === "system"
                  ? "bg-slate-700 text-white border border-slate-600"
                  : "hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              ⚙️ Sistema
            </button>
          </div>
        </div>

        {/* Lista de Notificações */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">
              Carregando suas notificações...
            </span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 border border-slate-800/80 rounded-3xl">
            <div className="p-4 bg-slate-800/50 rounded-full mb-3 text-slate-600">
              <Bell className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              Nenhuma notificação encontrada
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {searchQuery
                ? "Nenhum resultado corresponde aos termos da sua busca."
                : filter === "unread"
                  ? "Você já visualizou todas as suas notificações pendentes!"
                  : "Você ainda não recebeu avisos ou novidades nesta categoria."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredNotifications.map((notif) => {
                const style = getStyleForType(notif.type, notif.priority);
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleMarkAsRead(notif.id, notif.link)}
                    className={`group relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      notif.read
                        ? "bg-slate-900/40 border-slate-800/60 opacity-80 hover:opacity-100 hover:border-slate-700"
                        : `${style.bg} shadow-lg shadow-black/20 hover:border-brand-500/40`
                    }`}
                  >
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      {/* Ícone */}
                      <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 shrink-0 shadow-inner">
                        {style.icon}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${style.badgeColor}`}
                          >
                            {style.badge}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(notif.created_at)}</span>
                          </div>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                          {notif.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                          {notif.message}
                        </p>

                        {/* Botão de Ação / Deep Link */}
                        {notif.link && (
                          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-400 group-hover:text-brand-300 group-hover:underline">
                            <span>Acessar detalhes</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Ações Rápidas (Excluir / Ponto Não Lido) */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        {!notif.read && (
                          <div className="w-2.5 h-2.5 bg-brand-500 rounded-full animate-pulse shadow-sm shadow-brand-500/50" />
                        )}
                        <button
                          onClick={(e) => handleDelete(e, notif.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors opacity-0 group-hover:opacity-100"
                          title="Excluir notificação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {user && (
        <NotificationPreferencesModal
          isOpen={isPreferencesOpen}
          onClose={() => setIsPreferencesOpen(false)}
          userId={user.id}
        />
      )}
    </div>
  );
}
