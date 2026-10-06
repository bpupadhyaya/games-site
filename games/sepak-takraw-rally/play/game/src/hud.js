// In-play HUD: scoreboard, prompts, aim marker, timing ring, choice buttons, Think and Pause. Everything follows the text size
// (through PLAY_M) and is laid out by layout.hudLayout so hit-testing and drawing agree.
import { W, H, PLAY_M, hudLayout, inRect, host, G as LG } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, fitPx, fl } from './ui.js';
import { ATTACKS, ATTACK_IDS, SERVES, SERVE_IDS, BLOCKS, BLOCK_IDS, ZONES } from './consts.js';
import { projectV } from './camera.js';

import { LESSONS } from './content.js';
const LESSONS_TITLE = (G) => `${LESSONS[G.learn.cur].title.replace(/^\d+\. /, '')} (${G.learn.tally.n}/${LESSONS[G.learn.cur].n})`;
const TAU = Math.PI * 2;
// last drawn HUD geometry (read by the layout checks; kept out of the game state)
export const HUDX = { lay: null, rects: null, think: null };
export const ROLE_NAME = ['Back', 'Left', 'Right'];

// Which human team is being asked for something right now, and what.
export function controlState(G, sim) {
  const s = sim.s;
  let team = -1, pend = null;
  for (const t of [0, 1]) {
    if (!s.teams[t].human) continue;
    const p = s.pending[t];
    if (p && s.t < p.deadline - 0.04 && s.phase !== 'dead' && s.phase !== 'ready' && !(p.kind === 'serve' && s.phase !== 'serve')) { if (team < 0 || p.deadline < pend.deadline) { team = t; pend = p; } }
  }
  const human = s.teams[0].human ? 0 : s.teams[1].human ? 1 : -1;
  return { team, pend, human };
}

// choice buttons for a pending decision
export function choicesFor(G, sim, cs) {
  const s = sim.s;
  if (cs.team < 0) return { list: [], action: null, perRow: 0 };
  const t = cs.team, ch = s.choice[t], p = cs.pend;
  if (p.kind === 'serve') return { list: SERVE_IDS.map((id) => ({ id: `stype:${id}`, label: SERVES[id].short, sub: SERVES[id].blurb && '', active: ch.stype === id })), action: { label: 'SERVE', ring: true }, perRow: 0 };
  if (p.kind === 'recv') {
    const rec = s.players[p.receiver].role;
    return { list: [0, 1, 2].filter((r) => r !== rec).map((r) => ({ id: `att:${r}`, label: `${ROLE_NAME[r]} attacks`, active: ch.attacker === r })), action: null, perRow: 0 };
  }
  if (p.kind === 'set') {
    const zl = ['Left', 'Middle', 'Right'];
    const list = ZONES.map((z, i) => ({ id: `zone:${z}`, label: zl[i], active: ch.zone === z && ch.pace !== 'over' }));
    list.push({ id: 'pace:high', label: 'High', active: ch.pace === 'high' }, { id: 'pace:quick', label: 'Quick', active: ch.pace === 'quick' }, { id: 'pace:over', label: 'Free ball', active: ch.pace === 'over' });
    return { list, action: null, perRow: 3 };
  }
  if (p.kind === 'attack') return { list: ATTACK_IDS.map((id) => ({ id: `atype:${id}`, label: ATTACKS[id].short, active: ch.atype === id })), action: { label: 'SMASH', ring: true }, perRow: 0 };
  if (p.kind === 'block') return { list: BLOCK_IDS.map((id) => ({ id: `block:${id}`, label: id === 'single' ? 'Single' : id === 'double' ? 'Double' : 'Drop back', active: ch.block === id })), action: null, perRow: 0 };
  return { list: [], action: null, perRow: 0 };
}

export const goKeyOf = (cs) => (cs.team >= 0 ? `${cs.team}:${cs.pend.kind}:${cs.pend.deadline.toFixed(3)}` : '');
export function hudRects(G, sim, view) {
  const cs = controlState(G, sim);
  let cf = G.mode === 'watch' ? { list: [], action: null, perRow: 0 } : choicesFor(G, sim, cs);
  if (cs.team >= 0 && G.settings.decision === 'wait' && G.goKey !== goKeyOf(cs) && G.mode !== 'watch') cf = { ...cf, action: { label: 'GO', go: true } };
  const lay = hudLayout(G.settings.textIdx, cf.list.length, !!cf.action, cf.perRow);
  HUDX.lay = lay;
  return { cs, cf, lay };
}

