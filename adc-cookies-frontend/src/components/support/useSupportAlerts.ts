'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SupportApi, SupportSummary } from '@/lib/supportTypes';

/*
 * A soft two-note chime for a new customer message. Deliberately unlike the store's new-order
 * alarm: an order has to be heard across a kitchen, a chat only needs noticing.
 */
export function playChime(ctx: AudioContext) {
  const t = ctx.currentTime + 0.03;
  [[784, 0], [1047, 0.16]].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.35, t + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t + delay); osc.stop(t + delay + 0.4);
  });
}

/*
 * Browsers only allow sound after a tap on the page, so the audio is unlocked by the first tap or
 * key anywhere, and every chime checks again. Returns play().
 */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = useCallback(async () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current ??= new Ctx();
      if (ctxRef.current.state === 'suspended') await ctxRef.current.resume().catch(() => {});
      return ctxRef.current.state === 'running' ? ctxRef.current : null;
    } catch { return null; }
  }, []);
  useEffect(() => {
    const unlock = () => { void ensure(); };
    const opts = { passive: true } as const;
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, opts);
    return () => { for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, unlock); };
  }, [ensure]);
  return useCallback(async () => {
    const ctx = await ensure();
    if (ctx) playChime(ctx);
    try { navigator.vibrate?.([80, 40, 80]); } catch { /* not supported */ }
  }, [ensure]);
}

/*
 * The inbox badge, and a callback when a customer has written since the last look. Polls the
 * summary endpoint, which is one small query. The first load never counts as "new": opening the
 * page to a busy inbox should show it, not ring.
 */
export function useSupportAlerts(api: SupportApi, onNew: () => void, { enabled = true, everyMs = 8000 } = {}) {
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const seen = useRef<string | null | undefined>(undefined);
  const onNewRef = useRef(onNew);
  useEffect(() => { onNewRef.current = onNew; }, [onNew]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.summary();
        if (!alive) return;
        setSummary(s);
        if (seen.current !== undefined && s.latestCustomerAt && s.latestCustomerAt !== seen.current) onNewRef.current();
        seen.current = s.latestCustomerAt;
      } catch { /* the next tick tries again */ }
    };
    void tick();
    const t = setInterval(tick, everyMs);
    return () => { alive = false; clearInterval(t); };
  }, [api, everyMs, enabled]);

  return enabled ? summary : null;
}
