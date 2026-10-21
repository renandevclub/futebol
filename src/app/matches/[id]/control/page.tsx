'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import { Match, MatchGame, MatchGameGoal, MatchParticipant, Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTables } from '@/lib/realtime';
import { getTeamInfo as getTeamInfoFromHelper } from '@/lib/teamsHelper';
import { VolleyQuickPointModal } from '@/components/VolleyQuickPointModal';
import { SoccerQuickGoalModal } from '@/components/SoccerQuickGoalModal';
import { SoccerCardModal } from '@/components/SoccerCardModal';
import { ManualScoreAdjustModal } from '@/components/ManualScoreAdjustModal';
import { EditTeamsModal } from '@/components/EditTeamsModal';
import { TeamBadge } from '@/components/TeamBadge';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import { ChampionModal } from '@/components/ChampionModal';
import { getMatchChampionData, MatchChampionResult } from '@/lib/championHelper';
import { notifyGameStarted, notifyGoalScored, notifyChampionDeclared } from '@/lib/notificationDispatcher';
import { getVolleyWinnerSide, getVolleyWinRuleLabel } from '@/lib/volleyballRules';
import { useLeague } from '@/context/LeagueContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Plus,
  Minus,
  Undo2,
  Trash2,
  Clock,
  Shield,
  CheckCircle2,
  Flame,
  Swords,
  Tv,
  MessageCircle,
  Palette,
  ArrowLeft,
  Zap,
  History,
  Crown,
  Settings,
  ChevronDown,
  ChevronUp,
  Edit3,
  Award,
  Target,
  ArrowRightLeft,
} from 'lucide-react';

const PRESET_DURATIONS = [5, 7, 8, 10, 12, 15, 20];
const VOLLEY_TARGET_SCORES = [12, 15, 21, 25];

