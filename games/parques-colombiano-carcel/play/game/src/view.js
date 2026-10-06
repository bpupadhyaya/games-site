// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The heavy art is cached (art.js).
import { W, H, BOARD, TRAY, CS, UNIT, DICE_SPOTS, PANEL, BODY, G, posXY, hopPath, jailOffset, gridXY } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { T, END, isSafe, trackIndex, homeCount, SEAT_NAMES, SEAT_ES, newGame } from './rules.js';
import { drawStatic, drawFloorOnly, drawPanel, drawPiece, drawDie, paintCell, crown, star5, lcg, SEAT, LIGHT, DARK, INK, mix } from './art.js';
import { screenButtons, screenLayout, readerFlow, readerMax, zoomOf } from './ui.js';
import { ART_H } from './text.js';

export const DISPLAY = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ACC = '#8a1f26';
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a fixed showcase position for the title screen
const TITLE_G = (() => { const g = newGame({ players: 4, humans: [false, false, false, false] }); g.pos = [[-1, -1, 5, 31], [-1, 12, 40, 60], [-1, -1, 22, 70], [-1, 3, 49, 75]]; return g; })();

export function render(ctx, state) {
  const sc = state.scene, T0 = state.t, z = zoomOf(state);
  const panelScene = ['setup', 'settings', 'how', 'about', 'rules', 'demo-limit'].includes(sc);
  PRESSED = state.press && !state.press.moved ? state.press.b : null;
  const R = makeText(ctx);

  if (panelScene) drawFloorOnly(ctx); else drawStatic(ctx, sc !== 'title');

  if (sc === 'title') { drawTitle(ctx, state, R); return; }
  if (panelScene) { drawPanelScene(ctx, state, R, z); return; }

  const g = state.g;
  drawJails(ctx, state, R);
  drawPieces(ctx, state, R);
  drawDice(ctx, state, R);
  drawParticles(ctx, state);
  const auto = sc === 'autoplay' || sc === 'autoplay-over';
  const hd = G.head, ttl = auto ? 'Auto Play · Watch & Learn' : 'Parqués';
  let tsz = Math.round(hd.title.size * (auto ? 0.66 : 1)); while (tsz > 20 && ttl.length * tsz * 0.56 > hd.title.maxW) tsz -= 2;
  R.glowText(ttl, hd.title.x, hd.title.y, tsz, '#ffe27a');
  const pq = hd.plaque; plaque(ctx, pq.x, pq.y, pq.w, pq.h);
  R.fit(state.msg || '', pq.x + pq.w / 2, pq.y + 6, pq.w - 52, pq.h - 12, hd.msgSize * z, 17, '#fff4d6');

  if (sc === 'play' || sc === 'autoplay') {
    if (!state.menuOpen) { for (const b of screenButtons(state)) R.button(b); }
    if (sc === 'autoplay' && state.ap.paused && !state.menuOpen) drawPausedBanner(ctx, R);
  }
  if (state.menuOpen && (sc === 'play' || sc === 'autoplay')) { scrim(ctx, 0.62); drawStack(ctx, state, R, z); }
  if (sc === 'over' || sc === 'autoplay-over') { drawOver(ctx, state, R, z); }
}

