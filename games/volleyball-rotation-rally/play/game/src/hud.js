// In-play HUD: scoreboard, rotation mini-map, ring prompts, ball halo and landing marker, role tags, context buttons, Think / Pause.
// Everything follows the text size (through PLAY_M) and is laid out by layout.hudLayout so hit-testing and drawing agree.
import { W, H, PLAY_M, hudLayout, inRect, THINK_CARD } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { SHOTS, SHOT_IDS, SERVES, SERVE_IDS, SETS, TYPES, TEAM_COL, HW, HL, MODES, FRONT, SLOT, ROLES } from './consts.js';
import { initialCam, projectV } from './camera.js';
import { posAt, landTime } from './ball.js';
import { LAG, tmLabel } from './physics.js';
import { TIPS } from './content.js';

const TAU = Math.PI * 2;
const CAM = initialCam();
export const proj = (G, x, y, z) => projectV(CAM, G.viewW || 720, G.viewH || 1280, x, y, z);
const codeOf = (tp) => TYPES[tp].code;

// Context buttons for what the user is about to do.
export function contextOf(G, sim) {
  const s = sim.s, u = s.userId >= 0 ? s.players[s.userId] : null;
  if (!u) return { list: [], hint: '', kind: '' };
  const pr = s.prompt;
  let kind = pr ? (pr.kind === 'serveWait' ? 'serve' : pr.kind) : null;
  if (!kind) {
    const srv = s.rally && !s.rally.dead && s.phase === 'ready' && s.match.serving === 0 && s.players[s.teams[0].lineup[0] + 0 * 7].id === u.id;
    kind = srv ? 'serve' : u.tp === 0 ? 'set' : u.tp === 6 ? 'receive' : 'attack';
  }
  const pick = s.pick;
  if (kind === 'serve') return { kind, list: SERVE_IDS.map((id) => ({ id: `pk:serve:${id}`, label: SERVES[id].short, active: pick.serve === id })), hint: pr && pr.kind === 'serveWait' ? 'Tap to toss. Then press as the ring closes. Flick to aim.' : 'Press as the ring closes. Flick to aim.' };
  if (kind === 'set') return { kind, list: [{ id: 'pk:set:auto', label: 'Auto', active: pick.set === 'auto' }, { id: 'pk:set:outside', label: 'Outside', active: pick.set === 'outside' }, { id: 'pk:set:middle', label: 'Quick', active: pick.set === 'middle' }, { id: 'pk:set:right', label: 'Right', active: pick.set === 'right' }, { id: 'pk:set:dump', label: 'Dump', active: pick.set === 'dump' }], hint: 'Flick left, right, up or down to choose your hitter.' };
  if (kind === 'attack') return { kind, list: [{ id: 'pk:shot:auto', label: 'Auto', active: pick.shot === 'auto' }, ...SHOT_IDS.map((id) => ({ id: `pk:shot:${id}`, label: SHOTS[id].short, active: pick.shot === id }))], hint: 'Get to your spot. Press as the ring closes. Flick to aim.' };
  if (kind === 'block') return { kind, list: [], hint: 'Stand at the net. Press as the hitter swings.' };
  const role = ROLES.find((r) => r.type === u.tp);
  const tips = TIPS[role ? role.id : 'libero'];
  return { kind, list: [], hint: pr ? 'Press as the ring closes.' : tips[Math.floor(s.t / 7) % tips.length] };
}

export function hudRects(G, sim) {
  const cx = G.mode === 'watch' ? { list: [], hint: '', kind: '' } : contextOf(G, sim);
  const lay = hudLayout(G.settings.textIdx, cx.list.length, true);
  return { cx, lay };
}

