// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Field, forts and jails are cached layers (art.js).
// Every position comes from the layout `L` for the live screen size (layout.js); the field is drawn in canonical space (720 x 960)
// through one transform (L.play(scene): scale f, centre cx, cy).
import { CX, CY, CW, CH, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawBackdrop, drawField, drawPole, drawPlayer, TEAM } from './art.js';
import { POLE, JAIL, FORT_R, JAIL_R, TEAM_SIZE, ROUNDS_MAX, WIN_POINTS, LEVELS, ROLES, goalTarget, jailedOf, teamOf } from './engine.js';
import { flowOf } from './pages.js';
import { drawLockup, drawMoreLine } from './brand.js';

const DISPLAY = '"Fredoka", "Trebuchet MS", system-ui, sans-serif', BODY = '"Barlow", "Trebuchet MS", system-ui, sans-serif', NUM = '"Barlow Condensed", "Barlow", system-ui, sans-serif';
const TAU = Math.PI * 2, GOLD = '#ffe27a', CREAM = '#f4fff0', INK = '#0e2a14', PLATE = '8,34,28';
const R4 = (x, y, w, h) => ({ x, y, w, h });

export const reader = { max: 0 };
const flowCache = new Map();

export function render(ctx, state, L, gl = null) { ctx.save(); draw(ctx, state, L, gl); ctx.restore(); }

