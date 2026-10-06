// In-play HUD: scoreboard and clocks, prompts, role tags, the thumb controls (floating stick + four context buttons), the shot meter,
// Think / Watch panels and the 2D fallback court. Everything follows the 100-300% text size (through PLAY_M).
import { W, H, PLAY_M, layoutFor, inRect } from './layout.js';
import { FONT, C, UI, roundPath, drawButton, panel, wrapLines, drawScrollBar } from './ui.js';
import { ROLES, HOOP, ARC_R, ARC_X, HW, Z_BASE, Z_HALF } from './consts.js';
import { projectL } from './camera.js';

const TAU = Math.PI * 2;
export const TEAM_COL = ['#2f7be0', '#e0483a'];
export const ROLE_COL = ['#ffd23f', '#7fe8d6', '#ff9a86'];

// Which labels the four buttons carry right now, by what the human's player can do
export function controlState(G, sim) {
  const s = sim.s;
  const none = { a: null, b: null, c: null, d: null, mode: 'none', passIds: [-1, -1] };
  if (s.humanId < 0) return none;
  const p = s.players[s.humanId], B = s.ball;
  const mates = s.players.filter((q) => q.team === p.team && q.id !== p.id && !q.out).sort((a, b) => a.role - b.role);
  const passIds = [mates[0] ? mates[0].id : -1, mates[1] ? mates[1].id : -1];
  if (s.phase === 'over') return none;
  if (s.phase === 'ft') return { ...none, mode: 'ft', a: s.ft && s.ft.shooter === p.id ? { label: 'SHOOT' } : null };
  if (s.phase === 'dead') return none;
  const live = s.phase === 'live' || s.phase === 'ready';
  const ready = s.phase === 'ready';
  const hasBall = B.mode === 'held' && B.holder === p.id;
  const off = (l) => ({ label: l, off: true });
  if (ready) return { ...none, mode: 'ready', passIds, a: off('WAIT') };
  const lbl = (q) => ROLES[q.role].short;
  if (hasBall) {
    const ok = s.cleared && !ready;
    return { mode: 'ball', passIds, a: ok ? { label: 'SHOOT', hold: true } : off(ready ? 'WAIT' : 'CLEAR'), b: mates[0] && !ready ? { label: 'PASS', sub: lbl(mates[0]), col: ROLE_COL[mates[0].role] } : null, c: mates[1] && !ready ? { label: 'PASS', sub: lbl(mates[1]), col: ROLE_COL[mates[1].role] } : null, d: !ready ? (p.dstate === 'drib' ? { label: 'CROSS' } : { label: 'CROSS', off: true }) : null };
  }
  if (B.mode === 'held' && s.players[B.holder].team === p.team) return { mode: 'off', passIds, a: { label: 'CALL', hold: true }, b: { label: 'SCREEN', hold: true }, c: { label: 'CUT' }, d: null };
  if (B.mode === 'held') return { mode: 'def', passIds, a: ready ? off('WAIT') : { label: 'STEAL' }, b: { label: 'BLOCK' }, c: { label: 'BURST' }, d: null };
  return { mode: 'air', passIds, a: { label: 'JUMP' }, b: null, c: { label: 'BURST' }, d: null };
}

const fmtClock = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function badge(ctx, x, y, text, col = '#ffd54a', size = 22) {
  size = Math.max(UI.minf, size);
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 20;
  roundPath(ctx, x - w / 2, y - size, w, size * 1.5, 11); ctx.fillStyle = 'rgba(8,18,30,0.84)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 2); ctx.restore();
}

