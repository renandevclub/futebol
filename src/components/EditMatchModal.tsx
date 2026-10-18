'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Match, LocationItem, MatchParticipant } from '@/types/database';
import { useLeague } from '@/context/LeagueContext';
import { notifyMatchUpdated } from '@/lib/notificationDispatcher';
import { MatchPlayerManagerModal } from '@/components/MatchPlayerManagerModal';
import { X, Calendar, MapPin, Clock, DollarSign, FileText, Save, Shield, Sparkles, Trophy, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface EditMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  onMatchUpdated?: () => void;
}

const TEAM_COLORS = [
  { name: 'Time A', emoji: '🔴' },
  { name: 'Time B', emoji: '🔵' },
  { name: 'Time C', emoji: '🟢' },
  { name: 'Time D', emoji: '🟡' },
  { name: 'Time E', emoji: '🟣' },
  { name: 'Time F', emoji: '🟠' },
  { name: 'Time G', emoji: '🩷' },
  { name: 'Time H', emoji: '🩵' },
  { name: 'Time I', emoji: '💜' },
  { name: 'Time J', emoji: '💚' },
];

export const EditMatchModal: React.FC<EditMatchModalProps> = ({
  isOpen,
  onClose,
  match,
  onMatchUpdated,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { leagues, myLeagues, canManageMatch, canManageLeague } = useLeague();
  const availableLeagues = isSuperAdmin ? leagues : myLeagues;

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [endereco, setEndereco] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [valor, setValor] = useState('');
  const [custoAluguel, setCustoAluguel] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [numTimes, setNumTimes] = useState(2);
  const [jogadoresPorTime, setJogadoresPorTime] = useState(6);
  const [maxHomensPorTime, setMaxHomensPorTime] = useState(3);
  const [maxMulheresPorTime, setMaxMulheresPorTime] = useState(2);
  const [vagasExtras, setVagasExtras] = useState(0);
  const [minMulheresPorTime, setMinMulheresPorTime] = useState(0);
  const [sorteioRaspadinhaAtivo, setSorteioRaspadinhaAtivo] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [trackAssists, setTrackAssists] = useState(false);
  const [trackCards, setTrackCards] = useState(false);
  const [stageDurationMinutes, setStageDurationMinutes] = useState(10);
  const [stagesCount, setStagesCount] = useState(1);
  const [volleyRequiresTwoPointAdvantage, setVolleyRequiresTwoPointAdvantage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gerenciamento de participantes na edição
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [isPlayerManagerOpen, setIsPlayerManagerOpen] = useState(false);

  const [locations, setLocations] = useState<LocationItem[]>([
    { id: '1', nome: 'Arena Society 10', maps_url: 'https://maps.app.goo.gl/Muxi7iWHoeY2PkTB8' },
    { id: '2', nome: 'Centro Esportivo Futsal Central', maps_url: 'https://maps.app.goo.gl/axspwsn9hK2kAek19' },
  ]);

  const fetchParticipants = async (matchId: string) => {
    try {
      const { data } = await supabase
        .from('match_participants')
        .select('*, user:user_id(*)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) {
        setParticipants(data as MatchParticipant[]);
      }
    } catch (e) {
      console.error('Erro ao buscar participantes na edição:', e);
    }
  };

  // Preencher formulário quando modal abrir ou match alterar
  useEffect(() => {
    if (match) {
      void fetchParticipants(match.id);
      setSelectedLeagueId(match.organization_id || '');
      setTitulo(match.titulo || '');
      setLocal(match.local || '');
      setEndereco(match.endereco || '');
      setMapsUrl(match.maps_url || '');
      setData(match.data || '');
      // Garantir formato HH:mm
      setHorario(match.horario ? match.horario.substring(0, 5) : '');
      setValor(match.valor !== undefined && match.valor !== null ? match.valor.toString() : '0');
      setCustoAluguel(match.custo_aluguel !== undefined && match.custo_aluguel !== null ? match.custo_aluguel.toString() : '');
      setChavePix(match.chave_pix || '');
      setNomeRecebedor(match.nome_recebedor_pix || '');
      setNumTimes(match.num_times || 2);
      setJogadoresPorTime(match.jogadores_por_time || 6);

      const savedGenderLimits = (match.teams_custom_config as any)?.gender_limits;
      const initialMaxMen = match.max_homens_por_time ?? savedGenderLimits?.max_homens_por_time ?? Math.max(1, (match.jogadores_por_time || 6) - (match.min_mulheres_por_time || 2));
      const initialMaxFem = match.max_mulheres_por_time ?? savedGenderLimits?.max_mulheres_por_time ?? (match.min_mulheres_por_time || 2);

      setMaxHomensPorTime(initialMaxMen);
      setMaxMulheresPorTime(initialMaxFem);

      const baseSlots = (match.num_times || 2) * (match.jogadores_por_time || 6);
      const calcExtras = Math.max(0, (match.limite_participantes || baseSlots) - baseSlots);
      setVagasExtras(calcExtras);

      setMinMulheresPorTime(match.min_mulheres_por_time || 0);
      setSorteioRaspadinhaAtivo(!!match.sorteio_raspadinha_ativo);
      setObservacoes(match.observacoes || '');

      const rules = match.match_rules || (match.teams_custom_config as any)?.match_rules;
      setTrackAssists(!!rules?.track_assists);
      setTrackCards(!!rules?.track_cards);
      setStageDurationMinutes(rules?.stage_duration_minutes || 10);
      setStagesCount(rules?.stages_count || 1);
      setVolleyRequiresTwoPointAdvantage(rules?.volley_requires_two_point_advantage === true);
    }
  }, [match, isOpen]);

  // Carregar locais pré-cadastrados
  useEffect(() => {
    if (isOpen) {
      const fetchLocations = async () => {
        try {
          const { data: dbLocs } = await supabase.from('locations').select('*').order('nome');
          if (dbLocs && dbLocs.length > 0) {
            setLocations(dbLocs);
          }
        } catch (e) {
          console.error('Erro ao buscar locais:', e);
        }
      };
      void fetchLocations();
    }
  }, [isOpen]);

  const handleSelectPredefinedLocation = (locName: string) => {
    if (!locName) return;
    const found = locations.find((l) => l.nome === locName);
    if (found) {
      setLocal(found.nome);
      if (found.endereco) setEndereco(found.endereco);
      if (found.maps_url) setMapsUrl(found.maps_url);
    } else {
      setLocal(locName);
    }
  };

  const currentSelectedLeague = useMemo(() => {
    const targetId = selectedLeagueId || match?.organization_id;
    return availableLeagues.find((l) => l.id === targetId) || leagues.find((l) => l.id === targetId) || null;
  }, [selectedLeagueId, match, availableLeagues, leagues]);

  const matchSportType = currentSelectedLeague?.sport_type || match?.sport_type || 'futebol';
  const isVolei = matchSportType === 'volei';

  const effectiveJogadoresPorTime = useMemo(() => {
    if (isVolei) {
      return maxHomensPorTime + maxMulheresPorTime;
    }
    return jogadoresPorTime;
  }, [isVolei, maxHomensPorTime, maxMulheresPorTime, jogadoresPorTime]);

  const limiteCalculado = useMemo(() => {
    return numTimes * effectiveJogadoresPorTime + vagasExtras;
  }, [numTimes, effectiveJogadoresPorTime, vagasExtras]);

  if (!isOpen || !match || !canManageMatch(match)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageMatch(match)) {
      toast.error('Acesso negado: Você não possui permissão de administrador para esta partida.');
      return;
    }

    const targetOrgId = selectedLeagueId || match.organization_id;
    if (targetOrgId && targetOrgId !== match.organization_id && !canManageLeague(targetOrgId)) {
      toast.error('Acesso negado: Você não pode mover a partida para uma liga que não administra.');
      return;
    }

    if (!titulo.trim() || !local.trim() || !data || !horario) {
      toast.error('Preencha os campos obrigatórios (*).');
      return;
    }

    if (numTimes < 2) {
      toast.error('A partida precisa ter no mínimo 2 times.');
      return;
    }

    if (effectiveJogadoresPorTime < 1) {
      toast.error('Cada time precisa de pelo menos 1 jogador.');
      return;
    }

    try {
      setIsSubmitting(true);

      const parsedValor = parseFloat(valor);
      const parsedCustoAluguel = parseFloat(custoAluguel.replace(',', '.'));

      const existingCustomConfig = (match.teams_custom_config || {}) as Record<string, any>;
      const updatedCustomConfig = {
        ...existingCustomConfig,
        ...(isVolei
          ? {
              gender_limits: {
                max_homens_por_time: maxHomensPorTime,
                max_mulheres_por_time: maxMulheresPorTime,
              },
            }
          : {
              match_rules: {
                track_assists: trackAssists,
                track_cards: trackCards,
                stage_duration_minutes: stageDurationMinutes,
                stages_count: stagesCount,
              },
            }),
      };

      const updatePayload: Record<string, any> = {
        titulo: titulo.trim(),
        organization_id: selectedLeagueId || match.organization_id,
        sport_type: matchSportType,
        local: local.trim(),
        endereco: endereco.trim() || null,
        maps_url: mapsUrl.trim() || null,
        data,
        horario,
        valor: isNaN(parsedValor) ? 0 : Math.max(0, parsedValor),
        custo_aluguel: isNaN(parsedCustoAluguel) ? 0 : Math.max(0, parsedCustoAluguel),
        chave_pix: chavePix.trim() || null,
        nome_recebedor_pix: nomeRecebedor.trim() || null,
        num_times: numTimes,
        jogadores_por_time: effectiveJogadoresPorTime,
        limite_participantes: limiteCalculado,
        min_mulheres_por_time: isVolei ? maxMulheresPorTime : minMulheresPorTime,
        max_homens_por_time: isVolei ? maxHomensPorTime : null,
        max_mulheres_por_time: isVolei ? maxMulheresPorTime : null,
        sorteio_raspadinha_ativo: sorteioRaspadinhaAtivo,
        observacoes: observacoes.trim() || null,
        match_rules: isVolei
          ? {
              volley_requires_two_point_advantage: volleyRequiresTwoPointAdvantage,
            }
          : {
              track_assists: trackAssists,
              track_cards: trackCards,
              stage_duration_minutes: stageDurationMinutes,
              stages_count: stagesCount,
            },
        teams_custom_config: updatedCustomConfig,
      };

      let { error } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', match.id);

      // Fallback resiliente caso colunas novas ainda não existam no banco
      if (error && (error.message?.includes('max_homens_por_time') || error.message?.includes('max_mulheres_por_time') || error.message?.includes('sport_type') || error.message?.includes('custo_aluguel'))) {
        delete updatePayload.max_homens_por_time;
        delete updatePayload.max_mulheres_por_time;
        if (error.message?.includes('sport_type')) {
          delete updatePayload.sport_type;
        }
        if (error.message?.includes('custo_aluguel')) {
          delete updatePayload.custo_aluguel;
        }
        const retry = await supabase.from('matches').update(updatePayload).eq('id', match.id);
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao atualizar partida:', error);
        toast.error('Erro ao salvar alterações da partida.');
      } else {
        toast.success(isVolei ? 'Partida de vôlei atualizada com sucesso! 🏐' : 'Partida de futebol atualizada com sucesso! ⚽');

        // Notificar participantes sobre as alterações na partida
        void (async () => {
          try {
            const { data: participants } = await supabase
              .from('match_participants')
              .select('user_id')
              .eq('match_id', match.id);

            if (participants && participants.length > 0) {
              const playerIds = participants.map((p) => p.user_id).filter(Boolean);
              const updatedMatchObj: Match = {
                ...match,
                titulo: titulo.trim(),
                data: data,
                horario: horario,
                local: local.trim(),
                sport_type: matchSportType,
                organization: currentSelectedLeague,
              };

              await notifyMatchUpdated(
                updatedMatchObj,
                playerIds,
                `A partida (${isVolei ? 'Vôlei' : 'Futebol'}) "${titulo.trim()}" foi atualizada para ${data.split('-').reverse().join('/')} às ${horario.substring(0, 5)} no ${local.trim()}.`
              );
            }
          } catch (e) {
            console.error('Erro ao notificar participantes:', e);
          }
        })();

        if (onMatchUpdated) onMatchUpdated();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar partida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-4 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0 pr-8">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shrink-0 ${
            isVolei
              ? 'bg-amber-500 shadow-amber-500/20'
              : 'bg-emerald-500 shadow-emerald-500/20'
          }`}>
            <span className="text-lg">{isVolei ? '🏐' : '⚽'}</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {isVolei ? 'Editar Detalhes da Partida de Vôlei' : 'Editar Detalhes da Partida de Futebol'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Altere título, data, horário, valor da coleta e local da partida
            </p>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form id="edit-match-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* SEÇÃO LIGA VINCULADA */}
          <div className={`p-3 rounded-2xl border space-y-1.5 ${
            isVolei
              ? 'bg-amber-500/5 dark:bg-amber-950/30 border-amber-500/25'
              : 'bg-emerald-500/5 dark:bg-emerald-950/30 border-emerald-500/25'
          }`}>
            <div className="flex items-center justify-between">
              <label className={`block text-[10px] font-black uppercase tracking-wider ${
                isVolei ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                🏆 Liga Vinculada
              </label>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                isVolei ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isVolei ? '🏐 Vôlei' : '⚽ Futebol'}
              </span>
            </div>

            {availableLeagues.length > 0 ? (
              <select
                value={selectedLeagueId}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                className={`w-full min-h-9 px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none ${
                  isVolei ? 'border-amber-500/30 focus:ring-2 focus:ring-amber-500' : 'border-emerald-500/30 focus:ring-2 focus:ring-emerald-500'
                }`}
              >
                {availableLeagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>
                    {lg.sport_type === 'volei' ? '🏐' : '⚽'} {lg.name} ({lg.sport_type === 'volei' ? 'Vôlei' : 'Futebol'}) — {lg.owner?.nome || 'Admin'}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-500 font-medium">Nenhuma liga encontrada.</p>
            )}
          </div>

          {/* SEÇÃO 1: Título e Local */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center">1</span>
              Informações Básicas
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Título da Partida <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Futebol dos Amigos, Futebol de Terça..."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Local da Partida <span className="text-red-500">*</span>
              </label>

              {locations.length > 0 && (
                <div className="mb-2">
                  <select
                    onChange={(e) => handleSelectPredefinedLocation(e.target.value)}
                    value={locations.some((l) => l.nome === local) ? local : ''}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">-- Selecionar de um local salvo --</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.nome}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="text"
                required
                placeholder="Ex: Arena Society Prime, Campo do Bairro..."
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Endereço (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro..."
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link GPS / Maps (opcional)
                </label>
                <input
                  type="url"
                  placeholder="https://maps.app.goo.gl/..."
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: Data, Horário e Valor */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center">2</span>
              Data, Horário e Valor da Coleta
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Horário <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Valor por Jogador (R$)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Coleta individual</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full min-h-10 pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>🏟️ Aluguel Arena/Society (R$)</span>
                  </span>
                  <span className="text-[10px] text-brand-500 font-bold">Despesa fixa</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 180.00 (opcional)"
                    value={custoAluguel}
                    onChange={(e) => setCustoAluguel(e.target.value)}
                    className="w-full min-h-10 pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chave PIX da Partida (Exclusiva) 🔑
              </label>
              <input
                type="text"
                placeholder="CPF, CNPJ, Celular, E-mail..."
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* SEÇÃO 3: Configuração dos Times */}
          <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-3.5 ${
            isVolei
              ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/30'
              : 'bg-gradient-to-br from-brand-500/5 to-amber-500/5 border-brand-500/20'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                  isVolei ? 'bg-amber-500/20 text-amber-500' : 'bg-brand-500/10 text-brand-500'
                }`}>
                  3
                </span>
                <Shield className={`w-4 h-4 ${isVolei ? 'text-amber-500' : 'text-brand-500'}`} />
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {isVolei ? '🏐 Escalação & Composição do Vôlei' : 'Escalação e Formação dos Times'}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                isVolei ? 'bg-amber-500/20 text-amber-500' : 'bg-brand-500/10 text-brand-500'
              }`}>
                {isVolei ? 'Vôlei Misto' : 'Futebol'}
              </span>
            </div>

            {/* Configuração de Vôlei: Cotas de Homens e Mulheres */}
            {isVolei ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Quantidade de Times <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNumTimes(Math.max(2, numTimes - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-extrabold text-lg text-amber-500">{numTimes}</span>
                      <button
                        type="button"
                        onClick={() => setNumTimes(Math.min(10, numTimes + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Titulares por Equipe
                    </label>
                    <div className="h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
                      <span>{effectiveJogadoresPorTime} atletas</span>
                      <span className="text-[10px] opacity-75">({maxHomensPorTime}H + {maxMulheresPorTime}M)</span>
                    </div>
                  </div>
                </div>

                {/* Painel Exclusivo de Limites de Gênero do Vôlei */}
                <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-amber-500/30 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>⚖️</span> Limite de Atletas por Gênero (por Time):
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                      Equilíbrio de Vôlei
                    </span>
                  </div>

                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                    {/* Limite Masculino */}
                    <div className="p-2.5 rounded-xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          ♂️ Homens / Time
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">Máximo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={() => setMaxHomensPorTime(Math.max(0, maxHomensPorTime - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                        >
                          −
                        </motion.button>
                        <span className="w-10 text-center font-extrabold text-lg text-blue-600 dark:text-blue-400">
                          {maxHomensPorTime}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={() => setMaxHomensPorTime(Math.min(12, maxHomensPorTime + 1))}
                          className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                        >
                          +
                        </motion.button>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          homem{maxHomensPorTime !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Limite Feminino */}
                    <div className="p-2.5 rounded-xl bg-pink-500/5 dark:bg-pink-950/20 border border-pink-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                          ♀️ Mulheres / Time
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">Máximo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={() => setMaxMulheresPorTime(Math.max(0, maxMulheresPorTime - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                        >
                          −
                        </motion.button>
                        <span className="w-10 text-center font-extrabold text-lg text-pink-600 dark:text-pink-400">
                          {maxMulheresPorTime}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          type="button"
                          onClick={() => setMaxMulheresPorTime(Math.min(12, maxMulheresPorTime + 1))}
                          className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                        >
                          +
                        </motion.button>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          mulher{maxMulheresPorTime !== 1 ? 'es' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Resumo Dinâmico da Composição */}
                  <div className="p-2 bg-amber-500/10 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                    🏐 <strong>Formação dos Times:</strong> Cada equipe terá <strong>{effectiveJogadoresPorTime} titulares</strong> ({maxHomensPorTime} homens + {maxMulheresPorTime} mulheres).
                    Total em quadra: <strong>{numTimes * maxHomensPorTime} homens</strong> + <strong>{numTimes * maxMulheresPorTime} mulheres</strong> em {numTimes} times.
                  </div>
                </div>
              </div>
            ) : (
              /* Configuração Padrão de Futebol */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantidade de Times
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNumTimes(Math.max(2, numTimes - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-extrabold text-lg text-brand-500">{numTimes}</span>
                    <button
                      type="button"
                      onClick={() => setNumTimes(Math.min(10, numTimes + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jogadores por Time
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setJogadoresPorTime(Math.max(1, jogadoresPorTime - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-extrabold text-lg text-brand-500">{jogadoresPorTime}</span>
                    <button
                      type="button"
                      onClick={() => setJogadoresPorTime(Math.min(22, jogadoresPorTime + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Suplentes */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vagas Extras (Suplentes / Lista de Espera)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVagasExtras(Math.max(0, vagasExtras - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-10 text-center font-extrabold text-lg text-slate-600 dark:text-slate-300">{vagasExtras}</span>
                <button
                  type="button"
                  onClick={() => setVagasExtras(vagasExtras + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800">
              Total de Vagas da Partida: <strong className={isVolei ? 'text-amber-500' : 'text-brand-500'}>{limiteCalculado} vagas</strong> ({numTimes * effectiveJogadoresPorTime} titulares + {vagasExtras} reservas)
            </div>
          </div>

          {isVolei && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/90 to-slate-950 border border-amber-500/30 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-black text-xs text-white uppercase tracking-wider block">
                    Regras do placar de vôlei
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    A regra fica registrada com a partida e aparece no placar ao vivo.
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                  12 pontos
                </span>
              </div>

              <label className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer">
                <span>
                  <span className="font-extrabold text-xs text-white block">
                    Exigir 2 pontos de vantagem para encerrar
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-relaxed">
                    {volleyRequiresTwoPointAdvantage
                      ? 'Ativa: 12 × 11 continua; 12 × 10 encerra.'
                      : 'Desativada: a primeira equipe a chegar a 12 pontos encerra o jogo.'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={volleyRequiresTwoPointAdvantage}
                  onChange={(event) => setVolleyRequiresTwoPointAdvantage(event.target.checked)}
                  className="sr-only peer"
                />
                <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  volleyRequiresTwoPointAdvantage ? 'bg-amber-500' : 'bg-slate-700'
                }`}>
                  <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    volleyRequiresTwoPointAdvantage ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </span>
              </label>
            </div>
          )}

          {/* ===== SEÇÃO DE CONFIGURAÇÕES DA PARTIDA (SOMENTE FUTEBOL - ITEM 1 DO REQUISITO) ===== */}
          {!isVolei && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 dark:border-emerald-500/20 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚙️</span>
                  <span className="font-black text-xs text-white uppercase tracking-wider">
                    Configurações da Partida de Futebol
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Interface Dinâmica
                </span>
              </div>

              {/* 1. Tempo da Partida */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>⏱️</span> Tempo por Etapa / Jogo:
                  </span>
                  <span className="text-xs font-black text-emerald-400">
                    {stageDurationMinutes} min
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 7, 8, 10, 12, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setStageDurationMinutes(mins)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        stageDurationMinutes === mins
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Registro de Gols (Sempre Ativado) */}
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚽</span>
                  <div>
                    <span className="font-extrabold text-xs text-white block">
                      Registro de Gols & Artilharia
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Sempre ativo para controle do placar e dos artilheiros
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                  OBRIGATÓRIO
                </span>
              </div>

              {/* 3. Toggle de Assistências */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                    <span>🎯</span> Registrar Assistências nos Gols?
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {trackAssists
                      ? '🟢 Ativado: Permite escolher o autor do passe após marcar o gol'
                      : '🔴 Desativado: Interface mais rápida (+ GOL → Jogador → Pronto)'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTrackAssists(false)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      !trackAssists
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-xs'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    OFF
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackAssists(true)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      trackAssists
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    ON
                  </button>
                </div>
              </div>

              {/* 4. Toggle de Cartões */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-xs text-white flex items-center gap-1.5">
                    <span>🟨🟥</span> Registrar Cartões (Amarelo / Vermelho)?
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {trackCards
                      ? '🟢 Ativado: Exibe botões de cartão e controle disciplinar'
                      : '🔴 Desativado: Não polui a tela com opções de cartões'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTrackCards(false)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      !trackCards
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-xs'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    OFF
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackCards(true)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      trackCards
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    ON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SEÇÃO: GERENCIAR JOGADORES INSCRITOS */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <div>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                    Lista de Jogadores ({participants.length} inscritos)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Cadastrar, renomear ou remover jogadores desta partida
                  </span>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={() => setIsPlayerManagerOpen(true)}
                className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Gerenciar Jogadores</span>
              </motion.button>
            </div>

            {participants.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {participants.slice(0, 8).map((p, idx) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-2xs"
                  >
                    <span className="text-emerald-500 font-black">{idx + 1}.</span>
                    <span>{p.user?.nome || p.guest_name || 'Jogador'}</span>
                  </span>
                ))}
                {participants.length > 8 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                    +{participants.length - 8} mais...
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Nenhum jogador cadastrado nesta partida ainda. Toque em "Gerenciar Jogadores" para cadastrar nomes.
              </p>
            )}
          </div>

          {/* SEÇÃO 4: Modo Raspadinha e Observações */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-white block">Sorteio por Raspadinha Virtual</span>
                  <span className="text-[11px] text-slate-400">Participantes raspam a tela para descobrir o time</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sorteioRaspadinhaAtivo}
                onChange={(e) => setSorteioRaspadinhaAtivo(e.target.checked)}
                className="w-5 h-5 rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observações / Regras da Partida
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Chegar 15 min antes, levar colete azul quem tiver..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            type="submit"
            form="edit-match-form"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
          </motion.button>
        </div>

        {/* Modal dedicado de gerenciamento de jogadores */}
        {match && (
          <MatchPlayerManagerModal
            isOpen={isPlayerManagerOpen}
            onClose={() => setIsPlayerManagerOpen(false)}
            match={match}
            participants={participants}
            onUpdate={() => {
              void fetchParticipants(match.id);
              if (onMatchUpdated) onMatchUpdated();
            }}
          />
        )}
      </div>
    </div>
  );
};
