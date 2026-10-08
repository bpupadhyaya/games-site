// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// All motion comes from the state's fixed-step clocks (state.t, state.sceneT, fx.t, round.age).
import { SCHEMES } from './schemes.js';
import { RULES } from './content.js';
import { CHIP_H, slipWidth, TEXT_SCALES, THINK_STEPS, rulesMetrics } from './layout.js';
import { drawCredit, drawLockup, drawMoreLine } from './brand.js';
import { KIND_SHORT } from './quiz.js';
import { drawArt } from './art.js';
import { STROKES } from './letters.js';

const DISPLAY_STD = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI_STD = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DYS = 'Verdana, "Trebuchet MS", "DejaVu Sans", sans-serif';
let DISPLAY = DISPLAY_STD, UI = UI_STD;
const TAU = Math.PI * 2;
const CYAN = '#39d0ea', CYAN_DEEP = '#0e6f8a', GOLD = '#ffd166';
let GOOD = '#5eea9a', BAD = '#ff7b7b';
const INK = '#10242e';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (f) => 1 - (1 - clamp01(f)) ** 3;
const easeBack = (f) => { const c = clamp01(f) - 1; return 1 + c * c * (2.7 * c + 1.7); };
const mod = (a, n) => ((a % n) + n) % n;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// Faint drifting letterforms and soft lights: [glyph, x0, y, size, speed, tilt]
const GLYPHS = [['a', 80, 420, 420, 9, -0.18], ['W', 560, 300, 300, 14, 0.12], ['g', 380, 900, 520, 7, 0.1], ['e', 700, 1180, 340, 12, -0.1], ['R', 150, 1420, 380, 10, 0.16], ['&', 900, 700, 300, 16, -0.08]];
const MOTES = Array.from({ length: 16 }, (_, i) => ({ x: (i * 397) % 900, y: ((i * 613) % 1560) / 1560, r: 26 + ((i * 53) % 70), v: 8 + ((i * 29) % 22), a: 0.05 + ((i * 17) % 7) / 100 }));
// Title-screen miniature of the game: [text, y, speed, phase, correct]
const HERO_TARGET = 'lucid';
const HERO = [['clear', 46, 330, true], ['ornate', 62, 740, false], ['murky', 38, 470, false]];
let rulesCache = null;   // wrapped Rules text, keyed by text size + width (measuring 40 pages every frame would be wasteful)