function draw(ctx, state, L, glIn) {
  const ts = TEXT_SCALES[state.textScaleIdx] ?? 1, bs = Math.min(ts, 1.16), sc = state.scene, t = state.t;
  const gl = glIn && glIn.on && glIn.kind === (sc === 'title' ? 'title' : sc) ? glIn : null;   // the 3D field is drawn behind this canvas
  const W = L.w, H = L.h, FL = L.minText;
  const font = (w, size, fam = BODY) => `${w} ${size}px ${fam}`;
  const text = (str, x, y, size, color = CREAM, align = 'center', weight = 600, fam = BODY) => { ctx.textAlign = align; ctx.font = font(weight, Math.max(size, FL), fam); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fit = (str, maxW, size, weight = 600, fam = BODY) => { let s = size; const lo = FL * 0.85; ctx.font = font(weight, s, fam); while (s > lo && ctx.measureText(str).width > maxW) { s = Math.max(lo, s * 0.93); ctx.font = font(weight, s, fam); } return s; };
  const fitText = (str, x, y, size, maxW, color = CREAM, align = 'center', weight = 600, fam = BODY) => { const s = fit(str, maxW, Math.max(size, FL), weight, fam); ctx.textAlign = align; ctx.font = font(weight, s, fam); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 500) => {
    ctx.font = font(weight, size); const out = [];
    for (const para of String(str).split('\n')) { let cur = ''; for (const w of para.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; } out.push(cur); }
    return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.28, align = 'center', weight = 500) => { size = Math.max(size, FL); const out = lines(str, size, maxW, weight); out.forEach((ln, i) => text(ln, x, y + i * lh, size, color, align, weight)); return out.length; };
  const wrapIn = (str, r, size, color = CREAM, o = {}) => {
    const align = o.align ?? 'center', weight = o.weight ?? 500, pad = o.pad ?? 12, tw = r.w - 2 * pad; let s = Math.max(size, FL), out;
    for (;;) { out = lines(str, s, tw, weight); if (out.length * s * 1.26 <= r.h - 2 * (o.vpad ?? 6) || s <= FL) break; s = Math.max(FL, s * 0.94); }
    const lh = s * 1.26, total = out.length * lh, y0 = o.vc ? r.y + (r.h - total) / 2 : r.y + (o.vpad ?? 6);
    const x = align === 'center' ? r.x + r.w / 2 : align === 'left' ? r.x + pad : r.x + r.w - pad;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    out.forEach((ln, i) => text(ln, x, y0 + s * 0.92 + i * lh, s, color, align, weight)); ctx.restore(); return s;
  };
  const shadowText = (str, x, y, size, color, align = 'center', weight = 700, maxW = 0, fam = DISPLAY) => { const s = maxW ? fit(str, maxW, Math.max(size, FL), weight, fam) : size; text(str, x + 2, y + 4, s, 'rgba(0,18,8,0.6)', align, weight, fam); text(str, x, y, s, color, align, weight, fam); };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const press = o.press ? 3 : 0, rad = Math.min(r.h * 0.5, 34);
    ctx.fillStyle = 'rgba(0,20,8,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#fff29a'); gr.addColorStop(0.55, '#ffcc33'); gr.addColorStop(1, '#f0a000'); }
    else if (o.hot) { gr.addColorStop(0, '#ff9ab4'); gr.addColorStop(1, '#d4244e'); }
    else { gr.addColorStop(0, o.tone ?? '#2a6a58'); gr.addColorStop(1, '#123f33'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,252,220,0.95)' : o.hot ? 'rgba(255,225,230,0.9)' : 'rgba(170,240,210,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const want = (o.size ?? (r.h > 80 ? 32 : 26)) * (o.noscale ? 1 : Math.min(bs, 1.08)), sub = o.sub && r.h >= 74 ? o.sub : '';
    const s = label ? fit(label, r.w - 26, want, 600, DISPLAY) : want, cy = r.y + press + (sub ? r.h * 0.42 : r.h / 2);
    if (label) text(label, r.x + r.w / 2, cy + s * 0.34, s, o.primary ? INK : CREAM, 'center', 600, DISPLAY);
    if (sub) { ctx.font = font(600, FL); if (ctx.measureText(sub).width <= r.w - 20) text(sub, r.x + r.w / 2, r.y + r.h - 14, FL, o.primary ? 'rgba(14,42,20,0.72)' : 'rgba(244,255,240,0.7)', 'center', 600); }
    ctx.restore();
  };
  const panel = (r, a = 0.8, rad = 26) => { ctx.fillStyle = `rgba(${PLATE},${a})`; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = 'rgba(160,240,200,0.4)'; ctx.lineWidth = 2; ctx.stroke(); };
  let turned = false;   // the field is drawn a quarter turn (landscape): text inside it is turned back so it reads upright
  const inCourt = (cx, cy, f, shake, fn, rot = false) => { ctx.save(); ctx.translate(cx + (shake?.x ?? 0), cy + (shake?.y ?? 0)); if (rot) ctx.rotate(Math.PI / 2); ctx.scale(f, f); ctx.translate(-CX, -CY); turned = rot; fn(); turned = false; ctx.restore(); };
  const ctext = (str, x, y, ...a) => { if (!turned) { text(str, x, y, ...a); return; } ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); text(str, 0, 0, ...a); ctx.restore(); };
  const dotted = (pts, color, w, dash, gap) => { ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([dash, gap]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore(); };

  // ---------------------------------------------------------------- the field scene (title attract, play, auto)
  // o: { w (world), sel, hint, guide, me ('H' team the viewer controls or null), shake }
  const fieldScene = (w, o) => {
    const calm = state.calm;
    drawField(ctx);
    // rank of everybody in the open, by leaving order (1 = left first)
    const open = w.players.filter((p) => p.st === 'out').sort((a, b) => a.stamp - b.stamp), rank = new Map(open.map((p, i) => [p.id, i + 1]));
    const sel = o.sel >= 0 ? w.players[o.sel] : null;
    // jail contents
    for (const team of ['H', 'C']) { const n = jailedOf(w, team).length; if (n) { const j = JAIL[team]; ctext(`${n}`, j.x, j.y + JAIL_R + 30, 24, TEAM[team].light, 'center', 800, NUM); } }
    drawPole(ctx, 'C', t, 0); drawPole(ctx, 'H', t, 0);
    // guide rings: who the picked player can tag (green) and who can tag him (red)
    if (sel && sel.st === 'out' && o.guide) {
      for (const e of w.players) if (e.team !== sel.team && e.st === 'out') {
        const can = sel.stamp > e.stamp;
        ctx.save(); ctx.strokeStyle = can ? 'rgba(160,255,150,0.95)' : 'rgba(255,110,110,0.95)'; ctx.lineWidth = 4; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(e.x, e.y, 24, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
    // the picked player's goal
    if (sel && sel.goal && o.me === sel.team) {
      const tg = goalTarget(w, sel);
      if (tg) { dotted([[sel.x, sel.y], [tg.x, tg.y]], 'rgba(255,255,255,0.9)', 4, 3, 10); ctx.save(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tg.x, tg.y, 14 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke(); ctx.restore(); }
    }
    // people, back to front
    const items = [];
    for (const p of w.players) {
      if (p.st === 'jail') { items.push({ y: p.y, d: () => drawPlayer(ctx, p.x, p.y, { team: p.team, k: p.k, ang: p.moving ? p.ang : p.team === 'H' ? Math.PI : 0, phase: p.phase, moving: p.moving, alpha: 0.92, scale: 0.92 }) }); continue; }
      items.push({ y: p.y, d: () => {
        const isSel = sel && sel.id === p.id;
        if (isSel) { const a = 0.6 + 0.35 * Math.sin(t * 6); ctx.strokeStyle = `rgba(255,236,120,${a})`; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(p.x, p.y + 2, 30, 0, TAU); ctx.stroke(); }
        drawPlayer(ctx, p.x, p.y, { team: p.team, k: p.k, ang: p.ang, phase: p.phase, moving: p.moving, alpha: p.st === 'return' ? 0.6 : 1 });
        const n = rank.get(p.id);
        if (n) {
          ctx.save(); ctx.fillStyle = 'rgba(8,30,22,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y - 34, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = TEAM[p.team].main; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
          ctext(String(n), p.x, p.y - 28, 19, '#fff', 'center', 800, NUM);
        }
      } });
    }
    items.sort((a, b) => a.y - b.y).forEach((it) => it.d());
    // the hint marker
    if (o.hint) {
      const hp = w.players[o.hint.id], tg = hp && goalTarget(w, { ...hp, goal: o.hint.goal });
      if (tg && hp) {
        const a = 0.55 + 0.4 * Math.sin(t * 7);
        dotted([[hp.x, hp.y], [tg.x, tg.y]], 'rgba(255,240,140,0.95)', 5, 4, 9);
        ctx.save(); ctx.strokeStyle = `rgba(255,236,120,${a})`; ctx.fillStyle = `rgba(255,236,120,${a * 0.28})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tg.x, tg.y, 30, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    // effects
    for (const f of state.fx) {
      const a = f.t / f.dur;
      if (f.type === 'ring') { ctx.strokeStyle = `rgba(255,252,220,${0.85 * (1 - a)})`; ctx.lineWidth = 5 * (1 - a) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, (10 + a * 60 * f.s) * (calm ? 0.6 : 1), 0, TAU); ctx.stroke(); }
      else if (f.type === 'dust') { ctx.fillStyle = `rgba(255,248,200,${0.55 * (1 - a)})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 5 + a * 9, 0, TAU); ctx.fill(); }
      else if (f.type === 'pop') { ctx.globalAlpha = Math.min(1, 2 - a * 2); ctext(f.text, Math.max(110, Math.min(CW - 110, f.x)), f.y - 40 - a * 50, 40, f.color ?? GOLD, 'center', 700, DISPLAY); ctx.globalAlpha = 1; }
    }
  };

  // ---------------------------------------------------------------- the 3D field: only the HUD marks are drawn here (projected through the camera)
  // Rings and the picked player's marker live in the 3D scene (web/view3d/presenter.js); here: freshness numbers, jail counts, goal lines, effects.
  const overlay3d = (w, o) => {
    const sel = o.sel >= 0 ? w.players[o.sel] : null, calm = state.calm;
    const pj = (X, Y, h = 0) => gl.project(X, Y, h);
    const open = w.players.filter((p) => p.st === 'out').sort((a, b) => a.stamp - b.stamp), rank = new Map(open.map((p, i) => [p.id, i + 1]));
    for (const team of ['H', 'C']) { const n = jailedOf(w, team).length; if (n) { const j = JAIL[team], q = pj(j.x, j.y, 1.7); text(`${n}`, q.x, q.y, 24, TEAM[team].light, 'center', 800, NUM); } }
    const line = (a, b, color, wd, dash, gap) => dotted([[a.x, a.y], [b.x, b.y]], color, wd, dash, gap);
    if (sel && sel.goal && o.me === sel.team) {
      const tg = goalTarget(w, sel);
      if (tg) { const a = pj(sel.x, sel.y), b = pj(tg.x, tg.y); line(a, b, 'rgba(255,255,255,0.9)', 4, 3, 10); }
    }
    if (o.hint) {
      const hp = w.players[o.hint.id], tg = hp && goalTarget(w, { ...hp, goal: o.hint.goal });
      if (tg && hp) line(pj(hp.x, hp.y), pj(tg.x, tg.y), 'rgba(255,240,140,0.95)', 5, 4, 9);
    }
    // freshness numbers above the heads of players in the open
    for (const p of [...open].sort((a, b) => a.y - b.y)) {
      const n = rank.get(p.id), q = pj(p.x, p.y, 2.12), u = gl.scaleAt(p.x, p.y) * 34, r = Math.max(11, Math.min(19, u * 0.3));
      ctx.save(); ctx.fillStyle = 'rgba(8,30,22,0.82)'; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = TEAM[p.team].main; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      text(String(n), q.x, q.y + r * 0.38, r * 1.3, '#fff', 'center', 800, NUM);
    }
    // effects, on the ground and above the heads
    for (const f of state.fx) {
      const a = f.t / f.dur;
      if (f.type === 'ring') {
        const rr = (10 + a * 60 * f.s) * (calm ? 0.6 : 1); ctx.strokeStyle = `rgba(255,252,220,${0.85 * (1 - a)})`; ctx.lineWidth = 5 * (1 - a) + 1; ctx.beginPath();
        for (let i = 0; i <= 28; i++) { const q = pj(f.x + Math.cos(i / 28 * TAU) * rr, f.y + Math.sin(i / 28 * TAU) * rr); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
        ctx.stroke();
      } else if (f.type === 'dust') { const q = pj(f.x + f.vx * f.t, f.y + f.vy * f.t, 0.1), u = gl.scaleAt(f.x, f.y); ctx.fillStyle = `rgba(235,226,190,${0.4 * (1 - a)})`; ctx.beginPath(); ctx.arc(q.x, q.y, (2 + a * 4) * u * 1.1, 0, TAU); ctx.fill(); }
      else if (f.type === 'pop') { const q = pj(f.x, f.y, 2.2); ctx.globalAlpha = Math.min(1, 2 - a * 2); text(f.text, Math.max(110, Math.min(CW - 110, q.x)), q.y - 20 - a * 50, 40, f.color ?? GOLD, 'center', 700, DISPLAY); ctx.globalAlpha = 1; }
    }
  };

  // ---------------------------------------------------------------- TITLE
  if (sc === 'title') {
    const T = L.title(false);
    if (gl) { /* the 3D field fills the screen behind */ } else {
      drawBackdrop(ctx, W, H);
      if (state.demo.w) inCourt(T.hero.cx, T.hero.cy, T.hero.sc, null, () => fieldScene(state.demo.w, { sel: -1, hint: null, guide: false, me: null }));
    }
    if (!L.land) {
      const gh = Math.min(T.brand.y + 90, 300), gr = ctx.createLinearGradient(0, 0, 0, gh); gr.addColorStop(0, `rgba(${PLATE},0.55)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, gh);
      const d = T.dim, gr2 = ctx.createLinearGradient(0, d.y - 70, 0, d.y); gr2.addColorStop(0, `rgba(${PLATE},0)`); gr2.addColorStop(1, `rgba(${PLATE},0.8)`); ctx.fillStyle = gr2; ctx.fillRect(0, d.y - 70, W, 70); ctx.fillStyle = `rgba(${PLATE},0.8)`; ctx.fillRect(0, d.y, W, d.h + 2);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, `rgba(${PLATE},0.55)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, T.card.x, 200);
      panel(T.card, 0.88);
    }
    const tt = T.titleText;
    ctx.save(); const tg = ctx.createLinearGradient(0, tt.y - tt.size * 0.8, 0, tt.y); tg.addColorStop(0, '#fffbc0'); tg.addColorStop(0.5, '#ffd93a'); tg.addColorStop(1, '#f59a00');
    ctx.font = font(700, tt.size * 0.92, DISPLAY); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,20,8,0.7)'; ctx.fillText('BENTENGAN', tt.x + 3, tt.y + 5); ctx.fillStyle = tg; ctx.fillText('BENTENGAN', tt.x, tt.y); ctx.restore();
    fitText('Two forts, one rule: the later leaver wins', T.tag.x, T.tag.y, T.tag.size, L.land ? (T.card.x - 16 - L.U.x0) - 40 : W - 40, 'rgba(235,255,225,0.95)', 'center', 600);
    { const bh = T.brand.w * 0.2725; ctx.save(); ctx.fillStyle = 'rgba(4,16,24,0.62)'; ctx.beginPath(); ctx.roundRect(T.brand.x - T.brand.w / 2 - 10, T.brand.y - bh / 2 - 6, T.brand.w + 20, bh + 12, (bh + 12) / 2); ctx.fill(); ctx.restore(); }
    drawLockup(ctx, T.brand.x, T.brand.y + (state.lkDown ? 1 : 0), T.brand.w * (state.lkDown ? 0.96 : 1), state.lkDown ? 0.7 : 1);
    const B = T.rows;
    button(B.play, 'Play the computer', { primary: true, size: 34, sub: state.stats.played ? `Matches won ${state.stats.wins} of ${state.stats.played}` : `First to ${WIN_POINTS} rounds` });
    button(B.level, 'Level: ' + LEVELS[state.level].name, { size: 26 });
    button(B.auto, 'Auto Play', { size: 26 });
    button(B.howto, 'How to play', { size: 22 }); button(B.about, 'About', { size: 22 }); button(B.rules, 'Game Rules', { size: 22 });
    button(B.settings, 'Settings', { size: 26 });
    if (state.dev) text('dev', T.dev.x, T.dev.y, 20, '#9f9', 'right');
    return;
  }

  // ---------------------------------------------------------------- PAGES
  const backdrop = () => { drawBackdrop(ctx, W, H, 0.1); ctx.fillStyle = `rgba(${PLATE},0.6)`; ctx.fillRect(0, 0, W, H); };
  if (sc === 'howto' || sc === 'about' || sc === 'rules') {
    backdrop();
    const RD = L.reader;
    panel(RD.panel, 0.92);
    const heading = sc === 'about' ? 'About' : sc === 'rules' ? 'Game Rules' : 'How to play';
    shadowText(heading, RD.title.x, RD.title.y + 14, 38, GOLD, 'left', 700, RD.dec.x - RD.title.x - 12);
    button(RD.dec, 'A−', { dim: state.textScaleIdx === 0, size: 30, noscale: true });
    button(RD.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30, noscale: true });
    const vp = RD.viewport, tw = RD.textW, x0 = vp.x + 4, cxv = vp.x + vp.w / 2;
    const fkey = `${sc}|${ts}|${Math.round(tw)}|${state.lic ? state.lic.length : 0}`;
    let F = flowCache.get(fkey);
    if (!F) {
      const items = []; let y = 4;
      for (const sec of flowOf(sc, state.lic)) {
        const tsz = 36 * Math.min(ts, 1.2), tlh = tsz * 1.15, tl = lines(sec.name, tsz, tw, 700);
        items.push({ k: 'rtitle', y, lines: tl, size: tsz, lh: tlh }); y += tl.length * tlh + 18;
        if (sec.illus) { items.push({ k: 'illus', y, which: sec.illus }); y += 250 * Math.min(1, tw / 568) + 14; }
        for (const item of sec.items) {
          if (item.h) { const sz = 31 * ts, lh = sz * 1.18, ls = lines(item.h, sz, tw, 700); items.push({ k: 'text', y, lines: ls, size: sz, lh, color: GOLD, weight: 700 }); y += ls.length * lh + 10; }
          else { const sz = 28 * ts, ls = lines(item.t, sz, tw, 500); items.push({ k: 'text', y, lines: ls, size: sz, lh: 39 * ts, color: CREAM }); y += ls.length * 39 * ts + 16; }
        }
        y += 30;
      }
      F = { items, total: y }; flowCache.set(fkey, F); if (flowCache.size > 30) flowCache.delete(flowCache.keys().next().value);
    }
    const items = F.items, y = F.total, max = Math.max(0, y + 6 - vp.h); reader.max = max;
    const off = Math.min(Math.max(0, state.scroll || 0), max);
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 4, vp.y, vp.w + 8, vp.h); ctx.clip(); ctx.translate(0, vp.y - off);
    for (const it of items) {
      if (it.y - off > vp.h + 400 || it.y - off < -1400) continue;
      if (it.k === 'text') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, it.color, 'left', it.weight ?? 500));
      else if (it.k === 'rtitle') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, GOLD, 'left', 700));
      else if (it.k === 'illus') illus(it.which, cxv, it.y, Math.min(1, tw / 568));
    }
    ctx.restore();
    if (max > 0) { const sb = RD.scrollbar, th = Math.max(36, sb.h * vp.h / (vp.h + max)), ty = sb.y + (sb.h - th) * (off / max); ctx.fillStyle = 'rgba(220,255,230,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,226,122,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill(); }
    text(max > 0 ? (off >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', RD.counter.x, RD.counter.y, 22, 'rgba(244,255,240,0.7)');
    button(RD.nav.prev, 'Top', { dim: off < 4, size: 24 });
    button(RD.nav.next, 'More', { dim: off >= max - 2, size: 24 });
    button(RD.nav.back, 'Done', { primary: true, size: 26 });
    return;
  }
  if (sc === 'settings') {
    backdrop(); const S0 = L.settings, rows = S0.rows;
    shadowText('Settings', S0.title.x, S0.title.y, S0.title.size * 0.8, GOLD);
    const items = [
      ['Sound', state.sound ? 'On' : 'Off', state.sound],
      ['Reduced motion', state.calm ? 'On' : 'Off', state.calm],
      ['Text size', Math.round((TEXT_SCALES[state.textScaleIdx] ?? 1) * 100) + '%', state.textScaleIdx > 0],
      ['Left-handed layout', state.left ? 'On' : 'Off', state.left],
      ['Rival rings', state.guide ? 'On' : 'Off', state.guide],
      ...(state.demoMode ? [] : [state.owned ? ['Full game unlocked', '', true] : ['Restore purchase', state.restore.busy ? 'Checking' : state.restore.msg, state.restore.msg === 'Restored']]),
    ];
    items.forEach((it, i) => {
      const r = rows[i]; button(r, '', { size: 28 }); const vw = it[1] ? 130 : 0;
      fitText(it[0], r.x + 28, r.y + r.h / 2 + 10, 28, r.w - 56 - vw, CREAM, 'left', 700);
      if (it[1]) fitText(it[1], r.x + r.w - 28, r.y + r.h / 2 + 10, 28, vw, it[2] ? '#9cf29a' : GOLD, 'right', 700);
    });
    if (S0.noteFits) text('Tap a row to change it.', S0.note.x, S0.note.y, 24, 'rgba(244,255,240,0.7)');
    button(S0.done, 'Done', { primary: true, size: 28 }); return;
  }
  if (sc === 'demo-limit') {
    backdrop(); const D = L.demo; shadowText('Enjoying the preview?', D.title.x, D.title.y, D.title.size * 0.7, GOLD, 'center', 700, L.U.w - 40);
    wrap('The free web preview ends here. Get the full game on iPhone and Android for unlimited matches at all three levels.', D.body.x, D.body.y, 30, D.body.w, CREAM, 42); button(D.back, 'Back', { primary: true, size: 28 }); return;
  }

  // ---------------------------------------------------------------- PLAY / AUTO
  const P = L.play(sc), w = state.w, m = state.match, auto = sc === 'auto';
  if (gl) overlay3d(w, { sel: state.sel, hint: state.hint, me: auto ? null : 'H' });
  else {
    drawBackdrop(ctx, W, H);
    inCourt(P.cx, P.cy, P.f, state.shake, () => fieldScene(w, { sel: state.sel, hint: state.hint, guide: state.guide && !auto, me: auto ? null : 'H' }), P.rot);
  }
  const nameH = auto ? 'Pink team' : 'You', nameC = auto ? 'Blue team' : 'Computer';
  const card = (r, key, name, active) => {
    const rad = Math.min(24, r.h * 0.2), pad = Math.min(16, r.w * 0.06);
    ctx.save(); if (active) { ctx.shadowColor = 'rgba(255,230,120,0.8)'; ctx.shadowBlur = state.calm ? 12 : 14 + Math.sin(t * 4) * 5; }
    ctx.fillStyle = `rgba(${PLATE},0.88)`; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.restore();
    ctx.strokeStyle = active ? 'rgba(255,226,122,0.95)' : 'rgba(160,240,200,0.3)'; ctx.lineWidth = active ? 3 : 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.stroke();
    const row1 = r.y + r.h * 0.3, row2 = r.y + r.h * 0.58, row3 = r.y + r.h * 0.84, T = TEAM[key];
    ctx.fillStyle = T.main; ctx.beginPath(); ctx.arc(r.x + pad + 14, row1 - 4, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = T.light; ctx.lineWidth = 2; ctx.stroke();
    const nx = r.x + pad + 38, sw = Math.min(88, r.w * 0.26);
    fitText(name, nx, row1 + 8, 28 * Math.min(bs, 1.1), r.w - (nx - r.x) - sw - pad - 6, CREAM, 'left', 700);
    text(String(m.score[key]), r.x + r.w - pad, row1 + 14, 56 * Math.min(bs, 1.05), GOLD, 'right', 800, NUM);
    const free = teamOf(w, key).filter((p) => p.st !== 'jail').length, jail = TEAM_SIZE - free;
    fitText(jail ? `${jail} in jail` : 'All free', r.x + pad, row2 + 8, 21 * Math.min(bs, 1.1), r.w - 2 * pad, 'rgba(244,255,240,0.85)', 'left', 600);
    // one dot per player: filled = in the fort, ring = in the open, cross = jailed
    const sp = Math.min(46, (r.w - 2 * pad) / TEAM_SIZE);
    teamOf(w, key).forEach((p, k) => {
      const cx = r.x + pad + 14 + k * sp;
      if (p.st === 'jail') { ctx.strokeStyle = '#ff8a8a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 7, row3 - 7); ctx.lineTo(cx + 7, row3 + 7); ctx.moveTo(cx + 7, row3 - 7); ctx.lineTo(cx - 7, row3 + 7); ctx.stroke(); }
      else if (p.st === 'out') { ctx.strokeStyle = T.main; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, row3, 9, 0, TAU); ctx.stroke(); }
      else { ctx.fillStyle = T.light; ctx.beginPath(); ctx.arc(cx, row3, 9, 0, TAU); ctx.fill(); }
    });
  };
  const live = state.stage === 'live' && !w.result;
  card(P.cards.H, 'H', nameH, live); card(P.cards.C, 'C', nameC, live);
  // ---- progress strip: round, clock; the toast takes its place for a few seconds
  {
    const r = P.strip, mg = state.msg;
    panel(r, 0.82, 20);
    const pad = 14, rn = Math.max(1, Math.min(ROUNDS_MAX, state.stage === 'result' || state.stage === 'over' ? m.n : m.n + 1));
    if (mg) { const a = Math.min(1, (mg.hold - mg.t) * 2, mg.t * 6 + 0.2); ctx.globalAlpha = Math.max(0, a); wrapIn(mg.text, r, 22 * bs, CREAM, { vc: true }); ctx.globalAlpha = 1; }
    else {
      text(auto ? 'Auto round' : `Round ${rn}/${ROUNDS_MAX}`, r.x + pad, r.y + r.h / 2 + 8, 21 * Math.min(bs, 1.1), CREAM, 'left', 700);
      const left = Math.max(0, w.clock / w.roundTime), bx = r.x + pad + 128 * Math.min(bs, 1.1) + 8, bw = r.x + r.w - pad - 64 - bx;
      if (bw > 30) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, r.y + r.h / 2 - 5, bw, 10, 5); ctx.fill(); ctx.fillStyle = left < 0.25 ? '#ff7a8a' : '#a6ff9a'; ctx.beginPath(); ctx.roundRect(bx, r.y + r.h / 2 - 5, Math.max(8, bw * left), 10, 5); ctx.fill(); }
      text(String(Math.ceil(w.clock)), r.x + r.w - pad, r.y + r.h / 2 + 9, 24 * Math.min(bs, 1.1), GOLD, 'right', 800, NUM);
    }
  }
  // ---- buttons
  if (sc === 'play') {
    const pb = P.btn, selp = w.players[state.sel];
    button(pb.menu, 'Menu', { size: 26 });
    button(pb.hint, state.hint ? 'Play it' : state.hintsLeft > 0 ? `Hint ${state.hintsLeft}` : 'Hint', { size: 26, dim: (state.hintsLeft <= 0 && !state.hint) || state.stage !== 'live', primary: !!state.hint });
    button(pb.act, selp ? `Switch` : 'Switch', { size: 28, dim: state.stage !== 'live', sub: selp && selp.st !== 'jail' ? ROLES[selp.k] : '' });
  } else if (auto && state.auto) {
    const pb = P.btn, A = state.auto, AU = P.auto, ended = state.stage === 'result' || state.stage === 'over';
    button(pb.menu, 'Exit', { size: 26 });
    if (!ended) button(pb.hint, A.paused ? 'Resume' : 'Pause', { size: 26 });
    if (!ended) button(pb.act, 'Skip', { size: 26, dim: A.sub !== 'think' && A.sub !== 'reveal' });
    panel(AU.bar, 0.82, 22);
    const why = A.dec ? A.dec.why : '';
    const label = A.paused ? 'Paused' : A.sub === 'think' ? A.what + ' · thinking' : A.sub === 'reveal' ? A.what + ' · ' + why : ended ? 'Round complete' : 'Watch the play';
    const lw = L.land ? AU.bar.w - 24 : AU.think.x - AU.label.x - 130;
    fitText(label, AU.label.x, AU.label.y + 9, 24, L.land ? lw : Math.max(120, lw), A.paused ? '#ffd08a' : GOLD, AU.label.align, 700);
    fitText(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, AU.think.x, AU.think.y + 8, 22, L.land ? AU.inc.x - AU.dec.x - AU.dec.w - 16 : 150, CREAM, AU.think.align, 600);
    button(AU.dec, '-', { size: 30, noscale: true, dim: state.autoThinkIdx === 0 }); button(AU.inc, '+', { size: 30, noscale: true, dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
  }
  // ---- intro banner
  if (state.stage === 'intro') {
    ctx.fillStyle = `rgba(${PLATE},0.6)`; ctx.fillRect(0, 0, W, H);
    const cy = H / 2 - 40, bw = Math.min(W - 40, 640), rn = Math.min(ROUNDS_MAX, m.n + 1);
    panel(R4(W / 2 - bw / 2, cy - 110, bw, 250), 0.92);
    text(auto ? 'Auto Play' : `Round ${rn} of ${ROUNDS_MAX} · first to ${WIN_POINTS}`, W / 2, cy - 50, 28, 'rgba(244,255,240,0.85)', 'center', 700);
    shadowText(auto ? 'Watch and learn' : 'Guard your pole!', W / 2, cy + 26, 52, GOLD, 'center', 700, bw - 40);
    wrap(auto ? 'Two computer teams play. You see why each move is chosen.' : 'The player who left the fort LATER wins the meeting. Touch the rival pole to win.', W / 2, cy + 82, 25, bw - 60, CREAM, 32);
  }
  // ---- overlays
  const dim = (a) => { ctx.fillStyle = `rgba(${PLATE},${a})`; ctx.fillRect(0, 0, W, H); };
  if (state.menu) {
    const M = L.menu; dim(0.78); shadowText('Paused', M.title.x, M.title.y, M.title.size * 0.8, GOLD);
    button(M.resume, 'Resume', { primary: true, size: 30 }); button(M.restart, 'New match', { size: 30 }); button(M.settings, 'Settings', { size: 30 }); button(M.quit, 'Leave', { size: 30 });
  }
  const who = (k) => (auto ? (k === 'H' ? 'Pink' : 'Blue') : (k === 'H' ? 'You' : 'The computer'));
  if (state.stage === 'result' && w.result) {
    dim(0.62); const D = L.dialog('inning'), r = w.result, last = m.over;
    const title = r.kind === 'pole' ? 'Pole touched!' : r.kind === 'sweep' ? 'All caught' : r.winner === 'draw' ? 'Drawn round' : 'Time up';
    panel(D.panel, 0.94);
    shadowText(title, D.title.x, D.title.y, 56, r.winner === 'H' || r.winner === 'draw' ? GOLD : '#ff9fb4', 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    const why = r.kind === 'pole' ? `${who(r.winner)} touched the rival pole: 1 point.` : r.kind === 'sweep' ? `${who(r.winner === 'H' ? 'C' : 'H')} had all ${TEAM_SIZE} players in jail. ${who(r.winner)} score 1 point.` : r.winner === 'draw' ? `Time ran out with ${r.jh} prisoners each. No point.` : `Time ran out. ${who(r.winner)} held more prisoners: 1 point.`;
    wrapIn(why, R4(D.body.x - D.body.w / 2, D.body.y, D.body.w, 90), 27, CREAM, { vc: true });
    fitText(`${nameH} ${m.score.H}  –  ${m.score.C} ${nameC}`, D.body.x, D.body.y + 128, 36, D.body.w, GOLD, 'center', 800, NUM);
    button(D.btns[0], last ? 'See result' : (auto ? 'Close' : 'Next round'), { primary: true, size: 30 }); button(D.btns[1], auto ? 'Exit' : 'Menu', { size: 26 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }
  if (state.stage === 'over' && m.over) {
    dim(0.7); const D = L.dialog('over'), o = m.over, win = o.winner === 'H';
    if (win && !state.calm && sc === 'play') for (let i = 0; i < 26; i++) { const a = i * 2.4 + t * 0.6, y = (t * 90 + i * 53) % H, x = W / 2 + Math.cos(a + i) * (W * 0.46); ctx.fillStyle = i % 2 ? TEAM.H.main : '#ffe27a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); }
    panel(D.panel, 0.95);
    const title = o.winner === 'draw' ? 'A draw' : auto ? (win ? 'Pink wins' : 'Blue wins') : win ? 'You win!' : 'The computer wins';
    shadowText(title, D.title.x, D.title.y, 56, GOLD, 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    fitText(`${nameH} ${m.score.H}  –  ${m.score.C} ${nameC}`, D.body.x, D.body.y + 36, 42, D.body.w, CREAM, 'center', 800, NUM);
    const kinds = { pole: 'pole touched', sweep: 'all caught', time: 'time up' };
    const logLines = m.log.map((e, i) => `Round ${i + 1}: ${e.winner === 'draw' ? 'drawn' : who(e.winner) + ' won'}, ${kinds[e.kind]}`).join('\n');
    wrapIn(logLines, R4(D.body.x - D.body.w / 2, D.body.y + 58, D.body.w, D.body.h - 40), 22, 'rgba(244,255,240,0.85)', { vc: true });
    button(D.btns[0], auto ? 'Watch again' : 'Play again', { primary: true, size: 30 }); button(D.btns[1], auto ? 'Exit' : 'Menu', { size: 26 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }

  // ---- small illustrations for the How to play page
  function illus(which, cx, y, k) {
    ctx.save(); ctx.translate(cx - 284 * k, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(120,200,90,0.35)'; ctx.beginPath(); ctx.roundRect(0, 0, 568, 240, 18); ctx.fill();
    const H0 = { team: 'H', k: 0, ang: -Math.PI / 2, phase: 0, moving: false }, C0 = { team: 'C', k: 1, ang: Math.PI / 2, phase: 0, moving: false };
    const badge = (x, yy, n, team) => { ctx.fillStyle = 'rgba(8,30,22,0.85)'; ctx.beginPath(); ctx.arc(x, yy, 16, 0, TAU); ctx.fill(); ctx.strokeStyle = TEAM[team].main; ctx.lineWidth = 3; ctx.stroke(); text(String(n), x, yy + 7, 21, '#fff', 'center', 800, NUM); };
    if (which === 'move') {
      drawPlayer(ctx, 110, 190, { ...H0, scale: 1.2 }); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(110, 192, 32, 0, TAU); ctx.stroke();
      dotted([[130, 170], [420, 70]], '#fff', 4, 3, 10); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(430, 66, 16, 0, TAU); ctx.stroke();
      text('1  tap a player', 150, 36, 24, GOLD, 'left', 700); text('2  tap where to go', 330, 226, 24, GOLD, 'left', 700);
    } else if (which === 'fresh') {
      drawPlayer(ctx, 170, 150, { ...H0, scale: 1.2 }); drawPlayer(ctx, 400, 110, { ...C0, scale: 1.2 }); badge(170, 112, 2, 'H'); badge(400, 72, 1, 'C');
      ctx.strokeStyle = '#a6ff9a'; ctx.lineWidth = 4; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(400, 112, 28, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      text('higher number tags lower', 284, 214, 26, GOLD, 'center', 700);
    } else if (which === 'jail') {
      ctx.fillStyle = '#e4cb7a'; ctx.beginPath(); ctx.roundRect(400, 60, 110, 110, 12); ctx.fill(); ctx.strokeStyle = TEAM.H.main; ctx.lineWidth = 5; ctx.stroke();
      drawPlayer(ctx, 430, 100, { ...H0, k: 2, scale: 0.9 }); drawPlayer(ctx, 478, 130, { ...H0, k: 3, scale: 0.9 });
      drawPlayer(ctx, 130, 170, { ...H0, scale: 1.2 }); dotted([[150, 150], [395, 120]], '#fff', 4, 3, 10);
      text('touch your jail to free them', 284, 222, 24, GOLD, 'center', 700);
    }
    ctx.restore();
  }
  void CH; void POLE; void FORT_R;
}
