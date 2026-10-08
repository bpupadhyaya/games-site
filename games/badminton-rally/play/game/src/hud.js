// In-play HUD: scoreboard, prompts, the contact ring and stalk, the stroke guide, banners, Think / Watch panels and the 2D fallback court.
// Everything follows the 100-300% text size (through PLAY_M) and the live layout (portrait strip or landscape bar / side panels).
import { W, H, PLAY_M, layoutFor, inRect } from './layout.js';
import { FONT, C, UI, roundPath, drawButton, panel, wrapLines, drawScrollBar } from './ui.js';
import { HL, HW, HWD, SHORT, NET_H, SHOTS, LEVELS, KITS } from './consts.js';
import { projectL, CAMV } from './camera.js';
import { SWIPE, OPTIONS, shotName, heightClass } from './shots.js';

const TAU = Math.PI * 2;
export const TEAM = ['#2fb6a6', '#e0603c'];
const GRADE = { perfect: ['PERFECT', '#ffe27a'], good: ['GOOD', '#7fe8d6'], early: ['EARLY', '#ffd1a0'], late: ['LATE', '#ff9a86'], auto: ['NO SWIPE', '#ff9a86'], slip: ['', '#fff'] };
const fitFont = (ctx, text, weight, size, maxW, min) => { let f = size; ctx.font = `${weight} ${f}px ${FONT}`; while (f > min && ctx.measureText(text).width > maxW) { f--; ctx.font = `${weight} ${f}px ${FONT}`; } return f; };

function badge(ctx, x, y, text, col = '#ffd54a', size = 22) {
  size = Math.max(UI.minf, size);
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 20;
  roundPath(ctx, x - w / 2, y - size, w, size * 1.5, 11); ctx.fillStyle = 'rgba(8,18,30,0.84)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 2); ctx.restore();
}

export const names = (G) => [G.names ? G.names[0] : 'You', G.names ? G.names[1] : 'Computer'];

