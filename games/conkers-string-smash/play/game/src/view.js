// The play screen: the two player cards on top, the scene (backdrop, arms, strings, conkers, particles) in the middle, the guide, the timing strip and the
// buttons at the bottom. Pure drawing from `state`; layout.js owns the frame. Everything is laid out from the live frame (FR.sw x H design units), so it
// fills a phone in portrait or landscape and a tablet alike.
import { FR, H, W, inRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { makeCam, drawBackdrop, drawDuel, drawParts, drawConker, patchArgs, TAU } from './scene.js';
import { L, R, PULL_MIN, PULL_MAX, bobPos, HAND_RANGE } from './sim.js';
import { countName, countLabel, stageOf, STAGE_NAMES, kindOf, GOES, CUP_ROUNDS } from './engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const nameOf = (state, side) => {
  const m = state.m;
  if (!m) return side === 0 ? 'You' : 'Rival';
  return m.names[side];
};
export const sideLabel = (state, side) => { const n = nameOf(state, side); return n === 'You' ? 'You' : n; };

// ---- layout ------------------------------------------------------------------------------------------------------------------------------
// Portrait: a turn strip on top, the scene, the two conker cards, then the tray (guide, timing strip, buttons). Landscape: the cards and the thumb
// buttons sit in two side columns, the scene fills the middle and the guide and timing strip run under it.
export function computeLayout(state) {
  const sw = FR.sw, ins = FR.ins, land = FR.land, sc = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  const left = Math.max(14, ins.l + 10), right = sw - Math.max(14, ins.r + 10);
  const top = Math.max(8, ins.t + 6), bot = Math.max(8, ins.b + 6);
  const watch = state.m && state.m.cfg.mode === 'watch';
  const R_ = {};
  const place = (id, x, y, w, h) => { R_[id] = { x, y, w, h }; };
  const row = (ids, weights, y, h, x0, x1) => {
    const gap = 10, tot = weights.reduce((a, b) => a + b, 0), avail = x1 - x0 - gap * (ids.length - 1);
    let x = x0;
    ids.forEach((id, i) => { const w = (avail * weights[i]) / tot; R_[id] = { x, y, w, h }; x += w + gap; });
  };
  if (!land) {
    const stripH = Math.round(46 * Math.min(1.25, sc)), trayH = Math.round(214 * (0.9 + 0.1 * sc)), cardH = Math.round(clamp(H * 0.115, 128, 200) * (0.95 + 0.05 * sc));
    const trayY = H - bot - trayH, cardY = trayY - cardH - 6;
    const cw = (right - left - 12) / 2;
    const cardL = { x: left, y: cardY, w: cw, h: cardH }, cardR = { x: left + cw + 12, y: cardY, w: cw, h: cardH };
    const strip = { x: left, y: top, w: right - left, h: stripH };
    const scene = { x: 0, y: top + stripH, w: sw, h: cardY - (top + stripH) - 6 };
    const btnH = 92, chipH = 38, tsH = 58;
    const guide = { x: left, y: trayY, w: right - left, h: chipH }, timing = { x: left, y: trayY + chipH + 6, w: right - left, h: tsH };
    const by = trayY + trayH - btnH;
    if (watch) row(['wexit', 'wdec', 'wpause', 'winc', 'more'], [1.1, 0.8, 1.5, 0.8, 1.1], by, btnH, left, right);
    else if (state.humanTurn) row(['menu', 'think', 'handdn', 'handup', 'swing'], [1, 1, 1, 1, 1.6], by, btnH, left, right);
    else row(['menu'], [1], by, btnH, left, left + (right - left) * 0.22);
    return { cardL, cardR, strip, scene, guide, timing, rects: R_, trayY, trayH, land, sc, left, right, sw, cardH, cardY };
  }
  // landscape
  const cw = clamp(sw * 0.19, 230, 330), cardH = 126, gap = 10;
  const cardL = { x: left, y: top, w: cw, h: cardH }, cardR = { x: right - cw, y: top, w: cw, h: cardH };
  const midX0 = left + cw + 16, midX1 = right - cw - 16;
  const chipH = 36, tsH = 52, guideY = H - bot - chipH - tsH - 6;
  const guide = { x: midX0, y: guideY, w: midX1 - midX0, h: chipH }, timing = { x: midX0, y: guideY + chipH + 6, w: midX1 - midX0, h: tsH };
  const stripH = 40;
  const strip = { x: midX0, y: top, w: midX1 - midX0, h: stripH };
  const scene = { x: midX0, y: top + stripH - 6, w: midX1 - midX0, h: guideY - (top + stripH - 6) - 4 };
  const y1 = top + cardH + gap, bh = 82;
  if (watch) {
    place('wexit', left, y1, cw, bh); place('wpause', left, y1 + bh + gap, cw, 110);
    row(['wdec', 'winc'], [1, 1], y1, bh, right - cw, right); place('more', right - cw, y1 + bh + gap, cw, bh);
  } else if (state.humanTurn) {
    place('menu', left, y1, cw, bh); place('think', left, y1 + bh + gap, cw, bh);
    row(['handup', 'handdn'], [1, 1], y1, bh, right - cw, right);
    place('swing', right - cw, H - bot - 120, cw, 120);
  } else place('menu', left, y1, cw, bh);
  const ly = y1 + bh * 2 + gap * 2;
  const lens = { x: left, y: ly, w: cw, h: Math.min(H - bot - 6 - ly, cw * 1.25) };
  return { cardL, cardR, strip, scene, guide, timing, rects: R_, trayY: guideY, trayH: H - bot - guideY, land, sc, left, right, sw, cardH, lens };
}

