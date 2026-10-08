// Rendering of every screen. Reads the state and the live layout; never changes the game state.
import { FONT, UI, PAL, drawBackdrop, drawDrum, drawNote, drawHand, rgba } from './art.js';
import { txt, wrap, fitText, panel, button, stars as drawStars, drawBlocks, scrollbar } from './ui.js';
import { drawCredit, drawMoreLine, edgeStroke, drawBadgeStack, brandGradient } from './brand.js';
import { buttonsFor, pickLayout, settingsLayout, resultLayout, TITLE_CARDS, RULES_CHAPTERS } from './buttons.js';
import { RHYTHMS, STROKE_INFO, VOICES, DIFFICULTY, notation, GRADE_POINTS, LAYERS } from './rhythm.js';
import { ABOUT, HOWTO, rulesChapters } from './content.js';
import { TEXT_SCALES, R } from './layout.js';

export const metrics = { total: 0, view: 0 };
const LOOK = 2.6;                                          // seconds of the future shown on the timeline
const ROW = { S: 0, T: 1, B: 2 };

function spaced(ctx, s, x, y, size, track, o = {}) {
  ctx.font = `${o.weight ?? 700} ${size}px ${UI}`; ctx.textBaseline = 'alphabetic';
  const w = [...s].reduce((a, ch) => a + ctx.measureText(ch).width + track, -track);
  let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.textAlign = 'left'; ctx.fillStyle = o.color ?? PAL.cream;
  for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track; }
  return w;
}

// ---- illustrations used by the text pages ----------------------------------------------------------------------------------------
const DRAWS = {
  zones: {
    h: (w) => { const rx = Math.min(w * 0.36, 230); return rx * 0.58 * 2 + 120; },
    draw(ctx, r) {
      const rx = Math.min(r.w * 0.36, 230), g = { cx: r.x + r.w / 2, cy: r.y + rx * 0.58 + 6, rx, ry: rx * 0.58, clip: R(r.x, r.y, r.w, rx * 1.16 + 14) };
      drawDrum(ctx, g, { labels: true });
      const names = ['B', 'T', 'S'], cw = r.w / 3;
      names.forEach((s, i) => { const cx = r.x + cw * (i + 0.5), cy = r.y + rx * 1.16 + 70; drawNote(ctx, s, cx - 70, cy, 22); txt(ctx, STROKE_INFO[s].name, cx - 36, cy + 9, 28, { weight: 800, color: STROKE_INFO[s].color }); });
    },
  },
  notes: {
    h: () => 190,
    draw(ctx, r) {
      panel(ctx, R(r.x, r.y, r.w, 176), { radius: 16 });
      const rowH = 48, x0 = r.x + 100, hit = r.x + r.w * 0.62;
      ['S', 'T', 'B'].forEach((s, i) => {
        const y = r.y + 30 + i * rowH + rowH / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(r.x + 12, y - rowH / 2 + 4, r.w - 24, rowH - 8);
        txt(ctx, STROKE_INFO[s].name.toUpperCase(), r.x + 20, y + 8, 21, { color: PAL.dim, weight: 700 });
      });
      ctx.fillStyle = PAL.gold; ctx.fillRect(hit - 2, r.y + 14, 4, 148);
      [['B', 0.2], ['T', 0.36], ['S', 0.5], ['B', 0.72, true], ['T', 0.9]].forEach(([s, f, soft]) => drawNote(ctx, s, x0 + (hit - x0) * (f * 1.28) - 20, r.y + 30 + ROW[s] * rowH + rowH / 2, 17, { soft }));
      drawNote(ctx, 'T', hit + 90, r.y + 30 + ROW.T * rowH + rowH / 2, 17, { kind: 'ghost' });
      txt(ctx, 'play now', hit, r.y + 22, 20, { align: 'center', color: PAL.gold });
    },
  },
};

// ---- backdrop and the common frame ----------------------------------------------------------------------------------------------------
function backdrop(ctx, st, L, pool) {
  drawBackdrop(ctx, L.w, L.h, st.t, { horizon: L.h * (L.land ? 0.5 : 0.56), land: L.land, calm: st.prefs.calm, pool });
}
function shakeOf(st) { const k = st.fx.shake.k; return k > 0.01 ? { x: Math.sin(st.t * 90) * 3 * k, y: Math.cos(st.t * 77) * 4 * k } : null; }
function drumFx(st, extra = {}) {
  return { ripples: st.fx.ripples, glow: st.fx.glow, shake: shakeOf(st), t: st.t, calm: st.prefs.calm, ...extra };
}
function sparks(ctx, st) {
  for (const s of st.fx.sparks) { const a = 1 - s.age / s.life; ctx.fillStyle = rgba(STROKE_INFO[s.stroke].color, a); ctx.beginPath(); ctx.arc(s.x, s.y, 2 + 3 * a, 0, 7); ctx.fill(); }
}
function buttonsDraw(ctx, st, L, filter) {
  for (const b of buttonsFor(st, L)) {
    if (b.invisible || b.row || b.passive || b.scrolled || (filter && !filter(b))) continue;
    button(ctx, b.r, b.label, { style: b.style, active: b.active, disabled: b.disabled, size: b.size, sub: b.sub });
  }
}
function header(ctx, L, title, sub) {
  const G = L.page;
  const hx = G.titleX ?? G.hdr.x;
  txt(ctx, title, hx, G.hdr.y + 46, 50, { font: 'display', color: PAL.gold, shadow: true });
  if (sub) txt(ctx, sub, hx, G.hdr.y + 72, 22, { color: PAL.dim, weight: 600 });
}

