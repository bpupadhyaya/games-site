// The in-play screen: scoreboard, stick and buttons, markers on the pitch (drawn through the same camera maths as the 3D picture) and
// the 2D fallback pitch for devices without WebGL. All text follows the 100-300% text size through a gentler multiplier.
import { W, H, hudLayout, inRect } from './layout.js';
import { FONT, DISPLAY, C, roundPath, wrapLines, panel, fitPx, drawButton } from './ui.js';
import { projectV } from './camera.js';
import { HL, HW, GOAL_HW, GOAL_H, BOX_HW, BOX_D, SPOT, CIRCLE_R, ROLE_SHORT } from './consts.js';

export const KIT = [{ top: '#2b6fd6', trim: '#cfe0ff', name: 'Blue' }, { top: '#d94536', trim: '#ffd6cf', name: 'Red' }];
const TAU = Math.PI * 2;
const proj = (G, x, y, z) => projectV(G.cam, G.viewW || 720, G.viewH || 1280, x, y, z);

function ring(ctx, G, x, z, r, n = 28) {
  ctx.beginPath(); let ok = true;
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, p = proj(G, x + Math.cos(a) * r, 0.02, z + Math.sin(a) * r); if (!p) { ok = false; break; } if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  return ok;
}
function text(ctx, s, x, y, size, color = '#fff6e4', align = 'center', weight = 700, shadow = true) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  if (shadow) { ctx.save(); ctx.shadowColor = 'rgba(4,10,24,0.75)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1; ctx.fillText(s, x, y); ctx.restore(); } else ctx.fillText(s, x, y);
}
const clock = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export function renderHud(ctx, G, view) {
  const s = G.sim, lay = hudLayout(G.settings.textIdx), m = lay.m;
  G.lay = lay;
  scoreboard(ctx, G, s, lay);
  markers(ctx, G, s, lay);
  banners(ctx, G, s, lay);
  if (G.mode === 'watch') watchBar(ctx, G, s, lay);
  else controls(ctx, G, s, lay);
  if (G.coach && G.mode !== 'watch') coach(ctx, G, lay);
  void m; void view;
}

