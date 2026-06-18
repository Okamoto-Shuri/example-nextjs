'use client';

import { useState, useEffect, type CSSProperties } from 'react';

const STORAGE_KEY = 'nb-splash-shown';
const FADE_START_MS = 2800;
const TOTAL_DURATION_MS = 3600;

/**
 * Netflix 風「NB」ロゴ スプラッシュスクリーン
 *
 * public/novabase-logo-transparent.png（背景透過版）を使用し、
 * CSSフィルターで白色に反転してNetflix風の演出で表示。
 * - インラインスタイル + <style> 注入（外部 CSS 不要）
 * - sessionStorage でセッション内初回のみ表示
 * - アニメーション完了後に DOM から完全除去
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing');

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        setPhase('done');
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // sessionStorage が使えない環境でも表示する
    }

    const fadeTimer = setTimeout(() => setPhase('fading'), FADE_START_MS);
    const doneTimer = setTimeout(() => setPhase('done'), TOTAL_DURATION_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    overflow: 'hidden',
    // フェードアウト時のみアニメーション適用
    ...(phase === 'fading' ? {
      animation: 'nbFadeOut 0.8s cubic-bezier(0.4,0,0.2,1) forwards',
    } : {}),
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />
      <div style={overlayStyle} aria-hidden="true">
        {/* Background glow */}
        <div style={glowStyle} />

        {/* Particles */}
        {PARTICLES.map((p, i) => (
          <span key={i} style={particleStyle(p)} />
        ))}

        {/* Logo — 透過版 PNG を CSS フィルターで白に */}
        <div style={wrapperStyle}>
          <div style={sweepContainerStyle}>
            <img
              src="/novabase-logo-transparent.png"
              alt=""
              style={logoStyle}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ================================================================
   定数・スタイル
   ================================================================ */

const PARTICLES = [
  { top: '30%', left: '25%', delay: '1.0s' },
  { top: '65%', left: '72%', delay: '1.2s' },
  { top: '20%', left: '68%', delay: '1.1s' },
  { top: '72%', left: '28%', delay: '1.3s' },
  { top: '40%', left: '82%', delay: '1.15s' },
  { top: '58%', left: '18%', delay: '1.25s' },
  { top: '48%', left: '50%', delay: '1.05s' },
  { top: '35%', left: '78%', delay: '1.35s' },
];

const glowStyle: CSSProperties = {
  position: 'absolute',
  width: '600px',
  height: '600px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.18) 30%, rgba(168,85,247,0.05) 55%, transparent 70%)',
  animation: 'nbGlow 2.8s ease-in-out forwards',
  pointerEvents: 'none',
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'nbLogoEnter 1.4s cubic-bezier(0.22,1,0.36,1) forwards',
};

const sweepContainerStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  lineHeight: 0,
};

const logoStyle: CSSProperties = {
  width: 'clamp(140px, 28vw, 300px)',
  height: 'auto',
  // brightness(0) → 黒に, invert(1) → 白に反転（透過部分はそのまま）
  filter: 'brightness(0) invert(1) drop-shadow(0 0 60px rgba(99,102,241,0.5)) drop-shadow(0 0 25px rgba(139,92,246,0.35))',
  userSelect: 'none',
  pointerEvents: 'none',
};

function particleStyle(p: { top: string; left: string; delay: string }): CSSProperties {
  return {
    position: 'absolute',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'rgba(196,181,253,0.9)',
    opacity: 0,
    top: p.top,
    left: p.left,
    animation: `nbParticle 2s ease-out ${p.delay} forwards`,
  };
}

const KEYFRAMES_CSS = `
  @keyframes nbLogoEnter {
    0%   { opacity: 0; transform: translateY(-60px) scale(0.5); }
    45%  { opacity: 1; transform: translateY(6px) scale(1.04); }
    70%  { transform: translateY(-3px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes nbSweep {
    0%   { transform: translateX(-130%); }
    100% { transform: translateX(130%); }
  }
  @keyframes nbGlow {
    0%   { opacity: 0; transform: scale(0.3); }
    20%  { opacity: 1; transform: scale(0.9); }
    50%  { opacity: 1; transform: scale(1.1); }
    100% { opacity: 0.15; transform: scale(1.5); }
  }
  @keyframes nbParticle {
    0%   { opacity: 0; transform: translateY(0) scale(1); }
    12%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(-80px) scale(0); }
  }
  @keyframes nbFadeOut {
    0%   { opacity: 1; }
    100% { opacity: 0; visibility: hidden; pointer-events: none; }
  }
  /* 光のスイープ（::after 疑似要素はインラインで設定不可のため CSS で） */
  #nb-splash-sweep::after {
    content: '';
    position: absolute;
    inset: -20% -60%;
    background: linear-gradient(
      105deg,
      transparent 0%, transparent 33%,
      rgba(255,255,255,0.08) 43%,
      rgba(255,255,255,0.25) 50%,
      rgba(255,255,255,0.08) 57%,
      transparent 67%, transparent 100%
    );
    animation: nbSweep 1.6s ease-in-out 1.0s forwards;
    transform: translateX(-130%);
    pointer-events: none;
  }
`;
