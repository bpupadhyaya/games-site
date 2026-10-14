// Drawing for every screen. render() is the single entry point; the singing screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, rgba, clamp, drawHall, drawStars, drawBead } from './art.js';
import { txt, button, panel, rrect, chip, wrap, minUnits } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderLab } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PIECES, PARTS, ASSIST, THINK, parsePiece, phraseBeats, pieceRange, centsOf, pieceSeconds, scaleOf } from './music.js';
import { drawCredit, drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { v3, flatAlpha } from './v3.js';

const TAU = Math.PI * 2;
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function render(ctx, st, L, view, meta, pauseItems, X) {
  const { w, h } = L, sc = st.scene;
  v3.heroRect = null; v3.choirRect = null; v3.title = null;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems, X); drawToast(ctx, st, L); return; }
  if (sc === 'lab') { renderLab(ctx, st, L, meta, X); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  drawHall(ctx, w + 4, h + 4, sc === 'result' && st.result ? 0.4 + 0.15 * st.result.stars : 0.3, st.t);
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'songs') renderSongs(ctx, st, L);
  else if (sc === 'piece') renderPiece(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 150, st.toast.text, 26, { align: 'center', fill: 'rgba(20,8,10,0.92)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('assist', 'Pitch assist', 'cycle', () => ASSIST[p.assistIdx].name, 'A magnet toward the ladder lines'),
    row('guide', 'Guide voice', 'toggle', () => p.guide, 'Quietly plays the voices you sing'),
    row('haptics', 'Vibration', 'toggle', () => p.haptics, 'On phones that support it'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and drifting motes'),
    row('think', 'Think time (s)', 'stepper', () => p.think, `${THINK.min} to ${THINK.max} seconds`),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', st.owned ? 'Full game unlocked' : 'Restore purchase', 'button', () => '', st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it? Get it back'), { btn: st.owned ? 'Unlocked' : st.restoreBusy ? 'Wait...' : 'Restore' })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- display text -------------------------------------------------------------------------------------------------------------------------
function titleText(ctx, cx, y, size, label, maxW, sub) {
  if (v3.on && v3.mix > 0.5) {                                          // the lettering is embossed gold in 3D: only the subtitle is 2D
    v3.title = { cx, y, size, label, maxW };
    if (sub) txt(ctx, sub, cx, y + size * 0.62, size * 0.2, PAL.text, { align: 'center', weight: 700 });
    return;
  }
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const mw = ctx.measureText(label).width;
  if (maxW && mw > maxW) { size *= maxW / mw; ctx.font = `700 ${size}px ${DISPLAY}`; }
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff3cf'); g.addColorStop(0.55, '#f4c765'); g.addColorStop(1, '#c9772c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#1a0a0a'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,170,80,0.55)'; ctx.shadowBlur = size * 0.24; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.62, size * 0.2, PAL.text, { align: 'center', weight: 700 });
}

// ---- a ribbon preview of a whole song (three rows of bars), used on the song cards and the song page --------------------------------------------
export function rollStrip(ctx, piece, r, mine = null, o = {}) {
  const P = parsePiece(piece), total = phraseBeats(piece) * 4, range = pieceRange(piece), span = range.hi - range.lo + 1;
  const pad = 8, W = r.w - pad * 2, H = r.h - pad * 2;
  ctx.fillStyle = 'rgba(8,3,4,0.45)'; rrect(ctx, r, 12); ctx.fill();
  for (let ph = 1; ph < 4; ph++) { ctx.fillStyle = 'rgba(255,225,170,0.12)'; ctx.fillRect(r.x + pad + (W * ph) / 4 - 1, r.y + pad * 0.5, 2, r.h - pad); }
  const rad = Math.max(2, Math.min(5, H / 26));
  for (let p = 0; p < 3; p++) {
    for (const ph of P[p]) {
      for (const n of ph) {
        if (n.deg === null) continue;
        const x = r.x + pad + (n.beat / total) * W, wd = Math.max(2, (n.dur / total) * W - 1.5), y = r.y + pad + H - ((centsOf(piece, n.deg) - range.lo) / span) * H;
        const on = mine ? mine[p] : true;
        ctx.fillStyle = rgba(PARTS[p].col, on ? 0.95 : 0.45); ctx.beginPath(); ctx.roundRect(x, y - rad, wd, rad * 2, rad); ctx.fill();
      }
    }
  }
  void o;
}

// ---- the title hero: three ribbons braid and lock -------------------------------------------------------------------------------------------------
function heroBraid(ctx, st, r) {
  const t = st.t, cyc = (t % 9) / 9;                                  // 0..1; the voices come together around 0.62
  const lockK = Math.max(0, Math.sin(Math.PI * clamp((cyc - 0.5) / 0.35, 0, 1)));
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.clip();
  ctx.fillStyle = 'rgba(8,3,4,0.38)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  const gl = ctx.createRadialGradient(r.x + r.w * 0.3, r.y + r.h / 2, 4, r.x + r.w * 0.3, r.y + r.h / 2, r.w * 0.5);
  gl.addColorStop(0, `rgba(255,236,170,${0.12 + 0.45 * lockK})`); gl.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = gl; ctx.fillRect(r.x, r.y, r.w, r.h);
  const mid = r.y + r.h / 2, amp = r.h * 0.34, nowX = r.x + r.w * 0.3;
  const yOf = (p, x) => {
    const phase = (x - r.x) / 90 - t * 1.4;
    const wander = Math.sin(phase * 0.9 + p * 2.1) * amp * (0.5 + 0.5 * (1 - lockK));
    const home = (p - 1) * amp * 0.62 * (1 - lockK * 0.85);
    return mid + home + wander * (1 - lockK * 0.8) * 0.8;
  };
  for (let p = 0; p < 3; p++) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [lw, a] of [[16, 0.16], [7, 0.9]]) {
      ctx.strokeStyle = rgba(PARTS[p].col, a); ctx.lineWidth = lw; ctx.beginPath();
      for (let x = r.x + 6; x <= r.x + r.w - 6; x += 6) { const y = yOf(p, x); if (x === r.x + 6) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,244,214,0.5)'; ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nowX, r.y + 8); ctx.lineTo(nowX, r.y + r.h - 8); ctx.stroke(); ctx.setLineDash([]);
  for (let p = 0; p < 3; p++) drawBead(ctx, nowX, yOf(p, nowX), Math.min(22, r.h * 0.11), p, { amp: 0.7, lock: lockK, t });
  ctx.restore();
}

// ---- title -----------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = !L.vert, size = T.size;
  const tcx = wide ? T.hero.x + T.hero.w / 2 : S.x + S.w / 2;
  titleText(ctx, tcx, T.titleY, size, 'THREE VOICES', (wide ? T.hero.w : S.w) - 40);
  txt(ctx, 'GEORGIAN POLYPHONY', tcx, T.titleY + size * 0.62, Math.max(20, size * 0.17) * Math.min(T.k, 1.5), PAL.gold, { align: 'center', weight: 800, maxW: (wide ? T.hero.w : S.w) - 40 });
  txt(ctx, 'Sing three-part harmony and make the chord lock.', tcx, T.titleY + size * 0.95, Math.max(22, size * 0.15) * Math.min(T.k, 1.5), PAL.text, { align: 'center', weight: 600, maxW: (wide ? T.hero.w : S.w) - 40 });
  v3.heroRect = T.hero;
  if (!v3.on || v3.mix < 1) { ctx.save(); ctx.globalAlpha = flatAlpha(); heroBraid(ctx, st, T.hero); ctx.restore(); }
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44 * T.k, icon: 'play' });
  button(ctx, T.free, 'Harmony Lab', { kind: 'quiet', size: 32 * T.k, icon: 'lab' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30 * T.k, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 * T.k });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 * T.k });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 * T.k });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 * T.k });
  const lw = Math.min(S.w * 0.5, 300), lh = lw * 354 / 1296;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y + 6 - lh, w: lw, h: lh }, 0.92)) drawCredit(ctx, T.credit.x, T.credit.y, 13);
}

