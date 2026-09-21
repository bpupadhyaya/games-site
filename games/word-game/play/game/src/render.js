// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// All motion comes from the state's fixed-step clocks (state.t, state.sceneT, fx.t, round.age).
import { SCHEMES } from './schemes.js';
import {
  W, H, BAND_TOP, BAND_BOTTOM, CHIP_H, PLAQUE, TIME_BAR, REVIEW_TOP, REVIEW_ROW_H, REVIEW_PER_PAGE,
  MODE_SYN_BTN, MODE_ANT_BTN, PLAY_BTN, TITLE_COLOR_BTN, STOP_BTN, COLOR_BTN,
  PREV_BTN, NEXT_BTN, PLAY_AGAIN_BTN, CHANGE_MODE_BTN, slipWidth,
} from './layout.js';

const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const CYAN = '#39d0ea', CYAN_DEEP = '#0e6f8a', GOLD = '#ffd166', GOOD = '#5eea9a', BAD = '#ff7b7b';
const INK = '#10242e';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (f) => 1 - (1 - clamp01(f)) ** 3;
const easeBack = (f) => { const c = clamp01(f) - 1; return 1 + c * c * (2.7 * c + 1.7); };
const mod = (a, n) => ((a % n) + n) % n;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// Faint drifting letterforms and soft lights: [glyph, x0, y, size, speed, tilt]
const GLYPHS = [['a', 80, 420, 420, 9, -0.18], ['W', 560, 300, 300, 14, 0.12], ['g', 380, 900, 520, 7, 0.1], ['e', 700, 1180, 340, 12, -0.1], ['R', 150, 1420, 380, 10, 0.16], ['&', 900, 700, 300, 16, -0.08]];
const MOTES = Array.from({ length: 16 }, (_, i) => ({ x: (i * 397) % 900, y: (i * 613) % H, r: 26 + ((i * 53) % 70), v: 8 + ((i * 29) % 22), a: 0.05 + ((i * 17) % 7) / 100 }));
// Title-screen miniature of the game: [text, y, speed, phase, correct]
const HERO_TARGET = 'lucid';
const HERO = [['clear', 570, 46, 330, true], ['ornate', 676, 62, 740, false], ['murky', 780, 38, 470, false]];