// ---- text helpers ---------------------------------------------------------------------------------------------
function makeText(ctx) {
  const text = (str, x, y, size, color = '#fff4d6', font = DISPLAY, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const glowText = (str, x, y, size, color) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; text(str, x, y, size, color, DISPLAY, 700); ctx.restore(); };
  const fitCache = R_FIT;
  // wrap message text into a box, shrinking the font until it fits (cached per text/size)
  const fit = (str, x, y, maxW, maxH, sMax, sMin, color) => {
    sMax = Math.round(sMax);
    const key = str + '|' + sMax + '|' + maxW + '|' + maxH;
    let hit = fitCache.get(key);
    if (!hit) {
      for (let s = sMax; s >= sMin; s -= 1) {
        ctx.font = `600 ${s}px ${DISPLAY}`; const lines = []; let cur = '';
        for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
        lines.push(cur);
        if (lines.length * s * 1.25 <= maxH || s === sMin) { hit = { s, lines }; break; }
      }
      if (fitCache.size > 400) fitCache.clear();
      fitCache.set(key, hit);
    }
    const lh = hit.s * 1.25, top = y + (maxH - hit.lines.length * lh) / 2 + hit.s * 0.9;
    hit.lines.forEach((ln, i) => text(ln, x, top + i * lh, hit.s, color, DISPLAY, 600));
  };
  const button = (n) => {
    ctx.save(); if (n.dim) ctx.globalAlpha = 0.45;
    const down = !!n.id && n.id === PRESSED && !n.dim; if (down) ctx.translate(0, 3);
    const prim = n.primary, sel = n.sel;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(n.x + 2, n.y + 6, n.w, n.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, n.y, 0, n.y + n.h);
    if (prim || (sel && n.chip)) { gr.addColorStop(0, '#fbd95e'); gr.addColorStop(1, '#e9ae14'); }
    else if (sel) { gr.addColorStop(0, '#3dbd7d'); gr.addColorStop(1, '#1d8a54'); }
    else { gr.addColorStop(0, '#4766b4'); gr.addColorStop(1, '#3a56a0'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, 18); ctx.fill();
    ctx.strokeStyle = prim || (sel && n.chip) ? '#fff2b0' : 'rgba(205,220,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (down) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, 18); ctx.fill(); }
    const dark = prim || (sel && n.chip), col = dark ? '#2a1b12' : '#fff4d6', lines = n.lines || [n.label];
    let size = n.size; const need = lines.length * size * 1.22;
    if (need > n.h - 12) size = Math.max(14, Math.floor((n.h - 12) / (lines.length * 1.22)));
    const lh = size * 1.22, top = n.y + n.h / 2 - (lines.length * lh) / 2 + size * 0.88;
    lines.forEach((ln, i) => text(ln, n.x + n.w / 2, top + i * lh, size, col, DISPLAY, 600));
    ctx.restore();
  };
  return { text, glowText, fit, button };
}
const R_FIT = new Map();
let PRESSED = null; // id of the button under the finger (set once per frame in render)

function plaque(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2b3a66'); gr.addColorStop(1, '#17203f');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#f0c24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.stroke();
}
const scrim = (ctx, a = 0.62) => { ctx.fillStyle = `rgba(10,5,3,${a})`; ctx.fillRect(0, 0, W, H); };

// ---- jails: turn glow, name labels, bars -----------------------------------------------------------------------------
const jailRect = (arm) => { const [ux, uy] = jailOffset(arm), p = gridXY(ux, uy), s = CS * 5.0; return { x: p.x - s / 2, y: p.y - s / 2, w: s, h: s, cx: p.x, cy: p.y }; };
function drawJails(ctx, state, R) {
  const g = state.g, T0 = state.t, inGame = state.scene !== 'title';
  for (let a = 0; a < 4; a++) {
    const pl = g.players.findIndex((p) => p.arm === a), r = jailRect(a);
    if (pl < 0) { ctx.fillStyle = 'rgba(20,10,5,0.5)'; ctx.beginPath(); ctx.roundRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 26); ctx.fill(); continue; }
    const turn = inGame && g.turn === pl && g.winner < 0;
    if (turn) {
      ctx.save(); ctx.strokeStyle = `rgba(255,236,150,${0.6 + 0.35 * Math.sin(T0 * 4)})`; ctx.lineWidth = 6; ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.roundRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20, 28); ctx.stroke(); ctx.restore();
    }
    const label = `${g.players[pl].name} · ${homeCount(g, pl)}/4`, ly = a === 2 || a === 3 ? r.y - 14 : r.y + r.h + 14;
    ctx.save(); ctx.font = `600 22px ${DISPLAY}`; const w = ctx.measureText(label).width + 30;
    ctx.fillStyle = turn ? SEAT[a] : 'rgba(18,12,30,0.82)'; ctx.beginPath(); ctx.roundRect(r.cx - w / 2, ly - 17, w, 34, 17); ctx.fill();
    ctx.strokeStyle = LIGHT[a]; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    R.text(label, r.cx, ly + 7, 22, turn ? '#2a1b12' : '#fff4d6', DISPLAY, 600);
  }
}
function drawBars(ctx, state, arm) {
  const r = jailRect(arm), sh = state.jailShake?.[arm] || 0, fl = sh > 0 ? Math.min(1, sh / 0.7) * (0.55 + 0.45 * Math.sin(sh * 40)) : 0;
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 16); ctx.clip();
  const n = 7;
  for (let k = 0; k < n; k++) {
    const x = r.x + 10 + k * ((r.w - 20) / (n - 1)), g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
    g.addColorStop(0, '#515a6e'); g.addColorStop(0.45, '#e8eef9'); g.addColorStop(1, '#3a4254');
    ctx.globalAlpha = 0.82; ctx.fillStyle = g; ctx.fillRect(x - 3, r.y + 2, 6, r.h - 4);
  }
  ctx.globalAlpha = 0.92;
  for (const y of [r.y + 8, r.y + r.h - 14]) { const g = ctx.createLinearGradient(0, y, 0, y + 7); g.addColorStop(0, '#f2f6ff'); g.addColorStop(1, '#4a5368'); ctx.fillStyle = g; ctx.fillRect(r.x + 2, y, r.w - 4, 7); }
  ctx.restore();
  if (fl > 0) { // fixed surface: the jail bars stay put; flash the slot instead
    ctx.save(); ctx.strokeStyle = `rgba(255,120,90,${fl})`; ctx.lineWidth = 6; ctx.shadowColor = '#ff6a5a'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 16); ctx.stroke(); ctx.restore();
  }
}

