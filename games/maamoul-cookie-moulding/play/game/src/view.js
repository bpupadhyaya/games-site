// Maamoul Cookie Moulding: all screens are drawn here from the game state `S` (render only; nothing here mutates the simulation).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, shiftRects, bookRects, overLayout, pauseLayout, centerCard, TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { T, UI, NUM, DISP, txt, para, paraHeight, panel, button, rr, clamp, F, icons, mix, slab } from './ui.js';
import { v3, withClip } from './v3.js';
import { drawWall, drawBench, drawCookie, drawMould, drawDough, drawTray, drawPeel, drawOven, drawGauge, trayGeo, drawGhost, PATTERNS, UNLOCK, TYPE_DOT, FILL_COL, bakeColor } from './art.js';
import { DOCS, FACTS } from './content.js';
import { drawCredit, drawMoreLine } from './brand.js';
import { K, TYPES, BAKERIES, SHIFTS_PER_BAKERY, TOTAL_SHIFTS, makingTray, readyTray, emptyCount, bakeLevel, bakeName, needlePos, placeableSlots } from './engine.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'sound', label: 'Sound', desc: 'Thumps, pats, chimes and the oven bell.', opts: ['On', 'Off'] },
  { id: 'assist', label: 'Easy seal', desc: 'Seal the dough with one tap instead of tracing the rim.', opts: ['Off', 'On'] },
  { id: 'guide', label: 'Fill ring', desc: 'The dashed ring that marks the right amount of filling.', opts: ['Show', 'Hide'] },
  { id: 'calm', label: 'Calm oven', desc: 'Bakes a quarter slower: more time to reach the pull.', opts: ['Off', 'On'] },
  { id: 'think', label: 'Think time', desc: 'How long Watch and Learn thinks before it acts.', opts: THINK_STEPS.map((s) => `${s}s`) },
  { id: 'restore', label: 'Purchases', desc: 'Restore the full game if you bought it before.', opts: ['Restore'] },
];
// Rows shown in Settings: Restore purchase is hidden in the web demo; its button reflects owned / busy state and the last result.
export const settingsRows = (s) => SETTINGS.filter((r) => r.id !== 'restore' || !s.demo).map((r) => {
  if (r.id !== 'restore') return r;
  const o = s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase';
  return { ...r, desc: s.restoreMsg || r.desc, opts: [o] };
});
export const settingValue = (s, id) => {
  if (id === 'restore') return s.owned ? 0 : -1;
  if (id === 'sound') return s.prefs.sound ? 0 : 1;
  if (id === 'assist') return s.prefs.assist ? 1 : 0;
  if (id === 'guide') return s.prefs.guide ? 0 : 1;
  if (id === 'calm') return s.prefs.calm ? 1 : 0;
  if (id === 'think') return s.prefs.thinkIdx;
  return -1;
};
export const unlocked = (stars, type, idx) => stars >= UNLOCK[type][idx];
export const totalStars = (s) => Object.values(s.progress).reduce((a, p) => a + (p.stars | 0), 0);

const flashK = (s, id) => (s.flash && s.flash.id === id ? 1 - s.flash.t / 0.25 : 0);
const TAU = Math.PI * 2;
const patOf = (s, type) => clamp(s.prefs.pat[type] | 0, 0, 2);
const fmtTime = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
export const lockedAt = (type, idx) => UNLOCK[type][idx];

export function render(ctx, s, view) {
  const w = view.width, h = view.height, sc = s.scene;
  ctx.clearRect(0, 0, w, h);
  v3.items.length = 0; v3.layer = 0; v3.scrim = 0; v3.clip = null; v3.base = ctx.getTransform(); v3.heat = 0;
  if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'shifts') drawShifts(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'book') drawBook(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  else drawWall(ctx, 0, 0, w, h, s.t);
}

// ---- play ----------------------------------------------------------------------------------------------------------------------------
export const traysShown = (sim) => { const m = makingTray(sim); return m >= 0 ? m : Math.max(0, sim.trays.length - 1); };

function typeCounts(sim) {
  const ti = makingTray(sim);
  const out = {};
  for (const t of sim.spec.types) out[t] = ti >= 0 ? emptyCount(sim.trays[ti], t) : 0;
  return out;
}

function rackButton(ctx, s, r, id, active, flash, pulse, count, disabled) {
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;
  slab(ctx, r, { radius: 16, kind: 'tile', on: active, flash, dim: disabled });
  if (pulse) { ctx.strokeStyle = `rgba(143,224,160,${0.5 + 0.4 * Math.sin(s.t * 8)})`; ctx.lineWidth = 4; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 18); ctx.stroke(); }
  const cx = r.x + r.w / 2, iy = r.y + r.h * 0.42, isz = Math.min(r.h * 0.5, r.w * 0.5);
  let label = '';
  if (id === 'hint') { icons.bulb(ctx, cx, iy, isz, '#ffd45a'); label = 'Think'; }
  else {
    drawMould(ctx, cx, iy + 2, isz * 0.5, id, patOf(s, id), { handle: false });
    label = TYPES[id].name;
  }
  txt(ctx, label, cx, r.y + r.h - Math.max(13, r.h * 0.18), { size: F(19), weight: 600, color: active ? T.accent : T.dim, align: 'center', maxW: r.w - 8 });
  if (id !== 'hint' && count != null) {
    const bx = r.x + r.w - 18, by = r.y + 18;
    slab(ctx, { x: bx - 15, y: by - 15, w: 30, h: 30 }, { radius: 15, kind: count > 0 ? 'gold' : 'dark', fill: count > 0 ? T.accent : 'rgba(255,255,255,0.18)', line: 'rgba(0,0,0,0)' });
    txt(ctx, String(count), bx, by + 1, { size: F(19), weight: 700, color: count > 0 ? T.onAccent : T.dim, align: 'center', fam: NUM });
  }
  ctx.restore();
}

