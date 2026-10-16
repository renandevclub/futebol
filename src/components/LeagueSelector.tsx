'use client';

import React from 'react';
import { useLeague } from '@/context/LeagueContext';
import { useAuth } from '@/context/AuthContext';
import { Trophy, RefreshCw, PlusCircle, ShieldCheck, ChevronRight, Sparkles, Edit3, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeagueSelectorProps {
  onOpenCreateMatch?: () => void;
  onOpenCreateLeague?: () => void;
  onEditLeague?: () => void;
  onPreviewLogo?: (league: any) => void;
}

export const LeagueSelector: React.FC<LeagueSelectorProps> = ({
  onOpenCreateMatch,
  onOpenCreateLeague,
  onEditLeague,
  onPreviewLogo,
}) => {
  const { currentLeague, clearSelectedLeague, leagues, myLeagues, canManageLeague } = useLeague();
  const { user, isSuperAdmin } = useAuth();

  if (!currentLeague) return null;

  const canManageCurrentLeague = canManageLeague(currentLeague.id, currentLeague);
  const isOwnerOrSuper = isSuperAdmin || (user && currentLeague.owner_id === user.id) || canManageCurrentLeague;
  const isVolei = currentLeague.sport_type === 'volei';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 shadow-lg text-white backdrop-blur-md mb-6 ${
        isVolei
          ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/90 via-slate-900/95 to-[#1c1206]'
          : 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-[#06180e]'
      }`}
    >
      {/* Imagem de Capa em Marca D'água Elegante */}
      {currentLeague.cover_url && (
        <div className="absolute inset-0 z-0 opacity-25 pointer-events-none overflow-hidden">
          <img
            src={currentLeague.cover_url}
            alt=""
            className="w-full h-full object-cover blur-[2px] scale-105"
          />
          <div className={`absolute inset-0 ${
            isVolei
              ? 'bg-gradient-to-r from-amber-950/90 via-slate-900/80 to-[#1c1206]/95'
              : 'bg-gradient-to-r from-emerald-950/90 via-slate-900/80 to-[#06180e]/95'
          }`} />
        </div>
      )}

      {/* Luz ambiente */}
      <div className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-xl z-0 ${
        isVolei ? 'bg-amber-500/15' : 'bg-emerald-500/15'
      }`} />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        {/* Informações da Liga Ativa */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            onClick={(e) => {
              if (currentLeague.logo_url && onPreviewLogo) {
                e.stopPropagation();
                onPreviewLogo(currentLeague);
              }
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] sm:min-w-[56px] sm:min-h-[56px] sm:max-w-[56px] sm:max-h-[56px] rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md shrink-0 overflow-hidden aspect-square border border-white/20 relative ${
              isVolei
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/25'
                : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/25'
            } ${
              currentLeague.logo_url && onPreviewLogo
                ? 'cursor-zoom-in group/selector-avatar hover:ring-2 hover:ring-white/40 transition-all'
                : ''
            }`}
            title={currentLeague.logo_url && onPreviewLogo ? 'Toque/clique para ver a foto de perfil ampliada' : undefined}
          >
            {currentLeague.logo_url ? (
              <>
                <img
                  src={currentLeague.logo_url}
                  alt={currentLeague.name}
                  className="w-full h-full object-cover group-hover/selector-avatar:scale-105 transition-transform duration-200"
                />
                {onPreviewLogo && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/selector-avatar:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </>
            ) : (
              isVolei ? '🏐' : '⚽'
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isVolei
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {isVolei ? '🏐 Liga de Vôlei' : '⚽ Liga de Futebol'}
              </span>
              {currentLeague.has_password && (
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <span>🔒 Senha Ativa</span>
                </span>
              )}
              {(() => {
                const admins = currentLeague.admins && currentLeague.admins.length > 0
                  ? currentLeague.admins
                  : (currentLeague.owner ? [currentLeague.owner] : []);
                const adminNames = admins.map(a => `${a.nome}${a.apelido ? ` (${a.apelido})` : ''}`).join(', ');
                return (
                  <span className="text-[11px] sm:text-xs text-slate-300 font-medium truncate max-w-[220px] sm:max-w-none" title={`Administradores: ${adminNames}`}>
                    👤 {adminNames || 'Administrador'}
                  </span>
                );
              })()}
            </div>

            <h2 className="text-base sm:text-xl font-black text-white tracking-tight truncate mt-0.5">
              {currentLeague.name}
            </h2>

            {currentLeague.description && (
              <p className="text-[11px] sm:text-xs text-slate-300/90 font-medium line-clamp-1 mt-0.5">
                📝 {currentLeague.description}
              </p>
            )}
          </div>
        </div>

        {/* Botões de Ação do Contexto da Liga */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/10">
          {isOwnerOrSuper && onEditLeague && (
            <button
              onClick={onEditLeague}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-700/60 shadow-xs cursor-pointer"
              title="Configurações da Liga"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Editar</span>
            </button>
          )}

          {canManageCurrentLeague && onOpenCreateMatch && !currentLeague.is_blocked && (
            <button
              onClick={onOpenCreateMatch}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-colors shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Partida</span>
            </button>
          )}

          <button
            onClick={clearSelectedLeague}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-emerald-500/20 shadow-xs cursor-pointer"
            title="Escolher outra Liga"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Trocar de Liga</span>
          </button>
        </div>
      </div>

      {/* Banner de Aviso quando a Liga estiver Bloqueada */}
      {currentLeague.is_blocked && (
        <div className="mt-3.5 pt-3 border-t border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-red-950/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:p-4 text-xs">
          <div className="flex items-center gap-2 text-red-300">
            <span className="text-base">🔒</span>
            <span>
              <strong>Liga Bloqueada pelo Super Administrador:</strong> Novas partidas e inscrições de jogadores estão suspensas temporariamente.
            </span>
          </div>
          {isOwnerOrSuper && (
            <a
              href={`https://wa.me/5591993370456?text=${encodeURIComponent(
                `Olá, Super Administrador! Minha liga "${currentLeague.name}" foi bloqueada temporariamente. Gostaria de solicitar esclarecimentos e a liberação da liga.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-[11px] shrink-0 transition-colors shadow-sm"
            >
              Falar com o Super Admin
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
};
