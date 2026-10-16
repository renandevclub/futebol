'use client';

import React, { useState } from 'react';
import { Match } from '@/types/database';
import { X, Share2, Copy, Check, Tv, MessageCircle, Sparkles, Flame, Eye, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareLiveBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

export const ShareLiveBroadcastModal: React.FC<ShareLiveBroadcastModalProps> = ({
  isOpen,
  onClose,
  match,
}) => {
  const [copiedLink, setCopiedLink] = useState<'tv' | 'page' | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rls-sports.netlify.app';
  const tvBroadcastUrl = `${origin}/matches/${match.id}/tv`;
  const matchScoreboardUrl = `${origin}/matches/${match.id}?tab=scoreboard`;

  const dateFormatted = match.data
    ? (() => {
        const p = match.data.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : match.data;
      })()
    : 'Hoje';

  // Compartilhar no WhatsApp
  const handleShareToWhatsApp = () => {
    const text = `🔴 *TRANSMISSÃO AO VIVO DO PLACAR* ⚽\n\n🏆 *${match.titulo}*\n📍 *Local:* ${match.local}${match.endereco ? ` (${match.endereco})` : ''}\n📅 *Data:* ${dateFormatted} às ${match.horario ? match.horario.substring(0, 5) : '--:--'}h\n\n📲 *Acompanhe os gols, cronômetro e classificação em tempo real:*\n${tvBroadcastUrl}\n\n_Atualizações automáticas ao vivo sem precisar recarregar a página!_`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Copiar Link
  const handleCopyLink = async (type: 'tv' | 'page', url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(type);
      toast.success(
        type === 'tv'
          ? 'Link da Transmissão em Tela Cheia copiado!'
          : 'Link da página da partida copiado!'
      );
      setTimeout(() => setCopiedLink(null), 2500);
    } catch (e) {
      toast.error('Erro ao copiar link.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-6 text-white"
        >
          {/* Header do Modal */}
          <div className="relative px-5 pt-5 pb-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Transmissão Pública
                </div>
                <h3 className="text-base font-black text-white mt-0.5">
                  Compartilhar Placar Ao Vivo
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Card com Resumo da Partida */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
                  AO VIVO NA QUADRA
                </span>
              </div>
              <h4 className="text-sm font-black text-white">{match.titulo}</h4>
              <p className="text-xs text-slate-300">
                📍 {match.local} • 📅 {dateFormatted} às {match.horario ? match.horario.substring(0, 5) : '--:--'}h
              </p>
              <div className="pt-1 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Página pública em modo somente leitura (sem permissão de edição).</span>
              </div>
            </div>

            {/* Botão de Envio Direto no WhatsApp */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={handleShareToWhatsApp}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm shadow-lg shadow-[#25d366]/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer group"
            >
              <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Compartilhar no WhatsApp</span>
            </motion.button>

            {/* Opções de Links Diretos para Copiar */}
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
                Ou Copie o Link Direto:
              </span>

              {/* Link 1: Modo Telão / Transmissão */}
              <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/70 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">Modo Telão / Transmissão</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate font-mono mt-0.5">
                    {tvBroadcastUrl}
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleCopyLink('tv', tvBroadcastUrl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedLink === 'tv'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {copiedLink === 'tv' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink === 'tv' ? 'Copiado!' : 'Copiar'}</span>
                </motion.button>
              </div>

              {/* Link 2: Página da Partida */}
              <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/70 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200">Página da Partida</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate font-mono mt-0.5">
                    {matchScoreboardUrl}
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleCopyLink('page', matchScoreboardUrl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    copiedLink === 'page'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {copiedLink === 'page' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink === 'page' ? 'Copiado!' : 'Copiar'}</span>
                </motion.button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