function drawFx(ctx, s) {
  for (const p of s.fx.parts) { const a = clamp(1 - p.t / p.life, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const f of s.fx.floats) {
    const a = clamp(1 - f.t / f.life, 0, 1), y = f.y - f.t * 46;
    ctx.globalAlpha = Math.min(1, a * 2);
    txt(ctx, f.text, f.x, y, { size: f.size, weight: 700, color: f.color, align: 'center', fam: NUM, shadow: true });
  }
  ctx.globalAlpha = 1;
}

function coachText(s) {
  if (s.auto.on) {
    const h = s.hint;
    if (s.auto.done) return { a: 'Shift complete. Nicely baked.', b: 'Press Exit to go back.' };
    if (!h) return { a: 'Watching the bench...', b: 'The game is deciding what needs doing first.' };
    return { a: h.text, b: s.auto.phase === 'think' ? `Thinking... ${Math.ceil(s.auto.timer)}s` : h.why };
  }
  if (s.hint) return { a: s.hint.text, b: s.hint.why };
  return null;
}
function defaultBanner(s) {
  const sim = s.sim, h = sim.hand;
  if (!h) {
    const ri = readyTray(sim);
    if (ri >= 0 && sim.oven.tray < 0) return 'Tray full. Tap Load oven.';
    if (makingTray(sim) < 0) return sim.oven.tray >= 0 ? 'All trays are in. Wait for pale gold, then pull.' : 'Nothing left to make.';
    const c = typeCounts(sim);
    return 'Pick a mould: ' + sim.spec.types.filter((t) => c[t] > 0).map((t) => `${c[t]} ${TYPES[t].name.toLowerCase()}`).join(', ') + ' to go.';
  }
  if (h.st === 'fill') return 'Tap the bench when the filling reaches the dashed ring.';
  if (h.st === 'seal') return s.prefs.assist ? 'Tap the dough to seal it.' : 'Drag a finger once round the rim to seal.';
  if (h.st === 'knock') return 'Tap as each ring closes on the mould.';
  return 'Tap a glowing slot on the tray.';
}

function drawBanner(ctx, s, L) {
  const b = L.banner;
  let line = null, sub = '', col = T.dim;
  const c = coachText(s);
  if (s.msg) { line = s.msg.text; col = T.accent; }
  else if (c) { line = c.a; sub = c.b; col = '#ffd45a'; }
  else line = defaultBanner(s);
  slab(ctx, b, { radius: 16, kind: 'dark', on: false, line: s.auto.on || s.hint ? 'rgba(255,212,90,0.5)' : T.line });
  const pad = 14, tw = b.w - 2 * pad;
  if (sub) {
    txt(ctx, line, b.x + pad, b.y + b.h * 0.34, { size: F(24), weight: 700, color: col, maxW: tw });
    txt(ctx, sub, b.x + pad, b.y + b.h * 0.74, { size: F(19), weight: 500, color: T.dim, maxW: tw });
  } else txt(ctx, line, b.x + pad, b.y + b.h / 2, { size: F(23), weight: 600, color: col, maxW: tw });
}

function drawHud(ctx, s, L, spec) {
  const sim = s.sim, tt = L.hud;
  txt(ctx, spec.name, tt.x, tt.y + 22, { size: F(32), weight: 700, color: T.text, fam: DISP, maxW: tt.w, shadow: true });
  const score = sim.score.toLocaleString('en-US');
  txt(ctx, score, tt.x, tt.y + 56, { size: F(30), weight: 700, color: T.accent, fam: NUM });
  ctx.font = `700 ${F(30)}px ${NUM}`;
  const x = tt.x + ctx.measureText(score).width + 16;
  const left = spec.endless ? sim.rushLeft : Math.max(0, spec.limit - sim.t);
  txt(ctx, fmtTime(left), x, tt.y + 56, { size: F(24), weight: 600, color: left < 15 ? T.bad : T.dim, fam: NUM });
  if (sim.streak >= 2) txt(ctx, `Row x${sim.streak}`, x + 90, tt.y + 56, { size: F(22), weight: 600, color: '#ffd45a', maxW: Math.max(40, tt.x + tt.w - x - 92) });
  if (!s.auto.on) {
    const r = L.pause;
    slab(ctx, r, { radius: 18, kind: 'tile' });
    icons.pause(ctx, r.x + r.w / 2, r.y + r.h / 2, 38, T.text);
  }
}

function drawBenchScene(ctx, s, L) {
  const sim = s.sim, spec = sim.spec, h = sim.hand, d = L.dough, bench = L.bench;
  drawBench(ctx, bench);
  ctx.save(); rr(ctx, bench.x, bench.y, bench.w, bench.h, 26); ctx.clip();
  const pulse = s.hint && s.hint.action && ['fill', 'seal', 'knock'].includes(s.hint.action.kind);
  if (!h) {
    const bob = Math.sin(s.t * 2) * 2;
    drawDough(ctx, d.cx, d.cy + bob, d.R * 0.8, { st: 'rest', seal: 0, type: 'date' });
  } else if (h.st === 'fill') {
    drawDough(ctx, d.cx, d.cy, d.R, { st: 'fill', type: h.type, amount: needlePos(h), target: s.prefs.guide || s.auto.on || s.hint ? h.target : -1, band: spec.band, t: s.t });
    if (pulse || s.auto.on) { ctx.strokeStyle = `rgba(255,214,110,${0.45 + 0.3 * Math.sin(s.t * 8)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(d.cx, d.cy, d.R * 1.1, 0, TAU); ctx.stroke(); }
    scaleBar(ctx, s, L, h);
  } else if (h.st === 'seal') {
    const bins = sealBins(s, h);
    drawDough(ctx, d.cx, d.cy, d.R, { st: 'seal', type: h.type, seal: h.seal.prog, bins, t: s.t });
    ctx.save(); ctx.setLineDash([10, 9]); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(s.t * 5)})`;
    ctx.beginPath(); ctx.arc(d.cx, d.cy, d.R * 1.03, 0, TAU); ctx.stroke(); ctx.restore();
    if (s.trace && s.trace.active) { ctx.fillStyle = 'rgba(255,248,232,0.8)'; ctx.beginPath(); ctx.arc(s.trace.x, s.trace.y, d.R * 0.11, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(80,50,10,0.5)'; ctx.stroke(); }
    else if (s.prefs.assist) txt(ctx, 'TAP', d.cx, d.cy, { size: F(34), weight: 700, color: T.ink, align: 'center', fam: NUM });
    const pr = clamp(h.seal.prog, 0, 1);
    txt(ctx, `${Math.round(pr * 100)}%`, d.cx, Math.min(d.cy + d.R * 1.3, L.bench.y + L.bench.h - 22), { size: F(24), weight: 700, color: T.cream, align: 'center', fam: NUM, shadow: true });
  } else if (h.st === 'knock') {
    const k = h.knock, tempo = spec.tempo;
    let near = 99;
    for (const b of k.beats) near = Math.min(near, Math.abs(k.tk - b.at));
    const lift = clamp(near / (tempo * 0.5), 0, 1) * d.R * 0.2, shake = s.knockShake > 0 ? Math.sin(s.t * 70) * s.knockShake * 6 : 0;
    drawMould(ctx, d.cx, d.cy, d.R * 0.95, h.type, patOf(s, h.type), { lift, shake });
    // closing rings
    const rim = d.R * 1.03;
    k.beats.forEach((b, i) => {
      const dt = b.at - k.tk;
      if (b.q >= 0) {
        const a = clamp(1 - (k.tk - (b.hitAt ?? b.at)) / 0.5, 0, 1);
        if (a > 0) { ctx.strokeStyle = b.q > 0.8 ? `rgba(143,224,160,${a})` : `rgba(255,212,90,${a})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(d.cx, d.cy, rim * (1 + (1 - a) * 0.25), 0, TAU); ctx.stroke(); }
        return;
      }
      if (dt > 1.1 || dt < -K.KNOCK_TOL) return;
      const rr0 = rim * (1 + Math.max(0, dt) * 0.85), a = clamp(1.2 - Math.max(0, dt), 0.2, 1);
      const hot = Math.abs(dt) <= K.KNOCK_CLEAN;
      ctx.lineWidth = hot ? 9 : 6; ctx.strokeStyle = hot ? `rgba(143,224,160,${a})` : `rgba(255,236,190,${a})`;
      ctx.beginPath(); ctx.arc(d.cx, d.cy, rr0, 0, TAU); ctx.stroke();
      void i;
    });
    // three beat pips
    k.beats.forEach((b, i) => {
      const px = d.cx + (i - 1) * 46, py = d.cy - d.R * 1.5;
      ctx.fillStyle = b.q < 0 ? 'rgba(255,255,255,0.25)' : b.q > 0.8 ? T.good : b.q > 0.4 ? '#ffd45a' : T.bad;
      ctx.beginPath(); ctx.arc(px, py, 13, 0, TAU); ctx.fill();
    });
  } else if (h.st === 'place') {
    const bob = Math.sin(s.t * 3) * 3;
    drawPeel(ctx, d.cx, d.cy, d.R * 0.95);
    drawCookie(ctx, d.cx, d.cy + bob, d.R * 0.78, { type: h.type, pat: patOf(s, h.type), b: 0.12, clarity: 0.35 + 0.65 * h.q, lift: 0.6 });
    txt(ctx, `${gradeWord(h.q)} ${Math.round(h.q * 100)}%`, d.cx, Math.min(d.cy + d.R * 1.3, L.bench.y + L.bench.h - 24), { size: F(28), weight: 700, color: T.cream, align: 'center', fam: NUM, shadow: true });
  }
  ctx.restore();
}
const gradeWord = (q) => (q >= 0.95 ? 'Flawless' : q >= K.PERFECT ? 'Perfect' : q >= 0.7 ? 'Good' : q >= 0.45 ? 'Fair' : 'Rough');

function sealBins(s, h) {
  const n = 36;
  if (h.auto && h.auto.kind === 'seal') { const k = Math.floor(clamp(h.seal.prog, 0, 1) * n); return Array.from({ length: n }, (_, i) => (i < k ? h.auto.q : -1)); }
  if (s.trace && s.trace.bins) return s.trace.bins;
  return null;
}

// a thin scale under the cup: the same amount, as a bar, for players who prefer a gauge
function scaleBar(ctx, s, L, h) {
  const d = L.dough, w = Math.min(L.bench.w * 0.72, d.R * 2.4), x = d.cx - w / 2, y = Math.min(d.cy + d.R * 1.25, L.bench.y + L.bench.h - 30), hh = 16;
  rr(ctx, x, y, w, hh, hh / 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const spec = s.sim.spec;
  if (s.prefs.guide || s.auto.on || s.hint) {
    const a = clamp(h.target - spec.band, 0, 1), b = clamp(h.target + spec.band, 0, 1);
    ctx.fillStyle = 'rgba(255,214,110,0.5)'; ctx.fillRect(x + a * w, y, (b - a) * w, hh);
    ctx.fillStyle = '#8fe0a0'; const c0 = clamp(h.target - spec.band * K.BAND_CORE, 0, 1), c1 = clamp(h.target + spec.band * K.BAND_CORE, 0, 1); ctx.fillRect(x + c0 * w, y, Math.max(2, (c1 - c0) * w), hh);
  }
  const px = x + needlePos(h) * w;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, y + hh / 2, hh * 0.8, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
}

function drawOvenStrip(ctx, s, L) {
  const sim = s.sim, ti = sim.oven.tray, b = bakeLevel(sim), busy = ti >= 0, ri = readyTray(sim);
  const pats = s.prefs.pat;
  const hint = s.hint && s.hint.action ? s.hint.action.kind : null;
  drawOven(ctx, L.oven, busy ? sim.trays[ti] : null, b, s.t, { pats, hot: busy && b >= K.WIN0 && b <= K.WIN1 });
  const name = busy ? `Oven: ${bakeName(b)}` : ri >= 0 ? 'Oven free: tray ready' : 'Oven empty';
  txt(ctx, name, L.ovenLabel.x, L.ovenLabel.y + 12, { size: F(21), weight: 600, color: busy && b >= K.WIN0 && b <= K.WIN1 ? T.good : T.dim, maxW: L.ovenLabel.w });
  v3.heat = busy ? 1 : 0;
  drawGauge(ctx, L.gauge, b, { active: busy, pulse: hint === 'pull' ? s.t : 0 });
  const r = L.ovenBtn;
  if (busy) button(ctx, r, 'Pull tray', { kind: b >= K.WIN0 && b <= K.WIN1 ? 'accent' : 'solid', size: 28, flash: flashK(s, 'oven') });
  else button(ctx, r, 'Load oven', { kind: ri >= 0 ? 'accent' : 'solid', disabled: ri < 0, size: 28, flash: flashK(s, 'oven') });
  if (hint === 'oven' || hint === 'pull') { ctx.save(); ctx.strokeStyle = `rgba(143,224,160,${0.5 + 0.4 * Math.sin(s.t * 8)})`; ctx.lineWidth = 4; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.stroke(); ctx.restore(); }
}

function trayCaption(ctx, s, L) {
  const sim = s.sim, spec = sim.spec, i = traysShown(sim), tr = sim.trays[i], r = L.trayLabel;
  const done = tr.slots.filter((x) => x.st !== 'empty').length;
  const state = tr.st === 'done' ? 'baked' : tr.st === 'oven' ? 'in the oven' : tr.st === 'ready' ? 'ready' : `${done} of ${tr.slots.length}`;
  const label = spec.endless ? `Tray ${i + 1}: ${state}` : `Tray ${i + 1} of ${spec.trays}: ${state}`;
  txt(ctx, label, r.x + 4, r.y + r.h / 2 + 2, { size: F(21), weight: 600, color: T.dim, maxW: r.w * 0.6 });
  if (!spec.endless) {
    const n = spec.trays, sz = 14, gap = 6, total = n * sz + (n - 1) * gap;
    for (let k = 0; k < n; k++) {
      const st = sim.trays[k].st, x = r.x + r.w - total + k * (sz + gap) + sz / 2, y = r.y + r.h / 2 + 2;
      ctx.fillStyle = st === 'done' ? T.good : st === 'oven' ? '#ffb24a' : st === 'ready' ? '#ffd45a' : k === i ? T.cream : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, TAU); ctx.fill();
    }
  }
}

function drawPlay(ctx, s, w, h) {
  const sim = s.sim, spec = sim.spec;
  const L = playLayout(w, h, { cols: spec.cols, rows: spec.rows, types: spec.types, auto: s.auto.on });
  drawWall(ctx, 0, 0, w, h, s.t);
  drawHud(ctx, s, L, spec);
  trayCaption(ctx, s, L);
  // the tray being filled
  const ti = traysShown(sim), tr = sim.trays[ti];
  const hand = sim.hand;
  const glow = new Set();
  if (hand && hand.st === 'place') for (const i of placeableSlots(sim)) glow.add(i);
  const tbE = tr.st === 'done' ? tr.bakeB : null;
  const geo = drawTray(ctx, L.tray, tr, { b: tbE, pats: s.prefs.pat, glow, t: s.t, dust: true });
  if (hand && hand.st === 'place' && s.kbd) { const c = geo.cell(s.cursor % tr.slots.length); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rr(ctx, c.cx - c.cw * 0.46, c.cy - c.ch * 0.46, c.cw * 0.92, c.ch * 0.92, 12); ctx.stroke(); }
  drawOvenStrip(ctx, s, L);
  drawBanner(ctx, s, L);
  drawBenchScene(ctx, s, L);
  // rack or the Watch and Learn rail
  if (s.auto.on) drawRail(ctx, s, L);
  else {
    const counts = typeCounts(sim), pulse = s.hint && s.hint.action && s.hint.action.kind === 'choose' ? s.hint.action.type : (s.hint ? 'hint' : null);
    for (const id of L.ids) {
      if (id === 'hint') rackButton(ctx, s, L.rack[id], id, !!s.hint, flashK(s, 'rack:' + id), false, null, false);
      else rackButton(ctx, s, L.rack[id], id, !!(hand && hand.type === id), flashK(s, 'rack:' + id), pulse === id, counts[id], counts[id] === 0 || !!(hand && hand.st !== 'fill'));
    }
  }
  drawFx(ctx, s);
  if (s.paused) drawPaused(ctx, s, L, w, h);
  if (sim.done && s.endT < 1.8) drawEndBanner(ctx, s, w, h);
  void geo;
}

function drawEndBanner(ctx, s, w, h) {
  const o = s.sim.outcome, a = clamp(s.endT / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  const word = o.why === 'closed' ? 'Closing time' : o.why === 'time' ? "Time's up" : 'All baked';
  const c = centerCard(w, h, 560, 150);
  v3.layer = 1;
  slab(ctx, c, { radius: 24, kind: 'dark', on: true, fill: 'rgba(8,24,26,0.86)', line: T.accent });
  txt(ctx, word, c.x + c.w / 2, c.y + c.h / 2, { size: F(70), weight: 700, color: T.accent, align: 'center', fam: DISP, maxW: c.w - 30 });
  ctx.restore();
}

function drawRail(ctx, s, L) {
  const r = L.rail, a = s.auto;
  button(ctx, r.exit, 'Exit', { icon: 'exit', size: 24, flash: flashK(s, 'aexit') });
  button(ctx, r.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', size: 24, kind: a.paused ? 'accent' : 'solid', flash: flashK(s, 'apause') });
  button(ctx, r.dec, 'Think -', { size: 22, disabled: s.prefs.thinkIdx === 0, flash: flashK(s, 'adec'), sub: `${THINK_STEPS[s.prefs.thinkIdx]}s` });
  button(ctx, r.inc, 'Think +', { size: 22, disabled: s.prefs.thinkIdx === THINK_STEPS.length - 1, flash: flashK(s, 'ainc'), sub: `${THINK_STEPS[s.prefs.thinkIdx]}s` });
}

function drawPaused(ctx, s, L, w, h) {
  const P = pauseLayout(w, h, { x: L.U.x0, y: L.U.y0, w: L.U.w, h: L.U.h });
  if (v3.on) {
    // 3D scrim under the card; the 2D canvas dims the text of the screen below with a hole where the card sits
    v3.scrim = 0.74;
    ctx.save(); ctx.fillStyle = 'rgba(4,16,18,0.74)'; ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.roundRect(P.card.x, P.card.y, P.card.w, P.card.h, 24); ctx.fill('evenodd'); ctx.restore();
    v3.layer = 1;
  } else { ctx.fillStyle = 'rgba(4,16,18,0.74)'; ctx.fillRect(0, 0, w, h); }
  panel(ctx, P.card, { radius: 24, fill: '#0f3235', line: T.line });
  txt(ctx, 'Paused', P.card.x + P.card.w / 2, P.card.y + 38, { size: F(52), weight: 700, align: 'center', fam: DISP });
  button(ctx, P.resume, 'Resume', { kind: 'accent', icon: 'play', flash: flashK(s, 'resume') });
  button(ctx, P.restart, 'Restart shift', { flash: flashK(s, 'restart') });
  button(ctx, P.settings, 'Settings', { icon: 'gear', flash: flashK(s, 'psettings') });
  button(ctx, P.menu, 'Leave shift', { flash: flashK(s, 'pmenu') });
}

// ---- headers and scrolling body ----------------------------------------------------------------------------------------------------------
function header(ctx, s, P, title, sub = '') {
  txt(ctx, title, P.titleX, P.header.y + (sub ? 26 : 35), { size: F(46), weight: 700, fam: DISP, maxW: P.textDec.x - P.titleX - 12, shadow: true });
  if (sub) txt(ctx, sub, P.titleX, P.header.y + 58, { size: F(21), weight: 500, color: T.dim, maxW: P.textDec.x - P.titleX - 12 });
}
function zoomButtons(ctx, s, P) {
  const sc = TEXT_SCALES[s.prefs.textIdx];
  button(ctx, P.textDec, 'A-', { size: 26, disabled: s.prefs.textIdx === 0, flash: flashK(s, 'tdec') });
  button(ctx, P.textInc, 'A+', { size: 26, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashK(s, 'tinc') });
  txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 8, P.textDec.y + P.textDec.h / 2, { size: F(20), weight: 600, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x - 4, rect.y, rect.w + 8, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  const contentH = withClip({ x: rect.x - 4, y: rect.y, w: rect.w + 8, h: rect.h }, draw);
  ctx.restore();
  metrics.rect = rect; metrics.view = rect.h; metrics.max = Math.max(0, contentH - rect.h + 10);
  if (metrics.max > 0) {
    const th = Math.max(36, rect.h * rect.h / (contentH + 10)), ty = rect.y + (rect.h - th) * (s.scrollY / metrics.max);
    rr(ctx, rect.x + rect.w + 2, ty, 4, th, 2); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  }
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function heroScene(ctx, rect, t, s) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const bw = Math.min(rect.w, rect.h * 2.2), bh = Math.min(rect.h, bw * 0.62);
  const b = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
  drawBench(ctx, b);
  const r = Math.min(bw * 0.15, bh * 0.3);
  const ids = ['date', 'walnut', 'pistachio'], ph = Math.floor(t / 2.6);
  ids.forEach((id, i) => {
    const x = b.x + b.w * (0.2 + i * 0.3), y = b.y + b.h * 0.64 + Math.sin(t * 1.6 + i) * 2;
    drawCookie(ctx, x, y, r, { type: id, pat: (ph + i) % 3, b: 0.89, dust: true });
  });
  drawMould(ctx, b.x + b.w * 0.5, b.y + b.h * 0.26, r * 0.62, 'walnut', (ph + 1) % 3, { lift: Math.max(0, Math.sin(t * 1.6)) * 5, handle: false });
  void s;
}
function drawTitle(ctx, s, w, h) {
  const T0 = titleLayout(w, h);
  drawWall(ctx, 0, 0, w, h, s.t);
  const H = T0.hero, cx = H.x + H.w / 2, big = clamp(Math.min(H.w * 0.22, H.h * 0.28), 54, 150);
  const ty = H.y + big * 0.58 + (host.back ? 6 : 0) + 18;
  ctx.save();
  ctx.font = `700 ${big}px ${DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = Math.min(H.w - 20, ctx.measureText('Maamoul').width);
  const g = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  g.addColorStop(0, '#ffe3a0'); g.addColorStop(0.5, '#f2b640'); g.addColorStop(1, '#e98a3c');
  // embossed gold lettering: soft drop shadow, a stack of darker copies for the thickness, then the lit face with a bevel line
  const dep = Math.max(4, Math.round(big * 0.07));
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = big * 0.12; ctx.shadowOffsetY = dep + 4;
  ctx.fillStyle = '#5a360c'; ctx.fillText('Maamoul', cx, ty + dep, H.w - 20);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  for (let k = dep - 1; k >= 1; k--) { ctx.fillStyle = k % 2 ? '#7a4a14' : '#8a5718'; ctx.fillText('Maamoul', cx, ty + k, H.w - 20); }
  ctx.fillStyle = g; ctx.fillText('Maamoul', cx, ty, H.w - 20);
  ctx.lineWidth = Math.max(1.5, big * 0.014); ctx.strokeStyle = 'rgba(255,250,225,0.75)'; ctx.strokeText('Maamoul', cx, ty - 1, H.w - 20);
  ctx.restore();
  { const fs = big * 0.3, sub = 'COOKIE MOULDING';
    ctx.save(); ctx.font = `700 ${fs}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sw = Math.min(H.w - 20, ctx.measureText(sub).width);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(sub, cx, ty + big * 0.62 + 5, sw);
    ctx.fillStyle = '#7a4a14'; ctx.fillText(sub, cx, ty + big * 0.62 + 2.5, sw);
    ctx.fillStyle = T.cream; ctx.fillText(sub, cx, ty + big * 0.62, sw);
    ctx.restore(); }
  const sceneTop = ty + big * 0.62 + big * 0.28;
  heroScene(ctx, { x: H.x, y: sceneTop, w: H.w, h: Math.max(90, H.y + H.h - sceneTop) }, s.t, s);
  const B = T0.buttons;
  const best = s.stats.rush ? `Best ${s.stats.rush.toLocaleString('en-US')}` : '90 seconds, score only';
  const done = totalStars(s);
  button(ctx, B.journey, 'Journey', { kind: 'accent', size: 36, sub: T0.subs ? `${TOTAL_SHIFTS} shifts, ${done} of ${TOTAL_SHIFTS * 3} stars` : '', flash: flashK(s, 'journey') });
  button(ctx, B.rush, 'Rush Hour', { size: 32, sub: T0.subs ? best : '', flash: flashK(s, 'rush') });
  button(ctx, B.daily, 'Daily Shift', { size: 32, sub: T0.subs ? (s.dailyDone ? `Done today. Streak ${s.streak}` : s.streak ? `Streak ${s.streak}: keep it going` : 'A new shift every day') : '', flash: flashK(s, 'daily') });
  button(ctx, B.learn, 'Watch and Learn', { size: 30, icon: 'eye', sub: T0.subs ? 'The game bakes and explains' : '', flash: flashK(s, 'learn') });
  button(ctx, B.howto, 'How to Play', { size: 24, flash: flashK(s, 'howto') });
  button(ctx, B.rules, 'Rules', { size: 24, flash: flashK(s, 'rules') });
  button(ctx, B.book, 'Pattern Book', { size: 24, icon: 'book', flash: flashK(s, 'book') });
  button(ctx, B.about, 'About', { size: 24, flash: flashK(s, 'about') });
  button(ctx, B.settings, 'Settings', { size: 24, flash: flashK(s, 'settings') });
  button(ctx, B.share, 'Share', { size: 24, flash: flashK(s, 'share') });
  drawCredit(ctx, T0.brand.x, T0.brand.y, 15);
  if (s.msg) drawToast(ctx, s, w, h);
}
function drawToast(ctx, s, w, h) {
  const t = s.msg.text, y = h - 120;
  ctx.font = `600 24px ${UI}`; const tw = Math.min(w - 40, ctx.measureText(t).width + 40);
  v3.layer = 1;
  slab(ctx, { x: w / 2 - tw / 2, y, w: tw, h: 52 }, { radius: 26, kind: 'dark', fill: 'rgba(0,0,0,0.78)', line: 'rgba(0,0,0,0)' });
  txt(ctx, t, w / 2, y + 26, { size: 24, weight: 600, color: T.text, align: 'center', maxW: tw - 30 });
}

// ---- shift map ----------------------------------------------------------------------------------------------------------------------------
export function shiftIndex(ci, i) { return ci * SHIFTS_PER_BAKERY + i; }
function drawShifts(ctx, s, w, h) {
  const P = listLayout(w, h), sc = TEXT_SCALES[s.prefs.textIdx];
  drawWall(ctx, 0, 0, w, h, s.t);
  header(ctx, s, P, 'Choose a shift', `${totalStars(s)} of ${TOTAL_SHIFTS * 3} stars`);
  zoomButtons(ctx, s, P);
  scrollBody(ctx, s, P.body, () => {
    const J = shiftRects(P.body, sc);
    J.items.forEach((it) => {
      const bk = BAKERIES[it.ci];
      const stars = Array.from({ length: SHIFTS_PER_BAKERY }, (_, i) => s.progress[shiftIndex(it.ci, i)]?.stars | 0).reduce((a, b) => a + b, 0);
      panel(ctx, it.head, { radius: 18, fill: 'rgba(242,182,64,0.16)', line: 'rgba(242,182,64,0.5)' });
      txt(ctx, bk.name, it.head.x + 18, it.head.y + it.head.h * 0.36, { size: F(38 * Math.min(sc, 1.5)), weight: 700, fam: DISP, maxW: it.head.w - 140 * Math.min(sc, 1.4) });
      para(ctx, bk.blurb, it.head.x + 18, it.head.y + it.head.h * 0.58, it.head.w - 36, { size: F(20 * Math.min(sc, 1.5)), weight: 500, color: T.dim });
      txt(ctx, `${stars}/${SHIFTS_PER_BAKERY * 3}`, it.head.x + it.head.w - 18, it.head.y + it.head.h * 0.36, { size: F(26), weight: 700, color: T.accent, align: 'right', fam: NUM });
      it.lv.forEach((r, i) => {
        const g = shiftIndex(it.ci, i), p = s.progress[g], locked = g > s.open, cur = !p && !locked;
        slab(ctx, r, { radius: 16, kind: 'tile', on: cur, dim: locked, fill: locked ? 'rgba(255,255,255,0.04)' : null });
        ctx.globalAlpha = locked ? 0.4 : 1;
        txt(ctx, String(i + 1), r.x + r.w / 2, r.y + r.h * 0.4, { size: F(r.h * 0.46), weight: 700, align: 'center', fam: NUM });
        for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * r.w * 0.24, r.y + r.h * 0.78, r.w * 0.2, k < (p?.stars | 0) ? '#ffd45a' : 'rgba(255,255,255,0.2)');
        ctx.globalAlpha = 1;
      });
    });
    return J.contentH;
  });
  button(ctx, P.back, 'Menu', { size: 28, icon: 'back', flash: flashK(s, 'back') });
  if (s.msg) drawToast(ctx, s, w, h);
}

// ---- pattern book ---------------------------------------------------------------------------------------------------------------------
function drawBook(ctx, s, w, h) {
  const P = listLayout(w, h), sc = TEXT_SCALES[s.prefs.textIdx], stars = totalStars(s);
  drawWall(ctx, 0, 0, w, h, s.t);
  header(ctx, s, P, 'Pattern Book', `${stars} stars collected. Tap a pattern to use it.`);
  zoomButtons(ctx, s, P);
  const ids = ['date', 'walnut', 'pistachio'];
  scrollBody(ctx, s, P.body, () => {
    const Bk = bookRects(P.body, sc);
    Bk.items.forEach((it) => {
      const type = ids[it.ti], tp = TYPES[type];
      panel(ctx, it.head, { radius: 16, fill: 'rgba(242,182,64,0.14)', line: 'rgba(242,182,64,0.45)' });
      txt(ctx, `${tp.name} cookies`, it.head.x + 16, it.head.y + it.head.h / 2, { size: F(32 * Math.min(sc, 1.5)), weight: 700, fam: DISP, maxW: it.head.w - 32 });
      it.tiles.forEach((r, i) => {
        const open = unlocked(stars, type, i), eq = patOf(s, type) === i;
        slab(ctx, r, { radius: 18, kind: 'tile', on: eq });
        const cr = Math.min(r.w, r.h * 0.74) * 0.36;
        ctx.save(); if (!open) ctx.globalAlpha = 0.5;
        drawCookie(ctx, r.x + r.w / 2, r.y + r.h * 0.4, cr, { type, pat: i, b: 0.89, dust: true });
        ctx.restore();
        const pn = PATTERNS[type][i].name;
        txt(ctx, pn, r.x + r.w / 2, r.y + r.h * 0.76, { size: F(22 * Math.min(sc, 1.4)), weight: 700, align: 'center', maxW: r.w - 14 });
        const sub = !open ? `${lockedAt(type, i)} stars to unlock` : eq ? 'In use' : 'Tap to use';
        txt(ctx, sub, r.x + r.w / 2, r.y + r.h * 0.9, { size: F(18 * Math.min(sc, 1.3)), weight: 500, color: eq ? T.accent : T.dim, align: 'center', maxW: r.w - 14 });
        if (!open) icons.lock(ctx, r.x + r.w - 24, r.y + 24, 28, T.dim);
      });
    });
    return Bk.contentH;
  });
  button(ctx, P.back, 'Menu', { size: 28, icon: 'back', flash: flashK(s, 'back') });
}

// ---- documents (How to Play, Rules, About) -------------------------------------------------------------------------------------------
function figure(ctx, kind, r, s) { withClip(r, () => figure0(ctx, kind, r, s)); }
function figure0(ctx, kind, r, s) {
  ctx.save();
  panel(ctx, r, { radius: 20, fill: 'rgba(0,0,0,0.28)', line: T.line });
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, m = Math.min(r.w, r.h);
  if (kind === 'tray') {
    const tr = { cols: 3, rows: 2, slots: [{ type: 'date', st: 'raw', q: 0.9 }, { type: 'date', st: 'empty' }, { type: 'walnut', st: 'empty' }, { type: 'walnut', st: 'raw', q: 0.8 }, { type: 'pistachio', st: 'empty' }, { type: 'pistachio', st: 'raw', q: 0.95 }] };
    const tw = Math.min(r.w - 24, (r.h - 24) * 1.5);
    drawTray(ctx, { x: cx - tw / 2, y: cy - tw / 3, w: tw, h: tw * 0.667 }, tr, { b: null, pats: s.prefs.pat, t: s.t });
  } else if (kind === 'cookies') {
    ['date', 'walnut', 'pistachio'].forEach((id, i) => {
      const x = r.x + r.w * (0.2 + i * 0.3);
      drawMould(ctx, x, cy - m * 0.12, m * 0.17, id, patOf(s, id), { handle: false });
      drawCookie(ctx, x, cy + m * 0.26, m * 0.15, { type: id, pat: patOf(s, id), b: 0.89, dust: true });
    });
  } else if (kind === 'cup') {
    const ph = (s.t * 0.5) % 1, amt = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    drawDough(ctx, cx, cy, m * 0.36, { st: 'fill', type: 'date', amount: amt, target: 0.62, band: 0.12 });
  } else if (kind === 'rim') {
    const n = 36, k = Math.floor(((s.t * 0.35) % 1) * n);
    drawDough(ctx, cx, cy, m * 0.36, { st: 'seal', type: 'date', seal: 0.5, bins: Array.from({ length: n }, (_, i) => (i < k ? (i % 9 === 4 ? 0.3 : 0.9) : -1)) });
  } else if (kind === 'knock') {
    const R0 = m * 0.3;
    drawMould(ctx, cx, cy, R0, 'walnut', patOf(s, 'walnut'), { handle: false, lift: Math.abs(Math.sin(s.t * 2)) * 5 });
    const ph = (s.t * 0.8) % 1;
    ctx.strokeStyle = 'rgba(255,236,190,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, R0 * (1.05 + (1 - ph) * 0.7), 0, TAU); ctx.stroke();
  } else if (kind === 'oven') {
    const gw = Math.min(r.w - 40, 520);
    drawGauge(ctx, { x: cx - gw / 2, y: cy + m * 0.22, w: gw, h: 26 }, ((s.t * 0.3) % 1) * K.B_AUTO, { active: true });
    ['Raw', 'Nearly', 'Pale gold', 'Golden', 'Brown', 'Burnt'].forEach((l, i) => txt(ctx, l, cx - gw / 2 + (i + 0.5) * gw / 6, cy + m * 0.22 + 56, { size: F(16), weight: 600, color: T.dim, align: 'center', maxW: gw / 6 - 4 }));
    [0.2, 0.89, 1.2].forEach((b, i) => drawCookie(ctx, cx + (i - 1) * Math.min(m * 0.42, r.w * 0.26), cy - m * 0.16, Math.min(m * 0.14, r.w * 0.09), { type: 'walnut', pat: 0, b, dust: b < 1 }));
  } else if (kind === 'book') {
    [0, 1, 2].forEach((i) => drawCookie(ctx, cx + (i - 1) * Math.min(m * 0.42, r.w * 0.26), cy, Math.min(m * 0.15, r.w * 0.09), { type: 'pistachio', pat: i, b: 0.89, dust: true }));
  }
  ctx.restore();
}
function drawDoc(ctx, s, w, h) {
  const L = docLayout(w, h), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], sc = TEXT_SCALES[s.prefs.textIdx];
  drawWall(ctx, 0, 0, w, h, s.t);
  header(ctx, s, L, doc.title, `Page ${s.doc.page + 1} of ${doc.pages.length}`);
  zoomButtons(ctx, s, L);
  if (L.split && page.fig) figure(ctx, page.fig, L.fig, s);
  scrollBody(ctx, s, L.text, () => {
    const x = L.text.x, wd = L.text.w;
    let y = L.text.y + 4;
    if (!L.split && page.fig) { const fh = clamp(wd * 0.5, 170, 300); figure(ctx, page.fig, { x, y, w: wd, h: fh }, s); y += fh + 18; }
    y += para(ctx, page.title, x, y, wd, { size: 42 * sc, weight: 700, color: T.accent, fam: DISP, lh: 1.15 }) + 10 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, wd, { size: 26 * sc, weight: 500, color: T.text, lh: 1.34 }) + 14 * sc;
      if (b.li) for (const li of b.li) {
        const ind = 26 * sc;
        ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(x + 8 * sc, y + 14 * sc, 5 * sc, 0, TAU); ctx.fill();
        y += para(ctx, li, x + ind, y, wd - ind, { size: 26 * sc, weight: 500, color: T.text, lh: 1.34 }) + 10 * sc;
      }
    }
    if (s.doc.kind === 'about' && s.doc.page === 0) {
      y += 6; para(ctx, FACTS[s.doc.fact % FACTS.length], x, y, wd, { size: 22 * sc, weight: 500, color: T.dim }); y += paraHeight(ctx, FACTS[s.doc.fact % FACTS.length], wd, 22 * sc, 500) + 10;
    }
    return y - L.text.y + 16;
  });
  const n = doc.pages.length;
  button(ctx, L.menu, 'Menu', { icon: 'back', size: 26, flash: flashK(s, 'back') });
  button(ctx, L.prev, 'Back', { size: 26, disabled: s.doc.page === 0, flash: flashK(s, 'prev') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, L.count.x + L.count.w / 2, L.count.y + L.count.h / 2, { size: F(24), weight: 700, color: T.dim, align: 'center' });
  button(ctx, L.next, 'Next', { kind: s.doc.page < n - 1 ? 'accent' : 'solid', size: 26, disabled: s.doc.page >= n - 1, flash: flashK(s, 'next') });
}

// ---- settings --------------------------------------------------------------------------------------------------------------------------
function drawSettings(ctx, s, w, h) {
  const sc = TEXT_SCALES[s.prefs.textIdx], L = settingsLayout(w, h, sc, settingsRows(s).length);
  drawWall(ctx, 0, 0, w, h, s.t);
  header(ctx, s, L, 'Settings', 'Text size A- / A+ applies to every text screen');
  zoomButtons(ctx, s, L);
  metrics.rect = L.body; metrics.view = L.body.h; metrics.max = Math.max(0, L.contentH - L.body.h + 10);
  ctx.save(); ctx.beginPath(); ctx.rect(L.body.x - 4, L.body.y, L.body.w + 8, L.body.h); ctx.clip(); ctx.translate(0, -s.scrollY);
  v3.clip = { x: L.body.x - 4, y: L.body.y, w: L.body.w + 8, h: L.body.h };
  settingsRows(s).forEach((row, i) => {
    const g = L.rows[i], val = settingValue(s, row.id);
    panel(ctx, g.rect, { radius: 18 });
    const tw = g.stacked ? g.rect.w - 36 : g.ctrl.x - g.rect.x - 28, k2 = Math.min(sc, 1.5);
    if (g.stacked) {
      txt(ctx, row.label, g.rect.x + 18, g.rect.y + 14 + 20 * k2, { size: F(30 * k2), weight: 700, maxW: tw });
      para(ctx, row.desc, g.rect.x + 18, g.rect.y + 22 + 42 * k2, tw, { size: F(19 * k2), weight: 500, color: T.dim, lh: 1.2 });
    } else {
      txt(ctx, row.label, g.rect.x + 18, g.rect.y + g.rect.h * 0.32, { size: F(30 * k2), weight: 700, maxW: tw });
      para(ctx, row.desc, g.rect.x + 18, g.rect.y + g.rect.h * 0.5, tw, { size: F(19 * k2), weight: 500, color: T.dim, lh: 1.2 });
    }
    const n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
    row.opts.forEach((o, k) => button(ctx, { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }, o, { size: 24 * Math.min(sc, 1.3), active: val === k, flash: flashK(s, 'set' + i + '.' + k) }));
  });
  v3.clip = null;
  ctx.restore();
  button(ctx, L.back, s.back === 'play' ? 'Back to shift' : 'Menu', { size: 28, icon: 'back', flash: flashK(s, 'back') });
  if (s.msg) drawToast(ctx, s, w, h);
}

// ---- result ----------------------------------------------------------------------------------------------------------------------------
function drawOver(ctx, s, w, h) {
  const O = overLayout(w, h), R0 = s.result;
  drawWall(ctx, 0, 0, w, h, s.t);
  if (!R0) return;
  const A = O.art;
  // the last tray out of the oven
  const sim = s.sim, trays = sim ? sim.trays.filter((t) => t.st === 'done') : [];
  const tr = R0.tray ?? trays[trays.length - 1];
  if (tr) {
    const ah = A.h * 0.68, aw = Math.min(A.w, ah * (tr.cols / tr.rows) * 1.05 + 20), x = A.x + (A.w - aw) / 2;
    drawTray(ctx, { x, y: A.y + A.h * 0.05, w: aw, h: ah }, tr, { b: tr.bakeB, pats: s.prefs.pat, t: s.t, dust: true });
  }
  const starY = A.y + A.h * 0.9, ss = Math.min(86, A.w * 0.18, A.h * 0.26);
  const earned = R0.stars, pop = (i) => clamp((s.sceneT - 0.35 - i * 0.22) / 0.3, 0, 1);
  for (let i = 0; i < 3; i++) {
    const k = pop(i), on = i < earned, x = A.x + A.w / 2 + (i - 1) * ss * 1.15;
    icons.star(ctx, x, starY, ss * (on ? 0.6 + 0.4 * k : 1), on ? `rgba(255,212,90,${0.25 + 0.75 * k})` : 'rgba(255,255,255,0.16)');
  }
  const B = O.body;
  let y = B.y + 8;
  const head = R0.kind === 'rush' ? (R0.score > R0.best0 ? 'New best' : "Time's up") : R0.why === 'closed' ? 'Closing time' : R0.stars === 3 ? 'Perfect shift' : 'Shift complete';
  txt(ctx, head, B.x + B.w / 2, y + 28, { size: F(54), weight: 700, align: 'center', color: R0.why === 'closed' ? T.bad : T.accent, fam: DISP, maxW: B.w });
  y += 70;
  txt(ctx, R0.score.toLocaleString('en-US'), B.x + B.w / 2, y + 26, { size: F(60), weight: 700, align: 'center', fam: NUM });
  y += 62;
  txt(ctx, R0.kind === 'rush' ? `Best ${Math.max(R0.best0, R0.score).toLocaleString('en-US')}` : `Average cookie ${Math.round(R0.quality * 100)}%`, B.x + B.w / 2, y + 8, { size: F(24), weight: 600, color: T.dim, align: 'center' });
  y += 36;
  const rows = [['Cookies made', R0.made], ['Perfect cookies', R0.perfect], ['Best row', R0.bestStreak], R0.kind === 'rush' ? ['Trays baked', R0.trays] : ['Time left', R0.why === 'cleared' ? fmtTime(R0.timeLeft) : '0:00']];
  const cw = B.w / 2;
  rows.forEach(([k, v], i) => {
    const x = B.x + (i % 2) * cw + 8, yy = y + Math.floor(i / 2) * 58;
    txt(ctx, k, x, yy + 12, { size: F(20), weight: 500, color: T.dim, maxW: cw - 16 });
    txt(ctx, String(v), x, yy + 38, { size: F(32), weight: 700, fam: NUM, maxW: cw - 16 });
  });
  y += 128;
  if (R0.newPattern) { txt(ctx, `New pattern: ${R0.newPattern}`, B.x + B.w / 2, y + 10, { size: F(24), weight: 700, color: '#ffd45a', align: 'center', maxW: B.w }); y += 34; }
  if (y + 20 < B.y + B.h) para(ctx, FACTS[R0.fact % FACTS.length], B.x + 8, y, B.w - 16, { size: F(20), weight: 500, color: T.dim, lh: 1.25 });
  const b = O.btns;
  const nextLabel = R0.kind === 'rush' ? 'Rush again' : R0.kind === 'daily' ? 'Menu' : R0.why === 'closed' ? 'Try again' : R0.next != null ? 'Next shift' : 'Shifts';
  button(ctx, b.next, nextLabel, { kind: 'accent', size: 32, flash: flashK(s, 'next') });
  button(ctx, b.share, 'Share', { size: 26, flash: flashK(s, 'share') });
  button(ctx, b.menu, R0.kind === 'journey' ? 'Shifts' : 'Menu', { size: 26, flash: flashK(s, 'menu') });
  drawMoreLine(ctx, w / 2, Math.min(h - 8, O.F.U.y1 - 4), 15);
  drawFx(ctx, s);
}

function drawDemoLimit(ctx, s, w, h) {
  drawWall(ctx, 0, 0, w, h, s.t);
  const c = centerCard(w, h, 600, 380);
  panel(ctx, c, { radius: 26, fill: '#0f3235' });
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(48), weight: 700, align: 'center', fam: DISP, maxW: c.w - 40 });
  para(ctx, 'The web version stops after three shifts. Get the full game on iPhone and Android for every bakery, Rush Hour, the Daily Shift, the Pattern Book and Watch and Learn.', c.x + 30, c.y + 130, c.w - 60, { size: F(26), weight: 500, align: 'center', color: T.dim });
  button(ctx, { x: c.x + 30, y: c.y + c.h - 100, w: c.w - 60, h: 70 }, 'Back to menu', { kind: 'accent', size: 30 });
}

export { mix, drawGhost, trayGeo, TYPE_DOT, FILL_COL, bakeColor };
