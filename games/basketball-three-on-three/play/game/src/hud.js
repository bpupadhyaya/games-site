// In-play HUD: scoreboard and clocks, prompts, role tags, the thumb controls (floating stick + four context buttons), the shot meter,
// Think / Watch panels and the 2D fallback court. Everything follows the 100-300% text size (through PLAY_M).
import { W, H, PLAY_M, hudLayout, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { ROLES, HOOP, ARC_R, ARC_X, HW, Z_BASE, Z_HALF } from './consts.js';
import { projectV, CAM } from './camera.js';

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
    return { mode: 'ball', passIds, a: ok ? { label: 'SHOOT', hold: true } : off(ready ? 'WAIT' : 'CLEAR'), b: mates[0] && !ready ? { label: 'PASS', sub: lbl(mates[0]), col: ROLE_COL[mates[0].role] } : null, c: mates[1] && !ready ? { label: 'PASS', sub: lbl(mates[1]), col: ROLE_COL[mates[1].role] } : null, d: !ready ? { label: 'CROSS' } : null };
  }
  if (B.mode === 'held' && s.players[B.holder].team === p.team) return { mode: 'off', passIds, a: { label: 'CALL', hold: true }, b: { label: 'SCREEN', hold: true }, c: { label: 'CUT' }, d: null };
  if (B.mode === 'held') return { mode: 'def', passIds, a: ready ? off('WAIT') : { label: 'STEAL' }, b: { label: 'BLOCK' }, c: { label: 'BURST' }, d: null };
  return { mode: 'air', passIds, a: { label: 'JUMP' }, b: null, c: { label: 'BURST' }, d: null };
}

const fmtClock = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function badge(ctx, x, y, text, col = '#ffd54a', size = 22) {
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 20;
  roundPath(ctx, x - w / 2, y - size, w, size * 1.5, 11); ctx.fillStyle = 'rgba(8,18,30,0.84)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 2); ctx.restore();
}

