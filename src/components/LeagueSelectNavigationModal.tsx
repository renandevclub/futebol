"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MessageSquare,
  X,
  ChevronRight,
  Compass,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import { League } from "@/types/database";

interface LeagueSelectNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "matches" | "feed";
  leagues: League[];
  currentLeagueId: string | null;
  onSelectLeague: (leagueId: string) => void;
  onExploreLeagues: () => void;
}

export const LeagueSelectNavigationModal: React.FC<LeagueSelectNavigationModalProps> = ({
  isOpen,
  onClose,
  mode,
  leagues,
  currentLeagueId,
  onSelectLeague,
  onExploreLeagues,
}) => {
  // Fechar com tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMatches = mode === "matches";
  const title = isMatches ? "Partidas — Selecione a Liga" : "Resenha — Selecione a Liga";
  const iconColor = isMatches ? "text-emerald-500" : "text-teal-500";
  const iconBg = isMatches ? "bg-emerald-500/15" : "bg-teal-500/15";

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-nav-title"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      >
        {/* Backdrop clicável */}
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Cabeçalho do Modal */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 shadow-xs`}
              >
                {isMatches ? (
                  <Calendar className="w-5 h-5" />
                ) : (
                  <MessageSquare className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  id="league-nav-title"
                  className="font-black text-base sm:text-lg text-slate-900 dark:text-white truncate"
                >
                  {title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  {leagues.length === 0
                    ? "Nenhuma liga associada à sua conta"
                    : `Você participa de ${leagues.length} ${leagues.length === 1 ? "liga" : "ligas"}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Corpo do Modal */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5">
            {leagues.length === 0 ? (
              /* ESTADO: NÃO PARTICIPA DE NENHUMA LIGA */
              <div className="py-6 px-4 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-3xl flex items-center justify-center mx-auto text-emerald-500">
                  <Trophy className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    {isMatches
                      ? "Você ainda não participa de nenhuma liga"
                      : "Participe de uma liga para ver a Resenha"}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {isMatches
                      ? "Para acompanhar partidas agendadas, placares e confirmações, entre em uma liga esportiva ou explore as disponíveis."
                      : "O feed da resenha é exclusivo para participantes de cada liga. Descubra e participe de uma liga para interagir com a galera!"}
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2 max-w-xs mx-auto">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ scale: 1.02 }}
                    type="button"
                    onClick={() => {
                      onClose();
                      onExploreLeagues();
                    }}
                    className="w-full px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Explorar Ligas Disponíveis</span>
                  </motion.button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              /* ESTADO: LISTA DE LIGAS (2 OU MAIS LIGAS) */
              <div className="space-y-2.5">
                <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider">
                  Selecione a liga desejada:
                </p>

                <div className="space-y-2">
                  {leagues.map((league) => {
                    const isSelected = league.id === currentLeagueId;
                    const isVolei = league.sport_type === "volei";

                    return (
                      <motion.button
                        key={league.id}
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.01 }}
                        type="button"
                        onClick={() => {
                          onSelectLeague(league.id);
                          onClose();
                        }}
                        className={`w-full p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 shadow-xs"
                            : "bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Logo ou Emoji do Esporte */}
                          <div className="relative shrink-0">
                            {league.logo_url ? (
                              <img
                                src={league.logo_url}
                                alt={league.name}
                                className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                              />
                            ) : (
                              <div
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-xs ${
                                  isVolei
                                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                    : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                }`}
                              >
                                {isVolei ? "🏐" : "⚽"}
                              </div>
                            )}
                          </div>

                          {/* Detalhes da Liga */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {league.name}
                              </h4>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-xs">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Ativa</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>{isVolei ? "🏐 Vôlei" : "⚽ Futebol"}</span>
                              {league.matches_count !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {league.matches_count}{" "}
                                    {league.matches_count === 1 ? "partida" : "partidas"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-slate-400 group-hover:text-emerald-500 transition-colors">
                          <span className="text-xs font-bold hidden sm:inline">
                            Acessar
                          </span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