function scoreboard(ctx, G, s, lay) {
  const hl = lay.hud, sc = hl.score, m = hl.m;
  const tn = names(G);
  const info = s.mode === 'rally' ? `Rally Challenge` : s.gamesTotal > 1 ? `Game ${s.gameNo} of ${s.gamesTotal}` : G.roundName || 'One game';
  const first = s.mode === 'rally' ? `Best ${G.record ? G.record.rallyBest | 0 : 0}` : `First to ${s.target}`;
  const mid = s.mode === 'rally' ? String(s.challenge.returns) : String(s.rally);
  const midLabel = s.mode === 'rally' ? 'RETURNS' : 'SHOTS';
  const pip = (x, y, won, col) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fillStyle = won ? col : 'rgba(255,255,255,0.18)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke(); };
  const pips = (left, x0, y, col, n, total) => { const need = Math.ceil(total / 2); if (need < 2) return; for (let i = 0; i < need; i++) pip(left ? x0 + i * 20 : x0 - i * 20, y, i < n, col); };
  const card = (i, x0, w, y, h, k, left) => {
    const serving = s.server === i && (s.phase === 'serve' || s.phase === 'rally');
    ctx.fillStyle = TEAM[i]; roundPath(ctx, left ? x0 : x0 + w - 8, y + 8, 8, h - 16, 4); ctx.fill();
    ctx.textBaseline = 'alphabetic';
    const scoreFs = Math.round(52 * k); ctx.font = `800 ${scoreFs}px ${FONT}`;
    const sw = ctx.measureText(String(s.score[i])).width;
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = left ? 'right' : 'left';
    ctx.fillText(String(s.score[i]), left ? x0 + w - 4 : x0 + 4, y + h * 0.5 + scoreFs * 0.36);
    const nameW = w - 26 - sw - 8;
    const nf = fitFont(ctx, tn[i], 700, Math.max(UI.minf, Math.round(22 * k)), Math.max(60, nameW), UI.minf);
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = left ? 'left' : 'right';
    const tx = left ? x0 + 18 : x0 + w - 18;
    ctx.fillText(tn[i], tx, y + h * 0.4);
    ctx.font = `600 ${Math.max(UI.minf, Math.round(15 * k))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.7)';
    if (serving) { ctx.fillStyle = '#ffe27a'; ctx.fillText('● serving', tx, y + h * 0.4 + Math.max(UI.minf, Math.round(15 * k)) * 1.2); }
    else if (s.gamesTotal > 1) pips(left, tx + (left ? 8 : -8), y + h * 0.4 + 18 * k, TEAM[i], s.games[i], s.gamesTotal);
  };
  if (!sc.tall) {
    const k = sc.k, y = sc.y, h = sc.h, mf = UI.minf;
    const g = ctx.createLinearGradient(0, 0, 0, hl.barBottom + 18); g.addColorStop(0, 'rgba(6,14,26,0.9)'); g.addColorStop(1, 'rgba(6,14,26,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hl.barBottom + 18);
    card(0, sc.left, sc.bw, y, h, k, true); card(1, sc.right - sc.bw, sc.bw, y, h, k, false);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4';
    const cf = fitFont(ctx, mid, 800, Math.round(34 * k), sc.cw * 0.6, Math.max(mf, 16));
    const cb = y + 30 + cf * 0.85;
    ctx.fillText(mid, sc.cx, cb);
    ctx.fillStyle = '#ffd97a'; const sf = Math.max(mf, Math.round(15 * k)); ctx.font = `700 ${sf}px ${FONT}`;
    ctx.fillText(`${midLabel} · ${first}`.length * sf * 0.55 > sc.cw ? first : `${midLabel} · ${first}`, sc.cx, cb + sf * 1.25);
    return;
  }
  const th = hl.topH, colw = sc.colw, cx = W / 2, mf = UI.minf;
  const g = ctx.createLinearGradient(0, 0, 0, hl.top + th + 24); g.addColorStop(0, 'rgba(6,14,26,0.92)'); g.addColorStop(1, 'rgba(6,14,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hl.top + th + 24);
  ctx.save(); ctx.translate(0, hl.top);
  card(0, sc.left, colw, 4, th, m, true); card(1, sc.right - colw, colw, 4, th, m, false);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; const mc = Math.min(m, 1.5);
  const cf = fitFont(ctx, mid, 800, Math.round(38 * mc), 120, mf);
  ctx.fillText(mid, cx, 12 + 24 * mc + 26 * mc);
  const sf = Math.max(mf, Math.round(15 * mc)); ctx.font = `700 ${sf}px ${FONT}`; ctx.fillStyle = '#ffd97a';
  ctx.fillText(midLabel, cx, 12 + 24 * mc + 26 * mc + sf * 1.25);
  ctx.fillStyle = 'rgba(255,246,228,0.8)'; ctx.font = `600 ${sf}px ${FONT}`;
  const inf = wrapLines(ctx, info, 150);
  inf.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, 12 + 24 * mc + 26 * mc + sf * (2.5 + i * 1.2)));
  ctx.restore();
}

function wrapped(ctx, text, x, y, maxW, size, color = '#fff6e4', lh = 1.25, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, maxW); lines.forEach((l, i) => ctx.fillText(l, x, y + size * (0.9 + i * lh)));
  return lines.length * size * lh;
}

const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
const ground = (x, z, y = 0.01) => projectL(x, y, z);

// The contact ring (closing on the shuttle's meeting point), its stalk, and the OUT marker.
function drawContact(ctx, G, s, lay) {
  const pl = s.plan;
  if (!pl || !pl.spot) return;
  const watch = G.mode === 'watch';
  if (pl.who !== 0 && !(watch && false)) return;
  const sp = pl.spot, dtc = pl.tc - s.t - (s.acc ? 0 : 0);
  if (pl.letGo) {
    if (pl.out) {
      const c = ground(pl.landX, pl.landZ); if (!c) return;
      const a = ground(pl.landX + 0.5, pl.landZ), b = ground(pl.landX, pl.landZ + 0.5);
      const rx = Math.max(14, Math.abs(a.x - c.x)), ry = Math.max(9, Math.abs(b.y - c.y));
      ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = '#ff7a66'; ctx.fillStyle = 'rgba(255,90,70,0.22)';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
      badge(ctx, c.x, c.y - ry - 8, 'OUT', '#ff7a66', 20); ctx.restore();
    }
    return;
  }
  if (dtc < -0.2) return;
  const kap = Math.min(1.4, Math.max(0.55, (pl.flight || 1.1) / 1.1));
  const c = ground(sp.x, sp.z), top = projectL(sp.x, sp.y, sp.z);
  if (!c || !top) return;
  const prog = Math.max(0, Math.min(1, dtc / 1.0));
  const r = 0.38 + 0.95 * prog;
  const a = ground(sp.x + r, sp.z), b = ground(sp.x, sp.z + r);
  const rx = Math.max(8, Math.abs(a.x - c.x)), ry = Math.max(5, Math.abs(b.y - c.y));
  const inPerfect = dtc >= 0.03 && dtc <= 0.28 * kap, inGood = dtc >= -0.02 && dtc <= 0.55 * kap;
  const col = inPerfect ? '#ffe27a' : inGood ? '#7fe8d6' : '#ffffff';
  ctx.save();
  // the perfect size ring and the floor stalk
  const r2 = 0.38 + 0.95 * (0.15 / 1.0);
  const a2 = ground(sp.x + r2, sp.z), b2 = ground(sp.x, sp.z + r2);
  ctx.setLineDash([5, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,226,122,0.55)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.abs(a2.x - c.x), Math.abs(b2.y - c.y), 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = inPerfect ? 6 : 4; ctx.strokeStyle = col; ctx.fillStyle = inPerfect ? 'rgba(255,226,122,0.2)' : 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  ctx.beginPath(); ctx.arc(top.x, top.y, 7, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(8,18,30,0.8)'; ctx.stroke();
  if (pl.stretch) badge(ctx, c.x, c.y + ry + 22, 'TOO FAR', '#ffb59a', 15);
  ctx.restore();
}

// The diagonal service box, shown while the human serves.
function drawServeBox(ctx, G, s, sim) {
  if (s.phase !== 'serve' || s.serve.srv !== 0 || G.cfgAiNear) return;
  const sb = sim.serveBox(); if (!sb) return;
  const sg = sb.sign;
  const x0 = sg > 0 ? 0 : -HW, x1 = sg > 0 ? HW : 0;
  const pts = [ground(x0, -SHORT), ground(x1, -SHORT), ground(x1, -HL), ground(x0, -HL)];
  if (pts.some((p) => !p)) return;
  ctx.save(); poly(ctx, pts); ctx.fillStyle = 'rgba(255,226,122,0.2)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,226,122,0.9)'; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.restore();
}

// ---- the stroke guide ------------------------------------------------------------------------------------------------------------
function strokeSet(cls, serve) {
  if (serve) return [{ lab: 'Short serve', len: 1, key: 'serveShort' }, { lab: 'High serve', len: 2, key: 'serveLong' }];
  if (cls === 'over') return [{ lab: 'Drop', len: 1, key: 'drop' }, { lab: 'Clear', len: 2, key: 'clear' }, { lab: 'Smash', len: 3, key: 'smash' }];
  if (cls === 'mid') return [{ lab: 'Push', len: 1, key: 'push' }, { lab: 'Lift', len: 2, key: 'lift' }, { lab: 'Drive', len: 3, key: 'drive' }];
  return [{ lab: 'Net shot', len: 1, key: 'net' }, { lab: 'Lift', len: 2, key: 'lift' }, { lab: 'High lift', len: 3, key: 'lift' }];
}
export function guideInfo(G, s) {
  const serve = s.phase === 'serve' && s.serve && s.serve.srv === 0 && !G.cfgAiNear;
  const pl = s.plan && s.plan.who === 0 && !s.plan.letGo ? s.plan : null;
  const cls = pl ? pl.cls : 'over';
  const active = serve || !!pl;
  return { serve, cls, active, items: strokeSet(cls, serve), clsName: serve ? 'Serve' : { over: 'Overhead', mid: 'Chest height', low: 'Low' }[cls] };
}
function chip(ctx, r, it, lit, hot, k, vertical) {
  ctx.save();
  roundPath(ctx, r.x, r.y + 4, r.w, r.h, 16); ctx.fillStyle = 'rgba(6,10,30,0.4)'; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, 16);
  ctx.fillStyle = hot ? '#ffe27a' : lit ? 'rgba(20,52,68,0.94)' : 'rgba(20,34,52,0.72)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = hot ? '#fff6c8' : lit ? 'rgba(127,232,214,0.85)' : 'rgba(255,246,228,0.25)'; ctx.stroke();
  // the swipe icon: an arrow whose length is the swipe length
  const ax = vertical ? r.x + 38 : r.x + r.w / 2, ay = vertical ? r.y + r.h / 2 : r.y + r.h * 0.46;
  const fs = Math.max(UI.minf, Math.round(22 * k)), alen = (14 + it.len * 11) * Math.min(1.3, k);
  ctx.strokeStyle = hot ? '#10202f' : lit ? '#7fe8d6' : 'rgba(255,246,228,0.55)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  if (!vertical) {
    const y1 = r.y + r.h * 0.3 + alen * 0.0;
    ctx.beginPath(); ctx.moveTo(ax, r.y + r.h * 0.58); ctx.lineTo(ax, r.y + r.h * 0.58 - alen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, r.y + r.h * 0.58 - alen - 7); ctx.lineTo(ax - 8, r.y + r.h * 0.58 - alen + 5); ctx.lineTo(ax + 8, r.y + r.h * 0.58 - alen + 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(ax, r.y + r.h * 0.58, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = hot ? '#10202f' : '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let f = fs; ctx.font = `800 ${f}px ${FONT}`; while (f > UI.minf && ctx.measureText(it.lab).width > r.w - 12) { f--; ctx.font = `800 ${f}px ${FONT}`; }
    ctx.fillText(it.lab, ax, r.y + r.h - 10 * k);
  } else {
    const x = r.x + 34, y = r.y + r.h / 2 + alen / 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + alen * 0.0, y - alen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - alen - 6); ctx.lineTo(x - 7, y - alen + 4); ctx.lineTo(x + 7, y - alen + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hot ? '#10202f' : '#fff6e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let f = fs; ctx.font = `800 ${f}px ${FONT}`; while (f > UI.minf && ctx.measureText(it.lab).width > r.w - 80) { f--; ctx.font = `800 ${f}px ${FONT}`; }
    ctx.fillText(it.lab, r.x + 64, r.y + r.h / 2);
  }
  ctx.restore();
}
function drawGuide(ctx, G, s, lay) {
  const hl = lay.hud, gi = guideInfo(G, s), k = Math.min(hl.m, 1.5);
  const hotKey = G.swipeLive && gi.active ? G.swipeLive.kind : null;
  const box = hl.guide || hl.guideSide;
  if (!box) return;
  ctx.save();
  roundPath(ctx, box.x, box.y, box.w, box.h, 20); ctx.fillStyle = 'rgba(8,18,30,0.6)'; ctx.fill();
  const hs = Math.max(UI.minf, Math.round(17 * k));
  ctx.font = `700 ${hs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = gi.active ? '#ffe9a0' : 'rgba(255,246,228,0.6)';
  const head = gi.active ? `${gi.clsName}: swipe up from anywhere` : 'Swipe a stroke when the shuttle comes to you';
  const vertical = !hl.guide;
  if (!vertical) {
    ctx.fillText(head, box.x + 16, box.y + 8 + hs);
    const n = gi.items.length, gap = 10, top = box.y + 12 + hs * 1.4, ch = box.h - (top - box.y) - 10, cw = (box.w - 24 - gap * (n - 1)) / n;
    gi.items.forEach((it, i) => chip(ctx, { x: box.x + 12 + i * (cw + gap), y: top, w: cw, h: ch }, it, gi.active, hotKey === it.key, k, false));
  } else {
    ctx.fillText('Strokes', box.x + 16, box.y + 8 + hs);
    ctx.font = `600 ${Math.max(UI.minf, Math.round(15 * k))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.75)';
    ctx.fillText(gi.active ? gi.clsName : 'Waiting', box.x + 16, box.y + 12 + hs * 2.2);
    const n = gi.items.length, top = box.y + 18 + hs * 2.8, gap = 10, ch = Math.min(86, (box.h * 0.5 - gap * n) / n);
    gi.items.forEach((it, i) => chip(ctx, { x: box.x + 10, y: top + i * (ch + gap), w: box.w - 20, h: ch }, it, gi.active, hotKey === it.key, k, true));
    const ty = top + n * (ch + gap) + 6;
    ctx.font = `500 ${Math.max(UI.minf, Math.round(14 * k))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.7)';
    wrapped(ctx, 'Lean the swipe left or right to aim. Swipe sideways for a flat drive, pull back for a soft block. Tap for a safe return.', box.x + 14, ty, box.w - 28, Math.max(UI.minf, Math.round(14 * k)), 'rgba(255,246,228,0.7)', 1.25, 'left', 500);
  }
  ctx.restore();
}

// left side panel on wide screens: the match card
function drawMatchCard(ctx, G, s, lay) {
  const box = lay.hud.side && lay.hud.side.left; if (!box) return;
  const k = Math.min(lay.hud.m, 1.5), fs = Math.max(UI.minf, Math.round(18 * k)), tn = names(G);
  ctx.save();
  roundPath(ctx, box.x, box.y, box.w, box.h, 20); ctx.fillStyle = 'rgba(8,18,30,0.6)'; ctx.fill();
  let y = box.y + 14 + fs;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(fs * 1.15)}px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.fillText('Match', box.x + 16, y); y += fs * 1.6;
  ctx.font = `600 ${fs}px ${FONT}`; ctx.fillStyle = '#fff6e4';
  const row = (a, b, c) => { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,246,228,0.75)'; ctx.fillText(a, box.x + 16, y); ctx.textAlign = 'right'; ctx.fillStyle = '#fff6e4'; ctx.fillText(b, box.x + box.w - 16, y); y += fs * 1.45; };
  row('Opponent', tn[1]); if (G.oppSub) row('Style', G.oppSub);
  row('Games', `${s.games[0]} - ${s.games[1]}`);
  row('Longest rally', String(s.bestRally));
  const st = s.stats;
  row('Smashes', `${st[0].smashes} - ${st[1].smashes}`);
  row('Winners', `${st[0].winners} - ${st[1].winners}`);
  row('Perfect swipes', String(st[0].perfect));
  ctx.restore();
}

function banners(ctx, G, s, lay) {
  const hl = lay.hud, m = hl.m, tn = names(G);
  // timing grade next to the near player
  const f = s.flash;
  if (f && s.t - f.t < 0.9 && GRADE[f.text] && GRADE[f.text][0]) {
    const p = s.players[0], pt = projectL(p.x, 2.35, p.z);
    if (pt) {
      const k = Math.min(1, (s.t - f.t) / 0.1), a = Math.min(1, (0.9 - (s.t - f.t)) / 0.3);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round((f.text === 'perfect' ? 44 : 34) * Math.min(m, 1.4))}px ${FONT}`; ctx.fillStyle = GRADE[f.text][1];
      ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8;
      const x = Math.max(hl.fit.x0 + 100, Math.min(hl.fit.x1 - 100, pt.x));
      ctx.fillText(GRADE[f.text][0], x, pt.y - 20 - 20 * k); ctx.restore();
    }
  }
  const msg = s.msg;
  if ((s.phase === 'point' || s.phase === 'gamebreak' || s.phase === 'over') && msg) {
    const win = msg.winner === 0, dt = s.t - msg.t;
    const A = Math.min(1, dt / 0.12);
    const big = { winner: win ? 'POINT!' : 'POINT TO ' + tn[1].toUpperCase().split(' ')[0], out: 'OUT', net: 'NET', fault: 'SERVICE FAULT' }[msg.why] || 'POINT';
    const sub = { winner: win ? 'Your shuttle landed in' : `${tn[1]} wins the rally`, out: win ? `${tn[1]} hit it out` : 'You hit it out', net: win ? `${tn[1]} hit the net` : 'Into the net', fault: msg.detail === 'short' ? 'The serve landed short' : msg.detail === 'wrongcourt' ? 'Wrong service court' : 'The serve landed out' }[msg.why] || '';
    ctx.save(); ctx.globalAlpha = A; ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(58 * Math.min(m, 1.5))}px ${FONT}`; ctx.fillStyle = msg.why === 'winner' ? (win ? '#7fe8d6' : '#ffb59a') : (win ? '#7fe8d6' : '#ff9a86'); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10;
    ctx.fillText(big, W / 2, hl.bannerY - 14 * (1 - A));
    ctx.font = `700 ${Math.max(UI.minf, Math.round(26 * Math.min(m, 1.5)))}px ${FONT}`; ctx.fillStyle = '#fff6e4';
    ctx.fillText(sub, W / 2, hl.bannerY + 40 * Math.min(m, 1.5));
    ctx.restore();
  }
}

function promptLine(G, s) {
  if (G.mode === 'watch') return 'Watch & Learn';
  if (s.phase === 'serve' && s.serve && s.serve.srv === 0) return s.serve.tcTick === null ? 'Your serve: swipe short for a short serve, long for a high one' : '';
  if (s.phase === 'serve') return 'The computer serves';
  if (s.phase === 'gamebreak') return s.gameWinner === 0 ? 'You win the game!' : 'The computer wins the game';
  if (s.plan && s.plan.who === 0 && !s.plan.letGo && s.plan.stretch) return 'Too far to reach this one';
  if (s.plan && s.plan.who === 0 && s.plan.letGo && s.plan.out) return 'It is going out: leave it';
  return '';
}

export function renderHud(ctx, G, sim, view) {
  const s = sim.s;
  const lay = layoutFor(W, H, G.settings.textIdx), hl = lay.hud;
  UI.minf = lay.minf; UI.minb = lay.minb;
  TEAM[0] = KITS[G.settings.kitIdx | 0] ? KITS[G.settings.kitIdx | 0].col : TEAM[0];
  const m = hl.m;
  G.lay = lay;
  scoreboard(ctx, G, s, lay);
  if (G.mode !== 'watch') { if (hl.side) drawMatchCard(ctx, G, s, lay); drawGuide(ctx, G, s, lay); }
  if (G.mode === 'watch' && hl.side) drawMatchCard(ctx, G, s, lay);
  drawServeBox(ctx, G, s, sim);
  if (G.mode === 'watch' && s.hold && G.watch.phase !== 'think' && s.hold.dec) drawTarget(ctx, s.hold.dec.landX, s.hold.dec.landZ, '#7fe8d6', 'Plan');
  if (G.mode !== 'watch') drawContact(ctx, G, s, lay);
  if (G.mode === 'watch' && s.plan && s.plan.who === 0) drawContact(ctx, G, s, lay);
  if (G.mode !== 'watch' && G.hintShow && s.t < G.hintShow.until && G.hintShow.target) drawTarget(ctx, G.hintShow.target.x, G.hintShow.target.z, '#ffe9a0', 'Hint');
  // swipe trail
  if (G.trail && G.trail.length > 1) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < G.trail.length; i++) { const a = i / G.trail.length; ctx.strokeStyle = `rgba(255,246,200,${0.15 + 0.7 * a})`; ctx.lineWidth = 3 + 9 * a; ctx.beginPath(); ctx.moveTo(G.trail[i - 1].x, G.trail[i - 1].y); ctx.lineTo(G.trail[i].x, G.trail[i].y); ctx.stroke(); }
    ctx.restore();
  }
  const pt = promptLine(G, s);
  if (pt) {
    const pw = hl.promptW, ps = Math.max(UI.minf, Math.round(22 * Math.min(m, 1.6)));
    ctx.font = `700 ${ps}px ${FONT}`; const lines = wrapLines(ctx, pt, pw - 36);
    const ph = lines.length * ps * 1.25 + 16, py = hl.promptY;
    roundPath(ctx, hl.promptX, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.7)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, hl.promptX + pw / 2, py + 10 + ps * (0.95 + i * 1.25)));
  }
  banners(ctx, G, s, lay);
  if (G.mode === 'watch') return renderWatch(ctx, G, s, lay, m);
  const sz = Math.max(UI.minf, Math.round(24 * Math.min(m, 1.7)));
  drawButton(ctx, hl.util.think, 'Think', { dark: true, size: sz });
  drawButton(ctx, hl.util.pause, 'Pause', { dark: true, size: sz });
}