// ---- main entry ---------------------------------------------------------------------------------------------------------------------------
export function render(ctx, st, L) {
  const w = L.w, h = L.h;
  ctx.clearRect?.(0, 0, w, h);
  switch (st.scene) {
    case 'title': renderTitle(ctx, st, L); break;
    case 'pick': renderPick(ctx, st, L); break;
    case 'play': renderPlay(ctx, st, L); break;
    case 'result': renderPlay(ctx, st, L, true); renderResult(ctx, st, L); break;
    case 'rules': case 'about': case 'how': renderText(ctx, st, L); break;
    case 'settings': renderSettings(ctx, st, L); break;
    case 'calibrate': renderCalibrate(ctx, st, L); break;
    case 'demo-limit': renderDemoLimit(ctx, st, L); break;
    default: break;
  }
}

// ---- title -------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, g = T.drum, w = L.w;
  backdrop(ctx, st, L, { x: g.cx, y: g.cy + g.rx * 0.5, r: g.rx * 1.7 });
  if (T.showDrum) { drawDrum(ctx, g, drumFx(st, { guide: null })); sparks(ctx, st); }
  // title lockup
  const tb = T.titleBox, sc = T.sc, cx = tb.x + tb.w / 2;
  const land = L.land, tx = land ? tb.x + tb.w * 0.5 : cx;
  const subSz = Math.round(40 * Math.max(0.8, sc)), big = Math.min(Math.round((land ? 150 : 176) * Math.min(1, sc * 1.05)), Math.floor((tb.h - subSz * 3.1) / 0.82));
  const sz = fitText(ctx, 'DJEMBE', tb.w * 0.94, big, 700, FONT);
  ctx.save(); ctx.font = `700 ${sz}px ${FONT}`;
  const grad = ctx.createLinearGradient(0, tb.y, 0, tb.y + sz); grad.addColorStop(0, '#ffe7a8'); grad.addColorStop(0.6, '#f4b24e'); grad.addColorStop(1, '#c0662a');
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText('DJEMBE', tx + 3, tb.y + sz * 0.82 + 5);
  ctx.fillStyle = grad; ctx.fillText('DJEMBE', tx, tb.y + sz * 0.82); ctx.restore();
  const sub = Math.round(40 * Math.max(0.8, sc));
  spaced(ctx, 'DRUM CIRCLE', tx, tb.y + sz * 0.82 + sub * 1.5, sub, sub * 0.32, { align: 'center', color: PAL.cream, weight: 800 });
  txt(ctx, 'Three strokes. One circle of drums.', tx, tb.y + sz * 0.82 + sub * 2.65, fitText(ctx, 'Three strokes. One circle of drums.', tb.w, Math.round(25 * Math.max(0.9, sc) * Math.min(T.zoom, land ? 1.2 : 1.7)), 500), { align: 'center', color: PAL.dim, weight: 500 });
  // menu
  for (const b of buttonsFor(st, L)) {
    if (b.invisible) continue;
    button(ctx, b.r, b.label, { style: b.style, size: b.size, sub: b.sub, inset: b.card ? b.r.h * 0.8 : 0 });
    if (b.card) cardIcon(ctx, b.id, b.r);
  }
  // Arcforge credit, bottom centre under the menu
  const cr = T.credit;
  drawCredit(ctx, cr.x + cr.w / 2, cr.y + cr.h * 0.62, Math.round(20 * Math.max(0.85, sc)));
  // first-run hint
  if (T.showDrum && !st.prog.sessions && st.sceneT > 1.2) txt(ctx, 'Tap the drum to hear it', g.cx, g.cy + 8, 26, { align: 'center', color: PAL.gold, weight: 700, shadow: true });
}
function cardIcon(ctx, id, r) {
  const s = Math.min(r.h * 0.5, 56), x = r.x + 24 + s / 2, y = r.y + r.h / 2;
  ctx.save(); ctx.translate(x, y);
  if (id === 'echo') { drawNote(ctx, 'T', -s * 0.35, -s * 0.2, s * 0.26, { kind: 'ghost' }); drawNote(ctx, 'B', s * 0.3, s * 0.2, s * 0.3); }
  else if (id === 'circle') { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.fillStyle = [PAL.gold, '#6fd0c4', '#e86f86', '#9a86f0', '#b7d96a', '#e58a4b'][i]; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42, s * 0.13, 0, 7); ctx.fill(); } }
  else if (id === 'learn') { drawNote(ctx, 'B', -s * 0.4, 0, s * 0.2); drawNote(ctx, 'T', 0, 0, s * 0.2); drawNote(ctx, 'S', s * 0.4, 0, s * 0.2); }
  else { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0.4, Math.PI * 1.5); ctx.stroke(); ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.62); ctx.lineTo(s * 0.1, -s * 0.14); ctx.lineTo(s * 0.5, -s * 0.38); ctx.fill(); }
  ctx.restore();
}

