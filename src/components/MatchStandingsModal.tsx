'use client';

import React, { useState, useEffect } from 'react';
import { Match, TeamStanding } from '@/types/database';
import { getMatchChampionData, MatchChampionResult } from '@/lib/championHelper';
import { TeamBadge } from '@/components/TeamBadge';
import {
  Trophy,
  X,
  Share2,
  Copy,
  Check,
  Crown,
  Calendar,
  MapPin,
  Table,
  ArrowLeft,
  Sparkles,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Ícone Oficial do WhatsApp em SVG
const WhatsAppOfficialIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface MatchStandingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  onOpenChampion?: () => void;
}

export const MatchStandingsModal: React.FC<MatchStandingsModalProps> = ({
  isOpen,
  onClose,
  match,
  onOpenChampion,
}) => {
  const [data, setData] = useState<MatchChampionResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Modo de visualização: 'table' (exibe tabela) ou 'share' (personalizar mensagem whatsapp)
  const [viewMode, setViewMode] = useState<'table' | 'share'>('table');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Carregar dados de classificação da partida
  useEffect(() => {
    if (!isOpen || !match) return;

    let isMounted = true;
    const loadStandings = async () => {
      setLoading(true);
      try {
        const result = await getMatchChampionData(match.id, match);
        if (isMounted) {
          setData(result);
          if (result) {
            setWhatsappMessage(buildDefaultWhatsappMessage(result, match));
          }
        }
      } catch (err) {
        console.error('Erro ao buscar classificação da partida:', err);
        toast.error('Erro ao carregar a classificação da partida.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadStandings();
    setViewMode('table');
    setCopied(false);

    return () => {
      isMounted = false;
    };
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  const standings = data?.allStandings || [];

  // Montar mensagem padrão organizada para o WhatsApp
  function buildDefaultWhatsappMessage(result: MatchChampionResult, currentMatch: Match): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const matchUrl = `${origin}/matches/${currentMatch.id}`;

    const dateFormatted = currentMatch.data
      ? (() => {
          const parts = currentMatch.data.split('-');
          return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : currentMatch.data;
        })()
      : '';

    const header = isVolei
      ? 'TABELA DE CLASSIFICAÇÃO FINAL (VÔLEI)'
      : 'TABELA DE CLASSIFICAÇÃO FINAL';

    const matchInfoLines = [
      `🏆 *${(currentMatch.titulo || 'PARTIDA').toUpperCase()}*`,
      dateFormatted
        ? `📅 ${dateFormatted}${currentMatch.horario ? ` às ${currentMatch.horario}` : ''}`
        : '',
      currentMatch.local ? `📍 ${currentMatch.local}` : '',
    ].filter(Boolean);

    const teamBlocks = result.allStandings.map((st, idx) => {
      const pos = idx + 1;
      const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '▫️';
      const pointsLabel = st.points === 1 ? 'ponto' : 'pontos';
      const sgFormatted = st.goalDifference > 0 ? `+${st.goalDifference}` : `${st.goalDifference}`;

      if (isVolei) {
        return [
          `${medal} *${pos}º lugar — ${st.teamName}*`,
          `⭐ ${st.points} ${pointsLabel}`,
          `Jogos: ${st.matchesPlayed} | Vitórias: ${st.wins} | Derrotas: ${st.losses}`,
          `Saldo de pontos: ${sgFormatted}`,
        ].join('\n');
      }

      return [
        `${medal} *${pos}º lugar — ${st.teamName}*`,
        `⭐ ${st.points} ${pointsLabel}`,
        `Jogos: ${st.matchesPlayed} | Vitórias: ${st.wins} | Empates: ${st.draws} | Derrotas: ${st.losses}`,
        `Saldo de gols: ${sgFormatted}`,
      ].join('\n');
    });

    const divider = '━━━━━━━━━━━━━━━━━━';

    return [
      header,
      '',
      matchInfoLines.join('\n'),
      '',
      teamBlocks.join('\n\n'),
      '',
      divider,
      '',
      '📲 *Quer conferir todos os detalhes?*',
      '',
      'Acesse o aplicativo e confira os lances, a artilharia e as informações completas da partida!',
      matchUrl,
    ].join('\n');
  }

  // Disparar envio no WhatsApp
  const handleSendWhatsApp = () => {
    if (!whatsappMessage.trim()) {
      toast.error('A mensagem não pode estar vazia.');
      return;
    }
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Abrindo WhatsApp para compartilhar a classificação...');
  };

  // Copiar mensagem para a área de transferência
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      toast.success('Mensagem copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar a mensagem.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop escuro com blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Container Principal do Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Barra Superior Esportiva */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

          {/* Cabeçalho */}
          <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 flex items-center justify-center shrink-0 shadow-xs">
                <Table className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {viewMode === 'table' ? 'Tabela de Classificação Final' : 'Personalizar Mensagem no WhatsApp'}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                  {match.titulo} • Partida Encerrada
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Corpo do Modal */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-xs font-bold">Calculando classificação final da partida...</span>
              </div>
            ) : viewMode === 'table' ? (
              /* MODO 1: TABELA DE CLASSIFICAÇÃO */
              <div className="space-y-4">
                {/* Banner Resumo da Partida */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-semibold">
                    {match.data && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        {match.data.split('-').reverse().join('/')}
                      </span>
                    )}
                    {match.local && (
                      <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                        {match.local}
                      </span>
                    )}
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                    Resultado Oficial
                  </span>
                </div>

                {/* Tabela de Classificação */}
                <div className="overflow-x-auto no-scrollbar scrollbar-none rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-left border-collapse min-w-[340px]">
                    <thead>
                      <tr className="bg-slate-100/75 dark:bg-slate-800/80 border-b border-slate-200/70 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-2 text-center w-10">POS</th>
                        <th className="py-2.5 px-2">TIME</th>
                        <th className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400 font-black">PTS</th>
                        <th className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400">V</th>
                        {!isVolei && <th className="py-2.5 px-2 text-center text-amber-500">E</th>}
                        <th className="py-2.5 px-2 text-center text-rose-500">D</th>
                        <th className="py-2.5 px-2 text-center">{isVolei ? 'SP' : 'SG'}</th>
                        <th className="py-2.5 px-2 text-center text-slate-400">J</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-xs">
                      {standings.map((st, idx) => {
                        const pos = idx + 1;
                        const isLeader = pos === 1 && st.points > 0;
                        return (
                          <tr
                            key={st.team}
                            className={`transition-colors ${
                              isLeader
                                ? 'bg-amber-500/[0.06] dark:bg-amber-500/[0.08]'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {/* Posição */}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`w-6 h-6 rounded-lg inline-flex items-center justify-center font-black text-xs ${
                                  pos === 1
                                    ? 'bg-amber-400 text-slate-950 shadow-xs ring-1 ring-amber-400/50'
                                    : pos === 2
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                                    : pos === 3
                                    ? 'bg-amber-700/25 text-amber-700 dark:text-amber-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}
                              >
                                {pos}º
                              </span>
                            </td>

                            {/* Time */}
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <TeamBadge
                                  teamInfo={{
                                    name: st.teamName,
                                    emoji: st.teamEmoji,
                                    badge_url: st.teamBadgeUrl,
                                    color: st.teamColor,
                                  }}
                                  size="xs"
                                  rounded="md"
                                  showBorder={false}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate block">
                                      {st.teamName}
                                    </span>
                                    {isLeader && (
                                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Pontos (PTS) */}
                            <td className="py-3 px-2 text-center">
                              <span className="inline-flex items-center justify-center min-w-[30px] py-1 px-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs sm:text-sm border border-emerald-500/25 shadow-2xs">
                                {st.points}
                              </span>
                            </td>

                            {/* Vitórias (V) */}
                            <td className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">
                              {st.wins}
                            </td>

                            {/* Empates (E) */}
                            {!isVolei && (
                              <td className="py-3 px-2 text-center text-amber-600 dark:text-amber-400 font-extrabold">
                                {st.draws}
                              </td>
                            )}

                            {/* Derrotas (D) */}
                            <td className="py-3 px-2 text-center text-rose-500 font-extrabold">
                              {st.losses}
                            </td>

                            {/* Saldo de Gols / Pontos (SG) */}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`font-black ${
                                  st.goalDifference > 0
                                    ? 'text-emerald-500'
                                    : st.goalDifference < 0
                                    ? 'text-rose-500'
                                    : 'text-slate-400'
                                }`}
                              >
                                {st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
                              </span>
                            </td>

                            {/* Jogos (J) */}
                            <td className="py-3 px-2 text-center text-slate-400 font-medium">
                              {st.matchesPlayed}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legenda simples */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-medium px-1">
                  <div className="flex items-center gap-3">
                    <span><strong className="text-emerald-500">PTS:</strong> Pontos</span>
                    <span><strong className="text-emerald-500">V:</strong> Vitórias</span>
                    {!isVolei && <span><strong className="text-amber-500">E:</strong> Empates</span>}
                    <span><strong className="text-rose-500">D:</strong> Derrotas</span>
                    <span><strong className="text-slate-700 dark:text-slate-300">{isVolei ? 'SP:' : 'SG:'}</strong> {isVolei ? 'Saldo Pontos' : 'Saldo Gols'}</span>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    Critérios: 1º Pontos • 2º Vitórias • 3º Saldo
                  </span>
                </div>
              </div>
            ) : (
              /* MODO 2: PERSONALIZAR E ENVIAR MENSAGEM DO WHATSAPP */
              <div className="space-y-3.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    Edite o texto abaixo livremente se desejar adicionar recados, brincadeiras da resenha ou destaques antes de enviar para o WhatsApp.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Texto da Mensagem:
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {whatsappMessage.length} caracteres
                    </span>
                  </div>

                  <textarea
                    rows={10}
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-y"
                    placeholder="Digite a mensagem personalizada..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com Botões de Ação */}
          <div className="p-4 sm:p-6 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {viewMode === 'table' ? (
              <>
                {/* Botão Ver Time Campeão (se disponível) */}
                {onOpenChampion && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenChampion();
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-extrabold text-xs transition-colors cursor-pointer border border-amber-500/25"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Ver Time Campeão 🏆</span>
                  </button>
                )}

                {/* Botão Compartilhar no WhatsApp com Ícone Oficial */}
                <button
                  type="button"
                  onClick={() => setViewMode('share')}
                  className="w-full sm:w-auto ml-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm shadow-md shadow-[#25d366]/25 hover:shadow-[#25d366]/40 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
                >
                  <WhatsAppOfficialIcon className="w-4 h-4" />
                  <span>Compartilhar no WhatsApp</span>
                </button>
              </>
            ) : (
              <>
                {/* Voltar para a tabela */}
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para a Tabela</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                  {/* Copiar texto */}
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>

                  {/* Enviar pelo WhatsApp */}
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm shadow-md shadow-[#25d366]/25 hover:shadow-[#25d366]/40 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
                  >
                    <WhatsAppOfficialIcon className="w-4 h-4" />
                    <span>Enviar para o WhatsApp</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
