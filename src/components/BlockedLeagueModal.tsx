'use client';

import React from 'react';
import { League } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, ArrowLeft, Lock } from 'lucide-react';

interface BlockedLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: League | null;
}

export const BlockedLeagueModal: React.FC<BlockedLeagueModalProps> = ({
  isOpen,
  onClose,
  league,
}) => {
  const { user } = useAuth();

  if (!isOpen || !league) return null;

  const isLeagueOwner = user && league.owner_id === user.id;
  const superAdminPhone = '5591993370456';
  const ownerMessage = encodeURIComponent(
    `Olá, Super Administrador! Minha liga "${league.name.replace(/["']/g, '')}" foi bloqueada temporariamente no F&V Sports. Gostaria de solicitar esclarecimentos e a liberação da liga.`
  );
  const whatsappUrl = `https://wa.me/${superAdminPhone}?text=${ownerMessage}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-red-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-center space-y-4"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Ícone de Alerta */}
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full">
              Liga Bloqueada
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white pt-2">
              {league.name}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
              {isLeagueOwner ? (
                <>
                  Sua liga foi <strong className="text-red-600 dark:text-red-400">bloqueada temporariamente</strong> pelo{' '}
                  <strong>Super Administrador</strong>. Enquanto estiver bloqueada, nenhum jogador poderá participar ou se inscrever em partidas desta liga.
                </>
              ) : (
                <>
                  Esta liga está <strong className="text-red-600 dark:text-red-400">temporariamente bloqueada</strong> pelo{' '}
                  <strong>Super Administrador</strong>. Não é possível entrar ou participar de partidas desta liga no momento.
                </>
              )}
            </p>
          </div>

          {league.blocked_reason && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl text-[11px] text-red-700 dark:text-red-300 font-medium text-left">
              <strong>Motivo:</strong> {league.blocked_reason}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {isLeagueOwner ? (
              <>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Falar com o Super Administrador</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para as Ligas Disponíveis</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