// ---- cards ------------------------------------------------------------------------------------------------------------------------------
function drawCard(ctx, r, state, side, lay) {
  const m = state.m, duel = m.duel, c = duel.c[side], k = kindOf(c.kind), striker = duel.striker === side && !duel.over;
  const f = clamp(r.h / 124, 0.8, 1.7) * Math.min(1.25, lay.sc);
  const name = nameOf(state, side);
  ctx.save();
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(38,20,9,0.9)', stroke: striker ? 'rgba(255,214,110,0.95)' : 'rgba(217,174,82,0.35)', lw: striker ? 3.5 : 2, shadow: true });
  // the conker picture
  const pr = Math.min(r.h * 0.3, 46 * Math.min(1.5, f)), px = r.x + 14 + pr, py = r.y + r.h * 0.5;
  drawConker(ctx, px, py, pr, { psi: c.psi, rot: 0, dmg: c.dmg, seed: side ? 7 : 3, glow: striker ? 0.5 : 0, alpha: c.dmg >= 1 ? 0.3 : 1 });
  const tx = px + pr + 12, tw = r.x + r.w - tx - 10;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let fs = Math.round(26 * f);
  ctx.font = `700 ${fs}px ${FONT}`; while (ctx.measureText(name).width > tw && fs > 13) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillStyle = '#fff3d6'; ctx.fillText(name, tx, r.y + 10 + fs * 0.9);
  let fs2 = Math.round(18 * f);
  const sub = `${k.name} · ${countName(c.count)}`;
  ctx.font = `400 ${fs2}px ${FONT}`; while (ctx.measureText(sub).width > tw && fs2 > 10) { fs2--; ctx.font = `400 ${fs2}px ${FONT}`; }
  ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fillText(sub, tx, r.y + 10 + fs * 0.9 + fs2 * 1.3);
  // the damage bar and its word
  const bh = Math.round(13 * Math.min(1.5, f)), by = r.y + r.h - 12 - bh;
  const stg = stageOf(c);
  let fs3 = Math.round(16 * f); ctx.font = `400 ${fs3}px ${FONT}`; while (ctx.measureText(STAGE_NAMES[stg]).width > tw && fs3 > 10) { fs3--; ctx.font = `400 ${fs3}px ${FONT}`; }
  ctx.fillStyle = 'rgba(255,233,191,0.82)'; ctx.fillText(STAGE_NAMES[stg], tx, by - 5);
  roundPath(ctx, tx, by, tw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const frac = clamp(c.dmg, 0, 1);
  if (frac > 0) { roundPath(ctx, tx, by, Math.max(bh, tw * frac), bh, bh / 2); ctx.fillStyle = stg >= 3 ? '#e24a2a' : stg === 2 ? '#e8892a' : '#e6c04a'; ctx.fill(); }
  if (striker) {
    const tf = Math.round(13 * f); ctx.font = `700 ${tf}px ${FONT}`; ctx.fillStyle = '#ffd45c';
    const tagW = ctx.measureText('SWINGING').width;
    if (tagW + ctx.measureText(STAGE_NAMES[stg]).width + 20 < tw) { ctx.textAlign = 'right'; ctx.fillText('SWINGING', r.x + r.w - 12, by - 5); }
  }
  ctx.restore();
}

// ---- tray widgets ------------------------------------------------------------------------------------------------------------------
const GUIDE_COL = { miss: '#c9bfa5', glance: '#f0c456', solid: '#7fd06f', crush: '#ff8a4a' };
function guideChip(ctx, r, state, lay) {
  const g = state.guide;
  roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(30,16,7,0.8)'; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let text = '', col = '#fff3d6';
  const sc = Math.min(1.3, lay.sc);
  if (state.ph === 'aim' && state.humanTurn) {
    if (!state.settings.guide) text = state.drag ? 'Let go to swing' : 'Drag the conker back, then let go';
    else if (g) { text = g.text; col = GUIDE_COL[g.kind] ?? col; } else text = 'Drag the conker back, then let go';
  } else if (state.ph === 'think' && state.think) {
    const th = state.think;
    text = th.phase === 'think' ? `${nameOf(state, state.m.duel.striker)} is thinking...` : th.phase === 'reveal' ? 'The plan' : 'Swinging...';
  } else if (state.ph === 'swing') text = 'Swing!';
  else if (state.ph === 'result') text = state.m.duel.last && state.m.duel.last.hit ? 'Touch!' : 'Missed';
  let fs = Math.round((lay.land ? 18 : 22) * sc);
  ctx.font = `700 ${fs}px ${FONT}`; while (ctx.measureText(text).width > r.w - 28 && fs > 12) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillStyle = col; ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
}
function timingStrip(ctx, r, state, lay) {
  roundPath(ctx, r.x, r.y, r.w, r.h, 12); ctx.fillStyle = 'rgba(30,16,7,0.7)'; ctx.fill();
  const bars = state.strip, n = bars ? bars.length : 0;
  if (!n) return;
  const pad = 8, bw = (r.w - pad * 2) / n, bh = r.h - 20;
  for (let i = 0; i < n; i++) {
    const b = bars[i], q = b.hit ? clamp(0.18 + b.E / 2.6, 0.18, 1) : 0.05;
    ctx.fillStyle = !b.hit ? 'rgba(200,190,165,0.35)' : b.weak ? '#ffcf3d' : b.E > 1.4 ? '#ff8a4a' : b.E > 0.55 ? '#7fd06f' : '#cfd08a';
    const h = bh * q;
    roundPath(ctx, r.x + pad + i * bw + 1, r.y + 6 + (bh - h), Math.max(2, bw - 2), Math.max(3, h), 2); ctx.fill();
  }
  ctx.font = `400 ${Math.round(14 * Math.min(1.3, lay.sc))}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.85)'; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.fillText('now', r.x + pad, r.y + r.h - 4);
  ctx.textAlign = 'right'; ctx.fillText('later: tall = good moment, gold = pale patch', r.x + r.w - pad, r.y + r.h - 4);
  // the "now" marker
  ctx.fillStyle = '#fff3d6'; ctx.fillRect(r.x + pad - 1, r.y + 4, 2, bh + 2);
}

function drawTray(ctx, state, lay) {
  const R_ = lay.rects, watch = state.m.cfg.mode === 'watch';
  const sz = lay.land ? 24 : 26;
  const dis = (b) => !!b;
  void dis;
  if (watch) {
    const th = state.thinkSecs;
    drawButton(ctx, R_.wexit, 'Exit', { dark: true, size: sz });
    drawButton(ctx, R_.wdec, '−', { disabled: state.settings.thinkIdx === 0, size: sz + 6 });
    drawButton(ctx, R_.wpause, state.paused ? 'Resume' : 'Pause', { primary: true, size: sz + 2 });
    drawButton(ctx, R_.winc, '+', { disabled: state.settings.thinkIdx === THINK_STEPS.length - 1, size: sz + 6 });
    drawButton(ctx, R_.more, 'Why?', { dark: true, size: sz });
    ctx.textAlign = 'center'; ctx.font = `400 ${Math.round(16 * Math.min(1.3, lay.sc))}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`thinking time ${th} s`, (R_.wdec.x + R_.winc.x + R_.winc.w) / 2, R_.wdec.y - 6);
    return;
  }
  const canAct = state.ph === 'aim' && state.humanTurn;
  drawButton(ctx, R_.menu, 'Menu', { dark: true, size: sz });
  if (!state.humanTurn) return;
  const busy = state.hint && state.hint.busy;
  drawButton(ctx, R_.think, busy ? '...' : 'Think', { dark: true, disabled: !canAct, size: sz });
  drawButton(ctx, R_.handdn, 'Hand ▼', { disabled: !canAct, size: sz - 3 });
  drawButton(ctx, R_.handup, 'Hand ▲', { disabled: !canAct, size: sz - 3 });
  drawButton(ctx, R_.swing, 'SWING', { primary: true, disabled: !canAct, size: sz + 4 });
}