function drawTarget(ctx, x, z, col = '#7fe8d6', label) {
  const c = ground(x, z, 0.02), a = ground(x + 0.55, z, 0.02), b = ground(x, z + 0.55, 0.02);
  if (!c || !a || !b) return;
  const rx = Math.max(12, Math.abs(a.x - c.x)), ry = Math.max(7, Math.abs(b.y - c.y));
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(127,232,214,0.22)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (label) { ctx.font = `700 ${Math.max(UI.minf, 20)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(label, c.x, c.y - ry - 8); }
  ctx.restore();
}

export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }

function renderWatch(ctx, G, s, lay, m) {
  const w = G.watch, WL = lay.hud.watch;
  const sz = Math.max(UI.minf, Math.round(24 * Math.min(m, 1.7)));
  let msg = '';
  if (s.hold) {
    const d = s.hold.dec;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)} s: ${s.hold.kind === 'serve' ? 'serving' : 'the shuttle is coming'}. What stroke would you play, and where?`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${d.summary}. ${d.reason}`;
    else msg = `ACT: ${d.summary}`;
  } else msg = s.phase === 'point' ? 'The rally is over.' : 'ACT: the rally continues.';
  const ps = Math.max(UI.minf, Math.round(22 * Math.min(m, 1.5))), pw = WL.panelW, px = WL.panelX;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30);
  const fullH = lines.length * ps * 1.25 + 20, ph = Math.min(fullH, WL.maxH), py = WL.panelBottom - ph;
  G.watchSt = G.watchSt || { scroll: 0, drag: null, msg: '' };
  if (G.watchSt.msg !== msg) { G.watchSt.msg = msg; G.watchSt.scroll = 0; }
  const maxS = Math.max(0, fullH - ph); G.watchSt.scroll = Math.max(0, Math.min(G.watchSt.scroll, maxS));
  G.watchMeta = { rect: { x: px, y: py, w: pw, h: ph }, max: maxS, view: ph };
  roundPath(ctx, px, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,18,30,0.86)'; ctx.fill();
  ctx.save(); roundPath(ctx, px, py, pw, ph, 16); ctx.clip();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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
  const can = !!t.target;
  G.thinkRects = row ? { show: { x: x + 24, y: by, w: bw, h: bh }, close: { x: x + 24 + bw + 14, y: by, w: bw, h: bh } } : { show: { x: x + 24, y: by, w: bw, h: bh }, close: { x: x + 24, y: by + bh + 14, w: bw, h: bh } };
  drawButton(ctx, G.thinkRects.show, can ? 'Show on court' : 'OK', { primary: true, size: Math.round(30 * Math.min(m, 1.5)) });
  drawButton(ctx, G.thinkRects.close, 'Close', { dark: true, size: Math.round(28 * Math.min(m, 1.5)) });
}

// 2D fallback when WebGL is missing: the court and the players drawn through the same camera maths
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const P = (x, y, z) => projectL(x, y, z);
  ctx.save();
  ctx.fillStyle = '#0f1c2d'; ctx.fillRect(0, 0, W, H);
  const corners = [[-HWD, -HL], [HWD, -HL], [HWD, HL], [-HWD, HL]].map(([x, z]) => P(x, 0, z));
  if (corners.every(Boolean)) { poly(ctx, corners); ctx.fillStyle = '#2d8a7c'; ctx.fill(); }
  const line = (a, b) => { const p = P(a[0], 0, a[1]), q = P(b[0], 0, b[1]); if (p && q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } };
  ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = 3;
  const hw = HW;
  line([-hw, -HL], [hw, -HL]); line([-hw, HL], [hw, HL]); line([-hw, -HL], [-hw, HL]); line([hw, -HL], [hw, HL]);
  line([-HWD, -HL], [-HWD, HL]); line([HWD, -HL], [HWD, HL]); line([-HWD, 0], [HWD, 0]);
  line([-hw, SHORT], [hw, SHORT]); line([-hw, -SHORT], [hw, -SHORT]); line([0, SHORT], [0, HL]); line([0, -SHORT], [0, -HL]);
  const n0 = P(-HWD, NET_H, 0), n1 = P(HWD, NET_H, 0);
  if (n0 && n1) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.stroke(); }
  for (const p of s.players) {
    const a = P(p.x, 0, p.z), b = P(p.x, 1.75, p.z); if (!a || !b) continue;
    ctx.strokeStyle = TEAM[p.i]; ctx.lineWidth = Math.max(8, (a.y - b.y) * 0.2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 6, Math.max(6, (a.y - b.y) * 0.1), 0, TAU); ctx.fill();
  }
  const sh = s.shuttle, bp = P(sh.x, sh.y, sh.z), bg = P(sh.x, 0, sh.z);
  if (bp) { if (bg) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(bg.x, bg.y, 8, 4, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(4, bp.scale * 0.05), 0, TAU); ctx.fill(); }
  ctx.restore();
}
