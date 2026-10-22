'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
import {
  X,
  Copy,
  CheckCircle2,
  QrCode,
  Smartphone,
  ShieldCheck,
  Upload,
  Send,
  DollarSign,
  Info,
  Building2,
  User,
  Sparkles,
  Wallet,
  Gift,
  Coins,
} from 'lucide-react';
import { Match, MatchParticipant } from '@/types/database';
import { LeaguePlayerWallet, CreditDestination } from '@/types/finance';
import { generatePixPayload, getPixQrCodeUrl } from '@/lib/pix';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import {
  getLeagueWallet,
  payMatchWithWallet,
  informMatchPayment,
  formatCurrency,
} from '@/lib/financeHelper';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participant?: MatchParticipant | null;
  onUpdate?: () => void;
}

export const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  isOpen,
  onClose,
  match,
  participant,
  onUpdate,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { canManageMatch } = useLeague();
  const isAdmin = isSuperAdmin || canManageMatch(match);
  const dragControls = useDragControls();

  // Chave PIX do organizador
  const [chavePix, setChavePix] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('FUTRESENHA');
  const [cidadeRecebedor, setCidadeRecebedor] = useState('RIO DE JANEIRO');

  const [copied, setCopied] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // Estados Financeiros por Liga
  const [wallet, setWallet] = useState<LeaguePlayerWallet | null>(null);
  const [isPayingWithWallet, setIsPayingWithWallet] = useState(false);
  const [informedAmount, setInformedAmount] = useState<string>(match?.valor ? match.valor.toString() : '0');
  const [creditDestination, setCreditDestination] = useState<CreditDestination>('wallet');
  const [isSubmittingInformed, setIsSubmittingInformed] = useState(false);

  const leagueId = match?.organization_id || match?.organization?.id;
  const caixinhaName = match?.organization?.caixinha_name || 'Caixinha da Resenha';
  const matchAmount = Number(match.valor || 0);

  // Carregar dados da carteira do jogador na liga ao abrir
  useEffect(() => {
    if (isOpen && user?.id && leagueId) {
      setInformedAmount(matchAmount.toString());
      getLeagueWallet(leagueId, user.id).then((w) => setWallet(w));
    }
  }, [isOpen, user?.id, leagueId, matchAmount]);

  // Carregar chave vinculada à partida ou salva no localStorage ao abrir
  useEffect(() => {
    if (isOpen) {
      if (match?.chave_pix) {
        setChavePix(match.chave_pix);
      } else if (typeof window !== 'undefined') {
        const savedKey = localStorage.getItem('futresenha_chave_pix');
        if (savedKey) setChavePix(savedKey);
      }

      if (match?.nome_recebedor_pix) {
        setNomeRecebedor(match.nome_recebedor_pix);
      } else if (typeof window !== 'undefined') {
        const savedName = localStorage.getItem('futresenha_nome_pix');
        if (savedName) setNomeRecebedor(savedName);
      }

      if (typeof window !== 'undefined') {
        const savedCity = localStorage.getItem('futresenha_cidade_pix');
        if (savedCity) setCidadeRecebedor(savedCity);
      }
    }
  }, [isOpen, match]);

  const handleSavePixConfig = async () => {
    if (!chavePix.trim()) {
      toast.error('Informe uma Chave PIX válida.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('futresenha_chave_pix', chavePix.trim());
      localStorage.setItem('futresenha_nome_pix', nomeRecebedor.trim());
      localStorage.setItem('futresenha_cidade_pix', cidadeRecebedor.trim());
    }

    if (match?.id) {
      const { error } = await supabase
        .from('matches')
        .update({
          chave_pix: chavePix.trim(),
          nome_recebedor_pix: nomeRecebedor.trim() || null,
        })
        .eq('id', match.id);

      if (error) {
        console.error('Erro ao salvar chave PIX na partida:', error);
      } else {
        match.chave_pix = chavePix.trim();
        match.nome_recebedor_pix = nomeRecebedor.trim() || null;
        if (onUpdate) onUpdate();
      }
    }

    setIsEditingKey(false);
    toast.success('Chave PIX salva e vinculada a esta partida com sucesso!');
  };

  const parsedInformed = parseFloat(informedAmount.replace(',', '.')) || matchAmount;
  const excessCredit = Math.max(0, parsedInformed - matchAmount);

  // Pagamento com saldo da carteira
  const handlePayWithWalletBalance = async () => {
    if (!user || !participant || !leagueId || isPayingWithWallet) return;

    if (participant.paid) {
      toast.error('Esta coleta já foi paga anteriormente.');
      return;
    }

    if (!wallet || wallet.saldo_disponivel < matchAmount) {
      toast.error(`Saldo insuficiente para pagar a coleta. Saldo disponível: ${formatCurrency(wallet?.saldo_disponivel || 0)}`);
      return;
    }

    setIsPayingWithWallet(true);
    const res = await payMatchWithWallet({
      matchId: match.id,
      leagueId: leagueId,
      userId: user.id,
      participantId: participant.id,
      valorPartida: matchAmount,
    });
    setIsPayingWithWallet(false);

    if (res.success) {
      const remaining = res.saldoRestante !== undefined ? res.saldoRestante : Math.max(0, (wallet?.saldo_disponivel || 0) - matchAmount);
      toast.success(`✓ Coleta paga com crédito da carteira! Saldo restante: ${formatCurrency(remaining)} 🏆`);
      if (onUpdate) onUpdate();
      onClose();
    } else {
      toast.error(res.error || 'Erro ao pagar com saldo da carteira.');
    }
  };

  // Gerar o Payload do PIX
  const pixPayload = useMemo(() => {
    if (!chavePix.trim()) return '';
    const playerName = participant?.user?.apelido || participant?.user?.nome || participant?.guest_name || user?.nome || 'JOGADOR';
    return generatePixPayload({
      key: chavePix.trim(),
      name: nomeRecebedor.trim() || 'FUTRESENHA',
      city: cidadeRecebedor.trim() || 'BRASIL',
      amount: parsedInformed > 0 ? parsedInformed : matchAmount,
      description: `MATCH ${match.titulo.substring(0, 15)}`,
      txid: `MATCH${match.id.substring(0, 8)}`,
    });
  }, [chavePix, nomeRecebedor, cidadeRecebedor, parsedInformed, matchAmount, match, participant, user]);

  const qrCodeUrl = useMemo(() => {
    if (!pixPayload) return '';
    return getPixQrCodeUrl(pixPayload, 260);
  }, [pixPayload]);

  const handleCopyPix = async () => {
    if (!pixPayload) {
      toast.error('Configure uma Chave PIX primeiro!');
      setIsEditingKey(true);
      return;
    }

    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast.success('Código PIX Copia e Cola copiado! Abra o app do seu banco.');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao copiar código PIX.');
    }
  };

  // Upload de Comprovante de Pagamento & Registro de Pagamento Informado
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !participant || !leagueId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10MB.');
      return;
    }

    setUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const filePath = `receipts/${match.id}/${user.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('match-media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Erro no upload de storage:', uploadError);
        toast.error('Erro ao enviar imagem. Você pode enviar o comprovante direto pelo WhatsApp!');
      } else {
        const { data: urlData } = supabase.storage.from('match-media').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;
        setProofUrl(publicUrl);

        // Registrar no sistema financeiro oficial (status pending para validação do Admin)
        const res = await informMatchPayment({
          matchId: match.id,
          leagueId: leagueId,
          userId: user.id,
          participantId: participant.id,
          valorPartida: matchAmount,
          valorInformado: parsedInformed,
          destinoExcedente: creditDestination,
          comprovanteUrl: publicUrl,
          userName: participant.user?.apelido || participant.user?.nome || participant.guest_name || user.nome,
          matchTitle: match.titulo,
        });

        if (res.success) {
          toast.success('Comprovante salvo com sucesso e enviado para conferência do Administrador! 🎉');
          if (onUpdate) onUpdate();
        } else {
          toast.error(res.error || 'Erro ao registrar no financeiro.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar comprovante.');
    } finally {
      setUploadingProof(false);
    }
  };

  // Enviar comprovante diretamente no WhatsApp do organizador
  const handleSendWhatsAppProof = async () => {
    let organizerPhone = match.organizer_whatsapp || null;

    if (!organizerPhone) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('whatsapp')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (adminProfile?.whatsapp) {
        organizerPhone = adminProfile.whatsapp;
      }
    }

    const cleanNum = organizerPhone ? organizerPhone.replace(/\D/g, '') : '';
    let targetPhone = cleanNum;
    if (cleanNum.length === 10 || cleanNum.length === 11) {
      targetPhone = `55${cleanNum}`;
    }

    const dateParts = match.data.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    const pName = participant?.user?.apelido || participant?.user?.nome || participant?.guest_name || user?.nome || 'Jogador';

    let msg = `Olá! Segue meu comprovante de pagamento da partida:\n\n`;
    msg += `⚽ *Partida:* ${match.titulo}\n`;
    msg += `📅 *Data:* ${formattedDate} às ${match.horario.substring(0, 5)}\n`;
    msg += `👤 *Jogador:* ${pName}\n`;
    msg += `💰 *Valor PAGO:* R$ ${parsedInformed.toFixed(2)}\n`;
    if (excessCredit > 0) {
      msg += `🎁 *Sobra de Crédito:* R$ ${excessCredit.toFixed(2)} (Destino: ${creditDestination === 'caixinha' ? caixinhaName : 'Meu Caixa'})\n`;
    }

    const currentProof = proofUrl || participant?.payment_proof_url;
    if (currentProof) {
      msg += `📄 *Link do Comprovante:* ${currentProof}\n`;
    }

    msg += `\nFavor confirmar minha taxa no sistema! Obrigado! 🚀`;

    const encodedText = encodeURIComponent(msg);
    const whatsappUrl = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
    toast.success('Redirecionando para o WhatsApp do organizador...');
  };

  if (!isOpen) return null;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          drag="y"
          dragControls={dragControls}
          dragConstraints={{ top: 0 }}
          dragElastic={0.15}
          dragListener={false}
          onDragEnd={handleDragEnd}
          className="relative z-10 bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-3xl w-full max-w-md max-h-[90dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Alça visual de arraste no mobile — DRAG HANDLE (somente aqui ativa o drag) */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            style={{ touchAction: 'none' }}
            className="pt-3 pb-2 sm:pt-2 sm:pb-1 flex justify-center cursor-grab active:cursor-grabbing shrink-0"
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* Botão Fechar com touch target confortável */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal PIX"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Conteúdo scrollável — isolado do drag */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-5 touch-pan-y"
            style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    Pagamento via PIX
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase border border-emerald-500/20">
                    0% Taxas
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                  {match.titulo}
                </p>
              </div>
            </div>

            {/* Se a coleta já estiver PAGA */}
            {participant?.paid && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-black text-emerald-800 dark:text-emerald-300 block">
                    ✓ Coleta da Partida PAGA
                  </span>
                  <span className="text-xs text-emerald-700/90 dark:text-emerald-400 font-medium">
                    Sua inscrição nesta partida já está confirmada e quitada.
                  </span>
                </div>
              </div>
            )}

            {/* Bloco COLETA DA PARTIDA & CARTEIRA DO MEMBRO (se não estiver paga) */}
            {!participant?.paid && matchAmount > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Sua Carteira nesta Liga
                    </span>
                  </div>
                  <strong className="text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(wallet?.saldo_disponivel || 0)}
                  </strong>
                </div>

                {wallet && wallet.saldo_disponivel >= matchAmount ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Você possui saldo suficiente em carteira para pagar esta coleta sem precisar fazer PIX!
                    </p>
                    <button
                      type="button"
                      disabled={isPayingWithWallet}
                      onClick={handlePayWithWalletBalance}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isPayingWithWallet
                          ? 'Processando pagamento...'
                          : `Pagar ${formatCurrency(matchAmount)} com Minha Carteira`}
                      </span>
                    </button>
                    <div className="text-[11px] text-center text-slate-400">
                      Saldo restante após o pagamento: <strong>{formatCurrency(wallet.saldo_disponivel - matchAmount)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-extrabold">
                      <span>⚠ Saldo insuficiente para pagar a coleta com a carteira</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between pt-1">
                      <span>Saldo disponível: <strong>{formatCurrency(wallet?.saldo_disponivel || 0)}</strong></span>
                      <span>Valor da coleta: <strong>{formatCurrency(matchAmount)}</strong></span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                      Faça o pagamento via PIX abaixo ou solicite crédito ao administrador da sua liga.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Card do Valor da Taxa & Input de Valor Informado */}
            <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    Valor da Inscrição
                  </span>
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 block">
                    R$ {matchAmount.toFixed(2)}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Direto ao Organizador</span>
                </div>
              </div>

              {/* Input de Valor Informado pelo Jogador */}
              <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Valor Pago no PIX (R$):
                  </label>
                  <span className="text-[10px] text-slate-400">
                    (Paguei valor diferente? Ajuste aqui)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs">
                    R$
                  </span>
                  <input
                    type="text"
                    value={informedAmount}
                    onChange={(e) => setInformedAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-xl text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Se o jogador informou valor superior */}
                {excessCredit > 0 && (
                  <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                        Crédito Excedente Calculado:
                      </span>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-black">
                        + {formatCurrency(excessCredit)}
                      </strong>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">
                      O que deseja fazer com seus {formatCurrency(excessCredit)} de crédito?
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCreditDestination('wallet')}
                        className={`p-2 rounded-lg border text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                          creditDestination === 'wallet'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Meu Caixa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditDestination('caixinha')}
                        className={`p-2 rounded-lg border text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                          creditDestination === 'caixinha'
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>{caixinhaName}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Configuração da Chave PIX (Se admin ou se chave vazia) */}
            {(!chavePix || isEditingKey) ? (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    <span>Configurar Chave PIX do Recebedor</span>
                  </span>
                  {chavePix && (
                    <button
                      type="button"
                      onClick={() => setIsEditingKey(false)}
                      className="text-xs font-bold text-amber-600 underline"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                      Chave PIX (CPF, Celular, E-mail ou Aleatória)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 21999999999 ou seu@email.com"
                      value={chavePix}
                      onChange={(e) => setChavePix(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                        Nome Recebedor
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: JOAO SILVA"
                        value={nomeRecebedor}
                        onChange={(e) => setNomeRecebedor(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: RIO DE JANEIRO"
                        value={cidadeRecebedor}
                        onChange={(e) => setCidadeRecebedor(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePixConfig}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all mt-1"
                  >
                    Salvar Chave PIX
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* QR CODE DISPLAY */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  {qrCodeUrl ? (
                    <div className="relative group p-2 bg-white rounded-2xl shadow-md border border-slate-200">
                      <img
                        src={qrCodeUrl}
                        alt="QR Code PIX"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                      Gerando QR Code...
                    </div>
                  )}

                  {/* Botão Principal PIX Copia e Cola */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={handleCopyPix}
                    className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                      copied
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                    }`}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>CÓDIGO PIX COPIADO! ✅</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span>COPIAR CÓDIGO PIX (COPIA E COLA)</span>
                      </>
                    )}
                  </motion.button>

                  {/* Informações do Recebedor */}
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-bold">{nomeRecebedor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-400">Chave: {chavePix}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsEditingKey(true)}
                          className="text-brand-500 hover:underline font-bold text-[10px]"
                        >
                          Alterar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* INSTRUÇÕES PASSO A PASSO */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                  <span className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-wider block">
                    Como Pagar pelo Banco:
                  </span>
                  <ol className="space-y-1.5 text-slate-600 dark:text-slate-300 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                      <span>Abra seu aplicativo de banco (Nubank, Itaú, Inter, etc.).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                      <span>Acesse a área <strong>PIX</strong> e escolha <strong>"PIX Copia e Cola"</strong>.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                      <span>Cole o código copiado acima e confirme o pagamento de <strong>R$ {parsedInformed.toFixed(2)}</strong>.</span>
                    </li>
                  </ol>
                </div>

                {/* ENVIO DE COMPROVANTE */}
                <div className="space-y-2 pt-1">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                    Enviar Comprovante de Pagamento:
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Botão Upload Imagem */}
                    <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700">
                      <Upload className="w-4 h-4 text-brand-500" />
                      <span>{uploadingProof ? 'Enviando...' : 'Anexar Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofUpload}
                        disabled={uploadingProof}
                        className="hidden"
                      />
                    </label>

                    {/* Botão Enviar WhatsApp */}
                    <button
                      type="button"
                      onClick={handleSendWhatsAppProof}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
                    >
                      <Send className="w-4 h-4" />
                      <span>Via WhatsApp</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