// ---- songs ---------------------------------------------------------------------------------------------------------------------------------------------------
function renderSongs(ctx, st, L) {
  const G = L.songs, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a song', S.x + S.w / 2, G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], best = st.best[p.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(22,9,11,0.82)' }); edgeStroke(ctx, r, 24, 0.28);
    const pad = 22, small = r.h < 230;
    ctx.font = `700 ${Math.max(small ? 32 : 40, minUnits())}px ${DISPLAY}`; const nameW = ctx.measureText(p.name).width;
    ctx.font = `800 ${Math.max(20, minUnits())}px ${UI}`; const tagW = ctx.measureText(p.tag).width;
    const fitsTag = nameW + tagW + 24 <= r.w - pad * 2;
    txt(ctx, p.name, r.x + pad, r.y + r.h * (small ? 0.17 : 0.15), small ? 32 : 40, PAL.text, { font: DISPLAY, weight: 700, maxW: fitsTag ? r.w - pad * 2 - tagW - 16 : r.w - pad * 2 });
    if (fitsTag) txt(ctx, p.tag, r.x + r.w - pad, r.y + r.h * (small ? 0.17 : 0.15), 20, PAL.gold, { align: 'right', weight: 800 });
    const row2 = r.y + r.h * (small ? 0.36 : 0.32);
    chip(ctx, r.x + pad, row2, `${p.bpm} bpm`, 20, { fill: 'rgba(255,240,220,0.12)' });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < p.level ? PAL.amber : 'rgba(255,240,220,0.18)'; ctx.beginPath(); ctx.arc(r.x + pad + 118 + k * 22, row2, 7, 0, TAU); ctx.fill(); }
    txt(ctx, `${pieceSeconds(p)} s`, r.x + r.w - pad, row2, 20, PAL.dim, { align: 'right', weight: 700 });
    const sh = r.h * (small ? 0.34 : 0.34), sy = r.y + r.h * (small ? 0.46 : 0.42);
    rollStrip(ctx, p, { x: r.x + pad, y: sy, w: r.w - pad * 2, h: sh }, st.prefs.parts);
    drawStars(ctx, r.x + r.w - pad - 56, r.y + r.h - (small ? 22 : 28), small ? 24 : 28, best.stars || 0);
    txt(ctx, best.score ? `Best ${fmt(best.score)}` : scaleOf(p.scale).name, r.x + pad, r.y + r.h - (small ? 22 : 28), 20, best.score ? PAL.gold : PAL.dim, { weight: 700 });
    if (locked) { ctx.fillStyle = 'rgba(8,3,4,0.62)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'In the full game', r.x + r.w / 2, r.y + r.h / 2, 30, PAL.text, { align: 'center', weight: 800 }); }
  });
}

