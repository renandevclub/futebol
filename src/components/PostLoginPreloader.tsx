"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type PreloaderPhase = "loading" | "playing" | "closing";

export function PostLoginPreloader() {
  const { isEntryPreloaderOpen, closeEntryPreloader } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const didFinishRef = useRef(false);
  const finishTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<PreloaderPhase>("loading");

  const finish = useCallback(() => {
    if (!isEntryPreloaderOpen || didFinishRef.current) return;

    didFinishRef.current = true;
    setPhase("closing");
    finishTimerRef.current = window.setTimeout(() => {
      closeEntryPreloader();
      finishTimerRef.current = null;
    }, 280);
  }, [closeEntryPreloader, isEntryPreloaderOpen]);

  useEffect(() => {
    if (!isEntryPreloaderOpen) {
      didFinishRef.current = false;
      setPhase("loading");
      return;
    }

    didFinishRef.current = false;
    setPhase("loading");
    skipButtonRef.current?.focus({ preventScroll: true });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      finish();
      return;
    }

    const video = videoRef.current;
    let fallbackTimer: number | null = null;
    const safetyTimer = window.setTimeout(finish, 8500);

    const startFallback = () => {
      if (fallbackTimer !== null || didFinishRef.current) return;
      fallbackTimer = window.setTimeout(finish, 1200);
    };

    const handlePlaying = () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      setPhase("playing");
    };

    if (!video) {
      startFallback();
    } else {
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("ended", finish);
      video.addEventListener("error", startFallback);

      try {
        const playback = video.play();
        if (playback) void playback.catch(startFallback);
      } catch {
        startFallback();
      }
    }

    return () => {
      window.clearTimeout(safetyTimer);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      video?.removeEventListener("playing", handlePlaying);
      video?.removeEventListener("ended", finish);
      video?.removeEventListener("error", startFallback);
    };
  }, [finish, isEntryPreloaderOpen]);

  useEffect(() => {
    if (!isEntryPreloaderOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEntryPreloaderOpen]);

  if (!isEntryPreloaderOpen) return null;

  return (
    <div
      className="entry-preloader"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-preloader-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
        } else if (event.key === "Tab") {
          event.preventDefault();
          skipButtonRef.current?.focus();
        }
      }}
    >
      <h1 id="entry-preloader-title" className="sr-only">
        Bem-vindo ao F&amp;V Sports
      </h1>
      <p className="sr-only" role="status" aria-live="polite">
        Preparando sua entrada no F&amp;V Sports.
      </p>

      <video
        ref={videoRef}
        className="entry-preloader__video"
        src="/videos/fv-sports-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      <div className="entry-preloader__fallback" aria-hidden="true">
        <img src="/logo.png" alt="" />
        <span className="entry-preloader__spinner" />
        <span>Preparando sua resenha</span>
      </div>

      <button
        ref={skipButtonRef}
        className="entry-preloader__skip"
        type="button"
        onClick={finish}
        aria-label="Pular animação de entrada"
      >
        Pular
      </button>
    </div>
  );
}
