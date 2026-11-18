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
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div
            onClick={(e) => {
              if (currentLeague.logo_url && onPreviewLogo) {
                e.stopPropagation();
                onPreviewLogo(currentLeague);
              }
            }}
            className={`w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] sm:min-w-[64px] sm:min-h-[64px] sm:max-w-[64px] sm:max-h-[64px] rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md shrink-0 overflow-hidden aspect-square border-2 border-white/20 relative ${
              isVolei
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/25'
                : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/25'
            } ${
              currentLeague.logo_url && onPreviewLogo
                ? 'cursor-zoom-in group/selector-avatar hover:ring-2 hover:ring-white/40 transition-all'
                : ''
            }`}
            title={currentLeague.logo_url && onPreviewLogo ? 'Toque para ver a foto de perfil ampliada' : undefined}
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
            {/* Título Principal da Liga */}
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate leading-tight">
              {currentLeague.name}
            </h2>

            {/* Descrição da Liga */}
            {currentLeague.description && (
              <p className="text-xs text-slate-300/80 font-medium line-clamp-1 mt-0.5">
                📝 {currentLeague.description}
              </p>
            )}

            {/* Badges e Status da Liga em Linha Única */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isVolei
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {isVolei ? '🏐 Vôlei' : '⚽ Futebol'}
              </span>

              {currentLeague.has_password && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <span>🔒 Senha</span>
                </span>
              )}

              {(() => {
                const admins = currentLeague.admins && currentLeague.admins.length > 0
                  ? currentLeague.admins
                  : (currentLeague.owner ? [currentLeague.owner] : []);
                const adminNames = admins.map(a => `${a.nome}${a.apelido ? ` (${a.apelido})` : ''}`).join(', ');
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 font-bold px-2 py-0.5 rounded-full bg-white/10 border border-white/10 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none" title={`Administradores: ${adminNames}`}>
                    <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{adminNames || 'Administrador'}</span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Botões de Ação do Contexto da Liga */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
          {isOwnerOrSuper && onEditLeague && (
            <button
              onClick={onEditLeague}
              className="h-10 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700/60 shadow-xs cursor-pointer active:scale-95"
              title="Configurações da Liga"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Editar</span>
            </button>
          )}

          {canManageCurrentLeague && onOpenCreateMatch && !currentLeague.is_blocked && (
            <button
              onClick={onOpenCreateMatch}
              className="h-10 px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Criar Nova Partida"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>
                <span className="inline sm:hidden">Criar</span>
                <span className="hidden sm:inline">Criar Partida</span>
              </span>
            </button>
          )}

          <button
            onClick={clearSelectedLeague}
            className="h-10 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-emerald-500/25 shadow-xs cursor-pointer active:scale-95"
            title="Escolher outra Liga"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>
              <span className="inline sm:hidden">Trocar</span>
              <span className="hidden sm:inline">Trocar de Liga</span>
            </span>
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
