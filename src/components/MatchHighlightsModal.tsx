'use client';

import React, { useState, useEffect } from 'react';
import { Match, MatchParticipant, Profile } from '@/types/database';
import { saveMatchHighlights } from '@/lib/leagueRankingsHelper';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Award,
  Sparkles,
  X,
  Check,
  Search,
  User,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface MatchHighlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  participants: MatchParticipant[];
  onSaved?: () => void;
}

export const MatchHighlightsModal: React.FC<MatchHighlightsModalProps> = ({
  isOpen,
  onClose,
  match,
  participants,
  onSaved,
}) => {
  const [selectedMvpId, setSelectedMvpId] = useState<string | null>(match.mvp_player_id || null);
  const [selectedAningaId, setSelectedAningaId] = useState<string | null>(match.aninga_player_id || null);
  const [mvpNotes, setMvpNotes] = useState<string>(match.mvp_notes || '');
  const [aningaNotes, setAningaNotes] = useState<string>(match.aninga_notes || '');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'mvp' | 'aninga'>('mvp');

  useEffect(() => {
    if (isOpen) {
      setSelectedMvpId(match.mvp_player_id || null);
      setSelectedAningaId(match.aninga_player_id || null);
      setMvpNotes(match.mvp_notes || '');
      setAningaNotes(match.aninga_notes || '');
    }
  }, [isOpen, match]);

  if (!isOpen) return null;

  const validParticipants = participants.filter((p) => p.user);

  const filteredParticipants = validParticipants.filter((p) => {
    const name = p.user?.nome?.toLowerCase() || '';
    const apelido = p.user?.apelido?.toLowerCase() || '';
    const query = searchTerm.toLowerCase();
    return name.includes(query) || apelido.includes(query);
  });

  const selectedMvpUser = validParticipants.find((p) => p.user_id === selectedMvpId)?.user;
  const selectedAningaUser = validParticipants.find((p) => p.user_id === selectedAningaId)?.user;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveMatchHighlights(
        match.id,
        selectedMvpId,
        selectedAningaId,
        mvpNotes,
        aningaNotes
      );

      if (res.success) {
        toast.success('Destaques da partida atualizados com sucesso!');
        if (onSaved) onSaved();
        onClose();
      } else {
        toast.error('Erro ao salvar destaques: ' + (res.error || 'Tente novamente.'));
      }
    } catch (err: any) {
      toast.error('Erro ao registrar destaques: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative p-5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-emerald-950/70 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                  Eleger Destaques da Rodada
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {match.titulo} • {match.data}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Seletor de Categoria (MVP vs ANINGA) */}
          <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab('mvp')}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'mvp'
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <span className="text-xl">🏆</span>
                <div>
                  <span className="block text-xs font-black uppercase tracking-wider">
                    Melhor da Partida
                  </span>
                  <span className="text-[11px] font-bold truncate max-w-[130px] block text-slate-300">
                    {selectedMvpUser ? selectedMvpUser.nome : 'Não definido'}
                  </span>
                </div>
              </div>
              {selectedMvpId && (
                <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                  ✓
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('aninga')}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'aninga'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <span className="text-xl">🐍</span>
                <div>
                  <span className="block text-xs font-black uppercase tracking-wider">
                    ANINGA (Pior do Jogo)
                  </span>
                  <span className="text-[11px] font-bold truncate max-w-[130px] block text-slate-300">
                    {selectedAningaUser ? selectedAningaUser.nome : 'Não definido'}
                  </span>
                </div>
              </div>
              {selectedAningaId && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                  ✓
                </div>
              )}
            </button>
          </div>

          {/* Conteúdo Principal */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Informações da categoria selecionada */}
            {activeTab === 'mvp' ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-200 font-medium">
                    Selecione o jogador que mais se destacou e fez a diferença na partida.
                  </span>
                </div>
                {selectedMvpId && (
                  <button
                    onClick={() => setSelectedMvpId(null)}
                    className="text-[10px] font-extrabold text-amber-400 hover:underline shrink-0"
                  >
                    Remover
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🐍</span>
                  <span className="text-xs text-emerald-200 font-medium">
                    Selecione o <strong>ANINGA</strong> da partida (o mais zicado ou que mais errou).
                  </span>
                </div>
                {selectedAningaId && (
                  <button
                    onClick={() => setSelectedAningaId(null)}
                    className="text-[10px] font-extrabold text-emerald-400 hover:underline shrink-0"
                  >
                    Remover
                  </button>
                )}
              </div>
            )}

            {/* Campo de Busca de Jogadores */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar jogador por nome ou apelido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Lista de Participantes */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredParticipants.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs font-medium">
                  Nenhum participante encontrado.
                </div>
              ) : (
                filteredParticipants.map((p) => {
                  const isMvpSelected = selectedMvpId === p.user_id;
                  const isAningaSelected = selectedAningaId === p.user_id;
                  const isCurrentActive =
                    activeTab === 'mvp' ? isMvpSelected : isAningaSelected;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (activeTab === 'mvp') {
                          setSelectedMvpId(isMvpSelected ? null : p.user_id);
                          if (!isMvpSelected && selectedAningaId === p.user_id) {
                            setSelectedAningaId(null);
                          }
                        } else {
                          setSelectedAningaId(isAningaSelected ? null : p.user_id);
                          if (!isAningaSelected && selectedMvpId === p.user_id) {
                            setSelectedMvpId(null);
                          }
                        }
                      }}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        isCurrentActive
                          ? activeTab === 'mvp'
                            ? 'bg-amber-500/20 border-amber-500/60 shadow-sm'
                            : 'bg-emerald-500/20 border-emerald-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs overflow-hidden border border-slate-700">
                            {p.user?.avatar_url ? (
                              <img
                                src={p.user.avatar_url}
                                alt={p.user.nome}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              p.user?.nome.charAt(0).toUpperCase()
                            )}
                          </div>
                          {isMvpSelected && (
                            <span className="absolute -top-1 -right-1 text-xs">🏆</span>
                          )}
                          {isAningaSelected && (
                            <span className="absolute -top-1 -right-1 text-xs">🐍</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-white truncate flex items-center gap-1.5">
                            <span>{p.user?.nome}</span>
                            {p.user?.apelido && (
                              <span className="text-slate-400 font-semibold text-[10px]">
                                ({p.user.apelido})
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Time {p.team || 1} • {p.user?.posicao || 'Jogador'}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCurrentActive ? (
                          <div
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              activeTab === 'mvp'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-emerald-500 text-slate-950'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>{activeTab === 'mvp' ? 'Eleito Craque' : 'Eleito ANINGA'}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-all"
                          >
                            Selecionar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Observações / Justificativa */}
            {activeTab === 'mvp' ? (
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Justificativa / Motivo do Craque (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Hat-trick na final e jogou muito!"
                  value={mvpNotes}
                  onChange={(e) => setMvpNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Zoeira / Motivo do ANINGA (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Perdeu gol sem goleiro aos 9 minutos!"
                  value={aningaNotes}
                  onChange={(e) => setAningaNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Salvar Destaques</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