const PROMPT = { serve: 'Tap the court to aim, pick a serve, press SERVE when the ring closes', recv: 'Choose who attacks', set: 'Choose where and how to set', attack: 'Tap the court to aim, pick an attack, press SMASH when the ring closes', block: 'Choose how to block' };

function projPt(G, view, x, y, z) { const cam = G.sim.cam; return projectV(cam, view.cssW || W, view.cssH || H, x, y, z); }

function aimMarker(ctx, G, view, aim, col = '#ffd54a', lbl) {
  if (!aim) return;
  const c = projPt(G, view, aim.x, 0.02, aim.z), a = projPt(G, view, aim.x + 0.45, 0.02, aim.z), b = projPt(G, view, aim.x, 0.02, aim.z + 0.45);
  if (!c || !a || !b) return;
  const rx = Math.max(10, Math.abs(a.x - c.x)), ry = Math.max(6, Math.abs(b.y - c.y));
  ctx.save();
  ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(255,213,74,0.25)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c.x - rx * 0.6, c.y); ctx.lineTo(c.x + rx * 0.6, c.y); ctx.moveTo(c.x, c.y - ry * 0.6); ctx.lineTo(c.x, c.y + ry * 0.6); ctx.lineWidth = 3; ctx.stroke();
  if (lbl) { ctx.font = `700 ${fl(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(lbl, c.x, c.y - ry - 8); }
  ctx.restore();
}

function badge(ctx, x, y, text, col = '#ffd54a', size = 24) {
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 22;
  roundPath(ctx, x - w / 2, y - size, w, size * 1.5, 12); ctx.fillStyle = 'rgba(8,18,30,0.82)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 2); ctx.restore();
}

function scoreboard(ctx, G, s, m, lay) {
  const mt = s.match, tm = s.teams;
  const th = lay.topH - host.t;
  ctx.save(); ctx.translate(0, host.t);
  const g = ctx.createLinearGradient(0, 0, 0, th + 30); g.addColorStop(0, 'rgba(6,14,26,0.86)'); g.addColorStop(1, 'rgba(6,14,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, -host.t, W, th + 30 + host.t);
  // the block sits clear of the host's floating back button and the safe areas; in landscape it is a centred strip
  const lo = Math.max(18, host.l + 8, host.back ? LG.backBox.x + LG.backBox.w + 6 : 0), hi = W - Math.max(18, host.r + 8);
  const tw = Math.min(hi - lo, lay.land ? 760 : W), x00 = (lo + hi) / 2 - tw / 2, cx = (lo + hi) / 2;
  const centerW = 184, colw = Math.max(150, (tw - centerW) / 2);
  const nameOf = (i) => { let n = tm[i].name; ctx.font = `700 ${Math.round(24 * m)}px ${FONT}`; if (ctx.measureText(n).width > colw - 34) { const mm = /^(\S+).*(\((?:red|blue)\))$/.exec(n); n = mm ? `${mm[1]} ${mm[2]}` : n.split(' ')[0]; } return n; };
  for (const i of [0, 1]) {
    const left = i === 0;
    const x0 = left ? x00 : x00 + tw - colw;
    ctx.fillStyle = i === 0 ? '#e0443a' : '#2a79d4';
    roundPath(ctx, x0, 14, 10, th - 44, 5); ctx.fill();
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const ax = left ? x0 + 22 : x0 + colw - 22;
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.round(24 * m)}px ${FONT}`; ctx.fillText(nameOf(i), ax, 14 + 26 * m);
    ctx.font = `800 ${Math.round(58 * m)}px ${FONT}`; ctx.fillText(String(mt.pts[i]), ax, 14 + 26 * m + 56 * m);
    if (mt.serving === i) { ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(left ? x0 + colw - 20 : x0 + 20, 14 + 16 * m, 7 * Math.min(m, 1.4), 0, TAU); ctx.fill(); }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(40 * m)}px ${FONT}`; ctx.fillText(`${mt.sets[0]} \u2013 ${mt.sets[1]}`, cx, 14 + 24 * m + 40 * m);
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.max(Math.round(20 * m), fl(20))}px ${FONT}`; ctx.fillText(mt.setsToWin === 1 ? 'Quick match' : `Set ${mt.setNo}`, cx, 14 + 24 * m + 40 * m + 24 * m);
  ctx.restore();
}

function wrapped(ctx, text, x, y, maxW, size, color = '#fff6e4', lh = 1.25, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, maxW); lines.forEach((l, i) => ctx.fillText(l, x, y + size * (0.9 + i * lh)));
  return lines.length * size * lh;
}