function scoreboard(ctx, G, s, lay) {
  const m = lay.m, th = lay.topH;
  const g = ctx.createLinearGradient(0, 0, 0, th + 24); g.addColorStop(0, 'rgba(6,14,26,0.9)'); g.addColorStop(1, 'rgba(6,14,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, th + 24);
  const colw = 232, cx = W / 2;
  const tn = [s.humanId >= 0 ? 'You' : 'Blue', G.oppName || 'Red'];
  for (const i of [0, 1]) {
    const left = i === 0, x0 = left ? 14 : W - 14 - colw;
    ctx.fillStyle = TEAM_COL[i]; roundPath(ctx, x0, 12, 9, th - 36, 4); ctx.fill();
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const ax = left ? x0 + 20 : x0 + colw - 20;
    ctx.fillStyle = '#fff6e4'; let fs = Math.round(21 * m); ctx.font = `700 ${fs}px ${FONT}`;
    while (ctx.measureText(tn[i]).width > colw - 30 && fs > 12) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
    ctx.fillText(tn[i], ax, 12 + 22 * m);
    ctx.font = `800 ${Math.round(56 * m)}px ${FONT}`; ctx.fillText(String(s.score[i]), ax, 12 + 22 * m + 52 * m);
    // team fouls as pips
    ctx.fillStyle = s.fouls[i] >= 7 ? '#ff9a86' : 'rgba(255,246,228,0.6)'; ctx.font = `600 ${Math.round(15 * Math.min(m, 1.5))}px ${FONT}`;
    ctx.fillText(`Fouls ${s.fouls[i]}`, ax, 12 + 22 * m + 52 * m + 18 * Math.min(m, 1.5));
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6e4'; const mc = Math.min(m, 1.5); ctx.font = `800 ${Math.round(40 * mc)}px ${FONT}`;
  ctx.fillText(s.ot ? 'OVERTIME' : s.cfg.noClock ? '' : fmtClock(s.clock), cx, 12 + 24 * mc + 30 * mc + 6 * (m - mc));
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.round(17 * mc)}px ${FONT}`;
  ctx.fillText(s.cfg.noClock ? '' : s.ot ? `First to ${s.otTarget}` : `First to ${s.target}`, cx, 12 + 24 * mc + 30 * mc + 22 * mc + 6 * (m - mc));
  // shot clock chip
  if (s.phase === 'live' || s.phase === 'ready') {
    const sc = Math.ceil(s.shotClock), low = s.shotClock <= 4;
    const r = Math.round(20 * mc), x = cx, y = 12 + 24 * mc + 30 * mc + 22 * mc + 6 * (m - mc) + r + 6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = low ? '#c2382c' : 'rgba(8,18,30,0.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = low ? '#ffd0c8' : 'rgba(255,246,228,0.6)'; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(r * 1.05)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(String(sc), x, y + 1); ctx.textBaseline = 'alphabetic';
  }
}

function wrapped(ctx, text, x, y, maxW, size, color = '#fff6e4', lh = 1.25, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, maxW); lines.forEach((l, i) => ctx.fillText(l, x, y + size * (0.9 + i * lh)));
  return lines.length * size * lh;
}

const proj = (x, y, z) => projectV(CAM, x, y, z);

function drawStick(ctx, G, lay) {
  const c = G.ctl;
  if (!c.stickOn) {
    // an idle hint where the thumb goes
    ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.strokeStyle = '#fff6e4'; ctx.beginPath(); ctx.arc(150, 1110, 78, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(150, 1110, 28, 0, TAU); ctx.stroke(); ctx.restore();
    return;
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(c.ox, c.oy, 78, 0, TAU); ctx.fillStyle = 'rgba(8,18,30,0.35)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.stroke();
  const kx = c.ox + c.sx * 62, ky = c.oy + c.sz * 62;
  ctx.beginPath(); ctx.arc(kx, ky, 36, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(19,40,58,0.6)'; ctx.stroke();
  ctx.restore();
}

function drawButtons(ctx, G, cs, lay, down) {
  const m = lay.m;
  for (const k of ['a', 'b', 'c', 'd']) {
    const b = lay.btn[k], cfg = cs[k];
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
    while (ctx.measureText(cfg.label).width > b.r * 1.7 && fs > 11) { fs--; ctx.font = `800 ${fs}px ${FONT}`; }
    ctx.fillText(cfg.label, b.x, b.y + (pressed ? 3 : 0) + (cfg.sub ? -fs * 0.28 : 0));
    if (cfg.sub) { ctx.font = `800 ${Math.round(fs * 1.15)}px ${FONT}`; ctx.fillStyle = cfg.col; ctx.fillText(cfg.sub, b.x, b.y + (pressed ? 3 : 0) + fs * 0.62); }
    ctx.restore();
  }
}

function drawMeter(ctx, G, sim, lay) {
  const mt = sim.meter();
  if (!mt) return;
  const r = lay.meter;
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
  ctx.font = `700 ${Math.round(16 * Math.min(lay.m, 1.4))}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff6e4';
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
    pt.x = Math.max(56, Math.min(W - 56, pt.x)); pt.y = Math.max(pt.y, G.lay.util.pause.y + G.lay.util.pause.h + 70);
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
  if (label) { ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(label, c.x, c.y - ry - 8); }
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
    if (B.mode === 'held' && B.holder === p.id && !s.cleared) return 'Take the ball behind the arc first';
    if (s.poss === p.team && s.shotClock < 4 && B.mode === 'held') return 'Shot clock! Shoot now';
  }
  return '';
}

