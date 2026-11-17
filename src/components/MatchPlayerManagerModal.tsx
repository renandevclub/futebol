'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Match, MatchParticipant, Profile } from '@/types/database';
import {
  addLeagueMemberToMatch,
  addMultipleLeagueMembersToMatch,
  addGuestPlayerToMatch,
  addMultipleGuestPlayersToMatch,
  updatePlayerName,
  removePlayerFromMatch,
  toggleParticipantPaidStatus,
  getLeagueDetailedPlayers,
  getParticipantDisplayName,
  getParticipantNickname,
  isGuestParticipant,
  LeaguePlayerItem,
} from '@/lib/matchPlayersHelper';
import {
  X,
  UserPlus,
  Users,
  Edit3,
  Trash2,
  Check,
  Plus,
  Sparkles,
  Search,
  ListPlus,
  Shield,
  AlertCircle,
  CheckCircle2,
  Phone,
  UserCheck,
  CheckSquare,
  Square,
  Crown,
  DollarSign,
  Clock,
  Sparkle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface MatchPlayerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participants: MatchParticipant[];
  onUpdate: () => void;
}

type ActiveTab = 'participants' | 'league_players' | 'guest';

export const MatchPlayerManagerModal: React.FC<MatchPlayerManagerModalProps> = ({
  isOpen,
  onClose,
  match,
  participants,
  onUpdate,
}) => {
  // Aba ativa: 'participants' (inscritos), 'league_players' (jogadores da liga), 'guest' (adicionar convidado)
  const [activeTab, setActiveTab] = useState<ActiveTab>('participants');

  // Jogadores da Liga
  const [leaguePlayers, setLeaguePlayers] = useState<LeaguePlayerItem[]>([]);
  const [isLoadingLeaguePlayers, setIsLoadingLeaguePlayers] = useState(false);
  const [leagueSearchQuery, setLeagueSearchQuery] = useState('');
  const [leagueFilterMode, setLeagueFilterMode] = useState<'all' | 'available' | 'joined'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Jogador Convidado (Avulso / Sem Cadastro)
  const [guestName, setGuestName] = useState('');
  const [guestBatchText, setGuestBatchText] = useState('');
  const [guestMode, setGuestMode] = useState<'single' | 'batch'>('single');

  // Busca na lista de inscritos
  const [participantsSearchQuery, setParticipantsSearchQuery] = useState('');

  // Edição inline de nome
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Estado geral de envio
  const [isSubmitting, setIsSubmitting] = useState(false);

  const guestInputRef = useRef<HTMLInputElement>(null);

  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  const totalSlots = match.limite_participantes || match.num_times * match.jogadores_por_time;
  const remainingSlots = Math.max(0, totalSlots - participants.length);
  const isMatchFull = participants.length >= totalSlots;

  // Carregar todos os membros da liga
  useEffect(() => {
    if (isOpen && match.organization_id) {
      let isMounted = true;
      setIsLoadingLeaguePlayers(true);

      void (async () => {
        try {
          const players = await getLeagueDetailedPlayers(match.organization_id!);
          if (isMounted) {
            setLeaguePlayers(players);
          }
        } catch (err) {
          console.error('Erro ao carregar membros da liga:', err);
        } finally {
          if (isMounted) {
            setIsLoadingLeaguePlayers(false);
          }
        }
      })();

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, match.organization_id]);

  // Foco no input de convidado ao abrir aba de convidado
  useEffect(() => {
    if (activeTab === 'guest' && guestMode === 'single') {
      setTimeout(() => {
        guestInputRef.current?.focus();
      }, 150);
    }
  }, [activeTab, guestMode]);

  // Set de IDs dos usuários já inscritos na partida
  const joinedUserIdsSet = useMemo(() => {
    return new Set(participants.map((p) => p.user_id).filter(Boolean) as string[]);
  }, [participants]);

  // Jogadores da Liga disponíveis (que ainda não estão na partida)
  const availableLeaguePlayers = useMemo(() => {
    return leaguePlayers.filter((p) => !joinedUserIdsSet.has(p.id));
  }, [leaguePlayers, joinedUserIdsSet]);

  // Filtrar jogadores da liga por busca e status
  const filteredLeaguePlayers = useMemo(() => {
    let list = leaguePlayers;

    if (leagueFilterMode === 'available') {
      list = list.filter((p) => !joinedUserIdsSet.has(p.id));
    } else if (leagueFilterMode === 'joined') {
      list = list.filter((p) => joinedUserIdsSet.has(p.id));
    }

    if (!leagueSearchQuery.trim()) return list;

    const q = leagueSearchQuery.toLowerCase().trim();
    return list.filter((p) => {
      const name = (p.nome || '').toLowerCase();
      const nickname = (p.apelido || '').toLowerCase();
      const pos = isVolei
        ? (p.volei_position || '').toLowerCase()
        : (p.futebol_position || p.posicao || '').toLowerCase();
      return name.includes(q) || nickname.includes(q) || pos.includes(q);
    });
  }, [leaguePlayers, leagueFilterMode, leagueSearchQuery, joinedUserIdsSet, isVolei]);

  // Filtrar inscritos na partida por busca
  const filteredParticipants = useMemo(() => {
    if (!participantsSearchQuery.trim()) return participants;
    const q = participantsSearchQuery.toLowerCase().trim();
    return participants.filter((p) => {
      const name = getParticipantDisplayName(p).toLowerCase();
      const nick = (getParticipantNickname(p) || '').toLowerCase();
      return name.includes(q) || nick.includes(q);
    });
  }, [participants, participantsSearchQuery]);

  // Estatísticas de participantes
  const stats = useMemo(() => {
    const total = participants.length;
    const membersCount = participants.filter((p) => !isGuestParticipant(p)).length;
    const guestsCount = participants.filter((p) => isGuestParticipant(p)).length;
    const paidCount = participants.filter((p) => p.paid).length;
    return { total, membersCount, guestsCount, paidCount };
  }, [participants]);

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // AÇÕES COM JOGADORES DA LIGA
  // ═══════════════════════════════════════════════════════════════════════════

  // Adicionar um membro da liga individual
  const handleAddLeagueMember = async (player: LeaguePlayerItem) => {
    if (isMatchFull) {
      toast.error('A partida já atingiu o limite de vagas disponíveis!');
      return;
    }

    if (joinedUserIdsSet.has(player.id)) {
      toast.error(`"${player.nome}" já está inscrito nesta partida!`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await addLeagueMemberToMatch({
        matchId: match.id,
        leagueId: match.organization_id,
        userId: player.id,
      });

      if (res.success) {
        toast.success(`"${player.nome}" adicionado à partida! ⚽`);
        onUpdate();
        // Remove da lista de selecionados se estiver
        setSelectedUserIds((prev) => prev.filter((id) => id !== player.id));
      } else {
        toast.error(res.error || 'Erro ao adicionar jogador.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao adicionar jogador da liga.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar seleção de um membro da liga para adição múltipla
  const toggleSelectUser = (userId: string) => {
    if (joinedUserIdsSet.has(userId)) return;

    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        // Não permitir selecionar mais do que as vagas restantes
        if (prev.length >= remainingSlots) {
          toast.warning(`Só restam ${remainingSlots} vaga(s) nesta partida.`);
          return prev;
        }
        return [...prev, userId];
      }
    });
  };

  // Selecionar todos os disponíveis (respeitando o limite de vagas)
  const handleSelectAllAvailable = () => {
    const availableIds = availableLeaguePlayers.map((p) => p.id);
    if (selectedUserIds.length === availableIds.length) {
      setSelectedUserIds([]);
      return;
    }

    const toSelect = availableIds.slice(0, remainingSlots);
    if (toSelect.length < availableIds.length) {
      toast.info(`Selecionando os primeiros ${toSelect.length} jogadores devido ao limite de vagas.`);
    }
    setSelectedUserIds(toSelect);
  };

  // Adicionar todos os membros da liga selecionados
  const handleAddSelectedLeagueMembers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Nenhum jogador selecionado.');
      return;
    }

    if (isMatchFull) {
      toast.error('A partida já atingiu o limite de vagas!');
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading(`Adicionando ${selectedUserIds.length} jogador(es) à partida...`);

      const res = await addMultipleLeagueMembersToMatch({
        matchId: match.id,
        leagueId: match.organization_id,
        userIds: selectedUserIds,
      });

      if (res.success) {
        toast.success(
          `${res.addedCount} jogador(es) adicionado(s) com sucesso!${
            res.existingCount > 0 ? ` (${res.existingCount} já estavam na lista)` : ''
          }`,
          { id: toastId }
        );
        setSelectedUserIds([]);
        onUpdate();
        setActiveTab('participants');
      } else {
        toast.error(
          'Erro ao adicionar jogadores: ' + (res.errors.join(', ') || 'Verifique as permissões.'),
          { id: toastId }
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao adicionar jogadores selecionados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AÇÕES COM JOGADORES CONVIDADOS (SEM CADASTRO / AVULSOS)
  // ═══════════════════════════════════════════════════════════════════════════

  // Adicionar um convidado individual
  const handleAddSingleGuest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = guestName.trim();
    if (!name) {
      toast.error('Digite o nome do jogador convidado.');
      return;
    }

    if (isMatchFull) {
      toast.error('A partida já atingiu o limite máximo de vagas!');
      return;
    }

    // Verificar se já existe alguém com esse nome na partida
    const nameExists = participants.some(
      (p) => getParticipantDisplayName(p).toLowerCase() === name.toLowerCase()
    );
    if (nameExists) {
      toast.error(`Já existe um jogador chamado "${name}" inscrito nesta partida.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await addGuestPlayerToMatch({
        matchId: match.id,
        guestName: name,
      });

      if (res.success) {
        toast.success(res.message || `Convidado "${name}" adicionado à partida! ⚽`);
        setGuestName('');
        onUpdate();
        setActiveTab('participants');
      } else {
        toast.error(res.error || 'Erro ao adicionar jogador convidado.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao adicionar jogador convidado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adicionar múltiplos convidados de uma vez (lista colada)
  const handleAddBatchGuests = async () => {
    const raw = guestBatchText.trim();
    if (!raw) {
      toast.error('Informe pelo menos um nome de convidado.');
      return;
    }

    if (isMatchFull) {
      toast.error('A partida já atingiu o limite de vagas!');
      return;
    }

    const names = raw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      toast.error('Nenhum nome válido encontrado.');
      return;
    }

    if (names.length > remainingSlots) {
      toast.warning(
        `Você colou ${names.length} nomes, mas só restam ${remainingSlots} vaga(s). Adicionando os primeiros ${remainingSlots}.`
      );
    }

    const namesToAdd = names.slice(0, remainingSlots);

    try {
      setIsSubmitting(true);
      const toastId = toast.loading(`Cadastrando ${namesToAdd.length} convidados na partida...`);

      const res = await addMultipleGuestPlayersToMatch({
        matchId: match.id,
        guestNames: namesToAdd,
      });

      if (res.success) {
        toast.success(
          `${res.addedCount} convidado(s) adicionado(s) com sucesso!${
            res.existingCount > 0 ? ` (${res.existingCount} já estavam na lista)` : ''
          }`,
          { id: toastId }
        );
        setGuestBatchText('');
        onUpdate();
        setActiveTab('participants');
      } else {
        toast.error('Não foi possível cadastrar os convidados: ' + (res.errors.join(', ') || 'Erro'), {
          id: toastId,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao cadastrar convidados em lote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AÇÕES DE EDIÇÃO, PAGAMENTO E REMOÇÃO DE PARTICIPANTES
  // ═══════════════════════════════════════════════════════════════════════════

  const startEditName = (p: MatchParticipant) => {
    setEditingParticipantId(p.id);
    setEditingNameValue(getParticipantDisplayName(p));
  };

  const handleSaveEditName = async (participant: MatchParticipant) => {
    const newName = editingNameValue.trim();
    if (!newName) {
      toast.error('O nome não pode ficar vazio.');
      return;
    }

    if (newName === getParticipantDisplayName(participant)) {
      setEditingParticipantId(null);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updatePlayerName({
        matchId: match.id,
        participantId: participant.id,
        profileId: participant.user_id,
        newName: newName,
        isGuest: isGuestParticipant(participant),
      });

      if (res.success) {
        toast.success(`Nome atualizado para "${newName}"! ✅`);
        setEditingParticipantId(null);
        onUpdate();
      } else {
        toast.error(res.error || 'Erro ao atualizar nome.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao atualizar nome do jogador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePaid = async (participant: MatchParticipant) => {
    const newPaid = !participant.paid;
    try {
      const res = await toggleParticipantPaidStatus({
        matchId: match.id,
        participantId: participant.id,
        newPaid: newPaid,
      });

      if (res.success) {
        toast.success(
          newPaid
            ? `Pagamento de "${getParticipantDisplayName(participant)}" confirmado! ✅`
            : `Pagamento marcado como pendente ⏳`
        );
        onUpdate();
      } else {
        toast.error(res.error || 'Erro ao alternar status de pagamento.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao atualizar pagamento.');
    }
  };

  const handleRemovePlayer = async (participant: MatchParticipant) => {
    const name = getParticipantDisplayName(participant);
    if (!confirm(`Deseja remover "${name}" da lista desta partida?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await removePlayerFromMatch({
        matchId: match.id,
        participantId: participant.id,
      });

      if (res.success) {
        toast.success(`"${name}" removido da partida com sucesso.`);
        onUpdate();
      } else {
        toast.error(res.error || 'Erro ao remover jogador.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao remover jogador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper para obter cargo formatado na liga
  const formatRoleInLeague = (role?: string) => {
    if (role === 'owner') return '👑 Criador';
    if (role === 'admin') return '🛡️ Organizador';
    if (role === 'moderator') return '⭐ Moderador';
    return '⚽ Atleta';
  };

  // Helper para obter posição formatada
  const formatPosition = (player: LeaguePlayerItem) => {
    if (isVolei) {
      return player.volei_position || 'Vôlei';
    }
    return player.futebol_position || player.posicao || 'Futebol';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CABEÇALHO DO MODAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-md ${
                isVolei ? 'bg-amber-500 shadow-amber-500/25' : 'bg-emerald-500 shadow-emerald-500/25'
              }`}
            >
              {isVolei ? '🏐' : '⚽'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isVolei ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                >
                  Gerenciamento da Partida
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isMatchFull
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {participants.length} / {totalSlots} {isMatchFull ? '• Lotada' : 'Inscritos'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {match.titulo || 'Lista de Jogadores da Partida'}
              </h2>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ABAS DE NAVEGAÇÃO PRINCIPAIS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-5 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            className={`py-3 px-3 sm:px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'participants'
                ? isVolei
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Inscritos na Partida</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold">
              {participants.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('league_players')}
            className={`py-3 px-3 sm:px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'league_players'
                ? isVolei
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Jogadores da Liga</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold">
              {leaguePlayers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guest')}
            className={`py-3 px-3 sm:px-4 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'guest'
                ? isVolei
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Convidado</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold">
              Sem Conta
            </span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CORPO DO MODAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4">

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ABA 1: INSCRITOS NA PARTIDA */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'participants' && (
            <div className="space-y-4">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Confirmados
                  </span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {stats.total} <span className="text-xs text-slate-400 font-normal">/ {totalSlots}</span>
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Membros da Liga
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {stats.membersCount}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    Convidados Avulsos
                  </span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400">
                    {stats.guestsCount}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                    Pagos Confirmados
                  </span>
                  <span className="text-base font-black text-blue-600 dark:text-blue-400">
                    {stats.paidCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
                  </span>
                </div>
              </div>

              {/* Botões Rápidos de Adição */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Adicionar novos jogadores:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('league_players')}
                    disabled={isMatchFull}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>+ Da Liga ({availableLeaguePlayers.length} livres)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('guest')}
                    disabled={isMatchFull}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Convidado Avulso</span>
                  </button>
                </div>
              </div>

              {/* Barra de Busca de Inscritos */}
              {participants.length > 5 && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={participantsSearchQuery}
                    onChange={(e) => setParticipantsSearchQuery(e.target.value)}
                    placeholder="Buscar jogador inscrito por nome..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Lista Numerada de Inscritos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-500" />
                    <span>Jogadores Confirmados ({filteredParticipants.length})</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {isMatchFull ? (
                      <span className="text-red-500 font-black">Partida Lotada</span>
                    ) : (
                      `${remainingSlots} vaga(s) restante(s)`
                    )}
                  </span>
                </div>

                {filteredParticipants.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {participantsSearchQuery
                        ? 'Nenhum jogador encontrado com essa busca.'
                        : 'Nenhum jogador inscrito nesta partida ainda.'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Clique em <strong>+ Da Liga</strong> ou <strong>+ Convidado</strong> acima para adicionar participantes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredParticipants.map((p, index) => {
                      const isEditingThis = editingParticipantId === p.id;
                      const displayName = getParticipantDisplayName(p);
                      const nickname = getParticipantNickname(p);
                      const isGuest = isGuestParticipant(p);

                      return (
                        <div
                          key={p.id}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                        >
                          {/* Número, Foto e Nome */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                              {index + 1}
                            </span>

                            {/* Avatar do Jogador */}
                            <div className="relative shrink-0">
                              {p.user?.avatar_url ? (
                                <Image
                                  src={p.user.avatar_url}
                                  alt={displayName}
                                  width={36}
                                  height={36}
                                  unoptimized={
                                    p.user.avatar_url.startsWith('blob:') ||
                                    p.user.avatar_url.startsWith('data:')
                                  }
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white ${
                                    isGuest
                                      ? 'bg-amber-500 border border-amber-600'
                                      : 'bg-emerald-500 border border-emerald-600'
                                  }`}
                                >
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            {/* Nome e Badges */}
                            <div className="min-w-0 flex-1">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editingNameValue}
                                    onChange={(e) => setEditingNameValue(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditName(p);
                                      if (e.key === 'Escape') setEditingParticipantId(null);
                                    }}
                                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-emerald-500 rounded-lg text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditName(p)}
                                    disabled={isSubmitting}
                                    className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shrink-0 cursor-pointer"
                                    title="Salvar"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingParticipantId(null)}
                                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors shrink-0 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {p.user_id ? (
                                      <Link
                                        href={`/profile/${p.user_id}`}
                                        className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-emerald-500 truncate"
                                      >
                                        {displayName}
                                      </Link>
                                    ) : (
                                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                        {displayName}
                                      </span>
                                    )}

                                    {nickname && (
                                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                        ({nickname})
                                      </span>
                                    )}

                                    {/* BADGE DE IDENTIFICAÇÃO: MEMBRO VS CONVIDADO */}
                                    {isGuest ? (
                                      <span
                                        className="text-[10px] px-2 py-0.5 rounded-md font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0 flex items-center gap-1"
                                        title="Jogador convidado avulso (sem cadastro no aplicativo)"
                                      >
                                        <span>Convidado</span>
                                        <span className="opacity-70 text-[9px] font-normal hidden sm:inline">(Sem conta)</span>
                                      </span>
                                    ) : (
                                      <span
                                        className="text-[10px] px-2 py-0.5 rounded-md font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0 flex items-center gap-1"
                                        title="Jogador membro cadastrado na liga"
                                      >
                                        <span>Membro</span>
                                        <Shield className="w-2.5 h-2.5" />
                                      </span>
                                    )}
                                  </div>

                                  {/* Posição ou Time */}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {p.team != null && (
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                        Time {p.team + 1}
                                      </span>
                                    )}
                                    {p.user?.whatsapp && (
                                      <a
                                        href={`https://api.whatsapp.com/send?phone=${p.user.whatsapp.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                                        title="Abrir WhatsApp"
                                      >
                                        <Phone className="w-2.5 h-2.5" />
                                        <span>WhatsApp</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ações: Status de Pagamento, Editar e Excluir */}
                          {!isEditingThis && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Botão de Pagamento com Alternância Rápida */}
                              <button
                                type="button"
                                onClick={() => handleTogglePaid(p)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                                  p.paid
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                }`}
                                title="Clique para alternar status de pagamento"
                              >
                                {p.paid ? (
                                  <>
                                    <span>Pago</span>
                                    <Check className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    <span>Pendente</span>
                                    <Clock className="w-3 h-3" />
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditName(p)}
                                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Editar Nome"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemovePlayer(p)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Remover da Partida"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ABA 2: LISTA COMPLETA DE JOGADORES DA LIGA */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'league_players' && (
            <div className="space-y-4">
              {/* Barra de Filtros e Busca */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={leagueSearchQuery}
                    onChange={(e) => setLeagueSearchQuery(e.target.value)}
                    placeholder="Buscar atleta por nome, apelido ou posição..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLeagueFilterMode('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        leagueFilterMode === 'all'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Todos ({leaguePlayers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeagueFilterMode('available')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        leagueFilterMode === 'available'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Disponíveis ({availableLeaguePlayers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeagueFilterMode('joined')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        leagueFilterMode === 'joined'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Já na Partida ({leaguePlayers.length - availableLeaguePlayers.length})
                    </button>
                  </div>

                  {/* Seleção em lote */}
                  {availableLeaguePlayers.length > 0 && !isMatchFull && (
                    <button
                      type="button"
                      onClick={handleSelectAllAvailable}
                      className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {selectedUserIds.length === availableLeaguePlayers.slice(0, remainingSlots).length &&
                      selectedUserIds.length > 0 ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Desmarcar Todos</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>Selecionar Disponíveis (máx {remainingSlots})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Barra Fixa Flutuante se houver selecionados */}
              {selectedUserIds.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                      {selectedUserIds.length} atleta(s) selecionado(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-bold"
                    >
                      Limpar
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={handleAddSelectedLeagueMembers}
                      disabled={isSubmitting}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar à Partida</span>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Alerta de Lotação */}
              {isMatchFull && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center gap-2.5 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold">
                    A partida está com as vagas esgotadas ({totalSlots}/{totalSlots}). Remova algum participante para adicionar outros.
                  </span>
                </div>
              )}

              {/* Lista dos Jogadores da Liga */}
              {isLoadingLeaguePlayers ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 animate-pulse flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-1/3 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="w-1/4 h-2.5 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredLeaguePlayers.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Shield className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {leagueSearchQuery
                      ? 'Nenhum jogador encontrado com essa busca.'
                      : 'Nenhum membro encontrado na liga.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLeaguePlayers.map((player) => {
                    const isAlreadyJoined = joinedUserIdsSet.has(player.id);
                    const isSelected = selectedUserIds.includes(player.id);
                    const positionDisplay = formatPosition(player);
                    const roleDisplay = formatRoleInLeague(player.role_in_league);

                    return (
                      <div
                        key={player.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isAlreadyJoined
                            ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                            : isSelected
                            ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/50 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                        }`}
                      >
                        {/* Checkbox de Seleção em Lote */}
                        {!isAlreadyJoined && (
                          <button
                            type="button"
                            onClick={() => toggleSelectUser(player.id)}
                            className="text-slate-400 hover:text-emerald-500 cursor-pointer shrink-0"
                            title={isSelected ? 'Desmarcar' : 'Selecionar'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        )}

                        {/* Foto e Informações de Perfil */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            {player.avatar_url ? (
                              <Image
                                src={player.avatar_url}
                                alt={player.nome}
                                width={40}
                                height={40}
                                unoptimized={
                                  player.avatar_url.startsWith('blob:') ||
                                  player.avatar_url.startsWith('data:')
                                }
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                                {(player.nome || 'J').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                {player.nome}
                              </span>
                              {player.apelido && (
                                <span className="text-[11px] text-emerald-500 font-bold shrink-0">
                                  ({player.apelido})
                                </span>
                              )}
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                {roleDisplay}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">
                                {positionDisplay}
                              </span>
                              {player.pe_dominante && !isVolei && (
                                <span>• Pé {player.pe_dominante}</span>
                              )}
                              {player.volei_dominant_hand && isVolei && (
                                <span>• Mão {player.volei_dominant_hand}</span>
                              )}
                              {player.rating_in_league && (
                                <span className="text-amber-500 font-black flex items-center gap-0.5">
                                  ⭐ {player.rating_in_league}
                                </span>
                              )}
                              {player.whatsapp && (
                                <a
                                  href={`https://api.whatsapp.com/send?phone=${player.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:underline flex items-center gap-0.5"
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{player.whatsapp}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botão de Adicionar ou Badge de Já Inscrito */}
                        <div className="shrink-0">
                          {isAlreadyJoined ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-black border border-slate-200 dark:border-slate-700">
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Na Partida</span>
                            </span>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              type="button"
                              onClick={() => handleAddLeagueMember(player)}
                              disabled={isSubmitting || isMatchFull}
                              className={`px-3 py-1.5 rounded-xl font-black text-xs text-white flex items-center gap-1 transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                                isVolei
                                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar</span>
                            </motion.button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ABA 3: ADICIONAR CONVIDADO (SEM CADASTRO / AVULSO) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'guest' && (
            <div className="space-y-4">
              {/* Card Informativo Explicativo */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-black text-amber-950 dark:text-amber-100">
                    Jogadores Convidados (Avulsos)
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    Utilize esta opção para adicionar amigos, convidados de última hora ou atletas que não possuem cadastro no aplicativo.
                    Eles serão marcados visualmente com a etiqueta <strong>Convidado</strong> e incluídos na partida sem criar contas fantasmas.
                  </p>
                </div>
              </div>

              {/* Seletor de Modo: Individual ou Lista em Lote */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Modo de Adição:
                </span>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGuestMode('single')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      guestMode === 'single'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestMode('batch')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      guestMode === 'batch'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Vários (Lista)
                  </button>
                </div>
              </div>

              {guestMode === 'single' ? (
                // Formulário Individual
                <form onSubmit={handleAddSingleGuest} className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                      Nome do Jogador Convidado *
                    </label>
                    <input
                      ref={guestInputRef}
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ex: Carlos Convidado, Beto Amigo do Renan"
                      disabled={isSubmitting || isMatchFull}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      disabled={isSubmitting || !guestName.trim() || isMatchFull}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/25 flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Adicionar Convidado à Partida</span>
                    </motion.button>
                  </div>
                </form>
              ) : (
                // Formulário em Lote (Lista do WhatsApp)
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                      Cole ou digite os nomes (um por linha ou separados por vírgula):
                    </label>
                    <textarea
                      rows={5}
                      value={guestBatchText}
                      onChange={(e) => setGuestBatchText(e.target.value)}
                      placeholder="Exemplo (perfeito para copiar do WhatsApp):&#10;Carlos Silva&#10;Marcos Paulo&#10;Felipe Goleiro&#10;Lucas Convidado"
                      disabled={isSubmitting || isMatchFull}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-bold">
                      {guestBatchText.trim()
                        ? `${
                            guestBatchText
                              .split(/[\n,;]+/)
                              .filter((n) => n.trim().length > 0).length
                          } nome(s) detectado(s)`
                        : 'Nenhum nome preenchido'}
                    </span>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={handleAddBatchGuests}
                      disabled={isSubmitting || !guestBatchText.trim() || isMatchFull}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/25 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ListPlus className="w-4 h-4" />
                      <span>Cadastrar Convidados na Partida</span>
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* RODAPÉ DO MODAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>{participants.length} jogador(es) na lista</span>
            <span className="mx-1.5">•</span>
            <span>{remainingSlots} vaga(s) restante(s)</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-black text-xs rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Concluir & Fechar
          </motion.button>
        </div>

      </div>
    </div>
  );
};