export function renderHud(ctx, G, sim, view) {
  const s = sim.s;
  const { cs, cf, lay } = hudRects(G, sim, view);
  const m = lay.m;
  scoreboard(ctx, G, s, m, lay);
  if (!lay.land) {
    // the bottom bar background
    const bg = ctx.createLinearGradient(0, lay.barTop - 40, 0, H); bg.addColorStop(0, 'rgba(6,14,26,0)'); bg.addColorStop(0.25, 'rgba(6,14,26,0.55)'); bg.addColorStop(1, 'rgba(6,14,26,0.85)');
    ctx.fillStyle = bg; ctx.fillRect(0, lay.barTop - 40, W, H - lay.barTop + 40);
  } else {
    // landscape: the court sits in the middle; soft shading behind the side panels keeps the buttons readable
    const rg = ctx.createLinearGradient(lay.panelX - 40, 0, W, 0); rg.addColorStop(0, 'rgba(6,14,26,0)'); rg.addColorStop(0.3, 'rgba(6,14,26,0.5)'); rg.addColorStop(1, 'rgba(6,14,26,0.8)');
    ctx.fillStyle = rg; ctx.fillRect(lay.panelX - 40, 0, W - lay.panelX + 40, H);
    const lw = lay.util.think.x + lay.util.think.w + 30, lg = ctx.createLinearGradient(0, 0, lw, 0); lg.addColorStop(0, 'rgba(6,14,26,0.8)'); lg.addColorStop(0.7, 'rgba(6,14,26,0.5)'); lg.addColorStop(1, 'rgba(6,14,26,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, lw, H);
  }
  // aim markers
  if (G.mode !== 'watch' && cs.human >= 0) {
    const ch = s.choice[cs.human];
    if (cs.pend && (cs.pend.kind === 'serve')) aimMarker(ctx, G, view, ch.serveAim, '#ffd54a', 'Aim');
    else if (cs.pend && cs.pend.kind === 'attack') aimMarker(ctx, G, view, ch.aim, '#ffd54a', 'Aim');
    else if (cs.pend && cs.pend.kind === 'set' && ch.pace === 'over') aimMarker(ctx, G, view, ch.overAim, '#7fe8d6', 'Free ball');
  }
  // candidate attackers
  if (cs.team >= 0 && cs.pend.kind === 'recv') {
    const rec = s.players[cs.pend.receiver].role;
    for (const r of [0, 1, 2]) {
      if (r === rec) continue;
      const p = s.players[cs.team * 3 + r], pt = projPt(G, view, p.x, 2.15, p.z);
      if (pt) badge(ctx, pt.x, pt.y, r === 0 ? 'Back' : r === 1 ? 'Left' : 'Right', s.choice[cs.team].attacker === r ? '#7fe8d6' : '#ffd54a', Math.max(fl(21), Math.round(20 * Math.min(m, 1.5))));
    }
  }
  if (G.mode === 'watch' && s.hold && G.watch.phase !== 'think') {
    const d = s.hold.decision.choice;
    const ptn = d.aim || d.serveAim || d.overAim;
    if (ptn) aimMarker(ctx, G, view, ptn, '#7fe8d6', 'Plan');
  }
  // prompt line
  let promptText = '';
  if (G.mode === 'watch') promptText = 'Watch & Learn';
  else if (G.mode === 'drill' && G.learn.tally) promptText = `${LESSONS_TITLE(G)}: ${G.learn.tally.ok} good of ${G.learn.tally.n} tried`;
  else if (cs.team >= 0) promptText = (s.cfg.humans[0] && s.cfg.humans[1] ? `Player ${cs.team + 1}: ` : '') + (PROMPT[cs.pend.kind] || '');
  else if (s.phase === 'ready') promptText = `${s.teams[s.match.serving].name} to serve`;
  if (promptText) {
    const P = lay.prompt, pw = P.w, ps = Math.max(Math.round(24 * P.m), fl(22));
    ctx.font = `700 ${ps}px ${FONT}`; const lines = wrapLines(ctx, promptText, pw - 36);
    const ph = lines.length * ps * 1.25 + 18, py = P.y;
    roundPath(ctx, P.x, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.72)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, P.cx, py + 12 + ps * (0.95 + i * 1.25)));
    lay.promptRect = { x: P.x, y: py, w: pw, h: ph };
  }
  // announce / point banner
  const showLast = s.last && s.phase === 'dead' && s.t - s.last.t < 2.3;
  if (showLast) {
    const B = lay.banner, txt = s.last.text, big = Math.round(44 * Math.min(m, 1.5));
    ctx.font = `800 ${big}px ${FONT}`; const lines = wrapLines(ctx, txt, B.w - 10);
    const ph = lines.length * big * 1.2 + 26, py = Math.round(B.y - ph / 2);
    roundPath(ctx, B.cx - B.w / 2, py, B.w, ph, 20); ctx.fillStyle = 'rgba(8,18,30,0.78)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = s.last.winner === 0 ? '#e0443a' : '#2a79d4'; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.font = `800 ${big}px ${FONT}`; lines.forEach((l, i) => ctx.fillText(l, B.cx, py + 14 + big * (0.95 + i * 1.2)));
    lay.bannerRect = { x: B.cx - B.w / 2, y: py, w: B.w, h: ph };
  } else if (G.feedback && s.t - G.feedback.t < 1.3) {
    const f = G.feedback, big = Math.round(48 * Math.min(m, 1.5));
    ctx.font = `800 ${big}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8;
    ctx.fillText(f.text, lay.banner.cx, lay.banner.y); ctx.shadowBlur = 0;
  }
  // buttons
  if (G.mode === 'watch') return renderWatchButtons(ctx, G, s, lay, m);
  HUDX.rects = { util: lay.util, action: lay.action, choices: lay.choices.map((c) => c.rect) };
  cf.list.forEach((c, i) => { const r = lay.choices[i].rect; drawButton(ctx, r, c.label, { active: c.active, size: Math.round(26 * Math.min(m, 1.7)) }); });
  if (cf.action) {
    const r = lay.action;
    drawButton(ctx, r, cf.action.label, { primary: true, size: Math.round(40 * Math.min(m, 1.6)) });
    if (!cf.action.go) ringOverlay(ctx, s, r, cs);
  }
  drawButton(ctx, lay.util.think, 'Think', { dark: true, size: Math.round(26 * Math.min(m, 1.7)), disabled: cs.team < 0 });
  drawButton(ctx, lay.util.pause, 'Pause', { dark: true, size: Math.round(26 * Math.min(m, 1.7)) });
  if (cs.team < 0 && s.phase !== 'dead' && !showLast && G.hintAim && cs.human >= 0) { /* nothing */ }
}

function ringOverlay(ctx, s, r, cs) {
  const ring = s.ring;
  if (!ring || ring.team !== cs.team) return;
  const u = (s.t - ring.open) / (ring.close - ring.open);
  if (u < -0.05) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.h * 0.5, 62);
  const outer = rad + Math.max(0, 1 - u) * 150;
  ctx.save();
  const tapped = ring.tapped !== null;
  ctx.lineWidth = 7;
  ctx.strokeStyle = tapped ? 'rgba(127,232,214,0.9)' : u > 0.82 && u < 1.12 ? '#7fe8d6' : u >= 1.12 ? '#ff8a6a' : '#ffd54a';
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(rad, outer), 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
  ctx.restore();
}

function renderWatchButtons(ctx, G, s, lay, m) {
  const w = G.watch;
  const sz = Math.round(24 * Math.min(m, 1.7));
  // reveal / think panel
  let msg = '';
  if (s.hold) {
    const d = s.hold.decision, tn = s.teams[s.hold.team].name;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)}s: ${tn} are weighing their options for the ${s.hold.kind === 'recv' ? 'receive' : s.hold.kind}.`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${tn}: ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = 'ACT: the play continues.';
  const I = lay.winfo, ps = Math.max(Math.round(22 * Math.min(m, 1.5)), fl(22)), pw = I.w;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30);
  const maxLines = lay.land ? Math.max(3, Math.floor((I.bottom - I.top - 20) / (ps * 1.25))) : 9;
  const shown = lines.slice(0, maxLines);
  const ph = shown.length * ps * 1.25 + 20, py = I.bottom - ph;
  roundPath(ctx, I.x, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.85)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  shown.forEach((l, i) => ctx.fillText(l, I.x + 16, py + 10 + ps * (0.95 + i * 1.25)));
  lay.infoRect = { x: I.x, y: py, w: pw, h: ph };
  // buttons: Pause/Resume, - think, + think, Exit
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think \u2212', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  lay.watchRects.forEach((rc, i) => { W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
  HUDX.rects = { watch: lay.watchRects.slice(), info: lay.infoRect };
}
export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }

// Think panel (modal). The text scale steps down until the whole panel fits the screen (landscape is only 720 units high); the two buttons sit side by side when it is wide.
function thinkLayout(ctx, t, m, pw) {
  const size = Math.max(fl(22), Math.round(26 * Math.min(m, 2))), tsz = Math.max(fl(24), Math.round(34 * Math.min(m, 1.6))), ssz = Math.max(fl(24), Math.round(28 * Math.min(m, 1.6)));
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, pw - 60);
  ctx.font = `700 ${ssz}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, pw - 50);
  const bh = Math.max(60, Math.min(100, Math.round(46 / Math.max(0.3, host.px))), Math.round(84 * Math.min(m, 1.5))), side = pw >= 600;
  const head = tsz + 34, sumH = sm.length * ssz * 1.2 + 8, bodyH = size * 1.3 * lines.length + 20, btnH = side ? bh + 40 : bh * 2 + 54;
  return { size, tsz, ssz, lines, sm, bh, side, head, sumH, bodyH, total: 20 + head + sumH + bodyH + btnH };
}
export function renderThink(ctx, G, view) {
  const t = G.think;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 60, 820), x = (W - pw) / 2;
  const avail = H - Math.max(24, host.t + 12) - Math.max(24, host.b + 12);
  let m = PLAY_M[G.settings.textIdx], L = thinkLayout(ctx, t, m, pw);
  while (L.total > avail && m > 0.75) { m = Math.max(0.75, m - 0.125); L = thinkLayout(ctx, t, m, pw); }
  const total = Math.min(avail, L.total), y = Math.max(Math.max(24, host.t + 12), (H - total) / 2);
  panel(ctx, x, y, pw, total, { r: 26, fill: 'rgba(14,34,52,0.96)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, pw, total); ctx.clip();
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${L.tsz}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + 20 + L.tsz);
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${L.ssz}px ${FONT}`;
  L.sm.forEach((l, i) => ctx.fillText(l, W / 2, y + 20 + L.head + L.ssz * (0.9 + i * 1.2)));
  const off = y + 20 + L.head + L.sumH;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${L.size}px ${FONT}`;
  L.lines.forEach((l, i) => ctx.fillText(l, x + 30, off + L.size * (0.95 + i * 1.3)));
  ctx.restore();
  const bh = L.bh;
  if (L.side) {
    const by = y + total - bh - 22, hw = (pw - 48 - 16) / 2;
    G.thinkRects = { use: { x: x + 24, y: by, w: hw, h: bh }, close: { x: x + 24 + hw + 16, y: by, w: hw, h: bh } };
  } else {
    const by = y + total - bh * 2 - 36;
    G.thinkRects = { use: { x: x + 24, y: by, w: pw - 48, h: bh }, close: { x: x + 24, y: by + bh + 14, w: pw - 48, h: bh } };
  }
  drawButton(ctx, G.thinkRects.use, 'Use it', { primary: true, size: Math.round(30 * Math.min(Math.max(m, 1), 1.5)) });
  drawButton(ctx, G.thinkRects.close, 'Close', { dark: true, size: Math.round(28 * Math.min(Math.max(m, 1), 1.5)) });
  HUDX.think = { x, y, w: pw, h: total };
}

// 2D fallback when WebGL is missing: a simple top-down-in-perspective court drawn through the same camera maths.
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const Wd = view.cssW || 720, Hd = view.cssH || 1280;
  const P = (x, y, z) => projectV(s.cam, Wd, Hd, x, y, z);
  ctx.save();
  ctx.fillStyle = '#10202f'; ctx.fillRect(0, 0, W, H);
  const corners = [[-HW_, -HL_], [HW_, -HL_], [HW_, HL_], [-HW_, HL_]].map(([x, z]) => P(x, 0, z));
  if (corners.every(Boolean)) {
    ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath();
    ctx.fillStyle = '#2f7a9e'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f6f7fb'; ctx.stroke();
  }
  const n0 = P(-HW_ - 0.3, s.netH, 0), n1 = P(HW_ + 0.3, s.netH, 0), g0 = P(-HW_ - 0.3, 0, 0), g1 = P(HW_ + 0.3, 0, 0);
  if (n0 && n1 && g0 && g1) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g0.x, g0.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.stroke(); }
  const list = s.players.map((p) => ({ p, a: P(p.x, 0, p.z), b: P(p.x, 1.75 + p.jy, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = p.team === 0 ? '#e0443a' : '#2a79d4'; ctx.lineWidth = Math.max(8, (a.y - b.y) * 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 6, Math.max(6, (a.y - b.y) * 0.1), 0, TAU); ctx.fill(); }
  const bp = s.ball.vis ? P(s.ball.x, s.ball.y, s.ball.z) : null;
  if (bp) { const sh = P(s.ball.x, 0, s.ball.z); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 10, 5, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#e8a33a'; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(6, 60 / bp.depth), 0, TAU); ctx.fill(); }
  ctx.restore();
}
const HW_ = 3.05, HL_ = 6.7;
