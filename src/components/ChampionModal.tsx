'use client';

import React, { useEffect, useState } from 'react';
import { MatchChampionResult, ChampionPlayerData } from '@/lib/championHelper';
import { TeamBadge } from '@/components/TeamBadge';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import {
  Trophy,
  Crown,
  Sparkles,
  Flame,
  Medal,
  Award,
  Users,
  Share2,
  X,
  Calendar,
  MapPin,
  PartyPopper,
  CheckCircle2,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Link from 'next/link';

interface ChampionModalProps {
  isOpen: boolean;
  onClose: () => void;
  championData: MatchChampionResult | null;
  loading?: boolean;
}

export const ChampionModal: React.FC<ChampionModalProps> = ({
  isOpen,
  onClose,
  championData,
  loading = false,
}) => {
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  // Disparar confetes comemorativos ao abrir o modal
  const triggerConfetti = () => {
    try {
      // Disparo central
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#ffffff'],
        zIndex: 99999,
      });

      // Disparo da esquerda
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 70,
          origin: { x: 0.1, y: 0.7 },
          colors: ['#fbbf24', '#f59e0b', '#22c55e', '#ffd700'],
          zIndex: 99999,
        });
      }, 250);

      // Disparo da direita
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 70,
          origin: { x: 0.9, y: 0.7 },
          colors: ['#fbbf24', '#f59e0b', '#3b82f6', '#ffd700'],
          zIndex: 99999,
        });
      }, 450);
    } catch (e) {
      console.error('Erro ao disparar confetes:', e);
    }
  };

  useEffect(() => {
    if (isOpen && championData) {
      triggerConfetti();
    }
  }, [isOpen, championData]);

  if (!isOpen) return null;

  const team = championData?.teamInfo;
  const isVolei = championData?.isVolei || championData?.sportType === 'volei';

  // Compartilhar Conquista no WhatsApp
  const handleShareWhatsApp = () => {
    if (!championData) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const matchUrl = `${origin}/matches/${championData.matchId}`;

    const dateFormatted = championData.matchDate
      ? (() => {
          const parts = championData.matchDate.split('-');
          return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : championData.matchDate;
        })()
      : '';

    const playersNames = championData.players
      .map((p) => {
        const stat = p.goalsCount > 0
          ? isVolei
            ? ` 🏐 ${p.goalsCount} pt${p.goalsCount > 1 ? 's' : ''}`
            : ` ⚽ ${p.goalsCount} gol${p.goalsCount > 1 ? 's' : ''}`
          : '';
        return `• ${p.nome}${p.apelido ? ` (${p.apelido})` : ''}${stat}`;
      })
      .join('\n');

    const text = isVolei
      ? `🏆 *É CAMPEÃO DO VÔLEI!* 🥇\n\nParabéns ao *${team?.name || `Time ${championData.teamNumber}`}* pelo título nas quadras!\n\n🏐 *Partida:* ${championData.matchTitle}\n📅 *Data:* ${dateFormatted}\n📍 *Local:* ${championData.matchLocation}\n\n📊 *CAMPANHA DO CAMPEÃO:*\n⭐ *Pontos na Tabela:* ${championData.points} pts\n🔥 *Vitórias:* ${championData.wins}\n🏐 *Pontos Pró:* ${championData.goalsFor}\n🛡️ *Saldo de Pontos:* ${championData.goalDifference > 0 ? `+${championData.goalDifference}` : championData.goalDifference}\n\n👑 *ELENCO CAMPEÃO:*\n${playersNames || 'Jogadores do time'}\n\n📲 *Confira o placar e detalhes completos no app:*\n${matchUrl}`
      : `🏆 *É CAMPEÃO! É CAMPEÃO!* 🥇\n\nParabéns ao *${team?.name || `Time ${championData.teamNumber}`}* pela grande conquista!\n\n⚽ *Partida:* ${championData.matchTitle}\n📅 *Data:* ${dateFormatted}\n📍 *Local:* ${championData.matchLocation}\n\n📊 *CAMPANHA DO CAMPEÃO:*\n⭐ *Pontos:* ${championData.points} pts\n🔥 *Vitórias:* ${championData.wins}\n⚽ *Gols Pró:* ${championData.goalsFor}\n🛡️ *Saldo de Gols:* ${championData.goalDifference > 0 ? `+${championData.goalDifference}` : championData.goalDifference}\n\n👑 *ELENCO CAMPEÃO:*\n${playersNames || 'Jogadores do time'}\n\n📲 *Confira o placar e detalhes completos no app:*\n${matchUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Luz ambiente de estádio no fundo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-gradient-to-tr from-amber-500/20 via-yellow-500/15 to-emerald-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] text-white overflow-hidden my-auto"
      >
        {/* Faixa decorativa metálica no topo com reflexo */}
        <div className="h-2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.8)]" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-sm font-bold text-amber-400">Calculando campeão da rodada...</p>
          </div>
        ) : !championData ? (
          <div className="p-8 text-center space-y-4">
            <Trophy className="w-16 h-16 mx-auto text-slate-600" />
            <h3 className="font-black text-lg text-white">Nenhum resultado registrado ainda</h3>
            <p className="text-xs text-slate-400">
              Esta partida ainda não possui jogos finalizados ou dados suficientes para definir o campeão.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="p-5 sm:p-7 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
            {/* ═══════════════════════════════════════════════════════════
                CABEÇALHO COMEMORATIVO DO CAMPEÃO (WOW FACTOR)
            ═══════════════════════════════════════════════════════════ */}
            <div className="text-center space-y-3 relative pt-2">
              {/* Troféu com Efeito Glow Dourado */}
              <div className="relative inline-block">
                <motion.div
                  animate={{
                    rotate: [0, -5, 5, -3, 3, 0],
                    scale: [1, 1.06, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: 'easeInOut',
                  }}
                  className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 p-0.5 shadow-[0_0_30px_rgba(245,158,11,0.6)] flex items-center justify-center"
                >
                  <div className="w-full h-full rounded-[22px] bg-slate-950/80 flex items-center justify-center border border-amber-300/40">
                    <Trophy className="w-11 h-11 sm:w-14 sm:h-14 text-amber-400 fill-amber-400/90 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                  </div>
                </motion.div>

                {/* Coroa sobre o troféu */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                  <Crown className="w-7 h-7 text-yellow-300 fill-yellow-400 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)] animate-bounce" />
                </div>
              </div>

              {/* Badges de Título */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest shadow-inner">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Grande Campeão da Partida</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <TeamBadge
                    teamInfo={team}
                    size="md"
                    rounded="2xl"
                    className="shadow-lg shadow-amber-500/20"
                    onClick={(e) => {
                      if (team?.badge_url) {
                        e.stopPropagation();
                        setLightboxData({
                          imageUrl: team.badge_url,
                          title: team.name,
                          subtitle: 'Emblema Oficial • Time Campeão',
                          type: 'team_badge',
                          badge: '1º Lugar 🏆',
                          isOpen: true,
                        });
                      }
                    }}
                  />
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
                    {team?.name || `Time ${championData.teamNumber}`}
                  </h2>
                </div>

                <p className="text-xs text-slate-400 font-medium">
                  {championData.matchTitle} • {championData.matchLocation}
                </p>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                ESTATÍSTICAS DA CONQUISTA (PONTUAÇÃO / GOLS OU PONTOS / VITÓRIAS)
            ═══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-2xl bg-gradient-to-b from-amber-500/15 to-slate-900 border border-amber-500/30 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 flex items-center gap-0.5">
                  <Trophy className="w-3 h-3" /> Pts
                </span>
                <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5">
                  {championData.points}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Vitórias
                </span>
                <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5">
                  {championData.wins}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-400 flex items-center gap-0.5">
                  {isVolei ? '🏐 Pontos' : '⚽ Gols'}
                </span>
                <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5">
                  {championData.goalsFor}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-center flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-400 flex items-center gap-0.5">
                  <Shield className="w-3 h-3" /> {isVolei ? 'Saldo Pts' : 'Saldo'}
                </span>
                <span
                  className={`text-lg sm:text-xl font-black font-mono mt-0.5 ${
                    championData.goalDifference > 0
                      ? 'text-emerald-400'
                      : championData.goalDifference < 0
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}
                >
                  {championData.goalDifference > 0
                    ? `+${championData.goalDifference}`
                    : championData.goalDifference}
                </span>
              </div>
            </div>

            {/* Destaque para o Artilheiro / Maior Pontuador do Torneio se houver */}
            {championData.topScorer && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slate-800 to-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Flame className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                      {isVolei ? 'Maior Pontuador da Rodada 🏐' : 'Artilheiro da Rodada ⚽'}
                    </span>
                    <span className="font-extrabold text-xs text-white truncate block">
                      {championData.topScorer.nome}
                      {championData.topScorer.apelido && (
                        <span className="text-slate-400 font-normal ml-1">
                          ({championData.topScorer.apelido})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-black text-xs shrink-0">
                  {championData.topScorer.goals}{' '}
                  {isVolei
                    ? championData.topScorer.goals === 1
                      ? 'ponto'
                      : 'pontos'
                    : championData.topScorer.goals === 1
                    ? 'gol'
                    : 'gols'}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
                ELENCO DOS JOGADORES CAMPEÕES
            ═══════════════════════════════════════════════════════════ */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-black text-slate-300">
                  <Medal className="w-4 h-4 text-amber-400" />
                  <span>Elenco Campeão ({championData.players.length} atletas)</span>
                </div>
                <span className="text-[10px] text-amber-400/90 font-extrabold uppercase">
                  Medalha de Ouro 🥇
                </span>
              </div>

              {championData.players.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-center text-xs text-slate-400">
                  Nenhum jogador atribuído diretamente a este time.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {championData.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 hover:border-amber-500/40 transition-all shadow-xs group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        {player.avatar_url ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (player.avatar_url) {
                                setLightboxData({
                                  imageUrl: player.avatar_url,
                                  title: player.nome,
                                  subtitle: `Campeão • ${team?.name}`,
                                  type: 'avatar',
                                  badge: 'Campeão 🥇',
                                  isOpen: true,
                                });
                              }
                            }}
                            className="w-9 h-9 rounded-xl overflow-hidden border border-amber-500/40 shrink-0 hover:scale-105 transition-transform"
                          >
                            <img
                              src={player.avatar_url}
                              alt={player.nome}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-xs shrink-0">
                            {player.nome.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <Link
                            href={`/profile/${player.user_id}`}
                            className="font-extrabold text-xs text-white group-hover:text-amber-400 transition-colors truncate block"
                          >
                            {player.nome}
                          </Link>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            {player.apelido && <span>&quot;{player.apelido}&quot;</span>}
                            {player.posicao && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-bold">
                                {player.posicao}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Gols ou Pontos marcados ou Badge de Ouro */}
                      {player.goalsCount > 0 ? (
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono font-black text-[11px] shrink-0"
                          title={isVolei ? `${player.goalsCount} ponto(s) marcado(s)` : `${player.goalsCount} gol(s) marcado(s)`}
                        >
                          <span>{isVolei ? '🏐' : '⚽'}</span>
                          <span>{player.goalsCount}</span>
                        </div>
                      ) : (
                        <div className="text-amber-400 text-sm shrink-0" title="Campeão da Partida">
                          🥇
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                BOTÕES DE AÇÃO (WHATSAPP, CONFETES, VER DETALHES)
            ═══════════════════════════════════════════════════════════ */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              {/* Botão Compartilhar no WhatsApp */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.01 }}
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartilhar Campeão no WhatsApp</span>
              </motion.button>

              <div className="flex items-center gap-2">
                {/* Botão Soltar Mais Confetes */}
                <button
                  type="button"
                  onClick={triggerConfetti}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <PartyPopper className="w-4 h-4 text-amber-400" />
                  <span>Soltar Confetes 🎉</span>
                </button>

                {/* Botão Ver Partida Completa */}
                <Link
                  href={`/matches/${championData.matchId}`}
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <span>Ver Detalhes</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Lightbox para fotos ampliadas de atletas e emblema */}
      <ImageLightboxModal
        data={lightboxData}
        onClose={() => setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null))}
      />
    </div>
  );
};

