'use client';

import { motion } from 'framer-motion';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageSquare,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
  Smartphone,
} from 'lucide-react';
import { Match, MatchParticipant } from '@/types/database';
import { generatePixPayload } from '@/lib/pix';
import { toast } from 'sonner';

interface WhatsAppNotifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participants: MatchParticipant[];
  initialParticipantId?: string | null;
}

type MessageTemplateType = 'cobranca' | 'lembrete' | 'custom';

export const WhatsAppNotifierModal: React.FC<WhatsAppNotifierModalProps> = ({
  isOpen,
  onClose,
  match,
  participants,
  initialParticipantId = null,
}) => {
  const [templateType, setTemplateType] = useState<MessageTemplateType>('cobranca');
  const [chavePix, setChavePix] = useState('');
  const [customText, setCustomText] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');

  useEffect(() => {
    if (isOpen) {
      if (match?.chave_pix) {
        setChavePix(match.chave_pix);
      } else if (typeof window !== 'undefined') {
        const savedKey = localStorage.getItem('futresenha_chave_pix');
        if (savedKey) setChavePix(savedKey);
      }
    }
  }, [isOpen, match]);

  if (!isOpen) return null;

  const pricePerParticipant = Number(match.valor || 0);

  // Formatar data em PT-BR
  const dateParts = match.data.split('-');
  const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  const formattedTime = match.horario.substring(0, 5);

  // Sanitizar número do WhatsApp para formato internacional wa.me/55...
  const formatPhoneNumber = (phoneRaw?: string | null) => {
    if (!phoneRaw) return null;
    const cleanNum = phoneRaw.replace(/\D/g, '');
    if (!cleanNum) return null;

    // Se não tiver DDD/DDI, adicionar 55 (Brasil)
    if (cleanNum.length === 10 || cleanNum.length === 11) {
      return `55${cleanNum}`;
    }
    return cleanNum;
  };

  // Gerar o texto final da mensagem para um participante específico
  const buildMessageText = (p: MatchParticipant) => {
    const nome = p.user?.apelido || p.user?.nome || p.guest_name || 'Jogador(a)';

    if (templateType === 'cobranca') {
      let msg = `Olá, ${nome}! Tudo bem?\n\n`;
      msg += `Referente à partida *${match.titulo}*:\n`;
      msg += `📅 *Data:* ${formattedDate} às ${formattedTime}\n`;
      msg += `📍 *Local:* ${match.local}\n`;
      msg += `💰 *Valor:* R$ ${pricePerParticipant.toFixed(2)}\n\n`;
      msg += `Consta no sistema que a sua taxa de inscrição ainda está *PENDENTE* ⏳.\n`;

      if (chavePix.trim()) {
        msg += `\n🔑 *Chave PIX:* ${chavePix.trim()}\n`;

        // Gerar código PIX Copia e Cola oficial se houver valor
        if (pricePerParticipant > 0) {
          const payload = generatePixPayload({
            key: chavePix.trim(),
            name: 'FUTRESENHA',
            city: 'BRASIL',
            amount: pricePerParticipant,
            description: `MATCH ${match.titulo.substring(0, 15)}`,
          });
          msg += `\n📋 *PIX Copia e Cola:*\n\`${payload}\`\n`;
        }
      }

      msg += `\nApós realizar o pagamento, favor enviar o comprovante por aqui. Muito obrigado! ⚽✨`;
      return msg;
    }

    if (templateType === 'lembrete') {
      let msg = `Olá, ${nome}! ⚽ Passando para lembrar da nossa partida de futebol!\n\n`;
      msg += `*${match.titulo}*\n`;
      msg += `📅 *Data:* ${formattedDate} às ${formattedTime}\n`;
      msg += `📍 *Local:* ${match.local}\n`;
      if (match.endereco) {
        msg += `🗺️ *Endereço:* ${match.endereco}\n`;
      }
      msg += `\nContamos com sua presença! Chegue com alguns minutos de antecedência. 🚀`;
      return msg;
    }

    // Custom
    let msg = customText
      .replace(/{nome}/gi, nome)
      .replace(/{partida}/gi, match.titulo)
      .replace(/{data}/gi, formattedDate)
      .replace(/{horario}/gi, formattedTime)
      .replace(/{local}/gi, match.local)
      .replace(/{valor}/gi, `R$ ${pricePerParticipant.toFixed(2)}`);

    if (!msg.trim()) {
      msg = `Olá ${nome}! Notificação sobre a partida *${match.titulo}* no dia ${formattedDate}.`;
    }

    return msg;
  };

  // Enviar WhatsApp para um participante
  const handleSendWhatsApp = (p: MatchParticipant) => {
    const rawPhone = p.user?.whatsapp;
    const cleanPhone = formatPhoneNumber(rawPhone);

    if (!cleanPhone) {
      toast.error(
        `O participante ${p.user?.nome || 'selecionado'} não cadastrou o número de WhatsApp no perfil.`
      );
      return;
    }

    const messageText = buildMessageText(p);
    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
    toast.success(`Abrindo WhatsApp para ${p.user?.nome || 'participante'}...`);
  };

  // Filtrar participantes
  const filteredParticipants = participants.filter((p) => {
    if (filter === 'pending') return !p.paid;
    if (filter === 'paid') return p.paid;
    return true;
  });

  const paidCount = participants.filter((p) => p.paid).length;
  const pendingCount = participants.filter((p) => !p.paid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 shadow-2xl relative space-y-4">
        {/* Botão Fechar */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              Disparar Mensagens WhatsApp
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {match.titulo} • Avisos & Cobranças
            </p>
          </div>
        </div>

        {/* SELEÇÃO DO MODELO DE MENSAGEM */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase text-slate-400 block">
            Selecione o Modelo da Mensagem
          </label>
          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="button"
              onClick={() => setTemplateType('cobranca')}
              className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                templateType === 'cobranca'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-500'
              }`}
            >
              <DollarSign className="w-4 h-4 mb-1" />
              <span className="font-extrabold text-xs block">Cobrança</span>
              <span className="text-[10px] opacity-75 font-medium block">Pagamento pendente</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="button"
              onClick={() => setTemplateType('lembrete')}
              className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                templateType === 'lembrete'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-500'
              }`}
            >
              <Calendar className="w-4 h-4 mb-1" />
              <span className="font-extrabold text-xs block">Lembrete</span>
              <span className="text-[10px] opacity-75 font-medium block">Data, hora & local</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="button"
              onClick={() => setTemplateType('custom')}
              className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                templateType === 'custom'
                  ? 'bg-brand-500/10 border-brand-500/40 text-brand-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-500'
              }`}
            >
              <MessageSquare className="w-4 h-4 mb-1" />
              <span className="font-extrabold text-xs block">Personalizado</span>
              <span className="text-[10px] opacity-75 font-medium block">Texto livre</span>
            </motion.button>
          </div>
        </div>

        {/* OPÇÕES ADICIONAIS DO MODELO */}
        {templateType === 'cobranca' && (
          <div className="space-y-1 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/20">
            <label className="text-xs font-extrabold text-amber-700 dark:text-amber-400 block">
              Chave PIX para Cobrança (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ex: CPF, Telefone, E-mail ou Chave Aleatória..."
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
            />
          </div>
        )}

        {templateType === 'custom' && (
          <div className="space-y-1.5 bg-brand-500/5 p-3 rounded-2xl border border-brand-500/20">
            <label className="text-xs font-extrabold text-brand-600 dark:text-brand-400 block">
              Escreva sua mensagem customizada:
            </label>
            <textarea
              rows={3}
              placeholder="Digite o texto. Dica: use {nome}, {partida}, {data}, {horario}, {local}, {valor}..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-brand-500/30 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Variáveis automáticas disponíveis: <code className="text-brand-500 font-bold">{'{nome}'}</code>, <code className="text-brand-500 font-bold">{'{partida}'}</code>, <code className="text-brand-500 font-bold">{'{data}'}</code>, <code className="text-brand-500 font-bold">{'{local}'}</code>, <code className="text-brand-500 font-bold">{'{valor}'}</code>
            </p>
          </div>
        )}

        {/* PRÉVIA DO TEXTO DA MENSAGEM */}
        <div className="space-y-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
            Prévia da Mensagem Gerada:
          </span>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
            {buildMessageText(filteredParticipants[0] || ({ user: { nome: 'Participante' } } as MatchParticipant))}
          </p>
        </div>

        {/* LISTA DE PARTICIPANTES PARA ENVIO */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-500" />
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                Enviar para os Participantes
              </h3>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold w-full sm:w-auto justify-between">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Todos ({participants.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  filter === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Pendentes ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('paid')}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  filter === 'paid'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Pagos ({paidCount})
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
            {filteredParticipants.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                Nenhum participante encontrado neste filtro.
              </div>
            ) : (
              filteredParticipants.map((p) => {
                const name = p.user?.apelido
                  ? `${p.user.nome} (${p.user.apelido})`
                  : p.user?.nome || p.guest_name || 'Jogador';
                const hasPhone = Boolean(p.user?.whatsapp);

                return (
                  <div
                    key={p.id}
                    className="p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                        {p.user?.avatar_url ? (
                          <img src={p.user.avatar_url} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          (p.user?.nome || p.guest_name)?.charAt(0).toUpperCase() || 'J'
                        )}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                          {name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {p.user?.whatsapp ? p.user.whatsapp : 'Sem nº cadastrado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.paid ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Pago</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Pendente</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(p)}
                        className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all shadow-sm flex items-center gap-1.5 ${
                          hasPhone
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                        title={hasPhone ? 'Enviar mensagem no WhatsApp' : 'Nenhum número de WhatsApp cadastrado'}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Enviar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
