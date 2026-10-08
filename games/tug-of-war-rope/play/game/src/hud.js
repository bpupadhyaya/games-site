// The in-play screen on the 2D canvas: top strip, the tug bar, the beat ring, stamina and sync bars, the two calls, the surge warning, pull / round cards, the
// Watch & Learn panel, the hint card, and the flat fallback picture used when WebGL is missing. Pure drawing from game state; game.js owns state.
import { SW, H, host, minU, hudLayout, PLAY_M, inRect } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { LIMIT, PULL_TIME, levelById } from './sim.js';
import { settingById, teamById } from './teams.js';
import { ROUND_NAMES } from './match.js';

const TAU = Math.PI * 2;
export const CARD = { rect: null, max: 0, view: 0 };
let RECTS = [];                         // clickable overlay buttons of this frame, in SCREEN coordinates: { id, x, y, w, h }
export const hit = (x, y) => { for (let i = RECTS.length - 1; i >= 0; i--) { const r = RECTS[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id; } return null; };
let XF = null;                          // current half transform: { cx, cy } for a half rotated 180 degrees about its centre, else null
const addRect = (id, r) => {
  const q = XF ? { x: 2 * XF.cx - (r.x + r.w), y: 2 * XF.cy - (r.y + r.h), w: r.w, h: r.h } : r;
  RECTS.push({ id, x: q.x, y: q.y, w: q.w, h: q.h }); return r;
};
export const toLocal = (half, rot, x, y) => (rot ? { x: 2 * (half.r.x + half.r.w / 2) - x, y: 2 * (half.r.y + half.r.h / 2) - y } : { x, y });

const ink = '#fbf3e2';
export const COL = { gold: '#f2c14e', ice: '#8fd3e6', coral: '#ff8f7a', moss: '#58c28f', sun: '#ffb35c', rope: '#e0c28a' };
const font = (px, w = 700) => `${w} ${Math.max(Math.round(px), minU())}px ${FONT}`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmtTime = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function chip(ctx, x, y, w, h, fill = 'rgba(30,16,8,0.74)', edge = 'rgba(251,243,226,0.24)') {
  roundPath(ctx, x, y, w, h, Math.min(18, h / 2)); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
}
function label(ctx, txt, x, y, px, col = ink, align = 'center', w = 700) {
  ctx.save(); ctx.shadowColor = 'rgba(20,8,0,0.7)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1; ctx.fillStyle = col; ctx.font = font(px, w); ctx.textAlign = align;
  if (px >= 26) { ctx.shadowBlur = 0; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px * 0.13); ctx.strokeStyle = 'rgba(38,18,6,0.82)'; ctx.strokeText(txt, x, y); ctx.shadowBlur = 5; }
  ctx.fillText(txt, x, y); ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, G, v) {
  RECTS = []; XF = null;
  const P = G.pull; if (!P) return;
  const s = P.s;
  const versus = G.mode === 'versus';
  const M = PLAY_M[G.settings.textIdx];
  const L = hudLayout(G.settings.textIdx, versus);
  G.lay = L;
  const watch = G.mode === 'watch';
  if (G.stage === 'intro') { drawRoundCard(ctx, G, L, M); return; }
  if (versus) {
    drawHalf(ctx, G, s, 'a', L.halves[0], false, M, L);
    const rot = !L.land;
    ctx.save(); if (rot) { const c = { cx: L.halves[1].r.x + L.halves[1].r.w / 2, cy: L.halves[1].r.y + L.halves[1].r.h / 2 }; ctx.translate(c.cx * 2, c.cy * 2); ctx.rotate(Math.PI); XF = c; }
    drawHalf(ctx, G, s, 'b', L.halves[1], rot, M, L);
    ctx.restore(); XF = null;
    drawSeam(ctx, G, L);
    drawButton(ctx, addRect('pause', L.pause), 'Pause', { dark: true, size: Math.round(L.uh * 0.4) });
  } else {
    drawHalf(ctx, G, s, 'a', L.halves[0], false, M, L);
    if (!watch) { drawButton(ctx, addRect('pause', L.pause), 'Pause', { dark: true, size: Math.round(L.uh * 0.4) }); drawButton(ctx, addRect('think', L.think), 'Think', { dark: true, size: Math.round(L.uh * 0.4) }); }
    drawRivalBar(ctx, G, s, L, M);
  }
  if (s.ph === 'end' && s.pt > 0.5) drawPullCard(ctx, G, s, L, M);
  if (watch) drawWatch(ctx, G, s, L, M);
  else if (G.think) drawThink(ctx, G, s, L, M);
}

