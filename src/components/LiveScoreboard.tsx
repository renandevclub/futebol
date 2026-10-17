'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Match, MatchGame, MatchGameGoal, MatchParticipant, Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLeague } from '@/context/LeagueContext';
import { TEAM_COLORS } from '@/components/ScratchCardModal';
import { GoalModal } from '@/components/GoalModal';
import { subscribeToTables } from '@/lib/realtime';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Plus,
  Trash2,
  Clock,
  Shield,
  CheckCircle2,
  Sparkles,
  Flame,
  ChevronRight,
  History,
  Settings2,
  Zap,
  Swords,
  Award,
  Tv,
  MessageCircle,
  Share2,
  Palette,
  Radio,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getTeamInfo as getTeamInfoFromHelper } from '@/lib/teamsHelper';
import { EditTeamsModal } from '@/components/EditTeamsModal';
import { TeamBadge } from '@/components/TeamBadge';
import { ImageLightboxModal, LightboxPreviewData } from '@/components/ImageLightboxModal';
import { getVolleyWinnerSide, getVolleyWinRuleLabel } from '@/lib/volleyballRules';

interface LiveScoreboardProps {
  match: Match;
  participants: MatchParticipant[];
  onGameFinished?: () => void;
}

const PRESET_DURATIONS = [5, 7, 8, 10, 12, 15, 20];

