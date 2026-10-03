// The play screen: the table scene, the scoreboard above it, the controls below, banners and cards on top.
// Pure drawing and pure layout; game.js owns the state. computeLayout() is called by game.js for hit-testing (no canvas, text widths
// estimated) and by render (real text widths), and gives the same rectangles to both.
import { W, H, TEXT_SCALES, COMPACT, TRAY, SCENE_Y0, SCENE_H, PULL, playLayout } from './layout.js';
import { FONT, NUM, roundPath, drawButton, paintButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { drawRoom, drawTable, drawHoles, drawActors, drawRing, drawArc, drawRestMark, drawParts, proj, TAU, DISC_COL } from './scene.js';
import { PROFILES, pname } from './ai.js';
import { planPath } from './phys.js';
import { DISCS, leftFor, turnSide } from './engine.js';
import { tr } from './i18n.js';

export const sideName = (S, side) => {
  const c = S.m.cfg;
  if (c.mode === 'two') return tr(`Player ${side + 1}`, `Jugador ${side + 1}`);
  if (c.mode === 'watch') return pname(PROFILES[side === 0 ? c.watchA : c.opp]);
  if (c.mode === 'learn') return tr('You', 'Tú');
  return side === 0 ? tr('You', 'Tú') : pname(PROFILES[c.opp]);
};
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const zOf = (S) => TEXT_SCALES[S.settings.textIdx];
export const SPIN_NAMES = () => [tr('strong left spin', 'efecto fuerte a la izquierda'), tr('left spin', 'efecto a la izquierda'), tr('no spin', 'sin efecto'), tr('right spin', 'efecto a la derecha'), tr('strong right spin', 'efecto fuerte a la derecha')];
export const STYLE_NAMES = () => [tr('Lob', 'Alto'), tr('Drive', 'Rasante')];

// ---- the status line: what to do now ------------------------------------------------------------------------------------
export function phaseLine(S) {
  const m = S.m;
  if (m.cfg.mode === 'learn') return tr(`Lesson ${m.lesson.idx + 1}: ${m.lesson.title}`, `Lección ${m.lesson.idx + 1}: ${m.lesson.title}`);
  const who = sideName(S, turnSide(m)), you = who === tr('You', 'Tú');
  const n = DISCS - leftFor(m, turnSide(m)) + 1;
  const turn = you ? tr('Your turn', 'Tu turno') : tr(`${who}'s turn`, `Turno de ${who}`);
  return tr(`Round ${Math.min(m.round + 1, m.rounds)} of ${m.rounds}, disc ${Math.min(n, DISCS)} of ${DISCS}. ${turn}`, `Ronda ${Math.min(m.round + 1, m.rounds)} de ${m.rounds}, ficha ${Math.min(n, DISCS)} de ${DISCS}. ${turn}`);
}
export function statusText(S) {
  switch (S.ph) {
    case 'aim': return S.hint && !S.hint.busy ? S.hint.text : tr(`${STYLE_NAMES()[S.plan.style]}, ${SPIN_NAMES()[S.plan.spin + 2]}`, `${STYLE_NAMES()[S.plan.style]}, ${SPIN_NAMES()[S.plan.spin + 2]}`);
    case 'think': return S.think && S.think.text && S.think.phase !== 'think' ? S.think.text : tr('Thinking about the throw...', 'Pensando el tiro...');
    default: return '';
  }
}
export const whyTitle = (S) => (S.m.cfg.mode === 'watch' || S.ph === 'think' ? tr('Why this throw?', '¿Por qué este tiro?') : tr('The suggested throw', 'El tiro sugerido'));

// ---- layout ------------------------------------------------------------------------------------------------------------------
export function hudMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx;
  if (z <= COMPACT) {
    const cardH = Math.round(20 + 24 * z * 1.1 + 18 * z * 1.2 + 12), fs = Math.round(24 * z);
    return { compact: true, z, cardH, y: 44, h: 44 + cardH + 8 + Math.round(fs * 1.35) + 10, fs };
  }
  const fs = Math.round(26 * z), lines = [];
  const m = S.m;
  const pushWrapped = (text, o) => { cx.font = `${o.bold ? 700 : 400} ${fs}px ${FONT}`; wrapLines(cx, text, W - 72).forEach((l) => lines.push({ text: l, ...o })); };
  if (m.cfg.mode === 'learn') { const li = lessonInfo(S); pushWrapped(tr(`Throws left: ${li.left}`, `Tiros que quedan: ${li.left}`), { active: true, bold: true }); pushWrapped(`${li.goalName}: ${li.goalScore}`, { bold: true }); }
  else [0, 1].forEach((sd) => pushWrapped(`${sideName(S, sd)}: ${m.scores[sd]}`, { active: turnSide(m) === sd && !m.over, bold: true }));
  pushWrapped(phaseLine(S), {});
  return { compact: false, z, fs, lines, y: 40, h: 40 + lines.length * fs * 1.22 + 20 };
}
export function fitStatus(cx, text, fs, maxW, maxLines) {
  cx.font = `400 ${fs}px ${FONT}`;
  let lines = wrapLines(cx, text, maxW), more = false;
  if (lines.length > maxLines) { more = true; lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[ ,.;:]*$/, '') + '...'; }
  return { lines, more };
}
function trayMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx;
  const fs = Math.round(24 * z);
  const maxLines = S.m.cfg.mode === 'watch' ? 2 : Math.max(2, Math.floor((H * 0.24) / (fs * 1.22)));
  const { lines, more } = fitStatus(cx, statusText(S), fs, W - 110, maxLines);
  const mfs = Math.round(fs * 0.8), moreH = more ? mfs * 1.3 : 0;
  const bh = Math.round(26 * z * 1.15 + 38), rows = S.m.cfg.mode === 'watch' ? 2 : 1;
  return { fs, lines, more, mfs, bh, rows, h: 24 + lines.length * fs * 1.22 + moreH + 16 + rows * bh + (rows - 1) * 12 + 28 };
}
function compactStatus(S, ctx, z) {
  if (S.ph === 'aim' || !S.m) return null;
  const text = statusText(S);
  if (!text) return null;
  const cx = ctx ?? estCtx, fs = Math.round(22 * z);
  const { lines, more } = fitStatus(cx, text, fs, W - 70, 4);
  const mfs = Math.round(fs * 0.8), h = lines.length * fs * 1.25 + (more ? mfs * 1.3 : 0) + 18, y = (S.m.cfg.mode === 'watch' ? 1070 : 1010) - h;
  return { fs, lines, more, mfs, h, y, rect: { x: 24, y, w: W - 48, h } };
}
export function computeLayout(S, ctx) {
  const z = zOf(S), hud = hudMetrics(S, ctx);
  let tray = null, trayH = 0;
  if (z > COMPACT) { tray = trayMetrics(S, ctx); trayH = tray.h; }
  const lay = playLayout(z, hud.h, trayH);
  lay.hud = hud; lay.tray = tray; lay.z = z;
  lay.status = z <= COMPACT ? compactStatus(S, ctx, z) : null;
  lay.rects = rectsFor(S, lay);
  return lay;
}
const row = (y, h, items, x0 = 16, w = 688, gap = 10) => {
  const total = items.reduce((a, it) => a + it.w, 0), avail = w - gap * (items.length - 1), out = {};
  let x = x0;
  items.forEach((it) => { const ww = (it.w / total) * avail; out[it.id] = { x, y, w: ww, h }; x += ww + gap; });
  return out;
};
function rectsFor(S, lay) {
  const R = {};
  const m = S.m, ph = S.ph, mode = m.cfg.mode;
  const humanAim = ph === 'aim' && S.humanTurn;
  if (mode === 'watch') {
    const h = lay.compact ? 72 : lay.tray.bh, y = lay.compact ? 1086 : H - 28 - 2 * h - 12;
    Object.assign(R, row(y, h, [{ id: 'wdec', w: 1 }, { id: 'wlabel', w: 3 }, { id: 'winc', w: 1 }]));
    Object.assign(R, row(y + h + 12, h, [{ id: 'wpause', w: 2 }, { id: 'wexit', w: 1 }]));
    addMore(R, lay, y);
    return R;
  }
  if (lay.compact) {
    if (humanAim) {
      const t = TRAY.mode;
      Object.assign(R, row(t.y, t.h, [{ id: 'style0', w: 1.35 }, { id: 'style1', w: 1.35 }, { id: 'spin0', w: 1 }, { id: 'spin1', w: 1 }, { id: 'spin2', w: 1 }, { id: 'spin3', w: 1 }, { id: 'spin4', w: 1 }], 16, 688, 6));
      Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'think', w: 150 }, { id: 'throw', w: 260 }, { id: 'menu', w: 130 }], 16, 688, 10));
      if (S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    } else if (ph === 'fly') Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'skip', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'menu', w: 1 }]));
    addMore(R, lay, 0);
    return R;
  }
  const t = lay.tray, y = H - 28 - t.bh;
  const ids = humanAim ? [{ id: 'setup', w: 1 }, { id: 'throw', w: 1 }] : ph === 'fly' ? [{ id: 'skip', w: 1 }, { id: 'menu', w: 1 }] : [{ id: 'menu', w: 1 }];
  Object.assign(R, row(y, t.bh, ids));
  addMore(R, lay, y);
  return R;
}
function addMore(R, lay, btnTop) {
  if (lay.compact) { if (lay.status && lay.status.more) R.more = lay.status.rect; return; }
  const t = lay.tray;
  if (t && t.more) R.more = { x: 0, y: lay.trayTop, w: W, h: Math.max(40, btnTop - lay.trayTop - 4) };
}
export function hintGeom(S, lay) {
  const z = Math.min(lay.z, COMPACT), fs = Math.round(19 * z);
  estCtx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(estCtx, S.hint.text, W - 80);
  const y = lay.hud.h + 6, h = 16 + lines.length * fs * 1.25 + 14 + 58;
  return { y, h, fs, lines, use: { x: W / 2 - 130, y: y + h - 64, w: 260, h: 54 } };
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------
function fitFont(ctx, text, size, maxW, weight = 700, family = FONT) {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > 11) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
}
function pips(ctx, x, y, n, total, side) {
  const col = DISC_COL[side];
  for (let i = 0; i < total; i++) {
    ctx.beginPath(); ctx.arc(x + i * 22, y, 8, 0, TAU);
    if (i < n) { ctx.fillStyle = col.top1; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col.ring; ctx.stroke(); } else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,233,191,0.35)'; ctx.stroke(); }
  }
}
function drawCardRaw(ctx, x, y, w, h, z, name, score, sub, active, side, left) {
  panel(ctx, x, y, w, h, { r: 18, fill: active ? 'rgba(48,32,18,0.9)' : 'rgba(22,15,10,0.82)', stroke: active ? 'rgba(240,200,100,0.95)' : 'rgba(217,174,82,0.35)', lw: active ? 3 : 2, shadow: true });
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, String(score), 46 * z, w * 0.4, 800, NUM);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe7a8'; ctx.fillText(String(score), x + w - 14, y + h * 0.62);
  const sw = ctx.measureText(String(score)).width;
  const np = fitFont(ctx, name, 24 * z, w - sw - 40, 700);
  ctx.textAlign = 'left'; ctx.fillStyle = active ? '#fff3d6' : 'rgba(255,243,214,0.75)'; ctx.fillText(name, x + 14, y + 14 + np * 0.95);
  if (left !== undefined) pips(ctx, x + 22, y + h - 18, left, DISCS, side);
  else { fitFont(ctx, sub, 17 * z, w - 28, 400); ctx.fillStyle = 'rgba(255,233,191,0.72)'; ctx.fillText(sub, x + 14, y + h - 14); }
}
export function lessonInfo(S) {
  const L = S.m.lesson, left = L.tries - L.used, g = L.goal;
  const need = g.kind === 'rest' ? g.n : 1;
  return { left, tries: L.tries, goalName: tr('Goal', 'Meta'), goalScore: `${Math.min(L.got, need)}/${need}`, goalSub: g.kind === 'rest' ? tr('discs resting on the table', 'fichas quietas en la mesa') : g.kind === 'knock' ? tr('knock the silver disc away', 'saca la ficha plateada') : tr('disc dropped in a hole', 'ficha metida en un agujero') };
}

