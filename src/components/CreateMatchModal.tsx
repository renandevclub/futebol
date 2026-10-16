'use client';

import { motion } from 'framer-motion';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Calendar, MapPin, Clock, Users, DollarSign, FileText, CheckCircle2, Shield, Shuffle, UserPlus, PlusCircle, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CreateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatchCreated: () => void;
}

const TEAM_COLORS = [
  { name: 'Time A', color: 'bg-red-500', border: 'border-red-400', text: 'text-red-400', emoji: '🔴' },
  { name: 'Time B', color: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400', emoji: '🔵' },
  { name: 'Time C', color: 'bg-green-500', border: 'border-green-400', text: 'text-green-400', emoji: '🟢' },
  { name: 'Time D', color: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-400', emoji: '🟡' },
  { name: 'Time E', color: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-400', emoji: '🟣' },
  { name: 'Time F', color: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-400', emoji: '🟠' },
  { name: 'Time G', color: 'bg-pink-500', border: 'border-pink-400', text: 'text-pink-400', emoji: '🩷' },
  { name: 'Time H', color: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-400', emoji: '🩵' },
  { name: 'Time I', color: 'bg-indigo-500', border: 'border-indigo-400', text: 'text-indigo-400', emoji: '💜' },
  { name: 'Time J', color: 'bg-teal-500', border: 'border-teal-400', text: 'text-teal-400', emoji: '💚' },
];

import { LocationItem } from '@/types/database';
import { useLeague } from '@/context/LeagueContext';
import { addMultiplePlayersToMatch } from '@/lib/matchPlayersHelper';

export const CreateMatchModal: React.FC<CreateMatchModalProps> = ({
  isOpen,
  onClose,
  onMatchCreated,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { currentLeague, myLeagues, leagues, canManageLeague } = useLeague();

  const availableLeagues = isSuperAdmin ? leagues : myLeagues;
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');

  const [titulo, setTitulo] = useState('Futebol dos Amigos');
  const [local, setLocal] = useState('');
  const [endereco, setEndereco] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('19:30');
  const [valor, setValor] = useState('20.00');
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lista inicial de jogadores inscritos cadastrados pelo admin
  const [initialPlayers, setInitialPlayers] = useState<string[]>([]);
  const [newPlayerInput, setNewPlayerInput] = useState('');
  const [showBatchInitialPlayers, setShowBatchInitialPlayers] = useState(false);
  const [batchPlayersText, setBatchPlayersText] = useState('');
  const [locations, setLocations] = useState<LocationItem[]>([
    { id: '1', nome: 'Arena Society 10', maps_url: 'https://maps.app.goo.gl/Muxi7iWHoeY2PkTB8' },
    { id: '2', nome: 'Centro Esportivo Futsal Central', maps_url: 'https://maps.app.goo.gl/axspwsn9hK2kAek19' },
  ]);

  useEffect(() => {
    if (isOpen) {
      // Definir liga inicial (apenas se for uma liga que o usuário tem permissão para gerenciar)
      const canManageCurrent = currentLeague && availableLeagues.some((l) => l.id === currentLeague.id);
      if (canManageCurrent && currentLeague) {
        setSelectedLeagueId(currentLeague.id);
        if (currentLeague.chave_pix_padrao) setChavePix(currentLeague.chave_pix_padrao);
        if (currentLeague.nome_recebedor_pix) setNomeRecebedor(currentLeague.nome_recebedor_pix);
      } else if (availableLeagues.length > 0) {
        setSelectedLeagueId(availableLeagues[0].id);
        if (availableLeagues[0].chave_pix_padrao) setChavePix(availableLeagues[0].chave_pix_padrao);
        if (availableLeagues[0].nome_recebedor_pix) setNomeRecebedor(availableLeagues[0].nome_recebedor_pix);
      }

      if (typeof window !== 'undefined') {
        const savedKey = localStorage.getItem('futresenha_chave_pix');
        const savedName = localStorage.getItem('futresenha_nome_pix');
        if (savedKey && !chavePix) setChavePix(savedKey);
        if (savedName && !nomeRecebedor) setNomeRecebedor(savedName);
      }

      const activeSport = currentLeague?.sport_type || availableLeagues[0]?.sport_type || 'futebol';
      if (activeSport === 'volei') {
        setTitulo((prev) => (prev === 'Futebol dos Amigos' || !prev ? 'Vôlei dos Amigos' : prev));
        setMaxHomensPorTime(3);
        setMaxMulheresPorTime(2);
        setJogadoresPorTime(5);
        setMinMulheresPorTime(2);
      } else {
        setTitulo((prev) => (prev === 'Vôlei dos Amigos' || !prev ? 'Futebol dos Amigos' : prev));
        setJogadoresPorTime(6);
        setMinMulheresPorTime(0);
      }

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
      fetchLocations();
    }
  }, [isOpen, currentLeague, availableLeagues]);

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
    const targetId = selectedLeagueId || currentLeague?.id;
    return availableLeagues.find((l) => l.id === targetId) || leagues.find((l) => l.id === targetId) || null;
  }, [selectedLeagueId, currentLeague, availableLeagues, leagues]);

  const isSelectedLeagueBlocked = !isSuperAdmin && currentSelectedLeague?.is_blocked === true;
  const leagueSportType = currentSelectedLeague?.sport_type || 'futebol';
  const isVolei = leagueSportType === 'volei';

  const effectiveJogadoresPorTime = useMemo(() => {
    if (isVolei) {
      return maxHomensPorTime + maxMulheresPorTime;
    }
    return jogadoresPorTime;
  }, [isVolei, maxHomensPorTime, maxMulheresPorTime, jogadoresPorTime]);

  const limiteCalculado = useMemo(() => {
    return numTimes * effectiveJogadoresPorTime + vagasExtras;
  }, [numTimes, effectiveJogadoresPorTime, vagasExtras]);

  if (!isOpen || (!isSuperAdmin && availableLeagues.length === 0)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSelectedLeagueBlocked) {
      toast.error('Não é possível criar partidas: a liga selecionada está bloqueada pelo Super Administrador.');
      return;
    }

    if (!titulo.trim() || !local.trim() || !data || !horario) {
      toast.error('Preencha os campos obrigatórios (*).');
      return;
    }

    const targetLeagueId = selectedLeagueId || currentLeague?.id;

    if (!targetLeagueId) {
      toast.error('Selecione uma Liga para vincular a partida.');
      return;
    }

    if (!canManageLeague(targetLeagueId)) {
      toast.error('Acesso negado: Você não possui permissão de administrador para esta liga.');
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
      if (typeof window !== 'undefined' && chavePix.trim()) {
        localStorage.setItem('futresenha_chave_pix', chavePix.trim());
        if (nomeRecebedor.trim()) localStorage.setItem('futresenha_nome_pix', nomeRecebedor.trim());
      }

      const matchPayload: Record<string, any> = {
        titulo: titulo.trim(),
        organization_id: targetLeagueId,
        sport_type: leagueSportType,
        local: local.trim(),
        endereco: endereco.trim() || null,
        maps_url: mapsUrl.trim() || null,
        data,
        horario,
        valor: parseFloat(valor) || 0,
        custo_aluguel: isNaN(parseFloat(custoAluguel)) ? 0 : Math.max(0, parseFloat(custoAluguel)),
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
        status: 'agendada',
        match_rules: !isVolei
          ? {
              track_assists: trackAssists,
              track_cards: trackCards,
              stage_duration_minutes: stageDurationMinutes,
              stages_count: stagesCount,
            }
          : null,
        teams_custom_config: isVolei
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
            },
      };

      let { data: createdMatch, error } = await supabase
        .from('matches')
        .insert(matchPayload)
        .select()
        .single();

      // Fallback resiliente caso alguma coluna nova não exista ainda no banco
      if (error && (error.message?.includes('max_homens_por_time') || error.message?.includes('max_mulheres_por_time') || error.message?.includes('sport_type') || error.message?.includes('custo_aluguel'))) {
        delete matchPayload.max_homens_por_time;
        delete matchPayload.max_mulheres_por_time;
        if (error.message?.includes('sport_type')) {
          delete matchPayload.sport_type;
        }
        if (error.message?.includes('custo_aluguel')) {
          delete matchPayload.custo_aluguel;
        }
        const retry = await supabase.from('matches').insert(matchPayload).select().single();
        createdMatch = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Erro ao agendar partida:', error);
        toast.error('Erro ao salvar partida.');
      } else {
        // Se houver jogadores adicionados na lista inicial, cadastrar na partida e na liga
        if (createdMatch && initialPlayers.length > 0) {
          try {
            await addMultiplePlayersToMatch({
              matchId: createdMatch.id,
              leagueId: targetLeagueId,
              playerNames: initialPlayers,
            });
          } catch (pErr) {
            console.error('Erro ao adicionar jogadores iniciais:', pErr);
          }
        }

        toast.success(isVolei ? 'Partida de vôlei agendada com sucesso! 🏐' : 'Partida de futebol agendada com sucesso! ⚽');

        // Resetar estados
        setInitialPlayers([]);
        setNewPlayerInput('');
        setBatchPlayersText('');

        // Notificar jogadores cadastrados
        void (async () => {
          try {
            const { data: allProfiles } = await supabase.from('profiles').select('id');
            if (allProfiles && allProfiles.length > 0 && createdMatch) {
              const ids = allProfiles.map((p) => p.id);
              const { notifyMatchCreated } = await import('@/lib/notificationDispatcher');
              await notifyMatchCreated(createdMatch as any, ids);
            }
          } catch (e) {
            console.error('Erro ao notificar jogadores:', e);
          }
        })();

        onMatchCreated();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar partida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.75rem] w-full max-w-xl p-4 sm:p-6 shadow-2xl relative max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <motion.button
          whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </motion.button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0 pr-10">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shrink-0 ${
            isVolei ? 'bg-amber-500 shadow-amber-500/25' : 'bg-emerald-500 shadow-emerald-500/25'
          }`}>
            <span className="text-base">{isVolei ? '🏐' : '⚽'}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`block text-[10px] font-extrabold uppercase tracking-wider ${
                isVolei ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {isVolei ? 'Partida de Vôlei' : 'Partida de Futebol'}
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                isVolei ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                Modalidade Herdada
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
              {isVolei ? 'Agendar Nova Partida de Vôlei' : 'Agendar Nova Partida de Futebol'}
            </h2>
            <p className="text-xs text-slate-400">
              Preencha as informações para abrir a lista de inscritos.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1 space-y-4 text-[11px] sm:text-xs">
          {/* Seletor / Destaque da Liga e Modalidade */}
          <div className={`p-3.5 rounded-2xl border space-y-2.5 ${
            isVolei
              ? 'bg-amber-500/5 dark:bg-amber-950/30 border-amber-500/25'
              : 'bg-emerald-500/5 dark:bg-emerald-950/30 border-emerald-500/25'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                isVolei ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                🏆 Liga Vinculada *
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                isVolei ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isVolei ? '🏐 Modalidade: Vôlei' : '⚽ Modalidade: Futebol'}
              </span>
            </div>

            {availableLeagues.length > 1 ? (
              <select
                value={selectedLeagueId}
                onChange={(e) => {
                  setSelectedLeagueId(e.target.value);
                  const found = availableLeagues.find((l) => l.id === e.target.value);
                  if (found) {
                    if (found.chave_pix_padrao) setChavePix(found.chave_pix_padrao);
                    if (found.nome_recebedor_pix) setNomeRecebedor(found.nome_recebedor_pix);
                    if (found.sport_type === 'volei') {
                      setTitulo((prev) => (prev === 'Futebol dos Amigos' ? 'Vôlei dos Amigos' : prev));
                    } else {
                      setTitulo((prev) => (prev === 'Vôlei dos Amigos' ? 'Futebol dos Amigos' : prev));
                    }
                  }
                }}
                className={`w-full min-h-10 px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none ${
                  isVolei ? 'border-amber-500/40 focus:ring-amber-500' : 'border-emerald-500/40 focus:ring-emerald-500'
                }`}
              >
                {availableLeagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>
                    {lg.sport_type === 'volei' ? '🏐' : '⚽'} {lg.name} ({lg.sport_type === 'volei' ? 'Vôlei' : 'Futebol'}) {lg.is_blocked ? '🔒 (BLOQUEADA)' : ''} — {lg.owner?.nome || 'Admin'}
                  </option>
                ))}
              </select>
            ) : availableLeagues.length === 1 ? (
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl">{isVolei ? '🏐' : '⚽'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {availableLeagues[0].name}
                      </span>
                      <span className={`text-[10px] font-bold ${isVolei ? 'text-amber-500' : 'text-emerald-500'}`}>
                        ({isVolei ? 'Liga de Vôlei' : 'Liga de Futebol'})
                      </span>
                      {availableLeagues[0].is_blocked && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-500/30">
                          BLOQUEADA 🔒
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      👤 {(() => {
                        const admins = availableLeagues[0].admins && availableLeagues[0].admins.length > 0
                          ? availableLeagues[0].admins
                          : (availableLeagues[0].owner ? [availableLeagues[0].owner] : []);
                        const label = admins.length > 1 ? 'Administradores' : 'Administrador';
                        const names = admins.map(a => a.nome).join(', ');
                        return `${label}: ${names || 'Organizador'}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                ⚠️ Nenhuma liga encontrada. Crie uma liga primeiro.
              </p>
            )}

            {/* Aviso quando a liga selecionada estiver bloqueada */}
            {isSelectedLeagueBlocked && (
              <div className="mt-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-xs text-red-600 dark:text-red-400">
                    Liga Bloqueada pelo Super Administrador
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Esta liga está temporariamente suspensa. O agendamento de novas partidas está bloqueado.
                  </p>
                  <a
                    href={`https://wa.me/5591993370456?text=${encodeURIComponent(
                      `Olá, Super Administrador! Minha liga "${currentSelectedLeague?.name}" está bloqueada e gostaria de solicitar esclarecimentos e a liberação para criar partidas.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[11px] font-bold text-red-600 dark:text-red-400 underline hover:opacity-80"
                  >
                    Falar com o Super Administrador
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center">1</span>
            Informações principais
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Título da Partida <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Futebol de Domingo ou Futebol dos Amigos"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
            />
          </div>

          {/* Seleção de Locais Cadastrados */}
          <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
            <label className="block font-extrabold text-slate-800 dark:text-slate-200 text-xs">
              📍 Selecionar Local Pré-cadastrado:
            </label>
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none]">
              {locations.map((loc) => (
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  key={loc.id || loc.nome}
                  type="button"
                  onClick={() => handleSelectPredefinedLocation(loc.nome)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    local === loc.nome
                      ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-400'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{loc.nome}</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="grid grid-grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nome do Campo / Arena <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Arena Society 10"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Link do Google Maps (GPS)
              </label>
              <input
                type="url"
                placeholder="https://maps.app.goo.gl/..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white truncate"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Endereço / Referência (Opcional)
            </label>
            <input
              type="text"
              placeholder="Rua, número, bairro..."
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
            />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center">2</span>
              Data e contribuição
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Horário <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
                />
              </div>
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
                  placeholder="20.00"
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
                  placeholder="Ex: 180.00 (opcional)"
                  value={custoAluguel}
                  onChange={(e) => setCustoAluguel(e.target.value)}
                  className="w-full min-h-10 pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Chave PIX da Partida 🔑
            </label>
            <input
              type="text"
              placeholder="CPF, CNPJ, Celular, E-mail..."
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className="w-full min-h-10 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white"
            />
          </div>

          {/* ===== SEÇÃO DE CONFIGURAÇÃO DE TIMES ===== */}
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
                  {isVolei ? '🏐 Escalação & Composição do Vôlei' : 'Escalação & Configuração de Times'}
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
                      Jogadores por Time <span className="text-red-500">*</span>
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

                {/* Mínimo de Jogadoras por Time (Futebol) */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                      ♀️ Mínimo de Jogadoras (Feminino) por Time
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Garante distribuição equilibrada no sorteio de times mistos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      type="button"
                      onClick={() => setMinMulheresPorTime(Math.max(0, minMulheresPorTime - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                    >
                      −
                    </motion.button>
                    <span className="w-10 text-center font-extrabold text-lg text-pink-600 dark:text-pink-400">{minMulheresPorTime}</span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      type="button"
                      onClick={() => setMinMulheresPorTime(Math.min(jogadoresPorTime, minMulheresPorTime + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                    >
                      +
                    </motion.button>
                    <span className="text-[10px] text-slate-400 font-medium">jogadora{minMulheresPorTime !== 1 ? 's' : ''} por time</span>
                  </div>
                </div>
              </div>
            )}

            {/* Prévia dos times */}
            <div className="flex flex-nowrap gap-1.5 mt-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {Array.from({ length: numTimes }).map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border shrink-0 ${TEAM_COLORS[i]?.border || 'border-slate-400'} bg-white/50 dark:bg-slate-800/50`}
                >
                  <span className="text-xs">{TEAM_COLORS[i]?.emoji || '⚪'}</span>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    {TEAM_COLORS[i]?.name || `Time ${i + 1}`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({effectiveJogadoresPorTime} {isVolei ? `${maxHomensPorTime}H+${maxMulheresPorTime}M` : ''})
                  </span>
                </div>
              ))}
            </div>

            {/* Vagas extras (suplentes) */}
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

            {/* Resumo calculado */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Users className={`w-4 h-4 ${isVolei ? 'text-amber-500' : 'text-brand-500'}`} />
                <span className="font-bold">Resumo da Partida:</span>
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className={`font-extrabold ${isVolei ? 'text-amber-500' : 'text-brand-500'}`}>{numTimes}</span> times × <span className={`font-extrabold ${isVolei ? 'text-amber-500' : 'text-brand-500'}`}>{effectiveJogadoresPorTime}</span> jogadores = <span className="font-extrabold text-slate-900 dark:text-white">{numTimes * effectiveJogadoresPorTime}</span> jogadores titulares
                {vagasExtras > 0 && (
                  <> + <span className="font-extrabold text-amber-500">{vagasExtras}</span> suplente{vagasExtras > 1 ? 's' : ''}</>
                )}
                {' '}= <span className="font-extrabold text-emerald-500 text-sm">{limiteCalculado} vagas totais</span>
              </p>
            </div>
          </div>

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

          {/* ===== SEÇÃO: ADICIONAR JOGADORES NA LISTA DA PARTIDA (OPCIONAL) ===== */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Jogadores Inscritos ({initialPlayers.length} / {limiteCalculado})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchInitialPlayers(!showBatchInitialPlayers)}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {showBatchInitialPlayers ? 'Modo Rápido' : 'Colar Vários Nomes'}
              </button>
            </div>

            {!showBatchInitialPlayers ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlayerInput}
                  onChange={(e) => setNewPlayerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const name = newPlayerInput.trim();
                      if (name && !initialPlayers.includes(name)) {
                        setInitialPlayers([...initialPlayers, name]);
                        setNewPlayerInput('');
                      }
                    }
                  }}
                  placeholder="Nome do jogador (Ex: Renan Lima)"
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newPlayerInput.trim();
                    if (name && !initialPlayers.includes(name)) {
                      setInitialPlayers([...initialPlayers, name]);
                      setNewPlayerInput('');
                    }
                  }}
                  disabled={!newPlayerInput.trim()}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={batchPlayersText}
                  onChange={(e) => setBatchPlayersText(e.target.value)}
                  placeholder="Cole os nomes separados por linha ou vírgula:&#10;Renan Lima&#10;João&#10;Carlos"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const names = batchPlayersText
                        .split(/[\n,;]+/)
                        .map((n) => n.trim())
                        .filter((n) => n.length > 0);
                      const unique = Array.from(new Set([...initialPlayers, ...names]));
                      setInitialPlayers(unique);
                      setBatchPlayersText('');
                      setShowBatchInitialPlayers(false);
                      toast.success(`${names.length} nomes adicionados à lista inicial!`);
                    }}
                    className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg"
                  >
                    Confirmar Lista
                  </button>
                </div>
              </div>
            )}

            {/* Lista dos jogadores adicionados */}
            {initialPlayers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {initialPlayers.map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-200 shadow-2xs"
                  >
                    <span className="text-emerald-500 font-black">{idx + 1}.</span>
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => setInitialPlayers(initialPlayers.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500 p-0.5 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observações ou Avisos
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Levar chuteira society/futsal, garrafa de água e chegar 15 min antes."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 text-[13px] text-slate-900 dark:text-white resize-none"
            />
          </div>

          <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              type="submit"
              disabled={isSubmitting || isSelectedLeagueBlocked}
              className={`w-full min-h-11 py-3 text-white font-bold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-1.5 ${
                isSelectedLeagueBlocked
                  ? 'bg-red-500/80 cursor-not-allowed opacity-80 shadow-red-500/20'
                  : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/25 disabled:opacity-50'
              }`}
            >
              {isSelectedLeagueBlocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Liga Bloqueada (Criação Suspensa)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Criar e Divulgar Partida'}</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
};
