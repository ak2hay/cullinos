/**
 * Public promo playlist for in-store TVs.
 * Accessed via /?mode=playlist&orgSlug=...&outletSlug=...
 */

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_API_BASE } from '@cullinos/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE;
const HEARTBEAT_MS = 60_000;

async function sendHeartbeat(orgSlug: string, outletSlug: string) {
  try {
    await fetch(`${API_BASE}/public/promo-display/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug, outletSlug, mode: 'playlist' }),
    });
  } catch {
    // best-effort
  }
}

interface PlaylistSlide {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  slideType: string;
  durationSeconds: number;
}

interface PlaylistResponse {
  outletName: string;
  slides: PlaylistSlide[];
  refreshSeconds: number;
}

async function fetchPlaylist(orgSlug: string, outletSlug: string): Promise<PlaylistResponse> {
  const params = new URLSearchParams({ orgSlug, outletSlug });
  const res = await fetch(`${API_BASE}/public/promo-display/playlist?${params}`);
  if (!res.ok) throw new Error('Failed to load playlist');
  return res.json() as Promise<PlaylistResponse>;
}

export function PromoPlaylistPage({
  orgSlug,
  outletSlug,
}: {
  orgSlug: string;
  outletSlug: string;
}) {
  const [playlist, setPlaylist] = useState<PlaylistResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchPlaylist(orgSlug, outletSlug)
      .then(setPlaylist)
      .catch(() => setError('Unable to load promo playlist'));
    const refresh = setInterval(() => {
      void fetchPlaylist(orgSlug, outletSlug).then(setPlaylist).catch(() => undefined);
    }, 60_000);
    return () => clearInterval(refresh);
  }, [orgSlug, outletSlug]);

  // Heartbeat
  useEffect(() => {
    void sendHeartbeat(orgSlug, outletSlug);
    heartbeatRef.current = setInterval(
      () => void sendHeartbeat(orgSlug, outletSlug),
      HEARTBEAT_MS,
    );
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [orgSlug, outletSlug]);

  // Fullscreen listener
  useEffect(() => {
    function onChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  const slides = playlist?.slides ?? [];
  const current = slides[index % Math.max(slides.length, 1)];

  useEffect(() => {
    if (slides.length === 0) return;
    const duration = (current?.durationSeconds ?? 10) * 1000;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), duration);
    return () => clearTimeout(timer);
  }, [index, slides.length, current?.durationSeconds]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p>{error}</p>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="animate-pulse text-xl">Loading playlist…</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0a0a12] p-10 text-white">
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className="absolute right-4 top-4 rounded-lg border border-white/10 bg-black/30 p-2 text-white/50 opacity-0 transition hover:opacity-100 focus:opacity-100"
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></svg>
          )}
        </button>
        <p className="text-sm uppercase tracking-widest text-brand-primary">Cullinos</p>
        <h1 className="mt-4 text-5xl font-bold">{playlist.outletName}</h1>
        <p className="mt-6 text-xl text-gray-400">Add promo slides in Admin → Displays</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#0a0a12] p-8 text-white">
      {/* Fullscreen toggle — top-right corner, appears on hover */}
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        className="absolute right-4 top-4 z-20 rounded-lg border border-white/10 bg-black/30 p-2 text-white/50 opacity-0 transition hover:opacity-100 focus:opacity-100"
      >
        {isFullscreen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></svg>
        )}
      </button>

      {current.imageUrl ? (
        <img
          src={current.imageUrl}
          alt={current.title ?? 'Promo slide'}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      ) : null}
      <div className="relative z-10 max-w-4xl text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-brand-primary">{playlist.outletName}</p>
        {current.title ? (
          <h1 className="mt-6 text-5xl font-bold leading-tight md:text-7xl">{current.title}</h1>
        ) : null}
        {current.subtitle ? (
          <p className="mt-6 text-2xl text-gray-300 md:text-3xl">{current.subtitle}</p>
        ) : null}
        <p className="mt-10 text-sm uppercase tracking-widest text-gray-500">{current.slideType}</p>
      </div>
    </div>
  );
}