// ---- pick (Learn / Circle) ---------------------------------------------------------------------------------------------------------------------
function renderPick(ctx, st, L) {
  backdrop(ctx, st, L, null);
  ctx.fillStyle = 'rgba(8,3,10,0.5)'; ctx.fillRect(0, 0, L.w, L.h);
  const P = pickLayout(L), learn = st.pick.mode === 'learn', sc = TEXT_SCALES[st.prefs.textScaleIdx];
  header(ctx, L, learn ? 'Learn rhythms' : 'Build the circle', learn ? 'Listen, practise, then play with the circle' : 'Hold your part while the drummers join');
  RHYTHMS.forEach((r, i) => {
    const rr = P.rows[i], sel = st.pick.sel === i, open = st.unlocked(i);
    panel(ctx, rr, { radius: 18, fill: sel ? 'rgba(90,44,40,0.92)' : 'rgba(28,12,22,0.8)', line: sel ? PAL.gold : PAL.line });
    ctx.globalAlpha = open ? 1 : 0.5;
    txt(ctx, r.name, rr.x + 22, rr.y + rr.h * 0.42, Math.min(34, rr.h * 0.36), { weight: 800 });
    txt(ctx, r.region, rr.x + 22, rr.y + rr.h * 0.78, Math.min(22, rr.h * 0.24), { color: PAL.dim, weight: 500 });
    if (!open) { lock(ctx, rr.x + rr.w - 44, rr.y + rr.h / 2, 18); }
    else if (learn) drawStars(ctx, rr.x + rr.w - 78, rr.y + rr.h / 2, st.prog.stars[r.id] ?? 0, 24);
    else { const c = st.prog.circle[r.id]; txt(ctx, c ? `${c.drummers}/${LAYERS.length + 1} drummers` : 'new', rr.x + rr.w - 22, rr.y + rr.h / 2 + 8, 22, { align: 'right', color: PAL.gold, weight: 700 }); }
    ctx.globalAlpha = 1;
  });
  // details
  const r = RHYTHMS[st.pick.sel], D = P.det, open = st.unlocked(st.pick.sel);
  panel(ctx, D, { radius: 22, brand: true });
  const inner = R(D.x + 22, D.y + 18, D.w - 44, D.h - 36);
  const blocks = [{ h: r.name }, { p: `${r.region} · ${r.steps} steps a bar` }, { draw: 'pattern' }, { p: r.note }];
  if (!open) blocks.push({ p: `Locked. Earn one star on ${RHYTHMS[st.pick.sel - 1].name} in Learn to unlock it.` });
  const draws = { pattern: { h: (wd, s) => patternHeight(r, wd, s), draw: (c, rc, s) => drawPattern(c, r.parts.djA, rc, r.spb, s) } };
  metrics.total = drawBlocks(ctx, inner, blocks, sc * 0.85, st.page.scroll, draws); metrics.view = inner.h;
  scrollbar(ctx, R(D.x + D.w - 14, D.y + 14, 6, D.h - 28), st.page.scroll, metrics.total, metrics.view);
  buttonsDraw(ctx, st, L);
}
function lock(ctx, x, y, s) {
  ctx.fillStyle = PAL.dim; ctx.beginPath(); ctx.roundRect(x - s * 0.7, y - s * 0.2, s * 1.4, s * 1.1, 4); ctx.fill();
  ctx.strokeStyle = PAL.dim; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.45, Math.PI, 0); ctx.stroke();
}
function patternHeight(r, wd, s) { const cell = 46 * Math.max(1, s * 0.8), per = Math.max(4, Math.floor(wd / cell)), rows = Math.ceil(r.parts.djA.length / Math.min(per, 8)); return rows * (cell + 6) + 8; }
// The part as a grid of cells: stroke letters in their colours, dots for rests, a gap between beats.
function drawPattern(ctx, pat, rc, spb, s) {
  const cell = 46 * Math.max(1, s * 0.8), perRow = Math.min(8, Math.max(4, Math.floor(rc.w / cell)));
  [...pat].forEach((c, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, x = rc.x + col * cell + (Math.floor(col / spb) * 6 > 0 ? 0 : 0), y = rc.y + row * (cell + 6);
    const rest = c === '.', st = c.toUpperCase(), info = STROKE_INFO[st];
    ctx.fillStyle = rest ? 'rgba(255,255,255,0.05)' : rgba(info.color, c === st ? 0.28 : 0.14);
    ctx.beginPath(); ctx.roundRect(x + 2, y, cell - 4, cell, 8); ctx.fill();
    if (!rest) { ctx.strokeStyle = info.color; ctx.lineWidth = 2; ctx.stroke(); }
    txt(ctx, rest ? '·' : st, x + cell / 2, y + cell * 0.68, cell * 0.5, { align: 'center', color: rest ? PAL.dim : info.color, weight: c === st ? 800 : 500 });
    if (i % spb === 0) { ctx.fillStyle = PAL.gold; ctx.fillRect(x + 4, y + cell + 1, cell - 8, 2); }
  });
}

