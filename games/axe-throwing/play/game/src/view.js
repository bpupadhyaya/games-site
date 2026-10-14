// The play screen: the room, the board with its stuck axes, the axe in the air and in hand, the swing meter and the HUD.
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, playLayout, boardRect, boardToScreen, meta } from './layout.js';
import {
  BS, VENUES, AXES, LEVELS, RIVALS, ROUNDS, PER, bandsOf, meterP, turnsAt, tmOf, windAt, boardOffset, reticle, throwsPerRound,
  axesLeft, youTotal, rivalTotal, sway, clamp,
} from './sim.js';
import { THEMES, drawRoom, drawBoardUnits, drawAxe, drawStuck, drawReticle, drawChip, roundRectPath } from './art.js';
import { FONT, DISPLAY, drawButton, textShadow, wrapLines, ease } from './ui.js';
import { GL } from './glbridge.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(Math.min(1.6, TEXT_SCALES[state.settings.textIdx]), !!(state.run && state.run.mode === 'watch'));
const sideCol = (side) => (side === 'you' ? '#ffb83a' : '#35c9b6');

// the aim overlays (2D in both modes: the 3D board is framed exactly onto br): the hint ring and the reticle with the wind ghost
function drawAim(ctx, br, w, t, o, V, s) {
  if (o.hint) {
    const hp = boardToScreen(br, o.hint.hx, o.hint.hy), pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.beginPath(); ctx.arc(hp.x, hp.y, (60 + pulse * 10) * s * 1.6, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,236,130,${0.65 + 0.3 * pulse})`; ctx.setLineDash([14, 10]); ctx.stroke(); ctx.setLineDash([]);
    drawReticle(ctx, hp.x, hp.y, 22 * s * 1.6 + 8, { col: '#fff1a0', alpha: 0.85, dash: true });
  }

  // reticle
  const ret = o.noRet ? null : reticle(w);
  if (ret) {
    const p = boardToScreen(br, ret.x, ret.y);
    drawReticle(ctx, p.x, p.y, Math.max(16, 40 * s), { col: ret.rival ? '#35c9b6' : '#ffd24a', dash: ret.rival });
    if (!ret.rival && LEVELS[w.level].ghost && V.wind) {
      const g = boardToScreen(br, ret.x + windAt(V, w.t), ret.y);
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(Math.PI / 4); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
      const q = Math.max(7, 12 * s * 1.6); ctx.strokeRect(-q, -q, q * 2, q * 2); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }

}

// ---- the scene (room + board + axes); used by play and by the menu backdrop --------------------------------------------------
// o: { fx, hint, hand: bool, t, noRet }
export function drawScene(ctx, stage, br, w, t, o = {}) {
  const V = VENUES[w.venue], th = THEMES[w.venue], s = br.s, bo = boardOffset(V, w.t);
  if (GL.on) {
    // the 3D layer draws the room, the board, the people and every axe; only the aim overlays stay here
    GL.views.push({ kind: o.kind || 'att', rect: { x: stage.x, y: stage.y, w: stage.w, h: stage.h }, br: { x: br.x, y: br.y, w: br.w, h: br.h, s: br.s }, ws: w });
    drawAim(ctx, br, w, t, o, V, s);
    return;
  }
  const shake = o.fx && o.fx.shake > 0 ? o.fx.shake : 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
  if (shake > 0) ctx.translate(Math.sin(w.t * 90) * shake * 12, Math.cos(w.t * 77) * shake * 9);
  drawRoom(ctx, stage, br, th, t, { wind: windAt(V, w.t) });
  // rail trolley above a sliding board
  if (V.rail) {
    const bx = br.x + br.w / 2 + bo * s;
    ctx.fillStyle = '#7e8aa8'; roundRectPath(ctx, bx - br.w * 0.1, br.y - br.h * 0.075 - 12, br.w * 0.2, 26, 6); ctx.fill();
    ctx.strokeStyle = '#3a4260'; ctx.lineWidth = Math.max(3, br.w * 0.008);
    for (const dx of [-0.38, 0.38]) { ctx.beginPath(); ctx.moveTo(bx + dx * br.w * 0.5, br.y - br.h * 0.075 + 10); ctx.lineTo(bx + dx * br.w * 0.5, br.y + 4); ctx.stroke(); }
  }
  // posts for the open yard board
  if (th.key === 'yard') {
    ctx.fillStyle = '#4a2d14';
    for (const dx of [-0.32, 0.32]) ctx.fillRect(br.x + br.w / 2 + dx * br.w - br.w * 0.02, br.y + br.h * 0.9, br.w * 0.04, br.h * 0.2);
  }
  // board shadow, board, stuck axes
  ctx.save(); ctx.translate(br.x + br.w / 2 + bo * s, br.y + br.h / 2); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(-BS / 2 + 18, -BS / 2 + 24, BS, BS);
  drawBoardUnits(ctx, th);
  // flash on the ring that was just hit
  if (o.fx) for (const f of o.fx.flash) { const a = 1 - f.t / f.max; ctx.beginPath(); ctx.arc(f.x, f.y, 40 + f.t * 220, 0, TAU); ctx.lineWidth = 10 * a; ctx.strokeStyle = `rgba(255,240,170,${a})`; ctx.stroke(); }
  w.board.forEach((a, i) => drawStuck(ctx, a, th, o.fx && a.born !== undefined ? Math.max(0.05, w.t - a.born) : 1));
  ctx.restore();

  // chips and dust (screen units via board scale)
  if (o.fx) {
    for (const c of o.fx.chips) drawChip(ctx, { ...c, x: br.x + br.w / 2 + c.x * s, y: br.y + br.h / 2 + c.y * s }, Math.max(0.5, s * 1.6));
    for (const d of o.fx.dust) { const a = 1 - d.t / d.max; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.arc(br.x + br.w / 2 + d.x * s, br.y + br.h / 2 + d.y * s, (14 + d.t * 70) * s * 1.5, 0, TAU); ctx.fillStyle = th.key === 'night' ? '#aab4d8' : '#e8d2a8'; ctx.fill(); ctx.globalAlpha = 1; }
    // axes that bounced and fall
    for (const fa of o.fx.falls) {
      const p = boardToScreen(br, fa.x, fa.y);
      drawAxe(ctx, p.x, p.y, br.w * 0.34, fa.rot, sideCol(fa.side), { alpha: Math.max(0, 1 - fa.t / fa.max), dbl: AXES[w.axe].dbl });
    }
  }

  drawAim(ctx, br, w, t, o, V, s);
  const ret = o.noRet ? null : reticle(w);

  // the axe in the air
  const cxB = br.x + br.w / 2, hy = br.lane.y + br.lane.h * 0.5, handL = Math.min(br.w * 0.34, Math.max(60, br.lane.h * 0.84));
  if (w.f && w.phase === 'flight') {
    const f = w.f, k = clamp(f.t / f.dur, 0, 1), e = Math.pow(k, 0.92);
    const E = boardToScreen(br, f.ix, f.iy);
    const fx0 = f.side === 'you' ? cxB : cxB + br.w * 0.28;
    const trail = [0.0, 0.05, 0.1];
    for (let i = trail.length - 1; i >= 0; i--) {
      const kk = Math.max(0, k - trail[i]), ee = Math.pow(kk, 0.92);
      const x = fx0 + (E.x - fx0) * ee, y = hy + (E.y - hy) * ee - Math.sin(kk * Math.PI) * br.h * 0.14;
      const len = lerp(handL, br.w * 0.3, ee);
      drawAxe(ctx, x, y, len, f.turns * TAU * kk, sideCol(f.side), { alpha: i === 0 ? 1 : 0.22 / (i + 0.3), dbl: AXES[w.axe].dbl });
    }
    void e;
  } else if (!o.noHand && !w.over && (w.phase === 'ready' || w.phase === 'aim' || w.phase === 'settle')) {
    const side = w.phase === 'settle' ? (w.side === 'you' ? 'rival' : 'you') : w.side;
    const upcoming = w.phase === 'ready' || w.phase === 'aim' ? w.side : side;
    const tilt = ret ? clamp((boardToScreen(br, ret.x, 0).x - cxB) / br.w, -0.5, 0.5) * 0.35 : 0;
    const bob = w.phase === 'aim' && ret && !ret.rival ? Math.sin(t * 9) * 3 : 0;
    ctx.save(); ctx.globalAlpha = w.phase === 'settle' ? 0.35 : 1;
    drawAxe(ctx, cxB, hy + bob, handL, tilt, sideCol(upcoming), { dbl: AXES[w.axe].dbl });
    ctx.restore();
  }
  ctx.restore();
}
const lerp = (a, b, t) => a + (b - a) * t;

// ---- HUD ----------------------------------------------------------------------------------------------------------------------
function hudText(ctx, text, x, y, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${size}px ${o.font ?? FONT}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle';
  if (o.shadow !== false) textShadow(ctx, text, x, y, o.col ?? '#fff6e6', 5); else { ctx.fillStyle = o.col ?? '#fff6e6'; ctx.fillText(text, x, y); }
}
// a carved walnut plaque with a brass rim and a lit top edge
function chip(ctx, r) {
  const rad = Math.min(20, r.h / 2);
  ctx.save();
  roundRectPath(ctx, r.x, r.y + 3, r.w, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#4a2f1a'); g.addColorStop(0.5, '#33200f'); g.addColorStop(1, '#22150a');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#b98a3e'; ctx.stroke();
  roundRectPath(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, Math.max(4, rad - 4)); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,224,160,0.28)'; ctx.stroke();
  ctx.restore();
}

function drawMeter(ctx, G, w, state, fs) {
  chip(ctx, G);
  const L = LEVELS[w.level], bands = bandsOf(w), pad = 16, small = Math.max(10, Math.round(fs.lab * 0.62));
  const bx = G.x + pad, bw = G.w - 2 * pad, bh = Math.max(18, Math.round(G.h * 0.26)), by = G.y + G.h - pad * 0.7 - bh;
  const aiming = w.aim.down && w.side === 'you' && w.phase === 'aim';
  const p = aiming ? meterP(w.aim.mt, L.period) : null;
  // caption row
  hudText(ctx, 'SWING', bx, G.y + G.h * 0.2, small, { align: 'left', weight: 800, col: 'rgba(255,230,190,0.8)', shadow: false });
  const tm = tmOf(w.venue, w.axe);
  const info = p !== null ? `${turnsAt(tm, p).toFixed(2)} turns` : w.last ? lastText(w.last) : w.phase === 'aim' && w.side === 'you' ? 'Press the board to aim and start the swing' : w.side === 'rival' ? `${RIVALS[w.rival].name} is throwing` : '';
  hudText(ctx, info, bx + bw, G.y + G.h * 0.2, Math.max(11, Math.round(fs.lab * 0.78)), { align: 'right', weight: 700, col: p !== null && inBandNow(bands, p) ? '#9be8b0' : '#fff6e6', shadow: false });
  hudText(ctx, 'slow', bx + 2, by - small * 0.7, small, { align: 'left', weight: 600, col: 'rgba(255,230,190,0.55)', shadow: false });
  hudText(ctx, 'fast', bx + bw - 2, by - small * 0.7, small, { align: 'right', weight: 600, col: 'rgba(255,230,190,0.55)', shadow: false });
  // bar
  roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  ctx.save(); roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
  for (const b of bands) {
    const x0 = bx + b.lo * bw, x1 = bx + b.hi * bw, g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, '#b6f5c4'); g.addColorStop(1, '#2fae5e');
    ctx.fillStyle = g; ctx.fillRect(x0, by, Math.max(4, x1 - x0), bh);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(bx + b.c * bw - 1, by, 2, bh);
  }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,190,0.45)'; roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
  // the last throw's tick and the live marker
  if (w.last && p === null) {
    const lx = bx + clamp(w.last.p, 0, 1) * bw;
    ctx.fillStyle = 'rgba(255,214,150,0.9)'; ctx.beginPath(); ctx.moveTo(lx - 6, by - 7); ctx.lineTo(lx + 6, by - 7); ctx.lineTo(lx, by); ctx.fill();
  }
  if (p !== null) {
    const mx = bx + p * bw;
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(mx - 3, by - 6, 6, bh + 12);
    ctx.beginPath(); ctx.moveTo(mx - 10, by - 12); ctx.lineTo(mx + 10, by - 12); ctx.lineTo(mx, by - 1); ctx.closePath(); ctx.fill();
  }
}
const inBandNow = (bands, p) => bands.some((b) => p >= b.lo && p <= b.hi);
const lastText = (l) => (l.out === 'stick' ? `Stuck: ${l.pts} point${l.pts === 1 ? '' : 's'}` : l.out === 'miss' ? 'Missed the board' : l.out === 'deflect' ? 'Hit another axe' : l.delta > 0 ? `Turned ${l.turns.toFixed(2)}: too slow` : `Turned ${l.turns.toFixed(2)}: too fast`);

function drawAxeRack(ctx, x, y, n, total, size, side, dbl) {
  for (let i = 0; i < total; i++) drawAxe(ctx, x + i * size * 0.55, y, size, 0, i < n ? sideCol(side) : 'rgba(255,255,255,0.18)', { alpha: i < n ? 1 : 0.35, dbl });
}

function drawBoardPanel(ctx, B, w, state, fs) {
  chip(ctx, B);
  const R = RIVALS[w.rival], tall = B.h > B.w * 0.55, rounds = w.solo ? ROUNDS : ROUNDS;
  const rn = w.endless ? 'Practice' : w.sd ? 'Sudden death' : `Round ${Math.min(w.round + 1, ROUNDS)} of ${rounds}`;
  const yl = axesLeft(w, 'you'), rl = axesLeft(w, 'rival');
  const ic = Math.min(40, Math.max(22, B.h * (tall ? 0.1 : 0.34)));
  if (!tall) {
    hudText(ctx, rn, B.x + B.w / 2, B.y + B.h * 0.2, Math.max(12, Math.round(fs.small * 0.95)), { weight: 700, col: 'rgba(255,230,190,0.85)', shadow: false });
    const c1 = B.x + B.w * 0.25, c2 = B.x + B.w * 0.75, cy = B.y + B.h * 0.62;
    hudText(ctx, w.endless ? 'You' : 'You', c1 - B.w * 0.16, cy - B.h * 0.12, fs.small, { weight: 700, col: '#ffd97a', align: 'left' });
    hudText(ctx, `${w.endless ? w.sticks : youTotal(w)}`, c1 - B.w * 0.16, cy + B.h * 0.14, Math.round(fs.mid * 1.3), { weight: 800, font: DISPLAY, align: 'left', col: '#fff6e6' });
    if (!w.endless) drawAxeRack(ctx, c1 + B.w * 0.01, cy + B.h * 0.1, yl, PER, ic * 0.9, 'you', AXES[w.axe].dbl);
    if (!w.solo) {
      hudText(ctx, R.name, c2 - B.w * 0.16, cy - B.h * 0.12, fs.small, { weight: 700, col: '#7ff0de', align: 'left' });
      hudText(ctx, `${rivalTotal(w)}`, c2 - B.w * 0.16, cy + B.h * 0.14, Math.round(fs.mid * 1.3), { weight: 800, font: DISPLAY, align: 'left', col: '#fff6e6' });
      drawAxeRack(ctx, c2 + B.w * 0.01, cy + B.h * 0.1, rl, PER, ic * 0.9, 'rival', AXES[w.axe].dbl);
    } else if (!w.endless) {
      hudText(ctx, `${VENUES[w.venue].name}`, c2, cy - B.h * 0.1, fs.small, { weight: 700, col: 'rgba(255,230,190,0.9)' });
      hudText(ctx, AXES[w.axe].name, c2, cy + B.h * 0.16, Math.max(11, Math.round(fs.small * 0.85)), { weight: 600, col: 'rgba(255,230,190,0.7)' });
    }
  } else {
    let y = B.y + 22;
    hudText(ctx, rn, B.x + B.w / 2, y, fs.mid, { weight: 800, col: '#fff6e6' }); y += fs.mid * 1.5;
    const col = (cx2, name, tot, left, side, nameCol) => {
      hudText(ctx, name, cx2, y, fs.small, { weight: 700, col: nameCol });
      hudText(ctx, `${tot}`, cx2, y + fs.mid * 1.5, Math.round(fs.mid * 1.8), { weight: 800, font: DISPLAY, col: '#fff6e6' });
      drawAxeRack(ctx, cx2 - ic * 0.55, y + fs.mid * 3.4, left, PER, ic * 0.9, side, AXES[w.axe].dbl);
    };
    if (w.solo) col(B.x + B.w / 2, 'You', w.endless ? w.sticks : youTotal(w), yl, 'you', '#ffd97a');
    else { col(B.x + B.w * 0.27, 'You', youTotal(w), yl, 'you', '#ffd97a'); col(B.x + B.w * 0.73, R.name, rivalTotal(w), rl, 'rival', '#7ff0de'); }
    y += fs.mid * 4.8;
    const V = VENUES[w.venue], wd = windAt(V, w.t);
    const cond = [`${AXES[w.axe].name}`, V.wind ? `Wind ${Math.abs(wd) < 12 ? 'calm' : wd > 0 ? 'blowing right' : 'blowing left'}` : V.rail ? 'Board slides on a rail' : 'Still air'];
    cond.forEach((l, i) => hudText(ctx, l, B.x + B.w / 2, B.y + B.h - 16 - (cond.length - 1 - i) * fs.small * 1.5, fs.small, { weight: 600, col: 'rgba(255,230,190,0.75)', shadow: false }));
    ctx.font = `600 ${fs.small}px ${FONT}`;
    const hist = w.hist.filter((h) => !h.sd).map((h, i) => `R${i + 1}  ${h.you}${w.solo ? '' : ' - ' + h.rival}`);
    hist.forEach((l, i) => { if (y + i * fs.small * 1.4 < B.y + B.h - 8 - fs.small * 3.4) hudText(ctx, l, B.x + B.w / 2, y + i * fs.small * 1.4, fs.small, { weight: 600, col: 'rgba(255,230,190,0.8)', shadow: false }); });
  }
}

export function renderPlay(ctx, state) {
  const L = layoutOf(state), w = state.ws, run = state.run, t = state.t, watch = run.mode === 'watch';
  const br = boardRect(L.stage, VENUES[w.venue].rail);
  state.br = br;
  // The kit's preview pill would sit on the score chip: park it on the floor just under the board, left side.
  meta.previewBadge = W > H
    ? { x: L.stage.x + 8, y: L.stage.y + 8, align: 'left' }
    : { x: Math.max(L.stage.x + 8, br.x), y: Math.min(br.y + br.h + 6, L.stage.y + L.stage.h - 40), align: 'left' };
  drawScene(ctx, L.stage, br, w, t, { fx: state.fx, hint: state.hint, kind: 'play' });
  if (GL.on) { const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(8,4,0,0)'); g.addColorStop(1, 'rgba(8,4,0,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const fs = L.fs;

  // pops (score numbers) over the board
  for (const p of state.pops) {
    const a = p.t / p.max, sp = boardToScreen(br, p.x + (p.bo || 0), p.y), y = sp.y - 24 - a * 70;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - a * a); hudText(ctx, p.text, sp.x, y, Math.round(36 * p.size), { font: DISPLAY, weight: 800, col: p.col }); ctx.restore();
  }

  // score chip
  chip(ctx, L.score);
  const big = w.endless ? w.sticks : youTotal(w);
  hudText(ctx, `${big}`, L.score.x + L.score.w / 2, L.score.y + L.score.h * 0.42, fs.big, { font: DISPLAY, weight: 800, col: '#ffd97a' });
  const sub = w.endless ? 'axes stuck (practice)' : w.over ? 'finished' : `${VENUES[w.venue].name} · ${LEVELS[w.level].name}`;
  hudText(ctx, sub, L.score.x + L.score.w / 2, L.score.y + L.score.h - fs.small * 1.15, fs.small, { weight: 600, col: 'rgba(255,240,220,0.85)' });

  if (!watch) {
    drawButton(ctx, L.pause, 'Pause', { dark: true, size: fs.btn });
    drawButton(ctx, L.think, state.hint ? 'Hide' : 'Think', { dark: true, size: fs.btn, active: !!state.hint });
  } else {
    const D = L.demo, st = state.settings, dis = st.thinkIdx;
    drawButton(ctx, D.dec, '−', { dark: true, size: fs.btn, disabled: dis === 0 });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: fs.btn });
    drawButton(ctx, D.inc, '+', { dark: true, size: fs.btn, disabled: dis >= 3 });
    drawButton(ctx, D.exit, 'Exit', { dark: true, size: fs.btn });
  }

  drawMeter(ctx, L.gauge, w, state, fs);
  drawBoardPanel(ctx, L.bowl, w, state, fs);

  // banners
  if (state.banner) {
    const b = state.banner, a = b.t / b.max, k = a < 0.12 ? ease.outBack(a / 0.12) : 1, o = a > 0.8 ? 1 - (a - 0.8) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = o; ctx.translate(br.x + br.w / 2, br.y + br.h * 0.42); ctx.scale(k, k);
    ctx.font = `800 ${Math.round(Math.min(92, br.w * 0.13))}px ${DISPLAY}`;
    const tw = ctx.measureText(b.text).width + 60, th = Math.min(92, br.w * 0.13) * 1.9 + (b.sub ? 40 : 0);
    roundRectPath(ctx, -tw / 2, -th * 0.42, tw, th, 24); ctx.fillStyle = 'rgba(14,10,8,0.74)'; ctx.fill();
    hudText(ctx, b.text, 0, 0, Math.round(Math.min(92, br.w * 0.13)), { font: DISPLAY, weight: 800, col: b.col });
    if (b.sub) hudText(ctx, b.sub, 0, Math.min(62, br.w * 0.09), Math.round(Math.max(18, fs.mid)), { weight: 700, col: '#fff6e6' });
    ctx.restore();
  }
  // notes: Think text, Watch & Learn status, toast
  if (state.hint && !watch) drawNote(ctx, L.stage, state.hint.why, '#ffe9a0');
  else if (watch && state.dec) {
    const d = state.dec, left = Math.max(0, d.dur - d.t);
    const msg = d.phase === 'think' ? `Thinking… ${Math.ceil(left)} s` : d.phase === 'reveal' ? `Choosing: ${d.why}` : w.side === 'rival' ? `${RIVALS[w.rival].name} is throwing` : 'Throwing';
    drawNote(ctx, L.stage, msg, '#ffe9a0');
  } else if (state.toastT > 0 && state.toast) drawNote(ctx, L.stage, state.toast, '#fff6e6');
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(10,8,10,0.4)'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h);
    hudText(ctx, 'Paused', L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h / 2, 64, { font: DISPLAY, weight: 800, col: '#fff6e6' });
  }
  void turnsAt; void throwsPerRound; void sway; void wrapLines; void H; void W;
}

function drawNote(ctx, st, text, col) {
  const size = Math.min(26, Math.max(15, Math.round(st.w * 0.032))), pad = 12;
  ctx.font = `700 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, text, st.w - 70), h = lines.length * size * 1.25 + pad * 2, w = Math.min(st.w - 24, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + 6);
  const x = st.x + (st.w - w) / 2, y = st.y + st.h - h - 10;
  roundRectPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(16,10,8,0.84)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, st.x + st.w / 2, y + pad + size * 0.65 + i * size * 1.25));
}
