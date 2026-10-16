'use client';

import React, { useState, useEffect } from 'react';
import { Match } from '@/types/database';
import { Clock, CheckCircle2, AlertCircle, Flame, Zap, Sparkles } from 'lucide-react';

interface MatchCountdownProps {
  match: Match;
  className?: string;
  onOpenChampion?: () => void;
}

export const MatchCountdown: React.FC<MatchCountdownProps> = ({ match, className = '', onOpenChampion }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
    isOngoing: boolean;
    diffMs: number;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
    isOngoing: false,
    diffMs: 0,
  });

  const [progressPercent, setProgressPercent] = useState<number>(100);

  useEffect(() => {
    const calculateTime = () => {
      if (!match.data || !match.horario) return;

      // Parse seguro de YYYY-MM-DD e HH:mm para evitar fuso horário e UTC offset bugs
      const [year, month, day] = match.data.split('-').map(Number);
      const [hours, minutes] = match.horario.split(':').map(Number);

      // Data e hora exata da partida no fuso local
      const matchDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0);
      const now = new Date();

      const diffMs = matchDate.getTime() - now.getTime();

      // Considerar partida "em andamento" por 2 horas após o horário de início (se não finalizada/cancelada)
      const durationMs = 2 * 60 * 60 * 1000;

      // Cálculo da porcentagem da barra de progresso (do anúncio até a hora do jogo)
      const createdTime = match.created_at
        ? new Date(match.created_at).getTime()
        : matchDate.getTime() - 7 * 24 * 60 * 60 * 1000;
      const totalWindow = Math.max(1, matchDate.getTime() - createdTime);
      const pct = Math.min(100, Math.max(0, (1 - diffMs / totalWindow) * 100));
      setProgressPercent(isNaN(pct) ? 50 : pct);

      if (diffMs <= 0) {
        if (Math.abs(diffMs) < durationMs && match.status !== 'finalizada' && match.status !== 'cancelada') {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isOngoing: true, diffMs });
        } else {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isOngoing: false, diffMs });
        }
      } else {
        const seconds = Math.floor((diffMs / 1000) % 60);
        const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
        const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        setTimeLeft({ days, hours, minutes, seconds, isPast: false, isOngoing: false, diffMs });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [match.data, match.horario, match.status, match.created_at]);

  // Se partida foi cancelada
  if (match.status === 'cancelada') {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-slate-950/80 border border-red-500/30 p-3 shadow-md ${className}`}>
        <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="uppercase tracking-wide">Partida Cancelada</span>
        </div>
      </div>
    );
  }

  // Se partida foi finalizada ou se o tempo já passou completamente
  if (match.status === 'finalizada' || timeLeft.isPast) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/95 via-amber-950/30 to-slate-950/95 border border-amber-500/30 p-2.5 sm:p-3 shadow-lg ${className}`}>
        {/* Luz dourada de celebração no fundo */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/15 rounded-full blur-xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 text-slate-300 font-extrabold text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="uppercase tracking-wider text-slate-200">Partida Encerrada</span>
          </div>

          {onOpenChampion && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChampion();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
              <span>Ver Time Campeão 🏆</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Se o horário chegou e a partida está rolando no momento
  if (timeLeft.isOngoing || match.status === 'em_andamento') {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-amber-950/40 border border-amber-500/40 p-3 sm:p-3.5 shadow-md ${className}`}>
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-amber-500/20 rounded-full blur-xl pointer-events-none animate-pulse" />
        
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-amber-400">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" />
                <span>Rola a Bola • Ao Vivo</span>
              </div>
              <p className="text-[11px] font-medium text-slate-300 dark:text-slate-400 truncate">Partida em andamento no gramado!</p>
            </div>
          </div>

          <div className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs shrink-0 animate-pulse">
            EM JOGO ⚽
          </div>
        </div>
      </div>
    );
  }

  // Urgência dinâmica baseada no tempo restante
  const isLessThan1Hour = timeLeft.diffMs > 0 && timeLeft.diffMs <= 60 * 60 * 1000;
  const isToday = timeLeft.days === 0;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-950/80 dark:bg-slate-950/90 border ${isLessThan1Hour ? 'border-amber-500/40 shadow-amber-950/30' : isToday ? 'border-emerald-500/30 shadow-emerald-950/20' : 'border-slate-800/80 shadow-black/30'} p-3 sm:p-3.5 shadow-md backdrop-blur-md ${className}`}>
      {/* Brilho atmosférico sutil no topo */}
      <div
        className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl pointer-events-none ${
          isLessThan1Hour
            ? 'bg-amber-500/15'
            : isToday
            ? 'bg-emerald-500/15'
            : 'bg-brand-500/10'
        }`}
      />

      <div className="relative space-y-2">
        {/* Cabeçalho do Cronômetro */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLessThan1Hour ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLessThan1Hour
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                }`}
              />
            </span>

            <span className="text-[11px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1">
              {isLessThan1Hour ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-amber-300">Contagem Final</span>
                </>
              ) : isToday ? (
                <>
                  <Flame className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  <span className="text-emerald-300">É Hoje! Começa em</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>Começa em</span>
                </>
              )}
            </span>
          </div>

          {/* Horário de Início */}
          {match.horario && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-extrabold shrink-0">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>{match.horario}h</span>
            </div>
          )}
        </div>

        {/* Blocos Digitais do Cronômetro */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-0.5">
          {/* Card: DIAS */}
          {timeLeft.days > 0 && (
            <>
              <div className="flex-1 flex flex-col items-center">
                <div className="relative w-full py-1.5 sm:py-2 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 flex items-center justify-center shadow-xs overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 pointer-events-none" />
                  <span className="font-mono font-black text-base sm:text-xl text-emerald-300 tracking-tight leading-none">
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400/80 mt-1">
                  Dias
                </span>
              </div>

              <span className="font-mono font-bold text-slate-600 text-xs pb-3.5 select-none">:</span>
            </>
          )}

          {/* Card: HORAS */}
          <div className="flex-1 flex flex-col items-center">
            <div className="relative w-full py-1.5 sm:py-2 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-center shadow-xs overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 pointer-events-none" />
              <span className="font-mono font-black text-base sm:text-xl text-white tracking-tight leading-none">
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1">
              Horas
            </span>
          </div>

          <span className="font-mono font-bold text-slate-600 text-xs pb-3.5 select-none">:</span>

          {/* Card: MINUTOS */}
          <div className="flex-1 flex flex-col items-center">
            <div className="relative w-full py-1.5 sm:py-2 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-center shadow-xs overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 pointer-events-none" />
              <span className="font-mono font-black text-base sm:text-xl text-white tracking-tight leading-none">
                {String(timeLeft.minutes).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1">
              Min
            </span>
          </div>

          <span className="font-mono font-bold text-slate-600 text-xs pb-3.5 select-none">:</span>

          {/* Card: SEGUNDOS */}
          <div className="flex-1 flex flex-col items-center">
            <div className="relative w-full py-1.5 sm:py-2 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 flex items-center justify-center shadow-xs overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 pointer-events-none" />
              <span className="font-mono font-black text-base sm:text-xl text-amber-400 tracking-tight leading-none">
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/90 mt-1">
              Seg
            </span>
          </div>
        </div>

        {/* Barra de Progresso Fina */}
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