// ---- play --------------------------------------------------------------------------------------------------------------------------------
function activeVoice(st, v) {
  if (v === 'djA' || v === 'lead') return true;
  const S = st.S;
  if (st.auto.on) return st.auto.phase === 'act';
  if (!S) return true;
  if (S.mode === 'circle') return S.layers.includes(v);
  if (S.mode === 'learn') { const k = st.hud.bar?.kind; return k === 'play' ? true : k === 'practice' ? v === 'bell' || v === 'kenkeni' : v === 'bell'; }
  return false;
}
function chipVoices(st) {
  if (st.mode === 'echo') return ['lead', 'djA'];
  if (st.mode === 'free') return null;
  return ['djA', ...LAYERS];
}
function renderPlay(ctx, st, L, dim = false) {
  const P = L.play, g = P.drum, S = st.S;
  backdrop(ctx, st, L, { x: g.cx, y: g.cy + g.rx * 0.45, r: g.rx * 1.8 });
  // guide: light the zone of the next note
  let guide = null;
  if (S && !st.auto.on && !st.paused) {
    const bar = st.hud.bar, forced = bar?.kind === 'practice';
    if (forced || (st.prefs.guide && (st.mode === 'echo' || st.mode === 'circle'))) {
      const nx = S.targets.find((n) => !n.grade && n.t >= S.t - 0.12);
      if (nx && nx.t - S.t < 1.1) guide = { stroke: nx.stroke, pulse: 0.5 + 0.5 * Math.sin(st.t * 10) };
    }
  }
  if (st.auto.on && st.auto.phase === 'reveal') {
    const R0 = RHYTHMS[st.auto.idx], strokes = [...R0.parts.djA].filter((c) => c !== '.');
    guide = { stroke: strokes[Math.min(st.auto.step, strokes.length - 1)].toUpperCase(), pulse: 0.7 };
  }
  const dfx = drumFx(st, { guide, labels: st.mode === 'free' && !st.free.layers.length && st.free.phase === 'idle' && st.t < 8 });
  drawDrum(ctx, g, dfx);
  ctx.save(); ctx.beginPath(); ctx.rect(g.clip.x, g.clip.y - 120, g.clip.w, g.clip.h + 120); ctx.clip(); for (const hd of st.fx.hands) drawHand(ctx, g, hd); ctx.restore();
  sparks(ctx, st);
  // header
  renderPlayHeader(ctx, st, L);
  renderChips(ctx, st, L);
  if (st.mode === 'free') renderLoopStrip(ctx, st, L);
  else if (st.auto.on && st.auto.phase !== 'act') renderAutoCard(ctx, st, L);
  else if (S) renderLane(ctx, st, L);
  renderStatus(ctx, st, L);
  if (!dim) buttonsDraw(ctx, st, L);
  if (st.paused && !st.auto.on && !dim) renderPauseModal(ctx, st, L);
  if (dim) { ctx.fillStyle = 'rgba(6,2,10,0.6)'; ctx.fillRect(0, 0, L.w, L.h); }
}
function renderPlayHeader(ctx, st, L) {
  const P = L.play, hd = P.titleBox, R0 = RHYTHMS.find((r) => r.id === st.rhId);
  const title = st.auto.on ? 'Auto Play · Watch & Learn' : st.mode === 'echo' ? 'Echo' : st.mode === 'free' ? 'Free Drum' : st.mode === 'circle' ? `Circle · ${R0.name}` : `Learn · ${R0.name}`;
  const x = hd.x;
  if (L.land) {
    const parts = title.split(' \u00b7 '), s1 = fitText(ctx, parts[0], hd.w, 40, 700, FONT);
    txt(ctx, parts[0], x, hd.y + 38, s1, { font: 'display', color: PAL.gold, shadow: true });
    if (parts[1]) { const s2 = fitText(ctx, parts[1], hd.w, 30, 700, FONT); txt(ctx, parts[1], x, hd.y + 72, s2, { font: 'display', color: PAL.cream, shadow: true }); }
  } else {
    const sz = fitText(ctx, title, hd.w - 190, 46, 700, FONT);
    txt(ctx, title, x, hd.y + 40, sz, { font: 'display', color: PAL.gold, shadow: true });
  }
  const bar = st.hud.bar;
  let sub = '';
  if (st.auto.on) sub = st.auto.phase === 'act' ? `${R0.name} · ${R0.region}` : `Next: ${R0.name}`;
  else if (st.mode === 'echo' && bar) sub = bar.round ? `Round ${bar.round} of 8` : 'Get ready';
  else if (st.mode === 'learn' && bar) sub = `${bar.label}${bar.kind === 'practice' ? ' · not scored' : ''}`;
  else if (st.mode === 'circle' && st.S) sub = `${st.S.layers.length + 1} of ${LAYERS.length + 1} drummers`;
  else if (st.mode === 'free') sub = 'No score. Just drum.';
  const sy = L.land ? (title.includes(' \u00b7 ') ? 106 : 72) : 68;
  txt(ctx, sub, x, hd.y + sy, fitText(ctx, sub, hd.w, 24, 600), { color: PAL.dim, weight: 600 });
}
function renderChips(ctx, st, L) {
  const P = L.play;
  let voices = chipVoices(st);
  if (!voices) {
    const F = st.free, labels = [0, 1, 2].map((i) => ({ id: `L${i}`, name: `Layer ${i + 1}`, on: i < F.layers.length || (F.phase === 'rec' && i === F.layers.length), color: ['#f4c46a', '#6fd0c4', '#e86f86'][i], rec: F.phase === 'rec' && i === F.layers.length }));
    const rects = P.chips(3);
    labels.forEach((c, i) => chip(ctx, rects[i], c.name, c.color, c.on, st.fx.chips.djA ?? 0, L.land && !P.mid, c.rec));
    return;
  }
  const rects = P.chips(voices.length);
  voices.forEach((v, i) => chip(ctx, rects[i], v === 'djA' ? 'You' : VOICES[v].short, VOICES[v].color, activeVoice(st, v), st.fx.chips[v] ?? (v === 'djA' ? st.fx.glow.B + st.fx.glow.T + st.fx.glow.S : 0), L.land && !P.mid, false));
}
function chip(ctx, r, name, color, on, pulse, land, rec) {
  ctx.save();
  panel(ctx, r, { radius: 16, fill: on ? 'rgba(46,22,30,0.85)' : 'rgba(20,10,18,0.55)', line: on ? rgba(color, 0.6) : 'rgba(255,255,255,0.12)' });
  ctx.globalAlpha = on ? 1 : 0.45;
  const p = Math.min(1, pulse), rad = (land ? r.h * 0.3 : Math.min(r.w, r.h) * 0.27) * (1 + 0.16 * p);
  const cx = land ? r.x + 16 + rad : r.x + r.w / 2, cy = land ? r.y + r.h / 2 : r.y + r.h * 0.38;
  if (p > 0.05) { const g = ctx.createRadialGradient(cx, cy, rad * 0.4, cx, cy, rad * 2.4); g.addColorStop(0, rgba(color.length === 7 ? color : '#ffffff', 0.55 * p)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(cx - rad * 2.4, cy - rad * 2.4, rad * 4.8, rad * 4.8); }
  const gr = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.1, cx, cy, rad);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, color); gr.addColorStop(1, 'rgba(30,12,10,0.9)');
  ctx.fillStyle = on ? gr : 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
  if (rec) { ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.45, 0, 7); ctx.fill(); }
  const sz = land ? Math.min(26, r.h * 0.3) : 21, tx = land ? cx + rad + 14 : r.x + r.w / 2, ty = land ? cy + sz * 0.35 : r.y + r.h - 18;
  const fs = fitText(ctx, name, land ? r.w - rad * 2 - 40 : r.w - 8, sz, 700);
  txt(ctx, name, tx, ty, fs, { align: land ? 'left' : 'center', color: PAL.cream, weight: 700 });
  ctx.restore();
}