// ---- one player's half (or the whole screen for a single player) ----------------------------------------------------------------------
function drawHalf(ctx, G, s, k, half, rot, M, L) {
  const sd = s[k], me = k === 'a';
  const versus = G.mode === 'versus';
  drawTop(ctx, G, s, k, half, M, versus);
  drawBar(ctx, G, s, k, half, M);
  if (versus) { if (rot) { /* the second player's half is drawn already rotated */ } }
  const top = Math.max(half.bar.y + half.bar.h, 0);
  void top;
  // ready / go
  if (s.ph === 'ready') drawReady(ctx, G, s, k, half, M);
  else if (s.ph === 'pull' && s.pt < 0.9) { const u = 1 - s.pt / 0.9; ctx.save(); ctx.globalAlpha = u; label(ctx, 'PULL!', half.mid.x, half.mid.y, 84 * Math.min(M, 1.3), COL.gold); ctx.restore(); }
  drawRing(ctx, G, s, k, half, M);
  drawMeters(ctx, G, s, k, half, M);
  drawCalls(ctx, G, s, k, half, M);
  drawFeedback(ctx, G, s, k, half, M);
  if (me && !versus && s.surge && s.ph === 'pull') drawSurge(ctx, G, s, half, M);
  if (sd.gassed && s.ph === 'pull') label(ctx, 'ARMS GONE! DIG IN', half.mid.x, half.mid.y + 60, 30 * Math.min(M, 1.3), COL.coral);
  if (G.mode === 'watch' && s.ph === 'pull') { /* the panel draws the coaching */ }
}