function scoreboard(ctx, G, s, lay) {
  const hl = lay.hud, sc = hl.score, m = hl.m;
  const tn = [s.humanId >= 0 ? 'You' : 'Blue', G.oppName || 'Red'];
  const clock = s.ot ? 'OVERTIME' : s.cfg.noClock ? '' : fmtClock(s.clock);
  const first = s.cfg.noClock ? '' : s.ot ? `First to ${s.otTarget}` : `First to ${s.target}`;
  const showSc = s.phase === 'live' || s.phase === 'ready';
  if (!sc.tall) {
    // landscape / squarish: one slim bar, Think | team score | clock + shot clock | team score | Pause (those two are drawn by renderHud)
    const k = sc.k, y = sc.y, h = sc.h, mf = UI.minf;
    const g = ctx.createLinearGradient(0, 0, 0, hl.barBottom + 18); g.addColorStop(0, 'rgba(6,14,26,0.9)'); g.addColorStop(1, 'rgba(6,14,26,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hl.barBottom + 18);
    for (const i of [0, 1]) {
      const left = i === 0, x0 = left ? sc.left : sc.right - sc.bw;
      ctx.fillStyle = TEAM_COL[i]; roundPath(ctx, left ? x0 : x0 + sc.bw - 8, y + 8, 8, h - 16, 4); ctx.fill();
      ctx.textBaseline = 'alphabetic';
      const scoreFs = Math.round(46 * k); ctx.font = `800 ${scoreFs}px ${FONT}`;
      const sw = ctx.measureText(String(s.score[i])).width;
      ctx.fillStyle = '#fff6e4'; ctx.textAlign = left ? 'right' : 'left';
      ctx.fillText(String(s.score[i]), left ? x0 + sc.bw : x0, y + h * 0.5 + scoreFs * 0.36);
      const nameW = sc.bw - 22 - sw - 10;
      const nf = fitFont(ctx, tn[i], 700, Math.max(mf, Math.round(21 * k)), nameW, mf);
      ctx.fillStyle = '#fff6e4'; ctx.textAlign = left ? 'left' : 'right';
      const tx = left ? x0 + 18 : x0 + sc.bw - 18;
      ctx.fillText(tn[i], tx, y + h * 0.42);
      ctx.fillStyle = s.fouls[i] >= 7 ? '#ff9a86' : 'rgba(255,246,228,0.68)'; ctx.font = `600 ${Math.max(mf, Math.round(15 * k))}px ${FONT}`;
      ctx.fillText(`Fouls ${s.fouls[i]}`, tx, y + h * 0.42 + Math.max(mf, Math.round(15 * k)) * 1.15);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4';
    const cf = fitFont(ctx, clock || ' ', 800, Math.round(34 * k), sc.cw * 0.74, Math.max(mf, 16));
    const cb = y + 28 + cf * 0.82, sf = Math.max(mf, Math.round(16 * k));
    ctx.fillText(clock, sc.cx - 6 * k, cb);
    ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${sf}px ${FONT}`;
    ctx.fillText(first, sc.cx - 6 * k, cb + sf * 1.2);
    if (showSc) {
      const low = s.shotClock <= 4, r = Math.round(17 * k), x = sc.cx + sc.cw / 2 - r - 2 * k, yy = cb - cf * 0.32;
      ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU); ctx.fillStyle = low ? '#c2382c' : 'rgba(8,18,30,0.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = low ? '#ffd0c8' : 'rgba(255,246,228,0.6)'; ctx.stroke();
      ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(r * 1.05)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.ceil(s.shotClock)), x, yy + 1); ctx.textBaseline = 'alphabetic';
    }
    return;
  }
  const th = hl.topH, colw = sc.colw, cx = W / 2, mf = UI.minf;
  const g = ctx.createLinearGradient(0, 0, 0, hl.top + th + 24); g.addColorStop(0, 'rgba(6,14,26,0.9)'); g.addColorStop(1, 'rgba(6,14,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hl.top + th + 24);
  ctx.save(); ctx.translate(0, hl.top);
  for (const i of [0, 1]) {
    const left = i === 0, x0 = left ? sc.left : sc.right - colw;
    ctx.fillStyle = TEAM_COL[i]; roundPath(ctx, x0, 12, 9, th - 36, 4); ctx.fill();
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const ax = left ? x0 + 20 : x0 + colw - 20;
    ctx.fillStyle = '#fff6e4'; fitFont(ctx, tn[i], 700, Math.round(21 * m), colw - 30, mf);
    ctx.fillText(tn[i], ax, 12 + 22 * m);
    ctx.font = `800 ${Math.round(56 * m)}px ${FONT}`; ctx.fillText(String(s.score[i]), ax, 12 + 22 * m + 52 * m);
    const ff = Math.max(mf, Math.round(15 * Math.min(m, 1.5)));
    ctx.fillStyle = s.fouls[i] >= 7 ? '#ff9a86' : 'rgba(255,246,228,0.68)'; ctx.font = `600 ${ff}px ${FONT}`;
    ctx.fillText(`Fouls ${s.fouls[i]}`, ax, 12 + 22 * m + 52 * m + ff * 1.2);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6e4'; const mc = Math.min(m, 1.5);
  const cf = fitFont(ctx, clock || ' ', 800, Math.round(40 * mc), 150, mf);
  ctx.fillText(clock, cx, 12 + 24 * mc + 30 * mc + 6 * (m - mc));
  const sf = Math.max(mf, Math.round(17 * mc));
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${sf}px ${FONT}`;
  ctx.fillText(first, cx, 12 + 24 * mc + 30 * mc + 22 * mc + 6 * (m - mc));
  if (showSc) {
    const low = s.shotClock <= 4;
    const r = Math.round(20 * mc), x = cx, y = 12 + 24 * mc + 30 * mc + 22 * mc + 6 * (m - mc) + r + 6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = low ? '#c2382c' : 'rgba(8,18,30,0.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = low ? '#ffd0c8' : 'rgba(255,246,228,0.6)'; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(r * 1.05)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.ceil(s.shotClock)), x, y + 1); ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function wrapped(ctx, text, x, y, maxW, size, color = '#fff6e4', lh = 1.25, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, maxW); lines.forEach((l, i) => ctx.fillText(l, x, y + size * (0.9 + i * lh)));
  return lines.length * size * lh;
}

const proj = (x, y, z) => projectL(x, y, z);
const fitFont = (ctx, text, weight, size, maxW, min) => { let f = size; ctx.font = `${weight} ${f}px ${FONT}`; while (f > min && ctx.measureText(text).width > maxW) { f--; ctx.font = `${weight} ${f}px ${FONT}`; } return f; };

function drawStick(ctx, G, lay) {
  const c = G.ctl, z = lay.hud.stickZone;
  if (!c.stickOn) {
    // an idle hint where the thumb goes
    const hx = z.x + 150, hy = z.y + z.h - 170;
    ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.strokeStyle = '#fff6e4'; ctx.beginPath(); ctx.arc(hx, hy, 78, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(hx, hy, 28, 0, TAU); ctx.stroke(); ctx.restore();
    return;
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(c.ox, c.oy, 78, 0, TAU); ctx.fillStyle = 'rgba(8,18,30,0.35)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.stroke();
  const kx = c.ox + c.sx * 62, ky = c.oy + c.sz * 62;
  ctx.beginPath(); ctx.arc(kx, ky, 36, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(19,40,58,0.6)'; ctx.stroke();
  ctx.restore();
}

function drawButtons(ctx, G, cs, lay, down) {
  const m = lay.hud.m;
  for (const k of ['a', 'b', 'c', 'd']) {
    const b = lay.hud.btn[k], cfg = cs[k];
    if (!cfg) continue;
    const pressed = !!down[k];
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y + (pressed ? 2 : 5), b.r, 0, TAU); ctx.fillStyle = 'rgba(8,10,40,0.34)'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y + (pressed ? 3 : 0), b.r, 0, TAU);
    ctx.fillStyle = cfg.off ? 'rgba(200,205,225,0.35)' : k === 'a' ? (pressed ? '#c0402e' : '#e2503c') : pressed ? '#126f65' : '#1f9d8f';
    ctx.fill(); if (pressed) { ctx.fillStyle = 'rgba(8,10,40,0.16)'; ctx.fill(); }
    ctx.lineWidth = 2; ctx.strokeStyle = cfg.col || (cfg.off ? 'rgba(255,255,255,0.25)' : k === 'a' ? '#a8301f' : '#146f65'); ctx.stroke();
    if (cfg.col) { ctx.lineWidth = 6; ctx.strokeStyle = cfg.col; ctx.beginPath(); ctx.arc(b.x, b.y + (pressed ? 3 : 0), b.r - 4, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = cfg.off ? 'rgba(235,238,255,0.6)' : '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = Math.round((k === 'a' ? 27 : 21) * Math.min(m, 1.6));
    ctx.font = `800 ${fs}px ${FONT}`;
    while (ctx.measureText(cfg.label).width > b.r * 1.7 && fs > Math.max(11, UI.minf - 3)) { fs--; ctx.font = `800 ${fs}px ${FONT}`; }
    ctx.fillText(cfg.label, b.x, b.y + (pressed ? 3 : 0) + (cfg.sub ? -fs * 0.28 : 0));
    if (cfg.sub) { ctx.font = `800 ${Math.round(fs * 1.15)}px ${FONT}`; ctx.fillStyle = cfg.col; ctx.fillText(cfg.sub, b.x, b.y + (pressed ? 3 : 0) + fs * 0.62); }
    ctx.restore();
  }
}

function drawMeter(ctx, G, sim, lay) {
  const mt = sim.meter();
  if (!mt) return;
  const r = lay.hud.meter;
  const u = Math.min(1, mt.t / mt.max), ua = mt.apex / mt.max, uw = mt.w / mt.max;
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(8,18,30,0.8)'; ctx.fill();
  const gx = r.x + (ua - uw) * r.w, gw = uw * 2 * r.w;
  roundPath(ctx, gx, r.y + 2, gw, r.h - 4, (r.h - 4) / 2); ctx.fillStyle = 'rgba(127,232,214,0.85)'; ctx.fill();
  // a thin line at the exact top of the jump
  ctx.fillStyle = '#ffffff'; ctx.fillRect(r.x + ua * r.w - 1.5, r.y + 1, 3, r.h - 2);
  // the moving marker
  const mx = r.x + u * r.w;
  ctx.fillStyle = Math.abs(mt.t - mt.apex) <= mt.w ? '#fff6e4' : '#ffd54a';
  roundPath(ctx, mx - 5, r.y - 6, 10, r.h + 12, 5); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(19,40,58,0.8)'; ctx.stroke();
  ctx.font = `700 ${Math.max(UI.minf, Math.round(16 * Math.min(lay.hud.m, 1.4)))}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff6e4';
  ctx.fillText('RELEASE IN THE GREEN', r.x + r.w, r.y - 10);
  ctx.restore();
  // a small copy over the shooter's head
  const p = sim.s.players[sim.s.humanId], pt = proj(p.x, 2.7 + p.jy, p.z);
  if (pt) { const w = 110, h = 12; roundPath(ctx, pt.x - w / 2, pt.y - 40, w, h, 6); ctx.fillStyle = 'rgba(8,18,30,0.8)'; ctx.fill(); roundPath(ctx, pt.x - w / 2 + (ua - uw) * w, pt.y - 40 + 1.5, gw / r.w * w, h - 3, 4); ctx.fillStyle = 'rgba(127,232,214,0.95)'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(pt.x - w / 2 + u * w - 2, pt.y - 44, 4, h + 8); }
}

function tagPlayers(ctx, G, sim, cs) {
  const s = sim.s;
  for (const p of s.players) {
    if (p.out) continue;
    const pt = proj(p.x, 2.35 + p.jy, p.z); if (!pt) continue;
    pt.x = Math.max(G.lay.U.x0 + 56, Math.min(G.lay.U.x1 - 56, pt.x)); pt.y = Math.max(pt.y, G.lay.hud.tagTop);
    const me = p.id === s.humanId;
    if (me) {
      ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = 'rgba(19,40,58,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pt.x - 15, pt.y - 24); ctx.lineTo(pt.x + 15, pt.y - 24); ctx.lineTo(pt.x, pt.y - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      badge(ctx, pt.x, pt.y - 34, 'YOU', '#ffd23f', 17);
    } else if (p.team === (s.humanId >= 0 ? s.players[s.humanId].team : 0) && s.humanId >= 0) {
      const target = cs.passIds && (cs.passIds[0] === p.id || cs.passIds[1] === p.id) && cs.mode === 'ball';
      badge(ctx, pt.x, pt.y - 8, ROLES[p.role].short, ROLE_COL[p.role], target ? 24 : 18);
    }
  }
}

function drawTarget(ctx, t, col = '#7fe8d6', label) {
  if (!t) return;
  const c = proj(t.x, 0.02, t.z), a = proj(t.x + 0.55, 0.02, t.z), b = proj(t.x, 0.02, t.z + 0.55);
  if (!c || !a || !b) return;
  const rx = Math.max(12, Math.abs(a.x - c.x)), ry = Math.max(7, Math.abs(b.y - c.y));
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(127,232,214,0.22)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (label) { ctx.font = `700 ${Math.max(UI.minf, 20)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(label, c.x, c.y - ry - 8); }
  ctx.restore();
}

export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }

function promptLine(G, s, cs) {
  if (G.mode === 'watch') return 'Watch & Learn';
  if (G.mode === 'drill' && G.learn.cur >= 0 && s.drill) return `${G.lessonTitle || 'Practice'}: ${s.drill.ok} good, ${s.drill.n} of ${s.drill.total} tried`;
  if (s.phase === 'ready') return s.mode === 'check' ? `Check ball: ${s.poss === 0 ? 'your team' : 'the other team'} gets it at the top` : 'Inbound at the top of the arc';
  if (s.phase === 'ft') return s.ft && s.ft.shooter === s.humanId ? 'Free throw: hold SHOOT, release in the green' : 'Free throw';
  if (s.humanId >= 0 && s.phase === 'live') {
    const p = s.players[s.humanId], B = s.ball;
    if (B.mode === 'held' && B.holder === p.id && p.dstate === 'dead') return 'Dribble ended: pass or shoot, do not walk';
    if (B.mode === 'held' && B.holder === p.id && p.dstate === 'hold' && s.cleared) return 'Move to dribble. Stop and hold to end it.';
    if (B.mode === 'held' && B.holder === p.id && !s.cleared) return 'Take the ball behind the arc first';
    if (s.poss === p.team && s.shotClock < 4 && B.mode === 'held') return 'Shot clock! Shoot now';
  }
  return '';
}

export function renderHud(ctx, G, sim, view) {
  const s = sim.s;
  TEAM_COL[0] = ['#2f7be0', '#27b37a', '#8a55d4', '#ee9a3c'][G.settings.kitIdx | 0] || TEAM_COL[0];
  const lay = layoutFor(W, H, G.settings.textIdx), hl = lay.hud;
  UI.minf = lay.minf; UI.minb = lay.minb;
  const m = hl.m;
  const cs = controlState(G, sim);
  G.cs = cs; G.lay = lay;
  scoreboard(ctx, G, s, lay);
  // behind the thumb controls: a dark band at the bottom (portrait), two soft corner shades (landscape)
  if (!lay.land) {
    const bg = ctx.createLinearGradient(0, hl.bgTop, 0, H); bg.addColorStop(0, 'rgba(6,14,26,0)'); bg.addColorStop(0.3, 'rgba(6,14,26,0.55)'); bg.addColorStop(1, 'rgba(6,14,26,0.82)');
    ctx.fillStyle = bg; ctx.fillRect(0, hl.bgTop, W, H - hl.bgTop);
  } else if (G.mode !== 'watch') {
    const sw = 380, y0 = hl.bgTop;
    let g = ctx.createLinearGradient(0, 0, sw, 0); g.addColorStop(0, 'rgba(6,14,26,0.5)'); g.addColorStop(1, 'rgba(6,14,26,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, sw, H - y0);
    g = ctx.createLinearGradient(W, 0, W - sw, 0); g.addColorStop(0, 'rgba(6,14,26,0.5)'); g.addColorStop(1, 'rgba(6,14,26,0)');
    ctx.fillStyle = g; ctx.fillRect(W - sw, y0, sw, H - y0);
  }
  // plan marker (Watch & Learn reveal, Think)
  if (G.mode === 'watch' && s.hold && G.watch.phase !== 'think' && s.hold.decision.target) drawTarget(ctx, s.hold.decision.target, '#7fe8d6', 'Plan');
  if (G.mode !== 'watch' && G.hintShow && s.t < G.hintShow.until && G.hintShow.target) drawTarget(ctx, G.hintShow.target, '#ffe9a0', 'Hint');
  tagPlayers(ctx, G, sim, cs);
  // prompt
  const pt = promptLine(G, s, cs);
  if (pt) {
    const pw = hl.promptW, ps = Math.max(UI.minf, Math.round(22 * Math.min(m, 1.6)));
    ctx.font = `700 ${ps}px ${FONT}`; const lines = wrapLines(ctx, pt, pw - 36);
    const ph = lines.length * ps * 1.25 + 16, py = hl.promptY;
    roundPath(ctx, hl.promptX, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.7)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, hl.promptX + pw / 2, py + 10 + ps * (0.95 + i * 1.25)));
  }
  // banners
  const f = G.feedback;
  if (f && s.t - f.t < 1.5 && !G.hideFeedback) {
    const big = Math.round((f.size || 52) * Math.min(m, 1.5)), k = Math.min(1, (s.t - f.t) / 0.12);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1.5 - (s.t - f.t)) / 0.4);
    ctx.font = `800 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8;
    ctx.fillText(f.text, W / 2, Math.round(hl.bannerY - 16 * (1 - k)));
    if (f.sub) { ctx.font = `700 ${Math.round(26 * Math.min(m, 1.5))}px ${FONT}`; ctx.fillStyle = '#fff6e4'; ctx.fillText(f.sub, W / 2, Math.round(hl.bannerY + 38)); }
    ctx.restore();
  }
  if (G.mode === 'watch') return renderWatch(ctx, G, s, lay, m);
  drawMeter(ctx, G, sim, lay);
  drawStick(ctx, G, lay);
  drawButtons(ctx, G, cs, lay, G.ctl.down);
  const sz = Math.max(UI.minf, Math.round(24 * Math.min(m, 1.7)));
  drawButton(ctx, hl.util.think, 'Think', { dark: true, size: sz, disabled: s.humanId < 0 });
  drawButton(ctx, hl.util.pause, 'Pause', { dark: true, size: sz });
}

function renderWatch(ctx, G, s, lay, m) {
  const w = G.watch, WL = lay.hud.watch;
  const sz = Math.max(UI.minf, Math.round(24 * Math.min(m, 1.7)));
  let msg = '';
  if (s.hold) {
    const d = s.hold.decision, tn = s.hold.team === 0 ? 'Blue' : 'Red';
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)} s: ${tn} are weighing the options. What would you do?`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${d.summary}. ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = 'ACT: the play continues.';
  const ps = Math.max(UI.minf, Math.round(22 * Math.min(m, 1.5))), pw = WL.panelW, px = WL.panelX;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30);
  const fullH = lines.length * ps * 1.25 + 20, ph = Math.min(fullH, WL.maxH), py = WL.panelBottom - ph;
  G.watchSt = G.watchSt || { scroll: 0, drag: null, msg: '' };
  if (G.watchSt.msg !== msg) { G.watchSt.msg = msg; G.watchSt.scroll = 0; }
  const maxS = Math.max(0, fullH - ph); G.watchSt.scroll = Math.max(0, Math.min(G.watchSt.scroll, maxS));
  G.watchMeta = { rect: { x: px, y: py, w: pw, h: ph }, max: maxS, view: ph };
  roundPath(ctx, px, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.86)'; ctx.fill();
  ctx.save(); roundPath(ctx, px, py, pw, ph, 16); ctx.clip();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, px + 16, py + 10 + ps * (0.95 + i * 1.25) - G.watchSt.scroll));
  ctx.restore();
  drawScrollBar(ctx, { x: px, y: py + 6, w: pw - 4, h: ph - 12 }, G.watchSt.scroll, maxS, true);
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  WL.btns.forEach((rc, i) => { W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
}

// Think panel (modal)
export function renderThink(ctx, G, view) {
  const t = G.think, L = layoutFor(W, H, G.settings.textIdx);
  UI.minf = L.minf; UI.minb = L.minb;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx];
  const x = L.think.x, w = L.think.w, row = L.think.row;
  const size = Math.max(UI.minf, Math.round(26 * Math.min(m, 2)));
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 60);
  const hh = size * 1.3 * lines.length + 60;
  const bh = Math.max(L.minb, Math.round(84 * Math.min(m, 1.5)) * (row ? 0.85 : 1));
  const rows = row ? 1 : 2;
  const total = Math.min(H - 120, 70 + size * 1.5 + hh + bh * rows + 50);
  const y = Math.max(L.U.y0 + 40, (H - total) / 2);
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(14,34,52,0.96)', stroke: 'rgba(255,246,228,0.5)' });
  const cx = x + w / 2, ms = Math.min(m, 1.6);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(34 * ms)}px ${FONT}`; ctx.fillText('Coach says', cx, y + 56);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${Math.max(UI.minf, Math.round(28 * ms))}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 50); sm.forEach((l, i) => ctx.fillText(l, cx, y + 108 + i * 34 * ms));
  const off = y + 108 + sm.length * 34 * ms + 6;
  const by = y + total - bh * rows - (row ? 28 : 40);
  // the coach's text scrolls inside its own box when the zoomed text is longer than the panel
  const area = { x: x + 10, y: off - 6, w: w - 20, h: Math.max(60, by - 12 - (off - 6)) };
  const textH = size * 1.3 * lines.length + 14, maxS = Math.max(0, textH - area.h);
  G.thinkSt = G.thinkSt || { scroll: 0, drag: null };
  G.thinkSt.scroll = Math.max(0, Math.min(G.thinkSt.scroll, maxS));
  G.thinkMeta = { rect: area, max: maxS, view: area.h };
  ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.w, area.h); ctx.clip();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 30, off + size * (1 + i * 1.3) - G.thinkSt.scroll));
  ctx.restore();
  drawScrollBar(ctx, area, G.thinkSt.scroll, maxS, true);
  const bw = row ? (w - 48 - 14) / 2 : w - 48;
  G.thinkRects = row ? { show: { x: x + 24, y: by, w: bw, h: bh }, close: { x: x + 24 + bw + 14, y: by, w: bw, h: bh } } : { show: { x: x + 24, y: by, w: bw, h: bh }, close: { x: x + 24, y: by + bh + 14, w: bw, h: bh } };
  drawButton(ctx, G.thinkRects.show, 'Show on court', { primary: true, size: Math.round(30 * Math.min(m, 1.5)) });
  drawButton(ctx, G.thinkRects.close, 'Close', { dark: true, size: Math.round(28 * Math.min(m, 1.5)) });
}

// 2D fallback when WebGL is missing: the court and the players drawn through the same camera maths
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const P = (x, y, z) => proj(x, y, z);
  ctx.save();
  ctx.fillStyle = '#0f1c2d'; ctx.fillRect(0, 0, W, H);
  const corners = [[-HW, Z_BASE], [HW, Z_BASE], [HW, Z_HALF], [-HW, Z_HALF]].map(([x, z]) => P(x, 0, z));
  if (corners.every(Boolean)) {
    ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath();
    ctx.fillStyle = '#d9a66a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f7f7f4'; ctx.stroke();
  }
  ctx.strokeStyle = '#f7f7f4'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const a = Math.PI * (i / 60); const q = P(ARC_R * Math.cos(a), 0, ARC_R * Math.sin(a)); if (q) (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); }
  ctx.stroke();
  const hp = P(0, 3.05, 0); if (hp) { ctx.strokeStyle = '#ff6a1f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(hp.x, hp.y, 16, 6, 0, 0, TAU); ctx.stroke(); }
  const list = s.players.filter((p) => !p.out).map((p) => ({ p, a: P(p.x, 0, p.z), b: P(p.x, 1.85 + p.jy, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = TEAM_COL[p.team]; ctx.lineWidth = Math.max(8, (a.y - b.y) * 0.2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 6, Math.max(6, (a.y - b.y) * 0.1), 0, TAU); ctx.fill(); }
  const bp = P(s.ball.x, s.ball.y, s.ball.z);
  if (bp) { ctx.fillStyle = '#e8892f'; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(7, bp.scale * 0.17), 0, TAU); ctx.fill(); }
  ctx.restore();
}