export const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
  match,
  participants,
  onGameFinished,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { canManageMatch } = useLeague();
  const isAdmin = isSuperAdmin || canManageMatch(match);

  const [activeGame, setActiveGame] = useState<MatchGame | null>(null);
  const [goals, setGoals] = useState<MatchGameGoal[]>([]);
  const [allGames, setAllGames] = useState<MatchGame[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de criação de novo jogo (Admin)
  const [selectedTeamA, setSelectedTeamA] = useState<number>(1);
  const [selectedTeamB, setSelectedTeamB] = useState<number>(2);
  const [twoGoalsRule, setTwoGoalsRule] = useState<boolean>(true);
  
  const matchRules = useMemo(() => {
    return match?.match_rules || (match?.teams_custom_config as any)?.match_rules || {};
  }, [match]);

  const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(matchRules?.stage_duration_minutes || 10);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  useEffect(() => {
    if (matchRules?.stage_duration_minutes) {
      setTargetDurationMinutes(matchRules.stage_duration_minutes);
    }
  }, [matchRules?.stage_duration_minutes]);

  // Modal de Gol
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalTeamNumber, setGoalTeamNumber] = useState<number>(1);
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
  const [isEditTeamsOpen, setIsEditTeamsOpen] = useState(false);

  // Estado do Modal de Visualização Ampliada (Lightbox)
  const [lightboxData, setLightboxData] = useState<LightboxPreviewData | null>(null);

  const openImagePreview = (previewData: Omit<LightboxPreviewData, 'isOpen'>) => {
    setLightboxData({ ...previewData, isOpen: true });
  };

  const closeImagePreview = () => {
    setLightboxData((prev) => (prev ? { ...prev, isOpen: false } : null));
  };

  // Cronômetro local interpolado
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Buscar jogo ativo e histórico de jogos
  const fetchGameData = async () => {
    try {
      // Buscar todos os jogos desta partida
      const { data: gamesData, error: gamesError } = await supabase
        .from('match_games')
        .select('*')
        .eq('match_id', match.id)
        .order('game_number', { ascending: false });

      if (gamesError) {
        console.error('Erro ao buscar jogos:', gamesError);
        return;
      }

      setAllGames(gamesData || []);

      // Jogo ativo = o mais recente que não esteja finalizado, OU o mais recente
      const currentGame = gamesData?.find((g) => g.status !== 'finished') || gamesData?.[0] || null;
      setActiveGame(currentGame);

      if (currentGame) {
        // Buscar gols com dados do jogador
        const { data: goalsData, error: goalsError } = await supabase
          .from('match_game_goals')
          .select(`
            *,
            player:player_id(*)
          `)
          .eq('game_id', currentGame.id)
          .order('created_at', { ascending: true });

        if (!goalsError) {
          setGoals(goalsData || []);
        }
      } else {
        setGoals([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGameData();

    // Inscrever no Supabase Realtime
    const unsubscribe = subscribeToTables(
      `scoreboard_${match.id}`,
      [
        { table: 'match_games', filter: `match_id=eq.${match.id}` },
        { table: 'match_game_goals', filter: `match_id=eq.${match.id}` },
      ],
      () => {
        void fetchGameData();
        if (onGameFinished) onGameFinished();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [match.id]);

  // Atualização precisa do cronômetro sincronizado
  useEffect(() => {
    if (!activeGame) {
      setCurrentSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const calculateCurrentTime = () => {
      if (activeGame.timer_is_running && activeGame.timer_started_at) {
        const elapsedSinceStart = Math.floor(
          (Date.now() - new Date(activeGame.timer_started_at).getTime()) / 1000
        );
        return Math.max(0, activeGame.duration_seconds + elapsedSinceStart);
      }
      return activeGame.duration_seconds;
    };

    setCurrentSeconds(calculateCurrentTime());

    if (activeGame.timer_is_running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCurrentSeconds(calculateCurrentTime());
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeGame?.timer_is_running, activeGame?.timer_started_at, activeGame?.duration_seconds]);

  // Formatação MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Mapeamento de participantes por time
  const teamParticipantsMap = useMemo(() => {
    const map: Record<number, MatchParticipant[]> = {};
    for (let i = 1; i <= match.num_times; i++) {
      map[i] = [];
    }
    participants.forEach((p) => {
      if (p.team && map[p.team]) {
        map[p.team].push(p);
      }
    });
    return map;
  }, [participants, match.num_times]);

  // Informações visuais dos times (dinâmico via banco de dados)
  const getTeamInfo = (teamNum: number) => {
    return getTeamInfoFromHelper(match, teamNum);
  };

  // ═══════════════════════════════════════════════════════════════════
  // AÇÕES DO ADMINISTRADOR
  // ═══════════════════════════════════════════════════════════════════

  const isVolei = match.sport_type === 'volei';
  const volleyRequiresTwoPointAdvantage = matchRules.volley_requires_two_point_advantage === true;
  const volleyTargetScore = activeGame?.target_duration_minutes || 12;

  // Iniciar novo confronto
  const handleStartNewGame = async () => {
    if (!isAdmin) return;
    if (selectedTeamA === selectedTeamB) {
      toast.error('Selecione dois times diferentes para o confronto!');
      return;
    }

    setIsCreatingGame(true);
    try {
      const nextGameNumber = (allGames[0]?.game_number || 0) + 1;

      const { data, error } = await supabase
        .from('match_games')
        .insert({
          match_id: match.id,
          game_number: nextGameNumber,
          team_a: selectedTeamA,
          team_b: selectedTeamB,
          score_a: 0,
          score_b: 0,
          status: 'in_progress',
          two_goals_rule: isVolei ? false : twoGoalsRule,
          target_duration_minutes: isVolei ? 12 : (matchRules?.stage_duration_minutes || targetDurationMinutes),
          duration_seconds: 0,
          timer_started_at: new Date().toISOString(),
          timer_is_running: true,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao iniciar novo jogo: ' + error.message);
      } else {
        toast.success(isVolei ? `Jogo de Vôlei #${nextGameNumber} iniciado! 🏐` : `Jogo #${nextGameNumber} iniciado! ⚽`);
        setActiveGame(data);
        setGoals([]);
        void fetchGameData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao iniciar jogo.');
    } finally {
      setIsCreatingGame(false);
    }
  };

  // Play / Retomar Cronômetro
  const handleStartTimer = async () => {
    if (!isAdmin || !activeGame) return;
    try {
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

  // Pausar Cronômetro
  const handlePauseTimer = async () => {
    if (!isAdmin || !activeGame) return;
    try {
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

  // Resetar Cronômetro
  const handleResetTimer = async () => {
    if (!isAdmin || !activeGame) return;
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

  // Ajustar tempo alvo do cronômetro durante a partida
  const handleUpdateTargetDuration = async (minutes: number) => {
    if (!isAdmin || !activeGame) return;
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

  // Alternar regra de 2 gols
  const handleToggleTwoGoalsRule = async () => {
    if (!isAdmin || !activeGame || isVolei) return;
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

  // Abrir modal de gol/ponto
  const handleOpenGoalModal = (teamNum: number) => {
    if (!isAdmin || !activeGame || activeGame.status === 'finished') return;
    setGoalTeamNumber(teamNum);
    setIsGoalModalOpen(true);
  };

  // Confirmar registro de gol/ponto
  const handleConfirmGoal = async (playerId: string | null) => {
    if (!isAdmin || !activeGame) return;
    setIsSubmittingGoal(true);

    try {
      const isTeamA = goalTeamNumber === activeGame.team_a;
      const newScoreA = isTeamA ? activeGame.score_a + 1 : activeGame.score_a;
      const newScoreB = !isTeamA ? activeGame.score_b + 1 : activeGame.score_b;
      const currentMinute = Math.max(1, Math.ceil(currentSeconds / 60));

      // 1. Inserir gol / ponto
      const { error: goalError } = await supabase.from('match_game_goals').insert({
        game_id: activeGame.id,
        match_id: match.id,
        team: goalTeamNumber,
        player_id: playerId,
        minute: currentMinute,
      });

      if (goalError) {
        toast.error(`Erro ao salvar ${isVolei ? 'ponto' : 'gol'}: ` + goalError.message);
        return;
      }

      // 2. Regras de encerramento automático.
      const volleyWinnerSide = isVolei
        ? getVolleyWinnerSide(newScoreA, newScoreB, {
            targetScore: activeGame.target_duration_minutes || 12,
            requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
          })
        : null;
      const isVolleyWon = volleyWinnerSide !== null;
      const isFutebolHitTwoGoals = !isVolei && activeGame.two_goals_rule && (newScoreA >= 2 || newScoreB >= 2);
      const isAutoFinished = isVolleyWon || isFutebolHitTwoGoals;

      let updatePayload: Partial<MatchGame> = {
        score_a: newScoreA,
        score_b: newScoreB,
      };

      if (isAutoFinished) {
        const winner = isVolei
          ? (volleyWinnerSide === 'a' ? activeGame.team_a : activeGame.team_b)
          : (newScoreA >= 2 ? activeGame.team_a : activeGame.team_b);
        const finalDuration = currentSeconds;

        updatePayload = {
          ...updatePayload,
          status: 'finished',
          winner_team: winner,
          is_draw: false,
          timer_is_running: false,
          duration_seconds: finalDuration,
          timer_started_at: null,
          ended_at: new Date().toISOString(),
        };
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
        } else if (isFutebolHitTwoGoals) {
          toast.success(`🎉 GOOOL e Fim de Jogo! ${teamInfo.name} venceu por 2 gols! 🏆`);
        } else if (isVolei) {
          toast.success(`🏐 Ponto do ${teamInfo.name}! (${newScoreA} × ${newScoreB})`);
        } else {
          toast.success(`⚽ GOOOL do ${teamInfo.name}!`);
        }
        setIsGoalModalOpen(false);
        void fetchGameData();
        if (onGameFinished) onGameFinished();
      }
    } catch (e) {
      console.error(e);
      toast.error(`Erro inesperado ao registrar ${isVolei ? 'ponto' : 'gol'}.`);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // Excluir / Desfazer Gol
  const handleDeleteGoal = async (goalId: string, teamNum: number) => {
    if (!isAdmin || !activeGame) return;
    if (!confirm('Deseja realmente anular/excluir este gol?')) return;

    try {
      const isTeamA = teamNum === activeGame.team_a;
      const newScoreA = isTeamA ? Math.max(0, activeGame.score_a - 1) : activeGame.score_a;
      const newScoreB = !isTeamA ? Math.max(0, activeGame.score_b - 1) : activeGame.score_b;

      // 1. Excluir o gol
      await supabase.from('match_game_goals').delete().eq('id', goalId);

      // 2. Atualizar o placar
      await supabase
        .from('match_games')
        .update({
          score_a: newScoreA,
          score_b: newScoreB,
        })
        .eq('id', activeGame.id);

      toast.success('Gol cancelado.');
      void fetchGameData();
      if (onGameFinished) onGameFinished();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao anular gol.');
    }
  };

  // Finalizar Jogo Manualmente
  const handleFinishGame = async () => {
    if (!isAdmin || !activeGame) return;
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
          duration_seconds: currentSeconds,
          timer_started_at: null,
          ended_at: new Date().toISOString(),
        })
        .eq('id', activeGame.id);

      if (error) {
        toast.error('Erro ao finalizar jogo.');
      } else {
        toast.success('Partida finalizada com sucesso! 🏁');
        void fetchGameData();
        if (onGameFinished) onGameFinished();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const teamAInfo = activeGame ? getTeamInfo(activeGame.team_a) : null;
  const teamBInfo = activeGame ? getTeamInfo(activeGame.team_b) : null;
  const targetSeconds = (activeGame?.target_duration_minutes || 10) * 60;
  const isOvertime = currentSeconds > targetSeconds;

  // Compartilhar Transmissão no WhatsApp
  const handleShareLiveWhatsApp = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rls-sports.netlify.app';
    const broadcastUrl = `${origin}/matches/${match.id}/tv`;

    const dateFormatted = match.data
      ? (() => {
          const p = match.data.split('-');
          return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : match.data;
        })()
      : 'Hoje';

    const scoreInfo = activeGame
      ? `\n🔥 *JOGO #${activeGame.game_number}:* ${teamAInfo?.name || `Time ${activeGame.team_a}`} *${activeGame.score_a} × ${activeGame.score_b}* ${teamBInfo?.name || `Time ${activeGame.team_b}`}`
      : '';

    const text = `🔴 *TRANSMISSÃO AO VIVO DO PLACAR* ⚽\n\n🏆 *${match.titulo}*\n📍 *Local:* ${match.local}\n📅 *Data:* ${dateFormatted} às ${match.horario ? match.horario.substring(0, 5) : '--:--'}h${scoreInfo}\n\n📲 *Acompanhe em tempo real pelo link:*\n${broadcastUrl}\n\n_Atualizações automáticas ao vivo sem precisar recarregar a página!_`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Banner de Acesso à Mesa de Controle Exclusiva (Admin) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/40 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white flex items-center justify-center sm:justify-start gap-1.5">
                <span>Página Exclusiva de Controle da Partida</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                  MESA DE ARBITRAGEM
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Controle o cronômetro, registre gols e encerre partidas em uma tela focada e prática para celular.
              </p>
            </div>
          </div>

          <Link
            href={`/matches/${match.id}/control`}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Abrir Painel de Controle 🎛️</span>
          </Link>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PAINEL PRINCIPAL DO PLACAR AO VIVO
      ═══════════════════════════════════════════════════════════════════ */}
      {activeGame ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-white relative">
          {/* Efeito visual de luzes de estádio */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 pointer-events-none" />
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-32 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Barra Superior do Placar */}
          <div className="relative z-10 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-slate-950/60 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 text-[11px] font-black tracking-wider">
                JOGO #{activeGame.game_number}
              </span>

              {activeGame.status === 'in_progress' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-black animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  AO VIVO
                </span>
              ) : activeGame.status === 'paused' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-black">
                  <Pause className="w-3 h-3" />
                  PAUSADO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-black">
                  🏁 FINALIZADO
                </span>
              )}
            </div>

            {/* Indicador de Regras, Modo Telão e Compartilhar */}
            <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-400">
              {isVolei ? (
                <span
                  title={getVolleyWinRuleLabel({
                    targetScore: volleyTargetScore,
                    requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
                  })}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                >
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span>{getVolleyWinRuleLabel({
                    targetScore: volleyTargetScore,
                    requireTwoPointAdvantage: volleyRequiresTwoPointAdvantage,
                  })} 🏐</span>
                </span>
              ) : activeGame.two_goals_rule ? (
                <span
                  title="Quem fizer 2 gols primeiro vence imediatamente"
                  className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hidden sm:flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  <span>Regra 2 Gols</span>
                </span>
              ) : null}

              <button
                onClick={handleShareLiveWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] font-extrabold text-xs shadow-sm transition-all cursor-pointer"
                title="Compartilhar placar no WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <Link
                href={`/matches/${match.id}/tv`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs shadow-sm transition-all"
                title="Abrir Placar em Tela Cheia para TV / Monitor"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Modo Telão</span>
              </Link>
            </div>
          </div>

          {/* Área do Placar Eletrônico */}
          <div className="relative z-10 p-4 sm:p-6">
            <div className="grid grid-cols-7 items-center gap-2 sm:gap-4">
              {/* TIME A */}
              <div className="col-span-3 flex flex-col items-center text-center space-y-2">
                <TeamBadge
                  teamInfo={teamAInfo}
                  size="lg"
                  rounded="2xl"
                  className="shadow-xl shadow-brand-500/10"
                  onClick={(e) => {
                    if (teamAInfo?.badge_url) {
                      e.stopPropagation();
                      openImagePreview({
                        imageUrl: teamAInfo.badge_url,
                        title: teamAInfo.name,
                        subtitle: 'Emblema Oficial • Time Mandante',
                        type: 'team_badge',
                        badge: 'Jogo Ao Vivo',
                      });
                    }
                  }}
                />
                <span className={`font-black text-sm sm:text-lg block leading-tight ${teamAInfo?.text || 'text-white'}`}>
                  {teamAInfo?.name || `Time ${activeGame.team_a}`}
                </span>

                {/* Botão de Gol/Ponto Time A (Admin) */}
                {isAdmin && activeGame.status !== 'finished' && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => handleOpenGoalModal(activeGame.team_a)}
                    className={`w-full max-w-[130px] py-2 px-3 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      isVolei
                        ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-emerald-500/30'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isVolei ? 'PONTO' : 'GOL'}</span>
                  </motion.button>
                )}
              </div>

              {/* PLACAR CENTRAL */}
              <div className="col-span-1 flex flex-col items-center justify-center space-y-1">
                <div className="flex items-center justify-center gap-1 sm:gap-2">
                  <span className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
                    {activeGame.score_a}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-500">:</span>
                  <span className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
                    {activeGame.score_b}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                  VS
                </span>
              </div>

              {/* TIME B */}
              <div className="col-span-3 flex flex-col items-center text-center space-y-2">
                <TeamBadge
                  teamInfo={teamBInfo}
                  size="lg"
                  rounded="2xl"
                  className="shadow-xl shadow-brand-500/10"
                  onClick={(e) => {
                    if (teamBInfo?.badge_url) {
                      e.stopPropagation();
                      openImagePreview({
                        imageUrl: teamBInfo.badge_url,
                        title: teamBInfo.name,
                        subtitle: 'Emblema Oficial • Time Desafiante',
                        type: 'team_badge',
                        badge: 'Jogo Ao Vivo',
                      });
                    }
                  }}
                />
                <span className={`font-black text-sm sm:text-lg block leading-tight ${teamBInfo?.text || 'text-white'}`}>
                  {teamBInfo?.name || `Time ${activeGame.team_b}`}
                </span>

                {/* Botão de Gol/Ponto Time B (Admin) */}
                {isAdmin && activeGame.status !== 'finished' && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => handleOpenGoalModal(activeGame.team_b)}
                    className={`w-full max-w-[130px] py-2 px-3 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      isVolei
                        ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-emerald-500/30'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isVolei ? 'PONTO' : 'GOL'}</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* CRONÔMETRO CENTRAL (APENAS FUTEBOL) */}
            {!isVolei ? (
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col items-center justify-center space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${activeGame.timer_is_running ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
                  <span
                    className={`text-2xl sm:text-3xl font-black font-mono tracking-widest ${
                      isOvertime ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {formatTime(currentSeconds)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono font-bold">
                    / {activeGame.target_duration_minutes || 10}:00
                  </span>
                </div>

                {isOvertime && (
                  <span className="text-[10px] font-black uppercase text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-md border border-rose-500/30 animate-pulse">
                    ⏱️ Tempo Regulamentar Esgotado ({formatTime(currentSeconds - targetSeconds)} de acréscimo)
                  </span>
                )}

                {/* CONTROLES DO CRONÔMETRO PARA O ADMIN */}
                {isAdmin && activeGame.status !== 'finished' && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {activeGame.timer_is_running ? (
                      <button
                        onClick={handlePauseTimer}
                        className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pausar</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStartTimer}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Iniciar / Retomar</span>
                      </button>
                    )}

                    <button
                      onClick={handleResetTimer}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                      title="Zerar cronômetro"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Zerar</span>
                    </button>

                    {/* Seletor rápido de minutos do tempo */}
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold">Meta:</span>
                      {PRESET_DURATIONS.slice(0, 4).map((mins) => (
                        <button
                          key={mins}
                          onClick={() => handleUpdateTargetDuration(mins)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            activeGame.target_duration_minutes === mins
                              ? 'bg-brand-500 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* RESULTADO SE FINALIZADO */}
            {activeGame.status === 'finished' && (
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-brand-500/20 to-teal-500/20 border border-emerald-500/30 text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-black text-xs">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>CONFRONTO FINALIZADO</span>
                </div>
                <h4 className="text-base sm:text-lg font-black text-white">
                  {activeGame.is_draw
                    ? 'Empate no Placar Final!'
                    : `Vitória do ${getTeamInfo(activeGame.winner_team || activeGame.team_a).name}! 🏆`}
                </h4>
                <p className="text-xs text-slate-300 font-medium">
                  Resultado registrado com sucesso na tabela de classificação.
                </p>
              </div>
            )}
          </div>

          {/* LINHA DO TEMPO / FEED DE GOLS DESTE CONFRONTO */}
          {goals.length > 0 && (
            <div className="relative z-10 px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/40">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                ⚽ Lances & Gols ({goals.length})
              </span>
              <div className="space-y-1.5">
                {goals.map((g) => {
                  const tInfo = getTeamInfo(g.team);
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-amber-400 shrink-0">{g.minute}'</span>
                        <TeamBadge teamInfo={tInfo} size="2xs" rounded="md" showBorder={false} />
                        <span className="font-bold text-white truncate">
                          {g.player?.nome || 'Gol do Time'}
                          {g.player?.apelido && (
                            <span className="text-slate-400 font-normal ml-1">({g.player.apelido})</span>
                          )}
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${tInfo.lightBg} ${tInfo.text}`}>
                          {tInfo.name}
                        </span>
                      </div>

                      {isAdmin && activeGame.status !== 'finished' && (
                        <button
                          onClick={() => handleDeleteGoal(g.id, g.team)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          title="Anular este gol"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BARRA DE AÇÕES INFERIOR DO ADMIN */}
          {isAdmin && (
            <div className="relative z-10 p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Toggle Regra de 2 Gols */}
                {activeGame.status !== 'finished' && (
                  <button
                    onClick={handleToggleTwoGoalsRule}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      activeGame.two_goals_rule
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Regra 2 Gols: {activeGame.two_goals_rule ? 'ON' : 'OFF'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeGame.status !== 'finished' ? (
                  <button
                    onClick={handleFinishGame}
                    className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Encerrar Jogo Manualmente</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveGame(null)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-brand-500 hover:from-emerald-600 hover:to-brand-600 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Criar Próximo Confronto</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
          CRIADOR DE NOVO CONFRONTO (QUANDO NÃO HÁ JOGO ATIVO OU APÓS FINALIZAR)
      ═══════════════════════════════════════════════════════════════════ */}
      {(!activeGame || activeGame.status === 'finished') && isAdmin && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-brand-500 shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Iniciar Novo Confronto / Placar
                </h3>
                <span className="text-[11px] text-slate-400">
                  Selecione os dois times para disputar o próximo jogo
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditTeamsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-bold transition-all cursor-pointer w-fit"
              title="Personalizar nomes e cores dos times"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Personalizar Times</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* TIME 1 */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
                Time A (Mandante)
              </label>
              <select
                value={selectedTeamA}
                onChange={(e) => setSelectedTeamA(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              >
                {Array.from({ length: match.num_times }).map((_, i) => {
                  const tNum = i + 1;
                  const tInfo = getTeamInfo(tNum);
                  return (
                    <option key={tNum} value={tNum}>
                      {tInfo.emoji} {tInfo.name} ({teamParticipantsMap[tNum]?.length || 0} jogadores)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* TIME 2 */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
                Time B (Desafiante)
              </label>
              <select
                value={selectedTeamB}
                onChange={(e) => setSelectedTeamB(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              >
                {Array.from({ length: match.num_times }).map((_, i) => {
                  const tNum = i + 1;
                  const tInfo = getTeamInfo(tNum);
                  return (
                    <option key={tNum} value={tNum}>
                      {tInfo.emoji} {tInfo.name} ({teamParticipantsMap[tNum]?.length || 0} jogadores)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Configurações do Jogo */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-3">
            {/* Escolha do Tempo do Cronômetro (Apenas Futebol se não configurado) */}
            {!isVolei ? (
              !matchRules?.stage_duration_minutes ? (
                <div>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1.5">
                    ⏱️ Tempo do Cronômetro:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_DURATIONS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setTargetDurationMinutes(mins)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                          targetDurationMinutes === mins
                            ? 'bg-brand-500 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-brand-500'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            ) : (
              <div className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>
                  Regra do Vôlei: {volleyRequiresTwoPointAdvantage
                    ? 'a equipe precisa atingir 12 pontos e abrir 2 de vantagem para vencer.'
                    : 'o primeiro time a atingir 12 pontos vence automaticamente.'}
                </span>
              </div>
            )}

            {/* Toggle Regra de 2 Gols (Apenas Futebol) */}
            {!isVolei && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                    ⚡ Regra de 2 Gols
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Quem marcar 2 gols primeiro vence a partida automaticamente.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTwoGoalsRule(!twoGoalsRule)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    twoGoalsRule ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      twoGoalsRule ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.01 }}
            onClick={handleStartNewGame}
            disabled={isCreatingGame}
            className={`w-full py-3.5 text-white font-black text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              isVolei
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25'
                : 'bg-gradient-to-r from-emerald-500 via-brand-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25'
            }`}
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isCreatingGame ? 'Iniciando...' : isVolei ? 'Iniciar Jogo de Vôlei no Placar 🏐' : 'Iniciar Confronto no Placar ao Vivo ⚽'}</span>
          </motion.button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          HISTÓRICO DE CONFRONTOS DESTA PARTIDA
      ═══════════════════════════════════════════════════════════════════ */}
      {allGames.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-500" />
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                Histórico de Jogos do Evento ({allGames.length})
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allGames.map((g) => {
              const tA = getTeamInfo(g.team_a);
              const tB = getTeamInfo(g.team_b);
              const isFinished = g.status === 'finished';

              return (
                <div
                  key={g.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                    g.id === activeGame?.id
                      ? 'border-brand-500/50 bg-brand-500/5 dark:bg-brand-500/10'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-black text-[10px] text-slate-400">#{g.game_number}</span>
                    <div className="flex items-center gap-1.5 font-bold truncate">
                      <div className="flex items-center gap-1">
                        <TeamBadge teamInfo={tA} size="2xs" rounded="md" showBorder={false} />
                        <span className="truncate">{tA.name}</span>
                      </div>
                      <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black text-xs shrink-0">
                        {g.score_a} - {g.score_b}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="truncate">{tB.name}</span>
                        <TeamBadge teamInfo={tB} size="2xs" rounded="md" showBorder={false} />
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      isFinished
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isFinished ? 'Fim' : 'Em Jogo'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Gol / Ponto */}
      {activeGame && (
        <GoalModal
          isOpen={isGoalModalOpen}
          onClose={() => setIsGoalModalOpen(false)}
          onConfirm={handleConfirmGoal}
          teamNumber={goalTeamNumber}
          teamName={getTeamInfo(goalTeamNumber).name}
          teamEmoji={getTeamInfo(goalTeamNumber).emoji}
          teamBadgeUrl={getTeamInfo(goalTeamNumber).badge_url}
          teamColor={getTeamInfo(goalTeamNumber).color}
          players={teamParticipantsMap[goalTeamNumber] || []}
          isSubmitting={isSubmittingGoal}
          sportType={match.sport_type || 'futebol'}
        />
      )}

      {/* Modal de Personalização dos Times */}
      <EditTeamsModal
        isOpen={isEditTeamsOpen}
        onClose={() => setIsEditTeamsOpen(false)}
        match={match}
        onTeamsUpdated={() => {
          void fetchGameData();
          if (onGameFinished) onGameFinished();
        }}
      />

      {/* Lightbox para Visualização Ampliada de Imagens */}
      <ImageLightboxModal
        data={lightboxData}
        onClose={closeImagePreview}
      />
    </div>
  );
};