export function render(ctx, state, title, demoLimit, L, env, X = {}) {
  const w = L.w, h = L.h, P = L.play;
  const PF = state.prefs ?? {};
  const dys = PF.font === 'dys';
  DISPLAY = dys ? DYS : DISPLAY_STD; UI = dys ? DYS : UI_STD;
  if (PF.cb) { GOOD = '#4aa8ff'; BAD = '#ffb000'; } else { GOOD = '#5eea9a'; BAD = '#ff7b7b'; }
  const scheme = SCHEMES[state.scheme], hc = Boolean(scheme.hc), t = PF.reduce ? 0 : state.t, sceneT = state.sceneT;
  const soft = (a) => (hc ? '#ffffff' : hexA(scheme.text, a));
  const accent = hc ? '#ffffff' : CYAN;

  // ---- helpers ------------------------------------------------------------------------------------------
  const text = (str, x, y, size, color, o = {}) => {
    let px = size;
    const font = () => `${o.weight ?? 700} ${px}px ${o.font ?? UI}`;
    ctx.font = font();
    if (o.maxW) { const mw = ctx.measureText(str).width; if (mw > o.maxW) { px = Math.floor((size * o.maxW) / mw); ctx.font = font(); } }
    try { ctx.letterSpacing = dys ? `${Math.round(px * 0.06)}px` : '0px'; } catch { /* older canvases */ }
    ctx.textAlign = o.align ?? 'center';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  };
  const clip = (str, size, maxW, weight = 500) => {
    ctx.font = `${weight} ${size}px ${UI}`;
    if (ctx.measureText(str).width <= maxW) return str;
    let s = str;
    while (s.length > 4 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const shadow = (x, y, w, h, r, depth = 10) => {
    if (hc) return;
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; rr(x - 2, y + depth * 0.5, w + 4, h + depth * 0.9, r + 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.26)'; rr(x + 2, y + depth * 0.6, w - 4, h, r); ctx.fill();
  };
  // Entrance: element i of a scene rises into place with a small overshoot.
  const enter = (i) => easeBack((sceneT - i * 0.05) / 0.38);
  const pressScale = (id) => (state.press && state.press.id === id ? 1 - 0.07 * Math.exp(-state.press.t * 9) * Math.cos(state.press.t * 26) : 1);

  // A crafted button: drop shadow, thick lower lip, flat face, rim.
  const button = (r, label, o = {}) => {
    const s = (o.scale ?? 1) * pressScale(o.id), cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(26, r.h / 2.6);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    if (o.disabled) ctx.globalAlpha = 0.35;
    const lit = o.style === 'primary' || o.style === 'active';
    if (hc) {
      ctx.fillStyle = lit ? '#ffffff' : '#000000'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke();
    } else {
      shadow(r.x, r.y, r.w, r.h, rad, 12);
      ctx.fillStyle = lit ? '#084a5e' : 'rgba(2,12,18,0.85)'; rr(r.x, r.y + 7, r.w, r.h, rad); ctx.fill();   // lower lip
      ctx.fillStyle = lit ? '#22b8d6' : 'rgba(10,36,48,0.92)'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill();   // flat face
      ctx.strokeStyle = lit ? 'rgba(210,250,255,0.9)' : 'rgba(150,232,248,0.55)'; ctx.lineWidth = 2.5; rr(r.x, r.y, r.w, r.h, rad); ctx.stroke();
    }
    const ink = hc ? (lit ? '#000000' : '#ffffff') : lit ? '#04222c' : '#ffffff';
    const size = o.size ?? 32, tx = cx + (o.swatch ? 24 : 0);
    if (o.sub) {
      text(label, tx, cy - 2, size, ink, { maxW: r.w - 40 });
      text(o.sub, tx, cy + 30, 22, ink, { weight: 600, maxW: r.w - 30 });
    } else text(label, tx, cy + size * 0.35, size, ink, { maxW: r.w - (o.swatch ? 110 : 40) });
    if (o.swatch) {                                                     // a little disc showing the scheme
      ctx.font = `700 ${size}px ${UI}`;
      const lw = Math.min(ctx.measureText(label).width, r.w - 110), sx = tx - lw / 2 - 34;
      const next = o.swatch, sg = ctx.createLinearGradient(sx - 18, cy - 18, sx + 18, cy + 18);
      sg.addColorStop(0, next.stops[0]); sg.addColorStop(0.5, next.stops[1]); sg.addColorStop(1, next.stops[2]);
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, cy, 19, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  };

  // One paper slip carrying a word. Every slip looks the same, so nothing but the word gives the answer away.
  const slip = (str, x, y, o = {}) => {
    const W_ = o.w ?? L.slipW(str), H_ = (o.h ?? L.chipH) - 8, s = o.scale ?? 1;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(o.tilt ?? 0); ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (!hc && o.trail) {                                                // motion lines trailing to the right
      for (let k = 0; k < 3; k++) {
        const ly = (k - 1) * 22, len = 50 + k * 22 + 10 * Math.sin(t * 3 + k + y);
        const tg = ctx.createLinearGradient(W_ / 2, 0, W_ / 2 + len + 30, 0);
        tg.addColorStop(0, soft(0.32)); tg.addColorStop(1, soft(0));
        ctx.strokeStyle = tg; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(W_ / 2 + 12, ly); ctx.lineTo(W_ / 2 + 12 + len, ly); ctx.stroke();
      }
    }
    shadow(-W_ / 2, -H_ / 2, W_, H_, 16, 14);
    if (hc) {
      ctx.fillStyle = '#ffffff'; rr(-W_ / 2, -H_ / 2, W_, H_, 12); ctx.fill();
    } else {
      ctx.fillStyle = '#b9ab88'; rr(-W_ / 2, -H_ / 2 + 5, W_, H_, 16); ctx.fill();                        // paper edge
      const g = ctx.createLinearGradient(0, -H_ / 2, 0, H_ / 2);
      g.addColorStop(0, '#fffdf4'); g.addColorStop(0.6, '#f8f0dc'); g.addColorStop(1, '#eadfc2');
      ctx.fillStyle = g; rr(-W_ / 2, -H_ / 2, W_, H_, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; rr(-W_ / 2 + 2, -H_ / 2 + 2, W_ - 4, H_ - 4, 14); ctx.stroke();
      ctx.strokeStyle = 'rgba(16,36,46,0.16)'; ctx.lineWidth = 2;                                      // ruled line
      ctx.beginPath(); ctx.moveTo(-W_ / 2 + 18, H_ / 2 - 16); ctx.lineTo(W_ / 2 - 18, H_ / 2 - 16); ctx.stroke();
    }
    text(str, 0, Math.round(17 * Math.min(1, L.chipH / 96)), Math.round(58 * Math.min(1, L.chipH / 96)), hc ? '#000000' : INK, { font: DISPLAY, maxW: W_ - 30 });
    if (o.tint) { ctx.globalAlpha = (o.alpha ?? 1) * 0.3; ctx.fillStyle = o.tint; rr(-W_ / 2, -H_ / 2, W_, H_, 16); ctx.fill(); }
    ctx.restore();
  };

  // The plaque that carries the target word.
  const plaque = (r, label, word, o = {}) => {
    const cx = r.x + r.w / 2, kr = o.small ? 1 : Math.max(0.64, Math.min(1, r.h / 236)), big = Math.round((o.wordSize ?? 92) * kr);
    ctx.save();
    ctx.translate(o.dx ?? 0, 0);
    if (hc) {
      ctx.fillStyle = '#000000'; rr(r.x, r.y, r.w, r.h, 26); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke();
    } else {
      shadow(r.x, r.y, r.w, r.h, 30, 18);
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, 'rgba(10,44,58,0.92)'); g.addColorStop(1, 'rgba(3,14,22,0.94)');
      ctx.fillStyle = g; rr(r.x, r.y, r.w, r.h, 30); ctx.fill();
      const glow = ctx.createRadialGradient(cx, r.y, 10, cx, r.y, r.w * 0.6);
      glow.addColorStop(0, hexA(CYAN, 0.30)); glow.addColorStop(1, hexA(CYAN, 0));
      ctx.save(); rr(r.x, r.y, r.w, r.h, 30); ctx.clip(); ctx.fillStyle = glow; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
      const rim = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      rim.addColorStop(0, '#9af0ff'); rim.addColorStop(0.5, CYAN_DEEP); rim.addColorStop(1, '#5fdcf2');
      ctx.strokeStyle = rim; ctx.lineWidth = 4; rr(r.x, r.y, r.w, r.h, 30); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; rr(r.x + 9, r.y + 9, r.w - 18, r.h - 18, 22); ctx.stroke();
    }
    const k = o.small ? 0.62 : kr;
    try { ctx.letterSpacing = '3px'; } catch { /* older canvases */ }
    text(label, cx, r.y + 58 * k, Math.max(22, Math.round(25 * k + 3)), hc ? '#ffffff' : '#8fe6f7', { weight: 700, maxW: r.w - 30 });
    try { ctx.letterSpacing = '0px'; } catch { /* older canvases */ }
    const pop = o.pop ?? 1;
    ctx.save();
    if (o.art) {
      ctx.globalAlpha = clamp01(pop * 1.4 - 0.4); drawArt(ctx, o.art, cx, r.y + r.h * 0.6, Math.min(r.h * 0.62, 150) * pop);
    } else if (o.speaker) {                                                                  // listening question: a speaker, tap to hear again
      const sy = r.y + r.h * 0.5 + 8, pulse = 1 + 0.06 * Math.sin(t * 5);
      ctx.translate(cx, sy); ctx.scale(pop * pulse, pop * pulse); ctx.globalAlpha = clamp01(pop * 1.4 - 0.4);
      const u = Math.max(0.6, Math.min(1.2, r.h / 220));
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-46 * u, -16 * u); ctx.lineTo(-18 * u, -16 * u); ctx.lineTo(14 * u, -42 * u); ctx.lineTo(14 * u, 42 * u); ctx.lineTo(-18 * u, 16 * u); ctx.lineTo(-46 * u, 16 * u); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hc ? '#ffffff' : '#8fe6f7'; ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
      for (let a = 1; a <= 2; a++) { ctx.globalAlpha = clamp01(pop * 1.4 - 0.4) * (0.5 + 0.5 * Math.sin(t * 6 - a * 1.2)); ctx.beginPath(); ctx.arc(22 * u, 0, (22 + a * 20) * u, -0.9, 0.9); ctx.stroke(); }
      ctx.globalAlpha = 1;
      text(word, 0, 74 * u, Math.round(22 * u + 4), soft(0.85), { weight: 600, maxW: r.w - 60 });
    } else if (o.lines && o.lines.length > 1) {
      const n = o.lines.length, avail = r.h - 74 * kr, fs = Math.max(22, Math.min(big, Math.floor(avail / (n * 1.18)))), top = r.y + 66 * kr;
      ctx.globalAlpha = clamp01(pop * 1.4 - 0.4);
      o.lines.forEach((ln, i) => text(ln, cx, top + (i + 0.5) * (avail / n) + fs * 0.32, fs, '#ffffff', { font: DISPLAY, maxW: r.w - 50 }));
    } else {
      ctx.translate(cx, r.y + r.h * (o.small ? 0.74 : 0.72)); ctx.scale(pop, pop); ctx.globalAlpha = clamp01(pop * 1.4 - 0.4);
      text(word, 0, 0, big, '#ffffff', { font: DISPLAY, maxW: r.w - 60 });
    }
    ctx.restore();
    ctx.restore();
  };

  // Wrap a prompt (a meaning) into at most `max` lines for the plaque.
  const wrapLines = (str, size, maxW, max) => {
    ctx.font = `700 ${size}px ${DISPLAY}`;
    const out = []; let line = '';
    for (const wd of String(str).split(' ')) {
      const cand = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(cand).width > maxW && line) { out.push(line); line = wd; } else line = cand;
    }
    out.push(line);
    if (out.length > max) { const kept = out.slice(0, max); kept[max - 1] = clip(`${kept[max - 1]} ${out.slice(max).join(' ')}`, size, maxW, 700); return kept; }
    return out;
  };

  // A reader-card panel: dark translucent gradient fill + double border, matching the plaque's
  // own palette. Drawn behind reference-page illustrations and body text so they read as a
  // designed sheet rather than loose text floating on the backdrop.
  const framedPanel = (r) => {
    if (hc) {
      ctx.fillStyle = '#000000'; rr(r.x, r.y, r.w, r.h, 28); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke();
      return;
    }
    shadow(r.x, r.y, r.w, r.h, 28, 16);
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(10,42,56,0.82)'); g.addColorStop(1, 'rgba(3,14,22,0.90)');
    ctx.fillStyle = g; rr(r.x, r.y, r.w, r.h, 28); ctx.fill();
    ctx.strokeStyle = hexA(CYAN, 0.5); ctx.lineWidth = 3; rr(r.x, r.y, r.w, r.h, 28); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; rr(r.x + 9, r.y + 9, r.w - 18, r.h - 18, 20); ctx.stroke();
  };

  // ---- backdrop -----------------------------------------------------------------------------------------
  if (hc) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h); } else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, scheme.stops[0]); bg.addColorStop(0.5, scheme.stops[1]); bg.addColorStop(1, scheme.stops[2]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const sun = ctx.createRadialGradient(w * 0.5, 120, 20, w * 0.5, 120, Math.max(900, w * 0.6));
    sun.addColorStop(0, 'rgba(255,255,255,0.20)'); sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    const shaftH = Math.min(1100, h * 0.75), nShaft = Math.max(4, Math.round(w / 180));
    for (let k = 0; k < nShaft; k++) {                                                   // slanting shafts of light
      const x = 90 + k * (w - 160) / Math.max(1, nShaft - 1) + Math.sin(t * 0.25 + k * 1.9) * 40, wd = 70 + (k % 4) * 18, a = 0.05 + 0.025 * Math.sin(t * 0.6 + k * 2.3);
      const g = ctx.createLinearGradient(0, 0, 0, shaftH);
      g.addColorStop(0, soft(a * 1.8)); g.addColorStop(1, soft(0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + wd, -20); ctx.lineTo(x + wd - 260, shaftH); ctx.lineTo(x - 330, shaftH); ctx.closePath(); ctx.fill();
    }
    const nGlint = Math.round(26 * w / 720);
    for (let k = 0; k < nGlint; k++) {                                                   // tiny glints
      const x = mod(k * 277 - t * (5 + (k % 5) * 3), w + 40) - 20, y = (k * 431) % h, tw = 0.5 + 0.5 * Math.sin(t * (1.2 + (k % 4) * 0.5) + k);
      ctx.fillStyle = soft(0.10 + 0.35 * tw); ctx.beginPath(); ctx.arc(x, y, 1.5 + (k % 3), 0, TAU); ctx.fill();
    }
    for (const [ch, x0, y, size, v, tilt] of GLYPHS) {                                    // far layer: huge faint letters
      const x = mod(x0 - t * v, w + 600) - 300, gy = (y / 1560) * h;
      ctx.save(); ctx.translate(x, gy + Math.sin(t * 0.3 + x0) * 14); ctx.rotate(tilt + Math.sin(t * 0.2 + y) * 0.03);
      text(ch, 0, 0, Math.min(size, h * 0.5), soft(0.05), { font: DISPLAY });
      ctx.restore();
    }
    ctx.lineWidth = 2;                                                                   // middle layer: slow currents
    for (let k = 0; k < 5; k++) {
      const y0 = (260 + k * 270) / 1560 * h;
      ctx.strokeStyle = soft(0.07); ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 40) { const y = y0 + Math.sin(x * 0.008 + t * (0.5 + k * 0.08) + k * 1.7) * 38; if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (const m of MOTES) {                                                             // near layer: soft lights
      const x = mod(m.x * w / 720 - t * m.v, w + 200) - 100, y = m.y * h + Math.sin(t * 0.5 + m.x) * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, m.r);
      g.addColorStop(0, soft(m.a * 1.6)); g.addColorStop(0.6, soft(m.a * 0.7)); g.addColorStop(1, soft(0));
      ctx.fillStyle = g; ctx.fillRect(x - m.r, y - m.r, m.r * 2, m.r * 2);
    }
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h * 0.5, Math.max(h, w * 0.6) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  const swatch = SCHEMES[state.scheme];

  // ---- title --------------------------------------------------------------------------------------------
  if (state.scene === 'title') {
    const T = L.title, rise = (i) => (1 - enter(i)) * 40;
    ctx.save(); ctx.translate(0, rise(0));
    if (!hc) { ctx.shadowColor = hexA(CYAN, 0.65); ctx.shadowBlur = 34 + Math.sin(t * 1.6) * 10; }
    const tg = ctx.createLinearGradient(0, T.titleBase - 100, 0, T.titleBase + 8);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, hc ? '#ffffff' : '#a9efff');
    text(title, T.cx, T.titleBase, 124, tg, { font: DISPLAY, maxW: T.titleMaxW });
    ctx.restore();
    text('Tap the matching word before it drifts away', T.cx, T.taglineY + rise(0), 29, soft(0.85), { weight: 500, maxW: Math.min(640, T.titleMaxW + 150) });

    // the game in miniature: a target, and three slips drifting past it
    const hero = T.hero;
    if (hero.mode !== 'none') {
      const hcx = hero.x + hero.w / 2;
      plaque({ x: hcx - 190, y: hero.y + rise(1), w: 380, h: 132 }, 'TAP THE SYNONYM OF', HERO_TARGET, { small: true, wordSize: 66 });
      if (hero.mode === 'full') {
        const area = hero.h - 132 - 20, cl0 = L.wide ? hero.x : 0, cw = L.wide ? hero.w : w;
        ctx.save(); ctx.beginPath(); ctx.rect(cl0, hero.y, cw, hero.h + 40); ctx.clip();
        HERO.forEach(([word, v, ph, correct], k) => {
          const y = hero.y + 132 + 20 + (k + 0.5) * area / 3, span = cw + 360, x = cl0 + mod(ph - t * v, span) - 180, beat = correct ? Math.max(0, Math.sin(t * 1.4)) : 0;
          if (correct && !hc && beat > 0) {
            const g = ctx.createRadialGradient(x, y, 20, x, y, 190);
            g.addColorStop(0, hexA(CYAN, 0.42 * beat)); g.addColorStop(1, hexA(CYAN, 0));
            ctx.fillStyle = g; ctx.fillRect(x - 190, y - 190, 380, 380);
          }
          slip(word, x, y + Math.sin(t * 1.1 + ph) * 12, { tilt: Math.sin(t * 0.9 + ph) * 0.035, trail: true, scale: 0.92 + beat * 0.05, w: slipWidth(word) });
        });
        ctx.restore();
      }
    }

    // summary of the current set-up (a tap opens Words and pace) and the best score for this pace
    {
      const sm = T.sum, cx0 = sm.x + sm.w / 2;
      ctx.fillStyle = hc ? '#000000' : 'rgba(3,16,24,0.55)'; rr(sm.x, sm.y, sm.w, sm.h, 23); ctx.fill();
      ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.5); ctx.lineWidth = 2; rr(sm.x, sm.y, sm.w, sm.h, 23); ctx.stroke();
      text(X.sumLine ?? '', cx0, sm.y + sm.h / 2 + 9, 25, hc ? '#ffffff' : '#bff3ff', { weight: 600, maxW: sm.w - 30 });
      text(X.best ? `★  Best score at this pace: ${X.best}` : 'Your words and pace (tap to change)', cx0, T.bestY, 25, hc ? '#ffffff' : GOLD, { weight: 700, maxW: sm.w });
    }
    if (state.msg || X.note) text(state.msg || X.note, T.sum.x + T.sum.w / 2, L.wide ? T.bestY + 30 : T.bestY - 28, 23, hc ? '#ffffff' : BAD, { weight: 700, maxW: Math.min(w - 40, 640) });

    const breathe = 1 + Math.sin(t * 2.4) * 0.018, pc = { x: T.play.x + T.play.w / 2, y: T.play.y + T.play.h / 2 };
    if (!hc) {
      const g = ctx.createRadialGradient(pc.x, pc.y, 60, pc.x, pc.y, 360);
      g.addColorStop(0, hexA(CYAN, 0.30 + Math.sin(t * 2.4) * 0.08)); g.addColorStop(1, hexA(CYAN, 0));
      ctx.fillStyle = g; ctx.fillRect(pc.x - 360, pc.y - 340, 720, 680);
    }
    button(T.play, 'Play', { style: 'primary', size: 58, scale: enter(4) * breathe });
    button(T.journey, 'Journey', { id: 'journey', size: 32, style: 'active', scale: enter(4.5), sub: X.stars ? `${X.stars} stars  ·  letters to graduate words` : 'letters to graduate words' });
    button(T.setup, 'Words & pace', { id: 'setup', size: 28, scale: enter(5) });
    button(T.study, 'Study', { id: 'study', size: 30, scale: enter(5), sub: X.studyN ? `${X.studyN} words ready` : undefined });
    button(T.review, 'Review', { id: 'review', size: 30, scale: enter(6), disabled: !X.dueN, sub: X.dueN ? `${X.dueN} due today` : 'nothing due' });
    button(T.prog, 'Progress', { id: 'prog', size: 30, scale: enter(6), sub: X.streakN ? `${X.streakN}-day streak` : `${X.todayN ?? 0} / ${X.goal ?? 20} today` });
    button(T.auto, 'Watch & Learn', { id: 'autoplay', size: 27, scale: enter(7) });
    button(T.more, 'More', { id: 'more', size: 30, scale: enter(7), sub: 'about, privacy, data' });

    const colCx = T.play.x + T.play.w / 2;
    if (state.demo) {
      const left = Math.max(0, demoLimit - state.demoSessions);
      text(`Free preview: ${left} session${left === 1 ? '' : 's'} left`, colCx, T.previewY, 24, soft(0.85), { weight: 600, maxW: 560 });
    }
    {   // the Arcforge lockup directly under the last button, on a soft plate (a tap opens the Arcforge home)
      const lk = T.lockup, cx = lk.x + lk.w / 2, cy = lk.y + lk.h / 2;
      ctx.save(); ctx.fillStyle = 'rgba(4,16,24,0.45)'; ctx.beginPath(); ctx.roundRect(lk.x - 10, lk.y - 4, lk.w + 20, lk.h + 8, 14); ctx.fill(); ctx.restore();
      if (!drawLockup(ctx, cx, cy, lk.w, { dim: lockPress > 0 ? 0.5 : 0.95 })) drawCredit(ctx, cx, cy + 8, 22, { dim: 0.8 });
      if (lockPress > 0) lockPress--;
    }
    text('English words from first words to graduate level', colCx, T.footY, 23, soft(0.7), { weight: 500, maxW: Math.min(600, T.sum.w + 20) });
    return;
  }

  // ---- journey map ----------------------------------------------------------------------------------------------
  if (state.scene === 'journey' && X.map) {
    const Q = L.rules, M = X.map, J = X.journey, jn = X.jny, vp = Q.viewport;
    ctx.save(); if (!hc) { ctx.shadowColor = hexA(CYAN, 0.55); ctx.shadowBlur = 22; }
    if (L.wide) text('Journey', Q.titleX, Q.titleBase, 52, '#ffffff', { font: DISPLAY, maxW: Q.dec.w * 2 }); else text('Journey', Q.panel.x + 10, Q.titleBase, 58, '#ffffff', { font: DISPLAY, align: 'left', maxW: 300 });
    ctx.restore();
    text(`★ ${X.stars}`, L.wide ? Q.titleX : Q.inc.x + Q.inc.w, L.wide ? Q.titleBase + 60 : Q.titleBase, 44, hc ? '#ffffff' : GOLD, { weight: 800, align: L.wide ? 'center' : 'right' });
    framedPanel(Q.panel);
    const max = Math.max(0, M.height - vp.h), sc = Math.max(0, Math.min(state.mapScroll, max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
    const oy = vp.y - sc, ox = vp.x;
    const nodes = M.items.filter((n) => n.type === 'node');
    // paths between consecutive nodes of a world
    for (const Wd of jn.WORLDS) {
      const ns = nodes.filter((n) => n.world === Wd.id), unl = jn.isWorldUnlocked(J, Wd.id);
      ctx.strokeStyle = unl ? hexA(Wd.color, 0.5) : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.setLineDash([2, 20]);
      ctx.beginPath(); ns.forEach((n, i) => (i ? ctx.lineTo(ox + n.x, oy + n.y) : ctx.moveTo(ox + n.x, oy + n.y))); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const it of M.items) {
      if (it.type === 'world') {
        const Wd = jn.WORLDS[it.world], y = oy + it.y, unl = jn.isWorldUnlocked(J, it.world), n = jn.stageCount(it.world);
        if (y > vp.y + vp.h || y + it.h < vp.y) continue;
        const g = ctx.createLinearGradient(ox, 0, ox + vp.w, 0); g.addColorStop(0, hexA(Wd.color, unl ? 0.38 : 0.12)); g.addColorStop(1, hexA(Wd.color, 0.04));
        ctx.fillStyle = g; rr(ox + 8, y, vp.w - 16, it.h, 22); ctx.fill();
        ctx.strokeStyle = hexA(Wd.color, unl ? 0.8 : 0.25); ctx.lineWidth = 2.5; ctx.stroke();
        text(Wd.name, ox + 28, y + 52, 46, unl ? '#ffffff' : soft(0.5), { font: DISPLAY, align: 'left', maxW: vp.w * 0.62 });
        text(unl ? Wd.blurb : 'Locked: pass the checkpoint before it', ox + 28, y + 88, 24, soft(unl ? 0.85 : 0.5), { weight: 600, align: 'left', maxW: vp.w * 0.66 });
        text(`★ ${jn.worldStars(J, it.world)} / ${n * 3}`, ox + vp.w - 28, y + 58, 30, hc ? '#ffffff' : hexA(GOLD, unl ? 1 : 0.4), { weight: 800, align: 'right' });
        continue;
      }
      const x = ox + it.x, y = oy + it.y;
      if (y < vp.y - 80 || y > vp.y + vp.h + 80) continue;
      const Wd = jn.WORLDS[it.world];
      if (it.kind === 'stage') {
        const unl = jn.isStageUnlocked(J, it.world, it.stage), st = J.stars[jn.stageId(it.world, it.stage)] ?? 0, cur = unl && st === 0;
        const pulse = cur ? 1 + 0.06 * Math.sin(t * 4) : 1;
        ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
        if (!hc) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(2, 8, it.r, 0, TAU); ctx.fill(); }
        if (cur && !hc) { const gl = ctx.createRadialGradient(0, 0, it.r * 0.5, 0, 0, it.r * 2); gl.addColorStop(0, hexA(Wd.color, 0.55)); gl.addColorStop(1, hexA(Wd.color, 0)); ctx.fillStyle = gl; ctx.fillRect(-it.r * 2, -it.r * 2, it.r * 4, it.r * 4); }
        ctx.fillStyle = hc ? (unl ? '#ffffff' : '#000000') : !unl ? 'rgba(40,60,72,0.9)' : st ? Wd.color : 'rgba(10,36,48,0.95)';
        ctx.beginPath(); ctx.arc(0, 0, it.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = hc ? '#ffffff' : unl ? '#ffffff' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.stroke();
        if (!unl) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(-13, -4, 26, 20, 4); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -6, 9, Math.PI, 0); ctx.stroke(); }
        else text(String(it.stage + 1), 0, 14, 40, hc ? '#000000' : st ? '#07202b' : '#ffffff', { weight: 800 });
        ctx.restore();
        if (st) for (let k = 0; k < 3; k++) { ctx.fillStyle = k < st ? (hc ? '#ffffff' : GOLD) : 'rgba(255,255,255,0.2)'; ctx.beginPath(); const sx = x + (k - 1) * 26, sy = y + it.r + 22; for (let q = 0; q < 10; q++) { const a = -Math.PI / 2 + q * Math.PI / 5, rr_ = q % 2 ? 6 : 13; ctx.lineTo(sx + Math.cos(a) * rr_, sy + Math.sin(a) * rr_); } ctx.closePath(); ctx.fill(); }
      } else {
        const ready = jn.checkReady(J, it.world), got = J.checks[it.world] ?? 0, pass = got >= jn.PASS_CHECK * 100;
        ctx.save(); ctx.translate(x, y);
        if (!hc) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(-it.r + 2, -it.r * 0.7 + 8, it.r * 2, it.r * 1.4, 22); ctx.fill(); }
        ctx.fillStyle = hc ? (ready ? '#ffffff' : '#000000') : pass ? GOLD : ready ? hexA(Wd.color, 0.95) : 'rgba(40,60,72,0.9)';
        rr(-it.r, -it.r * 0.7, it.r * 2, it.r * 1.4, 22); ctx.fill(); ctx.strokeStyle = hc ? '#ffffff' : ready ? '#ffffff' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.stroke();
        text(pass ? `${got}%` : ready ? 'TEST' : 'LOCKED', 0, 10, pass ? 34 : 28, hc ? '#000000' : ready ? '#07202b' : soft(0.5), { weight: 800, maxW: it.r * 1.8 });
        ctx.restore();
      }
    }
    ctx.restore();
    const sb = { x: Q.panel.x + Q.panel.w - 10 - Q.sbW, y: vp.y, w: Q.sbW, h: vp.h };
    if (max > 0) { ctx.fillStyle = hc ? '#333333' : 'rgba(255,255,255,0.14)'; rr(sb.x, sb.y, sb.w, sb.h, sb.w / 2); ctx.fill(); const th = Math.max(48, sb.h * vp.h / M.height), ty = sb.y + (sb.h - th) * (sc / max); ctx.fillStyle = hc ? '#ffffff' : hexA(CYAN, 0.9); rr(sb.x, ty, sb.w, th, sb.w / 2); ctx.fill(); }
    button(Q.back, 'Back', { size: 34, scale: enter(0) });
    button(Q.next, 'Find my level', { id: 'place', style: 'primary', size: 30, scale: enter(1) });
    return;
  }

  // ---- tracing letters -------------------------------------------------------------------------------------------
  if (state.scene === 'trace' && X.trace) {
    const Q = L.rules, tr = X.trace, T = L.trace, c = X.LETTERS[tr.i], strokes = STROKES[c];
    ctx.save(); if (!hc) { ctx.shadowColor = hexA(CYAN, 0.55); ctx.shadowBlur = 22; }
    if (L.wide) text('Trace', Q.titleX, Q.titleBase, 52, '#ffffff', { font: DISPLAY, maxW: Q.dec.w * 2 }); else text('Trace the letters', Q.panel.x + 10, Q.titleBase, 52, '#ffffff', { font: DISPLAY, align: 'left', maxW: Q.panel.w - 20 });
    ctx.restore();
    framedPanel(Q.panel);
    const H_ = L.traceHear; ctx.fillStyle = hc ? '#000000' : 'rgba(10,36,48,0.9)'; rr(H_.x, H_.y, H_.w, H_.h, 24); ctx.fill(); ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.6); ctx.lineWidth = 2.5; ctx.stroke();
    text(`${c.toUpperCase()}  ${c}`, H_.x + 24, H_.y + 66, 60, '#ffffff', { font: DISPLAY, align: 'left', maxW: H_.w * 0.4 });
    text(X.canSpeak ? 'Tap to hear it' : 'Follow the dots with your finger', H_.x + H_.w - 20, H_.y + 56, 24, soft(0.85), { weight: 600, align: 'right', maxW: H_.w * 0.5 });
    ctx.fillStyle = hc ? '#111111' : 'rgba(255,255,255,0.05)'; rr(T.x - 10, T.y - 10, T.w + 20, T.h + 20, 24); ctx.fill();
    const P2 = (p) => [T.x + p[0] * T.w, T.y + p[1] * T.h];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = hc ? '#666666' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = T.w * 0.12;
    for (const path of strokes) { ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(...P2(p)) : ctx.moveTo(...P2(p)))); ctx.stroke(); }
    ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.55); ctx.lineWidth = 3; ctx.setLineDash([10, 14]);
    for (const path of strokes) { ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(...P2(p)) : ctx.moveTo(...P2(p)))); ctx.stroke(); }
    ctx.setLineDash([]);
    tr.cps.forEach((cp, i) => { const [x, y] = P2([cp.x, cp.y]); if (i < tr.idx) { ctx.fillStyle = hc ? '#ffffff' : GOLD; ctx.beginPath(); ctx.arc(x, y, T.w * 0.05, 0, TAU); ctx.fill(); } else if (i === tr.idx && !tr.done) { const pu = 1 + 0.25 * Math.sin(tr.t * 7); ctx.fillStyle = hc ? '#ffffff' : GOOD; ctx.beginPath(); ctx.arc(x, y, T.w * 0.06 * pu, 0, TAU); ctx.fill(); ctx.fillStyle = '#07202b'; ctx.font = `800 ${Math.round(T.w * 0.06)}px ${UI}`; ctx.textAlign = 'center'; if (cp.s) ctx.fillText('▶', x, y + T.w * 0.02); } });
    for (const q of state.parts) { const a = 1 - q.age / q.life; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    text(tr.done ? 'Great job!' : 'Start at the green dot and draw along the letter', Q.panel.x + Q.panel.w / 2, T.y + T.h + 52, tr.done ? 44 : 24, tr.done ? (hc ? '#ffffff' : GOLD) : soft(0.85), { weight: 700, maxW: Q.panel.w - 40 });
    button(Q.back, 'Back', { size: 34 });
    button(Q.next, 'Next letter', { id: 'traceNext', size: 30, style: tr.done ? 'primary' : undefined });
    return;
  }

  // ---- generic form reader: Words and pace, Study, Progress, About, Settings, Your data, credits ----------------------
  if (X.form) {
    const F = X.form, Q = L.rules, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, vp = Q.viewport;
    button(Q.dec, 'A−', { id: 'textDec', size: 34, disabled: state.textScaleIdx === 0 });
    button(Q.inc, 'A+', { id: 'textInc', size: 34, disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
    ctx.save();
    if (!hc) { ctx.shadowColor = hexA(CYAN, 0.55); ctx.shadowBlur = 22; }
    if (L.wide) text(F.def.title, Q.titleX, Q.titleBase, Math.min(Q.titleSize, 52), '#ffffff', { font: DISPLAY, maxW: Q.dec.w * 2 + 12 });
    else text(F.def.title, Q.panel.x + 10, Q.titleBase, Math.min(Q.titleSize, 58), '#ffffff', { font: DISPLAY, align: 'left', maxW: Q.dec.x - Q.panel.x - 30 });
    ctx.restore();
    framedPanel(Q.panel);
    const sc = Math.max(0, Math.min(state.formScroll, Math.max(0, F.layout.height - vp.h))), left = vp.x + Q.padX, ink = hc ? '#ffffff' : '#8fe6f7';
    const chipBtn = (r, label, o = {}) => {
      ctx.save(); if (o.disabled) ctx.globalAlpha = 0.35;
      const on = o.on, rad = Math.min(24, r.h / 2.4);
      if (hc) { ctx.fillStyle = on ? '#ffffff' : '#000000'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
      else {
        ctx.fillStyle = on ? '#1fb3d1' : 'rgba(10,36,48,0.9)'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill();
        ctx.strokeStyle = on ? 'rgba(210,250,255,0.9)' : 'rgba(150,232,248,0.45)'; ctx.lineWidth = 2.2; rr(r.x, r.y, r.w, r.h, rad); ctx.stroke();
      }
      const lit = on && !hc;
      text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.sz ?? 25) * 0.35, o.sz ?? 25, hc ? (on ? '#000000' : '#ffffff') : lit ? '#04222c' : '#ffffff', { weight: 700, maxW: r.w - 16 });
      ctx.restore();
    };
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
    for (const it of F.layout.items) {
      const top = vp.y + it.y - sc;
      if (top > vp.y + vp.h + 4 || top + it.h < vp.y - 4) continue;
      const row = it.row, S_ = (n) => Math.round(n * scale), width = F.width;
      switch (row.k) {
        case 'h': it.lines.forEach((ln, i) => text(ln, left, top + it.size + i * it.lh, it.size, ink, { align: 'left', weight: 800 })); break;
        case 'p': it.lines.forEach((ln, i) => text(ln, left, top + it.size + i * it.lh, it.size, soft(row.small ? 0.8 : 0.93), { align: 'left', weight: 500, maxW: width })); break;
        case 'sub': it.lines.forEach((ln, i) => text(ln, left, top + it.size + 6 + i * it.lh, it.size, ink, { align: 'left', weight: 800, maxW: width })); break;
        case 'pre': it.lines.forEach((ln, i) => text(ln, left, top + it.size + i * it.lh, it.size, soft(0.88), { align: 'left', weight: 500, maxW: width })); break;
        case 'rule': ctx.fillStyle = soft(0.18); ctx.fillRect(left, top + it.h / 2, width, 2); break;
        case 'kv':
          text(row.l, left, top + it.size + 4, it.size, soft(0.9), { align: 'left', weight: 600, maxW: width * 0.46 });
          it.lines.forEach((ln, i) => text(ln, left + width, top + it.size + 4 + i * it.lh, it.size, '#ffffff', { align: 'right', weight: 700 }));
          break;
        case 'bar': {
          text(row.label, left, top + it.size, it.size, soft(0.95), { align: 'left', weight: 700, maxW: width });
          const by = top + it.size + 12, bh = S_(16);
          ctx.fillStyle = hc ? '#333333' : 'rgba(255,255,255,0.14)'; rr(left, by, width, bh, bh / 2); ctx.fill();
          if (row.frac > 0.002) { ctx.fillStyle = hc ? '#ffffff' : hexA(CYAN, 0.95); rr(left, by, Math.max(bh, width * row.frac), bh, bh / 2); ctx.fill(); }
          if (row.text) text(row.text, left, by + bh + S_(24), S_(21), soft(0.72), { align: 'left', weight: 500, maxW: width });
          break;
        }
        case 'btn': case 'btn2': case 'chips': case 'step': case 'word': break;
        default: break;
      }
      if (row.k === 'chips') {
        if (row.label) text(row.label, left, top + S_(26), S_(25), soft(0.92), { align: 'left', weight: 700, maxW: width });
        for (const hh of it.hits) chipBtn({ x: left + hh.x, y: top + hh.y, w: hh.w, h: hh.h }, hh.label, { on: hh.on, disabled: hh.disabled, sz: hh.sz });
        if (it.hintLines) it.hintLines.forEach((ln, i) => text(ln, left, top + it.hintY + S_(18) + i * Math.round(S_(22) * 1.35), S_(22), soft(0.72), { align: 'left', weight: 500 }));
      } else if (row.k === 'step') {
        text(row.label, left, top + S_(26), S_(25), soft(0.92), { align: 'left', weight: 700, maxW: width });
        for (const hh of it.hits) button({ x: left + hh.x, y: top + hh.y, w: hh.w, h: hh.h }, hh.label, { id: hh.id, size: hh.sz, disabled: hh.disabled });
        const b = it.stepBox;
        ctx.fillStyle = hc ? '#000000' : 'rgba(3,16,24,0.6)'; rr(left + b.x, top + b.y, b.w, b.h, 16); ctx.fill();
        ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.45); ctx.lineWidth = 2; ctx.stroke();
        text(String(row.value ?? ''), left + b.x + b.w / 2, top + b.y + b.h / 2 + S_(11), S_(31), '#ffffff', { weight: 800, maxW: b.w - 20 });
      } else if (row.k === 'btn' || row.k === 'btn2') {
        for (const hh of it.hits) button({ x: left + hh.x, y: top + hh.y, w: hh.w, h: hh.h }, hh.label, { id: hh.id, style: hh.style, size: S_(row.k === 'btn' && hh.style === 'primary' ? 36 : 31), sub: hh.sub, disabled: hh.disabled });
      } else if (row.k === 'rtext') {
        // the layout broke the lines with a generous width estimate; here the words are placed with their real widths (hit boxes follow)
        ctx.font = `500 ${it.hits[0]?.sz ?? 30}px ${UI}`; const sp = ctx.measureText(' ').width * 1.15;
        let ly = -1, lx = 0;
        for (const hh of it.hits) {
          if (hh.y !== ly) { ly = hh.y; lx = 0; }
          hh.x = lx; hh.w = ctx.measureText(hh.label).width; lx += hh.w + sp;
          const sel = row.selIdx === hh.idx;
          if (sel) { ctx.fillStyle = hc ? '#ffffff' : hexA(CYAN, 0.45); rr(left + hh.x - 4, top + hh.y, hh.w + 8, hh.h, 8); ctx.fill(); }
          text(hh.label, left + hh.x, top + hh.y + hh.h * 0.72, hh.sz, sel && hc ? '#000000' : soft(0.96), { align: 'left', weight: 500 });
        }
      } else if (row.k === 'heat') {
        const cells = row.cells, mx = Math.max(1, ...cells), cs = Math.min(S_(30), Math.floor(width / 12)), gap = 4;
        text(row.label ?? '', left, top + S_(26), S_(24), soft(0.9), { align: 'left', weight: 700, maxW: width });
        for (let i = 0; i < cells.length; i += 1) {
          const col = Math.floor(i / 7), rw = i % 7, v = cells[i], x = left + col * (cs + gap), y = top + S_(44) + rw * (cs + gap);
          ctx.fillStyle = v ? hexA(hc ? '#ffffff' : CYAN, 0.25 + 0.75 * Math.min(1, v / mx)) : (hc ? '#222222' : 'rgba(255,255,255,0.08)'); rr(x, y, cs, cs, 5); ctx.fill();
        }
        text(row.foot ?? '', left, top + S_(44) + 7 * (cs + gap) + S_(20), S_(21), soft(0.7), { align: 'left', weight: 500, maxW: width });
      } else if (row.k === 'stickers') {
        row.cells.forEach((c, i) => {
          const col = i % it.cols, rw = Math.floor(i / it.cols), x = left + col * (it.cell + S_(10)), y = top + S_(10) + rw * (it.cell + S_(10));
          ctx.fillStyle = hc ? (c.got ? '#ffffff' : '#000000') : c.got ? 'rgba(250,244,228,0.95)' : 'rgba(255,255,255,0.07)'; rr(x, y, it.cell, it.cell, 18); ctx.fill();
          if (hc) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
          if (c.got) { drawArt(ctx, c.w, x + it.cell / 2, y + it.cell * 0.46, it.cell * 0.66); text(c.w, x + it.cell / 2, y + it.cell - 10, Math.max(14, S_(18)), '#10242e', { weight: 700, maxW: it.cell - 8 }); }
          else text('?', x + it.cell / 2, y + it.cell * 0.62, S_(44), soft(0.35), { weight: 800 });
        });
      } else if (row.k === 'word') {
        ctx.save(); ctx.fillStyle = soft(0.14); ctx.fillRect(left, top + it.h - 8, width, 2); ctx.restore();
        text(row.w, left, top + it.tsz, it.tsz, '#ffffff', { font: DISPLAY, align: 'left', maxW: width * 0.5 });
        if (row.pos) text(row.pos, left, top + it.tsz + S_(26), S_(20), soft(0.6), { align: 'left', weight: 600 });
        for (const hh of it.hits) chipBtn({ x: left + hh.x, y: top + hh.y, w: hh.w, h: hh.h }, hh.label, { on: hh.on, sz: hh.sz });
        let yy = top + it.head + it.bsz;
        it.lines.forEach((ln, i) => { ctx.font = `600 ${it.bsz}px ${UI}`; ctx.fillStyle = soft(0.95); ctx.textAlign = 'left'; ctx.fillText(ln, left, yy + i * Math.round(it.bsz * 1.38)); });
        yy += it.lines.length * Math.round(it.bsz * 1.38) + S_(6);
        it.extra.forEach((ln, i) => { ctx.font = `500 ${S_(23)}px ${UI}`; ctx.fillStyle = hc ? '#ffffff' : hexA('#8fe6f7', 0.9); ctx.textAlign = 'left'; ctx.fillText(ln, left, yy + S_(20) + i * Math.round(S_(23) * 1.4)); });
      }
    }
    ctx.restore();
    const maxScroll = Math.max(0, F.layout.height - vp.h), sb = Q.scrollbar;
    if (maxScroll > 0) {
      ctx.fillStyle = hc ? '#333333' : 'rgba(255,255,255,0.14)'; rr(sb.x, sb.y, sb.w, sb.h, sb.w / 2); ctx.fill();
      const th = Math.max(48, sb.h * vp.h / F.layout.height), ty = sb.y + (sb.h - th) * (sc / maxScroll);
      ctx.fillStyle = hc ? '#ffffff' : hexA(CYAN, 0.9); rr(sb.x, ty, sb.w, th, sb.w / 2); ctx.fill();
    }
    if (state.scene === 'age') return;
    if (F.def.primary) { button(Q.back, 'Back', { size: 34, scale: enter(0) }); button(Q.next, F.def.primary.label, { id: 'formNext', style: 'primary', size: 34, scale: enter(1), disabled: F.def.primary.disabled }); }
    else button(Q.back, 'Back', { size: 34, scale: enter(0), style: 'primary' });
    return;
  }

  // ---- flashcards ---------------------------------------------------------------------------------------------
  if (state.scene === 'cards') {
    const Q = L.rules, C = L.cards, words = state.study.words, w0 = words[state.cardIdx], e = w0 ? X.entry?.(w0) : null, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    button(Q.dec, 'A−', { id: 'textDec', size: 34, disabled: state.textScaleIdx === 0 });
    button(Q.inc, 'A+', { id: 'textInc', size: 34, disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
    ctx.save(); if (!hc) { ctx.shadowColor = hexA(CYAN, 0.55); ctx.shadowBlur = 22; }
    if (L.wide) text('Flashcards', Q.titleX, Q.titleBase, Math.min(Q.titleSize, 52), '#ffffff', { font: DISPLAY, maxW: Q.dec.w * 2 + 12 }); else text('Flashcards', Q.panel.x + 10, Q.titleBase, 58, '#ffffff', { font: DISPLAY, align: 'left', maxW: Q.dec.x - Q.panel.x - 30 }); ctx.restore();
    framedPanel(C.card);
    const bd = C.body, flipT = easeOut(sceneT / 0.3);
    text(`${Math.min(state.cardIdx + 1, words.length)} / ${words.length}`, bd.x + bd.w / 2, bd.y + 22, 24, soft(0.7), { weight: 600 });
    if (e) {
      const cx = bd.x + bd.w / 2;
      if (!state.cardFlip) {
        text(e.w, cx, bd.y + bd.h * 0.42, Math.min(130, bd.w / Math.max(4, e.w.length) * 1.5), '#ffffff', { font: DISPLAY, maxW: bd.w - 20 });
        text('Tap the card to see the meaning', cx, bd.y + bd.h * 0.42 + 70, 24, soft(0.7), { weight: 500, maxW: bd.w - 20 });
      } else {
        const wy = bd.y + Math.max(120, bd.h * 0.15);
        text(e.w, cx, wy, Math.min(100, bd.w / Math.max(5, e.w.length) * 1.5), '#ffffff', { font: DISPLAY, maxW: bd.w - 20 });
        if (X.posName) text(X.posName(e.pos), cx, wy + 36, 24, soft(0.6), { weight: 600 });
        const size = Math.round(28 * scale), lh = Math.round(size * 1.38), lines = [];
        const wrapTo = (str, sz, mw) => { ctx.font = `600 ${sz}px ${UI}`; const out = []; let line = ''; for (const wd of str.split(' ')) { const cand = line ? `${line} ${wd}` : wd; if (ctx.measureText(cand).width > mw && line) { out.push(line); line = wd; } else line = cand; } out.push(line); return out; };
        let y = wy + 100;
        const para = (str, sz, col, wt = 500) => { for (const ln of wrapTo(str, sz, bd.w - 24)) { ctx.font = `${wt} ${sz}px ${UI}`; ctx.fillStyle = col; ctx.textAlign = 'center'; if (y < bd.y + bd.h - 70) ctx.fillText(ln, cx, y); y += Math.round(sz * 1.38); } y += 8; };
        para(e.gloss || '(meaning not available)', size, soft(0.97), 600);
        if (e.syn.length) para(`Same meaning: ${e.syn.join(', ')}`, Math.round(24 * scale), hexA('#8fe6f7', 0.95));
        if (e.ant.length) para(`Opposite: ${e.ant.join(', ')}`, Math.round(24 * scale), hexA('#8fe6f7', 0.95));
        if (e.ex) para(`Example: ${e.ex}`, Math.round(22 * scale), soft(0.8));
        void lines; void lh;
        if (X.lookupOn) text('Look it up in a dictionary', cx, bd.y + bd.h - 28, 24, hc ? '#ffffff' : CYAN, { weight: 700 });
      }
    }
    void flipT;
    button(C.know, 'I know it', { id: 'know', size: 30, style: 'primary' });
    button(C.learn, 'Still learning', { id: 'learn', size: 30 });
    button(Q.back, 'Back', { size: 34 });
    button(Q.next, state.cardIdx >= words.length - 1 ? 'Done' : 'Next', { id: 'cardNext', size: 34, style: 'primary' });
    return;
  }

  // ---- rules reference: a scrolling reader --------------------------------------------------------------
  if (state.scene === 'rules') {
    const Q = L.rules, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    button(Q.dec, 'A−', { id: 'textDec', size: 34, disabled: state.textScaleIdx === 0 });
    button(Q.inc, 'A+', { id: 'textInc', size: 34, disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
    ctx.save();
    if (!hc) { ctx.shadowColor = hexA(CYAN, 0.55); ctx.shadowBlur = 22; }
    text('Rules', Q.titleX, Q.titleBase, Q.titleSize, '#ffffff', { font: DISPLAY });
    ctx.restore();
    framedPanel(Q.panel);

    // Build (or reuse) the wrapped document: one block per heading / illustration / paragraph.
    const bodySize = Math.round(29 * scale), lh = Math.round(41 * scale), headSize = Math.round(32 * scale), headLh = Math.round(headSize * 1.25);
    const tw = Q.textW, key = `${scale}|${Math.round(tw)}`;
    if (!rulesCache || rulesCache.key !== key) {
      const wrap = (str, size, weight) => {
        ctx.font = `${weight} ${size}px ${UI}`;
        const out = []; let line = '';
        for (const wd of str.split(' ')) { const cand = line ? `${line} ${wd}` : wd; if (ctx.measureText(cand).width > tw && line) { out.push(line); line = wd; } else line = cand; }
        out.push(line); return out;
      };
      const blocks = []; let y = 20, prevDemo = null;
      RULES.forEach((page, i) => {
        if (i > 0) y += Math.round(30 + 12 * scale);
        blocks.push({ kind: 'head', y, lines: wrap(page.title, headSize, 700), size: headSize, lh: headLh });
        y += headLh * blocks[blocks.length - 1].lines.length + 8;
        if (page.demo && page.demo !== prevDemo) { const dh = { objective: 250, mode: 250, slips: 110, answer: 110, clock: 100, review: 150 }[page.demo] ?? 0; blocks.push({ kind: 'demo', y: y + 6, demo: page.demo, h: dh }); y += dh + 16; }
        prevDemo = page.demo ?? null;
        for (const ln of page.lines) { const wl = wrap(ln, bodySize, 500); blocks.push({ kind: 'text', y, lines: wl, size: bodySize, lh }); y += lh * wl.length + 6; }
      });
      rulesCache = { key, blocks, content: y + 30 };
    }
    const vp = Q.viewport;
    rulesMetrics.content = rulesCache.content; rulesMetrics.view = vp.h; rulesMetrics.max = Math.max(0, rulesCache.content - vp.h);
    const sc = Math.max(0, Math.min(state.rulesScroll, rulesMetrics.max)), cx = vp.x + vp.w / 2, left = vp.x + Q.padX;

    ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
    for (const b of rulesCache.blocks) {
      const top = vp.y + b.y - sc, bh = b.kind === 'demo' ? b.h : b.lines.length * b.lh;
      if (top > vp.y + vp.h || top + bh < vp.y - 10) continue;
      if (b.kind === 'head') {
        b.lines.forEach((ln, i) => text(ln, left, top + b.size + i * b.lh, b.size, hc ? '#ffffff' : '#8fe6f7', { weight: 700, align: 'left' }));
      } else if (b.kind === 'text') {
        ctx.fillStyle = soft(0.94); ctx.font = `500 ${b.size}px ${UI}`; ctx.textAlign = 'left';
        b.lines.forEach((ln, i) => ctx.fillText(ln, left, top + b.size + i * b.lh));
      } else {
        // a small illustration drawn with the game's own slip()/plaque(), shrunk to fit narrow readers
        const dw = tw, fit = Math.min(1, dw / 640);
        ctx.save(); ctx.translate(cx, top); ctx.scale(fit, fit); ctx.translate(-cx, -top);
        const slipRow = (yc, tints) => {
          const words = ['clear', 'ornate', 'murky'], gap = 16, ws = words.map((x) => slipWidth(x)), tot = ws.reduce((a, b2) => a + b2, 0) + gap * 2;
          let x = cx - tot / 2;
          words.forEach((wd, i) => { slip(wd, x + ws[i] / 2, yc, { tilt: [-0.03, 0.02, -0.015][i], tint: hc ? undefined : tints?.[i], w: ws[i], h: CHIP_H }); x += ws[i] + gap; });
        };
        if (b.demo === 'objective' || b.demo === 'mode') {
          plaque({ x: cx - 190, y: top, w: 380, h: 132 }, 'TAP THE SYNONYM OF', HERO_TARGET, { small: true, wordSize: 60 });
          slipRow(top + 194, [GOOD]);
        } else if (b.demo === 'slips' || b.demo === 'answer') slipRow(top + 48, b.demo === 'answer' ? [GOOD, BAD] : []);
        else if (b.demo === 'clock') {
          const tr = { x: cx - 126, y: top, w: 252, h: 86 };
          shadow(tr.x, tr.y, tr.w, tr.h, 22, 8); ctx.fillStyle = 'rgba(3,16,24,0.78)'; rr(tr.x, tr.y, tr.w, tr.h, 22); ctx.fill();
          ctx.strokeStyle = hexA(CYAN, 0.85); ctx.lineWidth = 2.5; ctx.stroke();
          const kx = tr.x + 48, ky = tr.y + 43;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(kx, ky, 19, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + 12, ky - 8); ctx.stroke();
          text('1:30', tr.x + 158, tr.y + 63, 56, '#ffffff', { weight: 800 });
        } else if (b.demo === 'review') {
          const rw = 560, rh = 130, x = cx - rw / 2, y = top;
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(x + 2, y + 6, rw - 4, rh, 18); ctx.fill();
          const g = ctx.createLinearGradient(0, y, 0, y + rh);
          g.addColorStop(0, 'rgba(18,58,74,0.94)'); g.addColorStop(1, 'rgba(8,28,40,0.94)');
          ctx.fillStyle = g; rr(x, y, rw, rh, 18); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = BAD; rr(x, y, 10, rh, [18, 0, 0, 18]); ctx.fill();
          const mx = x + 52, my = y + 46;
          ctx.fillStyle = hexA(BAD, 0.18); ctx.beginPath(); ctx.arc(mx, my, 25, 0, TAU); ctx.fill();
          ctx.strokeStyle = BAD; ctx.lineWidth = 2; ctx.stroke();
          ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
          ctx.moveTo(mx - 10, my - 10); ctx.lineTo(mx + 10, my + 10); ctx.moveTo(mx + 10, my - 10); ctx.lineTo(mx - 10, my + 10); ctx.stroke();
          text('murky', x + 92, y + 52, 42, '#ffffff', { font: DISPLAY, align: 'left', maxW: 300 });
          text('Answer: clear', x + 92, y + 88, 26, accent, { align: 'left', weight: 700, maxW: 300 });
          text('You: ornate', x + rw - 22, y + 88, 25, BAD, { align: 'right', weight: 600, maxW: 200 });
        }
        ctx.restore();
      }
    }
    ctx.restore();
    // scroll bar
    const sb = Q.scrollbar;
    if (rulesMetrics.max > 0) {
      ctx.fillStyle = hc ? '#333333' : 'rgba(255,255,255,0.14)'; rr(sb.x, sb.y, sb.w, sb.h, sb.w / 2); ctx.fill();
      const th = Math.max(48, sb.h * vp.h / rulesCache.content), ty = sb.y + (sb.h - th) * (sc / rulesMetrics.max);
      ctx.fillStyle = hc ? '#ffffff' : hexA(CYAN, 0.9); rr(sb.x, ty, sb.w, th, sb.w / 2); ctx.fill();
    }
    const atEnd = sc >= rulesMetrics.max - 1;
    button(Q.back, 'Back', { size: 34, scale: enter(0) });
    button(Q.next, atEnd ? 'Done' : 'Next', { style: 'primary', size: 34, scale: enter(1) });
    return;
  }

  if (state.scene === 'demo-limit') {
    const D = L.limit;
    plaque(D.plaque, 'FREE DEMO FINISHED', 'Thanks for playing', { wordSize: 72 });
    text('Get Word Game on iPhone and Android', w / 2, D.lineY, 31, scheme.text, { weight: 600, maxW: Math.min(640, w - 40) });
    text('for unlimited sessions.', w / 2, D.lineY + 44, 31, scheme.text, { weight: 600 });
    return;
  }

  // ---- play (also Auto Play's "Watch & Learn" scene - same HUD/board, see the `auto` branches) ----------
  if (state.scene === 'playing' || state.scene === 'autoplay') {
    const auto = state.scene === 'autoplay';
    const fx = state.fx, fxF = fx ? fx.t / 0.8 : 1;
    const byQ = state.byQuestions && !auto;
    const secs = Math.max(0, state.timeLeft), frac = byQ ? clamp01(1 - state.answered / Math.max(1, state.total)) : clamp01(secs / Math.max(1, state.total)), low = byQ ? false : secs <= Math.min(10, state.total * 0.15), mid = byQ ? false : secs <= Math.min(25, state.total * 0.3);
    ctx.save();
    if (state.shake > 0 && !hc) ctx.translate(Math.sin(t * 90) * 11 * state.shake, Math.cos(t * 70) * 6 * state.shake);
    const tcol = hc ? '#ffffff' : low ? BAD : mid ? GOLD : '#ffffff';
    const tpulse = low ? 1 + 0.08 * Math.max(0, Math.sin(secs * TAU)) : 1;
    const hudIn = easeOut(sceneT / 0.3);
    if (P.panel) {                                                                 // landscape: the left card
      const pn = P.panel;
      if (hc) { ctx.fillStyle = '#000000'; rr(pn.x, pn.y, pn.w, pn.h, 28); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
      else {
        const g = ctx.createLinearGradient(0, pn.y, 0, pn.y + pn.h);
        g.addColorStop(0, 'rgba(4,22,32,0.62)'); g.addColorStop(1, 'rgba(2,10,16,0.72)');
        ctx.fillStyle = g; rr(pn.x, pn.y, pn.w, pn.h, 28); ctx.fill();
        ctx.strokeStyle = hexA(CYAN, 0.35); ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.save(); ctx.globalAlpha = hudIn; ctx.translate(0, (1 - hudIn) * -30);

    // clock: digits and a draining bar that reads at a glance
    const tr = P.clock;
    if (hc) { ctx.fillStyle = '#000000'; rr(tr.x, tr.y, tr.w, tr.h, 22); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    else { shadow(tr.x, tr.y, tr.w, tr.h, 22, 8); ctx.fillStyle = 'rgba(3,16,24,0.78)'; rr(tr.x, tr.y, tr.w, tr.h, 22); ctx.fill(); ctx.strokeStyle = hexA(low ? BAD : mid ? GOLD : CYAN, 0.85); ctx.lineWidth = 2.5; ctx.stroke(); }
    const kx = tr.x + 46, ky = tr.y + tr.h / 2;                              // a small clock whose hand sweeps the session
    ctx.strokeStyle = tcol; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(kx, ky, 19, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.sin((1 - frac) * TAU) * 12, ky - Math.cos((1 - frac) * TAU) * 12); ctx.stroke();
    ctx.save(); ctx.translate((tr.x + 80 + tr.x + tr.w - 10) / 2, ky); ctx.scale(tpulse, tpulse);
    text(byQ ? `${Math.min(state.answered + 1, state.total)}/${state.total}` : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`, 0, 20, 56, tcol, { weight: 800, maxW: tr.w - 96 });
    ctx.restore();
    const b = P.bar;
    ctx.fillStyle = hc ? '#000000' : 'rgba(0,0,0,0.45)'; rr(b.x, b.y, b.w, b.h, 8); ctx.fill();
    if (hc) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (frac > 0.005) {
      const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      if (hc) { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffffff'); }
      else if (low) { g.addColorStop(0, '#ff5d5d'); g.addColorStop(1, '#ffb0a0'); }
      else if (mid) { g.addColorStop(0, '#ffb547'); g.addColorStop(1, GOLD); }
      else { g.addColorStop(0, CYAN_DEEP); g.addColorStop(1, '#8cecfb'); }
      ctx.fillStyle = g; rr(b.x, b.y, Math.max(b.h, b.w * frac), b.h, 8); ctx.fill();
      if (!hc) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(b.x + 3, b.y + 2, Math.max(4, b.w * frac - 6), 4, 2); ctx.fill(); }
    }

    // score medallion
    const bump = fx && fx.kind === 'right' ? 1 + 0.35 * (1 - easeOut(fx.t / 0.35)) : 1;
    const sr = P.score, narrow = sr.w < 200;
    if (hc) { ctx.fillStyle = '#000000'; rr(sr.x, sr.y, sr.w, sr.h, 22); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    else { shadow(sr.x, sr.y, sr.w, sr.h, 22, 8); ctx.fillStyle = 'rgba(3,16,24,0.78)'; rr(sr.x, sr.y, sr.w, sr.h, 22); ctx.fill(); ctx.strokeStyle = hexA(GOLD, 0.8); ctx.lineWidth = 2.5; ctx.stroke(); }
    if (narrow) {
      text('SCORE', sr.x + sr.w / 2, sr.y + 27, 22, hc ? '#ffffff' : hexA(GOLD, 0.95));
      ctx.save(); ctx.translate(sr.x + sr.w / 2, sr.y + sr.h - 14); ctx.scale(bump, bump);
      text(String(state.score), 0, 0, 44, '#ffffff', { weight: 800, maxW: sr.w - 24 });
      ctx.restore();
    } else {
      text('SCORE', sr.x + 20, sr.y + 50, 22, hc ? '#ffffff' : hexA(GOLD, 0.95), { align: 'left' });
      ctx.save(); ctx.translate(sr.x + sr.w - 40, sr.y + sr.h / 2 + 3); ctx.scale(bump, bump);
      text(String(state.score), 0, 16, 48, '#ffffff', { weight: 800, maxW: 70 });
      ctx.restore();
    }
    ctx.restore();

    // combo pill (streak and multiplier) and lives
    if (!auto) {
      const cb = P.combo, mult = state.streak >= 10 ? 4 : state.streak >= 6 ? 3 : state.streak >= 3 ? 2 : 1, next = mult === 4 ? 10 : [3, 6, 10][mult - 1];
      const prevT = mult === 1 ? 0 : [0, 3, 6, 10][mult - 1], fr = mult === 4 ? 1 : (state.streak - prevT) / (next - prevT);
      const pop = state.fx && state.fx.kind === 'right' ? 1 + 0.25 * (1 - easeOut(state.fx.t / 0.3)) : 1;
      ctx.save(); ctx.globalAlpha = hudIn;
      if (hc) { ctx.fillStyle = '#000000'; rr(cb.x, cb.y, cb.w, cb.h, 18); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
      else { shadow(cb.x, cb.y, cb.w, cb.h, 18, 6); ctx.fillStyle = 'rgba(3,16,24,0.78)'; rr(cb.x, cb.y, cb.w, cb.h, 18); ctx.fill(); ctx.strokeStyle = hexA(mult > 1 ? GOLD : CYAN, 0.8); ctx.lineWidth = 2.5; ctx.stroke(); }
      const small = cb.h < 60, cy0 = cb.y + cb.h / 2;
      ctx.save(); ctx.translate(cb.x + (small ? 56 : 64), cy0); ctx.scale(pop, pop);
      text(`x${mult}`, 0, small ? 11 : 15, small ? 34 : 46, hc ? '#ffffff' : mult > 1 ? GOLD : '#9fdde9', { weight: 800 });
      ctx.restore();
      text((state.streak ? `${state.streak} in a row` : 'combo') + (small && state.live.lives > 0 ? `  ·  ${state.lives} lives` : ''), cb.x + cb.w - 14, cy0 + (small ? 8 : 10), small ? 22 : 24, soft(0.9), { weight: 600, align: 'right', maxW: cb.w - 130 });
      if (!small) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(cb.x + 18, cb.y + cb.h - 14, cb.w - 36, 6, 3); ctx.fill(); ctx.fillStyle = hc ? '#ffffff' : GOLD; rr(cb.x + 18, cb.y + cb.h - 14, Math.max(6, (cb.w - 36) * fr), 6, 3); ctx.fill(); }
      if (state.live.lives > 0 && !small) {
        for (let k = 0; k < state.live.lives; k++) {
          const hx = P.bar.x + 14 + k * 28, hy = P.bar.y + 36;
          ctx.fillStyle = k < state.lives ? (hc ? '#ffffff' : BAD) : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(hx - 5, hy - 3, 8, Math.PI, 0); ctx.arc(hx + 5, hy - 3, 8, Math.PI, 0); ctx.lineTo(hx, hy + 12); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }

    // the lanes the words drift along, with chevrons flowing the way the words go
    const bd = P.band, hh = Math.min(110, L.laneH / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(bd.x, 0, w - bd.x, h); ctx.clip();            // words slide in from the right edge and out under the card
    for (let k = 0; k < 3; k++) {
      const ly = L.laneY(k);
      if (hc) continue;
      const lg = ctx.createLinearGradient(0, ly - hh, 0, ly + hh);
      lg.addColorStop(0, soft(0)); lg.addColorStop(0.5, soft(0.075)); lg.addColorStop(1, soft(0));
      ctx.fillStyle = lg; ctx.fillRect(bd.x, ly - hh, bd.w, hh * 2);
      ctx.strokeStyle = soft(0.16); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const nC = Math.ceil(bd.w / 150) + 1;
      for (let c = 0; c < nC; c++) {
        const cx = mod(c * 150 - t * (40 + k * 12), bd.w + 180) - 90, fade = Math.sin((cx / bd.w) * Math.PI);
        ctx.globalAlpha = Math.max(0, fade); ctx.beginPath(); ctx.moveTo(bd.x + cx + 12, ly - 16); ctx.lineTo(bd.x + cx, ly); ctx.lineTo(bd.x + cx + 12, ly + 16); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const revealing = auto && state.autoPhase === 'reveal';
    if (state.round) {
      for (const wd of state.round.words) {
        const sx = L.wordX(wd.x), sy = L.wordY(wd.slot, wd.y), sw = L.slipW(wd.text);
        // Auto Play REVEAL: highlight the one option about to be taken, distinctly from the others.
        const answerHere = revealing && wd.correct;
        if (answerHere && !hc) {
          const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 180);
          glow.addColorStop(0, hexA(GOOD, 0.5)); glow.addColorStop(1, hexA(GOOD, 0));
          ctx.fillStyle = glow; ctx.fillRect(sx - 180, sy - 180, 360, 360);
        }
        slip(wd.text, sx, sy, {
          w: sw,
          trail: !auto,
          tilt: auto ? 0 : Math.sin(t * 1.3 + wd.slot * 2.1) * 0.03,
          scale: answerHere ? 1.12 : 1,
          tint: answerHere ? GOOD : undefined,
          alpha: state.round.hinted === wd.slot ? 0.18 : revealing && !wd.correct ? 0.55 : 1,
        });
        if (answerHere) {
          ctx.strokeStyle = hc ? '#ffffff' : GOOD; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(sx, sy, sw / 2 + 24, L.chipH / 2 + 20, 0, 0, TAU); ctx.stroke();
          text('ANSWER', sx, sy - L.chipH / 2 - 28, 24, hc ? '#ffffff' : GOOD, { weight: 800 });
        }
      }
    }

    // feedback for the last answer
    if (fx) {
      const fxx = fx.kind === 'miss' ? bd.x : L.wordX(fx.x), fxy = L.wordY(fx.slot, fx.y), fw = L.slipW(fx.text);
      if (fx.kind === 'right') {
        const f = easeOut(fx.t / 0.6), a = 1 - clamp01(fx.t / 0.6);
        if (!hc) {
          const gl = ctx.createRadialGradient(fxx, fxy, 20, fxx, fxy, 260);
          gl.addColorStop(0, hexA(GOOD, 0.5 * a)); gl.addColorStop(1, hexA(GOOD, 0));
          ctx.fillStyle = gl; ctx.fillRect(fxx - 260, fxy - 260, 520, 520);
        }
        slip(fx.text, fxx, fxy - f * 30, { w: fw, scale: 1 + f * 0.25, alpha: a });
        ctx.strokeStyle = hc ? '#ffffff' : hexA(GOOD, a); ctx.lineWidth = 12 * a + 1;
        ctx.beginPath(); ctx.ellipse(fxx, fxy, fw / 2 + 20 + f * 90, 50 + f * 70, 0, 0, TAU); ctx.stroke();
        for (let k = 0; k < 16; k++) {
          const ang = k * 2.4, d = 50 + f * (130 + (k % 4) * 34), px = fxx + Math.cos(ang) * d * 1.4, py = fxy + Math.sin(ang) * d + f * f * 60;
          ctx.fillStyle = hc ? '#ffffff' : hexA(k % 2 ? GOLD : GOOD, a);
          ctx.beginPath(); ctx.arc(px, py, (5 + (k % 3) * 2) * (1 - f * 0.5), 0, TAU); ctx.fill();
        }
        text(`+${fx.pts || 1}`, fxx, Math.max(bd.y + 60, fxy - 70 - f * 80), 64, hc ? '#ffffff' : hexA(GOOD, a), { weight: 800 });
        if (fx.mult > 1) text(`x${fx.mult}`, fxx + 96, Math.max(bd.y + 60, fxy - 70 - f * 80) - 6, 38, hc ? '#ffffff' : hexA(GOLD, a), { weight: 800 });
      } else {
        const f = clamp01(fx.t / 0.7), a = 1 - f;
        if (fx.kind === 'wrong') slip(fx.text, fxx + Math.sin(fx.t * 60) * 10 * a, fxy + f * f * 260, { w: fw, tilt: f * 0.5, alpha: a, tint: hc ? undefined : BAD });
        if (!hc) {
          const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, Math.max(h * 0.62, w * 0.4));
          g.addColorStop(0, hexA(BAD, 0)); g.addColorStop(1, hexA(BAD, 0.45 * a));
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        // a cross where the answer got away
        const cx = fx.kind === 'miss' ? bd.x + 64 : fxx, cy = fx.kind === 'miss' ? fxy : fxy - 84, s = 26 * (1 + (1 - easeOut(fx.t / 0.2)) * 0.8);
        ctx.globalAlpha = a; ctx.strokeStyle = hc ? '#ffffff' : BAD; ctx.lineWidth = 11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    if (state.round) {
      const shake = fx && fx.kind !== 'right' ? Math.sin(fx.t * 58) * 12 * Math.max(0, 1 - fx.t / 0.4) : 0;
      const rd = state.round, pk = { dx: shake, pop: 0.8 + 0.2 * easeBack(rd.age / 0.28) };
      if (rd.kind === 'listening' || rd.kind === 'letter-hear') plaque(P.plaque, rd.label, rd.targetWord, { ...pk, speaker: true });
      else if (rd.kind === 'picture') plaque(P.plaque, rd.label, '', { ...pk, art: rd.art });
      else if (rd.kind === 'letter-case') plaque(P.plaque, rd.label, rd.targetWord, { ...pk, wordSize: 150 });
      else if (rd.kind === 'letter-next') plaque(P.plaque, rd.label, rd.targetWord, { ...pk, wordSize: 96 });
      else if (['definition', 'spelling', 'confusable', 'root', 'phrase'].includes(rd.kind)) plaque(P.plaque, rd.label, rd.targetWord, { ...pk, lines: wrapLines(rd.targetWord, 44, P.plaque.w - 70, 3) });
      else if (rd.kind === 'odd') plaque(P.plaque, rd.label, rd.targetWord, { ...pk, wordSize: 56 });
      else plaque(P.plaque, rd.label, rd.targetWord, pk);
    }

    const btnIn = easeBack((sceneT - 0.1) / 0.38);
    if (auto) {
      // Think-time stepper: an index into THINK_STEPS (never a raw float).
      const thinkS = THINK_STEPS[state.autoThinkIdx];
      button(P.dec, '−', { id: 'thinkDec', size: 34, scale: btnIn, disabled: state.autoThinkIdx === 0 });
      button(P.inc, '+', { id: 'thinkInc', size: 34, scale: btnIn, disabled: state.autoThinkIdx === THINK_STEPS.length - 1 });
      const phaseLabel = state.autoPaused ? 'Paused' : revealing ? 'Answer!' : `Think — ${thinkS}s`;
      const tl = P.thinkLabel;
      text(phaseLabel, tl.x, tl.y, 26, state.autoPaused ? hexA(GOLD, 0.95) : revealing ? (hc ? '#ffffff' : GOOD) : soft(0.9), { weight: 800, maxW: tl.maxW });
      button(P.aexit, 'Exit', { size: 28, scale: btnIn });
      button(P.apause, state.autoPaused ? 'Resume' : 'Pause', { id: 'autoPause', size: 28, scale: btnIn, style: state.autoPaused ? 'active' : undefined });
      button(P.acolour, 'Colours', { id: 'colour', size: 26, scale: btnIn, swatch });
    } else {
      button(P.stop, 'Stop', { size: 28, scale: btnIn });
      button(P.pause, state.paused ? 'Resume' : 'Pause', { id: 'pause', size: 28, scale: btnIn, style: state.paused ? 'active' : undefined });
      button(P.hint, 'Hint', { id: 'hint', size: 28, scale: btnIn, disabled: !state.live.hints || (state.round && state.round.hinted >= 0), sub: state.live.hints ? '−5' : undefined });
      // learning inside play: a quick, non-blocking reveal of the word and its meaning
      const tt = state.toast;
      if (tt && !state.paused) {
        const tr = L.wide ? P.think : { x: P.plaque.x, y: P.think.y, w: P.plaque.w, h: P.think.h };
        const a = clamp01(Math.min(1, (2.4 - tt.t) * 3)) * easeOut(tt.t / 0.18);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = hc ? '#000000' : 'rgba(3,16,24,0.82)'; rr(tr.x, tr.y, tr.w, tr.h, 20); ctx.fill();
        ctx.strokeStyle = hc ? '#ffffff' : hexA(tt.good ? GOOD : BAD, 0.85); ctx.lineWidth = 2.5; ctx.stroke();
        text(tt.text, tr.x + tr.w / 2, tr.y + (tt.sub ? 28 : 40), 27, hc ? '#ffffff' : tt.good ? GOOD : BAD, { weight: 800, maxW: tr.w - 30 });
        if (tt.sub) text(clip(tt.sub, 20, tr.w - 36), tr.x + tr.w / 2, tr.y + 54, 20, soft(0.88), { weight: 500 });
        ctx.restore();
      }
    }
    if (state.caption && PF.captions) {
      const cp = state.caption, ca = clamp01(Math.min(1, (1.6 - cp.t) * 4)), bx = P.band.x + P.band.w / 2, by = P.band.y + P.band.h - 36;
      ctx.save(); ctx.globalAlpha = ca; ctx.font = `700 24px ${UI}`; const cw = Math.min(P.band.w - 20, ctx.measureText(cp.text).width + 40);
      ctx.fillStyle = 'rgba(0,0,0,0.78)'; rr(bx - cw / 2, by - 26, cw, 44, 12); ctx.fill(); text(cp.text, bx, by + 6, 24, '#ffffff', { weight: 700, maxW: cw - 24 }); ctx.restore();
    }
    // combo banner, particles, flash, pause veil
    if (state.banner) {
      const bn = state.banner, f = bn.t / 1.1, sc = easeBack(Math.min(1, bn.t / 0.25)), a = 1 - clamp01((f - 0.6) / 0.4);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(P.band.x + P.band.w / 2, P.band.y + P.band.h / 2); ctx.scale(sc, sc); ctx.rotate(-0.05);
      if (!hc) { ctx.shadowColor = hexA(GOLD, 0.8); ctx.shadowBlur = 30; }
      text(bn.text, 0, 0, Math.min(96, P.band.w / 7), hc ? '#ffffff' : GOLD, { font: DISPLAY, weight: 800, maxW: P.band.w - 40 });
      ctx.restore();
    }
    for (const q of state.parts) {
      const a = 1 - q.age / q.life; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = hc ? '#ffffff' : q.c;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (0.6 + 0.4 * a), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state.flash > 0 && !hc) { ctx.fillStyle = `rgba(255,255,255,${0.1 * state.flash})`; ctx.fillRect(0, 0, w, h); }
    if (state.paused && !auto) {
      ctx.fillStyle = hc ? 'rgba(0,0,0,0.9)' : 'rgba(2,10,16,0.78)'; ctx.fillRect(P.band.x, P.band.y, P.band.w, P.band.h);
      text('Paused', P.band.x + P.band.w / 2, P.band.y + P.band.h / 2 - 10, 84, '#ffffff', { font: DISPLAY, maxW: P.band.w - 40 });
      text('Everything is frozen. Tap Resume.', P.band.x + P.band.w / 2, P.band.y + P.band.h / 2 + 44, 26, soft(0.85), { weight: 600, maxW: P.band.w - 40 });
    }
    ctx.restore();
    return;
  }

  // ---- session review -----------------------------------------------------------------------------------
  if (state.scene === 'gameover') {
    const O = L.over;
    ctx.fillStyle = hc ? '#000000' : 'rgba(2,8,14,0.55)'; ctx.fillRect(0, 0, w, h);
    const head = easeOut(sceneT / 0.4);
    ctx.save(); ctx.globalAlpha = head; ctx.translate(0, (1 - head) * -40);
    const RR = state.runResult;
    let headline = { time: "Time's up!", questions: 'Round complete!', lives: 'Out of lives', stop: 'Session ended', empty: 'Session ended' }[state.reason] ?? "Time's up!";
    if (RR) headline = RR.type === 'stage' ? (RR.pass ? 'Stage cleared!' : 'Not yet') : RR.type === 'check' ? (RR.pass ? 'Checkpoint passed!' : 'Checkpoint missed') : headline;
    else if (PF.senior) headline = 'Nicely done';
    text(headline, O.cx, O.titleY, 76, '#ffffff', { font: DISPLAY, maxW: O.card.w });
    text(state.autoPlay ? 'AUTO-PLAY DEMO — not saved' : RR ? state.run.label.toUpperCase() : state.kind === 'review' ? 'DAILY REVIEW' : 'SESSION REVIEW', O.cx, O.subY, 22, hc ? '#ffffff' : (state.autoPlay ? GOLD : '#8fe6f7'));

    // summary card: the score counts up, with the tally and best beside it (or under it in a narrow card)
    const card = O.card;
    if (hc) { ctx.fillStyle = '#000000'; rr(card.x, card.y, card.w, card.h, 26); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
    else {
      shadow(card.x, card.y, card.w, card.h, 26, 14);
      const g = ctx.createLinearGradient(0, card.y, 0, card.y + card.h);
      g.addColorStop(0, 'rgba(12,52,68,0.95)'); g.addColorStop(1, 'rgba(4,18,28,0.95)');
      ctx.fillStyle = g; rr(card.x, card.y, card.w, card.h, 26); ctx.fill();
      ctx.strokeStyle = state.newBest ? GOLD : hexA(CYAN, 0.8); ctx.lineWidth = 3; ctx.stroke();
    }
    const right = state.history.filter((hh2) => hh2.correct).length, missed = state.history.length - right;
    const shownScore = Math.round(state.score * easeOut(sceneT / 0.7));
    const bestNow = state.bestScores[state.bestKey] ?? 0;
    const starTxt = RR && RR.type === 'stage' ? `Stars  ${'★'.repeat(RR.stars)}${'☆'.repeat(3 - RR.stars)}${RR.stars > RR.prevStars ? '  new!' : ''}` : RR && RR.type === 'check' ? `Checkpoint score ${RR.pct}%` : '';
    const bestStr = starTxt || (state.autoPlay ? '' : state.newBest ? '★  New best score!' : `Best streak ${state.bestStreak}  ·  best score ${bestNow}`);
    const glint = state.newBest && !hc ? 0.75 + 0.25 * Math.sin(t * 5) : 1;
    const sx0 = card.x + card.w * 0.17, dv = card.x + card.w * 0.34, tx0 = card.x + card.w * 0.37, tw2 = card.x + card.w - 14 - tx0;
    text('SCORE', sx0, card.y + 46, 22, hc ? '#ffffff' : '#8fe6f7');
    text(String(shownScore), sx0, card.y + card.h - 34, 88, '#ffffff', { weight: 800, maxW: card.w * 0.28 });
    ctx.fillStyle = hc ? '#ffffff' : 'rgba(255,255,255,0.18)'; ctx.fillRect(dv, card.y + 26, 2, card.h - 52);
    if (!card.stack) {
      text(`${right} right`, tx0, card.y + 66, 32, hc ? '#ffffff' : GOOD, { align: 'left', maxW: tw2 / 2 - 8 });
      text(PF.senior ? `${missed} to practise` : `${missed} missed`, tx0 + tw2 / 2 + 8, card.y + 66, 32, hc ? '#ffffff' : PF.senior ? GOLD : BAD, { align: 'left', maxW: tw2 / 2 - 8 });
      ctx.globalAlpha = head * glint;
      text(bestStr, tx0, card.y + card.h - 46, 28, state.newBest && !hc ? GOLD : soft(0.85), { align: 'left', weight: state.newBest ? 800 : 600, maxW: tw2 });
    } else {
      text(`${right} right`, tx0, card.y + 48, 30, hc ? '#ffffff' : GOOD, { align: 'left', maxW: tw2 });
      text(PF.senior ? `${missed} to practise` : `${missed} missed`, tx0, card.y + 90, 30, hc ? '#ffffff' : PF.senior ? GOLD : BAD, { align: 'left', maxW: tw2 });
      ctx.globalAlpha = head * glint;
      text(bestStr, tx0, card.y + card.h - 22, 24, state.newBest && !hc ? GOLD : soft(0.85), { align: 'left', weight: state.newBest ? 800 : 600, maxW: tw2 });
    }
    ctx.restore();

    const rows = state.history.filter((x) => !x.correct).concat(state.history.filter((x) => x.correct));
    const rcx = O.rowsX + O.rowsW / 2;
    if (!rows.length) text('No answers this session.', rcx, O.rowsTop + 120, 30, soft(0.85), { weight: 500 });
    else if (rows.every((x) => x.correct)) text('No mistakes. Every answer was right.', rcx, O.rowsTop + 10, 24, hc ? '#ffffff' : GOOD, { weight: 700, maxW: O.rowsW });
    const rowsTop = rows.every((x) => x.correct) && rows.length ? O.rowsTop + 28 : O.rowsTop;
    const lookOn = !state.autoPlay && X.lookupOn;
    const pages = Math.max(1, Math.ceil(state.history.length / O.perPage)), pg = Math.min(state.reviewPage, pages - 1);

    rows.slice(pg * O.perPage, (pg + 1) * O.perPage).forEach((hr, i) => {
      const inF = easeOut((sceneT - 0.12 - i * 0.05) / 0.35), x = O.rowsX + (1 - inF) * 80, y = rowsTop + i * O.rowH, rw = O.rowsW, rh = O.rowH - 12;
      const tone = hc ? '#ffffff' : hr.correct ? GOOD : BAD;
      ctx.save(); ctx.globalAlpha = inF;
      if (hc) { ctx.fillStyle = '#000000'; rr(x, y, rw, rh, 18); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke(); }
      else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(x + 2, y + 6, rw - 4, rh, 18); ctx.fill();
        const g = ctx.createLinearGradient(0, y, 0, y + rh);
        g.addColorStop(0, 'rgba(18,58,74,0.94)'); g.addColorStop(1, 'rgba(8,28,40,0.94)');
        ctx.fillStyle = g; rr(x, y, rw, rh, 18); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = tone; rr(x, y, 10, rh, [18, 0, 0, 18]); ctx.fill();
      }
      // drawn tick / cross in a disc
      const mx = x + 52, my = y + 46;
      ctx.fillStyle = hc ? '#000000' : hexA(hr.correct ? GOOD : BAD, 0.18); ctx.beginPath(); ctx.arc(mx, my, 25, 0, TAU); ctx.fill();
      ctx.strokeStyle = tone; ctx.lineWidth = hc ? 3 : 2; ctx.stroke();
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      if (hr.correct) { ctx.moveTo(mx - 12, my + 1); ctx.lineTo(mx - 3, my + 10); ctx.lineTo(mx + 13, my - 9); }
      else { ctx.moveTo(mx - 10, my - 10); ctx.lineTo(mx + 10, my + 10); ctx.moveTo(mx + 10, my - 10); ctx.lineTo(mx - 10, my + 10); }
      ctx.stroke();
      text(hr.word, x + 92, y + 52, 42, '#ffffff', { font: DISPLAY, align: 'left', maxW: Math.min(380, rw - 220) });
      text(KIND_SHORT[hr.kind] ?? '', x + rw - (lookOn && !hr.letter ? 170 : 22), y + 40, 22, soft(0.7), { align: 'right' });
      if (lookOn && !hr.letter) { const lr = O.lookRect(i, rowsTop); ctx.fillStyle = hc ? '#000000' : 'rgba(10,36,48,0.92)'; rr(lr.x, lr.y, lr.w, lr.h, 14); ctx.fill(); ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.6); ctx.lineWidth = 2; ctx.stroke(); text('Look up', lr.x + lr.w / 2, lr.y + lr.h / 2 + 8, 22, '#ffffff', { weight: 700 }); }
      const you = hr.correct ? '' : hr.picked === null ? 'drifted past' : `You: ${hr.picked}`;
      const avail = rw - 92 - 22, ansMax = you ? Math.max(150, avail * 0.56) : avail;
      text(`Answer: ${hr.answer}`, x + 92, y + 88, 26, accent, { align: 'left', weight: 700, maxW: ansMax });
      if (you) text(you, x + rw - 22, y + 88, 25, tone, { align: 'right', weight: 600, maxW: Math.max(100, avail - ansMax - 12) });
      text(clip(hr.meaning, 22, rw - 116), x + 92, y + 118, 22, soft(0.78), { align: 'left', weight: 500 });
      ctx.restore();
    });

    if (pages > 1) {
      button(O.prev, 'Prev', { id: 'prev', size: 28, disabled: pg === 0 });
      button(O.next, 'Next', { id: 'next', size: 28, disabled: pg >= pages - 1 });
      text(`Page ${pg + 1} of ${pages}`, (O.prev.x + O.next.x + O.next.w) / 2, O.pageY, 27, soft(0.85), { weight: 600 });
    }
    const bIn = easeBack((sceneT - 0.25) / 0.38);
    if (state.autoPlay) {
      button(O.again, 'Watch Again', { style: 'primary', size: 36, scale: bIn });
      button(O.change, 'Exit to Menu', { size: 32, scale: bIn });
    } else if (RR) {
      button(O.again, RR.pass ? (RR.next === 'check' ? 'Checkpoint' : RR.next === 'stage' ? 'Next stage' : 'Journey map') : 'Try again', { style: 'primary', size: 34, scale: bIn });
      button(O.change, 'Journey map', { size: 30, scale: bIn });
      drawMoreLine(ctx, O.cx, O.moreY, 22);
    } else {
      button(O.again, 'Play Again', { style: 'primary', size: 36, scale: bIn });
      button(O.change, 'Words & pace', { size: 30, scale: bIn });
      drawMoreLine(ctx, O.cx, O.moreY, 22);
    }
  }
}

let lockPress = 0;
// Press feedback for the tappable lockup: a brief dim after a tap (no sound, no popup).
export const pressLockup = () => { lockPress = 10; };

// A small "new badge" toast drawn on top of any screen (called by game.js after render()).
export function drawBadgeToast(ctx, L, toast) {
  const a = Math.min(1, toast.t * 4, (2.4 - toast.t) * 3), w = Math.min(L.w - 40, 560), x = L.w / 2 - w / 2, y = L.h - (L.ins ? L.ins.b : 0) - 290;
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(0, (1 - Math.min(1, toast.t * 4)) * -30);
  ctx.fillStyle = 'rgba(8,24,34,0.94)'; ctx.beginPath(); ctx.roundRect(x, y, w, 76, 22); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.font = `800 30px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(`★  ${toast.text}`, L.w / 2, y + 48, w - 30);
  ctx.restore();
}
