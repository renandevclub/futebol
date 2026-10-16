"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Sun,
  Moon,
  LogIn,
  LogOut,
  ShieldAlert,
  PlusCircle,
  Calendar,
  Menu,
  X,
  User,
  Home,
  MessageSquare,
  ChevronRight,
  Trophy,
  Activity,
  Flame,
  Bell,
  Crown,
  Users,
  Wallet,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NotificationCenterModal } from "@/components/NotificationCenterModal";
import { MyWalletModal } from "@/components/MyWalletModal";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { subscribeToTables } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { LEVEL_TIERS } from "@/lib/levelSystem";
import { toast } from "sonner";
import { useLeague } from "@/context/LeagueContext";

interface HeaderProps {
  onOpenLogin: () => void;
  onOpenCreatePost: () => void;
  onOpenCreateMatch: () => void;
  onOpenAdminPanel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLogin,
  onOpenCreatePost,
  onOpenCreateMatch,
  onOpenAdminPanel,
}) => {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const { currentLeague, clearSelectedLeague, myLeagues } = useLeague();
  const hasAdminAccess = isSuperAdmin || myLeagues.length > 0;
  const pathname = usePathname();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const lastToastIdRef = useRef<string | null>(null);

  const fetchUnread = async (isRealtimeEvent = false) => {
    if (!user?.id) return;
    const count = await getUnreadNotificationCount(user.id);
    setUnreadCount(count);

    if (isRealtimeEvent) {
      // Buscar a notificação mais recente não lida
      const { data: latest } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest && latest.id !== lastToastIdRef.current) {
        lastToastIdRef.current = latest.id;
        toast.info(latest.title, {
          description: latest.message,
          duration: 6000,
          action: {
            label: 'Ver',
            onClick: () => {
              if (latest.link) {
                window.location.href = latest.link;
              } else {
                setIsNotificationModalOpen(true);
              }
            },
          },
        });
      }
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    void fetchUnread();

    // Inscrição Realtime com filtro estrito de user_id
    const unsubscribe = subscribeToTables(
      `header-notifications-${user.id}`,
      [{ table: 'notifications', filter: `user_id=eq.${user.id}` }],
      () => {
        void fetchUnread(true);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-3">
          {/* Logo & Marca */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0"
          >
            <img
              src="/logo.png"
              alt="F&V Sports"
              className="w-11 h-11 sm:w-13 sm:h-13 object-contain group-hover:scale-105 transition-transform duration-300 shrink-0 drop-shadow-sm"
            />
            <div className="min-w-0">
              <h1 className="font-black text-lg sm:text-2xl leading-none tracking-tight text-slate-900 dark:text-white transition-colors truncate flex items-center gap-1.5">
                <span className="text-slate-900 dark:text-white font-black tracking-tight">F&V</span>
                <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 bg-clip-text text-transparent font-black tracking-wide">
                  Sports
                </span>
              </h1>
              <span className="hidden sm:block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5">
                Futebol & Vôlei
              </span>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-xs font-extrabold">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive("/")
                  ? "bg-white dark:bg-slate-900 text-brand-500 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-brand-500"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Partidas</span>
            </Link>

            <Link
              href="/standings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive("/standings")
                  ? "bg-white dark:bg-slate-900 text-brand-500 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-brand-500"
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Classificação</span>
            </Link>

            {user && (
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:bg-emerald-500/10"
                title="Acessar Meu Caixa individual por liga"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Meu Caixa</span>
              </button>
            )}

            {user && (
              <Link
                href={`/profile/${user.id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive(`/profile/${user.id}`)
                    ? "bg-white dark:bg-slate-900 text-brand-500 shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-brand-500"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Meu Perfil</span>
              </Link>
            )}

            {currentLeague && (
              <Link
                href="/"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black hover:bg-emerald-500/25 transition-colors"
                title={`Liga Ativa: ${currentLeague.name}`}
              >
                <span>⚽</span>
                <span className="max-w-[120px] truncate">{currentLeague.name}</span>
              </Link>
            )}
          </nav>

          {/* Ações Rápidas & Usuário Desktop */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {/* Seletor de Tema */}
            <motion.button
              whileTap={{ scale: 0.9, rotate: 15 }}
              whileHover={{ scale: 1.1 }}
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
              aria-label="Alternar tema"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </motion.button>

            {/* Meu Caixa Rápido */}
            {user && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsWalletModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-extrabold text-xs hover:bg-emerald-500/20 transition-all shadow-sm"
                title="Ver Saldo e Extrato do Meu Caixa"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Meu Caixa</span>
              </motion.button>
            )}

            {/* Notificações (Sininho) */}
            {user && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsNotificationModalOpen(true)}
                className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Central de Notificações"
                aria-label="Abrir central de notificações"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </motion.button>
            )}

            {/* Ações do Admin */}
            {hasAdminAccess && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={onOpenCreatePost}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/50 transition-colors"
                  title="Postar no Feed"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-brand-500" />
                  <span>Novo Post</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={onOpenCreateMatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-500/20 transition-all"
                  title="Agendar Partida"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Criar Partida</span>
                </motion.button>

                {/* Gestão Financeira da Liga */}
                <Link
                  href="/administracao/financeiro"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors shadow-sm"
                  title="Gestão Financeira, Conferência e Caixinha"
                >
                  <Coins className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Financeiro</span>
                </Link>

                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.04 }}
                  onClick={onOpenAdminPanel}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                  title="Painel de Controle Admin"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </motion.button>
                <Link
                  href="/administracao/usuarios"
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold rounded-xl transition-all shadow-sm ${
                    isSuperAdmin
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 shadow-amber-500/10'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-emerald-500/10'
                  }`}
                  title={isSuperAdmin ? 'Gerenciamento Global de Usuários e Cargos' : 'Gerenciamento e Avaliação de Participantes da Liga'}
                >
                  {isSuperAdmin ? (
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span>{isSuperAdmin ? 'Usuários' : 'Participantes'}</span>
                </Link>
              </div>
            )}

            {/* Perfil & Auth */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <Link
                  href={`/profile/${user.id}`}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 group"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 border border-brand-300 dark:border-brand-700 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xs overflow-hidden group-hover:scale-105 transition-transform">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.nome.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-brand-500 transition-colors max-w-[100px] truncate">
                        {user.apelido || user.nome}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5">
                        <span>🩴</span>
                        <span>Boleiro</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                      {user.role === "super_admin"
                        ? "👑 Super Admin"
                        : user.role === "admin"
                        ? "🛡️ Organizador"
                        : "Jogador"}
                    </span>
                  </div>
                </Link>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Sair da Conta"
                >
                  <LogOut className="w-4 h-4" />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.04 }}
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-all shadow-md shadow-brand-500/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar / Cadastrar</span>
              </motion.button>
            )}
          </div>

          {/* Bar de Ações Reduzida & Botão Hambúrguer Mobile */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <motion.button
              whileTap={{ scale: 0.9, rotate: 15 }}
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Alternar tema"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </motion.button>

            {/* Notificações Mobile */}
            {user && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsNotificationModalOpen(true)}
                className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Abrir central de notificações"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </motion.button>
            )}

            {user ? (
              <Link
                href={`/profile/${user.id}`}
                className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 border border-brand-300 dark:border-brand-700 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xs overflow-hidden active:scale-90 transition-transform"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.nome.charAt(0).toUpperCase()
                )}
              </Link>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onOpenLogin}
                className="px-2.5 py-1.5 text-xs font-extrabold rounded-xl bg-brand-500 text-white shadow-sm"
              >
                Entrar
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Abrir menu de navegação"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-brand-500" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* DRAWER MOBILE DE NAVEGAÇÃO */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />

          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-9 h-9 object-contain"
                />
                <span className="font-black text-sm text-slate-900 dark:text-white">
                  Menu de Navegação
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {user && (
              <Link
                href={`/profile/${user.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-black flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.nome.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {user.nome}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {user.role === "admin"
                        ? "🛡️ Organizador da Partida"
                        : "⚽ Jogador Participante"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            )}

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">
                Navegação
              </span>

              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between p-3 rounded-2xl font-extrabold text-xs transition-colors ${
                  isActive("/")
                    ? "bg-brand-500/10 text-brand-500 dark:bg-brand-500/20"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Home className="w-4 h-4 text-brand-500" />
                  <span>Partidas Agendadas</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>

              <Link
                href="/standings"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between p-3 rounded-2xl font-extrabold text-xs transition-colors ${
                  isActive("/standings")
                    ? "bg-brand-500/10 text-brand-500 dark:bg-brand-500/20"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Tabela de Classificação</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>

              {user && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsWalletModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-extrabold text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Wallet className="w-4 h-4 text-emerald-500" />
                      <span>Meu Caixa Individual</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-500" />
                  </button>

                  <Link
                    href={`/profile/${user.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl font-extrabold text-xs transition-colors ${
                      isActive(`/profile/${user.id}`)
                        ? "bg-brand-500/10 text-brand-500 dark:bg-brand-500/20"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-brand-500" />
                      <span>Meu Perfil Social</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>

                  <Link
                    href="/notificacoes"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl font-extrabold text-xs transition-colors ${
                      isActive("/notificacoes")
                        ? "bg-brand-500/10 text-brand-500 dark:bg-brand-500/20"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Bell className="w-4 h-4 text-brand-500" />
                      <span>Central de Notificações</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </>
              )}
            </div>

            {hasAdminAccess && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider block px-1">
                  Painel de Controle (Admin)
                </span>

                <Link
                  href="/administracao/financeiro"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-600/20"
                >
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-4 h-4" />
                    <span>Controle Financeiro & Caixinha</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenCreateMatch();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-brand-500 text-white font-extrabold text-xs shadow-md shadow-brand-500/20"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4" />
                    <span>Agendar Nova Partida</span>
                  </div>
                  <PlusCircle className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenCreatePost();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <PlusCircle className="w-4 h-4 text-brand-500" />
                    <span>Criar Novo Post no Feed</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAdminPanel();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-extrabold text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Painel da Pelada (Admin)</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <Link
                  href="/administracao/usuarios"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border font-extrabold text-xs shadow-sm ${
                    isSuperAdmin
                      ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isSuperAdmin ? (
                      <Crown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Users className="w-4 h-4 text-emerald-500" />
                    )}
                    <span>{isSuperAdmin ? 'Gerenciamento de Usuários' : 'Gerenciamento de Participantes'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </Link>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-700" />
                    <span>Modo Escuro</span>
                  </>
                )}
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-red-500 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da Conta</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-black bg-brand-500 text-white rounded-xl shadow-md"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Entrar / Cadastrar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <NotificationCenterModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        userId={user?.id}
        onNotificationRead={fetchUnread}
      />

      <MyWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </>
  );
};
