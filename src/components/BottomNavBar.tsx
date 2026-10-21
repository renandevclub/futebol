"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLeague } from "@/context/LeagueContext";
import {
  Calendar,
  MessageSquare,
  Wallet,
  LogIn,
} from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const MyWalletModal = dynamic(
  () => import("@/components/MyWalletModal").then((m) => m.MyWalletModal),
  { ssr: false },
);
const LoginModal = dynamic(
  () => import("@/components/LoginModal").then((m) => m.LoginModal),
  { ssr: false },
);
const LeagueSelectNavigationModal = dynamic(
  () =>
    import("@/components/LeagueSelectNavigationModal").then(
      (m) => m.LeagueSelectNavigationModal,
    ),
  { ssr: false },
);

import { getUnreadNotificationCount, getUnreadNotificationCountsByCategories } from "@/lib/notifications";
import { markAllNotificationsAsReadByCategory } from "@/lib/notifications";
import { getLeagueWallet } from "@/lib/financeHelper";
import { subscribeToTables } from "@/lib/realtime";

export const BottomNavBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    currentLeague,
    userParticipatingLeagues,
    selectLeague,
    clearSelectedLeague,
    activeTab,
    setActiveTab,
  } = useLeague();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [unreadMatchesCount, setUnreadMatchesCount] = useState<number>(0);
  const [unreadFeedCount, setUnreadFeedCount] = useState<number>(0);
  const [currentWalletBalance, setCurrentWalletBalance] = useState<number | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Controle do modal de navegação inteligente (Partidas / Resenha)
  const [isNavModalOpen, setIsNavModalOpen] = useState(false);
  const [navModalMode, setNavModalMode] = useState<"matches" | "feed">("matches");

  // Não exibir barra de navegação inferior na página pública (/ quando visitante não autenticado),
  // nas telas de partida (/matches/...), controle ou telão TV
  const isPublicPage = (!user || isAuthLoading) && pathname === "/";

  const shouldHideBottomNav = Boolean(
    pathname &&
      (pathname.startsWith("/matches/") ||
        pathname.includes("/tv") ||
        pathname.includes("/control") ||
        isPublicPage),
  );

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignora se o navegador bloquear vibração
      }
    }
  };

  // Carregar notificações não lidas (geral + por categoria)
  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotificationsCount(0);
      setUnreadMatchesCount(0);
      setUnreadFeedCount(0);
      return;
    }
    const [totalCount, categoryCounts] = await Promise.all([
      getUnreadNotificationCount(user.id),
      getUnreadNotificationCountsByCategories(user.id, ['matches', 'feed']),
    ]);
    setUnreadNotificationsCount(totalCount);
    setUnreadMatchesCount(categoryCounts.matches || 0);
    setUnreadFeedCount(categoryCounts.feed || 0);
  }, [user?.id]);

  // Carregar saldo da carteira na liga atual
  const loadWalletBalance = useCallback(async () => {
    if (!user?.id || !currentLeague?.id) {
      setCurrentWalletBalance(null);
      return;
    }
    try {
      const wallet = await getLeagueWallet(currentLeague.id, user.id);
      if (wallet) {
        setCurrentWalletBalance(wallet.saldo_disponivel || 0);
      } else {
        setCurrentWalletBalance(0);
      }
    } catch {
      setCurrentWalletBalance(null);
    }
  }, [user?.id, currentLeague?.id]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated || shouldHideBottomNav) return;

    void loadUnreadCount();
    void loadWalletBalance();
  }, [hasHydrated, shouldHideBottomNav, loadUnreadCount, loadWalletBalance]);

  // Realtime para notificações e saldo da carteira
  useEffect(() => {
    if (!hasHydrated || shouldHideBottomNav || !user?.id) return;

    const unsubNotifications = subscribeToTables(
      `bottom-nav-notif-${user.id}`,
      [{ table: "notifications", filter: `user_id=eq.${user.id}` }],
      () => {
        void loadUnreadCount();
      }
    );

    const unsubWallets = subscribeToTables(
      `bottom-nav-wallet-${user.id}`,
      [{ table: "league_player_wallets", filter: `user_id=eq.${user.id}` }],
      () => {
        void loadWalletBalance();
      }
    );

    return () => {
      unsubNotifications();
      unsubWallets();
    };
  }, [hasHydrated, shouldHideBottomNav, user?.id, loadUnreadCount, loadWalletBalance]);

  // ═══════════════════════════════════════════════════════════════════
  // NAVEGAÇÃO INTELIGENTE (PARTIDAS & RESENHA) - RESPOSTA IMEDIATA EM 1 CLIQUE
  // ═══════════════════════════════════════════════════════════════════

  const handleMatchesClick = () => {
    triggerHaptic();

    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    // Limpar badge de Partidas ao acessar a seção
    if (unreadMatchesCount > 0) {
      setUnreadMatchesCount(0);
      void markAllNotificationsAsReadByCategory(user.id, 'matches');
    }

    const leagues = userParticipatingLeagues || [];

    if (leagues.length === 1) {
      // 1 única liga: seleciona e abre diretamente
      selectLeague(leagues[0].id);
      setActiveTab("matches");
      if (pathname !== "/") {
        router.push("/?tab=matches");
      }
    } else {
      // 0 ligas ou 2+ ligas: abre modal inteligente
      setNavModalMode("matches");
      setIsNavModalOpen(true);
    }
  };

  const handleFeedClick = () => {
    triggerHaptic();

    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    // Limpar badge de Resenha ao acessar a seção
    if (unreadFeedCount > 0) {
      setUnreadFeedCount(0);
      void markAllNotificationsAsReadByCategory(user.id, 'feed');
    }

    const leagues = userParticipatingLeagues || [];

    if (leagues.length === 1) {
      // 1 única liga: seleciona e abre diretamente o feed
      selectLeague(leagues[0].id);
      setActiveTab("feed");
      if (pathname !== "/") {
        router.push("/?tab=feed");
      }
    } else {
      // 0 ligas ou 2+ ligas: abre modal inteligente
      setNavModalMode("feed");
      setIsNavModalOpen(true);
    }
  };

  const handleSelectLeagueFromModal = (leagueId: string) => {
    selectLeague(leagueId);
    const targetTab = navModalMode === "matches" ? "matches" : "feed";
    setActiveTab(targetTab);
    if (pathname !== "/") {
      router.push(`/?tab=${targetTab}`);
    }
  };

  const handleExploreLeagues = () => {
    clearSelectedLeague();
    if (pathname !== "/") {
      router.push("/?explore=1");
    } else {
      window.history.replaceState(null, "", "/?explore=1");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  // Estados ativos das abas em tempo real com activeTab sincronizado
  const isFeedActive = pathname === "/" && activeTab === "feed";
  const isProfileActive = user ? pathname.startsWith(`/profile/${user.id}`) : false;
  const isMatchesActive =
    (pathname === "/" && activeTab === "matches") ||
    (pathname.startsWith("/matches") && !pathname.includes("/tv"));

  // Ao estar ou entrar na aba ativa correspondente, limpa automaticamente as notificações não lidas da categoria
  useEffect(() => {
    if (isMatchesActive && unreadMatchesCount > 0 && user?.id) {
      setUnreadMatchesCount(0);
      void markAllNotificationsAsReadByCategory(user.id, "matches");
    }
  }, [isMatchesActive, unreadMatchesCount, user?.id]);

  useEffect(() => {
    if (isFeedActive && unreadFeedCount > 0 && user?.id) {
      setUnreadFeedCount(0);
      void markAllNotificationsAsReadByCategory(user.id, "feed");
    }
  }, [isFeedActive, unreadFeedCount, user?.id]);

  const isVolei = currentLeague?.sport_type === "volei";
  const activeColor = isVolei ? "text-amber-500" : "text-emerald-500";
  const activeBg = isVolei ? "bg-amber-500/15" : "bg-emerald-500/15";
  const indicatorColor = isVolei ? "bg-amber-500" : "bg-emerald-500";

  if (!hasHydrated || shouldHideBottomNav) return null;

  return (
    <>
      {/* Espaçador no fluxo do documento para garantir que o conteúdo não fique escondido sob o menu fixo */}
      <div className="h-16 pb-safe sm:hidden pointer-events-none select-none" aria-hidden="true" />

      {/* Barra de Navegação Inferior Fixa Mobile (4 Itens: Partidas, Resenha, Meu Caixa, Perfil) */}
      <nav
        aria-label="Navegação inferior mobile"
        className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 pb-safe transition-colors shadow-[0_-4px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)]"
      >
        <div className="grid grid-cols-4 items-center justify-around h-16 max-w-lg mx-auto px-1 relative">
          {/* ═══════════════════════════════════════════════════════════
              ITEM 1: ⚽ Partidas (Navegação Inteligente)
          ═══════════════════════════════════════════════════════════ */}
          <button
            type="button"
            onClick={handleMatchesClick}
            aria-current={isMatchesActive ? "page" : undefined}
            aria-label="Acessar partidas"
            className="relative flex flex-col items-center justify-center h-full w-full touch-target transition-all group select-none cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-12 h-8 rounded-2xl transition-all">
              {isMatchesActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  className={`absolute inset-0 ${activeBg} rounded-2xl -z-10`}
                />
              )}
              <Calendar
                className={`w-5 h-5 transition-transform duration-200 ${
                  isMatchesActive
                    ? `${activeColor} scale-110`
                    : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                }`}
              />

              {/* Badge de notificações não lidas para Partidas */}
              {!isMatchesActive && unreadMatchesCount > 0 && (
                <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm animate-pulse">
                  {unreadMatchesCount > 9 ? "9+" : unreadMatchesCount}
                </span>
              )}

              {isMatchesActive && (
                <motion.span
                  layoutId="activeTabDot"
                  className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${indicatorColor}`}
                />
              )}
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-black tracking-tight mt-0.5 leading-none transition-colors truncate max-w-full px-0.5 ${
                isMatchesActive
                  ? activeColor
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Partidas
            </span>
          </button>

          {/* ═══════════════════════════════════════════════════════════
              ITEM 2: 💬 Resenha (Navegação Inteligente)
          ═══════════════════════════════════════════════════════════ */}
          <button
            type="button"
            onClick={handleFeedClick}
            aria-current={isFeedActive ? "page" : undefined}
            aria-label="Acessar resenha e feed da liga"
            className="relative flex flex-col items-center justify-center h-full w-full touch-target transition-all group select-none cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-12 h-8 rounded-2xl transition-all">
              {isFeedActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  className={`absolute inset-0 ${activeBg} rounded-2xl -z-10`}
                />
              )}
              <MessageSquare
                className={`w-5 h-5 transition-transform duration-200 ${
                  isFeedActive
                    ? `${activeColor} scale-110`
                    : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                }`}
              />

              {/* Badge de notificações não lidas para Resenha */}
              {!isFeedActive && unreadFeedCount > 0 && (
                <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm animate-pulse">
                  {unreadFeedCount > 9 ? "9+" : unreadFeedCount}
                </span>
              )}

              {isFeedActive && (
                <motion.span
                  layoutId="activeTabDot"
                  className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${indicatorColor}`}
                />
              )}
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-black tracking-tight mt-0.5 leading-none transition-colors truncate max-w-full px-0.5 ${
                isFeedActive ? activeColor : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Resenha
            </span>
          </button>

          {/* ═══════════════════════════════════════════════════════════
              ITEM 3: 💰 Meu Caixa (Funcionalidade Financeira Preservada)
          ═══════════════════════════════════════════════════════════ */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              if (user) {
                setIsWalletModalOpen(true);
              } else {
                setIsLoginModalOpen(true);
              }
            }}
            className="relative flex flex-col items-center justify-center h-full w-full touch-target transition-all group select-none cursor-pointer"
            aria-label="Abrir meu caixa individual da liga"
          >
            <div className="relative flex items-center justify-center w-12 h-8 rounded-2xl group-hover:bg-emerald-500/10 transition-all">
              <Wallet className="w-5 h-5 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />

              {/* Indicador de Saldo da Liga Atual */}
              {user && currentWalletBalance !== null && currentWalletBalance > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-px rounded-full bg-emerald-500 text-white font-black text-[8px] leading-tight shadow-sm flex items-center justify-center border border-white dark:border-slate-900">
                  R${Math.floor(currentWalletBalance)}
                </span>
              )}

              {user && (currentWalletBalance === null || currentWalletBalance === 0) && (
                <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500/40" />
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-black tracking-tight mt-0.5 leading-none text-emerald-600 dark:text-emerald-400 truncate max-w-full px-0.5">
              Meu Caixa
            </span>
          </button>

          {/* ═══════════════════════════════════════════════════════════
              ITEM 4: 👤 Perfil (Acesso ao Perfil do Usuário / Conta)
          ═══════════════════════════════════════════════════════════ */}
          {user ? (
            <Link
              href={`/profile/${user.id}`}
              onClick={triggerHaptic}
              aria-current={isProfileActive ? "page" : undefined}
              aria-label={
                unreadNotificationsCount > 0
                  ? `Abrir meu perfil. ${unreadNotificationsCount} notificações não lidas.`
                  : "Abrir meu perfil"
              }
              className="relative flex flex-col items-center justify-center h-full w-full touch-target transition-all group select-none"
            >
              <div className="relative flex items-center justify-center w-12 h-8">
                {isProfileActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    className={`absolute inset-0 ${activeBg} rounded-2xl -z-10`}
                  />
                )}
                <div
                  className={`relative w-6 h-6 rounded-full border-2 transition-transform duration-200 ${
                    isProfileActive
                      ? `${isVolei ? "border-amber-500" : "border-emerald-500"} scale-110 ring-2 ${
                          isVolei ? "ring-amber-500/30" : "ring-emerald-500/30"
                        }`
                      : "border-slate-300 dark:border-slate-700 group-hover:border-slate-400"
                  }`}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.nome || "Perfil"}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-[9px]">
                      {(user.nome || "A").charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Badge de Notificações não lidas integrado ao Perfil */}
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 bg-rose-500 text-white font-black text-[8px] rounded-full flex items-center justify-center border border-white dark:border-slate-900 shadow-sm animate-pulse">
                      {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-black tracking-tight mt-0.5 leading-none transition-colors truncate max-w-full px-0.5 ${
                  isProfileActive ? activeColor : "text-slate-500 dark:text-slate-400"
                }`}
              >
                Perfil
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLoginModalOpen(true);
              }}
              className="relative flex flex-col items-center justify-center h-full w-full touch-target transition-all group select-none cursor-pointer"
              aria-label="Fazer login ou acessar perfil"
            >
              <div className="relative flex items-center justify-center w-12 h-8 rounded-2xl group-hover:bg-slate-100 dark:group-hover:bg-slate-900 transition-all">
                <LogIn className="w-5 h-5 text-brand-500" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-black tracking-tight mt-0.5 leading-none text-brand-500">
                Perfil
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL DE NAVEGAÇÃO INTELIGENTE (PARTIDAS & RESENHA)
      ═══════════════════════════════════════════════════════════════ */}
      {isNavModalOpen && (
        <LeagueSelectNavigationModal
          isOpen={isNavModalOpen}
          mode={navModalMode}
          leagues={userParticipatingLeagues || []}
          currentLeagueId={currentLeague?.id || null}
          onSelectLeague={handleSelectLeagueFromModal}
          onExploreLeagues={handleExploreLeagues}
          onClose={() => setIsNavModalOpen(false)}
        />
      )}

      {/* Modal Meu Caixa */}
      {isWalletModalOpen && (
        <MyWalletModal
          isOpen={isWalletModalOpen}
          onClose={() => {
            setIsWalletModalOpen(false);
            void loadWalletBalance();
          }}
        />
      )}

      {/* Modal de Login */}
      {isLoginModalOpen && (
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}
    </>
  );
};