export default function MatchControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, isLoading: isAuthLoading } = useAuth();
  const { canManageMatch } = useLeague();

  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [allGames, setAllGames] = useState<MatchGame[]>([]);
  const [activeGame, setActiveGame] = useState<MatchGame | null>(null);
  const [goals, setGoals] = useState<MatchGameGoal[]>([]);
  const [allMatchGoals, setAllMatchGoals] = useState<MatchGameGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Regras persistidas da partida (Futebol e Vôlei)
  const matchRules = useMemo(() => {
    return match?.match_rules || (match?.teams_custom_config as any)?.match_rules || {};
  }, [match]);

  const trackAssists = !!matchRules.track_assists;
  const trackCards = !!matchRules.track_cards;
  const defaultStageDuration = matchRules.stage_duration_minutes || 10;
  const volleyRequiresTwoPointAdvantage = matchRules.volley_requires_two_point_advantage === true;

  // Estados de criação de novo jogo
  const [selectedTeamA, setSelectedTeamA] = useState<number>(1);
  const [selectedTeamB, setSelectedTeamB] = useState<number>(2);
  const [twoGoalsRule, setTwoGoalsRule] = useState<boolean>(true);
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(defaultStageDuration);
  const [targetVolleyScore, setTargetVolleyScore] = useState<number>(12);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  // Modais de Pontuação / Gol
  const [isSoccerGoalModalOpen, setIsSoccerGoalModalOpen] = useState(false);
  const [isSoccerCardModalOpen, setIsSoccerCardModalOpen] = useState(false);
  const [isVolleyModalOpen, setIsVolleyModalOpen] = useState(false);
  const [goalTeamNumber, setGoalTeamNumber] = useState<number>(1);
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);

  // Edição de evento individual
  const [editingPointGoal, setEditingPointGoal] = useState<MatchGameGoal | null>(null);

  // Modal de Ajuste Manual de Placar
  const [isAdjustScoreModalOpen, setIsAdjustScoreModalOpen] = useState(false);

  // Modais de Times, Campeão, Imagens
  const [isEditTeamsOpen, setIsEditTeamsOpen] = useState(false);
  const [isChampionModalOpen, setIsChampionModalOpen] = useState(false);
  const [championData, setChampionData] = useState<MatchChampionResult | null>(null);
  const [championLoading, setChampionLoading] = useState(false);
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  // Acordeões da UI
  const [isHistoryAccordionOpen, setIsHistoryAccordionOpen] = useState(false);
  const [expandedGameDetailsId, setExpandedGameDetailsId] = useState<string | null>(null);

  // Cronômetro (apenas futebol)
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAutoFinishingRef = useRef<boolean>(false);
  const [showFinishedGameDetails, setShowFinishedGameDetails] = useState<boolean>(false);

  const openImagePreview = (previewData: Omit<LightboxPreviewData, 'isOpen'>) => {
    setLightboxData({ ...previewData, isOpen: true });
  };

  const closeImagePreview = () => {
    setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null));
  };

  const isVolei = match?.sport_type === 'volei' || match?.organization?.sport_type === 'volei';

  // ═══════════════════════════════════════════════════════════════════
  // CARREGAR DADOS DA PARTIDA E CONFRONTOS
  // ═══════════════════════════════════════════════════════════════════
  const fetchControlData = async () => {
    try {
      // 1. Dados da partida
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          organization:organization_id(*, owner:owner_id(*))
        `)
        .eq('id', id)
        .single();

      if (matchError || !matchData) {
        toast.error('Partida não encontrada.');
        router.push('/');
        return;
      }

      setMatch(matchData);

      // 2. Participantes
      const { data: partsData } = await supabase
        .from('match_participants')
        .select(`
          *,
          user:user_id(*)
        `)
        .eq('match_id', id)
        .order('created_at', { ascending: true });

      setParticipants(partsData || []);

      // 3. Jogos da partida
      const { data: gamesData, error: gamesError } = await supabase
        .from('match_games')
        .select('*')
        .eq('match_id', id)
        .order('game_number', { ascending: false });

      // 4. Todos os gols / pontos / cartões da rodada
      const { data: allGoalsData } = await supabase
        .from('match_game_goals')
        .select(`
          *,
          player:player_id(*),
          assist_player:assist_player_id(*)
        `)
        .eq('match_id', id)
        .order('created_at', { ascending: true });

      setAllMatchGoals(allGoalsData || []);

      if (!gamesError) {
        setAllGames(gamesData || []);
        const currentGame = gamesData?.find((g) => g.status !== 'finished') || gamesData?.[0] || null;
        setActiveGame(currentGame);

        if (currentGame?.status === 'finished') {
          suggestNextTeams(currentGame);
        }

        if (currentGame && allGoalsData) {
          const gameGoals = allGoalsData.filter((g) => g.game_id === currentGame.id);
          setGoals(gameGoals);
        } else {
          setGoals([]);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar painel de controle:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchControlData();

    const unsubscribe = subscribeToTables(
      `match_control_${id}`,
      [
        { table: 'matches', filter: `id=eq.${id}` },
        { table: 'match_games', filter: `match_id=eq.${id}` },
        { table: 'match_game_goals', filter: `match_id=eq.${id}` },
        { table: 'match_participants', filter: `match_id=eq.${id}` },
      ],
      () => {
        void fetchControlData();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [id]);

  // Sincronizar duração pré-definida nas regras pelo administrador
  useEffect(() => {
    if (matchRules?.stage_duration_minutes) {
      setTargetDurationMinutes(matchRules.stage_duration_minutes);
    }
  }, [matchRules?.stage_duration_minutes]);

  // Sugestão inteligente de times para o próximo confronto ("Quem ganha fica")
  const suggestNextTeams = (finishedGame: MatchGame | null, winnerTeam?: number | null) => {
    const totalTimes = match?.num_times || 4;
    if (!finishedGame || totalTimes <= 2) {
      setSelectedTeamA(1);
      setSelectedTeamB(2);
      return;
    }

    const winner = winnerTeam !== undefined ? winnerTeam : finishedGame.winner_team;
    // O vencedor (ou time A em caso de empate) permanece em campo como Mandante
    const stayingTeam = winner || finishedGame.team_a;
    const leavingTeam = stayingTeam === finishedGame.team_a ? finishedGame.team_b : finishedGame.team_a;

    // Próximo time na fila de rotação
    let nextTeam = (leavingTeam % totalTimes) + 1;
    if (nextTeam === stayingTeam) {
      nextTeam = (nextTeam % totalTimes) + 1;
    }

    setSelectedTeamA(stayingTeam);
    setSelectedTeamB(nextTeam);
  };

  const handleSwapTeams = () => {
    setSelectedTeamA(selectedTeamB);
    setSelectedTeamB(selectedTeamA);
  };

  // Finalização automática ao estourar o tempo do cronômetro
  const triggerAutoFinishGame = async (finalSecs: number, gameToFinish: MatchGame) => {
    if (isAutoFinishingRef.current || gameToFinish.status === 'finished') return;
    isAutoFinishingRef.current = true;

    try {
      const isDraw = gameToFinish.score_a === gameToFinish.score_b;
      let winner: number | null = null;
      if (gameToFinish.score_a > gameToFinish.score_b) winner = gameToFinish.team_a;
      else if (gameToFinish.score_b > gameToFinish.score_a) winner = gameToFinish.team_b;

      const { error } = await supabase
        .from('match_games')
        .update({
          status: 'finished',
          winner_team: winner,
          is_draw: isDraw,
          timer_is_running: false,
          duration_seconds: finalSecs,
          timer_started_at: null,
          ended_at: new Date().toISOString(),
        })
        .eq('id', gameToFinish.id);

      if (!error) {
        const teamAInfo = getTeamInfo(gameToFinish.team_a);
        const teamBInfo = getTeamInfo(gameToFinish.team_b);
        const winnerName = winner === gameToFinish.team_a ? teamAInfo.name : winner === gameToFinish.team_b ? teamBInfo.name : null;

        if (isDraw) {
          toast.success(`⏱️ TEMPO ESGOTADO! Confronto #${gameToFinish.game_number} finalizado automaticamente em Empate (${gameToFinish.score_a} × ${gameToFinish.score_b})! 🏁`, {
            duration: 6000,
          });
        } else {
          toast.success(`⏱️ TEMPO ESGOTADO! Confronto #${gameToFinish.game_number} finalizado automaticamente! Vitória do ${winnerName}! 🏆`, {
            duration: 6000,
          });
        }

        suggestNextTeams(gameToFinish, winner);
        void fetchControlData();
      }
    } catch (e) {
      console.error('Erro ao finalizar automaticamente por tempo:', e);
    } finally {
      setTimeout(() => {
        isAutoFinishingRef.current = false;
      }, 1500);
    }
  };

  // Cronômetro Sincronizado (Somente para Futebol) com Finalização Automática
  useEffect(() => {
    if (isVolei || !activeGame || activeGame.status === 'finished') {
      setCurrentSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const targetSecs = (activeGame.target_duration_minutes || defaultStageDuration) * 60;

    const calculateCurrentTime = () => {
      if (activeGame.timer_is_running && activeGame.timer_started_at) {
        const elapsedSinceStart = Math.floor(
          (Date.now() - new Date(activeGame.timer_started_at).getTime()) / 1000
        );
        return Math.max(0, activeGame.duration_seconds + elapsedSinceStart);
      }
      return activeGame.duration_seconds;
    };

    const initialSecs = calculateCurrentTime();
    setCurrentSeconds(initialSecs);

    // Se ao carregar o tempo já foi atingido e o jogo ainda não está finalizado:
    if (targetSecs > 0 && initialSecs >= targetSecs && !isAutoFinishingRef.current) {
      void triggerAutoFinishGame(initialSecs, activeGame);
      return;
    }

    if (activeGame.timer_is_running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const secs = calculateCurrentTime();
        setCurrentSeconds(secs);

        // Finalização automática assim que atingir a duração configurada
        if (targetSecs > 0 && secs >= targetSecs && !isAutoFinishingRef.current) {
          if (timerRef.current) clearInterval(timerRef.current);
          void triggerAutoFinishGame(secs, activeGame);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVolei, activeGame?.id, activeGame?.status, activeGame?.timer_is_running, activeGame?.timer_started_at, activeGame?.duration_seconds, activeGame?.target_duration_minutes, defaultStageDuration]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatEventTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  // Mapeamento de participantes por time
  const teamParticipantsMap = useMemo(() => {
    const map: Record<number, MatchParticipant[]> = {};
    const totalTimes = match?.num_times || 4;
    for (let i = 1; i <= totalTimes; i++) {
      map[i] = [];
    }
    participants.forEach((p) => {
      if (p.team && map[p.team]) {
        map[p.team].push(p);
      }
    });
    return map;
  }, [participants, match?.num_times]);

  const getTeamInfo = (teamNum: number) => {
    return getTeamInfoFromHelper(match, teamNum);
  };

  // Permissões contextuais da Liga da Partida
  const isAuthorized = useMemo(() => {
    return canManageMatch(match);
  }, [canManageMatch, match]);

  // Pontuação meta do vôlei
  const currentVolleyTarget = useMemo(() => {
    if (!activeGame) return targetVolleyScore || 12;
    return activeGame.target_duration_minutes || 12;
  }, [activeGame, targetVolleyScore]);

  // Filtragem de gols (exclui cartões)
  const actualGoals = useMemo(() => {
    return goals.filter((g) => g.point_type !== 'card');
  }, [goals]);

  // Filtragem de cartões
  const cardEvents = useMemo(() => {
    return goals.filter((g) => g.point_type === 'card');
  }, [goals]);

  // Estatísticas individuais da partida atual (Gols, Assistências se ON, Cartões se ON)
  const activeGameStats = useMemo(() => {
    const scorersMap: Record<string, { player: Profile | null; count: number; team: number }> = {};
    const assistsMap: Record<string, { player: Profile | null; count: number; team: number }> = {};
    const yellowCardsMap: Record<string, { player: Profile | null; count: number; team: number }> = {};
    const redCardsMap: Record<string, { player: Profile | null; count: number; team: number }> = {};

    goals.forEach((g) => {
      if (g.point_type === 'card') {
        const pKey = g.player_id || `unidentified_card_${g.team}`;
        if (g.card_type === 'yellow') {
          if (!yellowCardsMap[pKey]) yellowCardsMap[pKey] = { player: g.player || null, count: 0, team: g.team };
          yellowCardsMap[pKey].count += 1;
        } else if (g.card_type === 'red') {
          if (!redCardsMap[pKey]) redCardsMap[pKey] = { player: g.player || null, count: 0, team: g.team };
          redCardsMap[pKey].count += 1;
        }
      } else {
        // Gol / Ponto
        const pKey = g.player_id || `unidentified_goal_${g.team}`;
        if (!scorersMap[pKey]) scorersMap[pKey] = { player: g.player || null, count: 0, team: g.team };
        scorersMap[pKey].count += 1;

        // Assistência
        if (trackAssists && g.assist_player_id) {
          const aKey = g.assist_player_id;
          if (!assistsMap[aKey]) assistsMap[aKey] = { player: g.assist_player || null, count: 0, team: g.team };
          assistsMap[aKey].count += 1;
        }
      }
    });

    return {
      scorers: Object.entries(scorersMap).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.count - a.count),
      assists: Object.entries(assistsMap).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.count - a.count),
      yellowCards: Object.entries(yellowCardsMap).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.count - a.count),
      redCards: Object.entries(redCardsMap).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.count - a.count),
    };
  }, [goals, trackAssists]);

  // Último evento registrado na partida
  const lastEvent = useMemo(() => {
    if (!goals || goals.length === 0) return null;
    return goals[goals.length - 1];
  }, [goals]);

  // ═══════════════════════════════════════════════════════════════════
  // AÇÕES DO ADMINISTRADOR NA PARTIDA AO VIVO
  // ═══════════════════════════════════════════════════════════════════

  // 1. Iniciar Novo Confronto
  const handleStartNewGame = async () => {
    if (!isAuthorized) return;
    if (selectedTeamA === selectedTeamB) {
      toast.error('Selecione dois times diferentes para o confronto!');
      return;
    }

    setIsCreatingGame(true);
    try {
      const nextGameNumber = (allGames[0]?.game_number || 0) + 1;
      const isVoleiGame = match?.sport_type === 'volei' || match?.organization?.sport_type === 'volei';

      const { data, error } = await supabase
        .from('match_games')
        .insert({
          match_id: match!.id,
          game_number: nextGameNumber,
          team_a: selectedTeamA,
          team_b: selectedTeamB,
          score_a: 0,
          score_b: 0,
          status: 'in_progress',
          two_goals_rule: isVoleiGame ? false : twoGoalsRule,
          target_duration_minutes: isVoleiGame ? targetVolleyScore : (matchRules?.stage_duration_minutes || targetDurationMinutes),
          duration_seconds: 0,
          timer_started_at: isVoleiGame ? null : new Date().toISOString(),
          timer_is_running: isVoleiGame ? false : true,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao iniciar jogo: ' + error.message);
      } else {
        toast.success(
          isVoleiGame
            ? `Jogo de Vôlei #${nextGameNumber} iniciado! 🏐`
            : `Jogo #${nextGameNumber} iniciado com sucesso! ⚽`
        );
        setActiveGame(data);
        setGoals([]);
        void fetchControlData();

        // Notificar participantes sobre início do jogo
        if (match && participants.length > 0) {
          const participantIds = participants.map((p) => p.user_id).filter((id): id is string => !!id);
          const teamAInfo = getTeamInfo(selectedTeamA);
          const teamBInfo = getTeamInfo(selectedTeamB);
          void notifyGameStarted(match, nextGameNumber, teamAInfo.name, teamBInfo.name, participantIds);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar jogo.');
    } finally {
      setIsCreatingGame(false);
    }
  };

  // 2. Registro Rápido de Ponto no Vôlei (2 Toques)
  const handleQuickVolleyPoint = async (playerId: string | null) => {
    if (!isAuthorized || !activeGame || !match || activeGame.status === 'finished') return;
    setIsSubmittingGoal(true);
    setIsVolleyModalOpen(false);

    try {
      const isTeamA = goalTeamNumber === activeGame.team_a;
      const newScoreA = isTeamA ? activeGame.score_a + 1 : activeGame.score_a;
      const newScoreB = !isTeamA ? activeGame.score_b + 1 : activeGame.score_b;
      const targetScore = activeGame.target_duration_minutes || 12;

      const { error: pointError } = await supabase.from('match_game_goals').insert({
        game_id: activeGame.id,
        match_id: match.id,
        team: goalTeamNumber,
        player_id: playerId,
        minute: 1,
        point_type: 'point',
      });

      if (pointError) {
        toast.error('Erro ao salvar ponto: ' + pointError.message);
        return;
      }

      const volleyWinnerSide = getVolleyWinnerSide(newScoreA, newScoreB, {
        targetScore,
        requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
      });
      const isVolleyWon = volleyWinnerSide !== null;
      const volleyWinner = volleyWinnerSide === 'a'
        ? activeGame.team_a
        : volleyWinnerSide === 'b'
          ? activeGame.team_b
          : null;

      let updatePayload: Partial<MatchGame> = {
        score_a: newScoreA,
        score_b: newScoreB,
      };

      if (isVolleyWon) {
        updatePayload = {
          ...updatePayload,
          status: 'finished',
          winner_team: volleyWinner,
          is_draw: false,
          timer_is_running: false,
          ended_at: new Date().toISOString(),
        };
        suggestNextTeams(activeGame, volleyWinner);
      }

      const { error: gameUpdateError } = await supabase
        .from('match_games')
        .update(updatePayload)
        .eq('id', activeGame.id);

      if (gameUpdateError) {
        toast.error('Erro ao atualizar placar.');
      } else {
        const teamInfo = getTeamInfo(goalTeamNumber);
        if (isVolleyWon) {
          toast.success(`🎉 FIM DE JOGO! ${teamInfo.name} venceu por ${newScoreA} × ${newScoreB}! 🏆`);
        } else {
          toast.success(`🏐 Ponto do ${teamInfo.name}! (${newScoreA} × ${newScoreB})`);
        }

        // Notificar participantes sobre ponto no vôlei
        if (playerId && participants.length > 0) {
          const participantIds = participants.map((p) => p.user_id).filter((id): id is string => !!id);
          const scorerPart = participants.find((p) => p.user_id === playerId);
          const scorerProfile = scorerPart?.user || ({ id: playerId, nome: 'Atleta' } as Profile);
          void notifyGoalScored(match, scorerProfile, teamInfo.name, participantIds, true);
        }

        void fetchControlData();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar ponto.');
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // 3. Registro Dinâmico de Gol no Futebol (Item 3 do Requisito)
  const handleConfirmSoccerGoal = async (scorerId: string | null, assistId?: string | null) => {
    if (!isAuthorized || !activeGame || !match || activeGame.status === 'finished') return;
    setIsSubmittingGoal(true);
    setIsSoccerGoalModalOpen(false);

    try {
      const isTeamA = goalTeamNumber === activeGame.team_a;
      const newScoreA = isTeamA ? activeGame.score_a + 1 : activeGame.score_a;
      const newScoreB = !isTeamA ? activeGame.score_b + 1 : activeGame.score_b;
      const currentMinute = Math.max(1, Math.ceil(currentSeconds / 60));

      const { error: goalError } = await supabase.from('match_game_goals').insert({
        game_id: activeGame.id,
        match_id: match.id,
        team: goalTeamNumber,
        player_id: scorerId,
        assist_player_id: trackAssists ? (assistId || null) : null,
        minute: currentMinute,
        point_type: 'goal',
      });

      if (goalError) {
        toast.error('Erro ao salvar gol: ' + goalError.message);
        return;
      }

      const isFutebolHitTwoGoals = activeGame.two_goals_rule && (newScoreA >= 2 || newScoreB >= 2);
      const soccerWinner = isFutebolHitTwoGoals ? (newScoreA >= 2 ? activeGame.team_a : activeGame.team_b) : null;

      let updatePayload: Partial<MatchGame> = {
        score_a: newScoreA,
        score_b: newScoreB,
      };

      if (isFutebolHitTwoGoals) {
        updatePayload = {
          ...updatePayload,
          status: 'finished',
          winner_team: soccerWinner,
          is_draw: false,
          timer_is_running: false,
          duration_seconds: currentSeconds,
          timer_started_at: null,
          ended_at: new Date().toISOString(),
        };
        suggestNextTeams(activeGame, soccerWinner);
      }

      const { error: gameUpdateError } = await supabase
        .from('match_games')
        .update(updatePayload)
        .eq('id', activeGame.id);

      if (gameUpdateError) {
        toast.error('Erro ao atualizar placar.');
      } else {
        const teamInfo = getTeamInfo(goalTeamNumber);
        if (isFutebolHitTwoGoals) {
          toast.success(`🎉 GOOOL e Fim de Jogo! ${teamInfo.name} venceu por 2 gols! 🏆`);
        } else {
          toast.success(`⚽ GOOOL do ${teamInfo.name}! (${newScoreA} × ${newScoreB})`);
        }

        // Notificar participantes sobre o gol marcado
        if (scorerId && participants.length > 0) {
          const participantIds = participants.map((p) => p.user_id).filter((id): id is string => !!id);
          const scorerPart = participants.find((p) => p.user_id === scorerId);
          const scorerProfile = scorerPart?.user || ({ id: scorerId, nome: 'Jogador' } as Profile);
          void notifyGoalScored(match, scorerProfile, teamInfo.name, participantIds, false);
        }

        void fetchControlData();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar gol.');
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // 4. Registro de Cartão no Futebol (Item 4 do Requisito)
  const handleConfirmSoccerCard = async (teamNum: number, cardType: 'yellow' | 'red', playerId: string | null) => {
    if (!isAuthorized || !activeGame || !match || activeGame.status === 'finished') return;
    setIsSoccerCardModalOpen(false);

    try {
      const currentMinute = Math.max(1, Math.ceil(currentSeconds / 60));

      const { error } = await supabase.from('match_game_goals').insert({
        game_id: activeGame.id,
        match_id: match.id,
        team: teamNum,
        player_id: playerId,
        minute: currentMinute,
        point_type: 'card',
        card_type: cardType,
      });

      if (error) {
        toast.error('Erro ao registrar cartão: ' + error.message);
      } else {
        const teamInfo = getTeamInfo(teamNum);
        const cardLabel = cardType === 'yellow' ? 'Cartão Amarelo 🟨' : 'Cartão Vermelho 🟥';
        toast.success(`${cardLabel} aplicado ao atleta do ${teamInfo.name}!`);
        void fetchControlData();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar cartão.');
    }
  };

  // 5. Desfazer Último Evento (Gol ou Cartão - Item 10 do Requisito)
  const handleUndoLastEvent = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate([40, 20, 40]); } catch {}
    }

    if (!isAuthorized || !activeGame || goals.length === 0) {
      toast.info('Nenhum evento registrado para desfazer.');
      return;
    }

    try {
      const lastGoalOrCard = goals[goals.length - 1];

      // Se for gol: reverter placar
      if (lastGoalOrCard.point_type !== 'card') {
        const isTeamA = lastGoalOrCard.team === activeGame.team_a;
        const newScoreA = isTeamA ? Math.max(0, activeGame.score_a - 1) : activeGame.score_a;
        const newScoreB = !isTeamA ? Math.max(0, activeGame.score_b - 1) : activeGame.score_b;

        await supabase.from('match_game_goals').delete().eq('id', lastGoalOrCard.id);

        await supabase
          .from('match_games')
          .update({
            score_a: newScoreA,
            score_b: newScoreB,
            status: 'in_progress',
            winner_team: null,
            is_draw: false,
          })
          .eq('id', activeGame.id);

        const teamInfo = getTeamInfo(lastGoalOrCard.team);
        toast.success(`↩ Último ${isVolei ? 'ponto' : 'gol'} do ${teamInfo.name} desfeito!`);
      } else {
        // Se for cartão: apenas remover o evento
        await supabase.from('match_game_goals').delete().eq('id', lastGoalOrCard.id);
        const cardLabel = lastGoalOrCard.card_type === 'yellow' ? 'Cartão Amarelo' : 'Cartão Vermelho';
        toast.success(`↩ Último ${cardLabel} desfeito com sucesso!`);
      }

      void fetchControlData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao desfazer evento.');
    }
  };

  // 6. Subtrair 1 Ponto Rápido (− 1)
  const handleDecreaseScore = async (teamNum: number) => {
    if (!isAuthorized || !activeGame || activeGame.status === 'finished') return;

    try {
      const isTeamA = teamNum === activeGame.team_a;
      const currentScore = isTeamA ? activeGame.score_a : activeGame.score_b;
      if (currentScore <= 0) {
        toast.info('A pontuação já está em 0.');
        return;
      }

      const newScoreA = isTeamA ? Math.max(0, activeGame.score_a - 1) : activeGame.score_a;
      const newScoreB = !isTeamA ? Math.max(0, activeGame.score_b - 1) : activeGame.score_b;

      const teamGoals = goals.filter((g) => g.team === teamNum && g.point_type !== 'card');
      const latestTeamGoal = teamGoals[teamGoals.length - 1];

      if (latestTeamGoal) {
        await supabase.from('match_game_goals').delete().eq('id', latestTeamGoal.id);
      }

      const { error } = await supabase
        .from('match_games')
        .update({
          score_a: newScoreA,
          score_b: newScoreB,
        })
        .eq('id', activeGame.id);

      if (error) {
        toast.error('Erro ao decrementar pontuação.');
      } else {
        toast.success(`Pontuação reduzida em -1 (${newScoreA} × ${newScoreB})`);
        void fetchControlData();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao decrementar ponto.');
    }
  };

  // 7. Ajustar Placar Manualmente
  const handleManualScoreAdjust = async (newScoreA: number, newScoreB: number, reason?: string) => {
    if (!isAuthorized || !activeGame) return;

    try {
      const targetScore = activeGame.target_duration_minutes || 12;
      const volleyWinnerSide = isVolei
        ? getVolleyWinnerSide(newScoreA, newScoreB, {
            targetScore,
            requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
          })
        : null;
      const isAutoWin = volleyWinnerSide !== null;

      let updatePayload: Partial<MatchGame> = {
        score_a: newScoreA,
        score_b: newScoreB,
      };

      if (isAutoWin) {
        updatePayload = {
          ...updatePayload,
          status: 'finished',
          winner_team: volleyWinnerSide === 'a' ? activeGame.team_a : activeGame.team_b,
          is_draw: false,
          timer_is_running: false,
          ended_at: new Date().toISOString(),
        };
      }

      const { error } = await supabase
        .from('match_games')
        .update(updatePayload)
        .eq('id', activeGame.id);

      if (error) {
        toast.error('Erro ao ajustar placar.');
      } else {
        toast.success(`Placar ajustado manualmente para ${newScoreA} × ${newScoreB}! ⚙️`);
        void fetchControlData();
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar placar.');
    }
  };

  // 8. Cronômetro Play/Pause/Zerar (Somente Futebol)
  const handleStartTimer = async () => {
    if (!isAuthorized || !activeGame) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(25); } catch {}
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('match_games')
        .update({
          status: 'in_progress',
          timer_is_running: true,
          timer_started_at: now,
        })
        .eq('id', activeGame.id);

      if (error) toast.error('Erro ao iniciar cronômetro.');
    } catch (e) {
      console.error(e);
    }
  };

  const handlePauseTimer = async () => {
    if (!isAuthorized || !activeGame) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([20, 30, 20]); } catch {}
      }
      let accumulated = activeGame.duration_seconds;
      if (activeGame.timer_started_at) {
        accumulated += Math.floor(
          (Date.now() - new Date(activeGame.timer_started_at).getTime()) / 1000
        );
      }

      const { error } = await supabase
        .from('match_games')
        .update({
          status: 'paused',
          timer_is_running: false,
          duration_seconds: accumulated,
          timer_started_at: null,
        })
        .eq('id', activeGame.id);

      if (error) toast.error('Erro ao pausar cronômetro.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetTimer = async () => {
    if (!isAuthorized || !activeGame) return;
    if (!confirm('Deseja zerar o cronômetro desta partida?')) return;

    try {
      const { error } = await supabase
        .from('match_games')
        .update({
          duration_seconds: 0,
          timer_started_at: activeGame.timer_is_running ? new Date().toISOString() : null,
        })
        .eq('id', activeGame.id);

      if (error) toast.error('Erro ao zerar cronômetro.');
      else toast.success('Cronômetro zerado.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTargetDuration = async (minutes: number) => {
    if (!isAuthorized || !activeGame) return;
    try {
      const { error } = await supabase
        .from('match_games')
        .update({ target_duration_minutes: minutes })
        .eq('id', activeGame.id);

      if (error) toast.error('Erro ao atualizar tempo.');
      else toast.success(`Tempo ajustado para ${minutes} minutos.`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTwoGoalsRule = async () => {
    if (!isAuthorized || !activeGame || isVolei) return;
    const newVal = !activeGame.two_goals_rule;
    try {
      const { error } = await supabase
        .from('match_games')
        .update({ two_goals_rule: newVal })
        .eq('id', activeGame.id);

      if (error) toast.error('Erro ao alterar regra.');
      else toast.success(newVal ? 'Regra de 2 gols ativada! ⚡' : 'Regra de 2 gols desativada!');
    } catch (e) {
      console.error(e);
    }
  };

  // 9. Excluir / Anular Registro
  const handleDeleteGoal = async (goalId: string, teamNum: number) => {
    if (!isAuthorized || !activeGame) return;
    if (!confirm('Deseja realmente anular/excluir este registro?')) return;

    try {
      const target = goals.find((g) => g.id === goalId);
      const isCard = target?.point_type === 'card';

      await supabase.from('match_game_goals').delete().eq('id', goalId);

      if (!isCard) {
        const isTeamA = teamNum === activeGame.team_a;
        const newScoreA = isTeamA ? Math.max(0, activeGame.score_a - 1) : activeGame.score_a;
        const newScoreB = !isTeamA ? Math.max(0, activeGame.score_b - 1) : activeGame.score_b;

        await supabase
          .from('match_games')
          .update({
            score_a: newScoreA,
            score_b: newScoreB,
          })
          .eq('id', activeGame.id);
      }

      toast.success('Registro cancelado com sucesso.');
      void fetchControlData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao anular registro.');
    }
  };

  // 10. Finalizar Jogo Manualmente
  const handleFinishGame = async () => {
    if (!isAuthorized || !activeGame) return;
    if (!confirm('Deseja encerrar este jogo e registrar o resultado oficial?')) return;

    try {
      const isDraw = activeGame.score_a === activeGame.score_b;
      let winner: number | null = null;
      if (activeGame.score_a > activeGame.score_b) winner = activeGame.team_a;
      else if (activeGame.score_b > activeGame.score_a) winner = activeGame.team_b;

      const { error } = await supabase
        .from('match_games')
        .update({
          status: 'finished',
          winner_team: winner,
          is_draw: isDraw,
          timer_is_running: false,
          duration_seconds: isVolei ? 0 : currentSeconds,
          timer_started_at: null,
          ended_at: new Date().toISOString(),
        })
        .eq('id', activeGame.id);

      if (error) {
        toast.error('Erro ao finalizar jogo.');
      } else {
        toast.success('Jogo finalizado e computado na tabela! 🏁');
        suggestNextTeams(activeGame, winner);
        void fetchControlData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 11. Finalizar Toda a Rodada / Evento
  const handleFinishEntireMatch = async () => {
    if (!isAuthorized || !match) return;
    if (!confirm('Deseja encerrar definitivamente esta rodada/evento?')) return;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'finalizada' })
        .eq('id', match.id);

      if (error) {
        toast.error('Erro ao encerrar rodada.');
      } else {
        toast.success('Rodada encerrada com sucesso! 🏆');
        setMatch((prev) => (prev ? { ...prev, status: 'finalizada' } : null));
        void handleOpenChampionModal();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 12. Modal Campeão
  const handleOpenChampionModal = async () => {
    if (!match) return;
    setIsChampionModalOpen(true);
    setChampionLoading(true);
    try {
      const data = await getMatchChampionData(match.id, match);
      setChampionData(data);
      if (data?.teamInfo?.name && participants.length > 0) {
        const participantIds = participants.map((p) => p.user_id).filter((id): id is string => !!id);
        void notifyChampionDeclared(match, data.teamInfo.name, participantIds);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados do campeão.');
    } finally {
      setChampionLoading(false);
    }
  };

  // Compartilhar Transmissão no WhatsApp
  const handleShareWhatsApp = () => {
    if (!match) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rls-sports.netlify.app';
    const broadcastUrl = `${origin}/matches/${match.id}/tv`;

    const scoreInfo = activeGame
      ? `\n🔥 *JOGO #${activeGame.game_number}:* ${teamAInfo?.name || `Time ${activeGame.team_a}`} *${activeGame.score_a} × ${activeGame.score_b}* ${teamBInfo?.name || `Time ${activeGame.team_b}`}`
      : '';

    const text = `🔴 *ACOMPANHE O PLACAR AO VIVO* ${isVolei ? '🏐' : '⚽'}\n\n🏆 *${match.titulo}*\n📍 *Local:* ${match.local}${scoreInfo}\n\n📲 *Acompanhe em tempo real pelo link:*\n${broadcastUrl}\n\n_Atualizações automáticas ao vivo pelo organizador!_`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const teamAInfo = activeGame ? getTeamInfo(activeGame.team_a) : null;
  const teamBInfo = activeGame ? getTeamInfo(activeGame.team_b) : null;
  const targetSeconds = (activeGame?.target_duration_minutes || 10) * 60;
  const isOvertime = !isVolei && currentSeconds > targetSeconds;

  // Loading
  if (loading || isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className={`w-12 h-12 border-4 ${isVolei ? 'border-amber-500' : 'border-emerald-500'} border-t-transparent rounded-full animate-spin mb-4`} />
        <p className="font-extrabold text-sm text-slate-300">
          Carregando Painel de Controle {isVolei ? 'de Vôlei 🏐' : 'de Futebol ⚽'}...
        </p>
      </div>
    );
  }

  // Acesso Negado (403 Amigável)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white mb-2">Acesso Não Permitido</h2>
        <p className="text-sm text-slate-300 max-w-md mb-2">
          Você não possui permissão de administrador para esta liga/partida.
        </p>
        <p className="text-xs text-slate-500 max-w-md mb-6">
          Entre em uma liga que você administra ou solicite acesso ao Super Administrador.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href={`/matches/${id}?tab=scoreboard`}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all"
          >
            Acompanhar Placar Público ⚽
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-2xl border border-slate-700 transition-all"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white font-sans">
      {/* Background Glow */}
      <div className={`fixed inset-0 pointer-events-none ${
        isVolei
          ? 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.18),transparent_75%)]'
          : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(16,185,129,0.15),transparent_70%)]'
      }`} />

      {/* ═══════════════════════════════════════════════════════════════════
          1. CABEÇALHO / HUD DO ADMINISTRADOR
      ═══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md px-3 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Voltar e Título */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href={`/matches/${id}`}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all shrink-0 cursor-pointer"
              title="Voltar para a página da partida"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${isVolei ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${isVolei ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isVolei ? 'MESA DE CONTROLE AO VIVO • VÔLEI 🏐' : 'MESA DE CONTROLE AO VIVO ⚽'}
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                  {match?.local}
                </span>
              </div>
              <h1 className="font-black text-sm sm:text-base text-white truncate leading-tight">
                {match?.titulo}
              </h1>
            </div>
          </div>

          {/* Ações Rápidas no Topo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsEditTeamsOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              title="Personalizar Nomes e Cores dos Times"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden md:inline">Personalizar Times</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              title="Compartilhar no WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden md:inline">WhatsApp</span>
            </button>

            <Link
              href={`/matches/${id}/tv`}
              target="_blank"
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 ${
                isVolei
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
              }`}
              title="Abrir Modo Telão para TV em outra aba"
            >
              <Tv className="w-4 h-4" />
              <span className="hidden md:inline">Modo Telão</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTEÚDO PRINCIPAL (MESA DE ARBITRAGEM)
      ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-3 sm:p-5 space-y-4 relative z-10 pb-28 sm:pb-12 pb-safe">

        {/* ═══════════════════════════════════════════════════════════════════
            PAINEL 1: JOGO EM ANDAMENTO (PLACAR ATIVO AO VIVO)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeGame && activeGame.status !== 'finished' ? (
          <div className={`bg-slate-900 border ${isVolei ? 'border-amber-500/30 shadow-amber-500/5' : 'border-slate-800'} rounded-3xl overflow-hidden shadow-2xl relative`}>
            {/* Faixa Superior do Jogo */}
            <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full ${
                  isVolei
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                } text-xs font-black tracking-wider flex items-center gap-1`}>
                  <Swords className="w-3.5 h-3.5" />
                  JOGO #{activeGame.game_number}
                </span>

                {activeGame.status === 'in_progress' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    EM ANDAMENTO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black">
                    <Pause className="w-3 h-3" />
                    PAUSADO
                  </span>
                )}
              </div>

              {/* Indicador de Regras / Metas */}
              {isVolei ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-xs">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{getVolleyWinRuleLabel({
                    targetScore: currentVolleyTarget,
                    requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
                  })} 🏐</span>
                </div>
              ) : (
                <button
                  onClick={handleToggleTwoGoalsRule}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeGame.two_goals_rule
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Ativar/Desativar vitória automática ao atingir 2 gols"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Regra 2 Gols:</span>
                  <span>{activeGame.two_goals_rule ? 'ATIVADA ⚡' : 'DESATIVADA'}</span>
                </button>
              )}
            </div>

            {/* DUELO DOS TIMES COM PLACAR GIGANTE E BOTÕES DE GOL TOUCH-FRIENDLY */}
            <div className="p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-7 items-center gap-2 sm:gap-4">
                
                {/* TIME A (MANDANTE) */}
                <div className="col-span-3 flex flex-col items-center text-center space-y-2.5">
                  <TeamBadge
                    teamInfo={teamAInfo}
                    size="lg"
                    rounded="2xl"
                    className="shadow-xl shadow-brand-500/10 cursor-pointer"
                    onClick={(e) => {
                      if (teamAInfo?.badge_url) {
                        e.stopPropagation();
                        openImagePreview({
                          imageUrl: teamAInfo.badge_url,
                          title: teamAInfo.name,
                          subtitle: 'Time Mandante',
                          type: 'team_badge',
                        });
                      }
                    }}
                  />
                  <div className="min-w-0 w-full">
                    <span className={`font-black text-sm sm:text-lg block leading-tight truncate ${teamAInfo?.text || 'text-white'}`}>
                      {teamAInfo?.name || `Time ${activeGame.team_a}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                      {teamParticipantsMap[activeGame.team_a]?.length || 0} {isVolei ? 'atletas' : 'jogadores'}
                    </span>
                  </div>

                  {/* BOTÕES DE PONTUAÇÃO TIME A */}
                  <div className="w-full max-w-[170px] space-y-1.5">
                    <motion.button
                      whileTap={{ scale: 0.90 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          try { navigator.vibrate(35); } catch {}
                        }
                        setGoalTeamNumber(activeGame.team_a);
                        setEditingPointGoal(null);
                        if (isVolei) {
                          setIsVolleyModalOpen(true);
                        } else {
                          setIsSoccerGoalModalOpen(true);
                        }
                      }}
                      className={`w-full py-3.5 sm:py-4 px-3 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                        isVolei
                          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/30 border-amber-400/50'
                          : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30 border-emerald-400/50'
                      }`}
                    >
                      <Plus className="w-6 h-6 stroke-[3]" />
                      <span>{isVolei ? '+ PONTO' : '+ GOL'}</span>
                    </motion.button>

                    {isVolei && (
                      <button
                        type="button"
                        onClick={() => handleDecreaseScore(activeGame.team_a)}
                        disabled={activeGame.score_a <= 0}
                        className="w-full py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-700 disabled:opacity-40"
                        title="Subtrair 1 ponto deste time"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span>− 1</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* PLACAR NUMÉRICO CENTRAL GIGANTE */}
                <div className="col-span-1 flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    <motion.span
                      key={`score-ctrl-a-${activeGame.score_a}`}
                      initial={{ scale: 1.35, color: isVolei ? '#f59e0b' : '#10b981' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      transition={{ duration: 0.3 }}
                      className="text-4xl sm:text-6xl font-black tracking-tight text-white font-mono bg-slate-950/95 px-2.5 sm:px-3.5 py-1.5 rounded-2xl border border-slate-800 shadow-inner"
                    >
                      {activeGame.score_a}
                    </motion.span>
                    <span className="text-xl sm:text-3xl font-black text-slate-600">:</span>
                    <motion.span
                      key={`score-ctrl-b-${activeGame.score_b}`}
                      initial={{ scale: 1.35, color: isVolei ? '#f59e0b' : '#10b981' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      transition={{ duration: 0.3 }}
                      className="text-4xl sm:text-6xl font-black tracking-tight text-white font-mono bg-slate-950/95 px-2.5 sm:px-3.5 py-1.5 rounded-2xl border border-slate-800 shadow-inner"
                    >
                      {activeGame.score_b}
                    </motion.span>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">
                    VS
                  </span>
                </div>

                {/* TIME B (DESAFIANTE) */}
                <div className="col-span-3 flex flex-col items-center text-center space-y-2.5">
                  <TeamBadge
                    teamInfo={teamBInfo}
                    size="lg"
                    rounded="2xl"
                    className="shadow-xl shadow-blue-500/10 cursor-pointer"
                    onClick={(e) => {
                      if (teamBInfo?.badge_url) {
                        e.stopPropagation();
                        openImagePreview({
                          imageUrl: teamBInfo.badge_url,
                          title: teamBInfo.name,
                          subtitle: 'Time Desafiante',
                          type: 'team_badge',
                        });
                      }
                    }}
                  />
                  <div className="min-w-0 w-full">
                    <span className={`font-black text-sm sm:text-lg block leading-tight truncate ${teamBInfo?.text || 'text-white'}`}>
                      {teamBInfo?.name || `Time ${activeGame.team_b}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                      {teamParticipantsMap[activeGame.team_b]?.length || 0} {isVolei ? 'atletas' : 'jogadores'}
                    </span>
                  </div>

                  {/* BOTÕES DE PONTUAÇÃO TIME B */}
                  <div className="w-full max-w-[170px] space-y-1.5">
                    <motion.button
                      whileTap={{ scale: 0.90 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                          try { navigator.vibrate(35); } catch {}
                        }
                        setGoalTeamNumber(activeGame.team_b);
                        setEditingPointGoal(null);
                        if (isVolei) {
                          setIsVolleyModalOpen(true);
                        } else {
                          setIsSoccerGoalModalOpen(true);
                        }
                      }}
                      className={`w-full py-3.5 sm:py-4 px-3 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                        isVolei
                          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/30 border-amber-400/50'
                          : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30 border-emerald-400/50'
                      }`}
                    >
                      <Plus className="w-6 h-6 stroke-[3]" />
                      <span>{isVolei ? '+ PONTO' : '+ GOL'}</span>
                    </motion.button>

                    {isVolei && (
                      <button
                        type="button"
                        onClick={() => handleDecreaseScore(activeGame.team_b)}
                        disabled={activeGame.score_b <= 0}
                        className="w-full py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-700 disabled:opacity-40"
                        title="Subtrair 1 ponto deste time"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span>− 1</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* CRONÔMETRO CENTRAL E AÇÕES DINÂMICAS DO FUTEBOL */}
              {!isVolei ? (
                <div className="pt-4 border-t border-slate-800/80 flex flex-col items-center justify-center space-y-3">
                  {/* Digital Timer */}
                  <div className="flex items-center gap-3 bg-slate-950/80 px-6 py-2 rounded-2xl border border-slate-800 shadow-inner">
                    <Clock className={`w-5 h-5 ${activeGame.timer_is_running ? 'text-emerald-400 animate-spin' : 'text-slate-500'}`} />
                    <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-emerald-400">
                      {formatTime(currentSeconds)}
                    </span>
                    <span className="text-xs text-slate-500 font-mono font-extrabold">
                      / {activeGame.target_duration_minutes || defaultStageDuration}:00
                    </span>
                  </div>

                  {/* BOTÕES DE CONTROLE DO CRONÔMETRO */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1 w-full">
                    {activeGame.timer_is_running ? (
                      <button
                        onClick={handlePauseTimer}
                        className="flex-1 max-w-[160px] py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                      >
                        <Pause className="w-4 h-4 fill-amber-300" />
                        <span>Pausar</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStartTimer}
                        className="flex-1 max-w-[180px] py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-400/30"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Iniciar / Retomar</span>
                      </button>
                    )}

                    <button
                      onClick={handleResetTimer}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                      title="Zerar cronômetro"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Zerar</span>
                    </button>

                    {/* Botão de Cartão (Aparece SOMENTE se track_cards === true) */}
                    {trackCards && (
                      <button
                        type="button"
                        onClick={() => setIsSoccerCardModalOpen(true)}
                        className="px-4 py-3 rounded-2xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-yellow-500/10"
                      >
                        <span>🟨🟥</span>
                        <span>Cartão</span>
                      </button>
                    )}

                    {/* Botão Desfazer Último Evento */}
                    {/* Botão Desfazer Último Evento */}
                    <button
                      type="button"
                      onClick={handleUndoLastEvent}
                      disabled={goals.length === 0}
                      className="px-3 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 font-extrabold text-xs flex items-center gap-1.5 transition-all border border-amber-500/30 cursor-pointer disabled:opacity-40 shrink-0"
                      title="Desfazer o último lance ou cartão"
                    >
                      <Undo2 className="w-4 h-4 text-amber-400" />
                      <span>Desfazer</span>
                    </button>

                    {/* Botão Ajustar Placar */}
                    <button
                      type="button"
                      onClick={() => setIsAdjustScoreModalOpen(true)}
                      className="px-3.5 py-3 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Ajustar placar manualmente"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                      <span className="hidden sm:inline">Ajustar</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* AÇÕES DO VÔLEI */
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndoLastEvent}
                    disabled={goals.length === 0}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black text-xs flex items-center gap-2 transition-all border border-slate-700 cursor-pointer disabled:opacity-40"
                  >
                    <Undo2 className="w-4 h-4 text-amber-400" />
                    <span>Desfazer último ponto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAdjustScoreModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-purple-400" />
                    <span>Ajustar placar</span>
                  </button>
                </div>
              )}
            </div>

            {/* ÚLTIMO EVENTO REGISTRADO */}
            {lastEvent && (
              <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                    Último Lance:
                  </span>
                  {lastEvent.point_type === 'card' ? (
                    <div className="flex items-center gap-1.5 font-extrabold text-white truncate">
                      <span>{lastEvent.card_type === 'yellow' ? '🟨' : '🟥'}</span>
                      <span className="text-amber-300">{getTeamInfo(lastEvent.team).name}</span>
                      <span>—</span>
                      <span className="truncate">{lastEvent.player?.nome || 'Jogador'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 font-extrabold text-white truncate">
                      <span>{isVolei ? '🏐' : '⚽'}</span>
                      <span className={isVolei ? 'text-amber-400' : 'text-emerald-400'}>
                        {getTeamInfo(lastEvent.team).name}
                      </span>
                      <span>—</span>
                      <span className="truncate">{lastEvent.player?.nome || 'Sem autor específico'}</span>
                      {trackAssists && lastEvent.assist_player?.nome && (
                        <span className="text-teal-400 font-medium hidden sm:inline">
                          (🎯 Passe: {lastEvent.assist_player.nome})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <span className="font-mono text-[11px] text-slate-500 font-bold shrink-0 ml-2">
                  ⏱ {formatEventTimestamp(lastEvent.created_at)}
                </span>
              </div>
            )}

            {/* ESTATÍSTICAS DINÂMICAS DA PARTIDA */}
            {(actualGoals.length > 0 || (trackCards && cardEvents.length > 0)) && (
              <div className="px-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/50 space-y-3">
                {activeGameStats.scorers.length > 0 && (
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1.5">
                      <span>{isVolei ? '🏐' : '⚽'}</span>
                      <span>{isVolei ? 'Pontuadores Desta Partida' : 'Gols Registrados Nesta Partida'}</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeGameStats.scorers.map((s) => {
                        const tInfo = getTeamInfo(s.team);
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />
                              <span className="font-bold text-white truncate">
                                {s.player?.nome || 'Jogador Sem Identificação'}
                              </span>
                            </div>
                            <span className="font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] shrink-0">
                              {s.count} {s.count === 1 ? (isVolei ? 'ponto' : 'gol') : (isVolei ? 'pontos' : 'gols')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {trackAssists && activeGameStats.assists.length > 0 && (
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5 mb-1.5">
                      <span>🎯</span>
                      <span>Assistências Registradas</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeGameStats.assists.map((a) => {
                        const tInfo = getTeamInfo(a.team);
                        return (
                          <div
                            key={a.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />
                              <span className="font-bold text-white truncate">
                                {a.player?.nome || 'Jogador'}
                              </span>
                            </div>
                            <span className="font-mono font-black text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20 text-[11px] shrink-0">
                              {a.count} {a.count === 1 ? 'assistência' : 'assistências'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {trackCards && (activeGameStats.yellowCards.length > 0 || activeGameStats.redCards.length > 0) && (
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-1.5">
                      <span>🟨🟥</span>
                      <span>Cartões Aplicados Nesta Partida</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeGameStats.yellowCards.map((c) => (
                        <div
                          key={`yellow_${c.id}`}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">🟨</span>
                            <span className="font-bold text-white truncate">
                              {c.player?.nome || 'Jogador'}
                            </span>
                          </div>
                          <span className="font-mono font-black text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20 text-[11px] shrink-0">
                            {c.count} amarelo{c.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}

                      {activeGameStats.redCards.map((c) => (
                        <div
                          key={`red_${c.id}`}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">🟥</span>
                            <span className="font-bold text-white truncate">
                              {c.player?.nome || 'Jogador'}
                            </span>
                          </div>
                          <span className="font-mono font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 text-[11px] shrink-0">
                            {c.count} vermelho{c.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HISTÓRICO DE LANCES DESTE JOGO */}
            {goals.length > 0 && (
              <div className="px-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Histórico de Lances do Jogo ({goals.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Clique na lixeira para anular um evento
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 overscroll-contain">
                  {goals.map((g, idx) => {
                    const tInfo = getTeamInfo(g.team);
                    const isCard = g.point_type === 'card';
                    const timeFormatted = formatEventTimestamp(g.created_at);

                    return (
                      <div
                        key={g.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs shadow-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-black text-amber-400 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 text-[11px]">
                            {isVolei ? `#${idx + 1}` : `${g.minute}'`}
                          </span>

                          <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />

                          {isCard ? (
                            <span className="font-extrabold text-white truncate">
                              {g.card_type === 'yellow' ? '🟨 Cartão Amarelo:' : '🟥 Cartão Vermelho:'}{' '}
                              <span className="text-slate-200">{g.player?.nome || 'Jogador'}</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-extrabold text-white truncate">
                                {g.player?.nome || 'Sem autor específico'}
                              </span>
                              {trackAssists && g.assist_player?.nome && (
                                <span className="text-teal-400 font-bold truncate">
                                  (🎯 Passe: {g.assist_player.nome})
                                </span>
                              )}
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${tInfo.lightBg} ${tInfo.text} shrink-0`}>
                                {tInfo.name} +1
                              </span>
                            </div>
                          )}

                          {timeFormatted && (
                            <span className="text-[10px] text-slate-500 hidden sm:inline shrink-0 font-mono">
                              {timeFormatted}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(g.id, g.team)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          title="Anular este registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BARRA INFERIOR DO CONFRONTO ATIVO */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/matches/${id}?tab=standings`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Ver Classificação</span>
              </Link>

              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleFinishGame}
                className="px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-black text-xs sm:text-sm rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-500/10"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Encerrar Confronto Atual 🏁</span>
              </motion.button>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════
              PAINEL 2: FLUXO RÁPIDO PARA O PRÓXIMO CONFRONTO (APÓS TÉRMINO)
          ═══════════════════════════════════════════════════════════════════ */
          <div className="space-y-4">
            {/* 1. Resumo Compacto do Confronto Anterior se foi finalizado */}
            {activeGame && activeGame.status === 'finished' && (
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>JOGO #{activeGame.game_number} FINALIZADO</span>
                  </div>
                  <Link
                    href={`/matches/${id}?tab=standings`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ver Tabela Geral</span>
                  </Link>
                </div>

                {/* Placar Final e Vencedor */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamBadge teamInfo={teamAInfo} size="sm" rounded="xl" />
                    <span className="font-extrabold text-xs sm:text-sm text-white truncate">{teamAInfo?.name}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono font-black text-lg sm:text-xl text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-700 shrink-0 mx-2">
                    <span>{activeGame.score_a}</span>
                    <span className="text-slate-500">:</span>
                    <span>{activeGame.score_b}</span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0 justify-end">
                    <span className="font-extrabold text-xs sm:text-sm text-white truncate">{teamBInfo?.name}</span>
                    <TeamBadge teamInfo={teamBInfo} size="sm" rounded="xl" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-black text-emerald-400">
                    {activeGame.is_draw
                      ? '🤝 Partida encerrada em Empate!'
                      : `🏆 Vitória do ${getTeamInfo(activeGame.winner_team || activeGame.team_a).name}!`}
                  </span>

                  {actualGoals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                      <span>⚽ Gols:</span>
                      {activeGameStats.scorers.map((s) => (
                        <span key={s.id} className="bg-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-200">
                          {s.player?.nome || 'Gol'} ({s.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Acordeão para ver os lances do jogo anterior sem poluir a tela */}
                {goals.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowFinishedGameDetails(!showFinishedGameDetails)}
                      className="w-full pt-2 border-t border-slate-800 text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      {showFinishedGameDetails ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Ocultar detalhes e lances do Jogo #{activeGame.game_number}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Ver lances e eventos do Jogo #{activeGame.game_number} ({goals.length})</span>
                        </>
                      )}
                    </button>

                    {showFinishedGameDetails && (
                      <div className="space-y-1.5 pt-2.5 max-h-48 overflow-y-auto pr-1 text-xs">
                        {goals.map((g) => {
                          const tInfo = getTeamInfo(g.team);
                          const isCard = g.point_type === 'card';
                          return (
                            <div key={g.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-amber-400 font-bold text-[10px]">{g.minute}'</span>
                                <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />
                                <span className="truncate text-white font-bold">
                                  {isCard ? (g.card_type === 'yellow' ? '🟨 Cartão Amarelo' : '🟥 Cartão Vermelho') : '⚽ Gol'}: {g.player?.nome || 'Atleta'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{formatEventTimestamp(g.created_at)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. CARD PRINCIPAL DE PREPARAÇÃO DO PRÓXIMO CONFRONTO */}
            <div className="p-4 sm:p-6 rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-2xl space-y-4 sm:space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
                    isVolei ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  }`}>
                    <Swords className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                      <span>{isVolei ? 'Próximo Jogo de Vôlei' : 'Próximo Confronto'}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-black">
                        Jogo #{(allGames[0]?.game_number || 0) + 1}
                      </span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      Toque nos times para escalar e inicie o jogo em 1 clique
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSwapTeams}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                    title="Inverter Mandante e Desafiante"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Inverter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditTeamsOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Personalizar</span>
                  </button>
                </div>
              </div>

              {/* SELETORES VISUAIS DE TIMES (1 TOQUE) */}
              <div className="space-y-3.5">
                {/* TIME A (MANDANTE) */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>Time Mandante (Time A):</span>
                    </span>
                    <span className="text-xs font-black text-white">
                      {getTeamInfo(selectedTeamA).emoji} {getTeamInfo(selectedTeamA).name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: match?.num_times || 4 }).map((_, i) => {
                      const tNum = i + 1;
                      const tInfo = getTeamInfo(tNum);
                      const isSelected = selectedTeamA === tNum;
                      const isOpponent = selectedTeamB === tNum;

                      return (
                        <button
                          key={`team-a-pill-${tNum}`}
                          type="button"
                          disabled={isOpponent}
                          onClick={() => setSelectedTeamA(tNum)}
                          className={`p-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500 text-rose-200 ring-2 ring-rose-500/30 shadow-md'
                              : isOpponent
                              ? 'opacity-30 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-base shrink-0">{tInfo.emoji}</span>
                          <span className="truncate">{tInfo.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TIME B (DESAFIANTE) */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span>Time Desafiante (Time B):</span>
                    </span>
                    <span className="text-xs font-black text-white">
                      {getTeamInfo(selectedTeamB).emoji} {getTeamInfo(selectedTeamB).name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: match?.num_times || 4 }).map((_, i) => {
                      const tNum = i + 1;
                      const tInfo = getTeamInfo(tNum);
                      const isSelected = selectedTeamB === tNum;
                      const isOpponent = selectedTeamA === tNum;

                      return (
                        <button
                          key={`team-b-pill-${tNum}`}
                          type="button"
                          disabled={isOpponent}
                          onClick={() => setSelectedTeamB(tNum)}
                          className={`p-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-500/20 border-blue-500 text-blue-200 ring-2 ring-blue-500/30 shadow-md'
                              : isOpponent
                              ? 'opacity-30 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-base shrink-0">{tInfo.emoji}</span>
                          <span className="truncate">{tInfo.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* REGRAS RÁPIDAS */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                {!isVolei ? (
                  <div>
                    {!matchRules?.stage_duration_minutes && (
                      <div className="mb-3">
                        <span className="text-xs font-extrabold text-slate-300 block mb-2">
                          ⏱️ Tempo Regulamentar do Cronômetro:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {PRESET_DURATIONS.map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setTargetDurationMinutes(mins)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                targetDurationMinutes === mins
                                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-brand-500'
                              }`}
                            >
                              {mins} minutos
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={`flex items-center justify-between ${!matchRules?.stage_duration_minutes ? 'pt-3 mt-3 border-t border-slate-800' : ''}`}>
                      <div>
                        <span className="text-xs font-extrabold text-white block">
                          ⚡ Regra de 2 Gols (Mata-Mata Rápido)
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Quem marcar 2 gols primeiro vence a partida automaticamente.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTwoGoalsRule(!twoGoalsRule)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          twoGoalsRule ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            twoGoalsRule ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>{getVolleyWinRuleLabel({
                      targetScore: targetVolleyScore,
                      requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
                    })} 🏐</span>
                  </div>
                )}
              </div>

              {/* BOTÃO PRINCIPAL DE INICIAR O PRÓXIMO CONFRONTO */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.01 }}
                onClick={handleStartNewGame}
                disabled={isCreatingGame || selectedTeamA === selectedTeamB}
                className={`w-full py-4 px-4 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                  isVolei
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/30'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/30'
                }`}
              >
                <Play className="w-5 h-5 fill-white" />
                <span>
                  {isCreatingGame
                    ? 'Iniciando Jogo...'
                    : `Iniciar Jogo #${(allGames[0]?.game_number || 0) + 1} (${getTeamInfo(selectedTeamA).name} × ${getTeamInfo(selectedTeamB).name}) ⚽`}
                </span>
              </motion.button>
            </div>
          </div>
        )}

        {/* 9. HISTÓRICO DE CONFRONTOS EM ACORDEÃO FECHADO POR PADRÃO (ITEM 9 DO REQUISITO) */}
        {allGames.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <button
              type="button"
              onClick={() => setIsHistoryAccordionOpen((prev) => !prev)}
              className="w-full p-4 sm:p-5 flex items-center justify-between bg-slate-900 hover:bg-slate-800 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-brand-500">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base text-white">
                    Histórico de Confrontos Realizados
                  </h4>
                  <span className="text-xs text-slate-400">
                    {allGames.length} {allGames.length === 1 ? 'partida realizada' : 'partidas realizadas'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-bold hidden sm:inline">
                  {isHistoryAccordionOpen ? 'Ocultar' : 'Ver Confrontos'}
                </span>
                {isHistoryAccordionOpen ? (
                  <ChevronUp className="w-5 h-5 text-brand-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {isHistoryAccordionOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="p-4 sm:p-5 pt-0 border-t border-slate-800/80 space-y-2.5"
                >
                  <div className="grid grid-cols-1 gap-2 pt-3">
                    {allGames.map((g) => {
                      const tA = getTeamInfo(g.team_a);
                      const tB = getTeamInfo(g.team_b);
                      const isFinished = g.status === 'finished';
                      const isSelectedForDetails = expandedGameDetailsId === g.id;
                      const gameGoalsList = allMatchGoals.filter((goal) => goal.game_id === g.id);

                      return (
                        <div
                          key={g.id}
                          className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden"
                        >
                          <div
                            onClick={() => setExpandedGameDetailsId(isSelectedForDetails ? null : g.id)}
                            className={`p-3.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-900/60 transition-colors ${
                              g.id === activeGame?.id ? 'border-l-4 border-brand-500 bg-brand-500/5' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-black text-xs text-brand-400 font-mono">#{g.game_number}</span>
                              
                              <div className="flex items-center gap-2 font-bold truncate">
                                <div className="flex items-center gap-1.5">
                                  <TeamBadge teamInfo={tA} size="2xs" rounded="md" showBorder={false} />
                                  <span className="truncate text-white">{tA.name}</span>
                                </div>

                                <span className="font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-white font-black text-xs shrink-0 shadow-inner">
                                  {g.score_a} × {g.score_b}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-white">{tB.name}</span>
                                  <TeamBadge teamInfo={tB} size="2xs" rounded="md" showBorder={false} />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                  isFinished
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                                }`}
                              >
                                {isFinished ? 'Fim' : 'Ao Vivo'}
                              </span>

                              {isSelectedForDetails ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                          </div>

                          {/* Segundo Acordeão: Detalhes da Partida */}
                          {isSelectedForDetails && (
                            <div className="p-3.5 bg-slate-900/90 border-t border-slate-800 space-y-3 text-xs">
                              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 text-[11px]">
                                <span>
                                  Status:{' '}
                                  <strong className="text-white">
                                    {g.status === 'finished' ? 'Finalizada' : 'Em Andamento'}
                                  </strong>
                                </span>
                                {g.ended_at && (
                                  <span>
                                    Encerramento: {new Date(g.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block mb-1.5">
                                  {isVolei ? '🏐 Eventos de Pontuação' : '⚽ Eventos & Gols'} ({gameGoalsList.length})
                                </span>

                                {gameGoalsList.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {gameGoalsList.map((gl, gIdx) => {
                                      const teamG = getTeamInfo(gl.team);
                                      const isCard = gl.point_type === 'card';
                                      return (
                                        <div
                                          key={gl.id}
                                          className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px]"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-slate-500 font-bold">#{gIdx + 1}</span>
                                            <TeamBadge teamInfo={teamG} size="2xs" rounded="md" showBorder={false} />
                                            {isCard ? (
                                              <span className="font-extrabold text-amber-300">
                                                {gl.card_type === 'yellow' ? '🟨 Amarelo' : '🟥 Vermelho'}: {gl.player?.nome || 'Jogador'}
                                              </span>
                                            ) : (
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-extrabold text-white">{teamG.name} +1</span>
                                                <span className="text-slate-400">—</span>
                                                <span className="text-slate-300 font-medium">
                                                  {gl.player?.nome || 'Coletivo'}
                                                </span>
                                                {trackAssists && gl.assist_player?.nome && (
                                                  <span className="text-teal-400 font-normal">
                                                    (Passe: {gl.assist_player.nome})
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-slate-500 font-mono">
                                            {formatEventTimestamp(gl.created_at)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-[11px] italic">
                                    Nenhum evento registrado nesta partida.
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 7. FINALIZAÇÃO DA RODADA / EVENTO */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-black text-sm text-white flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              Finalização da Rodada / Evento
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Quando todas as partidas forem concluídas, declare o time campeão oficial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenChampionModal}
              className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Ver Campeão</span>
            </button>

            {match?.status !== 'finalizada' && (
              <button
                onClick={handleFinishEntireMatch}
                className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Encerrar Evento</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          STICKY BOTTOM THUMB BAR PARA CONTROLE MOBILE RÁPIDO
      ═══════════════════════════════════════════════════════════════════ */}
      {activeGame && activeGame.status !== 'finished' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 px-3 py-2.5 pb-safe shadow-2xl">
          <div className="flex items-center justify-between gap-1.5 max-w-lg mx-auto">
            {/* Botão Gol / Ponto Time A */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                  try { navigator.vibrate(35); } catch {}
                }
                setGoalTeamNumber(activeGame.team_a);
                setEditingPointGoal(null);
                if (isVolei) {
                  setIsVolleyModalOpen(true);
                } else {
                  setIsSoccerGoalModalOpen(true);
                }
              }}
              className="flex-1 py-2.5 px-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1 shadow-lg shadow-emerald-600/30 border border-emerald-400/40 truncate min-w-0"
            >
              <span className="text-sm shrink-0">{teamAInfo?.emoji || '⚽'}</span>
              <span className="truncate">{isVolei ? '+ Ponto' : '+ Gol'}</span>
            </motion.button>

            {/* Cronômetro / Play / Pause (Futebol) ou Placar Atual (Vôlei) */}
            {!isVolei ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  if (activeGame.timer_is_running) {
                    void handlePauseTimer();
                  } else {
                    void handleStartTimer();
                  }
                }}
                className={`px-3 py-2.5 rounded-2xl font-mono font-black text-xs flex items-center justify-center gap-1.5 border transition-all shrink-0 ${
                  activeGame.timer_is_running
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {activeGame.timer_is_running ? (
                  <Pause className="w-3.5 h-3.5 fill-amber-300" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-slate-300" />
                )}
                <span>{formatTime(currentSeconds)}</span>
              </motion.button>
            ) : (
              <div className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 font-mono font-black text-xs text-white shrink-0">
                <span>{activeGame.score_a}</span>
                <span className="text-slate-500 mx-1">×</span>
                <span>{activeGame.score_b}</span>
              </div>
            )}

            {/* Botão Gol / Ponto Time B */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                  try { navigator.vibrate(35); } catch {}
                }
                setGoalTeamNumber(activeGame.team_b);
                setEditingPointGoal(null);
                if (isVolei) {
                  setIsVolleyModalOpen(true);
                } else {
                  setIsSoccerGoalModalOpen(true);
                }
              }}
              className="flex-1 py-2.5 px-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black text-xs flex items-center justify-center gap-1 shadow-lg shadow-blue-600/30 border border-blue-400/40 truncate min-w-0"
            >
              <span className="text-sm shrink-0">{teamBInfo?.emoji || '⚽'}</span>
              <span className="truncate">{isVolei ? '+ Ponto' : '+ Gol'}</span>
            </motion.button>

            {/* Desfazer Último Evento */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              onClick={handleUndoLastEvent}
              disabled={goals.length === 0}
              className="p-2.5 rounded-2xl bg-slate-900 border border-amber-500/30 text-amber-400 disabled:opacity-30 disabled:border-slate-800 disabled:text-slate-600 shrink-0"
              title="Desfazer último lance"
            >
              <Undo2 className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAIS AUXILIARES
      ═══════════════════════════════════════════════════════════════════ */}

      {/* Modal de Gol do Futebol (Dinâmico: 2 toques se assistência OFF, 3 toques se ON) */}
      {activeGame && !isVolei && (
        <SoccerQuickGoalModal
          isOpen={isSoccerGoalModalOpen}
          onClose={() => setIsSoccerGoalModalOpen(false)}
          onConfirmGoal={handleConfirmSoccerGoal}
          teamNumber={goalTeamNumber}
          teamName={getTeamInfo(goalTeamNumber).name}
          teamEmoji={getTeamInfo(goalTeamNumber).emoji}
          teamBadgeUrl={getTeamInfo(goalTeamNumber).badge_url}
          teamColor={getTeamInfo(goalTeamNumber).color}
          players={teamParticipantsMap[goalTeamNumber] || []}
          trackAssists={trackAssists}
        />
      )}

      {/* Modal de Cartões do Futebol (Amarelo / Vermelho - SOMENTE SE TRACK_CARDS ATIVADO) */}
      {activeGame && !isVolei && trackCards && (
        <SoccerCardModal
          isOpen={isSoccerCardModalOpen}
          onClose={() => setIsSoccerCardModalOpen(false)}
          onConfirmCard={handleConfirmSoccerCard}
          teams={[
            {
              teamNumber: activeGame.team_a,
              teamName: teamAInfo?.name || `Time ${activeGame.team_a}`,
              teamEmoji: teamAInfo?.emoji || '⚪',
              teamBadgeUrl: teamAInfo?.badge_url,
              teamColor: teamAInfo?.color,
              players: teamParticipantsMap[activeGame.team_a] || [],
            },
            {
              teamNumber: activeGame.team_b,
              teamName: teamBInfo?.name || `Time ${activeGame.team_b}`,
              teamEmoji: teamBInfo?.emoji || '⚪',
              teamBadgeUrl: teamBInfo?.badge_url,
              teamColor: teamBInfo?.color,
              players: teamParticipantsMap[activeGame.team_b] || [],
            },
          ]}
        />
      )}

      {/* Modal 2 Toques Ultra Rápido para Vôlei */}
      {activeGame && isVolei && (
        <VolleyQuickPointModal
          isOpen={isVolleyModalOpen}
          onClose={() => setIsVolleyModalOpen(false)}
          onSelectPlayer={(playerId) => handleQuickVolleyPoint(playerId)}
          teamNumber={goalTeamNumber}
          teamName={getTeamInfo(goalTeamNumber).name}
          teamEmoji={getTeamInfo(goalTeamNumber).emoji}
          teamBadgeUrl={getTeamInfo(goalTeamNumber).badge_url}
          teamColor={getTeamInfo(goalTeamNumber).color}
          players={teamParticipantsMap[goalTeamNumber] || []}
        />
      )}

      {/* Modal de Ajuste Manual de Placar */}
      {activeGame && (
        <ManualScoreAdjustModal
          isOpen={isAdjustScoreModalOpen}
          onClose={() => setIsAdjustScoreModalOpen(false)}
          onConfirm={handleManualScoreAdjust}
          teamAInfo={getTeamInfo(activeGame.team_a)}
          teamBInfo={getTeamInfo(activeGame.team_b)}
          initialScoreA={activeGame.score_a}
          initialScoreB={activeGame.score_b}
          sportType={isVolei ? 'volei' : 'futebol'}
        />
      )}

      {/* Modal de Personalização dos Times */}
      {match && (
        <EditTeamsModal
          isOpen={isEditTeamsOpen}
          onClose={() => setIsEditTeamsOpen(false)}
          match={match}
          onTeamsUpdated={() => {
            void fetchControlData();
          }}
        />
      )}

      {/* Modal de Campeão da Partida */}
      {match && (
        <ChampionModal
          isOpen={isChampionModalOpen}
          onClose={() => setIsChampionModalOpen(false)}
          championData={championData}
          loading={championLoading}
        />
      )}

      {/* Modal Lightbox de Imagens */}
      <ImageLightboxModal
        data={lightboxData}
        onClose={closeImagePreview}
      />
    </div>
  );
}
