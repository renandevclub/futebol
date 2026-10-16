'use client';

import React, { useState } from 'react';
import { League } from '@/types/database';
import { useLeague } from '@/context/LeagueContext';
import { X, Lock, KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface JoinLeaguePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: League | null;
  onSuccess?: (leagueId: string) => void;
  onPreviewLogo?: (league: League) => void;
}

export const JoinLeaguePasswordModal: React.FC<JoinLeaguePasswordModalProps> = ({
  isOpen,
  onClose,
  league,
  onSuccess,
  onPreviewLogo,
}) => {
  const { joinLeagueWithPassword } = useLeague();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !league) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password.trim()) {
      setErrorMessage('Por favor, informe a senha de acesso da liga.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await joinLeagueWithPassword(league.id, password.trim());

      if (result.success) {
        onClose();
        if (onSuccess) {
          onSuccess(league.id);
        }
      } else {
        setErrorMessage(result.message || 'Senha incorreta. Verifique com o organizador da liga.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ocorreu um erro ao validar a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] w-full max-w-md p-6 sm:p-7 shadow-2xl relative overflow-hidden text-left"
        >
          {/* Fundo decorativo sutil */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header com Capa / Logo da Liga */}
          <div className="flex items-center gap-3.5 mb-5">
            <div
              onClick={(e) => {
                if (league.logo_url && onPreviewLogo) {
                  e.stopPropagation();
                  onPreviewLogo(league);
                }
              }}
              className={`w-14 h-14 min-w-[56px] min-h-[56px] rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 p-1 border-2 border-emerald-500/50 shadow-lg shadow-emerald-950/40 flex items-center justify-center overflow-hidden shrink-0 relative ${
                league.logo_url && onPreviewLogo
                  ? 'cursor-zoom-in group/modal-logo hover:border-emerald-400'
                  : ''
              }`}
              title={league.logo_url && onPreviewLogo ? 'Toque/clique para ver a foto de perfil ampliada' : undefined}
            >
              {league.logo_url ? (
                <>
                  <img
                    src={league.logo_url}
                    alt={league.name}
                    className="w-full h-full object-cover rounded-xl group-hover/modal-logo:scale-105 transition-transform duration-200"
                  />
                  {onPreviewLogo && (
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/modal-logo:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-2xl">⚽</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Liga Protegida</span>
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                {league.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {(() => {
                  const admins = league.admins && league.admins.length > 0
                    ? league.admins
                    : (league.owner ? [league.owner] : []);
                  const label = admins.length > 1 ? 'Administradores' : 'Administrador';
                  const names = admins.map(a => a.nome).join(', ');
                  return `${label}: ${names || 'Organizador'}`;
                })()}
              </p>
            </div>
          </div>

          {/* Mensagem explicativa */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl mb-5 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 text-xs font-bold">
              <KeyRound className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Senha de Acesso Exclusiva</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Esta liga é restrita aos jogadores convidados. Digite a senha definida pelo organizador para liberar seu acesso às partidas e sorteios.
            </p>
          </div>

          {/* Formulário de Senha */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Digite a Senha da Liga
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  placeholder="Informe a senha da liga..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`w-full pl-10 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-medium focus:outline-none transition-all ${
                    errorMessage
                      ? 'border-red-500 focus:border-red-500 ring-2 ring-red-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Mensagem de Erro com Animação */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-bold mt-2 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !password.trim()}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Validando Senha...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Entrar na Liga</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