// The timeline: three rows (slap on top, bass at the bottom), notes slide in from the right toward the glowing line.
function renderLane(ctx, st, L) {
  const P = L.play, lane = P.lane, S = st.S, rowH = P.rowH, top = P.laneTop, hx = P.hitX;
  panel(ctx, lane, { radius: 20, brand: true });
  const x0 = lane.x + 8, x1 = lane.x + lane.w - 8, pps = (x1 - 20 - hx) / LOOK;
  const bar = st.hud.bar;
  // banner
  let banner = '', bcol = PAL.cream;
  if (bar) { banner = bar.kind === 'listen' ? 'LISTEN' : bar.kind === 'count' ? 'GET READY' : bar.kind === 'demo' ? 'WATCH' : st.mode === 'echo' ? 'YOUR ECHO' : bar.kind === 'practice' ? 'PRACTICE' : 'PLAY'; bcol = bar.kind === 'listen' || bar.kind === 'demo' ? '#9fd8ff' : PAL.gold; }
  spaced(ctx, banner, lane.x + 18, lane.y + 28, 22, 4, { color: bcol, weight: 800 });
  ctx.save(); ctx.beginPath(); ctx.rect(lane.x + 4, lane.y + 34, lane.w - 8, lane.h - 38); ctx.clip();
  for (const s of ['S', 'T', 'B']) {
    const y = top + ROW[s] * rowH;
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x0, y + 3, x1 - x0, rowH - 6);
    if (!P.land || true) txt(ctx, STROKE_INFO[s].name.toUpperCase(), x0 + 8, y + rowH / 2 + 7, 18, { color: 'rgba(251,238,210,0.35)', weight: 700 });
  }
  // beat lines
  for (const b of S.bars) {
    if (b.t1 < S.t - 0.5 || b.t0 > S.t + LOOK + 0.3) continue;
    const beatSteps = Math.max(1, Math.round(b.steps / (b.steps === 12 ? 4 : b.steps === 16 ? 4 : 4)));
    for (let k = 0; k < b.steps; k += beatSteps) {
      const x = hx + (b.t0 + k * b.stepSec - S.t) * pps;
      if (x < x0 + 70 || x > x1) continue;
      ctx.fillStyle = k === 0 ? 'rgba(244,196,106,0.4)' : 'rgba(255,255,255,0.1)'; ctx.fillRect(x - (k === 0 ? 1.5 : 0.5), top, k === 0 ? 3 : 1, rowH * 3);
    }
  }
  // targets + ghosts
  const rad = Math.min(rowH * 0.38, 30);
  for (const n of S.lane) {
    const x = hx + (n.t - S.t) * pps;
    if (x < x0 + 60 || x > x1 + 30) continue;
    const y = top + ROW[n.stroke] * rowH + rowH / 2, soft = n.vel < 0.7;
    if (n.kind === 'ghost') { if (n.t < S.t - 0.05) continue; drawNote(ctx, n.stroke, x, y, rad, { soft, kind: 'ghost', alpha: 0.9 }); continue; }
    if (n.grade === 'perfect' || n.grade === 'good' || n.grade === 'ok') {
      const age = S.t - (n.hitAt ?? n.t); if (age > 0.3) continue;
      drawNote(ctx, n.stroke, hx, y, rad * (1 + age * 3), { soft, alpha: Math.max(0, 1 - age / 0.3), glow: 1 - age / 0.3 }); continue;
    }
    if (n.grade === 'wrong') { drawNote(ctx, n.stroke, x, y, rad, { soft, alpha: 0.3 }); continue; }
    if (n.grade === 'miss') { drawNote(ctx, n.stroke, x, y, rad, { soft, alpha: 0.28 }); continue; }
    const near = Math.max(0, 1 - Math.abs(n.t - S.t) / 0.25);
    drawNote(ctx, n.stroke, x, y, rad, { soft, glow: near, alpha: n.practice ? 0.95 : 1 });
  }
  // hit line
  const hg = ctx.createLinearGradient(hx - 16, 0, hx + 16, 0); hg.addColorStop(0, 'rgba(244,196,106,0)'); hg.addColorStop(0.5, 'rgba(255,226,150,0.9)'); hg.addColorStop(1, 'rgba(244,196,106,0)');
  ctx.fillStyle = hg; ctx.fillRect(hx - 16, top - 2, 32, rowH * 3 + 4);
  ctx.fillStyle = '#fff3cf'; ctx.fillRect(hx - 1.5, top, 3, rowH * 3);
  for (const s of ['S', 'T', 'B']) {
    const y = top + ROW[s] * rowH + rowH / 2, gl = st.fx.glow[s];
    ctx.beginPath(); ctx.arc(hx, y, rad + 3, 0, 7); ctx.strokeStyle = rgba(STROKE_INFO[s].color, 0.45 + 0.5 * gl); ctx.lineWidth = 2 + 3 * gl; ctx.stroke();
  }
  // count-in number
  if (bar && bar.kind === 'count' && S.t >= bar.t0) {
    const beat = Math.min(Math.floor((S.t - bar.t0) / (bar.beatSec || 0.5)) + 1, 9), f = ((S.t - bar.t0) / (bar.beatSec || 0.5)) % 1;
    txt(ctx, String(beat), lane.x + lane.w * 0.62, top + rowH * 2.1, 92 * (1 + 0.18 * (1 - f)), { align: 'center', color: `rgba(255,236,190,${0.75 * (1 - f * 0.5)})`, font: 'display' });
  }
  ctx.restore();
}

