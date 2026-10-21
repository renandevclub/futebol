"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLeague } from "@/context/LeagueContext";
import {
  Calendar,
  Trophy,
  MessageSquare,
  Wallet,
  User,
  LogIn,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
const MyWalletModal = dynamic(
  () => import("@/components/MyWalletModal").then((m) => m.MyWalletModal),
  { ssr: false },
);
const LoginModal = dynamic(
  () => import("@/components/LoginModal").then((m) => m.LoginModal),
  { ssr: false },
);
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getLeagueWallet } from "@/lib/financeHelper";
import { subscribeToTables } from "@/lib/realtime";

export const BottomNavBar: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { currentLeague } = useLeague();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [currentWalletBalance, setCurrentWalletBalance] = useState<number | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

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
        // Ignora silenciosamente se o navegador bloquear vibração
      }
    }
  };

  // Carregar notificações não lidas
  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotificationsCount(0);
      return;
    }
    const count = await getUnreadNotificationCount(user.id);
    setUnreadNotificationsCount(count);
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

  // Mantém a primeira renderização do cliente igual à renderização do servidor.
  // A autenticação vem do navegador e pode terminar antes da hidratação desta barra.
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

  const activeHomeTab = searchParams.get("tab");
  const isFeedActive = pathname === "/" && activeHomeTab === "feed";
  const isStandingsActive =
    pathname.startsWith("/standings") ||
    (pathname === "/" && (activeHomeTab === "standings" || activeHomeTab === "ranking"));
  const isProfileActive = user ? pathname.startsWith(`/profile/${user.id}`) : false;
  const isMatchesActive =
    (pathname === "/" && (!activeHomeTab || activeHomeTab === "matches")) ||
    (pathname.startsWith("/matches") && !pathname.includes("/tv"));

  const isVolei = currentLeague?.sport_type === "volei";
  const activeColor = isVolei ? "text-amber-500" : "text-emerald-500";
  const activeBg = isVolei ? "bg-amber-500/15" : "bg-emerald-500/15";
  const indicatorColor = isVolei ? "bg-amber-500" : "bg-emerald-500";

  if (!hasHydrated || shouldHideBottomNav) return null;

  return (
    <>
      {/* Espaçador no fluxo do documento para garantir que o conteúdo não fique escondido sob o menu fixo */}
      <div className="h-16 pb-safe sm:hidden pointer-events-none select-none" aria-hidden="true" />

      {/* Barra de Navegação Inferior Fixa para Dispositivos Móveis (Thumb Zone) */}
      <nav
        aria-label="Navegação inferior mobile"
        className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 pb-safe transition-colors shadow-[0_-4px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)]"
      >
        <div className={`grid ${user ? "grid-cols-5" : "grid-cols-4"} items-center justify-around h-16 max-w-lg mx-auto px-1 relative`}>
          {/* ABA 1: ⚽ Partidas (ou Liga Ativa) */}
          <Link
            href="/"
            onClick={triggerHaptic}
            aria-current={isMatchesActive ? "page" : undefined}
            className="relative flex flex-col items-center justify-center h-full touch-target transition-all group select-none"
          >
            <div className="relative flex items-center justify-center w-11 h-8 rounded-2xl transition-all">
              {/* Indicador deslizante via framer-motion */}
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
              {isMatchesActive && (
                <motion.span
                  layoutId="activeTabDot"
                  className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${indicatorColor}`}
                />
              )}
            </div>
            <span
              className={`text-[10px] font-black tracking-tight mt-0.5 leading-none transition-colors truncate max-w-[56px] ${
                isMatchesActive
                  ? activeColor
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {currentLeague ? (isVolei ? "Vôlei" : "Partidas") : "Partidas"}
            </span>
          </Link>

          {/* ABA 2: 🏆 Classificação / Torneios */}
          <Link
            href="/standings"
            onClick={triggerHaptic}
            aria-current={isStandingsActive ? "page" : undefined}
            className="relative flex flex-col items-center justify-center h-full touch-target transition-all group select-none"
          >
            <div className="relative flex items-center justify-center w-11 h-8 rounded-2xl transition-all">
              {isStandingsActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  className="absolute inset-0 bg-amber-500/15 rounded-2xl -z-10"
                />
              )}
              <Trophy
                className={`w-5 h-5 transition-transform duration-200 ${
                  isStandingsActive
                    ? "text-amber-500 scale-110"
                    : "text-slate-500 dark:text-slate-400 group-hover:text-amber-500"
                }`}
              />
              {isStandingsActive && (
                <motion.span
                  layoutId="activeTabDot"
                  className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-amber-500"
                />
              )}
            </div>
            <span
              className={`text-[10px] font-black tracking-tight mt-0.5 leading-none transition-colors ${
                isStandingsActive
                  ? "text-amber-500"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Tabela
            </span>
          </Link>

          {/* ABA 3: 💬 Feed / Resenha */}
          {user && (
            <Link
            href="/?tab=feed"
            onClick={triggerHaptic}
            aria-current={isFeedActive ? "page" : undefined}
            className="relative flex flex-col items-center justify-center h-full touch-target transition-all group select-none"
          >
            <div className="relative flex items-center justify-center w-11 h-8 rounded-2xl transition-all">
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
              {isFeedActive && (
                <motion.span
                  layoutId="activeTabDot"
                  className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${indicatorColor}`}
                />
              )}
            </div>
            <span
              className={`text-[10px] font-black tracking-tight mt-0.5 leading-none transition-colors ${
                isFeedActive ? activeColor : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Resenha
            </span>
            </Link>
          )}

          {/* ABA 4: 💰 Meu Caixa (com Indicador de Saldo Individual por Liga) */}
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
            className="relative flex flex-col items-center justify-center h-full touch-target transition-all group cursor-pointer select-none"
            aria-label="Abrir meu caixa individual da liga"
          >
            <div className="relative flex items-center justify-center w-11 h-8 rounded-2xl group-hover:bg-emerald-500/10 transition-all">
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
            <span className="text-[10px] font-black tracking-tight mt-0.5 leading-none text-emerald-600 dark:text-emerald-400">
              Meu Caixa
            </span>
          </button>

          {/* ABA 5: 👤 Perfil (com Avatar e Badge de Notificações Integrados) */}
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
              className="relative flex flex-col items-center justify-center h-full touch-target transition-all group select-none"
            >
              <div className="relative flex items-center justify-center w-11 h-8">
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
                      ? `${isVolei ? "border-amber-500" : "border-emerald-500"} scale-110 ring-2 ${isVolei ? "ring-amber-500/30" : "ring-emerald-500/30"}`
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
                className={`text-[10px] font-black tracking-tight mt-0.5 leading-none transition-colors truncate max-w-[54px] ${
                  isProfileActive ? activeColor : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {user.apelido || user.nome.split(" ")[0]}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLoginModalOpen(true);
              }}
              className="relative flex flex-col items-center justify-center h-full touch-target transition-all group cursor-pointer select-none"
              aria-label="Fazer login"
            >
              <div className="relative flex items-center justify-center w-11 h-8 rounded-2xl group-hover:bg-slate-100 dark:group-hover:bg-slate-900 transition-all">
                <LogIn className="w-5 h-5 text-brand-500" />
              </div>
              <span className="text-[10px] font-black tracking-tight mt-0.5 leading-none text-brand-500">
                Entrar
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Modais acionados diretamente pelos atalhos da barra inferior */}
      {isWalletModalOpen && (
        <MyWalletModal
          isOpen={isWalletModalOpen}
          onClose={() => {
            setIsWalletModalOpen(false);
            void loadWalletBalance();
          }}
        />
      )}

      {isLoginModalOpen && (
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}
    </>
  );
};