export function render(ctx, state, title, demoLimit) {
  const scheme = SCHEMES[state.scheme], hc = Boolean(scheme.hc), t = state.t, sceneT = state.sceneT;
  const soft = (a) => (hc ? '#ffffff' : hexA(scheme.text, a));
  const accent = hc ? '#ffffff' : CYAN;

  // ---- helpers ------------------------------------------------------------------------------------------
  const text = (str, x, y, size, color, o = {}) => {
    let px = size;
    const font = () => `${o.weight ?? 700} ${px}px ${o.font ?? UI}`;
    ctx.font = font();
    if (o.maxW) { const mw = ctx.measureText(str).width; if (mw > o.maxW) { px = Math.floor((size * o.maxW) / mw); ctx.font = font(); } }
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

  // A crafted button: drop shadow, thick lower lip, gradient face, top highlight, rim.
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
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      if (lit) { g.addColorStop(0, '#7be6f7'); g.addColorStop(0.45, '#22b8d6'); g.addColorStop(1, CYAN_DEEP); }
      else { g.addColorStop(0, 'rgba(120,225,245,0.34)'); g.addColorStop(0.5, 'rgba(60,160,190,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.30)'); }
      if (!lit) { ctx.fillStyle = 'rgba(8,28,38,0.78)'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill(); }
      ctx.fillStyle = g; rr(r.x, r.y, r.w, r.h, rad); ctx.fill();
      const hl = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5);
      hl.addColorStop(0, lit ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; rr(r.x + 5, r.y + 4, r.w - 10, r.h * 0.48, rad - 4); ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(210,250,255,0.9)' : 'rgba(150,232,248,0.55)'; ctx.lineWidth = 2.5; rr(r.x, r.y, r.w, r.h, rad); ctx.stroke();
    }
    const ink = hc ? (lit ? '#000000' : '#ffffff') : lit ? '#04222c' : '#ffffff';
    const size = o.size ?? 32, tx = cx + (o.swatch ? 24 : 0);
    if (o.sub) {
      text(label, tx, cy - 2, size, ink, { maxW: r.w - 40 });
      text(o.sub, tx, cy + 30, 21, ink, { weight: 600, maxW: r.w - 30 });
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
    const w = o.w ?? slipWidth(str), h = (o.h ?? CHIP_H) - 8, s = o.scale ?? 1;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(o.tilt ?? 0); ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (!hc && o.trail) {                                                // motion lines trailing to the right
      for (let k = 0; k < 3; k++) {
        const ly = (k - 1) * 22, len = 50 + k * 22 + 10 * Math.sin(t * 3 + k + y);
        const tg = ctx.createLinearGradient(w / 2, 0, w / 2 + len + 30, 0);
        tg.addColorStop(0, soft(0.32)); tg.addColorStop(1, soft(0));
        ctx.strokeStyle = tg; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(w / 2 + 12, ly); ctx.lineTo(w / 2 + 12 + len, ly); ctx.stroke();
      }
    }
    shadow(-w / 2, -h / 2, w, h, 16, 14);
    if (hc) {
      ctx.fillStyle = '#ffffff'; rr(-w / 2, -h / 2, w, h, 12); ctx.fill();
    } else {
      ctx.fillStyle = '#b9ab88'; rr(-w / 2, -h / 2 + 5, w, h, 16); ctx.fill();                        // paper edge
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#fffdf4'); g.addColorStop(0.6, '#f8f0dc'); g.addColorStop(1, '#eadfc2');
      ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; rr(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 14); ctx.stroke();
      ctx.strokeStyle = 'rgba(16,36,46,0.16)'; ctx.lineWidth = 2;                                      // ruled line
      ctx.beginPath(); ctx.moveTo(-w / 2 + 18, h / 2 - 16); ctx.lineTo(w / 2 - 18, h / 2 - 16); ctx.stroke();
    }
    text(str, 0, 17, 58, hc ? '#000000' : INK, { font: DISPLAY, maxW: w - 30 });
    if (o.tint) { ctx.globalAlpha = (o.alpha ?? 1) * 0.3; ctx.fillStyle = o.tint; rr(-w / 2, -h / 2, w, h, 16); ctx.fill(); }
    ctx.restore();
  };

  // The plaque that carries the target word.
  const plaque = (r, label, word, o = {}) => {
    const cx = r.x + r.w / 2, big = o.wordSize ?? 92;
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
    const k = o.small ? 0.62 : 1;
    try { ctx.letterSpacing = '3px'; } catch { /* older canvases */ }
    text(label, cx, r.y + 58 * k, Math.round(25 * k + 3), hc ? '#ffffff' : '#8fe6f7', { weight: 700 });
    try { ctx.letterSpacing = '0px'; } catch { /* older canvases */ }
    const pop = o.pop ?? 1;
    ctx.save();
    ctx.translate(cx, r.y + r.h * (o.small ? 0.74 : 0.72)); ctx.scale(pop, pop); ctx.globalAlpha = clamp01(pop * 1.4 - 0.4);
    text(word, 0, 0, big, '#ffffff', { font: DISPLAY, maxW: r.w - 60 });
    ctx.restore();
    ctx.restore();
  };

  // ---- backdrop -----------------------------------------------------------------------------------------
  if (hc) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H); } else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, scheme.stops[0]); bg.addColorStop(0.5, scheme.stops[1]); bg.addColorStop(1, scheme.stops[2]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * 0.5, 120, 20, W * 0.5, 120, 900);
    sun.addColorStop(0, 'rgba(255,255,255,0.20)'); sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) {                                                        // slanting shafts of light
      const x = 90 + k * 190 + Math.sin(t * 0.25 + k * 1.9) * 40, wd = 70 + k * 18, a = 0.05 + 0.025 * Math.sin(t * 0.6 + k * 2.3);
      const g = ctx.createLinearGradient(0, 0, 0, 1100);
      g.addColorStop(0, soft(a * 1.8)); g.addColorStop(1, soft(0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + wd, -20); ctx.lineTo(x + wd - 260, 1100); ctx.lineTo(x - 330, 1100); ctx.closePath(); ctx.fill();
    }
    for (let k = 0; k < 26; k++) {                                                       // tiny glints
      const x = mod(k * 277 - t * (5 + (k % 5) * 3), W + 40) - 20, y = (k * 431) % H, tw = 0.5 + 0.5 * Math.sin(t * (1.2 + (k % 4) * 0.5) + k);
      ctx.fillStyle = soft(0.10 + 0.35 * tw); ctx.beginPath(); ctx.arc(x, y, 1.5 + (k % 3), 0, TAU); ctx.fill();
    }
    for (const [ch, x0, y, size, v, tilt] of GLYPHS) {                                    // far layer: huge faint letters
      const x = mod(x0 - t * v, W + 600) - 300;
      ctx.save(); ctx.translate(x, y + Math.sin(t * 0.3 + x0) * 14); ctx.rotate(tilt + Math.sin(t * 0.2 + y) * 0.03);
      text(ch, 0, 0, size, soft(0.05), { font: DISPLAY });
      ctx.restore();
    }
    ctx.lineWidth = 2;                                                                   // middle layer: slow currents
    for (let k = 0; k < 5; k++) {
      const y0 = 260 + k * 270;
      ctx.strokeStyle = soft(0.07); ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 40) { const y = y0 + Math.sin(x * 0.008 + t * (0.5 + k * 0.08) + k * 1.7) * 38; if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (const m of MOTES) {                                                             // near layer: soft lights
      const x = mod(m.x - t * m.v, W + 200) - 100, y = m.y + Math.sin(t * 0.5 + m.x) * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, m.r);
      g.addColorStop(0, soft(m.a * 1.6)); g.addColorStop(0.6, soft(m.a * 0.7)); g.addColorStop(1, soft(0));
      ctx.fillStyle = g; ctx.fillRect(x - m.r, y - m.r, m.r * 2, m.r * 2);
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  const swatch = SCHEMES[state.scheme];

  // ---- title --------------------------------------------------------------------------------------------
  if (state.scene === 'title') {
    const rise = (i) => (1 - enter(i)) * 40;
    ctx.save(); ctx.translate(0, rise(0));
    if (!hc) { ctx.shadowColor = hexA(CYAN, 0.65); ctx.shadowBlur = 34 + Math.sin(t * 1.6) * 10; }
    const tg = ctx.createLinearGradient(0, 160, 0, 270);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, hc ? '#ffffff' : '#a9efff');
    text(title, W / 2, 262, 124, tg, { font: DISPLAY });
    ctx.restore();
    text('Tap the matching word before it drifts away', W / 2, 322 + rise(0), 29, soft(0.85), { weight: 500, maxW: 640 });

    // the game in miniature: a target, and three slips drifting past it
    plaque({ x: 170, y: 376 + rise(1), w: 380, h: 132 }, 'TAP THE SYNONYM OF', HERO_TARGET, { small: true, wordSize: 66 });
    for (const [word, y, v, ph, correct] of HERO) {
      const span = W + 360, x = mod(ph - t * v, span) - 180, beat = correct ? Math.max(0, Math.sin(t * 1.4)) : 0;
      if (correct && !hc && beat > 0) {
        const g = ctx.createRadialGradient(x, y, 20, x, y, 190);
        g.addColorStop(0, hexA(CYAN, 0.42 * beat)); g.addColorStop(1, hexA(CYAN, 0));
        ctx.fillStyle = g; ctx.fillRect(x - 190, y - 190, 380, 380);
      }
      slip(word, x, y + Math.sin(t * 1.1 + ph) * 12, { tilt: Math.sin(t * 0.9 + ph) * 0.035, trail: true, scale: 0.92 + beat * 0.05 });
    }

    const syn = state.selectedMode === 'synonym';
    button(MODE_SYN_BTN, 'Synonym', { id: 'syn', style: syn ? 'active' : undefined, sub: 'same meaning', size: 36, scale: enter(2) });
    button(MODE_ANT_BTN, 'Antonym', { id: 'ant', style: syn ? undefined : 'active', sub: 'opposite meaning', size: 36, scale: enter(3) });

    const bestNow = syn ? state.bestSynonym : state.bestAntonym;
    text(`★  Best ${state.selectedMode} score: ${bestNow}`, W / 2, 1032, 30, hc ? '#ffffff' : GOLD, { weight: 700 });

    const breathe = 1 + Math.sin(t * 2.4) * 0.018;
    if (!hc) {
      const g = ctx.createRadialGradient(W / 2, PLAY_BTN.y + 68, 60, W / 2, PLAY_BTN.y + 68, 360);
      g.addColorStop(0, hexA(CYAN, 0.30 + Math.sin(t * 2.4) * 0.08)); g.addColorStop(1, hexA(CYAN, 0));
      ctx.fillStyle = g; ctx.fillRect(0, PLAY_BTN.y - 200, W, 540);
    }
    button(PLAY_BTN, 'Play', { style: 'primary', size: 58, scale: enter(4) * breathe });
    button(TITLE_COLOR_BTN, `Colours: ${scheme.name}`, { id: 'colour', size: 30, scale: enter(5), swatch });

    if (state.demo) {
      const left = Math.max(0, demoLimit - state.demoSessions);
      text(`Free preview: ${left} session${left === 1 ? '' : 's'} left`, W / 2, 1412, 26, soft(0.85), { weight: 600 });
    }
    text('Graduate-level vocabulary  ·  90-second sessions', W / 2, 1490, 25, soft(0.7), { weight: 500 });
    return;
  }

  if (state.scene === 'demo-limit') {
    plaque({ x: 50, y: 520, w: 620, h: 250 }, 'FREE DEMO FINISHED', 'Thanks for playing', { wordSize: 72 });
    text('Get Word Game on iPhone and Android', W / 2, 860, 31, scheme.text, { weight: 600, maxW: 620 });
    text('for unlimited sessions.', W / 2, 904, 31, scheme.text, { weight: 600 });
    return;
  }

  // ---- play ---------------------------------------------------------------------------------------------
  if (state.scene === 'playing') {
    const fx = state.fx, fxF = fx ? fx.t / 0.8 : 1;
    const secs = Math.max(0, state.timeLeft), frac = secs / 90, low = secs <= 10, mid = secs <= 25;
    const tcol = hc ? '#ffffff' : low ? BAD : mid ? GOLD : '#ffffff';
    const tpulse = low ? 1 + 0.08 * Math.max(0, Math.sin(secs * TAU)) : 1;
    const hudIn = easeOut(sceneT / 0.3);
    ctx.save(); ctx.globalAlpha = hudIn; ctx.translate(0, (1 - hudIn) * -30);

    // clock: digits and a draining bar that reads at a glance
    const tr = { x: 250, y: 66, w: 252, h: 86 };
    if (hc) { ctx.fillStyle = '#000000'; rr(tr.x, tr.y, tr.w, tr.h, 22); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    else { shadow(tr.x, tr.y, tr.w, tr.h, 22, 8); ctx.fillStyle = 'rgba(3,16,24,0.78)'; rr(tr.x, tr.y, tr.w, tr.h, 22); ctx.fill(); ctx.strokeStyle = hexA(low ? BAD : mid ? GOLD : CYAN, 0.85); ctx.lineWidth = 2.5; ctx.stroke(); }
    const kx = tr.x + 48, ky = tr.y + 43;                                   // a small clock whose hand sweeps the session
    ctx.strokeStyle = tcol; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(kx, ky, 19, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.sin((1 - frac) * TAU) * 12, ky - Math.cos((1 - frac) * TAU) * 12); ctx.stroke();
    ctx.save(); ctx.translate(tr.x + 158, tr.y + 43); ctx.scale(tpulse, tpulse);
    text(`${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`, 0, 20, 56, tcol, { weight: 800 });
    ctx.restore();
    const b = TIME_BAR;
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

    // score medallion (right; the top-left corner belongs to the app's Menu button)
    const bump = fx && fx.kind === 'right' ? 1 + 0.35 * (1 - easeOut(fx.t / 0.35)) : 1;
    const sr = { x: 528, y: 66, w: 152, h: 86 };
    if (hc) { ctx.fillStyle = '#000000'; rr(sr.x, sr.y, sr.w, sr.h, 22); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    else { shadow(sr.x, sr.y, sr.w, sr.h, 22, 8); ctx.fillStyle = 'rgba(3,16,24,0.78)'; rr(sr.x, sr.y, sr.w, sr.h, 22); ctx.fill(); ctx.strokeStyle = hexA(GOLD, 0.8); ctx.lineWidth = 2.5; ctx.stroke(); }
    text('SCORE', sr.x + 20, sr.y + 52, 19, hc ? '#ffffff' : hexA(GOLD, 0.95), { align: 'left' });
    ctx.save(); ctx.translate(sr.x + sr.w - 40, sr.y + 46); ctx.scale(bump, bump);
    text(String(state.score), 0, 16, 48, '#ffffff', { weight: 800, maxW: 70 });
    ctx.restore();
    ctx.restore();

    // three lanes the words drift along, with chevrons flowing the way the words go
    for (let k = 0; k < 3; k++) {
      const ly = BAND_TOP + (k + 0.5) * ((BAND_BOTTOM - BAND_TOP) / 3);
      if (hc) continue;
      const lg = ctx.createLinearGradient(0, ly - 110, 0, ly + 110);
      lg.addColorStop(0, soft(0)); lg.addColorStop(0.5, soft(0.075)); lg.addColorStop(1, soft(0));
      ctx.fillStyle = lg; ctx.fillRect(0, ly - 110, W, 220);
      ctx.strokeStyle = soft(0.16); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let c = 0; c < 6; c++) {
        const cx = mod(c * 150 - t * (40 + k * 12), W + 180) - 90, fade = Math.sin((cx / W) * Math.PI);
        ctx.globalAlpha = Math.max(0, fade); ctx.beginPath(); ctx.moveTo(cx + 12, ly - 16); ctx.lineTo(cx, ly); ctx.lineTo(cx + 12, ly + 16); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (state.round) {
      const shake = fx && fx.kind !== 'right' ? Math.sin(fx.t * 58) * 12 * Math.max(0, 1 - fx.t / 0.4) : 0;
      plaque(PLAQUE, `TAP THE ${state.round.mode.toUpperCase()} OF`, state.round.targetWord, { dx: shake, pop: 0.8 + 0.2 * easeBack(state.round.age / 0.28) });
      for (const w of state.round.words) slip(w.text, w.x, w.y, { w: w.w, trail: true, tilt: Math.sin(t * 1.3 + w.slot * 2.1) * 0.03 });
    }

    // feedback for the last answer
    if (fx) {
      if (fx.kind === 'right') {
        const f = easeOut(fx.t / 0.6), a = 1 - clamp01(fx.t / 0.6);
        if (!hc) {
          const gl = ctx.createRadialGradient(fx.x, fx.y, 20, fx.x, fx.y, 260);
          gl.addColorStop(0, hexA(GOOD, 0.5 * a)); gl.addColorStop(1, hexA(GOOD, 0));
          ctx.fillStyle = gl; ctx.fillRect(fx.x - 260, fx.y - 260, 520, 520);
        }
        slip(fx.text, fx.x, fx.y - f * 30, { w: fx.w, scale: 1 + f * 0.25, alpha: a });
        ctx.strokeStyle = hc ? '#ffffff' : hexA(GOOD, a); ctx.lineWidth = 12 * a + 1;
        ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.w / 2 + 20 + f * 90, 50 + f * 70, 0, 0, TAU); ctx.stroke();
        for (let k = 0; k < 16; k++) {
          const ang = k * 2.4, d = 50 + f * (130 + (k % 4) * 34), px = fx.x + Math.cos(ang) * d * 1.4, py = fx.y + Math.sin(ang) * d + f * f * 60;
          ctx.fillStyle = hc ? '#ffffff' : hexA(k % 2 ? GOLD : GOOD, a);
          ctx.beginPath(); ctx.arc(px, py, (5 + (k % 3) * 2) * (1 - f * 0.5), 0, TAU); ctx.fill();
        }
        text('+1', fx.x, fx.y - 70 - f * 80, 64, hc ? '#ffffff' : hexA(GOOD, a), { weight: 800 });
      } else {
        const f = clamp01(fx.t / 0.7), a = 1 - f;
        if (fx.kind === 'wrong') slip(fx.text, fx.x + Math.sin(fx.t * 60) * 10 * a, fx.y + f * f * 260, { w: fx.w, tilt: f * 0.5, alpha: a, tint: hc ? undefined : BAD });
        if (!hc) {
          const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.62);
          g.addColorStop(0, hexA(BAD, 0)); g.addColorStop(1, hexA(BAD, 0.45 * a));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
        // a cross where the answer got away
        const cx = fx.kind === 'miss' ? 64 : fx.x, cy = fx.kind === 'miss' ? fx.y : fx.y - 84, s = 26 * (1 + (1 - easeOut(fx.t / 0.2)) * 0.8);
        ctx.globalAlpha = a; ctx.strokeStyle = hc ? '#ffffff' : BAD; ctx.lineWidth = 11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    const btnIn = easeBack((sceneT - 0.1) / 0.38);
    button(STOP_BTN, 'Stop', { size: 32, scale: btnIn });
    button(COLOR_BTN, 'Colours', { id: 'colour', size: 30, scale: btnIn, swatch });
    return;
  }

  // ---- session review -----------------------------------------------------------------------------------
  if (state.scene === 'gameover') {
    ctx.fillStyle = hc ? '#000000' : 'rgba(2,8,14,0.55)'; ctx.fillRect(0, 0, W, H);
    const head = easeOut(sceneT / 0.4);
    ctx.save(); ctx.globalAlpha = head; ctx.translate(0, (1 - head) * -40);
    text("Time's up!", 410, 128, 76, '#ffffff', { font: DISPLAY });
    text('SESSION REVIEW', 410, 168, 20, hc ? '#ffffff' : '#8fe6f7');

    // summary card: the score counts up, with the tally and best beside it
    const card = { x: 40, y: 188, w: 640, h: 170 };
    if (hc) { ctx.fillStyle = '#000000'; rr(card.x, card.y, card.w, card.h, 26); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
    else {
      shadow(card.x, card.y, card.w, card.h, 26, 14);
      const g = ctx.createLinearGradient(0, card.y, 0, card.y + card.h);
      g.addColorStop(0, 'rgba(12,52,68,0.95)'); g.addColorStop(1, 'rgba(4,18,28,0.95)');
      ctx.fillStyle = g; rr(card.x, card.y, card.w, card.h, 26); ctx.fill();
      ctx.strokeStyle = state.newBest ? GOLD : hexA(CYAN, 0.8); ctx.lineWidth = 3; ctx.stroke();
    }
    const right = state.history.filter((h) => h.correct).length, missed = state.history.length - right;
    const shownScore = Math.round(state.score * easeOut(sceneT / 0.7));
    text('SCORE', card.x + 110, card.y + 46, 21, hc ? '#ffffff' : '#8fe6f7');
    text(String(shownScore), card.x + 110, card.y + 136, 88, '#ffffff', { weight: 800, maxW: 170 });
    ctx.fillStyle = hc ? '#ffffff' : 'rgba(255,255,255,0.18)'; ctx.fillRect(card.x + 222, card.y + 26, 2, card.h - 52);
    text(`${right} right`, card.x + 256, card.y + 66, 32, hc ? '#ffffff' : GOOD, { align: 'left' });
    text(`${missed} missed`, card.x + 446, card.y + 66, 32, hc ? '#ffffff' : BAD, { align: 'left' });
    const bestNow = state.mode === 'synonym' ? state.bestSynonym : state.bestAntonym;
    const bestStr = state.newBest ? `★  New best ${state.mode} score!` : `Best ${state.mode} score: ${bestNow}`;
    const glint = state.newBest && !hc ? 0.75 + 0.25 * Math.sin(t * 5) : 1;
    ctx.globalAlpha = head * glint;
    text(bestStr, card.x + 256, card.y + 124, 28, state.newBest && !hc ? GOLD : soft(0.85), { align: 'left', weight: state.newBest ? 800 : 600, maxW: 360 });
    ctx.restore();

    const rows = state.history.filter((h) => !h.correct).concat(state.history.filter((h) => h.correct));
    if (!rows.length) text('No answers this session.', W / 2, REVIEW_TOP + 120, 30, soft(0.85), { weight: 500 });
    else if (rows.every((h) => h.correct)) text('No mistakes. Every answer was right.', W / 2, REVIEW_TOP - 8, 24, hc ? '#ffffff' : GOOD, { weight: 700 });

    rows.slice(state.reviewPage * REVIEW_PER_PAGE, (state.reviewPage + 1) * REVIEW_PER_PAGE).forEach((h, i) => {
      const inF = easeOut((sceneT - 0.12 - i * 0.05) / 0.35), x = 40 + (1 - inF) * 80, y = REVIEW_TOP + i * REVIEW_ROW_H, rw = W - 80, rh = REVIEW_ROW_H - 12;
      const tone = hc ? '#ffffff' : h.correct ? GOOD : BAD;
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
      ctx.fillStyle = hc ? '#000000' : hexA(h.correct ? GOOD : BAD, 0.18); ctx.beginPath(); ctx.arc(mx, my, 25, 0, TAU); ctx.fill();
      ctx.strokeStyle = tone; ctx.lineWidth = hc ? 3 : 2; ctx.stroke();
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      if (h.correct) { ctx.moveTo(mx - 12, my + 1); ctx.lineTo(mx - 3, my + 10); ctx.lineTo(mx + 13, my - 9); }
      else { ctx.moveTo(mx - 10, my - 10); ctx.lineTo(mx + 10, my + 10); ctx.moveTo(mx + 10, my - 10); ctx.lineTo(mx - 10, my + 10); }
      ctx.stroke();
      text(h.word, x + 92, y + 52, 42, '#ffffff', { font: DISPLAY, align: 'left', maxW: 380 });
      text(h.mode.toUpperCase(), x + rw - 22, y + 40, 18, soft(0.7), { align: 'right' });
      const you = h.correct ? '' : h.picked === null ? 'drifted past' : `You: ${h.picked}`;
      text(`Answer: ${h.answer}`, x + 92, y + 88, 26, accent, { align: 'left', weight: 700, maxW: you ? 300 : 520 });
      if (you) text(you, x + rw - 22, y + 88, 25, tone, { align: 'right', weight: 600, maxW: 220 });
      text(clip(h.meaning, 22, rw - 116), x + 92, y + 118, 22, soft(0.78), { align: 'left', weight: 500 });
      ctx.restore();
    });

    const pages = Math.max(1, Math.ceil(state.history.length / REVIEW_PER_PAGE));
    if (pages > 1) {
      button(PREV_BTN, 'Prev', { id: 'prev', size: 28, disabled: state.reviewPage === 0 });
      button(NEXT_BTN, 'Next', { id: 'next', size: 28, disabled: state.reviewPage >= pages - 1 });
      text(`Page ${state.reviewPage + 1} of ${pages}`, W / 2, PREV_BTN.y + 52, 27, soft(0.85), { weight: 600 });
    }
    const bIn = easeBack((sceneT - 0.25) / 0.38);
    button(PLAY_AGAIN_BTN, 'Play Again', { style: 'primary', size: 36, scale: bIn });
    button(CHANGE_MODE_BTN, 'Change Mode', { size: 32, scale: bIn });
  }
}