// The touch preview: the two conkers at the moment of contact if the release were right now, magnified, with the pale patches drawn where they would be.
function drawLens(ctx, r, state, lay) {
  const g = state.guide, duel = state.m.duel, si = duel.striker, cs = duel.c[si], cd = duel.c[1 - si];
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(34,18,8,0.88)', stroke: 'rgba(217,174,82,0.45)', lw: 2 });
  const wide = r.w > r.h * 1.35, f = Math.min(1.3, lay.sc);
  const box = wide ? { x: r.x, y: r.y, w: r.h, h: r.h } : { x: r.x, y: r.y, w: r.w, h: r.h * 0.62 };
  const txt = wide ? { x: r.x + r.h, y: r.y, w: r.w - r.h, h: r.h } : { x: r.x, y: r.y + r.h * 0.6, w: r.w, h: r.h * 0.4 };
  ctx.save(); ctx.beginPath(); roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.clip();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(255,233,191,0.85)'; ctx.font = `700 ${Math.round(15 * f)}px ${FONT}`;
  ctx.fillText('TOUCH PREVIEW', box.x + box.w / 2, box.y + 22 * f);
  const e = g && g.first;
  if (e) {
    const sc = Math.min(box.w, box.h) * 0.17 / R, cx = box.x + box.w / 2, cy = box.y + box.h * 0.58;
    const dx = e.nx * R * sc, dy = e.ny * R * sc;
    const pD = patchArgs(cd.psi, -e.phiD, true), pS = patchArgs(cs.psi, e.phiS, false);
    drawConker(ctx, cx - dx, cy - dy, R * sc, { psi: pD.psi, pdir: pD.pdir, dmg: cd.dmg, seed: 7 });
    drawConker(ctx, cx + dx, cy + dy, R * sc, { psi: pS.psi, pdir: pS.pdir, dmg: cs.dmg, seed: 3, glow: 0.2 });
    ctx.fillStyle = '#ffd45c'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, R * sc * 0.12), 0, TAU); ctx.fill();
    ctx.font = `700 ${Math.round(14 * f)}px ${FONT}`; ctx.fillStyle = '#fff3d6';
    ctx.fillText('theirs', cx - dx - 0, cy - dy - R * sc * 1.18); ctx.fillText('yours', cx + dx, cy + dy + R * sc * 1.55);
  } else {
    let mf = Math.round(18 * f); ctx.font = `400 ${mf}px ${FONT}`;
    while (ctx.measureText('A release now would miss').width > box.w - 24 && mf > 10) { mf--; ctx.font = `400 ${mf}px ${FONT}`; }
    ctx.fillStyle = 'rgba(255,233,191,0.75)'; ctx.fillText('A release now would miss', box.x + box.w / 2, box.y + box.h * 0.58);
  }
  // numbers
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff3d6';
  const lines = e ? [`Their pale patch: ×${g.wD.toFixed(1)}`, `Your pale patch: ×${g.wS.toFixed(1)}`, `Their conker: +${Math.round(g.dD * 100)}%`, `Your conker: +${Math.round(g.dS * 100)}%`] : ['Wait for a good moment', 'in the timing strip.'];
  let fs = Math.round((wide ? 19 : 17) * f); ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = txt.w - 24; while (lines.some((l) => ctx.measureText(l).width > maxW) && fs > 11) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  const lh = fs * 1.4, y0 = txt.y + (txt.h - lh * lines.length) / 2 + fs;
  lines.forEach((l, i) => { ctx.fillStyle = e && i < 2 ? (i === 0 ? (g.wD > 1.45 ? '#ffd45c' : '#fff3d6') : (g.wS > 1.45 ? '#ff9a7a' : '#fff3d6')) : '#fff3d6'; ctx.fillText(l, txt.x + 14, y0 + i * lh); });
  ctx.restore();
}

