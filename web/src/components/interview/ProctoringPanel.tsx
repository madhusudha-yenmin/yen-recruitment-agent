"use client";
import React from 'react';
import { ProctoringViolation, FaceStatus, GazeZone } from '../../hooks/useProctoring';

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_STYLE = {
  high:   { bg: 'bg-red-500/10',   border: 'border-red-500/30',   text: 'text-red-400',   badge: 'bg-red-500',   ring: '#ef4444', label: 'HIGH' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500', ring: '#f59e0b', label: 'MED'  },
  low:    { bg: 'bg-sky-500/10',   border: 'border-sky-500/30',   text: 'text-sky-400',   badge: 'bg-sky-500',   ring: '#38bdf8', label: 'LOW'  },
};

const GAZE_META: Record<GazeZone, { label: string; icon: string; good: boolean }> = {
  center:  { label: 'Focused on Screen', icon: '👁',  good: true  },
  left:    { label: 'Looking Left',       icon: '←',   good: false },
  right:   { label: 'Looking Right',      icon: '→',   good: false },
  up:      { label: 'Looking Up',         icon: '↑',   good: false },
  down:    { label: 'Looking Down',       icon: '↓',   good: false },
  unknown: { label: 'Gaze Unknown',       icon: '?',   good: false },
};

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - score / 100);
  const color =
    score >= 80 ? '#22c55e' :
    score >= 55 ? '#f59e0b' :
    '#ef4444';
  const label =
    score >= 80 ? 'Good Standing' :
    score >= 55 ? 'Under Review'  :
    'Compromised';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[104px] h-[104px]">
        <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
          {/* track */}
          <circle cx="52" cy="52" r={R} fill="none" stroke="#1e293b" strokeWidth="9" />
          {/* score arc */}
          <circle
            cx="52" cy="52" r={R}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[10px] text-slate-500 font-semibold">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Gaze Eye Diagram ─────────────────────────────────────────────────────────