// ---- song ----------------------------------------------------------------------------------------------------------------------------------------------------
function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], best = st.best[p.id] ?? {}, sc = scaleOf(p.scale);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.name, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 48, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (D.back.w + 30) });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(22,9,11,0.78)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  const pad = 24, gap = clamp(I.h * 0.03, 12, 36), cx = I.x + I.w / 2;
  txt(ctx, p.tag.toUpperCase(), I.x + pad, I.y + 30, 20, PAL.gold, { weight: 800 });
  txt(ctx, `${sc.name} scale`, I.x + I.w - pad, I.y + 30, 24, PAL.text, { align: 'right', weight: 800, maxW: I.w * 0.55 });
  let y = I.y + 60;
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, I.w - pad * 2);
  lines.forEach((ln, i) => txt(ctx, ln, cx, y + i * 34 + 14, 26, PAL.text, { align: 'center', weight: 500 }));
  y += lines.length * 34 + gap;
  chip(ctx, cx - 150, y + 8, `${p.bpm} bpm`, 22, { align: 'center' }); chip(ctx, cx, y + 8, `${p.bpb} to the bar`, 22, { align: 'center' }); chip(ctx, cx + 150, y + 8, `${pieceSeconds(p)} s`, 22, { align: 'center' });
  y += 46 + gap;
  const room = I.y + I.h - 20 - y - 40;
  if (room > 80) {
    const rh = Math.min(room, 440);
    txt(ctx, 'THE THREE VOICES', I.x + pad, y + 6, 18, PAL.gold, { weight: 800 });
    rollStrip(ctx, p, { x: I.x + pad, y: y + 20, w: I.w - pad * 2, h: rh }, st.prefs.parts);
    y += rh + 20 + gap;
  }
  if (y < I.y + I.h - 26) {
    if (best.score) { txt(ctx, `Best ${fmt(best.score)}`, cx - 120, y + 8, 28, PAL.gold, { align: 'center', weight: 800 }); drawStars(ctx, cx + 110, y + 8, 30, best.stars || 0); }
    else txt(ctx, 'No score yet', cx, y + 8, 26, PAL.dim, { align: 'center', weight: 600 });
  }
  ctx.restore();
  const nf = st.prefs.parts.filter(Boolean).length;
  const pr = D.parts[2], pw = pr.x + pr.w - D.partsLabel.x;
  txt(ctx, 'WHICH VOICES DO YOU SING?', D.partsLabel.x + 2, D.partsLabel.y + 4, 19, PAL.gold, { weight: 800, maxW: pw * 0.64 });
  txt(ctx, nf === 1 ? 'one finger' : nf === 2 ? 'two fingers' : 'three fingers', D.partsLabel.x + pw - 2, D.partsLabel.y + 4, 19, PAL.text, { align: 'right', weight: 700, maxW: pw * 0.34 });
  D.parts.forEach((r, i) => {
    const on = st.prefs.parts[i], part = PARTS[i];
    ctx.fillStyle = on ? rgba(part.col, 0.28) : 'rgba(255,240,220,0.07)'; rrect(ctx, r, 16); ctx.fill();
    ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? part.col : 'rgba(255,230,200,0.25)'; rrect(ctx, r, 16); ctx.stroke();
    ctx.fillStyle = part.col; ctx.beginPath(); ctx.arc(r.x + 22, r.y + r.h / 2, 9, 0, TAU); ctx.fill();
    txt(ctx, part.name, r.x + 40, r.y + r.h * 0.38, Math.min(26, r.h * 0.4), PAL.text, { weight: 800, maxW: r.w - 46 });
    txt(ctx, on ? 'YOU' : 'friend', r.x + 40, r.y + r.h * 0.74, Math.min(18, r.h * 0.28), on ? part.hi : PAL.dim, { weight: 700 });
  });
  button(ctx, D.learn, 'Learn', { kind: 'primary', size: 32, sub: 'Listen, then echo each phrase' });
  button(ctx, D.perform, 'Sing', { kind: 'quiet', size: 32, sub: 'The whole song' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The ensemble sings, and why' });
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, pc = PIECES[r.piece];
  const split = L.mode !== 'tall' || p.h < 1000;
  panel(ctx, p, { fill: 'rgba(22,9,11,0.9)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.mode === 'learn' ? 'FINAL TAKE' : 'RESULT', p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  txt(ctx, pc.name, p.x + p.w / 2, p.y + 98, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1060, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.grade, lx, y, split ? 140 : 160 * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 12 });
  if (r.newBest) chip(ctx, lx, y + (split ? 96 : 100 * k), 'NEW BEST', 24, { align: 'center', fill: PAL.amber, color: '#2a1208' });
  let ry = split ? p.y + 168 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 34, PAL.text, { align: 'center', weight: 800, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', fmt(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, 'RESONANCE', `x${1 + 0.5 * (r.maxRes - 1)}`);
  ry += split ? 114 : 126;
  const cw = (rw - g * 4) / 5;
  ['perfect', 'great', 'good', 'off', 'miss'].forEach((kk, i) => { const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill(); txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 30, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 }); txt(ctx, (kk === 'off' ? 'near' : kk).toUpperCase(), x + cw / 2, ry + 62, 14, PAL.dim, { align: 'center', weight: 700, maxW: cw - 4 }); });
  ry += split ? 96 : 108;
  const hw = (rw - g * 2) / 3;
  [['CADENCES HELD', `${r.cadHeld} of ${r.cadTotal}`], ['BREATHS KEPT', `${r.breathKept} of ${r.breathKept + r.breathBroken}`], ['LOCKED', `${r.lockT.toFixed(0)} s`]].forEach(([lab, val], i) => {
    const x = rx0 + (hw + g) * i; ctx.fillStyle = 'rgba(255,240,220,0.05)'; rrect(ctx, { x, y: ry, w: hw, h: 70 }, 14); ctx.fill();
    txt(ctx, lab, x + hw / 2, ry + 20, 14, PAL.dim, { align: 'center', weight: 700, maxW: hw - 8 }); txt(ctx, val, x + hw / 2, ry + 48, 26, PAL.text, { align: 'center', weight: 800, maxW: hw - 8 });
  });
  ry += split ? 80 : 90;
  if (r.learn && r.learn.acc.length) {
    txt(ctx, 'Phrases', rx0 + 4, ry + 16, 22, PAL.gold, { weight: 800 });
    r.learn.acc.forEach((a, i) => chip(ctx, rx0 + 130 + i * 80, ry + 16, `${Math.round(a * 100)}%`, 22, { fill: a >= 0.75 ? 'rgba(56,196,180,0.45)' : 'rgba(255,240,220,0.14)' }));
  } else {
    const names = PARTS.filter((_, i) => r.parts[i]).map((q) => q.name).join(', ');
    txt(ctx, `You sang: ${names}`, rx0 + 4, ry + 16, 22, PAL.dim, { weight: 700, maxW: rw });
  }
  button(ctx, Rr.again, r.mode === 'learn' ? 'Learn again' : 'Sing again', { kind: 'primary', size: 30 });
  button(ctx, Rr.songs, 'Songs', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(22,9,11,0.92)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Three Voices on iPhone and Android: six songs, three voices to sing, Learn, Watch and Learn and the Harmony Lab.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