function drawTop(ctx, G, s, k, half, M, versus) {
  const t = half.top, mt = G.match, rd = mt ? mt.rounds[mt.round] : null;
  chip(ctx, t.x, t.y, t.w, t.h);
  ctx.textBaseline = 'middle';
  const pad = 16, mid = t.y + t.h / 2, two = t.h > 58;
  const set = settingById(rd ? rd.setting : G.setup.setting);
  const rv = rd ? teamById(rd.rival) : teamById('oxen');
  const nameA = versus ? (k === 'a' ? 'Team A' : 'Team B') : 'You', nameB = versus ? (k === 'a' ? 'Team B' : 'Team A') : rv.name;
  const fsA = fitPx(ctx, rd ? rd.label : 'Tug of War', 700, 28 * Math.min(M, 1.4), t.w * 0.46 - pad, 12);
  ctx.font = font(fsA); ctx.fillStyle = COL.gold; ctx.textAlign = 'left';
  ctx.fillText((rd ? rd.label : 'Tug of War').toUpperCase(), t.x + pad, mid - (two ? 13 : 0));
  if (two) { ctx.font = font(Math.max(13, fsA * 0.7), 500); ctx.fillStyle = 'rgba(251,243,226,0.85)'; ctx.fillText(fitText(ctx, `${set.name} · vs ${nameB}`, t.w * 0.5 - pad, Math.max(13, fsA * 0.7)), t.x + pad, mid + 15); }
  ctx.textAlign = 'right';
  const w0 = mt ? mt.wins[k === 'a' ? 0 : 1] : 0, w1 = mt ? mt.wins[k === 'a' ? 1 : 0] : 0;
  ctx.font = font(fsA * 1.25); ctx.fillStyle = ink; ctx.fillText(`${w0} – ${w1}`, t.x + t.w - pad, mid - (two ? 13 : 0));
  if (two) { ctx.font = font(Math.max(13, fsA * 0.7), 500); ctx.fillStyle = 'rgba(251,243,226,0.85)'; ctx.fillText(`${nameA} · ${fmtTime(s.ph === 'ready' ? PULL_TIME : s.timeLeft)}`, t.x + t.w - pad, mid + 15); }
  ctx.textBaseline = 'alphabetic';
}
function fitText(ctx, text, maxW, px) { ctx.font = font(px, 500); if (ctx.measureText(text).width <= maxW) return text; let t = text; while (t.length > 6 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; }

function drawBar(ctx, G, s, k, half, M) {
  const b = half.bar, sign = k === 'a' ? 1 : -1;
  const lvA = G.look ? G.look[k === 'a' ? 'a' : 'b'].top : '#c8352b', lvB = G.look ? G.look[k === 'a' ? 'b' : 'a'].top : '#b5651d';
  ctx.save();
  roundPath(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.fillStyle = 'rgba(30,16,8,0.78)'; ctx.fill();
  ctx.save(); roundPath(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.clip();
  // the two win zones in each team's colour, a neutral middle
  const zone = b.w * 0.16;
  ctx.fillStyle = lvA; ctx.globalAlpha = 0.85; ctx.fillRect(b.x, b.y, zone, b.h);
  ctx.fillStyle = lvB; ctx.fillRect(b.x + b.w - zone, b.y, zone, b.h); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(251,243,226,0.3)'; ctx.fillRect(b.x + b.w / 2 - 1.5, b.y, 3, b.h);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(251,243,226,0.4)'; roundPath(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.stroke();
  // the flag: moves toward the team that is winning
  const u = clamp(0.5 - 0.5 * sign * (s.x / LIMIT), 0, 1);
  const fx = b.x + zone * 0.0 + u * b.w, fy = b.y + b.h / 2, r = b.h * 0.9;
  ctx.fillStyle = '#d62828'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(fx, fy - r); ctx.lineTo(fx + r * 0.9, fy - r * 0.55); ctx.lineTo(fx, fy - r * 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, fy - r); ctx.lineTo(fx, fy + b.h * 0.45); ctx.stroke();
  ctx.beginPath(); ctx.arc(fx, fy + b.h * 0.1, b.h * 0.34, 0, TAU); ctx.fillStyle = COL.rope; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#6b4a22'; ctx.stroke();
  ctx.restore();
  const px = Math.max(minU(), Math.min(b.h * 0.5, 15 * Math.min(M, 1.3)));
  label(ctx, 'YOUR LINE', b.x + zone / 2, b.y + b.h / 2 + px * 0.35, px, '#fff8ea', 'center', 800);
  label(ctx, 'THEIR LINE', b.x + b.w - zone / 2, b.y + b.h / 2 + px * 0.35, px, '#fff8ea', 'center', 800);
}

function drawRivalBar(ctx, G, s, L, M) {
  const h0 = L.halves[0];
  const px = Math.max(12, 13 * Math.min(M, 1.3));
  const w = Math.min(190, SW * 0.26), x = SW / 2 - w / 2, y = L.land ? h0.bar.y + h0.bar.h + 24 : L.pause.y + L.uh / 2 - px * 0.1;
  const st = s.b.stam;
  if (L.land) { /* landscape: the pause row sits under the top strip, the rival bar sits under the tug bar */ }
  label(ctx, s.b.gassed || (s.rival && s.rival.resting) ? 'THEM: GASPING' : 'THEM', x, y + px * 0.2, px, s.rival && s.rival.resting ? COL.coral : 'rgba(251,243,226,0.85)', 'left');
  roundPath(ctx, x, y + px * 0.5, w, 10, 5); ctx.fillStyle = 'rgba(30,16,8,0.7)'; ctx.fill();
  roundPath(ctx, x, y + px * 0.5, Math.max(6, w * st), 10, 5); ctx.fillStyle = st > 0.4 ? COL.sun : COL.coral; ctx.fill();
}

// the beat ring: closing rings land on the target at every chant beat
function drawRing(ctx, G, s, k, half, M) {
  const R = half.ring, sd = s[k];
  const T = s.T, ph = s.phase[k];
  const k0 = Math.ceil((s.t - ph) / T - 1e-9);
  const dt1 = ph + k0 * T - s.t;                         // seconds until the next beat
  const last = ph + (k0 - 1) * T - s.t;                  // (negative) seconds since the last beat
  const pulse = Math.max(0, 1 - Math.abs(last) / 0.16);
  const braceNeeded = !!(s.surge && k === 'a' && s.t < s.surge.hit + 0.1 && G.mode !== 'versus');
  const braced = sd.brace > 0.55;
  const w = s.ph === 'pull' || s.ph === 'ready';
  ctx.save();
  // coach window glow
  const coach = sd.coachT > 0;
  const grow = coach ? 1.7 : 1;
  ctx.beginPath(); ctx.arc(R.x, R.y, R.r * (1 + 0.1 * pulse), 0, TAU);
  ctx.fillStyle = braceNeeded ? 'rgba(214,40,40,0.35)' : braced ? 'rgba(88,194,143,0.30)' : 'rgba(30,16,8,0.58)'; ctx.fill();
  // brace fill
  if (sd.brace > 0.02) { ctx.save(); ctx.beginPath(); ctx.arc(R.x, R.y, R.r - 2, 0, TAU); ctx.clip(); ctx.fillStyle = 'rgba(88,194,143,0.5)'; ctx.fillRect(R.x - R.r, R.y + R.r - 2 * R.r * sd.brace, 2 * R.r, 2 * R.r * sd.brace); ctx.restore(); }
  // the perfect and good windows drawn as bands on the target
  const w1 = Math.min(1, 0.075 * grow / T * 2), w2 = Math.min(1, 0.14 * grow / T * 2);
  ctx.lineWidth = Math.max(3, R.r * 0.07); ctx.strokeStyle = 'rgba(242,193,78,0.35)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.r * (1 + w2 * 0.5), 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(242,193,78,0.7)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.r * (1 + w1 * 0.5), 0, TAU); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = braceNeeded ? '#ff5a4a' : pulse > 0.1 ? COL.gold : 'rgba(251,243,226,0.85)'; ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.stroke();
  // two closing rings (this beat and the next)
  if (w) for (let n = 0; n < 2; n++) {
    const d = dt1 + n * T, f = d / T;                      // 0 = on the beat
    if (f > 1.0) continue;
    const rr = R.r * (1 + 1.25 * Math.max(0, f)), a = (n === 0 ? 0.95 : 0.4) * (1 - Math.max(0, f) * 0.5);
    ctx.globalAlpha = clamp(a, 0, 1); ctx.lineWidth = Math.max(4, 8 - 4 * f); ctx.strokeStyle = n === 0 && dt1 < 0.14 * grow ? COL.gold : COL.ice;
    ctx.beginPath(); ctx.arc(R.x, R.y, Math.max(R.r, rr), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font(R.r * 0.34, 800);
  ctx.fillText(braceNeeded ? 'HOLD' : sd.gassed ? 'REST' : braced ? 'DIG IN' : 'TAP', R.x, R.y + 1);
  ctx.restore();
}

function drawMeters(ctx, G, s, k, half, M) {
  const sd = s[k];
  const px = Math.max(12, 14 * Math.min(M, 1.35));
  const bar = (r, frac, name, c1, c2, extra) => {
    roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(30,16,8,0.74)'; ctx.fill();
    const w = Math.max(r.h, r.w * clamp(frac, 0, 1));
    const gr = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    roundPath(ctx, r.x, r.y, w, r.h, r.h / 2); ctx.fillStyle = gr; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(251,243,226,0.35)'; roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.font = font(Math.min(px, r.h * 0.74), 700); ctx.textAlign = 'left'; ctx.fillStyle = '#2a1a10';
    ctx.save(); ctx.shadowColor = 'rgba(255,240,210,0.6)'; ctx.shadowBlur = 3; ctx.fillText(name, r.x + r.h * 0.5, r.y + r.h / 2 + 1); ctx.restore();
    if (extra) { ctx.textAlign = 'right'; ctx.fillStyle = ink; ctx.save(); ctx.shadowColor = 'rgba(20,8,0,0.8)'; ctx.shadowBlur = 4; ctx.fillText(extra, r.x + r.w - r.h * 0.5, r.y + r.h / 2 + 1); ctx.restore(); }
    ctx.textBaseline = 'alphabetic';
  };
  const low = sd.stam < 0.3;
  bar(half.stam, sd.stam, low ? 'STAMINA: TIRED' : 'STAMINA', low ? '#ff8f7a' : '#58c28f', low ? '#c7452d' : '#d6d86a');
  bar(half.sync, sd.sync, 'TEAM SYNC', '#7fd0e6', '#f2c14e', `x${(0.55 + 0.75 * sd.sync).toFixed(2)}`);
}

function drawCalls(ctx, G, s, k, half, M) {
  const sd = s[k];
  const idA = `anchor:${k}`, idC = `coach:${k}`;
  const px = Math.round(half.anchor.h * 0.24);
  // ANCHOR
  const aOn = sd.anchorT > 0, aOk = sd.anchorLeft > 0 && !aOn && s.ph === 'pull';
  drawButton(ctx, addRect(idA, half.anchor), 'ANCHOR', { dark: !aOn, active: aOn, disabled: !aOk && !aOn, size: px, sub: aOn ? `${sd.anchorT.toFixed(1)} s` : `${sd.anchorLeft} left` });
  // COACH: fills with perfect heaves
  const cOn = sd.coachT > 0, cReady = sd.coachMeter >= 1 && !cOn && s.ph === 'pull';
  const r = half.coach;
  ctx.save();
  drawButton(ctx, addRect(idC, r), 'COACH', { dark: !cReady && !cOn, primary: cReady, active: cOn, size: px, sub: cOn ? `${sd.coachT.toFixed(1)} s` : cReady ? 'ready' : `${Math.round(sd.coachMeter * 100)}%` });
  if (!cOn && !cReady) { roundPath(ctx, r.x + 6, r.y + r.h - 12, r.w - 12, 6, 3); ctx.fillStyle = 'rgba(251,243,226,0.2)'; ctx.fill(); roundPath(ctx, r.x + 6, r.y + r.h - 12, Math.max(6, (r.w - 12) * sd.coachMeter), 6, 3); ctx.fillStyle = COL.gold; ctx.fill(); }
  if (cReady) { const pu = 0.5 + 0.5 * Math.sin(G.t * 8); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(242,193,78,${0.4 + 0.5 * pu})`; roundPath(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 22); ctx.stroke(); }
  ctx.restore();
}

function drawFeedback(ctx, G, s, k, half, M) {
  const L = s[k].last; if (!L) return;
  const age = s.t - L.t; if (age > 0.9 || age < 0) return;
  const u = age / 0.9;
  const txt = L.surge ? 'SURGE!' : L.g === 'perfect' ? 'PERFECT' : L.g === 'good' ? 'GOOD' : L.g === 'ok' ? 'OK' : 'OFF BEAT';
  const col = L.surge ? COL.coral : L.g === 'perfect' ? COL.gold : L.g === 'good' ? COL.ice : L.g === 'ok' ? ink : COL.coral;
  const px = 40 * Math.min(M, 1.3);
  ctx.save(); ctx.globalAlpha = 1 - u * u;
  const y = half.ring.y - half.ring.r - 22 - u * 28 - (half.wide ? 0 : 0);
  label(ctx, txt, half.ring.x, half.wide ? y - 0 : half.mid.y + 20 - u * 26, px, col);
  if (!L.surge && (L.g === 'good' || L.g === 'ok' || L.g === 'jerk')) label(ctx, L.err < 0 ? 'a touch early' : 'a touch late', half.ring.x, (half.wide ? y : half.mid.y + 20 - u * 26) + px * 0.7, px * 0.5, 'rgba(251,243,226,0.9)', 'center', 500);
  ctx.restore();
}

function drawReady(ctx, G, s, k, half, M) {
  const n = Math.ceil(-s.t);
  const px = 38 * Math.min(M, 1.3);
  label(ctx, 'TAKE THE STRAIN', half.mid.x, half.mid.y - px * 1.3, px, COL.gold);
  label(ctx, String(Math.max(1, n)), half.mid.x, half.mid.y + px * 1.4, px * 2.6, ink);
  label(ctx, G.mode === 'versus' ? 'Tap on the beat. Hold to dig in.' : 'Practise: tap as the ring lands. Nothing counts yet.', half.mid.x, half.mid.y + px * 2.5, px * 0.52, 'rgba(251,243,226,0.9)', 'center', 500);
}

function drawSurge(ctx, G, s, half, M) {
  const sg = s.surge, left = sg.hit - s.t;
  if (left < -0.05) return;
  const u = clamp(left / (sg.hit - sg.warn), 0, 1);
  const cx = half.mid.x, cy = half.mid.y + 10, px = 40 * Math.min(M, 1.3);
  const pul = 0.5 + 0.5 * Math.sin(G.t * 14);
  ctx.save();
  // red edge vignette
  const g = ctx.createRadialGradient(SW / 2, H / 2, Math.min(SW, H) * 0.35, SW / 2, H / 2, Math.max(SW, H) * 0.7); g.addColorStop(0, 'rgba(214,40,40,0)'); g.addColorStop(1, `rgba(214,40,40,${0.28 + 0.15 * pul})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H);
  ctx.lineWidth = 7; ctx.strokeStyle = `rgba(255,90,70,${0.5 + 0.4 * pul})`; ctx.beginPath(); ctx.arc(cx, cy, 70 + 140 * u, 0, TAU); ctx.stroke();
  label(ctx, 'RIVAL SURGE', cx, cy - px * 0.2, px, '#ff7a66');
  label(ctx, s.a.brace > 0.55 ? 'GOOD, HOLD IT' : 'HOLD YOUR FINGER DOWN', cx, cy + px * 0.8, px * 0.62, ink);
  ctx.restore();
}

// ---- cards -------------------------------------------------------------------------------------------------------------------------------
function center(L) { return { x: SW / 2, w: Math.min(SW - 40 - host.l - host.r, 640), t: L.T }; }

function drawPullCard(ctx, G, s, L, M) {
  const c = center(L);
  const me = G.mode === 'versus' ? s.winner : 'a';
  const won = s.winner === 'a';
  const versus = G.mode === 'versus';
  const mt = G.match;
  const fs = 30 * Math.min(M, 1.4);
  const title = versus ? (won ? 'TEAM A WINS THE PULL' : 'TEAM B WINS THE PULL') : won ? 'YOU WIN THE PULL' : 'THEY WIN THE PULL';
  const open = s.over;
  const w = c.w, h = open ? Math.min(H * 0.5, 330 * Math.min(M, 1.4)) : 110 * Math.min(M, 1.3);
  const x = c.x - w / 2, y = Math.max(L.T + 120, (H - h) / 2 - (versus ? 0 : H * 0.06));
  void me;
  ctx.save(); ctx.globalAlpha = clamp((s.pt - 0.5) * 3, 0, 1);
  panel(ctx, x, y, w, h, { r: 26, fill: 'rgba(42,24,12,0.94)', stroke: 'rgba(251,243,226,0.5)' });
  ctx.textAlign = 'center'; ctx.fillStyle = won ? COL.gold : COL.coral; ctx.font = font(fs * 1.1, 800);
  ctx.fillText(title, c.x, y + fs * 1.5);
  if (open) {
    const done = mt && mt.done;
    ctx.fillStyle = ink; ctx.font = font(fs * 0.62, 500);
    const why = s.why === 'line' ? 'The flag crossed the win line.' : 'Time was up: the flag was on their side.';
    ctx.fillText(why.replace('their', won ? 'their' : 'your'), c.x, y + fs * 2.5);
    const perf = s.a.heaves ? Math.round(100 * s.a.perfect / s.a.heaves) : 0;
    ctx.fillText(`${versus ? 'Team A' : 'Your'} perfect heaves ${perf}%  ·  best streak ${s.a.bestStreak}  ·  blocked ${s.a.blocked}`, c.x, y + fs * 3.3);
    const bw = w - 60, bh = Math.round(80 * Math.min(M, 1.3));
    drawButton(ctx, addRect('pullnext', { x: c.x - bw / 2, y: y + h - bh - 24, w: bw, h: bh }), done ? 'Continue' : 'Next pull', { primary: true, size: Math.round(bh * 0.4) });
  }
  ctx.restore();
}

function drawRoundCard(ctx, G, L, M) {
  const mt = G.match, rd = mt.rounds[mt.round], rv = teamById(rd.rival), set = settingById(rd.setting), lv = levelById(rd.level);
  const w = Math.min(SW - 40 - host.l - host.r, 640), x = SW / 2 - w / 2;
  const fs = 30 * Math.min(M, 1.4);
  const lines = [];
  const versus = G.mode === 'versus';
  lines.push([rd.label.toUpperCase(), COL.gold, fs * 1.15, 800]);
  lines.push([versus ? 'Team A against Team B' : `You against ${rv.name}`, ink, fs * 0.9, 700]);
  lines.push([`at ${set.name}`, 'rgba(251,243,226,0.85)', fs * 0.7, 500]);
  if (!versus) lines.push([`Rivals: ${lv.name}  ·  ${lv.blurb}`, 'rgba(251,243,226,0.85)', fs * 0.6, 500]);
  lines.push([mt.need > 1 ? 'First to win two pulls' : 'One pull decides it', COL.ice, fs * 0.64, 600]);
  if (mt.kind === 'bracket') lines.push([ROUND_NAMES.map((n, i) => `${i < mt.round ? '✓ ' : i === mt.round ? '▶ ' : ''}${n}`).join('   '), 'rgba(251,243,226,0.8)', fs * 0.52, 500]);
  const bh = Math.round(86 * Math.min(M, 1.3));
  let hh = 40; for (const l of lines) hh += l[2] * 1.5; hh += bh + 40;
  const y = Math.max(L.T + 40, (H - hh) / 2);
  panel(ctx, x, y, w, hh, { r: 28, fill: 'rgba(42,24,12,0.92)', stroke: 'rgba(251,243,226,0.5)' });
  let yy = y + 30;
  for (const [txt, col, px, wt] of lines) { yy += px * 1.15; ctx.textAlign = 'center'; ctx.fillStyle = col; const pxf = fitPx(ctx, txt, wt, px, w - 40, 12); ctx.font = font(pxf, wt); ctx.fillText(txt, SW / 2, yy); yy += px * 0.35; }
  drawButton(ctx, addRect('roundgo', { x: x + 30, y: y + hh - bh - 24, w: w - 60, h: bh }), G.mode === 'watch' ? 'Start Watch & Learn' : 'Take the rope', { primary: true, size: Math.round(bh * 0.4) });
}

function drawSeam(ctx, G, L) {
  // a thin line between the two halves
  ctx.save(); ctx.strokeStyle = 'rgba(251,243,226,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); if (L.land) { ctx.moveTo(SW / 2, 0); ctx.lineTo(SW / 2, H); } else { ctx.moveTo(0, H / 2); ctx.lineTo(SW, H / 2); } ctx.stroke(); ctx.restore();
}

// ---- Think / hint card and the Watch & Learn panel ------------------------------------------------------------------------------------------
function card(ctx, G, L, M, title, body, opts) {
  const w = Math.min(SW - 36 - host.l - host.r, 700), x = SW / 2 - w / 2;
  const fs = 26 * Math.min(M, 1.8);
  const ph = opts.h || Math.min(H * (L.land ? 0.62 : 0.5), 520 * Math.min(M, 1.6));
  const y = opts.y ?? Math.max(L.T + 12, (H - ph) / 2);
  panel(ctx, x, y, w, ph, { r: 28, fill: 'rgba(42,24,12,0.95)', stroke: 'rgba(251,243,226,0.5)' });
  ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 8, w - 16, ph - 16 - (opts.footer || 0)); ctx.clip();
  const view = ph - 24 - (opts.footer || 0);
  const lines = []; ctx.font = font(fs, 400); for (const para of body) lines.push(...wrapLines(ctx, para, w - 56), '');
  const th = fs * 1.35 + 14, contentH = th + lines.length * fs * 1.28;
  const max = Math.max(0, contentH - view); CARD.rect = { x, y, w, h: ph - (opts.footer || 0) }; CARD.max = max; CARD.view = view;
  const sc = clamp(G.ui.cardScroll || 0, 0, max);
  ctx.textAlign = 'center'; ctx.fillStyle = COL.gold; ctx.font = font(fs * 1.15, 800); ctx.fillText(title, SW / 2, y + 16 + fs * 1.05 - sc);
  ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = font(fs, 400);
  let yy = y + 16 + th + fs - sc; for (const l of lines) { ctx.fillText(l, x + 28, yy); yy += fs * 1.28; }
  ctx.restore();
  if (max > 0) { const ty = y + 12 + (sc / max) * (view - 50); roundPath(ctx, x + w - 14, y + 12, 7, view, 3.5); ctx.fillStyle = 'rgba(251,243,226,0.14)'; ctx.fill(); roundPath(ctx, x + w - 14, ty, 7, 50, 3.5); ctx.fillStyle = 'rgba(251,243,226,0.7)'; ctx.fill(); }
  return { x, y, w, h: ph };
}
function drawThink(ctx, G, s, L, M) {
  const h = G.think;
  ctx.fillStyle = 'rgba(20,10,4,0.45)'; ctx.fillRect(0, 0, SW, H);
  const bh = Math.round(80 * Math.min(M, 1.3));
  const c = card(ctx, G, L, M, h.title, [h.text, h.action === 'hold' ? 'Action: HOLD your finger down.' : h.action === 'coach' ? 'Action: tap the COACH button.' : h.action === 'anchor' ? 'Action: tap the ANCHOR button.' : 'Action: TAP on the beat.'], { footer: bh + 28 });
  drawButton(ctx, addRect('think-close', { x: c.x + 30, y: c.y + c.h - bh - 20, w: c.w - 60, h: bh }), 'Got it', { primary: true, size: Math.round(bh * 0.42) });
}
function drawWatch(ctx, G, s, L, M) {
  const w = G.watch;
  const px = Math.round(L.uh * 0.4);
  const half = L.halves[0];
  drawButton(ctx, addRect('w-pause', { x: L.pause.x, y: L.pause.y, w: L.pause.w, h: L.pause.h }), w.paused ? 'Resume' : 'Pause', { dark: !w.paused, primary: w.paused, size: px });
  drawButton(ctx, addRect('w-quit', { x: L.think ? L.think.x : SW - 160, y: L.pause.y, w: L.pause.w, h: L.pause.h }), 'Leave', { dark: true, size: px });
  const uh = L.uh;
  // speed chips under Pause
  const label2 = `Think time ${G.thinkTotal}s`;
  const cw = Math.min(310, SW * 0.36);
  chip(ctx, L.pause.x, L.pause.y + uh + 8, cw, uh * 0.8);
  ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.font = font(px * 0.62, 600); ctx.textAlign = 'left'; ctx.fillText(label2, L.pause.x + 14, L.pause.y + uh + 8 + uh * 0.4);
  ctx.textBaseline = 'alphabetic';
  if (s.hold || w.phase === 'think' || w.phase === 'reveal') { if (w.holdId) drawWatchCard(ctx, G, s, L, M); }
  else { chip(ctx, SW / 2 - 140, H - host.b - 34 - (half.wide ? 0 : 0), 280, 40); label(ctx, 'WATCH & LEARN: the computer pulls', SW / 2, H - host.b - 8 - (half.wide ? 0 : 0), 17, 'rgba(251,243,226,0.9)'); }
}
function drawWatchCard(ctx, G, s, L, M) {
  const w = G.watch, h = s.hold; if (!h) return;
  const rev = w.phase === 'reveal';
  const bh = Math.round(60 * Math.min(M, 1.3));
  const body = [h.text];
  const pct = rev ? 1 - w.timer / 2 : 1 - w.timer / Math.max(0.1, G.thinkTotal);
  const c = card(ctx, G, L, M, `${rev ? 'WATCH' : 'THINK'}: ${h.title}`, body, { footer: bh + 44, y: L.land ? L.T + 8 : L.pause.y + L.uh * 1.9 + 10, h: Math.min(H * (L.land ? 0.58 : 0.4), 340 * Math.min(M, 1.5)) });
  // timer bar
  const bx = c.x + 28, by = c.y + c.h - bh - 34, bw = c.w - 56;
  roundPath(ctx, bx, by, bw, 12, 6); ctx.fillStyle = 'rgba(251,243,226,0.2)'; ctx.fill();
  roundPath(ctx, bx, by, Math.max(10, bw * clamp(pct, 0, 1)), 12, 6); ctx.fillStyle = rev ? COL.moss : COL.gold; ctx.fill();
  ctx.fillStyle = ink; ctx.font = font(bh * 0.4, 600); ctx.textAlign = 'center'; ctx.fillText(rev ? `Now: ${h.doText}` : `Thinking time: ${Math.ceil(w.timer)} s`, c.x + c.w / 2, by + bh * 0.8 + 6);
  // highlight what the computer will do
  if (rev) {
    const half = L.halves[0];
    ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = COL.gold; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.t * 10);
    const tgt = h.action === 'anchor' ? half.anchor : h.action === 'coach' ? half.coach : null;
    if (tgt) { roundPath(ctx, tgt.x - 6, tgt.y - 6, tgt.w + 12, tgt.h + 12, 22); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(half.ring.x, half.ring.y, half.ring.r + 14, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}

// ---- the flat fallback picture used when WebGL is missing -----------------------------------------------------------------------------------------
export function renderFallback(ctx, G, v) {
  const s = G.pull ? G.pull.s : null;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fc2ea'); g.addColorStop(0.55, '#e9d8a8'); g.addColorStop(0.56, '#8aa850'); g.addColorStop(1, '#6a8a3a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H);
  const x = s ? s.x : 0, cy = H * 0.5;
  ctx.fillStyle = COL.rope; ctx.fillRect(SW * 0.06, cy - 5, SW * 0.88, 10);
  const mx = SW / 2 - x / LIMIT * SW * 0.12;
  ctx.fillStyle = '#d62828'; ctx.fillRect(mx - 14, cy, 28, 44);
  for (let i = 0; i < 4; i++) {
    for (const sd of [-1, 1]) {
      const px = mx + sd * (SW * 0.1 + i * SW * 0.1), lean = sd * -0.3;
      ctx.save(); ctx.translate(px, cy + 90); ctx.rotate(lean); ctx.fillStyle = sd < 0 ? '#c8352b' : '#b5651d'; roundPath(ctx, -16, -90, 32, 90, 12); ctx.fill(); ctx.beginPath(); ctx.arc(0, -104, 14, 0, TAU); ctx.fillStyle = '#d9a982'; ctx.fill(); ctx.restore();
    }
  }
  void v;
}