export function renderHud(ctx, G, sim, view) {
  const s = sim.s;
  const lay = hudLayout(G.settings.textIdx);
  const m = lay.m;
  const cs = controlState(G, sim);
  G.cs = cs; G.lay = lay;
  scoreboard(ctx, G, s, lay);
  // bottom zone background
  const bg = ctx.createLinearGradient(0, 880, 0, H); bg.addColorStop(0, 'rgba(6,14,26,0)'); bg.addColorStop(0.3, 'rgba(6,14,26,0.55)'); bg.addColorStop(1, 'rgba(6,14,26,0.82)');
  ctx.fillStyle = bg; ctx.fillRect(0, 880, W, H - 880);
  // plan marker (Watch & Learn reveal, Think)
  if (G.mode === 'watch' && s.hold && G.watch.phase !== 'think' && s.hold.decision.target) drawTarget(ctx, s.hold.decision.target, '#7fe8d6', 'Plan');
  if (G.mode !== 'watch' && G.hintShow && s.t < G.hintShow.until && G.hintShow.target) drawTarget(ctx, G.hintShow.target, '#ffe9a0', 'Hint');
  tagPlayers(ctx, G, sim, cs);
  // prompt
  const pt = promptLine(G, s, cs);
  if (pt) {
    const pw = W - 60, ps = Math.round(22 * Math.min(m, 1.6));
    ctx.font = `700 ${ps}px ${FONT}`; const lines = wrapLines(ctx, pt, pw - 36);
    const ph = lines.length * ps * 1.25 + 16, py = lay.util.think.y + lay.util.think.h + 8;
    roundPath(ctx, 30, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.7)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, W / 2, py + 10 + ps * (0.95 + i * 1.25)));
  }
  // banners
  const f = G.feedback;
  if (f && s.t - f.t < 1.5 && !G.hideFeedback) {
    const big = Math.round((f.size || 52) * Math.min(m, 1.5)), k = Math.min(1, (s.t - f.t) / 0.12);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1.5 - (s.t - f.t)) / 0.4);
    ctx.font = `800 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8;
    ctx.fillText(f.text, W / 2, Math.round(H * 0.265 - 16 * (1 - k)));
    if (f.sub) { ctx.font = `700 ${Math.round(26 * Math.min(m, 1.5))}px ${FONT}`; ctx.fillStyle = '#fff6e4'; ctx.fillText(f.sub, W / 2, Math.round(H * 0.265 + 38)); }
    ctx.restore();
  }
  if (G.mode === 'watch') return renderWatch(ctx, G, s, lay, m);
  drawMeter(ctx, G, sim, lay);
  drawStick(ctx, G, lay);
  drawButtons(ctx, G, cs, lay, G.ctl.down);
  const sz = Math.round(24 * Math.min(m, 1.7));
  drawButton(ctx, lay.util.think, 'Think', { dark: true, size: sz, disabled: s.humanId < 0 });
  drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: sz });
}

function renderWatch(ctx, G, s, lay, m) {
  const w = G.watch;
  const sz = Math.round(24 * Math.min(m, 1.7));
  let msg = '';
  if (s.hold) {
    const d = s.hold.decision, tn = s.hold.team === 0 ? 'Blue' : 'Red';
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)} s: ${tn} are weighing the options. What would you do?`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${d.summary}. ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = 'ACT: the play continues.';
  const ps = Math.round(22 * Math.min(m, 1.5)), pw = W - 40;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30);
  const rowsH = (m >= 1.5 ? 2 : 1) * (lay.util.think.h + 10);
  const ph = Math.min(lines.length, 9) * ps * 1.25 + 20, py = H - 14 - rowsH - ph - 8;
  roundPath(ctx, 20, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.86)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left';
  lines.slice(0, 9).forEach((l, i) => ctx.fillText(l, 36, py + 10 + ps * (0.95 + i * 1.25)));
  const bh = lay.util.think.h, big = m >= 1.5;
  const y2 = H - 14 - bh, y1 = y2 - bh - 10;
  const rects = big ? [[14, y1, 345, bh], [361, y1, 345, bh], [14, y2, 345, bh], [361, y2, 345, bh]] : [[14, y2, 170, bh], [194, y2, 170, bh], [374, y2, 170, bh], [554, y2, 152, bh]];
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  rects.forEach((r, i) => { const rc = { x: r[0], y: r[1], w: r[2], h: r[3] }; W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
}

// Think panel (modal)
export function renderThink(ctx, G, view) {
  const t = G.think;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx];
  const x = 30, w = W - 60;
  const size = Math.round(26 * Math.min(m, 2));
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 60);
  const hh = size * 1.3 * lines.length + 60;
  const bh = Math.round(84 * Math.min(m, 1.5));
  const total = Math.min(H - 120, 70 + size * 1.5 + hh + bh * 2 + 50);
  const y = Math.max(40, (H - total) / 2);
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(14,34,52,0.96)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(34 * Math.min(m, 1.6))}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + 56);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${Math.round(28 * Math.min(m, 1.6))}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 50); sm.forEach((l, i) => ctx.fillText(l, W / 2, y + 108 + i * 34 * Math.min(m, 1.6)));
  const off = y + 108 + sm.length * 34 * Math.min(m, 1.6) + 6;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 30, off + size * (1 + i * 1.3)));
  const by = y + total - bh * 2 - 40;
  G.thinkRects = { show: { x: x + 24, y: by, w: w - 48, h: bh }, close: { x: x + 24, y: by + bh + 14, w: w - 48, h: bh } };
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