// ---- overlays in the scene ------------------------------------------------------------------------------------------------------------------
function drawAimOverlay(ctx, cam, state, lay) {
  const sim = state.sim, ps = sim.ps, cx = cam.X(ps.x), cy = cam.Y(ps.y), k = cam.k;
  const sign = cam.mirror ? -1 : 1;
  // the arc the held conker will swing on
  ctx.save();
  ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = Math.max(2, k * 0.008); ctx.setLineDash([k * 0.012, k * 0.022]); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) { const phi = -sim.pull + (i / 34) * (sim.pull + 1.0); const p = bobPos(ps, phi); i ? ctx.lineTo(cam.X(p.x), cam.Y(p.y)) : ctx.moveTo(cam.X(p.x), cam.Y(p.y)); }
  ctx.stroke(); ctx.setLineDash([]);
  // the angle label next to the held conker
  const deg = Math.round((sim.pull * 180) / Math.PI);
  const bp = bobPos(ps, -sim.pull);
  ctx.font = `700 ${Math.round(Math.max(18, k * 0.045))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textShadow(ctx, `${deg}°`, cam.X(bp.x), cam.Y(bp.y) - R * k - Math.max(12, k * 0.035), '#fff3d6', 6);
  // the hand knob hint
  ctx.fillStyle = 'rgba(255,230,160,0.9)'; ctx.font = `700 ${Math.round(Math.max(14, k * 0.03))}px ${FONT}`;
  const hy = cam.Y(ps.y);
  ctx.strokeStyle = 'rgba(255,230,160,0.8)'; ctx.lineWidth = 3;
  const ax = cx - sign * k * 0.13, up = cam.Y(ps.y - HAND_RANGE), dn = cam.Y(ps.y + HAND_RANGE);
  ctx.beginPath(); ctx.moveTo(ax, up); ctx.lineTo(ax, dn); ctx.stroke();
  ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(ax, hy, Math.max(6, k * 0.014), 0, TAU); ctx.fill();
  ctx.restore();
  // the predicted meeting point
  if (state.guide && state.guide.at) {
    const px = cam.X(state.guide.at.x), py = cam.Y(state.guide.at.y), col = GUIDE_COL[state.guide.kind];
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, Math.max(8, k * 0.02), 0, TAU); ctx.stroke(); ctx.restore();
  }
}

function drawBanner(ctx, state, lay) {
  const b = state.banner;
  if (!b) return;
  const t = b.t, a = clamp(Math.min(t / 0.18, (b.dur - t) / 0.3), 0, 1), s = 0.8 + 0.2 * ease.outBack(t / 0.3);
  const cx = lay.scene.x + lay.scene.w / 2, bw = Math.min(FR.sw, lay.scene.w), cy = lay.scene.y + lay.scene.h * 0.34;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(s, s);
  const big = Math.min(b.size * Math.min(1.15, lay.sc), (bw - 40) / Math.max(4, b.text.length * 0.62));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${big}px ${NUM}`;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(6, big * 0.12); ctx.strokeStyle = 'rgba(40,18,6,0.9)'; ctx.strokeText(b.text, 0, 0);
  ctx.fillStyle = b.kind === 'bad' ? '#e8d9b5' : b.kind === 'gold' ? '#ffd45c' : '#fff3d6'; ctx.fillText(b.text, 0, 0);
  if (b.sub) {
    let fs = Math.round(Math.min(34, big * 0.42) * Math.min(1.2, lay.sc)); ctx.font = `700 ${fs}px ${FONT}`;
    const lines = wrapLines(ctx, b.sub, bw - 80);
    lines.forEach((l, i) => { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,18,6,0.85)'; ctx.strokeText(l, 0, big * 0.62 + i * fs * 1.2); ctx.fillStyle = '#fff3d6'; ctx.fillText(l, 0, big * 0.62 + i * fs * 1.2); });
  }
  ctx.restore();
}

