'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Match, MatchParticipant, Profile } from '@/types/database';
import {
  addPlayerToMatch,
  addMultiplePlayersToMatch,
  updatePlayerName,
  removePlayerFromMatch,
  getLeagueExistingPlayers,
  getParticipantDisplayName,
  isGuestParticipant,
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
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface MatchPlayerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participants: MatchParticipant[];
  onUpdate: () => void;
}

export const MatchPlayerManagerModal: React.FC<MatchPlayerManagerModalProps> = ({
  isOpen,
  onClose,
  match,
  participants,
  onUpdate,
}) => {
  const [singleName, setSingleName] = useState('');
  const [multipleNamesText, setMultipleNamesText] = useState('');
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [leaguePlayers, setLeaguePlayers] = useState<Profile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Edição inline de nome
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Carregar jogadores já cadastrados na liga para sugestão rápida
  useEffect(() => {
    if (isOpen && match.organization_id) {
      void (async () => {
        const players = await getLeagueExistingPlayers(match.organization_id!);
        setLeaguePlayers(players);
      })();
    }
  }, [isOpen, match.organization_id]);

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen && !showBatchAdd) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, showBatchAdd]);

  // Filtrar participantes da lista da partida
  const filteredParticipants = useMemo(() => {
    if (!searchFilter.trim()) return participants;
    const q = searchFilter.toLowerCase().trim();
    return participants.filter((p) => getParticipantDisplayName(p).toLowerCase().includes(q));
  }, [participants, searchFilter]);

  // Jogadores da liga que ainda não estão inscritos nesta partida (para sugestões rápidas)
  const availableLeagueSuggestions = useMemo(() => {
    const joinedUserIds = new Set(participants.map((p) => p.user_id));
    return leaguePlayers.filter((p) => !joinedUserIds.has(p.id));
  }, [leaguePlayers, participants]);

  if (!isOpen) return null;

  // Adicionar um jogador individual
  const handleAddSinglePlayer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = singleName.trim();
    if (!name) {
      toast.error('Digite o nome do jogador.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await addPlayerToMatch({
        matchId: match.id,
        leagueId: match.organization_id,
        playerName: name,
      });

      if (res.success) {
        toast.success(res.message || `Jogador "${name}" adicionado à partida! ⚽`);
        setSingleName('');
        onUpdate();
        inputRef.current?.focus();
      } else {
        toast.error(res.error || 'Erro ao adicionar jogador.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao adicionar jogador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adicionar jogador a partir da sugestão da liga
  const handleAddSuggestedPlayer = async (player: Profile) => {
    try {
      setIsSubmitting(true);
      const res = await addPlayerToMatch({
        matchId: match.id,
        leagueId: match.organization_id,
        playerName: player.nome,
        whatsapp: player.whatsapp || undefined,
      });

      if (res.success) {
        toast.success(`Jogador "${player.nome}" adicionado à partida! ⚽`);
        onUpdate();
      } else {
        toast.error(res.error || 'Erro ao adicionar jogador.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao adicionar jogador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adicionar múltiplos jogadores de uma vez (texto com linhas ou vírgulas)
  const handleAddMultiplePlayers = async () => {
    const raw = multipleNamesText.trim();
    if (!raw) {
      toast.error('Informe pelo menos um nome de jogador.');
      return;
    }

    // Separar por quebras de linha ou vírgulas
    const names = raw
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      toast.error('Nenhum nome válido encontrado.');
      return;
    }

    try {
      setIsSubmitting(true);
      const toastId = toast.loading(`Cadastrando ${names.length} jogadores na lista...`);

      const res = await addMultiplePlayersToMatch({
        matchId: match.id,
        leagueId: match.organization_id,
        playerNames: names,
      });

      if (res.success) {
        toast.success(
          `${res.addedCount} jogador(es) adicionado(s) com sucesso!${
            res.existingCount > 0 ? ` (${res.existingCount} já estavam na lista)` : ''
          } ⚽`,
          { id: toastId }
        );
        setMultipleNamesText('');
        setShowBatchAdd(false);
        onUpdate();
      } else {
        toast.error('Não foi possível cadastrar os jogadores: ' + (res.errors.join(', ') || 'Erro desconhecido'), {
          id: toastId,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao cadastrar jogadores em lote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Iniciar edição de nome
  const startEditName = (p: MatchParticipant) => {
    setEditingParticipantId(p.id);
    setEditingNameValue(getParticipantDisplayName(p));
  };

  // Salvar novo nome do jogador
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

  // Remover jogador da partida
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

  const isVolei = match.sport_type === 'volei' || match.organization?.sport_type === 'volei';
  const totalSlots = match.limite_participantes || match.num_times * match.jogadores_por_time;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-md ${
              isVolei ? 'bg-amber-500 shadow-amber-500/25' : 'bg-emerald-500 shadow-emerald-500/25'
            }`}>
              {isVolei ? '🏐' : '⚽'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isVolei ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  Gerenciamento da Partida
                </span>
                <span className="text-[10px] px-2 py-px rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {participants.length} / {totalSlots} Inscritos
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                Lista de Jogadores Inscritos
              </h2>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Corpo com Rolagem */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 flex-1">
          
          {/* Card de Adicionar Jogador */}
          <div className={`p-4 rounded-2xl border ${
            isVolei
              ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/25'
              : 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/25'
          }`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <UserPlus className={`w-4 h-4 ${isVolei ? 'text-amber-500' : 'text-emerald-500'}`} />
                <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Adicionar Jogador à Partida
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowBatchAdd(!showBatchAdd)}
                className={`text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                  isVolei
                    ? 'text-amber-600 dark:text-amber-400 hover:underline'
                    : 'text-emerald-600 dark:text-emerald-400 hover:underline'
                }`}
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>{showBatchAdd ? 'Modo Individual' : 'Adicionar Vários'}</span>
              </button>
            </div>

            {!showBatchAdd ? (
              // Formulário de Adição Individual
              <form onSubmit={handleAddSinglePlayer} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="Nome do jogador (Ex: Renan Lima)"
                  disabled={isSubmitting}
                  className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isSubmitting || !singleName.trim()}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs text-white flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 ${
                    isVolei
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
                      : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar</span>
                </motion.button>
              </form>
            ) : (
              // Formulário de Adição em Lote
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={multipleNamesText}
                  onChange={(e) => setMultipleNamesText(e.target.value)}
                  placeholder="Cole ou digite os nomes dos jogadores (um por linha ou separados por vírgula):&#10;Renan Lima&#10;João&#10;Carlos&#10;Pedro"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchAdd(false)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleAddMultiplePlayers}
                    disabled={isSubmitting || !multipleNamesText.trim()}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                      isVolei
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-emerald-500 hover:bg-emerald-600'
                    }`}
                  >
                    <ListPlus className="w-4 h-4" />
                    <span>Adicionar Lista Completa</span>
                  </motion.button>
                </div>
              </div>
            )}

            {/* Sugestões Rápidas de Membros da Liga */}
            {availableLeagueSuggestions.length > 0 && !showBatchAdd && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                  ⚡ Sugestões da Liga (Toque para adicionar):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                  {availableLeagueSuggestions.slice(0, 10).map((lp) => (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => handleAddSuggestedPlayer(lp)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-emerald-500" />
                      <span>{lp.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Campo de Busca se houver mais de 5 participantes */}
          {participants.length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar jogador inscrito por nome..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Lista Completa Numerada de Jogadores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-500" />
                <span>Jogadores Inscritos ({filteredParticipants.length})</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {participants.length >= totalSlots ? (
                  <span className="text-red-500 font-extrabold">Partida Lotada</span>
                ) : (
                  `${totalSlots - participants.length} vaga(s) restante(s)`
                )}
              </span>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {searchFilter ? 'Nenhum jogador encontrado para a busca.' : 'Nenhum jogador inscrito nesta partida ainda.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Utilize o campo acima para cadastrar os jogadores que participarão do jogo.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredParticipants.map((p, index) => {
                  const isEditingThis = editingParticipantId === p.id;
                  const displayName = getParticipantDisplayName(p);
                  const isGuest = isGuestParticipant(p);

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                    >
                      {/* Numeração e Nome */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                          {index + 1}
                        </span>

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
                                className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-brand-500 rounded-lg text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditName(p)}
                                disabled={isSubmitting}
                                className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shrink-0"
                                title="Salvar alteração"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingParticipantId(null)}
                                className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors shrink-0"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                {displayName}
                              </span>
                              {isGuest && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black shrink-0">
                                  Avulso
                                </span>
                              )}
                              {p.user?.apelido && (
                                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                  ({p.user.apelido})
                                </span>
                              )}
                              {p.paid ? (
                                <span className="text-[10px] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black shrink-0">
                                  Pago ✅
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações: Editar Nome e Excluir */}
                      {!isEditingThis && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditName(p)}
                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
                            title="Editar Nome do Jogador"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePlayer(p)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                            title="Remover Jogador da Partida"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Rodapé com Fechar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
          >
            Concluir & Fechar
          </motion.button>
        </div>

      </div>
    </div>
  );
};