function renderLoopStrip(ctx, st, L) {
  const P = L.play, lane = P.lane, F = st.free, len = (8 * 60) / F.bpm;
  panel(ctx, lane, { radius: 20, brand: true });
  spaced(ctx, 'LOOP', lane.x + 18, lane.y + 28, 22, 4, { color: PAL.gold, weight: 800 });
  txt(ctx, `${F.bpm} BPM`, lane.x + lane.w - 140, lane.y + 33, 26, { align: 'center', color: PAL.cream, weight: 800 });
  const x0 = lane.x + 20, x1 = lane.x + lane.w - 20, top = P.laneTop, rowH = P.rowH;
  for (let i = 0; i < 3; i++) {
    const y = top + i * rowH, layer = F.layers[i], rec = F.phase === 'rec' && i === F.layers.length;
    ctx.fillStyle = rec ? 'rgba(255,74,74,0.14)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(x0, y + 3, x1 - x0, rowH - 6);
    for (const e of (layer ?? (rec ? F.rec : null) ?? [])) drawNote(ctx, e.stroke, x0 + (e.t / len) * (x1 - x0), y + rowH / 2, rowH * 0.28, { soft: e.vel < 0.7 });
  }
  for (let b = 0; b <= 8; b++) { ctx.fillStyle = b % 4 === 0 ? 'rgba(244,196,106,0.45)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + (b / 8) * (x1 - x0) - 1, top, b % 4 === 0 ? 3 : 1, rowH * 3); }
  if (F.phase !== 'idle' && F.phase !== 'count') {
    const lt = (((F.clock - F.loopStart) % len) + len) % len, x = x0 + (lt / len) * (x1 - x0);
    ctx.fillStyle = '#fff3cf'; ctx.fillRect(x - 1.5, top - 2, 3, rowH * 3 + 4);
  }
  if (F.phase === 'count') {
    const beat = 60 / F.bpm, n = Math.min(4, Math.max(1, Math.floor((F.clock - F.countStart) / beat) + 1));
    txt(ctx, String(n), lane.x + lane.w / 2, top + rowH * 2.1, 100, { align: 'center', color: 'rgba(255,236,190,0.8)', font: 'display' });
  }
}

function renderAutoCard(ctx, st, L) {
  const P = L.play, lane = P.lane, A = st.auto, R0 = RHYTHMS[A.idx];
  panel(ctx, lane, { radius: 20, brand: true });
  spaced(ctx, A.phase === 'think' ? 'THINK' : 'REVEAL', lane.x + 18, lane.y + 28, 22, 4, { color: A.phase === 'think' ? '#9fd8ff' : PAL.gold, weight: 800 });
  const pat = R0.parts.djA, per = pat.length > 8 ? 8 : pat.length, cell = Math.min(60, (lane.w - 40) / per), rows = Math.ceil(pat.length / per);
  const gx = lane.x + (lane.w - per * cell) / 2, gy = lane.y + 40;
  let k = -1;
  [...pat].forEach((c, i) => {
    if (c !== '.') k += 1;
    const col = i % per, row = Math.floor(i / per), x = gx + col * cell, y = gy + row * (cell + 6), rest = c === '.', s = c.toUpperCase(), info = STROKE_INFO[s];
    const lit = A.phase === 'reveal' && !rest && k === A.step;
    ctx.fillStyle = rest ? 'rgba(255,255,255,0.05)' : rgba(info.color, lit ? 0.7 : c === s ? 0.26 : 0.13);
    ctx.beginPath(); ctx.roundRect(x + 2, y, cell - 4, cell - 4, 8); ctx.fill();
    if (!rest) { ctx.strokeStyle = info.color; ctx.lineWidth = lit ? 4 : 2; ctx.stroke(); }
    txt(ctx, rest ? '·' : s, x + cell / 2, y + cell * 0.62, cell * 0.46, { align: 'center', color: rest ? PAL.dim : lit ? '#fff' : info.color, weight: 800 });
  });
  void rows;
}

function renderStatus(ctx, st, L) {
  const P = L.play, s = P.status, S = st.S, A = st.auto;
  let left = '', mid = '', right = '';
  if (A.on) {
    if (A.phase === 'think') mid = `Thinking… ${Math.ceil(A.timer)}s`;
    else if (A.phase === 'reveal') { const strokes = [...RHYTHMS[A.idx].parts.djA].filter((c) => c !== '.'); const c = strokes[Math.min(A.step, strokes.length - 1)]; mid = `${STROKE_INFO[c.toUpperCase()].name}${c === c.toLowerCase() ? ' (soft)' : ''}: ${STROKE_INFO[c.toUpperCase()].where}`; }
    else mid = st.paused ? 'Paused' : 'Watch where each stroke lands';
    if (st.paused) mid = 'Paused';
  } else if (st.hud.roundMsg && st.mode === 'echo') mid = `Round ${st.hud.roundMsg.round}: ${Math.round(st.hud.roundMsg.acc * 100)}%`;
  else if (st.mode === 'free') mid = freeHint(st.free);
  else if (S) {
    if (S.mode !== 'echo' || true) right = S.stats.perfect + S.stats.good + S.stats.ok + S.stats.wrong + S.stats.miss ? `${st.hud.combo >= 3 ? `x${st.hud.combo}  ` : ''}${Math.round(st.hud.acc * 100)}%` : '';
    if (S.mode === 'circle' && S.circle.lastAcc !== undefined) mid = S.layers.length < LAYERS.length ? `Stage ${Math.round(S.circle.lastAcc * 100)}% \u00b7 62% brings the next drummer` : 'The circle is full';
    else if (S.mode === 'learn' && st.hud.bar?.kind === 'practice') mid = 'Follow the lit place on the drum';
    else if (S.mode === 'learn' && st.hud.bar?.kind === 'listen') mid = 'Listen to the teacher';
    else if (S.mode === 'echo') mid = st.hud.bar?.kind === 'listen' ? 'Listen to the phrase' : st.hud.bar?.kind === 'play' ? 'Play it back' : '';
  }
  if (st.hud.msgT > 0 && st.hud.msg) mid = st.hud.msg;
  const pp = st.fx.pops[0];
  if (pp) { const k = 1 - pp.age / 0.85; ctx.globalAlpha = Math.min(1, k * 2); txt(ctx, pp.text, s.x + s.w / 2, s.y + s.h * 0.72 - (1 - k) * 8, pp.big ? 46 : 38, { align: 'center', color: pp.color, weight: 800, shadow: true, font: 'display' }); ctx.globalAlpha = 1; mid = ''; }
  const room = Math.max(120, s.w - (L.land ? 330 : 400)), lines = wrap(ctx, mid || ' ', room, 24, UI, 700);
  if (lines.length <= 1) { const sz = fitText(ctx, mid || ' ', room, 26, 700); txt(ctx, mid, s.x + s.w / 2, s.y + s.h * 0.62, sz, { align: 'center', color: PAL.cream, weight: 700, shadow: true }); }
  else lines.slice(0, 2).forEach((ln, i) => txt(ctx, ln, s.x + s.w / 2, s.y + s.h * 0.4 + i * 24, 21, { align: 'center', color: PAL.cream, weight: 700, shadow: true }));
  if (left) txt(ctx, left, s.x + 8, s.y + s.h * 0.66, 40, { color: PAL.gold, font: 'display', shadow: true });
  if (right) txt(ctx, right, s.x + s.w - 8, s.y + s.h * 0.66, 40, { align: 'right', color: PAL.gold, font: 'display', shadow: true });
}
function freeHint(F) {
  if (F.phase === 'idle') return F.layers.length ? '' : 'Play freely, or press Record to loop';
  if (F.phase === 'count') return 'Count in…';
  if (F.phase === 'rec') return 'Recording two bars';
  if (F.phase === 'wait') return 'Next layer starts at the top of the loop';
  return `Looping · ${F.layers.length} layer${F.layers.length === 1 ? '' : 's'}`;
}
function renderPauseModal(ctx, st, L) {
  ctx.fillStyle = 'rgba(6,2,10,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = L.modal(560, 520);
  panel(ctx, M, { radius: 28, fill: 'rgba(30,13,24,0.96)', brand: true });
  txt(ctx, 'Paused', M.x + M.w / 2, M.y + 96, 72, { align: 'center', font: 'display', color: PAL.gold });
  for (const b of buttonsFor(st, L)) if (!b.invisible && !b.modal) button(ctx, b.r, b.label, { style: b.style, size: b.size });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const res = st.result; if (!res) return;
  ctx.fillStyle = 'rgba(6,2,10,0.5)'; ctx.fillRect(0, 0, L.w, L.h);
  const RL = resultLayout(st, L), M = RL.M, k = RL.k, r0 = RHYTHMS.find((r) => r.id === res.rhId), s = res.stats;
  panel(ctx, M, { radius: 28, fill: 'rgba(30,13,24,0.97)', brand: true });
  const cx = M.x + M.w / 2;
  const head = res.mode === 'echo' ? 'Echo complete' : res.mode === 'circle' ? (res.full ? 'The circle is full' : 'Circle session') : r0.name;
  txt(ctx, head, cx, M.y + 70 * k, fitText(ctx, head, M.w - 60, 58 * k + 8, 700, FONT), { align: 'center', font: 'display', color: PAL.gold });
  drawStars(ctx, cx, M.y + 128 * k, res.stars, 50 * k + 6);
  txt(ctx, `${Math.round(res.acc * 100)}%`, cx, M.y + 214 * k, 86 * k + 4, { align: 'center', font: 'display', color: PAL.cream });
  const cells = [['Perfect', s.perfect], ['Good', s.good], ['OK', s.ok], ['Wrong', s.wrong], ['Missed', s.miss]];
  const draws = { stats: {
    h: (wd, sc) => 100 * Math.min(sc * 1.15, 2.2),
    draw(c, rc, sc) {
      const f = Math.min(sc * 1.15, 2.2), cw = rc.w / cells.length;
      cells.forEach(([lab, v], i) => { const x = rc.x + cw * (i + 0.5); txt(c, String(v), x, rc.y + 40 * f, fitText(c, String(v), cw - 6, 36 * f, 800), { align: 'center', weight: 800 }); txt(c, lab, x, rc.y + 66 * f, fitText(c, lab, cw - 4, 20 * f, 600), { align: 'center', color: PAL.dim }); });
    } } };
  const blocks = [{ draw: 'stats' }, { p: `Best streak ${s.best}`, color: PAL.dim }];
  if (res.mode === 'circle') blocks.push({ p: `${res.drummers} of ${LAYERS.length + 1} drummers were playing`, color: PAL.cream });
  if (res.mode === 'echo') blocks.push({ p: `Rounds: ${res.rounds.map((a) => Math.round(a * 100)).join(' \u00b7 ')}`, color: PAL.dim });
  if (res.unlock) blocks.push({ p: `New rhythm unlocked: ${res.unlock}`, color: '#8de6b0' });
  if (Math.abs(res.meanMs) >= 35 && s.perfect + s.good + s.ok >= 10) blocks.push({ p: `You tended to play ${Math.abs(res.meanMs)} ms ${res.meanMs < 0 ? 'early' : 'late'}. Settings > Calibrate can remove that.`, color: '#ffd9a0' });
  metrics.total = drawBlocks(ctx, RL.region, blocks, RL.z * 0.8, st.page.scroll, draws, {}) + 4; metrics.view = RL.region.h;
  scrollbar(ctx, R(M.x + M.w - 16, RL.region.y, 5, RL.region.h), st.page.scroll, metrics.total, metrics.view);
  buttonsDraw(ctx, st, L);
  const hb = RL.buttons.find((b) => b.id === 'home');
  if (hb) drawMoreLine(ctx, hb.r.x + hb.r.w / 2, hb.r.y + hb.r.h * 0.7, 19);
}

// ---- text pages ------------------------------------------------------------------------------------------------------------------------
function renderText(ctx, st, L) {
  backdrop(ctx, st, L, null);
  ctx.fillStyle = 'rgba(8,3,10,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const G = L.page, sc = TEXT_SCALES[st.prefs.textScaleIdx];
  let blocks, title, sub = null;
  if (st.scene === 'about') { blocks = ABOUT; title = 'About'; }
  else if (st.scene === 'how') { blocks = HOWTO; title = 'How to Play'; }
  else { const ch = rulesChapters()[st.page.chapter]; blocks = ch.blocks; title = 'Rules'; sub = `${st.page.chapter + 1} of ${RULES_CHAPTERS}: ${ch.title}`; }
  header(ctx, L, title, sub);
  const body = G.body; panel(ctx, R(body.x - 8, body.y - 6, body.w + 16, body.h + 12), { radius: 20, fill: 'rgba(20,9,18,0.7)', brand: true });
  const inner = R(body.x + 14, body.y + 10, body.w - 40, body.h - 20);
  metrics.total = drawBlocks(ctx, inner, blocks, sc, st.page.scroll, DRAWS) + 8; metrics.view = inner.h;
  scrollbar(ctx, R(body.x + body.w - 14, body.y + 6, 6, body.h - 12), st.page.scroll, metrics.total, metrics.view);
  buttonsDraw(ctx, st, L);
}

function renderSettings(ctx, st, L) {
  backdrop(ctx, st, L, null);
  ctx.fillStyle = 'rgba(8,3,10,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const G = L.page, sc = TEXT_SCALES[st.prefs.textScaleIdx], S = settingsLayout(L, sc);
  header(ctx, L, 'Settings', null);
  const body = G.body;
  metrics.total = S.total; metrics.view = body.h;
  ctx.save(); ctx.beginPath(); ctx.rect(body.x - 4, body.y, body.w + 8, body.h); ctx.clip();
  const big = sc > 1.4;
  for (const b of buttonsFor(st, L)) {
    if (!b.row) continue;
    panel(ctx, b.r, { radius: 18, fill: 'rgba(28,12,22,0.82)' });
    const ls = Math.round(30 * Math.max(1, sc * 0.85)), vs = Math.round(26 * Math.max(1, sc * 0.85));
    if (big) { txt(ctx, b.label, b.r.x + 22, b.r.y + b.r.h * 0.4, ls, { weight: 700 }); txt(ctx, b.value, b.r.x + 22, b.r.y + b.r.h * 0.82, vs, { color: PAL.gold, weight: 800 }); }
    else { txt(ctx, b.label, b.r.x + 22, b.r.y + b.r.h / 2 + ls * 0.35, ls, { weight: 700 }); if (b.id !== 's:offsetLabel') txt(ctx, b.value, b.r.x + b.r.w - 22, b.r.y + b.r.h / 2 + vs * 0.35, vs, { align: 'right', color: PAL.gold, weight: 800 }); else txt(ctx, b.value, b.r.x + b.r.w - 240, b.r.y + b.r.h / 2 + vs * 0.35, vs, { align: 'right', color: PAL.gold, weight: 800 }); }
  }
  for (const b of buttonsFor(st, L)) if (b.scrolled) button(ctx, b.r, b.label, { size: b.size });
  ctx.restore();
  scrollbar(ctx, R(body.x + body.w - 4, body.y, 6, body.h), st.page.scroll, metrics.total, metrics.view);
  buttonsDraw(ctx, st, L);
}

function renderCalibrate(ctx, st, L) {
  backdrop(ctx, st, L, null);
  ctx.fillStyle = 'rgba(8,3,10,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  const C = st.calib, G = L.page, cx = L.w / 2, cy = L.h * 0.42;
  header(ctx, L, 'Calibrate timing', null);
  const lines = C.phase === 'idle' ? ['Tap anywhere along with the bell.', 'A steady bell will play. Tap on every beat.', 'Tap once to begin.'] : C.phase === 'run' ? ['Keep tapping with the bell.', ''] : C.offset === null ? ['Not enough taps to measure.', 'Try again and tap with every beat.'] : [`Your offset: ${C.offset} ms`, C.offset > 0 ? 'You tend to tap a little late. The game will count that in.' : 'You tend to tap a little early. The game will count that in.'];
  lines.forEach((t, i) => txt(ctx, t, cx, cy - 120 + i * 44, i === 0 ? 40 : 28, { align: 'center', color: i === 0 ? PAL.gold : PAL.cream, weight: 700, font: i === 0 ? 'display' : undefined }));
  if (C.phase === 'run') {
    let near = 9; for (const b of C.beats) near = Math.min(near, Math.abs(C.t - b));
    const k = Math.max(0, 1 - near / 0.2);
    const gr = ctx.createRadialGradient(cx, cy + 70, 10, cx, cy + 70, 170); gr.addColorStop(0, rgba('#f4c46a', 0.25 + 0.6 * k)); gr.addColorStop(1, rgba('#f4c46a', 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy + 70, 170, 0, 7); ctx.fill();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy + 70, 70 + 20 * k, 0, 7); ctx.stroke();
    txt(ctx, `${Math.min(C.taps.length, 99)} taps`, cx, cy + 190, 28, { align: 'center', color: PAL.dim });
  }
  buttonsDraw(ctx, st, L);
  void G;
}
function renderDemoLimit(ctx, st, L) {
  backdrop(ctx, st, L, null);
  ctx.fillStyle = 'rgba(8,3,10,0.6)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = L.modal(620, 520);
  panel(ctx, M, { radius: 26, fill: 'rgba(30,13,24,0.96)', brand: true });
  txt(ctx, 'You are in the circle', M.x + M.w / 2, M.y + 100, 50, { align: 'center', font: 'display', color: PAL.gold });
  wrap(ctx, 'The free web version lets you play a few sessions. Get the full game on iPhone and Android for every rhythm, the whole circle and unlimited play.', M.w - 80, 28).forEach((l, i) => txt(ctx, l, M.x + M.w / 2, M.y + 170 + i * 40, 28, { align: 'center', weight: 500 }));
  buttonsDraw(ctx, st, L);
}
void brandGradient; void edgeStroke; void DIFFICULTY; void GRADE_POINTS; void notation; void TITLE_CARDS;
