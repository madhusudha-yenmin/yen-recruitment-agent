"use client";
import { useRef, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type FaceStatus = 'detected' | 'not_detected' | 'initializing';
export type GazeZone   = 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';

export interface ProctoringViolation {
  id: string;
  timestamp: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts 0-255 RGB to [H(0-360), S(0-1), L(0-1)] */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l   = (max + min) / 2;
  const d   = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r)      h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else                h = 60 * ((r - g) / d + 4);
  return [h < 0 ? h + 360 : h, s, l];
}

/** 
 * Inclusive skin-tone detection across all ethnicities and lighting conditions.
 * Uses a broad HSL range and a fundamental RGB ratio (Red > Blue).
 */
function isSkinTone(r: number, g: number, b: number): boolean {
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Human skin hue typically falls between 0-60° (yellow/orange), 
  // or 340-360° (red/pink) under warm/mixed lighting.
  const validHue = (h >= 0 && h <= 60) || (h >= 340 && h <= 360);
  
  // Wide saturation and lightness bounds to accommodate:
  // - Very dark to very pale skin tones (Lightness 0.10 -> 0.95)
  // - Low light environments and bright glare (Saturation 0.12 -> 0.95)
  // Raised minimums slightly to prevent near-black shadows or pure grey walls from passing.
  const validSat = s >= 0.12 && s <= 0.95;
  const validLight = l >= 0.10 && l <= 0.95;
  
  // Biological baseline: Human skin always reflects more red than blue
  const validRGB = r > b && r >= g;
  
  return validHue && validSat && validLight && validRGB;
}

/**
 * Draws the current video frame onto an offscreen canvas and runs a
 * skin-tone pixel census to approximate face presence and gaze direction.
 */
function analyzeFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): { hasFace: boolean; gazeZone: GazeZone; multipleFaces?: boolean } {
  if (video.readyState < 2 || video.videoWidth === 0) {
    return { hasFace: false, gazeZone: 'unknown' };
  }

  // Downscale to keep pixel analysis fast
  const W = Math.min(video.videoWidth,  320);
  const H = Math.min(video.videoHeight, 240);
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { hasFace: false, gazeZone: 'unknown' };

  ctx.drawImage(video, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H); // RGBA flat array

  let skinCount = 0;
  let sumX = 0, sumY = 0;
  const STEP = 4; // sample every 4th pixel in each axis (1/16 of pixels)

  // For multiple face detection, we divide the frame into vertical slices
  // and build a histogram of skin pixels across the X-axis.
  const NUM_SLICES = 20;
  const sliceWidth = W / NUM_SLICES;
  const histogram = new Array(NUM_SLICES).fill(0);

  for (let y = 0; y < H; y += STEP) {
    for (let x = 0; x < W; x += STEP) {
      const i = (y * W + x) * 4;
      if (isSkinTone(data[i], data[i + 1], data[i + 2])) {
        skinCount++;
        sumX += x;
        sumY += y;
        
        const sliceIdx = Math.floor(x / sliceWidth);
        if (sliceIdx >= 0 && sliceIdx < NUM_SLICES) {
          histogram[sliceIdx]++;
        }
      }
    }
  }

  const totalSampled = Math.ceil(H / STEP) * Math.ceil(W / STEP);
  // Face must occupy at least 12% of the webcam frame. 
  // (Increased from 3.5% so warm-coloured background objects don't trigger false positives).
  const hasFace = skinCount / totalSampled > 0.12; 
  if (!hasFace) return { hasFace: false, gazeZone: 'unknown', multipleFaces: false };

  // Determine multiple faces by finding distinct clusters in the histogram.
  // A slice must have at least 12% skin pixels to be considered part of a face
  // (increased from 8% to prevent bright background objects from triggering).
  const pixelsPerSlice = Math.ceil(H / STEP) * Math.ceil(sliceWidth / STEP);
  const sliceThreshold = pixelsPerSlice * 0.12;
  
  let clusters = 0;
  let emptySlices = 0;
  let inCluster = false;
  
  for (let i = 0; i < NUM_SLICES; i++) {
    if (histogram[i] > sliceThreshold) {
      if (!inCluster) {
        clusters++;
        inCluster = true;
      }
      emptySlices = 0;
    } else {
      emptySlices++;
      // Require a gap of at least 4 empty slices (20% of frame width) to separate clusters.
      // This prevents glare/glasses from splitting a single face into two clusters.
      if (emptySlices >= 4) {
        inCluster = false;
      }
    }
  }
  
  const multipleFaces = clusters > 1;

  // Centroid of skin-pixel mass → approximate gaze zone.
  //
  // Safe-center band is 20%–80% on X and 15%–85% on Y:
  //   - Normal micro-movements and reading saccades stay comfortably inside this band.
  //   - A genuine deliberate head turn (looking at a second screen, paper notes, phone)
  //     pushes the centroid outside it within a few frames.
  //   - Y-axis uses a wider band (15/85) to allow natural upward thinking glances
  //     and downward keyboard glances without triggering.
  const cx    = sumX / skinCount;
  const cy    = sumY / skinCount;
  const normX = cx / W;
  const normY = cy / H;

  // Note: video is displayed mirrored (CSS scaleX(-1)) but canvas reads the raw frame,
  // so raw-left = candidate's right and vice-versa.
  let gazeZone: GazeZone = 'center';
  if      (normX < 0.20) gazeZone = 'right';  // head turned clearly to candidate's right
  else if (normX > 0.80) gazeZone = 'left';   // head turned clearly to candidate's left
  else if (normY < 0.15) gazeZone = 'up';     // head raised very high (above monitor level)
  else if (normY > 0.85) gazeZone = 'down';   // head dropped very low (below desk level)

  return { hasFace, gazeZone, multipleFaces };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProctoring(isActive: boolean) {
  const videoRef         = useRef<HTMLVideoElement>(null);
  const offscreenCanvas  = useRef<HTMLCanvasElement | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const detectionTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceAbsenceStart = useRef<number | null>(null);
  const gazeAwayStart    = useRef<number | null>(null);
  const multipleFacesStart = useRef<number | null>(null);
  const blurTimeout      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [violations,     setViolations]     = useState<ProctoringViolation[]>([]);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [faceStatus,     setFaceStatus]     = useState<FaceStatus>('initializing');
  const [gazeZone,       setGazeZone]       = useState<GazeZone>('unknown');
  const [permissionDenied, setPermissionDenied] = useState(false);

  /** Appends a violation and deducts from score. */
  const addViolation = useCallback(
    (type: string, severity: 'high' | 'medium' | 'low', message: string) => {
      setViolations(prev =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            }),
            type,
            severity,
            message,
          },
          ...prev,
        ].slice(0, 150), // cap at 150 entries
      );
      setIntegrityScore(prev =>
        Math.max(0, prev - (severity === 'high' ? 15 : severity === 'medium' ? 8 : 3)),
      );
    },
    [],
  );

  // ── Webcam lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsWebcamActive(false);
      setFaceStatus('initializing');
      setGazeZone('unknown');
      return;
    }

    offscreenCanvas.current = document.createElement('canvas');

    // navigator.mediaDevices is undefined on non-HTTPS origins (network IP, insecure context).
    // Guard against this to prevent an uncaught TypeError that crashes the page.
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      console.warn('[Proctoring] navigator.mediaDevices unavailable — page must be served over HTTPS or localhost.');
      setPermissionDenied(true);
      setIsWebcamActive(false);
      addViolation('webcam_unavailable', 'high', 'Camera API unavailable — open the app via localhost or HTTPS');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {/* autoplay policy */});
        }
        setIsWebcamActive(true);
        setPermissionDenied(false);
        setFaceStatus('initializing');
      })
      .catch(err => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionDenied(true);
          addViolation('webcam_denied', 'high', 'Webcam permission denied — proctoring compromised');
        }
        setIsWebcamActive(false);
      });

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsWebcamActive(false);
    };
  }, [isActive, addViolation]);


  // ── Face / gaze detection loop (every 2 s) ──────────────────────────────────
  useEffect(() => {
    if (!isActive || !isWebcamActive) return;

    detectionTimer.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = offscreenCanvas.current;
      if (!video || !canvas) return;

      const { hasFace, gazeZone: gz, multipleFaces } = analyzeFrame(video, canvas);

      if (hasFace) {
        setFaceStatus('detected');
        setGazeZone(gz);
        faceAbsenceStart.current = null; // reset absence timer
        
        // Multiple faces accumulator
        // Requires 4 continuous seconds to trigger to avoid false positives from passing shadows/glare
        if (multipleFaces) {
          if (!multipleFacesStart.current) {
            multipleFacesStart.current = Date.now();
          } else if (Date.now() - multipleFacesStart.current > 4_000) {
            addViolation(
              'multiple_faces',
              'high',
              'Multiple faces detected in the webcam feed — unauthorized assistance suspected'
            );
            multipleFacesStart.current = null;
          }
        } else {
          multipleFacesStart.current = null;
        }

        // Gaze-away accumulator.
        // Fires after 5 continuous seconds outside the 20/80% safe band.
        // 5 s is long enough to ignore momentary glances (thinking, blinking, adjusting)
        // but short enough to catch a deliberate sustained look at another screen/phone.
        if (gz !== 'center') {
          if (!gazeAwayStart.current) {
            gazeAwayStart.current = Date.now();
          } else if (Date.now() - gazeAwayStart.current > 5_000) {
            addViolation(
              'looking_away',
              'medium',
              `Gaze direction: ${gz} — candidate appears to be looking away from screen for >5 seconds`,
            );
            gazeAwayStart.current = null; // allow re-fire after another 5 s
          }
        } else {
          gazeAwayStart.current = null; // returned to screen — reset timer
        }
      } else {
        setFaceStatus('not_detected');
        setGazeZone('unknown');
        gazeAwayStart.current = null;
        multipleFacesStart.current = null;

        // Face-absence accumulator
        if (!faceAbsenceStart.current) {
          faceAbsenceStart.current = Date.now();
        } else if (Date.now() - faceAbsenceStart.current > 5_000) {
          addViolation('face_not_detected', 'high', 'Face absent from webcam for more than 5 seconds');
          faceAbsenceStart.current = null;
        }
      }
    }, 2_000);

    return () => { if (detectionTimer.current) clearInterval(detectionTimer.current); };
  }, [isActive, isWebcamActive, addViolation]);

  // ── Behavioral event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    // Tab switch / minimize
    const onVisibility = () => {
      if (document.hidden)
        addViolation('tab_switch', 'high', 'Browser tab switched or window minimized');
    };

    // Window blur (switch to another app) – debounced 500 ms
    const onBlur = () => {
      blurTimeout.current = setTimeout(() => {
        addViolation('window_blur', 'high', 'Browser window lost focus — possible screen switch');
      }, 500);
    };
    const onFocus = () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };

    // Clipboard
    const onCopy = (e: Event) => { e.preventDefault(); addViolation('copy', 'medium', 'Copy attempt blocked (Ctrl+C / text selection)'); };
    const onPaste = (e: Event) => { e.preventDefault(); addViolation('paste', 'medium', 'Paste attempt blocked (Ctrl+V)'); };
    const onCut   = (e: Event) => { e.preventDefault(); addViolation('cut',   'medium', 'Cut attempt blocked (Ctrl+X)'); };

    // Right-click
    const onContextMenu = (e: Event) => {
      e.preventDefault();
      addViolation('right_click', 'low', 'Right-click context menu blocked');
    };

    // Keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      // Allow normal typing in input/textarea
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl / Cmd combos
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();

        // Clipboard + page actions
        const clipMap: Record<string, [string, 'high' | 'medium' | 'low']> = {
          c: ['Copy (Ctrl+C)',       'medium'],
          v: ['Paste (Ctrl+V)',      'medium'],
          x: ['Cut (Ctrl+X)',        'medium'],
          a: ['Select All (Ctrl+A)', 'low'],
          u: ['View Source (Ctrl+U)','high'],
          s: ['Save (Ctrl+S)',       'low'],
          p: ['Print (Ctrl+P)',      'low'],
        };
        if (clipMap[k]) {
          e.preventDefault();
          addViolation('keyboard_shortcut', clipMap[k][1], `Blocked: ${clipMap[k][0]}`);
          return;
        }

        // DevTools via Ctrl+Shift+I/J/C
        if (e.shiftKey && ['i','j','c','k'].includes(k)) {
          e.preventDefault();
          addViolation('devtools_attempt', 'high', 'DevTools keyboard shortcut blocked');
          return;
        }

        // Refresh
        if ((k === 'r') && !inField) {
          e.preventDefault();
          addViolation('page_refresh', 'medium', 'Page refresh blocked (Ctrl+R)');
        }
      }

      // Function keys
      if (e.key === 'F12') {
        e.preventDefault();
        addViolation('devtools_attempt', 'high', 'F12 Developer Tools blocked');
      }
      if (e.key === 'F5' && !inField) {
        e.preventDefault();
        addViolation('page_refresh', 'medium', 'Page refresh blocked (F5)');
      }
      if (e.key === 'PrintScreen') {
        addViolation('screenshot_attempt', 'high', 'PrintScreen key detected — potential screenshot');
      }
    };

    // Prevent text selection outside of answer fields
    const onSelectStart = (e: Event) => {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur',  onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('copy',        onCopy);
    document.addEventListener('paste',       onPaste);
    document.addEventListener('cut',         onCut);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown',     onKeyDown);
    document.addEventListener('selectstart', onSelectStart);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur',  onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('copy',        onCopy);
      document.removeEventListener('paste',       onPaste);
      document.removeEventListener('cut',         onCut);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown',     onKeyDown);
      document.removeEventListener('selectstart', onSelectStart);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [isActive, addViolation]);

  return { videoRef, violations, integrityScore, isWebcamActive, faceStatus, gazeZone, permissionDenied };
}
