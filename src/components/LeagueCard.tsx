'use client';

import React, { useState } from 'react';
import { League, Profile } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { Calendar, ArrowRight, Edit3, Shield, Lock, Maximize2, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import { toast } from 'sonner';

interface LeagueCardProps {
  league: League;
  isSelected?: boolean;
  onSelect: (league: League) => void;
  onEdit?: (league: League) => void;
  onPreviewLogo?: (league: League) => void;
}

export const LeagueCard: React.FC<LeagueCardProps> = ({
  league,
  isSelected = false,
  onSelect,
  onEdit,
  onPreviewLogo,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { isLeagueMember, canManageLeague } = useLeague();
  const isOwnerOrSuper = isSuperAdmin || canManageLeague(league.id, league);
  const isMember = isLeagueMember(league.id);
  const isVolei = league.sport_type === 'volei';

  // Administrador Criador da Liga
  const creatorAdmin: Profile | null = league.owner || (league.admins && league.admins.length > 0 ? league.admins[0] : null);

  // Estado para o Lightbox da Foto de Perfil do Criador
  const [adminLightboxData, setAdminLightboxData] = useState<LightboxPreviewData | null>(null);

  const handleOpenAdminAvatar = (admin: Profile) => {
    if (!admin.avatar_url) return;
    setAdminLightboxData({
      isOpen: true,
      imageUrl: admin.avatar_url,
      title: admin.nome,
      subtitle: admin.apelido ? `Apelido: ${admin.apelido}` : `Organizador da Liga ${league.name}`,
      badge: `Criador da Liga • ${league.name}`,
      badgeColor: isVolei ? 'amber' : 'emerald',
      type: 'avatar',
    });
  };

  // Abrir WhatsApp do Criador da Liga
  const handleContactAdminWhatsApp = (
    e: React.MouseEvent,
    admin: Profile,
    targetLeague: League
  ) => {
    e.stopPropagation();
    const rawPhone = admin.whatsapp || targetLeague.organizer_whatsapp || '';
    const digits = rawPhone.replace(/\D/g, '');

    if (!digits) {
      toast.error(`O organizador ${admin.nome} não possui WhatsApp cadastrado.`);
      return;
    }

    let cleanPhone = digits;
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const adminName = admin.apelido || admin.nome.split(' ')[0] || admin.nome;
    const cleanLeagueName = targetLeague.name.replace(/["']/g, '').trim();
    const isVoleiLeague = targetLeague.sport_type === 'volei';

    let message = '';
    if (
      targetLeague.has_password ||
      (targetLeague.access_password && targetLeague.access_password.trim().length > 0)
    ) {
      message = isVoleiLeague
        ? `Olá, ${adminName}! Gostaria de solicitar a *senha de acesso* para entrar na liga de vôlei *"${cleanLeagueName}"* no F&V Sports. 🏐🔥`
        : `Olá, ${adminName}! Gostaria de solicitar a *senha de acesso* para entrar na liga *"${cleanLeagueName}"* no F&V Sports. 🏆⚽`;
    } else {
      message = isVoleiLeague
        ? `Olá, ${adminName}! Gostaria de solicitar informações sobre a liga de vôlei *"${cleanLeagueName}"* no F&V Sports. 🏐🔥`
        : `Olá, ${adminName}! Gostaria de solicitar informações sobre a liga *"${cleanLeagueName}"* no F&V Sports. 🏆⚽`;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={() => onSelect(league)}
        className={`group relative overflow-hidden rounded-[1.75rem] sm:rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
          isSelected
            ? isVolei
              ? 'bg-slate-900 border-amber-500 shadow-xl shadow-amber-950/60 ring-2 ring-amber-500/40'
              : 'bg-slate-900 border-emerald-500 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-500/40'
            : isVolei
            ? 'bg-white dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-800/90 shadow-md hover:shadow-xl hover:border-amber-500/50'
            : 'bg-white dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-800/90 shadow-md hover:shadow-xl hover:border-emerald-500/50'
        }`}
      >
        {/* CAPA DA LIGA (BANNER) */}
        <div className={`relative h-28 sm:h-36 w-full overflow-hidden shrink-0 ${
          isVolei
            ? 'bg-gradient-to-br from-amber-950 via-slate-900 to-orange-950'
            : 'bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950'
        }`}>
          {league.cover_url ? (
            <img
              src={league.cover_url}
              alt={`Capa da ${league.name}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center relative">
              <div className={`absolute inset-0 ${
                isVolei
                  ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.25),transparent_70%)]'
                  : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.25),transparent_70%)]'
              }`} />
              <span className="text-3xl sm:text-4xl opacity-20 select-none">{isVolei ? '🏐' : '⚽'}</span>
            </div>
          )}

          {/* Overlay gradiente suave para transição no card */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent" />

          {/* Badges superiores: Status + Modalidade da Liga */}
          <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 flex flex-wrap items-center gap-1.5">
            {/* Badge de Modalidade (Futebol / Vôlei) */}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider shadow-sm border ${
              isVolei
                ? 'border-amber-500/40 text-amber-400'
                : 'border-emerald-500/40 text-emerald-400'
            }`}>
              <span>{isVolei ? '🏐 Vôlei' : '⚽ Futebol'}</span>
            </div>

            {/* Badge de Senha/Bloqueio/Membro */}
            {league.is_blocked ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider shadow-sm border border-red-500/40 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span>Bloqueada</span>
              </div>
            ) : league.has_password ? (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider shadow-sm border ${
                isMember ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'
              }`}>
                {isOwnerOrSuper ? (
                  <>
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>Senha Ativa</span>
                  </>
                ) : isMember ? (
                  <>
                    <Shield className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Membro ✅</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>Requer Senha</span>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* Botão de Edição para Owner / Super Admin no topo direito da capa */}
          {isOwnerOrSuper && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(league);
              }}
              className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 p-2 rounded-xl bg-slate-950/80 hover:bg-emerald-500 text-slate-300 hover:text-white backdrop-blur-md border border-white/10 hover:border-emerald-400 transition-all shadow-md cursor-pointer"
              title="Gerenciar e Editar Liga"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* CORPO DO CARD COM LOGO EM DESTAQUE */}
        <div className="p-4 sm:p-5 pt-0 relative flex-1 flex flex-col justify-between">
          {/* LOGO DA LIGA (Sobrepondo a Capa) & Contador de Partidas */}
          <div className="flex items-end justify-between -mt-7 sm:-mt-9 mb-2.5 relative z-10">
            <div
              onClick={(e) => {
                if (league.logo_url && onPreviewLogo) {
                  e.stopPropagation();
                  onPreviewLogo(league);
                }
              }}
              className={`w-14 h-14 sm:w-20 sm:h-20 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] sm:min-w-[80px] sm:min-h-[80px] sm:max-w-[80px] sm:max-h-[80px] rounded-2xl bg-slate-900 p-0.5 sm:p-1 border-2 shadow-xl shadow-slate-950/60 overflow-hidden flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform aspect-square relative ${
                isVolei ? 'border-amber-500/60' : 'border-emerald-500/60'
              } ${
                league.logo_url && onPreviewLogo
                  ? 'cursor-zoom-in group/logo-thumb hover:ring-2'
                  : ''
              }`}
              title={league.logo_url && onPreviewLogo ? 'Toque/clique para ver a foto de perfil ampliada' : undefined}
            >
              {league.logo_url ? (
                <>
                  <img
                    src={league.logo_url}
                    alt={league.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {onPreviewLogo && (
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/logo-thumb:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                      <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                    </div>
                  )}
                </>
              ) : (
                <div className={`w-full h-full rounded-xl flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-inner ${
                  isVolei
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                }`}>
                  {isVolei ? '🏐' : '⚽'}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-700 dark:text-slate-300 shadow-xs">
              <Calendar className={`w-3 h-3 ${isVolei ? 'text-amber-500' : 'text-emerald-500'} shrink-0`} />
              <span>
                {league.matches_count || 0}{' '}
                {league.matches_count === 1 ? 'partida' : 'partidas'}
              </span>
            </div>
          </div>

          {/* Nome e Descrição da Liga */}
          <div className="mb-3">
            <h3 className={`text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug transition-colors line-clamp-1 ${
              isVolei ? 'group-hover:text-amber-500 dark:group-hover:text-amber-400' : 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400'
            }`}>
              {league.name}
            </h3>
            {league.description && (
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-0.5 line-clamp-2">
                📝 {league.description}
              </p>
            )}
          </div>

          {/* Apenas o Administrador Criador da Liga (Discreto e Limpo) */}
          {creatorAdmin && (
            <div className="mb-3 p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Avatar com Lightbox */}
                <div
                  onClick={(e) => {
                    if (creatorAdmin.avatar_url) {
                      e.stopPropagation();
                      handleOpenAdminAvatar(creatorAdmin);
                    }
                  }}
                  className={`w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 overflow-hidden aspect-square ${
                    creatorAdmin.avatar_url
                      ? 'cursor-zoom-in hover:ring-2 hover:ring-emerald-400 transition-all'
                      : ''
                  }`}
                  title={creatorAdmin.avatar_url ? 'Toque para ver a foto ampliada' : undefined}
                >
                  {creatorAdmin.avatar_url ? (
                    <img
                      src={creatorAdmin.avatar_url}
                      alt={creatorAdmin.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    creatorAdmin.nome?.charAt(0).toUpperCase() || '👤'
                  )}
                </div>

                {/* Nome e Cargo */}
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-none mb-0.5">
                    Organizador Criador
                  </span>
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                      {creatorAdmin.nome}
                    </span>
                    {creatorAdmin.apelido && (
                      <span className="text-[10px] text-emerald-500 font-bold shrink-0">
                        ({creatorAdmin.apelido})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão de WhatsApp do Criador */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={(e) => handleContactAdminWhatsApp(e, creatorAdmin, league)}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
                  Boolean(creatorAdmin.whatsapp || league.organizer_whatsapp)
                    ? 'bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366]'
                    : 'bg-slate-200 dark:bg-slate-700/50 text-slate-400 border border-slate-300 dark:border-slate-600 opacity-60'
                }`}
                title={
                  Boolean(creatorAdmin.whatsapp || league.organizer_whatsapp)
                    ? `Falar com ${creatorAdmin.nome} no WhatsApp`
                    : 'WhatsApp não cadastrado'
                }
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-black">
                  WhatsApp
                </span>
              </motion.button>
            </div>
          )}

          {/* Botão Principal de Ação: "Entrar na Liga →" */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
            <div className={`w-full py-2.5 rounded-xl text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all ${
              league.is_blocked
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/25'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25'
            }`}>
              <span>
                {league.is_blocked
                  ? isOwnerOrSuper
                    ? isSelected
                      ? 'Liga Bloqueada (Gestão) ⚠️'
                      : 'Acessar Liga Bloqueada 🔒'
                    : 'Liga Bloqueada 🔒'
                  : isSelected
                  ? 'Liga Selecionada ✅'
                  : league.has_password && !isOwnerOrSuper && !isMember
                  ? 'Entrar com Senha 🔒'
                  : 'Entrar na Liga'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lightbox para Foto de Perfil Ampliada do Administrador */}
      <ImageLightboxModal
        data={adminLightboxData}
        onClose={() => setAdminLightboxData(null)}
      />
    </>
  );
};