// ---------------------------------------------------------------------------------------------------------------------------------
function scoreBar(ctx, G, s, lay) {
  const m = lay.m, h = lay.topH;
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(7,16,28,0.92)'); g.addColorStop(1, 'rgba(7,16,28,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  const mt = s.match, serving = mt.serving;
  const big = Math.round(44 * m), sm = Math.round(21 * m);
  ctx.textBaseline = 'alphabetic';
  const names = ['BLUE', 'RED'];
  for (const t of [0, 1]) {
    const x = t === 0 ? 24 : W - 24, al = t === 0 ? 'left' : 'right';
    ctx.textAlign = al;
    ctx.fillStyle = TEAM_COL[t]; ctx.font = `800 ${sm}px ${FONT}`;
    const you = t === 0 && s.userId >= 0 ? ' (you)' : '';
    ctx.fillText(names[t] + you, x, h * 0.34);
    ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${big}px ${FONT}`;
    ctx.fillText(String(mt.pts[t]), x, h * 0.80);
    if (serving === t) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(t === 0 ? x + ctx.measureText(String(mt.pts[t])).width + 20 * m : x - ctx.measureText(String(mt.pts[t])).width - 20 * m, h * 0.80 - big * 0.32, 8 * m, 0, TAU); ctx.fill(); }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.font = `700 ${Math.round(20 * m)}px ${FONT}`;
  const mo = MODES[mt.mode];
  ctx.fillText(mo.sets > 1 ? `Set ${mt.setNo} of ${mo.sets}  (${mt.sets[0]}-${mt.sets[1]})` : 'One set', W / 2, h * 0.60);
  ctx.font = `400 ${Math.round(18 * m)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.75)';
  ctx.fillText(`to ${mt.target}, win by 2`, W / 2, h * 0.84);
}

function miniMap(ctx, G, s, r) {
  panel(ctx, r.x, r.y, r.w, r.h, { r: 14, fill: 'rgba(8,18,32,0.78)', stroke: 'rgba(255,246,228,0.35)', shadow: false });
  const tm = s.teams[0];
  const cw = r.w / 3, ch = (r.h - 18) / 2;
  // screen order, front row on top: P4 P3 P2 / P5 P6 P1 (the camera looks from behind the team)
  const order = [[3, 2, 1], [4, 5, 0]];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  order.forEach((row, ri) => row.forEach((slot, ci) => {
    const tp = tm.lineup[slot];
    const x = r.x + ci * cw, y = r.y + 4 + ri * ch;
    const you = s.userId >= 0 && tp === s.players[s.userId].tp;
    roundPath(ctx, x + 3, y + 3, cw - 6, ch - 6, 8);
    ctx.fillStyle = you ? '#ffd24a' : tp === 6 ? 'rgba(255,210,74,0.35)' : 'rgba(43,111,214,0.55)'; ctx.fill();
    ctx.fillStyle = you ? '#13283a' : '#fff6e4'; ctx.font = `800 ${Math.round(ch * 0.42)}px ${FONT}`;
    ctx.fillText(codeOf(tp), x + cw / 2, y + ch * 0.44);
    ctx.font = `600 ${Math.round(ch * 0.2)}px ${FONT}`; ctx.fillStyle = you ? '#13283a' : 'rgba(255,246,228,0.75)';
    ctx.fillText(`P${slot + 1}`, x + cw / 2, y + ch * 0.8);
    if (slot === 0 && s.match.serving === 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + cw - 12, y + 12, 5, 0, TAU); ctx.fill(); }
  }));
  ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.font = `600 ${Math.round(r.h * 0.11)}px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('NET', r.x + r.w / 2, r.y + r.h - 3);
}

// Court overlays: the user's ring, role tags, ball halo, landing marker, prompt ring.
function courtOverlay(ctx, G, s, lay) {
  const u = s.userId >= 0 ? s.players[s.userId] : null;
  const now = s.t;
  // ball: halo and floor marker
  if (s.ball.vis) {
    const b = s.ball, p = proj(G, b.x, b.y, b.z), f = proj(G, b.x, 0, b.z);
    if (p && f) {
      const k = Math.max(0.6, 5.5 / Math.max(3, p.depth) * 3.2);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,246,228,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, 15 * k * 0.6 + 8, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y + 14); ctx.lineTo(f.x, f.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    if (b.flight && s.phase === 'rally') {
      const tl = landTime(b.flight);
      if (tl && tl > now) { const lp = posAt(b.flight, tl); const q = proj(G, lp.x, 0, lp.z); const inb = Math.abs(lp.x) <= HW + 0.06 && Math.abs(lp.z) <= HL + 0.06; if (q && lp.z < 0.5 && (Math.abs(lp.z) < HL + 3)) { ctx.save(); ctx.strokeStyle = inb ? 'rgba(255,246,228,0.8)' : 'rgba(255,150,130,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, 20, 9, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(q.x - 8, q.y - 3); ctx.lineTo(q.x + 8, q.y + 3); ctx.moveTo(q.x + 8, q.y - 3); ctx.lineTo(q.x - 8, q.y + 3); ctx.stroke(); ctx.restore(); } }
    }
  }
  // role tags above the user's team
  for (const p of s.players) {
    if (p.team !== 0 || !p.onCourt) continue;
    const q = proj(G, p.x, 2.55 + p.jy, p.z); if (!q) continue;
    const you = u && p.id === u.id;
    const txt = codeOf(p.tp);
    ctx.font = `800 ${you ? 22 : 16}px ${FONT}`;
    const w = ctx.measureText(txt).width + (you ? 20 : 14), h = you ? 30 : 22;
    roundPath(ctx, q.x - w / 2, q.y - h, w, h, 9);
    ctx.fillStyle = you ? '#ffd24a' : 'rgba(10,22,40,0.62)'; ctx.fill();
    ctx.fillStyle = you ? '#13283a' : 'rgba(255,246,228,0.88)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, q.x, q.y - h / 2 + 1);
    if (you) { ctx.beginPath(); ctx.moveTo(q.x - 7, q.y); ctx.lineTo(q.x + 7, q.y); ctx.lineTo(q.x, q.y + 9); ctx.closePath(); ctx.fillStyle = '#ffd24a'; ctx.fill(); }
  }
  if (!u || !u.onCourt) { if (u && !u.onCourt) { ctx.fillStyle = 'rgba(8,18,32,0.82)'; roundPath(ctx, W / 2 - 250, lay.topH + 150, 500, 60, 18); ctx.fill(); ctx.fillStyle = '#ffe9a0'; ctx.font = `700 ${Math.round(22 * Math.min(lay.m, 1.3))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('You are on the bench: a middle blocker serves', W / 2, lay.topH + 180); } return; }
  const feet = proj(G, u.x, 0, u.z);
  if (feet) {
    const pulse = 0.5 + 0.5 * Math.sin(G.t * 6);
    ctx.save(); ctx.strokeStyle = `rgba(255,210,74,${0.6 + 0.3 * pulse})`; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(feet.x, feet.y, 26, 11, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  const pr = s.prompt;
  if (pr && pr.stand && pr.kind !== 'serveWait') {
    const st = proj(G, pr.stand.x, 0, pr.stand.z);
    if (st) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(st.x, st.y, 30, 13, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.restore();
    }
  }
  if (pr && pr.kind !== 'serveWait' && pr.close !== undefined && feet) {
    const total = pr.close - pr.open, left = pr.close - now;
    const pressed = pr.pressed !== null && pr.pressed !== undefined;
    ctx.save();
    // fixed target ring
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(feet.x, feet.y - 4, 40, 17, 0, 0, TAU); ctx.stroke();
    if (now >= pr.open - 0.3 && !pressed) {
      const u01 = Math.max(0, Math.min(1, left / Math.max(0.2, total)));
      const rx = 40 + 130 * u01, ry = 17 + 56 * u01;
      const late = left < -0.02;
      ctx.strokeStyle = late ? 'rgba(255,120,100,0.9)' : u01 < 0.12 ? 'rgba(127,232,214,1)' : 'rgba(255,210,74,0.95)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(feet.x, feet.y - 4, rx, ry, 0, 0, TAU); ctx.stroke();
    }
    ctx.font = `800 ${Math.round(24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 5;
    ctx.fillText(pr.label || '', feet.x, feet.y + 44);
    ctx.restore();
  }
  // feedback popups (last touch of the user)
  const fb = G.feedback;
  if (fb && now - fb.t < 1.3 && now >= fb.t) {
    const age = (now - fb.t) / 1.3; const q = proj(G, fb.x, 2.0, fb.z);
    if (q) { ctx.save(); ctx.globalAlpha = 1 - age * age; ctx.font = `800 ${Math.round(34 * Math.min(1.4, lay.m))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = fb.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 6; ctx.fillText(fb.text, q.x, q.y - 40 * age); ctx.restore(); }
  }
}

function banner(ctx, G, s, lay) {
  const a = s.announce;
  if (!a) return;
  const age = s.t - a.t;
  const hold = G.settings.textIdx > 1 ? 2.6 : 1.9;
  if (age < 0 || age > hold) return;
  const m = lay.m;
  const text = a.text;
  ctx.save();
  ctx.globalAlpha = Math.min(1, (hold - age) * 2);
  ctx.font = `800 ${Math.round(34 * m)}px ${FONT}`;
  const w = Math.min(W - 40, ctx.measureText(text).width + 56), h = Math.round(64 * m);
  const y = lay.topH + 150 * Math.min(m, 1.3);
  roundPath(ctx, W / 2 - w / 2, y, w, h, 20); ctx.fillStyle = 'rgba(8,18,32,0.82)'; ctx.fill();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const px = fitPx(ctx, text, 800, Math.round(34 * m), w - 30, 14); ctx.font = `800 ${px}px ${FONT}`;
  ctx.fillText(text, W / 2, y + h / 2 + 1);
  ctx.restore();
}

function bottomPanel(ctx, G, s, rects) {
  const { cx, lay } = rects;
  const top = lay.barTop - 6;
  const g = ctx.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(7,16,28,0)'); g.addColorStop(0.18, 'rgba(7,16,28,0.72)'); g.addColorStop(1, 'rgba(7,16,28,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
  if (lay.hint && cx.hint) {
    ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = Math.round(20 * lay.m);
    ctx.font = `600 ${px}px ${FONT}`;
    const lines = wrapLines(ctx, cx.hint, lay.hint.w - 20).slice(0, 2);
    lines.forEach((l, k) => ctx.fillText(l, W / 2, lay.hint.y + lay.hint.h / 2 + (k - (lines.length - 1) / 2) * px * 1.2));
  }
  cx.list.forEach((b, i) => drawButton(ctx, lay.choices[i].rect, b.label, { active: b.active, size: Math.round(24 * lay.m) }));
  const u = lay.util;
  drawButton(ctx, u[0], 'Think', { dark: true, size: Math.round(24 * lay.m) });
  drawButton(ctx, u[1], 'Pause', { dark: true, size: Math.round(24 * lay.m) });
  drawButton(ctx, u[2], 'Roles', { dark: true, size: Math.round(24 * lay.m), active: G.showRot });
}

function rotationOverlay(ctx, G, s) {
  ctx.fillStyle = 'rgba(6,14,26,0.78)'; ctx.fillRect(0, 0, W, H);
  panel(ctx, 40, 180, 640, 760, { r: 28, fill: 'rgba(14,34,52,0.96)', stroke: 'rgba(255,246,228,0.4)' });
  const m = PLAY_M[G.settings.textIdx];
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${Math.round(34 * Math.min(m, 1.4))}px ${FONT}`; ctx.fillText('Rotation', W / 2, 238);
  const tm = s.teams[0];
  const cw = 190, ch = 150, x0 = W / 2 - cw * 1.5, y0 = 292;
  const order = [[3, 2, 1], [4, 5, 0]];
  order.forEach((row, ri) => row.forEach((slot, ci) => {
    const tp = tm.lineup[slot]; const x = x0 + ci * cw, y = y0 + ri * (ch + 18) + (ri ? 30 : 0);
    const you = s.userId >= 0 && tp === s.players[s.userId].tp;
    roundPath(ctx, x + 6, y, cw - 12, ch, 16); ctx.fillStyle = you ? '#ffd24a' : tp === 6 ? 'rgba(255,210,74,0.4)' : 'rgba(43,111,214,0.6)'; ctx.fill();
    ctx.fillStyle = you ? '#13283a' : '#fff6e4'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(46 * Math.min(1.3, m))}px ${FONT}`; ctx.fillText(codeOf(tp), x + cw / 2, y + ch * 0.55);
    ctx.font = `600 ${Math.round(22 * Math.min(1.3, m))}px ${FONT}`; ctx.fillText(`Position ${slot + 1}${slot === 0 ? ' (serves)' : ''}`, x + cw / 2, y + ch * 0.86);
  }));
  ctx.fillStyle = 'rgba(255,246,228,0.85)'; ctx.font = `700 ${Math.round(22 * Math.min(1.3, m))}px ${FONT}`;
  ctx.fillText('NET', W / 2, y0 - 12);
  const lines = wrapLines(ctx, 'Front row at the top, back row below. When you win the serve back everyone moves one place clockwise: the player who steps into position 1 serves. The libero (yellow) replaces a middle blocker in the back row.', 560);
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.round(24 * Math.min(m, 1.5))}px ${FONT}`; ctx.fillStyle = '#fff6e4';
  const px = Math.round(24 * Math.min(m, 1.5)); ctx.font = `400 ${px}px ${FONT}`;
  wrapLines(ctx, 'Front row at the top, back row below. When you win the serve back everyone moves one place clockwise: the player who steps into position 1 serves. The libero (yellow) replaces a middle blocker in the back row.', 580).forEach((l, k) => ctx.fillText(l, W / 2, 666 + k * px * 1.3));
  void lines;
  drawButton(ctx, { x: 200, y: 850, w: 320, h: 70 }, 'Close', { primary: true, size: 28 });
}
export const ROT_CLOSE = { x: 200, y: 850, w: 320, h: 70 };

// Think card (also used for the Watch & Learn reveal)
export function renderThink(ctx, G, title, lines, useLabel) {
  ctx.fillStyle = 'rgba(6,14,26,0.55)'; ctx.fillRect(0, 0, W, H);
  const sc = [1, 1.2, 1.4, 1.6, 1.8][G.settings.textIdx];
  const r = { ...THINK_CARD };
  ctx.font = `600 ${Math.round(26 * sc)}px ${FONT}`;
  const all = [];
  lines.forEach((l) => wrapLines(ctx, l, r.w - 60).forEach((x) => all.push(x)));
  const lh = Math.round(26 * sc * 1.3);
  r.h = Math.min(H - 300, Math.max(300, 160 + all.length * lh + 120));
  r.y = Math.max(130, (H - r.h) / 2 - 60);
  panel(ctx, r.x, r.y, r.w, r.h, { r: 28, fill: 'rgba(14,34,52,0.97)', stroke: 'rgba(255,246,228,0.45)' });
  ctx.fillStyle = '#ffe9a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 ${Math.round(34 * Math.min(sc, 1.5))}px ${FONT}`;
  ctx.fillText(title, W / 2, r.y + 62);
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.font = `500 ${Math.round(26 * sc)}px ${FONT}`;
  all.slice(0, Math.floor((r.h - 220) / lh)).forEach((l, k) => ctx.fillText(l, r.x + 30, r.y + 120 + k * lh));
  const bh = Math.round(72 * Math.min(sc, 1.4));
  const rects = { close: { x: r.x + 24, y: r.y + r.h - bh - 20, w: useLabel ? 250 : r.w - 48, h: bh }, use: useLabel ? { x: r.x + 24 + 270, y: r.y + r.h - bh - 20, w: r.w - 48 - 270, h: bh } : null };
  drawButton(ctx, rects.close, 'Close', { dark: true, size: Math.round(26 * Math.min(sc, 1.4)) });
  if (rects.use) drawButton(ctx, rects.use, useLabel, { primary: true, size: Math.round(26 * Math.min(sc, 1.4)) });
  G.thinkRects = rects;
}