function GazeDiagram({ zone }: { zone: GazeZone }) {
  type Cell = { zone: GazeZone; row: number; col: number };
  const cells: Cell[] = [
    { zone: 'unknown', row: 0, col: 0 }, { zone: 'up',     row: 0, col: 1 }, { zone: 'unknown', row: 0, col: 2 },
    { zone: 'left',    row: 1, col: 0 }, { zone: 'center', row: 1, col: 1 }, { zone: 'right',   row: 1, col: 2 },
    { zone: 'unknown', row: 2, col: 0 }, { zone: 'down',   row: 2, col: 1 }, { zone: 'unknown', row: 2, col: 2 },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 w-20 mx-auto">
      {cells.map((c, i) => {
        const isActive = c.zone === zone && c.zone !== 'unknown';
        const isCenter = c.zone === 'center';
        return (
          <div
            key={i}
            className={`h-5 rounded transition-all duration-300 ${
              isActive
                ? zone === 'center'
                  ? 'bg-emerald-500 shadow-md shadow-emerald-500/40'
                  : 'bg-amber-500 shadow-md shadow-amber-500/40'
                : isCenter
                ? 'bg-slate-700 opacity-40'
                : 'bg-slate-800 opacity-30'
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ProctoringPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  violations: ProctoringViolation[];
  integrityScore: number;
  isWebcamActive: boolean;
  faceStatus: FaceStatus;
  gazeZone: GazeZone;
  permissionDenied: boolean;
}

export function ProctoringPanel({
  videoRef,
  violations,
  integrityScore,
  isWebcamActive,
  faceStatus,
  gazeZone,
  permissionDenied,
}: ProctoringPanelProps) {
  const highCount = violations.filter(v => v.severity === 'high').length;
  const medCount  = violations.filter(v => v.severity === 'medium').length;
  const lowCount  = violations.filter(v => v.severity === 'low').length;

  const faceBorderClass =
    faceStatus === 'detected'     ? 'border-emerald-500/70 shadow-emerald-500/20' :
    faceStatus === 'not_detected' ? 'border-red-500/70 shadow-red-500/20 animate-pulse' :
    'border-slate-700 shadow-transparent';

  const gaze = GAZE_META[gazeZone];

  return (
    <div className="flex flex-col gap-3 select-none">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-extrabold text-white tracking-widest uppercase">AI Proctoring</span>
        </div>
        <div className="flex items-center gap-2">
          {highCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-black border border-red-500/30">
              {highCount} HIGH
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
      </div>

      {/* ── Webcam Feed ─────────────────────────────────── */}
      <div className={`relative rounded-2xl overflow-hidden border-2 shadow-xl aspect-video bg-slate-950 transition-all duration-500 ${faceBorderClass}`}>
        {/* No permission */}
        {permissionDenied && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.07A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-[11px] text-red-300 font-bold text-center leading-snug">
              Camera access denied.<br />
              Allow webcam to enable proctoring.
            </p>
          </div>
        )}

        {/* Loading */}
        {!permissionDenied && !isWebcamActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950">
            <svg className="animate-spin w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[10px] text-slate-500 font-semibold">Initializing camera…</span>
          </div>
        )}

        {/* Video element — always rendered so ref is attached; mirrored for UX */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Face status badge */}
        <div className="absolute top-2 left-2 z-20">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 backdrop-blur-md ${
            faceStatus === 'detected'
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
              : faceStatus === 'not_detected'
              ? 'bg-red-950/90 text-red-300 border border-red-500/30'
              : 'bg-slate-950/90 text-slate-400 border border-slate-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              faceStatus === 'detected' ? 'bg-emerald-400 animate-pulse' :
              faceStatus === 'not_detected' ? 'bg-red-400 animate-ping' :
              'bg-slate-500'
            }`} />
            {faceStatus === 'detected' ? 'Face OK' : faceStatus === 'not_detected' ? 'No Face!' : 'Detecting…'}
          </span>
        </div>

        {/* Gaze badge */}
        {faceStatus === 'detected' && (
          <div className="absolute bottom-2 right-2 z-20">
            <span className={`px-2 py-1 rounded-lg text-[10px] font-black backdrop-blur-md border ${
              gaze.good
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-950/90 text-amber-300 border-amber-500/30'
            }`}>
              {gaze.icon} {gaze.label}
            </span>
          </div>
        )}

        {/* Corner scan lines (aesthetic) */}
        <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-current rounded-tl" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-current rounded-tr" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-current rounded-bl" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-current rounded-br" />
        </div>
      </div>

      {/* ── Gaze Diagram ────────────────────────────────── */}
      <div className="px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-white">Eye Movement</span>
          <span className={`text-[10px] font-bold ${gaze.good ? 'text-emerald-400' : 'text-amber-400'}`}>
            {gaze.good ? '✓ On Screen' : '⚠ Distracted'}
          </span>
        </div>
        <GazeDiagram zone={gazeZone} />
      </div>

      {/* ── Integrity Score ──────────────────────────────── */}
      <div className="px-4 py-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold text-white">Integrity Score</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <ScoreRing score={integrityScore} />

        {/* Violation tally */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { count: highCount, label: 'High',   className: 'text-red-400',   bg: 'bg-red-500/10' },
            { count: medCount,  label: 'Medium',  className: 'text-amber-400', bg: 'bg-amber-500/10' },
            { count: lowCount,  label: 'Low',     className: 'text-sky-400',   bg: 'bg-sky-500/10' },
          ] as const).map(({ count, label, className, bg }) => (
            <div key={label} className={`${bg} rounded-xl py-2.5 flex flex-col items-center gap-0.5`}>
              <span className={`text-lg font-black ${className}`}>{count}</span>
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Violations Log ───────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-white">Event Log</span>
          <span className="text-[10px] text-slate-500 font-mono">{violations.length} events</span>
        </div>

        <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/50 overflow-x-hidden">
          {violations.length === 0 ? (
            <div className="py-7 text-center space-y-1">
              <div className="text-lg">✅</div>
              <p className="text-[11px] text-slate-500 font-semibold">No violations detected</p>
            </div>
          ) : (
            violations.map(v => {
              const s = SEVERITY_STYLE[v.severity];
              return (
                <div key={v.id} className={`px-3 py-2 flex items-start gap-2.5 ${s.bg} transition-colors`}>
                  <span className={`mt-0.5 px-1.5 py-0.5 rounded-[4px] text-[9px] font-black shrink-0 text-white ${s.badge}`}>
                    {s.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold leading-snug ${s.text}`}>{v.message}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{v.timestamp}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Footer notice ────────────────────────────────── */}
      <p className="text-[10px] text-slate-600 text-center px-2 leading-snug">
        🔒 This session is monitored by YEN AI Proctoring. Violations are recorded and reviewed by HR.
      </p>
    </div>
  );
}