// ---- pieces ---------------------------------------------------------------------------------------------------------------
export function drawPieces(ctx, state, R) {
  const g = state.g, T0 = state.t, u = UNIT, PK = 0.98 * u, list = [];
  const flying = new Set(state.fly.map((f) => f.pl + ',' + f.i)), hop = state.hop;
  const reveal = state.phase === 'apreveal';
  const choose = (state.phase === 'choose' || reveal) && state.opts.length && (g.players[g.turn].human || state.scene === 'autoplay');
  const optsDie = choose ? state.opts.filter((o) => o.di === state.dieSel) : [];
  const selMove = choose && state.sel >= 0 ? optsDie.find((o) => o.i === state.sel) : null;
  const froms = new Set(optsDie.map((o) => o.from)), othersFrom = choose ? new Set(state.opts.filter((o) => o.di !== state.dieSel).map((o) => o.from)) : new Set();
  const groups = new Map();
  g.pos.forEach((ps, pl) => ps.forEach((p, i) => {
    if (flying.has(pl + ',' + i) || (hop && hop.pl === pl && hop.i === i)) return;
    const s = posXY(g, pl, i, p), onBoard = p >= 0 && p < END, key = onBoard ? `${Math.round(s.x)},${Math.round(s.y)}` : `s${pl}_${i}`;
    const it = { pl, i, p, x: s.x, y: s.y, k: PK, movable: choose && pl === g.turn && froms.has(p), other: choose && pl === g.turn && !froms.has(p) && othersFrom.has(p) };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it); list.push(it);
  }));
  for (const gr of groups.values()) if (gr.length > 1) gr.forEach((it, j) => { it.x += (j - (gr.length - 1) / 2) * 9 * u; it.k = PK * 0.9; it.y += (j % 2 ? 2 : -2) * u; });
  // rings for where each movable piece would land
  if (choose) {
    for (const m of optsDie) {
      const d = posXY(g, m.pl, m.i, m.to), sel = selMove && selMove.i === m.i, pulse = 0.5 + 0.5 * Math.sin(T0 * 5);
      ctx.save(); ctx.strokeStyle = m.caps.length ? `rgba(255,90,70,${0.75 + 0.25 * pulse})` : `rgba(255,236,150,${sel ? 1 : 0.5 + 0.25 * pulse})`; ctx.lineWidth = sel ? 5 : 3;
      if (!sel) ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.ellipse(d.x, d.y + 2 * u, (17 + pulse * 2) * u, (12 + pulse) * u, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  const drawOne = (it) => {
    let lift = 0, x = it.x, y = it.y + 5 * u;
    if (it.movable || it.other) {
      const sel = it.movable && selMove && selMove.from === it.p;
      ctx.save(); ctx.globalAlpha = it.movable ? 0.5 + 0.3 * Math.sin(T0 * 5 + it.i) : 0.22;
      const g2 = ctx.createRadialGradient(x, y, 2, x, y, 28 * u); g2.addColorStop(0, sel ? 'rgba(255,245,170,1)' : 'rgba(255,220,110,0.95)'); g2.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(x, y + 2 * u, 28 * u, 17 * u, 0, 0, TAU); ctx.fill(); ctx.restore();
      if (it.movable) lift = ((sel ? 9 : 0) + (state.prefs.calm ? 0 : Math.abs(Math.sin(T0 * 4 + it.i)) * 3)) * u;
    }
    if (state.shake && state.shake.pl === it.pl && state.shake.i === it.i) x += Math.sin(state.shake.t * 60) * 5 * u * (1 - state.shake.t / 0.55);
    drawPiece(ctx, g.players[it.pl].arm, x, y, it.k, lift);
  };
  list.filter((it) => it.p < 0).sort((a, b) => a.y - b.y).forEach(drawOne);
  for (let a = 0; a < 4; a++) if (g.players.some((p) => p.arm === a)) drawBars(ctx, state, a);
  list.filter((it) => it.p >= 0).sort((a, b) => a.y - b.y || a.x - b.x).forEach(drawOne);
  // ghost, path and tag for the selected move
  if (selMove) {
    const pts = hopPath(g, selMove.pl, selMove.i, selMove.from, selMove.to), d = pts[pts.length - 1];
    ctx.save(); ctx.strokeStyle = 'rgba(255,240,180,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
    drawPiece(ctx, g.players[selMove.pl].arm, d.x, d.y + 5 * u, PK, 0, 0.55 + 0.2 * Math.sin(T0 * 6));
    const t = trackIndex(g, selMove.pl, selMove.to);
    const tag = selMove.caps.length ? (selMove.enter ? 'Free + capture!' : 'Capture!') : selMove.enter ? 'Free' : selMove.to === END ? 'Home!' : t != null && isSafe(t) ? 'Safe' : selMove.to >= T ? 'Home lane' : '';
    if (tag) {
      ctx.save(); ctx.font = `600 21px ${DISPLAY}`; const w = ctx.measureText(tag).width + 24, ty = d.y - 70 * u;
      ctx.fillStyle = selMove.caps.length ? '#c42a30' : '#1d8a54'; ctx.beginPath(); ctx.roundRect(d.x - w / 2, ty, w, 30, 15); ctx.fill(); ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(tag, d.x, ty + 22); ctx.restore();
    }
  }
  if (hop) {
    const a = hop.pts[Math.min(hop.seg, hop.n)], b = hop.pts[Math.min(hop.seg + 1, hop.n)], f = hop.seg >= hop.n ? 1 : clamp(hop.t / hop.per, 0, 1), e = ease(f);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    drawPiece(ctx, g.players[hop.pl].arm, x, y + 5 * u, PK * 1.06, Math.sin(Math.PI * f) * (hop.m.enter ? 34 : 17) * u);
  }
  for (const f of state.fly) {
    const uu = ease(clamp(f.t / f.dur, 0, 1));
    drawPiece(ctx, g.players[f.pl].arm, f.from.x + (f.to.x - f.from.x) * uu, f.from.y + (f.to.y - f.from.y) * uu + 5 * u, PK, (Math.sin(Math.PI * uu) * 100 + 6) * u, 1);
    if (f.t < 0.35) { ctx.save(); ctx.globalAlpha = 1 - f.t / 0.35; ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.from.x, f.from.y, 14 + f.t * 90, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

// ---- dice and the tray -------------------------------------------------------------------------------------------------
function drawDice(ctx, state, R) {
  const Ro = state.roll, T0 = state.t, g = state.g, ph = state.phase;
  const yours = ph === 'throw' && g.players[g.turn].human && state.scene === 'play';
  if (yours) {
    ctx.save(); const pulse = 0.5 + 0.5 * Math.sin(T0 * 4), tcx = TRAY.x + TRAY.w / 2, tcy = DICE_SPOTS[0].y + 20, trx = TRAY.w * 0.5, try_ = Math.min(130, TRAY.h * 0.43), gr = ctx.createRadialGradient(tcx, tcy, 20, tcx, tcy, trx);
    gr.addColorStop(0, `rgba(255,224,120,${0.25 + 0.2 * pulse})`); gr.addColorStop(1, 'rgba(255,190,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(tcx, tcy, trx, try_, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (!Ro) {
    DICE_SPOTS.forEach((s, k) => drawDie(ctx, s.x + (k ? 6 : -4), s.y + Math.sin(T0 * 2 + k * 2) * 2, k ? 0.28 : -0.2, k ? 3 : 5, 0, 1));
  } else {
    const rolling = ph === 'roll';
    Ro.items.forEach((it, k) => {
      const D = Ro.dur - 0.12, u = rolling ? clamp((Ro.t - it.dl) / D, 0, 1) : 1;
      const e1 = ease(clamp(u / 0.72, 0, 1)), tx = DICE_SPOTS[k].x + it.jx, ty = DICE_SPOTS[k].y + it.jy, x = it.x0 + (tx - it.x0) * e1, y = it.y0 + (ty - it.y0) * e1;
      const bounce = (a, b, h) => (u > a && u < b ? h * 4 * ((u - a) / (b - a)) * (1 - (u - a) / (b - a)) : 0);
      let zz = u < 0.72 ? 200 * 4 * (u / 0.72) * (1 - u / 0.72) : bounce(0.72, 0.88, 28) + bounce(0.88, 1, 9);
      if (state.prefs.calm) zz = 0;
      const rotA = it.r0 + (it.r1 - it.r0) * (1 - (1 - u) * (1 - u)), face = u < 0.85 ? ((Math.floor(Ro.t * 18) + it.face0 + k * 2) % 6) + 1 : Ro.dice[k];
      const used = !rolling && Ro.rem[k] == null, glow = !rolling && !used && (ph === 'choose' || ph === 'apreveal') && state.dieSel === k ? 0.5 + 0.5 * Math.sin(T0 * 6) : 0;
      drawDie(ctx, x, y, rotA, face, zz, 1, { used, glow });
    });
  }
  // prompt or result
  const pr = G.prompt;
  if (yours) {
    const a = 0.5 + 0.5 * Math.sin(T0 * 5);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(18,28,60,0.94)'; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 30); ctx.fill(); ctx.restore();
    ctx.strokeStyle = `rgba(255,224,130,${0.6 + 0.4 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 30); ctx.stroke();
    let ps = 26; while (ps > 15 && 'TAP or SWIPE the tray to roll'.length * ps * 0.54 > pr.w - 30) ps -= 1;
    R.text('TAP or SWIPE the tray to roll', pr.cx, pr.y + pr.h / 2 + ps * 0.38, ps, '#fff4d6', DISPLAY, 600);
    ctx.strokeStyle = `rgba(255,236,170,${0.4 + 0.5 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cy = G.arrow.y - a * 8, ax = G.arrow.x; ctx.beginPath(); ctx.moveTo(ax - 20, cy + 9); ctx.lineTo(ax, cy - 3); ctx.lineTo(ax + 20, cy + 9); ctx.stroke();
  } else if (Ro && ph !== 'roll' && ph !== 'throw') {
    const txt = Ro.dbl ? `Pair! ${Ro.dice[0]} + ${Ro.dice[1]}` : `${Ro.dice[0]} + ${Ro.dice[1]}`, rw = G.resultW, rx = pr.cx - rw / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(18,28,60,0.94)'; ctx.beginPath(); ctx.roundRect(rx, pr.y, rw, pr.h, 30); ctx.fill(); ctx.restore();
    ctx.strokeStyle = Ro.dbl ? '#ffe28a' : '#c9982f'; ctx.lineWidth = Ro.dbl ? 4 : 3; ctx.beginPath(); ctx.roundRect(rx, pr.y, rw, pr.h, 30); ctx.stroke();
    R.text(txt, pr.cx, pr.y + 43, 30, Ro.dbl ? '#ffe27a' : '#fff4d6', DISPLAY, 600);
  }
}

function drawParticles(ctx, state) {
  for (const p of state.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.col;
    if (p.rect) { ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillRect(-p.sz, -p.sz * 0.6, p.sz * 2, p.sz * 1.2); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

function drawPausedBanner(ctx, R) {
  scrim(ctx, 0.35);
  const bw = Math.min(420, W - 32), bx = W / 2 - bw / 2, by = BOARD.cy - 85, cx = W / 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.fillStyle = 'rgba(18,28,60,0.95)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 170, 28); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#f0c24a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(bx, by, bw, 170, 28); ctx.stroke();
  R.text('Paused', cx, by + 90, 72, '#ffe27a', DISPLAY, 700);
  R.text('Everything is frozen. TAP Resume.', cx, by + 140, Math.min(24, Math.floor((bw - 24) / 15)), '#fff4d6', DISPLAY, 500);
}

// ---- panels and stacks ------------------------------------------------------------------------------------------------------
function fitTitle(ctx, R, str, y, size) {
  let s = size; ctx.font = `700 ${s}px ${DISPLAY}`;
  while (s > 24 && ctx.measureText(str).width > PANEL.w - 110) { s -= 2; ctx.font = `700 ${s}px ${DISPLAY}`; }
  R.text(str, W / 2, y, s, ACC, DISPLAY, 700);
}
function drawPanelScene(ctx, state, R, z) {
  const sc = state.scene;
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  if (sc === 'how' || sc === 'about' || sc === 'rules') { drawReader(ctx, state, R, z); return; }
  const lay = screenLayout(state);
  fitTitle(ctx, R, lay.st.title, G.panelTitle.y, G.panelTitle.size);
  drawStackBody(ctx, state, R, lay, z);
}
function drawStack(ctx, state, R, z) {
  const lay = screenLayout(state), c = lay.st.card;
  if (c) { drawPanel(ctx, c.x, c.y, c.w, c.h); if (c.title) R.text(c.title, c.x + c.w / 2, G.menuTitleY, 52, ACC, DISPLAY, 700); }
  drawStackBody(ctx, state, R, lay, z);
}
function drawStackBody(ctx, state, R, lay, z) {
  const reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 8); ctx.clip();
  for (const n of lay.nodes) {
    if (n.y + n.h < reg.y - 4 || n.y > reg.y + reg.h + 4) continue;
    if (n.k === 'text') {
      const x = n.align === 'left' ? n.x : n.x + n.w / 2;
      n.lines.forEach((ln, i) => R.text(ln, x, n.y + i * n.lh + n.size * 0.95, n.size, n.color, n.font === 'display' ? DISPLAY : DISPLAY, n.weight ?? 600, n.align === 'left' ? 'left' : 'center'));
    } else if (n.k === 'btn') R.button(n);
    else if (n.k === 'art') drawStackArt(ctx, state, R, n, lay);
  }
  ctx.restore();
  if (lay.maxScroll > 0) { // a slim scroll thumb
    const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll);
    ctx.fillStyle = 'rgba(40,30,60,0.35)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, reg.y, 6, reg.h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, ty, 6, th, 3); ctx.fill();
    if (lay.scroll < lay.maxScroll - 4) { ctx.fillStyle = 'rgba(255,246,220,0.92)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w / 2 - 62, reg.y + reg.h - 24, 124, 24, 12); ctx.fill(); R.text('drag to scroll', reg.x + reg.w / 2, reg.y + reg.h - 6, 17, 'rgba(60,40,30,0.8)', DISPLAY, 500); }
  }
  for (const f of lay.footer) R.button(f);
}
function drawStackArt(ctx, state, R, n) {
  const g = state.g, T0 = state.t;
  if (n.name === 'winner') { const w = g.players[state.over.winner]; drawPiece(ctx, w.arm, n.x + n.w / 2, n.y + n.h - 14, 2.6, Math.abs(Math.sin(T0 * 3)) * 22); }
  else if (n.name === 'rank') {
    const r = n.r, p = g.players[r.pl], cy = n.y + n.h / 2;
    drawPiece(ctx, p.arm, n.x + 30, cy + 22, 0.9, 0);
    R.text(`${n.rank + 1}.  ${p.name}`, n.x + 62, cy + 9, Math.min(34, Math.round(n.h * 0.5)), INK, DISPLAY, 600, 'left');
    R.text(`${r.home} of 4 home`, n.x + n.w - 8, cy + 9, Math.min(28, Math.round(n.h * 0.42)), ACC, DISPLAY, 500, 'right');
  } else if (n.name === 'pieces4') { for (let a = 0; a < 4; a++) drawPiece(ctx, a, n.x + n.w / 2 - 150 + a * 100, n.y + n.h * 0.8, 1.8, 0); }
}

// ---- reader pages ---------------------------------------------------------------------------------------------------------------
function drawReader(ctx, state, R, z) {
  const sc = state.scene, F = readerFlow(sc, z), max = readerMax(state), scroll = clamp(state.scroll || 0, 0, max);
  const rd = G.reader; fitTitle(ctx, R, sc === 'how' ? 'How to Play' : sc === 'about' ? 'About' : 'Rules', rd.title.y, Math.round(rd.title.size * Math.min(1.25, z)));
  ctx.save(); ctx.beginPath(); ctx.rect(BODY.x - 14, BODY.y, BODY.w + 28, BODY.h); ctx.clip();
  for (const s of F.secs) {
    const top = BODY.y + s.y - scroll;
    if (top > BODY.y + BODY.h + 40) continue;
    let y = top;
    const secH = Math.round(s.hs * 1.5) + (s.art ? ART_H + Math.round(s.size * 0.3) : 0) + s.lines.reduce((a, l) => a + l.gap + s.lh, 0);
    if (top + secH < BODY.y - 4) continue;
    R.text(s.h, BODY.x, y + s.hs * 1.05, s.hs, ACC, DISPLAY, 700, 'left'); y += Math.round(s.hs * 1.5);
    if (s.art) { drawRulesArt(ctx, s.art, PANEL.x + PANEL.w / 2, y + ART_H / 2 - 4, state.t); y += ART_H + Math.round(s.size * 0.3); }
    s.lines.forEach((ln) => { y += ln.gap; R.text(ln.str, BODY.x, y + s.size * 0.95, s.size, '#2a1b12', DISPLAY, 500, 'left'); y += s.lh; });
  }
  ctx.restore();
  if (max > 0) { const th = Math.max(36, BODY.h * BODY.h / F.total), ty = BODY.y + (BODY.h - th) * (scroll / max); ctx.fillStyle = 'rgba(90,60,40,0.45)'; ctx.fillRect(BODY.x + BODY.w + 6, ty, 5, th); }
  R.text(max > 0 ? (scroll >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', rd.pageLbl.x, rd.pageLbl.y, rd.pageLbl.size, ACC, DISPLAY, 600);
  R.text(`Text ${Math.round(z * 100)}%`, rd.zoomLbl.x, rd.zoomLbl.y, rd.zoomLbl.size, '#2a1b12', DISPLAY, 600);
  for (const b of screenButtons(state)) R.button(b);
}

// real board and piece art, in isolation, for the Rules and How to Play pages
function cap(ctx, str, x, y) { ctx.textAlign = 'center'; ctx.font = `500 21px ${DISPLAY}`; ctx.fillStyle = ACC; ctx.fillText(str, x, y); }
function drawRulesArt(ctx, kind, cx, cy, T0) {
  const S = 74;
  if (kind === 'board') {
    [['plain', 0, 'Track'], ['seguro', 0, 'Seguro'], ['salida', 0, 'Salida'], ['lane', 1, 'Home lane']].forEach(([k, a, label], i) => { const x = cx - 3 * 66 + i * 132 + 0; paintCell(ctx, x, cy - 10, S, k, a); cap(ctx, label, x, cy + 52); });
  } else if (kind === 'pieces') {
    [0, 1, 2, 3].forEach((a, i) => { const x = cx - 3 * 66 + i * 132; drawPiece(ctx, a, x, cy + 12, 1.8, Math.abs(Math.sin(T0 * 2 + a)) * 5); cap(ctx, `${SEAT_NAMES[a]}`, x, cy + 52); });
  } else if (kind === 'jail') {
    const w = 200, h = 130, x = cx - w / 2, y = cy - 76;
    const gr = ctx.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, LIGHT[1]); gr.addColorStop(1, SEAT[1]);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = DARK[1]; ctx.beginPath(); ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 14); ctx.fill();
    drawPiece(ctx, 1, cx - 36, cy + 22, 1.5, 0); drawPiece(ctx, 1, cx + 36, cy + 22, 1.5, 0);
    for (let k = 0; k < 7; k++) { const bx = x + 12 + k * ((w - 24) / 6); ctx.fillStyle = 'rgba(230,238,250,0.85)'; ctx.fillRect(bx - 3, y + 6, 6, h - 12); }
    ctx.fillStyle = 'rgba(240,246,255,0.95)'; ctx.fillRect(x + 4, y + 12, w - 8, 7); ctx.fillRect(x + 4, y + h - 20, w - 8, 7);
    cap(ctx, 'The cárcel', cx, cy + 82);
  } else if (kind === 'safe') {
    paintCell(ctx, cx - 110, cy - 14, 84, 'salida', 0); cap(ctx, 'Salida (Yellow)', cx - 110, cy + 54);
    paintCell(ctx, cx + 110, cy - 14, 84, 'seguro', 0); cap(ctx, 'Seguro', cx + 110, cy + 54);
    drawPiece(ctx, 0, cx + 110, cy + 20, 1.1, 0);
  } else if (kind === 'dice' || kind === 'pair') {
    const a = kind === 'pair' ? 4 : 3, b = kind === 'pair' ? 4 : 5;
    drawDie(ctx, cx - 80, cy - 8, -0.15, a, 0, 1); drawDie(ctx, cx + 80, cy - 8, 0.2, b, 0, 1);
    cap(ctx, kind === 'pair' ? 'A pair: both dice equal' : 'Two dice: two separate moves', cx, cy + 66);
  } else if (kind === 'jailfree') {
    paintCell(ctx, cx + 70, cy - 10, 84, 'salida', 0);
    drawPiece(ctx, 1, cx + 70, cy + 6, 1.1, 0, 0.55);
    drawPiece(ctx, 0, cx + 70, cy - 4, 1.4, 22 + Math.abs(Math.sin(T0 * 3)) * 6);
    drawPiece(ctx, 0, cx - 120, cy + 16, 1.4, 0, 0.7);
    ctx.strokeStyle = ACC; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 80, cy - 8); ctx.lineTo(cx - 10, cy - 8); ctx.moveTo(cx - 28, cy - 24); ctx.lineTo(cx - 8, cy - 8); ctx.lineTo(cx - 28, cy + 8); ctx.stroke();
    cap(ctx, 'Freed onto the salida: a rival there is captured', cx, cy + 66);
  } else if (kind === 'barrier') {
    paintCell(ctx, cx, cy - 10, 84, 'plain', 2);
    drawPiece(ctx, 2, cx - 9, cy + 6, 1.15, 0); drawPiece(ctx, 2, cx + 9, cy + 10, 1.15, 0);
    cap(ctx, 'Two Red pieces: a barrier', cx, cy + 66);
  } else if (kind === 'capture') {
    paintCell(ctx, cx + 60, cy - 10, 84, 'plain', 1); paintCell(ctx, cx - 100, cy - 10, 84, 'plain', 0);
    drawPiece(ctx, 1, cx + 60, cy + 6, 1.4, 0); drawPiece(ctx, 0, cx - 100, cy + 6, 1.4, 0);
    ctx.strokeStyle = ACC; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 62, cy - 8); ctx.lineTo(cx + 8, cy - 8); ctx.moveTo(cx - 10, cy - 24); ctx.lineTo(cx + 12, cy - 8); ctx.lineTo(cx - 10, cy + 8); ctx.stroke();
    cap(ctx, 'Yellow lands on Blue: Blue goes to the cárcel', cx, cy + 66);
  } else if (kind === 'lane') {
    for (let k = 0; k < 4; k++) paintCell(ctx, cx - 3 * 56 + k * 56 + 28 - 6, cy - 10, 54, 'lane', 1);
    ctx.save(); ctx.translate(cx + 3 * 56 - 40, cy - 10); ctx.rotate(0); ctx.restore();
    crown(ctx, cx + 3 * 56 - 6, cy - 6, 30);
    cap(ctx, 'Your own lane, then the corona', cx, cy + 56);
  } else if (kind === 'corona') {
    const s = 66;
    for (let a = 0; a < 4; a++) {
      ctx.save(); ctx.translate(cx, cy - 8); ctx.rotate(-a * Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s, s); ctx.lineTo(s, s); ctx.closePath(); ctx.fillStyle = SEAT[a]; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy - 8, 30, 0, TAU); ctx.fillStyle = '#fff7de'; ctx.fill(); ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 3; ctx.stroke();
    crown(ctx, cx, cy - 6, 18);
    cap(ctx, 'The corona: the finish', cx, cy + 82);
  }
}

// ---- title ---------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, state, R) {
  const T0 = state.t, tt = G.tt;
  // the real board as a backdrop, with a showcase position
  const g = TITLE_G;
  ctx.save();
  const demo = { ...state, g, fly: [], hop: null, opts: [], sel: -1, phase: 'title', parts: [], shake: null, jailShake: [0, 0, 0, 0] };
  drawJails(ctx, demo, R); drawPieces(ctx, demo, R);
  ctx.restore();
  if (!G.wide) {
    // fade the lower part into the menu plate, and the top into the title
    const fy = tt.fadeY, gr = ctx.createLinearGradient(0, fy, 0, fy + 80); gr.addColorStop(0, 'rgba(14,8,4,0)'); gr.addColorStop(1, 'rgba(14,8,4,0.95)'); ctx.fillStyle = gr; ctx.fillRect(0, fy, W, 80);
    ctx.fillStyle = 'rgba(14,8,4,0.95)'; ctx.fillRect(0, fy + 80, W, H - fy - 80);
    const grt = ctx.createLinearGradient(0, 0, 0, tt.band.y + 60); grt.addColorStop(0, 'rgba(14,8,4,0.9)'); grt.addColorStop(1, 'rgba(14,8,4,0)'); ctx.fillStyle = grt; ctx.fillRect(0, 0, W, tt.band.y + 60);
  } else {
    // the menu column on the left sits on a dark plate that fades into the table
    const ex = G.col.x + G.col.w + 22, grl = ctx.createLinearGradient(ex - 60, 0, ex + 20, 0); grl.addColorStop(0, 'rgba(14,8,4,0.95)'); grl.addColorStop(1, 'rgba(14,8,4,0)');
    ctx.fillStyle = 'rgba(14,8,4,0.95)'; ctx.fillRect(0, 0, ex - 60, H); ctx.fillStyle = grl; ctx.fillRect(ex - 60, 0, 80, H);
  }
  ctx.save(); ctx.shadowColor = 'rgba(255,200,80,0.6)'; ctx.shadowBlur = 30 + 8 * Math.sin(T0 * 2);
  R.text('Parqués', tt.title.x, tt.title.y, tt.title.size, '#ffe27a', DISPLAY, 700); ctx.restore();
  R.glowText('Salida y Cárcel', tt.sub.x, tt.sub.y, tt.sub.size, '#fff4d6');
  // the little flag-colour band
  for (let k = 0; k < 4; k++) { ctx.fillStyle = SEAT[k]; ctx.beginPath(); ctx.roundRect(tt.band.x - 124 + k * 62, tt.band.y, 56, 8, 4); ctx.fill(); }
  // menu plate
  const pl = tt.plate; plaque(ctx, pl.x, pl.y, pl.w, pl.h);
  const lay = screenLayout(state);
  const reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 8); ctx.clip();
  for (const n of lay.nodes) if (n.k === 'btn') R.button(n);
  ctx.restore();
  if (lay.maxScroll > 0) { const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll); ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 8, ty, 6, th, 3); ctx.fill(); }
  const s = state.stats; R.text(s.played ? `${s.played} played · ${s.wins} won` : (state.demo ? 'Free web preview' : 'Free preview: 90 seconds of play'), tt.stats.x, tt.stats.y, 22, '#c9a86a', DISPLAY, 500);
  drawLockup(ctx, tt.lockup.cx, tt.lockup.cy, tt.lockup.h, Boolean(state.press && state.press.af && !state.press.moved));
}

// ---- end screen --------------------------------------------------------------------------------------------------------------
function drawOver(ctx, state, R, z) {
  const o = state.over; if (!o) return;
  const T0 = state.t;
  scrim(ctx, 0.66);
  for (let i = 0; i < 46; i++) {
    const r = lcg(i * 7919 + 3), x = r() * W, sp = 60 + r() * 120, y = ((T0 * sp + r() * H) % (H + 40)) - 20, rotA = T0 * (1 + r() * 2) + i;
    ctx.save(); ctx.translate(x + Math.sin(T0 + i) * 20, y); ctx.rotate(rotA); ctx.fillStyle = SEAT[i % 4]; ctx.globalAlpha = 0.85; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  drawStack(ctx, state, R, z);
  const c = G.cards.over; if (c.y + c.h + 40 < H) drawMoreLine(ctx, W / 2, c.y + c.h + 34, 22);
}