// The thinking panel for a computer player in Watch & Learn: a short reason under the scene.
function drawThinkNote(ctx, state, lay) {
  const th = state.think;
  if (!th || state.m.cfg.mode !== 'watch') return;
  const text = th.text;
  if (!text || th.phase === 'think') {
    if (th.phase === 'think') {
      const r = lay.scene, w = Math.min(440, r.w - 60), x = r.x + (r.w - w) / 2, y = r.y + r.h - 44;
      roundPath(ctx, x, y, w, 20, 10); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
      roundPath(ctx, x, y, Math.max(20, w * clamp(th.t / Math.max(0.1, th.dur), 0, 1)), 20, 10); ctx.fillStyle = '#ffd45c'; ctx.fill();
    }
    return;
  }
  const r = lay.scene, w = Math.min(r.w - 30, 640), sc = Math.min(1.4, lay.sc);
  const fs = Math.round(20 * sc); ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, text, w - 36).slice(0, 5), h = lines.length * fs * 1.28 + 24;
  const x = r.x + (r.w - w) / 2, y = r.y + r.h - h - 8;
  panel(ctx, x, y, w, h, { r: 16, fill: 'rgba(30,16,7,0.86)', stroke: 'rgba(125,232,255,0.5)', lw: 2 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#e8fbff';
  lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 18 + fs * 0.85 + i * fs * 1.28));
}

