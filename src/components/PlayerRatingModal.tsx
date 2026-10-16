'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getPlayerRating, getRatingTier, RATING_TIERS } from '@/lib/playerRatingHelper';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Lock,
  X,
  Check,
  Star,
  Sparkles,
  Sliders,
  ShieldCheck,
  Loader2,
  Info,
  Trophy,
  Shield,
} from 'lucide-react';

interface PlayerRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: Profile | null;
  leagueId?: string | null;
  leagueName?: string | null;
  initialRating?: number | null;
  onRatingUpdated: (userId: string, newRating: number, leagueId?: string | null) => void;
}

export const PlayerRatingModal: React.FC<PlayerRatingModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  leagueId,
  leagueName,
  initialRating,
  onRatingUpdated,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const [currentRating, setCurrentRating] = useState<number>(5);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (targetUser) {
      if (typeof initialRating === 'number' && initialRating >= 1 && initialRating <= 10) {
        setCurrentRating(initialRating);
      } else {
        setCurrentRating(getPlayerRating(targetUser));
      }
    }
  }, [targetUser, initialRating, isOpen]);

  if (!isOpen || !targetUser) return null;

  const selectedTier = getRatingTier(currentRating);

  const handleSave = async () => {
    if (isSaving || !targetUser) return;
    setIsSaving(true);

    try {
      // 1. Chamar RPC segura do Supabase para atualizar a nota do jogador na liga ou globalmente
      const { data, error } = await supabase.rpc('update_league_participant_rating', {
        p_league_id: leagueId || null,
        p_user_id: targetUser.id,
        p_rating: currentRating,
      });

      if (error) {
        console.error('Erro na RPC update_league_participant_rating:', error);
        toast.error('Erro ao salvar avaliação: ' + error.message);
        return;
      }

      if (data && typeof data === 'object') {
        const res = data as { success: boolean; message?: string };
        if (!res.success) {
          toast.error(res.message || 'Falha ao salvar avaliação.');
          return;
        }
      }

      const scopeText = leagueName ? `na liga "${leagueName}"` : 'no sistema';
      toast.success(
        `Avaliação de ${targetUser.nome} definida como Nível ${currentRating} (${selectedTier.label}) ${scopeText}! 🎯`
      );

      onRatingUpdated(targetUser.id, currentRating, leagueId);
      onClose();
    } catch (err: any) {
      console.error('Exceção ao salvar nota de qualidade:', err);
      toast.error('Ocorreu um erro ao salvar a avaliação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-amber-500/30 dark:border-amber-500/25 p-4 sm:p-7 shadow-2xl overflow-y-auto max-h-[92vh]"
        >
          {/* Luz de Fundo Decorativa */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

          {/* Botão de Fechar */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Cabeçalho do Modal */}
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-amber-600/25 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
              {isSuperAdmin && !leagueId ? (
                <Crown className="w-6 h-6 text-amber-500 fill-amber-500/30" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-amber-500 fill-amber-500/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>{isSuperAdmin && !leagueId ? 'Super Admin' : 'Admin da Liga'}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Sigiloso
                </span>
                {leagueName && (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                    ⚽ {leagueName}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mt-0.5">
                Avaliação de Qualidade
              </h2>
            </div>
          </div>

          {/* Cartão do Jogador */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-brand-100 dark:bg-brand-950 border border-brand-300 dark:border-brand-800 flex items-center justify-center font-black text-brand-600 dark:text-brand-400 shrink-0 overflow-hidden text-sm">
              {targetUser.avatar_url ? (
                <img
                  src={targetUser.avatar_url}
                  alt={targetUser.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                targetUser.nome.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {targetUser.nome}
                </h3>
                {targetUser.apelido && (
                  <span className="text-xs text-slate-400 font-bold shrink-0">
                    ({targetUser.apelido})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <span>📱 {formatPhoneDisplay(targetUser.whatsapp)}</span>
                {targetUser.posicao && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    • {targetUser.posicao}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Destaque Visual do Nível Selecionado */}
          <div className="text-center p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 text-white shadow-inner mb-5 relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl">{selectedTier.emoji}</span>
              <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                {currentRating}
              </span>
              <span className="text-lg font-bold text-slate-400">/ 10</span>
            </div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {selectedTier.label}
            </div>
            <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto mt-2 leading-relaxed">
              {selectedTier.description}
            </p>
          </div>

          {/* Seletor de Notas (1 a 10) */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span>Escolha o nível de qualidade:</span>
              </span>
              <span className="text-amber-500 font-extrabold">
                {currentRating} de 10
              </span>
            </div>

            {/* Grid dos 10 Botões Interativos */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((lvl) => {
                const isSelected = lvl === currentRating;
                const tier = RATING_TIERS[lvl];

                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCurrentRating(lvl)}
                    className={`py-2 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-400 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30 scale-105 ring-2 ring-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{lvl}</span>
                    <span className="text-[10px] leading-none opacity-80">
                      {tier.emoji}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Slider de Precisão */}
            <div className="pt-2">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={currentRating}
                onChange={(e) => setCurrentRating(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1 px-1">
                <span>1 (Iniciante)</span>
                <span>5 (Média)</span>
                <span>10 (Elite)</span>
              </div>
            </div>
          </div>

          {/* Aviso de Sigilo e Sorteio */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-6 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-600 dark:text-amber-400">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Regra de Sigilo e Equilíbrio de Times</span>
            </div>
            <p>
              Esta avaliação é <strong>estritamente sigilosa</strong>. O jogador e outros participantes <strong>não têm acesso</strong> nem visualização desta nota. O sistema a utiliza automaticamente no sorteio de times para balancear o nível técnico de cada partida.
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Salvar Avaliação ({currentRating}/10)</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