export function watchHud(ctx, G, s) {
  const w = G.watch;
  const y = H - 150;
  const g = ctx.createLinearGradient(0, y - 20, 0, H); g.addColorStop(0, 'rgba(7,16,28,0)'); g.addColorStop(0.2, 'rgba(7,16,28,0.8)'); g.addColorStop(1, 'rgba(7,16,28,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 20, W, H - y + 20);
  const m = Math.min(1.3, PLAY_M[G.settings.textIdx]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const rects = W_RECTS(m);
  drawButton(ctx, rects[0], w.paused ? 'Resume' : 'Pause', { primary: w.paused, dark: !w.paused, size: Math.round(24 * m) });
  drawButton(ctx, rects[1], 'Think −', { dark: true, size: Math.round(22 * m) });
  drawButton(ctx, rects[2], 'Think +', { dark: true, size: Math.round(22 * m) });
  drawButton(ctx, rects[3], 'Quit', { dark: true, size: Math.round(22 * m) });
  ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(24 * m)}px ${FONT}`;
  const label = s.hold ? (w.phase === 'think' ? `THINK  ${Math.ceil(Math.max(0, w.timer))}` : w.phase === 'reveal' ? 'REVEAL' : 'ACT') : 'WATCHING';
  ctx.fillText(label, W / 2, y - 6 + 8);
}
export const W_RECTS = (m = 1) => { const h = Math.round(64 * m), y = H - 12 - h, gap = 8; const ws = [0.34, 0.22, 0.22, 0.22]; let x = 12; return ws.map((f) => { const w = (W - 24 - gap * 3) * f; const r = { x, y, w, h }; x += w + gap; return r; }); };
export function watchHit(G, x, y) { const r = W_RECTS(Math.min(1.3, PLAY_M[G.settings.textIdx])); for (let i = 0; i < r.length; i++) if (inRect(r[i], x, y)) return i; return -1; }

export function renderHud(ctx, G, S, view) {
  const s = S.s;
  const rects = hudRects(G, S);
  const { lay } = rects;
  scoreBar(ctx, G, s, lay);
  if (s.userId >= 0 && G.mode !== 'watch') miniMap(ctx, G, s, lay.mini);
  courtOverlay(ctx, G, s, lay);
  banner(ctx, G, s, lay);
  if (G.mode === 'watch' && s.hold && s.hold.at && G.watch.phase === 'reveal') {
    const q = proj(G, s.hold.at.x, 0, s.hold.at.z);
    if (q) { ctx.save(); ctx.strokeStyle = '#7fe8d6'; ctx.lineWidth = 5; const k = 1 + 0.15 * Math.sin(G.t * 8); ctx.beginPath(); ctx.ellipse(q.x, q.y, 34 * k, 15 * k, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, TAU); ctx.fillStyle = '#7fe8d6'; ctx.fill(); ctx.restore(); }
  }
  if (G.mode === 'watch') watchHud(ctx, G, s); else bottomPanel(ctx, G, s, rects);
  if (G.mode === 'drill' && G.learn.tally) { ctx.fillStyle = '#ffe9a0'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(22 * Math.min(1.3, lay.m))}px ${FONT}`; ctx.fillText(`Practice ${G.learn.tally.n}/${G.learn.lessonN}  ·  goal ${G.learn.goal}`, W / 2, lay.topH + 24); }
  if (G.showRot) rotationOverlay(ctx, G, s);
}

// 2D fallback when WebGL is not available: a simple projected court with discs for the players.
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  ctx.fillStyle = '#0d1722'; ctx.fillRect(0, 0, W, H);
  const P = (x, y, z) => proj(G, x, y, z);
  const corners = [[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]].map(([x, z]) => P(x, 0, z));
  ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.fillStyle = '#c98b4a'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  const a = P(-HW - 0.5, 0, 0), b = P(HW + 0.5, 0, 0); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = 5; ctx.stroke();
  const a2 = P(-HW - 0.5, s.netH, 0), b2 = P(HW + 0.5, s.netH, 0); ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
  for (const p of s.players) { if (!p.onCourt) continue; const q = P(p.x, 0.9 + p.jy, p.z); if (!q) continue; ctx.beginPath(); ctx.arc(q.x, q.y, 14, 0, TAU); ctx.fillStyle = p.tp === 6 ? '#ffd24a' : TEAM_COL[p.team]; ctx.fill(); }
  if (s.ball.vis) { const q = P(s.ball.x, s.ball.y, s.ball.z); ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, TAU); ctx.fillStyle = '#fff6e4'; ctx.fill(); }
}
export { FRONT, SLOT, LAG, tmLabel };