export const statusText = (state) => (state.think && state.think.text) || (state.hint && state.hint.text) || '';
export const whyTitle = (state) => (state.m && state.m.cfg.mode === 'watch' ? 'Why this swing?' : 'About this hint');

// ---- the whole screen ----------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const lay = computeLayout(state), sw = FR.sw;
  const m = state.m, duel = m.duel, watch = m.cfg.mode === 'watch';
  const cam = makeCam(0, lay.scene.y, sw, lay.scene.h, state.mirror);
  state.cam = cam;
  // the screen shakes a little when two conkers meet
  const sh = state.shake > 0 ? state.shake : 0;
  ctx.save();
  if (sh > 0) ctx.translate(Math.sin(state.t * 90) * sh * 5, Math.cos(state.t * 71) * sh * 4);
  drawBackdrop(ctx, sw, H, state.t, cam.groundY);
  const o = { flash: state.flash > 0 ? state.flash : 0, glowS: state.ph === 'aim' ? 0.35 : 0 };
  const draw = (cs) => { /* conkers marked gone are not drawn */ void cs; };
  void draw;
  drawDuel(ctx, cam, state.sim, duel.c, duel.striker, o);
  if (state.ph === 'aim' && state.humanTurn) drawAimOverlay(ctx, cam, state, lay);
  if (state.hint && !state.hint.busy && state.hint.plan && state.ph === 'aim') {
    // the suggested pull as a ghost ring
    const p = bobPos(state.sim.ps, -state.hint.plan.pull);
    ctx.save(); ctx.strokeStyle = '#7de8ff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(cam.X(p.x), cam.Y(p.y), R * cam.k * 1.25, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (state.think && state.think.plan && (state.think.phase === 'reveal') && state.ph === 'think') {
    const p = bobPos(state.sim.ps, -state.think.plan.pull);
    ctx.save(); ctx.strokeStyle = '#7de8ff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(cam.X(p.x), cam.Y(p.y), R * cam.k * 1.25, 0, TAU); ctx.stroke(); ctx.restore();
  }
  drawParts(ctx, cam, state.parts);
  ctx.restore();
  // tray background and side panels
  if (!lay.land) {
    const tg = ctx.createLinearGradient(0, lay.trayY - 20, 0, H); tg.addColorStop(0, 'rgba(30,16,7,0)'); tg.addColorStop(0.15, 'rgba(30,16,7,0.72)'); tg.addColorStop(1, 'rgba(30,16,7,0.92)');
    ctx.fillStyle = tg; ctx.fillRect(0, lay.trayY - 20, sw, H - lay.trayY + 20);
  } else {
    const tg = ctx.createLinearGradient(0, lay.guide.y - 20, 0, H); tg.addColorStop(0, 'rgba(30,16,7,0)'); tg.addColorStop(0.2, 'rgba(30,16,7,0.7)'); tg.addColorStop(1, 'rgba(30,16,7,0.9)');
    ctx.fillStyle = tg; ctx.fillRect(lay.guide.x - 12, lay.guide.y - 20, lay.guide.w + 24, H - lay.guide.y + 20);
  }
  drawCard(ctx, lay.cardL, state, 0, lay);
  drawCard(ctx, lay.cardR, state, 1, lay);
  // the turn strip
  const sr = lay.strip;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const who = duel.over ? 'Duel over' : `${nameOf(state, duel.striker) === 'You' ? 'Your swing' : `${nameOf(state, duel.striker)} swings`}`;
  const goes = duel.over ? '' : `go ${duel.goes + 1} of ${GOES}`;
  let fs = Math.round((lay.land ? 24 : 26) * Math.min(1.3, lay.sc));
  const txt = `${who} · ${goes}${m.cfg.mode === 'cup' && state.cup ? ` · round ${state.cup.round + 1}/${CUP_ROUNDS}` : ''}`;
  ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(txt).width > sr.w && fs > 12) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  textShadow(ctx, txt, sr.x + sr.w / 2, sr.y + sr.h / 2, '#fff3d6', 6);
  // the kit's free-preview pill sits just under the turn line, never on top of it
  try { globalThis.__previewBadge = { y: (sr.y + sr.h + 2) * FR.s, align: 'center' }; } catch { /* no globalThis write: the pill keeps its default place */ }
  if (state.humanTurn && state.ph === 'aim' && !watch && state.settings.guide) {
    let lr = lay.lens;
    if (!lay.land) { const top = Math.min(cam.Y(0.72) + 14, lay.cardY - 150); lr = { x: lay.left, y: top, w: lay.right - lay.left, h: lay.cardY - 8 - top }; }
    if (lr && lr.h >= 130) drawLens(ctx, lr, state, lay);
  }
  drawBanner(ctx, state, lay);
  drawThinkNote(ctx, state, lay);
  guideChip(ctx, lay.guide, state, lay);
  if (state.humanTurn && state.ph === 'aim' && state.settings.guide) timingStrip(ctx, lay.timing, state, lay);
  else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `400 ${Math.round(18 * Math.min(1.3, lay.sc))}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.82)';
    const tip = watch ? (state.paused ? 'Paused: nothing moves until you tap Resume' : 'Watch & Learn: two computer players, with their reasons') : state.tip || '';
    wrapLines(ctx, tip, lay.timing.w - 20).slice(0, 2).forEach((l, i) => ctx.fillText(l, lay.timing.x + lay.timing.w / 2, lay.timing.y + 18 + i * 24));
  }
  drawTray(ctx, state, lay);
  if (state.curtain > 0) { ctx.fillStyle = `rgba(30,16,7,${clamp(state.curtain, 0, 1)})`; ctx.fillRect(0, 0, sw, H); }
}
export { countLabel, inRect, W, L };