export function drawScene(ctx, S) {
  drawRoom(ctx, S.t);
  drawTable(ctx, S.t);
  drawHoles(ctx, S, S.t);
  const ov = S.overlay;
  if (ov) {
    if (ov.hint) { drawArc(ctx, planPath(ov.hint.plan), '#7de8ff', S.t); drawRing(ctx, ov.hint.plan.ax, ov.hint.plan.az, '#7de8ff', S.t, ''); }
    if (ov.plan) { drawArc(ctx, planPath(ov.plan.plan), ov.plan.col ?? '#ffe08a', S.t); drawRing(ctx, ov.plan.plan.ax, ov.plan.plan.az, ov.plan.col ?? '#ffe08a', S.t, ov.plan.label); if (ov.rest) drawRestMark(ctx, ov.rest.x, ov.rest.z, ov.plan.col ?? '#ffe08a'); }
  }
  drawActors(ctx, S.t, S.show, S.alpha, { holeFlash: S.holeFlash, simT: S.simT }, { hl: S.hl, hlCol: '#7dffa0' });
  drawParts(ctx, S.parts);
  if (S.closestLine) {
    const c = S.closestLine, a = proj(c.x, 0.01, c.z), b = proj(0, 0.01, 0.555);
    ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }
}
function drawBanner(ctx, S, lay) {
  const b = S.banner;
  if (!b) return;
  const k = Math.min(1, b.t / 0.28), e = ease.outBack(k), fade = b.dur - b.t < 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  const z = lay.z, cy = lay.compact ? 330 : lay.vy + 140 * lay.s;
  ctx.save();
  ctx.globalAlpha = fade;
  const pw = 640, size = Math.round((b.size ?? 76) * Math.min(1.3, 0.85 + z * 0.2));
  ctx.font = `800 ${size}px ${NUM}`;
  const px = fitFont(ctx, b.text, size, pw - 60, 800, NUM);
  const subSize = Math.round(26 * Math.min(z, 2.2));
  ctx.font = `400 ${subSize}px ${FONT}`;
  const subLines = b.sub ? wrapLines(ctx, b.sub, pw - 60) : [];
  const ph = px * 1.3 + subLines.length * subSize * 1.25 + 34;
  ctx.translate(360, cy); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
  roundPath(ctx, -pw / 2, -ph / 2, pw, ph, 26); ctx.fillStyle = 'rgba(18,11,6,0.9)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.kind === 'bad' ? '#d96a5a' : '#e9c15f'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${px}px ${NUM}`; ctx.fillStyle = b.kind === 'bad' ? '#ffb4a0' : '#ffe08a';
  ctx.fillText(b.text, 0, -ph / 2 + 20 + px * 0.9);
  ctx.font = `400 ${subSize}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  subLines.forEach((l, i) => ctx.fillText(l, 0, -ph / 2 + 20 + px * 1.25 + subSize * (1 + i * 1.25)));
  ctx.restore();
}
function drawHud(ctx, S, lay) {
  const hud = lay.hud, m = S.m;
  const g = ctx.createLinearGradient(0, 0, 0, hud.h + 30);
  g.addColorStop(0, 'rgba(8,5,3,0.92)'); g.addColorStop(0.85, 'rgba(8,5,3,0.6)'); g.addColorStop(1, 'rgba(8,5,3,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hud.h + 30);
  ctx.textBaseline = 'alphabetic';
  if (hud.compact) {
    if (m.cfg.mode === 'learn') {
      const li = lessonInfo(S);
      drawCardRaw(ctx, 14, hud.y, 344, hud.cardH, hud.z, tr('Throws left', 'Tiros que quedan'), li.left, tr(`Lesson ${m.lesson.idx + 1} of 6`, `Lección ${m.lesson.idx + 1} de 6`), true, 0);
      drawCardRaw(ctx, 362, hud.y, 344, hud.cardH, hud.z, li.goalName, li.goalScore, li.goalSub, false, 1);
    } else {
      [0, 1].forEach((sd) => drawCardRaw(ctx, sd ? 362 : 14, hud.y, 344, hud.cardH, hud.z, sideName(S, sd), m.scores[sd], '', turnSide(m) === sd && !m.over, sd, leftFor(m, sd)));
    }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,243,214,0.95)';
    fitFont(ctx, phaseLine(S), hud.fs, W - 40, 400);
    textShadow(ctx, phaseLine(S), W / 2, hud.y + hud.cardH + 8 + hud.fs, '#fff3d6', 6);
  } else {
    let y = hud.y;
    ctx.textAlign = 'left';
    hud.lines.forEach((l) => { ctx.font = `${l.bold ? 700 : 400} ${hud.fs}px ${FONT}`; textShadow(ctx, l.text, 36, y + hud.fs, l.active ? '#ffe08a' : '#fff3d6', 6); y += hud.fs * 1.22; });
  }
}
function drawTrayText(ctx, lay) {
  const t = lay.tray;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  t.lines.forEach((l, i) => { ctx.font = `400 ${t.fs}px ${FONT}`; textShadow(ctx, l, W / 2, lay.trayTop + 16 + t.fs * (1 + i * 1.22), '#fff3d6', 6); });
  if (t.more) { ctx.font = `700 ${t.mfs}px ${FONT}`; textShadow(ctx, tr('Tap here to read it all', 'Toca aquí para leerlo todo'), W / 2, lay.trayTop + 16 + t.fs * (1 + t.lines.length * 1.22) + t.mfs * 0.2, '#7de8ff', 6); }
}
function drawSpinBtn(ctx, r, i, active) {
  const { dy } = paintButton(ctx, r, { active, dark: !active });
  const sp = i - 2, cx = r.x + r.w / 2, mag = Math.abs(sp) / 2, dir = Math.sign(sp);
  const y1 = r.y + dy + r.h - 12, y0 = r.y + dy + 14;
  ctx.save();
  ctx.strokeStyle = '#fff7e6'; ctx.fillStyle = '#fff7e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (sp === 0) { ctx.beginPath(); ctx.moveTo(cx, y1); ctx.lineTo(cx, y0 + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, y0 - 2); ctx.lineTo(cx - 8, y0 + 10); ctx.lineTo(cx + 8, y0 + 10); ctx.closePath(); ctx.fill(); ctx.restore(); return; }
  const sx = cx - dir * mag * r.w * 0.16, ex = cx + dir * mag * r.w * 0.2, cxm = cx + dir * mag * r.w * 0.42;
  ctx.beginPath(); ctx.moveTo(sx, y1); ctx.quadraticCurveTo(cxm, (y0 + y1) / 2 + 6, ex, y0 + 6); ctx.stroke();
  const tx = ex - cxm, ty = (y0 + 6) - ((y0 + y1) / 2 + 6), tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
  ctx.beginPath(); ctx.moveTo(ex + ux * 8, y0 + 6 + uy * 8); ctx.lineTo(ex - uy * 8 - ux * 4, y0 + 6 + ux * 8 - uy * 4); ctx.lineTo(ex + uy * 8 - ux * 4, y0 + 6 - ux * 8 - uy * 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawTray(ctx, S, lay) {
  const R = lay.rects, z = lay.z, m = S.m, ph = S.ph;
  const humanAim = ph === 'aim' && S.humanTurn;
  if (lay.compact && !humanAim && ph !== 'fly') {
    const bar = ctx.createLinearGradient(0, 1060, 0, H); bar.addColorStop(0, 'rgba(8,5,3,0)'); bar.addColorStop(0.3, 'rgba(8,5,3,0.8)'); bar.addColorStop(1, 'rgba(8,5,3,0.95)'); ctx.fillStyle = bar; ctx.fillRect(0, 1060, W, H - 1060);
  } else {
    const top = lay.compact ? 1010 : lay.trayTop - 24;
    const bar = ctx.createLinearGradient(0, top, 0, H);
    bar.addColorStop(0, 'rgba(8,5,3,0)'); bar.addColorStop(0.2, 'rgba(8,5,3,0.82)'); bar.addColorStop(1, 'rgba(8,5,3,0.96)');
    ctx.fillStyle = bar; ctx.fillRect(0, top, W, H - top);
  }
  const size = Math.round(26 * Math.min(z, 3));
  const btn = (id, label, o = {}) => { if (R[id]) drawButton(ctx, R[id], label, { size, ...o }); };
  if (m.cfg.mode === 'watch') {
    if (!lay.compact) drawTrayText(ctx, lay);
    const big = !lay.compact;
    btn('wdec', big ? '−' : tr('Faster', 'Más rápido'), { dark: true, disabled: S.settings.thinkIdx === 0, size: big ? size : Math.round(size * 0.85) });
    btn('winc', big ? '+' : tr('Slower', 'Más lento'), { dark: true, disabled: S.settings.thinkIdx === 3, size: big ? size : Math.round(size * 0.85) });
    if (R.wlabel) { const r = R.wlabel, txt = big ? tr(`Think ${S.thinkSecs} s`, `Pensar ${S.thinkSecs} s`) : tr(`Thinking time ${S.thinkSecs} s`, `Tiempo de pensar ${S.thinkSecs} s`); ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, txt, Math.round(24 * z), r.w - 8, 700); ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2); }
    btn('wpause', S.paused ? tr('Resume', 'Seguir') : tr('Pause', 'Pausa'), { primary: true });
    btn('wexit', tr('Exit', 'Salir'), { dark: true });
    return;
  }
  if (lay.compact && humanAim) {
    const sn = STYLE_NAMES();
    btn('style0', sn[0], { active: S.plan.style === 0, dark: S.plan.style !== 0, size: Math.round(24 * z) });
    btn('style1', sn[1], { active: S.plan.style === 1, dark: S.plan.style !== 1, size: Math.round(24 * z) });
    for (let i = 0; i < 5; i++) drawSpinBtn(ctx, R[`spin${i}`], i, S.plan.spin === i - 2);
    btn('think', S.hint && S.hint.busy ? tr('Think...', 'Pensar...') : tr('Think', 'Pensar'), { dark: true, size: Math.round(24 * z) });
    btn('throw', tr('Throw', 'Lanzar'), { primary: true, size: Math.round(34 * Math.min(z, 1.4)) });
    btn('menu', tr('Menu', 'Menú'), { dark: true, size: Math.round(22 * z) });
    return;
  }
  if (lay.compact) { btn('skip', tr('Skip', 'Saltar'), { dark: true }); btn('menu', tr('Menu', 'Menú'), { dark: true, size: Math.round(22 * z) }); return; }
  drawTrayText(ctx, lay);
  btn('setup', tr('Set up', 'Preparar')); btn('throw', tr('Throw', 'Lanzar'), { primary: true });
  btn('skip', tr('Skip', 'Saltar'), { dark: true }); btn('menu', tr('Menu', 'Menú'), { dark: true });
}

// The pull: a band from where the finger went down to where it is now, with the disc in the finger.
function drawPull(ctx, S, lay) {
  const d = S.drag; if (!d || !d.pull) return;
  const toScr = (x, y) => ({ x: lay.vx + x * lay.s, y: lay.vy + (y - SCENE_Y0) * lay.s });
  const a = toScr(d.ax, d.ay), b = toScr(d.cx, d.cy);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,224,138,0.5)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(a.x, a.y, 10, 0, TAU); ctx.fillStyle = 'rgba(255,224,138,0.5)'; ctx.fill();
  // the small circle round the start is the cancel zone: let go inside it and nothing is thrown
  ctx.beginPath(); ctx.arc(a.x, a.y, PULL.min * lay.s, 0, TAU); ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,204,0.55)'; ctx.stroke(); ctx.setLineDash([]);
  const col = DISC_COL[turnSide(S.m) === 1 ? 1 : 0];
  const g = ctx.createRadialGradient(b.x - 10, b.y - 10, 4, b.x, b.y, 38); g.addColorStop(0, col.top0); g.addColorStop(0.6, col.top1); g.addColorStop(1, col.top2);
  ctx.beginPath(); ctx.arc(b.x, b.y, 36, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col.ring; ctx.stroke();
  // how far it will land, written beside the finger (kept inside the screen)
  const cm = Math.round(S.plan.az * 100), tx = tr(`Lands ${cm} cm out`, `Cae a ${cm} cm`);
  ctx.font = `700 22px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const tw = ctx.measureText(tx).width + 30, lx = Math.max(tw / 2 + 8, Math.min(W - tw / 2 - 8, b.x)), ly = b.y - 66;
  roundPath(ctx, lx - tw / 2, ly - 18, tw, 36, 18); ctx.fillStyle = 'rgba(18,11,6,0.86)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText(tx, lx, ly + 1);
  ctx.restore();
}
// The thrower's hand: a lit paddle with the next disc on it (nothing else of the thrower is drawn).
function drawHand(ctx, S, lay) {
  if (!(S.ph === 'aim' && S.humanTurn) || S.drag?.pull || !lay.compact) return;
  const col = DISC_COL[turnSide(S.m) === 1 ? 1 : 0], x = 360, y = 960 + Math.sin(S.t * 3) * 3;
  ctx.save();
  const gl = ctx.createRadialGradient(x, y, 20, x, y, 130); gl.addColorStop(0, 'rgba(255,224,138,0.35)'); gl.addColorStop(1, 'rgba(255,224,138,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 130, 0, TAU); ctx.fill();
  roundPath(ctx, x - 62, y + 6, 124, 26, 13); ctx.fillStyle = '#5a3418'; ctx.fill(); ctx.strokeStyle = '#d9ae52'; ctx.lineWidth = 2.5; ctx.stroke();
  const g = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 38); g.addColorStop(0, col.top0); g.addColorStop(0.6, col.top1); g.addColorStop(1, col.top2);
  ctx.beginPath(); ctx.ellipse(x, y, 38, 30, 0, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col.ring; ctx.stroke();
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (S.pullHintT > 0) { const tx = tr('Drag down to throw', 'Arrastra hacia abajo'); ctx.font = `700 22px ${FONT}`; const tw = ctx.measureText(tx).width + 36; roundPath(ctx, x - tw / 2, y - 82, tw, 38, 19); ctx.fillStyle = 'rgba(18,11,6,0.82)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText(tx, x, y - 56); }
  ctx.restore();
}
export function renderPlay(ctx, S) {
  const lay = computeLayout(S, ctx);
  ctx.fillStyle = '#0b0705'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip(); }
  ctx.translate(lay.vx, lay.vy - SCENE_Y0 * lay.s); ctx.scale(lay.s, lay.s);
  drawScene(ctx, S);
  ctx.restore();
  const vg = ctx.createRadialGradient(360, 600, 280, 360, 600, 860); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  drawHud(ctx, S, lay);
  if (!(S.m.cfg.mode === 'learn' && S.ph === 'intro')) drawBanner(ctx, S, lay);
  drawHand(ctx, S, lay);
  drawPull(ctx, S, lay);
  drawTray(ctx, S, lay);
  drawStatus(ctx, S, lay);
  if (S.toastT > 0 && S.toast) {
    ctx.font = `700 ${Math.round(22 * Math.min(lay.z, 2))}px ${FONT}`; const tw = Math.min(660, ctx.measureText(S.toast).width + 44);
    roundPath(ctx, 360 - tw / 2, lay.hud.h + 18, tw, 54 * Math.min(lay.z, 2), 16); ctx.fillStyle = 'rgba(18,11,6,0.92)'; ctx.fill();
    ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.toast, 360, lay.hud.h + 18 + 27 * Math.min(lay.z, 2));
  }
}
function drawLessonIntro(ctx, S, lay) {
  const L = S.m.lesson, z = lay.z, fs = Math.round(26 * Math.min(z, 2));
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, L.text, 580);
  const head = tr(`Lesson ${L.idx + 1}: ${L.title}`, `Lección ${L.idx + 1}: ${L.title}`);
  const tfs = fitFont(ctx, head, Math.round(40 * Math.min(z, 2)), 590, 800, NUM);
  ctx.font = `400 ${fs}px ${FONT}`;
  const h = Math.min(H - 120, 120 + tfs + lines.length * fs * 1.3), y = Math.max(40, (H - h) / 2);
  panel(ctx, 40, y, 640, h, { r: 26, fill: 'rgba(18,11,6,0.97)', stroke: '#e9c15f' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${tfs}px ${NUM}`; ctx.fillStyle = '#ffe08a'; ctx.fillText(head, 360, y + 24 + tfs);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  lines.forEach((l, i) => ctx.fillText(l, 360, y + 40 + tfs + fs * (1 + i * 1.3)));
  ctx.font = `700 ${Math.round(22 * Math.min(z, 2))}px ${FONT}`; ctx.fillStyle = '#bfe8ff'; ctx.fillText(tr('Tap to start', 'Toca para empezar'), 360, y + h - 20);
}
function drawStatus(ctx, S, lay) {
  if (S.m.cfg.mode === 'learn' && S.ph === 'intro') { drawLessonIntro(ctx, S, lay); return; }
  if (!lay.compact) return;
  if (S.ph === 'aim' && S.hint && !S.hint.busy) {
    const g = hintGeom(S, lay);
    roundPath(ctx, 24, g.y, W - 48, g.h, 18); ctx.fillStyle = 'rgba(14,9,5,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(125,232,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `400 ${g.fs}px ${FONT}`; ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    g.lines.forEach((l, i) => ctx.fillText(l, W / 2, g.y + 16 + g.fs * (1 + i * 1.25) - 4));
    drawButton(ctx, g.use, tr('Use this line', 'Usar esta jugada'), { primary: true, size: 24 });
    return;
  }
  if (S.ph === 'aim' && S.hint && S.hint.busy) {
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#bff3ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(tr('Testing throws on the real table...', 'Probando tiros en la mesa real...'), W / 2, lay.hud.h + 30); return;
  }
  const st = lay.status;
  if (!st) return;
  const { fs, lines, y, h } = st;
  roundPath(ctx, 24, y, W - 48, h, 16); ctx.fillStyle = 'rgba(18,11,6,0.86)'; ctx.fill();
  ctx.strokeStyle = 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (1 + i * 1.25) - 4));
  if (st.more) { ctx.font = `700 ${st.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText(tr('Tap here to read it all', 'Toca aquí para leerlo todo'), W / 2, y + 12 + fs * (1 + lines.length * 1.25) - 4 + st.mfs * 0.1); }
}
export { SCENE_H };