function scoreboard(ctx, G, s, lay) {
  const m = lay.m, h = lay.topH;
  const g = ctx.createLinearGradient(0, 0, 0, h + 30); g.addColorStop(0, 'rgba(6,14,26,0.92)'); g.addColorStop(0.7, 'rgba(6,14,26,0.82)'); g.addColorStop(1, 'rgba(6,14,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h + 46);
  const fs = Math.round(34 * m), small = Math.round(21 * m);
  // the kit draws its preview pill at the top centre, so the scoreboard sits below it
  const cy = 64 + Math.round(34 * m);
  const names = [G.mode === 'watch' ? G.teamNames[0] : 'You', G.teamNames[1]];
  if (G.mode === 'drill' && s.drill) {
    const d = s.drill, att = Math.min(d.attempt + (d.stage === 'ready' ? 1 : 0), d.n);
    text(ctx, `Drill ${Math.max(1, att)} of ${d.n}  ·  ${d.ok} good`, W / 2, cy + 2, Math.round(30 * m), '#ffffff', 'center', 800);
    const hint = d.hint || '';
    text(ctx, hint, W / 2, cy + 2 + Math.round(30 * m), fitPx(ctx, hint, 700, Math.round(22 * m), W - 60, 12), '#ffe9a0', 'center', 700);
    ctx.fillStyle = 'rgba(0,0,0,0)';
  } else {
  const sc = `${s.score[0]}  -  ${s.score[1]}`;
  ctx.font = `800 ${fs}px ${FONT}`; const sw = ctx.measureText(sc).width;
  const maxName = (W - sw) / 2 - 70;
  for (let t = 0; t < 2; t++) {
    const al = t === 0 ? 'left' : 'right';
    const x = t === 0 ? 24 : W - 24;
    ctx.fillStyle = KIT[t].top; roundPath(ctx, t === 0 ? x : x - 22, cy - 22, 22, 22, 6); ctx.fill();
    const px = fitPx(ctx, names[t], 700, small, maxName, 12);
    text(ctx, names[t], t === 0 ? x + 30 : x - 30, cy - 2, px, '#fff6e4', al, 700);
  }
  text(ctx, sc, W / 2, cy + 2, fs, '#ffffff', 'center', 800);
  text(ctx, `${s.half === 1 ? '1st' : '2nd'} half  ${clock(s.clock)}`, W / 2, cy + 2 + Math.round(26 * m), Math.round(20 * m), '#ffe9a0', 'center', 700);
  }
  if (G.mode !== 'watch') { const rn = G.roleName; if (rn) text(ctx, rn, 24, cy + Math.round(30 * m) + (G.mode === 'drill' ? 30 : 0), Math.round(18 * m), 'rgba(255,246,228,0.8)', 'left', 600); }
  if (G.mode !== 'watch') { drawButton(ctx, lay.pause, '', { dark: true, size: 22 }); ctx.fillStyle = '#fff6e4'; ctx.fillRect(lay.pause.x + 18, lay.pause.y + 16, 8, 28); ctx.fillRect(lay.pause.x + 34, lay.pause.y + 16, 8, 28); }
}

function markers(ctx, G, s, lay) {
  const P = s.players;
  // team role tags (own side)
  if (G.settings.tags !== false) for (const p of P) {
    if (p.team !== 0 && G.mode !== 'watch') continue;
    if (p.id === s.human) continue;
    const q = proj(G, p.x, 2.35, p.z); if (!q) continue;
    ctx.save(); ctx.globalAlpha = 0.85;
    const t = ROLE_SHORT[p.role]; const sz = Math.round(15 * Math.min(1.5, lay.m));
    ctx.font = `700 ${sz}px ${FONT}`; const w = ctx.measureText(t).width + 12;
    ctx.fillStyle = 'rgba(6,14,26,0.55)'; roundPath(ctx, q.x - w / 2, q.y - sz, w, sz + 6, 7); ctx.fill();
    text(ctx, t, q.x, q.y + 2, sz, p.team === 0 ? '#cfe0ff' : '#ffd6cf', 'center', 700, false);
    ctx.restore();
  }
  // the controlled player
  const hp = s.human >= 0 ? P[s.human] : null;
  if (hp && G.mode !== 'watch') {
    if (ring(ctx, G, hp.x, hp.z, 0.95)) { ctx.lineWidth = 4; ctx.strokeStyle = '#ffd54a'; ctx.stroke(); ctx.fillStyle = 'rgba(255,213,74,0.18)'; ctx.fill(); }
    const q = proj(G, hp.x, 2.5, hp.z);
    if (q) { ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(q.x, q.y + 4); ctx.lineTo(q.x - 14, q.y - 20); ctx.lineTo(q.x + 14, q.y - 20); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(6,14,26,0.7)'; ctx.lineWidth = 2; ctx.stroke(); }
    const hud = s.hud;
    if (hud && hud.passTarget >= 0 && (hud.ctx === 'ball' || hud.ctx === 'setpiece' || hud.ctx === 'gkball')) {
      const tg = P[hud.passTarget];
      if (ring(ctx, G, tg.x, tg.z, 0.8)) { ctx.lineWidth = 4; ctx.strokeStyle = '#7fe8d6'; ctx.stroke(); }
      const a = proj(G, hp.x, 0.05, hp.z), b = proj(G, tg.x, 0.05, tg.z);
      if (a && b) { ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(127,232,214,0.8)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (hud && hud.aim && hud.ctx !== 'gk') {
      const len = hud.ctx === 'ball' ? 4.5 : 6;
      const a = proj(G, hp.x, 0.05, hp.z), b = proj(G, hp.x + hud.aim.x * len, 0.05, hp.z + hud.aim.z * len);
      if (a && b) { ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,213,74,0.85)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
  }
  // drill markers
  if (s.drill) {
    for (const mk of s.drill.marks || []) { if (mk.hit) continue; if (ring(ctx, G, mk.x, mk.z, 1.0)) { ctx.lineWidth = 5; ctx.strokeStyle = '#ffe9a0'; ctx.stroke(); ctx.fillStyle = 'rgba(255,233,160,0.25)'; ctx.fill(); } const q = proj(G, mk.x, 0.1, mk.z); if (q) text(ctx, mk.label, q.x, q.y + 8, Math.round(24 * lay.m), '#ffe9a0'); }
    if (s.drill.target >= 0) { const tg = P[s.drill.target]; if (ring(ctx, G, tg.x, tg.z, 0.95)) { ctx.lineWidth = 6; ctx.strokeStyle = '#7fe8d6'; ctx.stroke(); ctx.fillStyle = 'rgba(127,232,214,0.25)'; ctx.fill(); } }
  }
  // Think: highlight the suggested spot or player
  const th = G.think;
  if (th) {
    if (th.tgt >= 0) { const tg = P[th.tgt]; if (ring(ctx, G, tg.x, tg.z, 1.1)) { ctx.lineWidth = 5; ctx.strokeStyle = '#7fe8d6'; ctx.stroke(); ctx.fillStyle = 'rgba(127,232,214,0.2)'; ctx.fill(); } }
    if (th.spot) { if (ring(ctx, G, th.spot.x, th.spot.z, 1.3)) { ctx.lineWidth = 5; ctx.strokeStyle = '#ffe9a0'; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]); } const q = proj(G, th.spot.x, 0.1, th.spot.z); if (q) text(ctx, th.spotLabel || 'Here', q.x, q.y - 14, Math.round(20 * lay.m), '#ffe9a0'); }
  }
}

function banners(ctx, G, s, lay) {
  const m = lay.m;
  const e = G.banner;
  if (!e || s.t - e.t > e.dur) return;
  const a = Math.min(1, (s.t - e.t) / 0.15, (e.dur - (s.t - e.t)) / 0.3);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a));
  const y = lay.topH + 120;
  const fs = Math.round(e.big ? 76 * Math.min(m, 1.25) : 46 * Math.min(m, 1.4));
  const w = Math.min(W - 40, fs * (e.text.length * 0.62 + 1.2));
  ctx.fillStyle = e.col ? e.col : 'rgba(6,14,26,0.62)'; roundPath(ctx, W / 2 - w / 2, y - fs * 0.85, w, fs * 1.4, 24); ctx.fill();
  text(ctx, e.text, W / 2, y + fs * 0.1, fitPx(ctx, e.text, 800, fs, w - 30, 20), '#ffffff', 'center', 800, true);
  if (e.sub) text(ctx, e.sub, W / 2, y + fs * 0.62, Math.round(22 * Math.min(m, 1.5)), '#ffe9a0', 'center', 600);
  ctx.restore();
}

function coach(ctx, G, lay) {
  const c = G.coach; if (!c) return;
  const m = lay.m, fs = Math.round(24 * Math.min(m, 1.6));
  ctx.font = `600 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, c.text, W - 90);
  const h = lines.length * fs * 1.25 + 26, y = lay.topH + 66;
  ctx.fillStyle = 'rgba(14,34,52,0.88)'; roundPath(ctx, 24, y, W - 48, h, 18); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,233,160,0.6)'; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, 44, y + 14 + fs * (0.95 + i * 1.25)));
}

// ---- controls ---------------------------------------------------------------------------------------------------------------------------
function circleBtn(ctx, b, label, o = {}) {
  const { active = true, charge = 0, primary = false, sub = '' } = o;
  ctx.save();
  ctx.fillStyle = 'rgba(6,14,26,0.35)'; ctx.beginPath(); ctx.arc(b.x, b.y + 4, b.r + 2, 0, TAU); ctx.fill();
  const down = o.down;
  ctx.beginPath(); ctx.arc(b.x, b.y + (down ? 2 : 0), b.r, 0, TAU);
  ctx.fillStyle = !active ? 'rgba(120,130,150,0.38)' : primary ? '#e2503c' : '#1f9d8f'; ctx.fill();
  if (down && active) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); }
  ctx.lineWidth = 3; ctx.strokeStyle = !active ? 'rgba(255,255,255,0.3)' : 'rgba(255,250,240,0.85)'; ctx.stroke();
  if (charge > 0.02) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.lineWidth = 8; ctx.strokeStyle = '#ffd54a'; ctx.stroke(); }
  if (label) {
    const px = fitPx(ctx, label, 800, Math.round(b.r * 0.5), b.r * 1.7, 11);
    text(ctx, label, b.x, b.y + px * 0.34 + (down ? 2 : 0), px, active ? '#fffaf0' : 'rgba(235,238,255,0.55)', 'center', 800, false);
  }
  ctx.restore();
}
function controls(ctx, G, s, lay) {
  const hud = s.hud || { labels: ['', '', '', ''], ctx: 'run' };
  const C0 = G.ctl;
  // bottom fade
  const g = ctx.createLinearGradient(0, 930, 0, H); g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(0.3, 'rgba(6,14,26,0.45)'); g.addColorStop(1, 'rgba(6,14,26,0.8)');
  ctx.fillStyle = g; ctx.fillRect(0, 930, W, H - 930);
  // stick
  const st = C0.stick;
  const bx = st.on ? st.ox : lay.stick.x, by = st.on ? st.oy : lay.stick.y;
  ctx.save();
  ctx.beginPath(); ctx.arc(bx, by, lay.stick.r, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.10)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.45)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(bx + st.x * 70, by + st.y * 70, 40, 0, TAU); ctx.fillStyle = st.on ? 'rgba(255,246,228,0.6)' : 'rgba(255,246,228,0.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,246,228,0.8)'; ctx.stroke();
  ctx.restore();
  if (!st.on) text(ctx, 'MOVE', bx, by + lay.stick.r + 30, Math.round(18 * Math.min(lay.m, 1.4)), 'rgba(255,246,228,0.6)', 'center', 700, false);
  // buttons
  const labels = hud.labels;
  const charges = [0, 0, 0, 0];
  if (hud.charge) { const d = C0.btn.findIndex((b) => b.down); if (d >= 0) charges[d] = hud.charge; }
  lay.btns.forEach((b, i) => { circleBtn(ctx, b, labels[i] || '', { active: !!labels[i], primary: i === 0, charge: charges[i], down: C0.btn[i].down }); });
  circleBtn(ctx, lay.sprint, 'SPRINT', { active: true, down: C0.sprintT, primary: false });
  // stamina bar next to the sprint button
  const hp = s.human >= 0 ? s.players[s.human] : null;
  if (hp) { const w = 90, x = lay.sprint.x - w / 2, y = lay.sprint.y - lay.sprint.r - 16; roundPath(ctx, x, y, w, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); roundPath(ctx, x, y, Math.max(2, w * hp.stam), 8, 4); ctx.fillStyle = hp.stam > 0.25 ? '#7fe8d6' : '#ff9a86'; ctx.fill(); }
  // think
  drawButton(ctx, lay.think, 'Think', { dark: true, size: Math.round(24 * Math.min(lay.k, 1.2)) });
  // context line
  const msg = G.ctxMsg;
  if (msg) text(ctx, msg, W / 2, 1262 - Math.round(2 * lay.k), Math.round(20 * Math.min(lay.m, 1.4)), 'rgba(255,246,228,0.7)', 'center', 600, false);
}

function watchBar(ctx, G, s, lay) {
  const m = lay.m, w = G.watch;
  const rects = G.watchRects = {};
  const y = 1180, h = Math.round(74 * Math.min(m, 1.3));
  rects.pause = { x: 14, y, w: 200, h }; rects.less = { x: 226, y, w: 90, h }; rects.more = { x: 326, y, w: 90, h }; rects.exit = { x: 426, y, w: 280, h };
  const g = ctx.createLinearGradient(0, 1100, 0, H); g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(0.3, 'rgba(6,14,26,0.7)'); g.addColorStop(1, 'rgba(6,14,26,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, rects.pause, w.paused ? 'Resume' : 'Pause', { primary: true, size: Math.round(28 * Math.min(m, 1.2)) });
  drawButton(ctx, rects.less, 'T−', { dark: true, size: 26 }); drawButton(ctx, rects.more, 'T+', { dark: true, size: 26 });
  drawButton(ctx, rects.exit, 'Stop watching', { dark: true, size: Math.round(24 * Math.min(m, 1.2)) });
  text(ctx, `Thinking time ${G.thinkSec} s`, 320, y - 14, Math.round(20 * Math.min(m, 1.4)), 'rgba(255,246,228,0.8)', 'center', 600, false);
}

// ---- Think and the Watch & Learn hold overlay ------------------------------------------------------------------------------------------------
export function renderThinkBox(ctx, G, lay) {
  const th = G.think; if (!th) return;
  const m = lay.m, fs = Math.round(26 * Math.min(m, 1.6)), hs = Math.round(32 * Math.min(m, 1.4));
  ctx.font = `700 ${fs}px ${FONT}`;
  const l1 = wrapLines(ctx, th.text || '', W - 120);
  ctx.font = `400 ${fs}px ${FONT}`;
  const l2 = th.why ? wrapLines(ctx, th.why, W - 120) : [];
  const lh = fs * 1.3;
  const h = hs + 34 + (l1.length + l2.length) * lh + (l2.length ? 16 : 0) + 96;
  const y = Math.max(10, Math.min(lay.topH + 6, H - h - 10));
  panel(ctx, 30, y, W - 60, h, { r: 26, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.fillStyle = '#a8301f'; ctx.font = `700 ${hs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(th.title || 'Think', 58, y + 18 + hs * 0.85);
  let yy = y + 24 + hs;
  ctx.fillStyle = '#13283a'; ctx.font = `700 ${fs}px ${FONT}`;
  l1.forEach((l, i) => ctx.fillText(l, 58, yy + fs * (0.95 + i * 1.3))); yy += l1.length * lh + 16;
  ctx.fillStyle = '#3b4a5a'; ctx.font = `400 ${fs}px ${FONT}`;
  l2.forEach((l, i) => ctx.fillText(l, 58, yy + fs * (0.95 + i * 1.3)));
  const bw = (W - 120 - 14) / 2, by = y + h - 82;
  G.thinkRects = { close: { x: 58, y: by, w: bw, h: 62 }, use: { x: 58 + bw + 14, y: by, w: bw, h: 62 } };
  drawButton(ctx, G.thinkRects.close, 'Close', { size: 26 });
  drawButton(ctx, G.thinkRects.use, 'Got it', { primary: true, size: 26 });
}

export function renderHold(ctx, G, lay) {
  const hd = G.sim.hold; if (!hd) return;
  const w = G.watch, m = lay.m;
  const reveal = w.phase === 'reveal';
  const P = G.sim.players;
  // candidate marks on the pitch
  hd.options.forEach((o, i) => {
    const chosen = o === hd.options[0] || (hd.chosen && o.kind === hd.chosen.kind && o.tgt === hd.chosen.tgt);
    if (o.tgt >= 0) { const tg = P[o.tgt]; if (ring(ctx, G, tg.x, tg.z, chosen && reveal ? 1.2 : 0.9)) { ctx.lineWidth = chosen && reveal ? 6 : 3; ctx.strokeStyle = chosen && reveal ? '#7fe8d6' : 'rgba(255,255,255,0.65)'; ctx.stroke(); if (chosen && reveal) { ctx.fillStyle = 'rgba(127,232,214,0.22)'; ctx.fill(); } } }
  });
  const fs = Math.round(26 * Math.min(m, 1.6)), hs = Math.round(34 * Math.min(m, 1.4));
  const ch = hd.chosen;
  const title = reveal ? 'The player chooses' : 'What would you do?';
  const body = reveal ? `${kindName(ch.kind)}${ch.why ? `: ${ch.why}.` : '.'}` : `${hd.options.length} options: ${hd.options.map((o) => kindName(o.kind)).join(', ')}. Look at the pitch and think.`;
  ctx.font = `500 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, body, W - 120);
  const h = hs + lines.length * fs * 1.28 + 60, y = lay.topH + 90;
  panel(ctx, 30, y, W - 60, h, { r: 26, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(19,40,58,0.6)' });
  ctx.fillStyle = '#a8301f'; ctx.font = `700 ${hs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(title, 58, y + 18 + hs * 0.85);
  ctx.fillStyle = '#13283a'; ctx.font = `500 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, 58, y + 26 + hs + fs * (0.9 + i * 1.28)));
  const t = Math.max(0, w.timer);
  roundPath(ctx, 58, y + h - 26, W - 116, 10, 5); ctx.fillStyle = 'rgba(19,40,58,0.18)'; ctx.fill();
  const total = reveal ? 2 : G.thinkSec; roundPath(ctx, 58, y + h - 26, Math.max(4, (W - 116) * (t / total)), 10, 5); ctx.fillStyle = reveal ? '#1f9d8f' : '#e2503c'; ctx.fill();
}
const kindName = (k) => ({ shot: 'Shoot', pass: 'Pass along the ground', through: 'Through ball', lob: 'Lofted pass', cross: 'Cross', dribble: 'Dribble', clear: 'Clear the ball' }[k] || k);

// ---- 2D fallback pitch (no WebGL) -------------------------------------------------------------------------------------------------------------
export function renderFallback(ctx, G) {
  const s = G.sim;
  const P = (x, z, y = 0) => proj(G, x, y, z);
  const poly = (pts, fill, stroke, lw = 2) => { ctx.beginPath(); let ok = true; pts.forEach((q, i) => { const p = P(q[0], q[1]); if (!p) ok = false; else if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); if (!ok) return; ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); } };
  ctx.fillStyle = '#12301f'; ctx.fillRect(0, 0, W, H);
  poly([[-HW - 3, -HL - 3], [HW + 3, -HL - 3], [HW + 3, HL + 3], [-HW - 3, HL + 3]], '#1d5a33', null);
  for (let i = 0; i < 8; i++) { const z0 = -HL + i * (2 * HL / 8); if (i % 2 === 0) poly([[-HW, z0], [HW, z0], [HW, z0 + 2 * HL / 8], [-HW, z0 + 2 * HL / 8]], 'rgba(255,255,255,0.05)', null); }
  const line = (pts) => poly(pts, null, 'rgba(255,255,255,0.85)', 2.5);
  line([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]]);
  line([[-HW, 0], [HW, 0], [HW, 0.001], [-HW, 0.001]]);
  for (const sg of [-1, 1]) { line([[-BOX_HW, sg * HL], [-BOX_HW, sg * (HL - BOX_D)], [BOX_HW, sg * (HL - BOX_D)], [BOX_HW, sg * HL]]); }
  const circ = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; circ.push([Math.cos(a) * CIRCLE_R, Math.sin(a) * CIRCLE_R]); } line(circ);
  for (const sg of [-1, 1]) { poly([[-GOAL_HW, sg * HL], [GOAL_HW, sg * HL], [GOAL_HW, sg * (HL + 1.5)], [-GOAL_HW, sg * (HL + 1.5)]], 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.8)'); }
  // players, far to near
  const order = [...s.players].sort((a, b) => b.z - a.z);
  for (const p of order) {
    const base = P(p.x, p.z), top = P(p.x, p.z, 1.7); if (!base || !top) continue;
    const h = base.y - top.y, w = h * 0.34;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(base.x, base.y, w * 0.9, w * 0.35, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = KIT[p.team].top; roundPath(ctx, base.x - w / 2, top.y + h * 0.18, w, h * 0.55, w * 0.3); ctx.fill();
    ctx.fillStyle = '#e0b090'; ctx.beginPath(); ctx.arc(base.x, top.y + h * 0.1, w * 0.36, 0, TAU); ctx.fill();
    ctx.fillStyle = p.team === 0 ? '#ffffff' : '#222'; ctx.fillRect(base.x - w * 0.4, top.y + h * 0.7, w * 0.8, h * 0.18);
  }
  const b = s.ball, bp = P(b.x, b.z, b.y), bs = P(b.x, b.z, 0);
  if (bp && bs) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(bs.x, bs.y, 9, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bp.x, bp.y, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke(); }
}
