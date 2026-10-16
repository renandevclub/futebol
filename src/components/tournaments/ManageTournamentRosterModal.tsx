'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, UserPlus, Trash2, Shield, Search, Crown, Check, AlertCircle, Star, Edit2, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import {
  fetchLeagueMembersForSelection,
  addPlayerToTeam,
  removePlayerFromTeam,
  updatePlayerInTeam,
} from '@/lib/tournamentsHelper';
import { Tournament, TournamentTeam, TournamentTeamPlayer, Profile } from '@/types/database';
import { toast } from 'sonner';

interface ManageTournamentRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  team: TournamentTeam;
  onRosterUpdated?: () => void;
}

export const ManageTournamentRosterModal: React.FC<ManageTournamentRosterModalProps> = ({
  isOpen,
  onClose,
  tournament,
  team,
  onRosterUpdated,
}) => {
  const { user } = useAuth();
  const { currentLeague, canManageLeague } = useLeague();

  const isCoach = user?.id === team.coach_id;
  const isAdmin = currentLeague ? canManageLeague(currentLeague.id, currentLeague) : false;
  const canManageSquad = isCoach || isAdmin;

  const [players, setPlayers] = useState<TournamentTeamPlayer[]>(team.players || []);
  const [leagueMembers, setLeagueMembers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [shirtNumber, setShirtNumber] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [isCaptain, setIsCaptain] = useState<boolean>(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para edição de jogador existente
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState<string>('');
  const [editPosition, setEditPosition] = useState<string>('');
  const [editIsCaptain, setEditIsCaptain] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const startEditPlayer = (p: TournamentTeamPlayer) => {
    setEditingPlayerId(p.id);
    setEditNumber(p.number ? String(p.number) : '');
    setEditPosition(p.position || '');
    setEditIsCaptain(Boolean(p.is_captain));
  };

  const handleSaveEditPlayer = async (pId: string) => {
    setIsSavingEdit(true);
    try {
      const res = await updatePlayerInTeam(pId, {
        number: editNumber ? Number(editNumber) : null,
        position: editPosition.trim() || null,
        is_captain: editIsCaptain,
      });

      if (res.success) {
        setPlayers((prev) =>
          prev.map((pl) =>
            pl.id === pId
              ? {
                  ...pl,
                  number: editNumber ? Number(editNumber) : null,
                  position: editPosition.trim() || null,
                  is_captain: editIsCaptain,
                }
              : pl
          )
        );
        setEditingPlayerId(null);
        if (onRosterUpdated) onRosterUpdated();
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Carregar membros da liga para seleção
  useEffect(() => {
    if (!isOpen || !currentLeague?.id) return;
    const loadMembers = async () => {
      setIsLoadingMembers(true);
      const members = await fetchLeagueMembersForSelection(currentLeague.id);
      setLeagueMembers(members);
      setIsLoadingMembers(false);
    };
    loadMembers();
  }, [isOpen, currentLeague?.id]);

  useEffect(() => {
    setPlayers(team.players || []);
  }, [team.players]);

  const maxPlayers = tournament.players_per_team;
  const currentCount = players.length;
  const isFull = currentCount >= maxPlayers;

  // Filtrar membros disponíveis (não inseridos neste time)
  const availableMembers = useMemo(() => {
    const existingUserIds = new Set(players.map((p) => p.user_id));
    return leagueMembers.filter((m) => {
      if (existingUserIds.has(m.id)) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        m.nome?.toLowerCase().includes(term) ||
        m.apelido?.toLowerCase().includes(term) ||
        m.whatsapp?.toLowerCase().includes(term)
      );
    });
  }, [leagueMembers, players, searchTerm]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Selecione um jogador da lista.');
      return;
    }

    if (isFull) {
      toast.error(`O limite máximo de ${maxPlayers} jogadores já foi atingido.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addPlayerToTeam({
        tournament_id: tournament.id,
        tournament_team_id: team.id,
        user_id: selectedUserId,
        number: shirtNumber ? Number(shirtNumber) : undefined,
        position: position.trim() || undefined,
        is_captain: isCaptain,
      });

      if (res.success) {
        setSelectedUserId('');
        setShirtNumber('');
        setPosition('');
        setIsCaptain(false);
        if (onRosterUpdated) {
          onRosterUpdated();
        }
      } else {
        toast.error(res.error || 'Erro ao adicionar jogador.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePlayer = async (teamPlayerId: string, playerName?: string) => {
    if (!window.confirm(`Deseja remover "${playerName || 'o jogador'}" do elenco?`)) {
      return;
    }

    const res = await removePlayerFromTeam(teamPlayerId);
    if (res.success) {
      setPlayers((prev) => prev.filter((p) => p.id !== teamPlayerId));
      if (onRosterUpdated) {
        onRosterUpdated();
      }
    } else {
      toast.error(res.error || 'Erro ao remover jogador.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Elenco: {team.name}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Técnico: <strong>{team.coach?.nome || 'Responsável'}</strong> • {currentCount} / {maxPlayers} jogadores
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Permissão Check */}
            {!canManageSquad && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Apenas o técnico oficial ({team.coach?.nome}) ou administradores podem alterar este elenco.</span>
              </div>
            )}

            {/* Formulário de Adicionar Jogador (Apenas Coach ou Admin) */}
            {canManageSquad && !isFull && (
              <form onSubmit={handleAddPlayer} className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                  <span>Inscrever Jogador no Elenco</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Busca e Seleção de Membros */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Membro da Liga *
                    </label>
                    <select
                      required
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecione um jogador da liga...</option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} {m.apelido ? `(${m.apelido})` : ''} - {m.posicao || 'Jogador'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Número da Camisa */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Número da Camisa (Opcional)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="Ex: 10"
                      value={shirtNumber}
                      onChange={(e) => setShirtNumber(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Posição Específica */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Posição no Time (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Atacante, Goleiro..."
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={isCaptain}
                      onChange={(e) => setIsCaptain(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      Definir como Capitão
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedUserId}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Adicionando...' : '+ Adicionar ao Time'}
                  </button>
                </div>
              </form>
            )}

            {isFull && canManageSquad && (
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>Elenco completo! Limite máximo de {maxPlayers} jogadores atingido.</span>
              </div>
            )}

            {/* Lista do Elenco Atual */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Jogadores Inscritos ({players.length})
                </h4>
                <span className="text-xs font-bold text-slate-400">
                  Vagas restantes: {Math.max(0, maxPlayers - players.length)}
                </span>
              </div>

              {players.length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                  <Users className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs font-bold">Nenhum jogador cadastrado no elenco ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {players.map((p) => {
                    const isTeamCoach = p.user_id === team.coach_id;
                    const isEditing = editingPlayerId === p.id;

                    if (isEditing) {
                      return (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl bg-emerald-500/5 border-2 border-emerald-500/40 space-y-3 col-span-1 sm:col-span-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white">
                            <span>Editando: {p.user?.nome || 'Jogador'}</span>
                            <span className="text-[10px] text-emerald-500 font-bold">Camisa & Posição</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">Nº Camisa</label>
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={editNumber}
                                onChange={(e) => setEditNumber(e.target.value)}
                                placeholder="Ex: 10"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">Posição</label>
                              <input
                                type="text"
                                value={editPosition}
                                onChange={(e) => setEditPosition(e.target.value)}
                                placeholder="Ex: Atacante, Levantador"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                              />
                            </div>
                            <div className="flex items-end pb-0.5">
                              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editIsCaptain}
                                  onChange={(e) => setEditIsCaptain(e.target.checked)}
                                  className="w-4 h-4 rounded text-emerald-500"
                                />
                                <span>Capitão da Equipe</span>
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingPlayerId(null)}
                              disabled={isSavingEdit}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditPlayer(p.id)}
                              disabled={isSavingEdit}
                              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{isSavingEdit ? 'Salvando...' : 'Salvar'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar ou Número */}
                          <div className="relative w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-sm text-slate-700 dark:text-slate-200 shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600">
                            {p.user?.avatar_url ? (
                              <img src={p.user.avatar_url} alt={p.user.nome} className="w-full h-full object-cover" />
                            ) : p.number ? (
                              <span>#{p.number}</span>
                            ) : (
                              <span>⚽</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {p.user?.nome || 'Jogador'}
                              </span>
                              {p.is_captain && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5" /> Cap
                                </span>
                              )}
                              {isTeamCoach && (
                                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-black">
                                  Técnico
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
                              {p.position || p.user?.posicao || 'Atleta'} {p.number ? `• Camisa #${p.number}` : ''}
                            </p>
                          </div>
                        </div>

                        {canManageSquad && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditPlayer(p)}
                              title="Editar jogador (número, posição, capitão)"
                              className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePlayer(p.id, p.user?.nome)}
                              title="Remover jogador do time"
                              className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
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

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
