// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Board, table and pieces are cached sprites (art.js).
import { W, H, K, CX, CY, PLAY, sx, sy, BX, BY, METER, PLAYB, MENU, OVER, LESSONB, PAGE, BACK, titleButtons, settingRows, lessonRows } from './layout.js';
import { drawTable, drawBoardOnly, drawPiece, THEMES, THEME_KEYS } from './art.js';
import { S, R_COIN, R_STR, BASE_Y, BASE_X0, BASE_X1, POCKETS, trace, striker as findStriker } from './physics.js';
import { down, onBoard, SIDE_NAME } from './rules.js';
import { AI_LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT, RULES_PAGE, CONTROLS_PAGE, GAME_RULES } from './pages.js';

const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif', TAU = Math.PI * 2;
const GOLD = '#f6d58a', CREAM = '#fff3d6';

export function render(ctx, state) {
  ctx.save(); if (state.shake > 0.3) ctx.translate(Math.sin(state.t * 91) * state.shake, Math.cos(state.t * 77) * state.shake);
  draw(ctx, state); ctx.restore();
}
function draw(ctx, state) {
  const bs = state.big ? 1.16 : 1, sc = state.scene, t = state.t, g = state.g;
  const text = (str, x, y, size, color = CREAM, align = 'center', weight = 600) => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.28, align = 'center', weight = 500) => {
    ctx.font = `${weight} ${size}px ${FONT}`; const out = []; let cur = '';
    for (const para of String(str).split('\n')) { cur = ''; for (const w of para.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; } out.push(cur); }
    out.forEach((ln, i) => text(ln, x, y + i * lh, size, color, align, weight)); return out.length;
  };
  const shadowText = (str, x, y, size, color, align = 'center', weight = 700) => { text(str, x + 2, y + 4, size, 'rgba(0,0,0,0.55)', align, weight); text(str, x, y, size, color, align, weight); };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const press = o.press ? 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, r.h * 0.3); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffe08e'); gr.addColorStop(0.5, '#f0b445'); gr.addColorStop(1, '#c47f1c'); }
    else { gr.addColorStop(0, o.tone ?? '#7d4a25'); gr.addColorStop(1, '#3f2210'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, r.h * 0.3); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,200,0.9)' : 'rgba(255,214,150,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, r.h * 0.3); ctx.clip();
    const hg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.55); hg.addColorStop(0, 'rgba(255,255,255,0.32)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hg; ctx.fillRect(r.x, r.y + press, r.w, r.h * 0.55); ctx.restore();
    const size = (o.size ?? (r.h > 80 ? 38 : 30)) * (o.noscale ? 1 : Math.min(bs, 1.08));
    text(label, r.x + r.w / 2, r.y + press + (o.sub ? r.h * 0.44 : r.h / 2) + size * 0.34, size, o.primary ? '#3a1e05' : CREAM, 'center', 700);
    if (o.sub) text(o.sub, r.x + r.w / 2, r.y + r.h - 15, 20, o.primary ? 'rgba(58,30,5,0.7)' : 'rgba(255,243,214,0.65)', 'center', 500);
    ctx.restore();
  };
  const panel = (x, y, w, h, a = 0.8) => { ctx.fillStyle = `rgba(22,11,5,${a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 2; ctx.stroke(); };
  const coinAt = (k, px, py, s = 1, lift = 0, alpha = 1) => drawPiece(ctx, k, px, py, s, lift, alpha);

  // pieces of a world, with a pulse for pieces that just moved
  const drawWorld = (world, opts = {}) => {
    for (const b of world) if (b.on && b.k !== 'S') coinAt(b.k, sx(b.x), sy(b.y), 1, 0);
    for (const b of world) if (b.on && b.k === 'S') coinAt('S', sx(b.x), sy(b.y), 1, opts.lift ?? 0);
  };
  const dotted = (pts, color, w, dash, gap) => {
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([dash, gap]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
  };

  // ---------------------------------------------------------------- TITLE
  if (sc === 'title') {
    drawTable(ctx);
    const scl = 0.88, cy = 532;
    ctx.save(); ctx.translate(CX, cy); ctx.scale(scl, scl); ctx.translate(-CX, -CY);
    drawBoardOnly(ctx, state.theme); drawWorld(state.demo.world);
    for (const f of state.demo.fx) if (f.type === 'drop') { const a = Math.min(1, f.t / f.dur); coinAt(f.k, sx(f.x) + (sx(f.px) - sx(f.x)) * a, sy(f.y) + (sy(f.py) - sy(f.y)) * a, 1 - a * 0.6, 0, 1 - a); }
    ctx.restore();
    const gr = ctx.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, 'rgba(10,4,0,0.8)'); gr.addColorStop(1, 'rgba(10,4,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 260);
    const gr2 = ctx.createLinearGradient(0, 780, 0, 860); gr2.addColorStop(0, 'rgba(10,4,0,0)'); gr2.addColorStop(1, 'rgba(10,4,0,0.85)'); ctx.fillStyle = gr2; ctx.fillRect(0, 780, W, 80); ctx.fillStyle = 'rgba(10,4,0,0.85)'; ctx.fillRect(0, 860, W, H - 860);
    ctx.save(); const tg = ctx.createLinearGradient(0, 50, 0, 160); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(0.5, '#f4c65c'); tg.addColorStop(1, '#c07d1a');
    ctx.font = `700 140px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('Carrom', CX + 3, 156); ctx.fillStyle = tg; ctx.fillText('Carrom', CX, 152); ctx.restore();
    text('Flick, pocket, cover the queen', CX, 200, 30, 'rgba(255,236,190,0.95)', 'center', 500);
    const B = titleButtons(!!state.saved), lv = AI_LEVELS[state.level].name;
    if (B.resume) button(B.resume, 'Resume board', { primary: true, size: 38 });
    button(B.play, 'Play the computer', { primary: !B.resume, size: 38 });
    button(B.two, 'Two players, one phone');
    button(B.learn, 'Learn to play', { sub: Object.keys(state.learned).length ? `${Object.keys(state.learned).length} of ${LESSONS.length} lessons done` : 'New here? Start with lesson one', tone: Object.keys(state.learned).length ? undefined : '#8e5a2a' });
    button(B.daily, 'Daily trick shot', { sub: state.daily.solvedDay === state.daily.day ? 'Solved today. Streak ' + state.daily.streak : state.daily.puzzle ? 'A new shot is ready' : 'Setting up today’s shot' });
    button(B.level, 'Computer level: ' + lv, { size: 28 });
    button(B.howto, 'How to play', { size: 18 }); button(B.about, 'About', { size: 18 }); button(B.rules, 'Game Rules', { size: 18 }); button(B.settings, 'Settings', { size: 18 });
    if (state.dev) text('dev', 40, 40, 20, '#9f9', 'left');
    return;
  }

  // ---------------------------------------------------------------- PAGES
  const backdrop = () => { drawTable(ctx); ctx.fillStyle = 'rgba(8,3,0,0.55)'; ctx.fillRect(0, 0, W, H); };
  if (sc === 'howto' || sc === 'about') {
    backdrop(); const P = sc === 'about' ? ABOUT : state.page === 0 ? CONTROLS_PAGE : RULES_PAGE;
    shadowText(sc === 'about' ? 'About Carrom' : state.page === 0 ? 'Controls' : 'Rules', CX, 150, 76 * Math.min(bs, 1.05), GOLD);
    panel(40, 200, 640, 1190, 0.78);
    let y = 268;
    for (const item of P) {
      if (item.h) { text(item.h, 76, y, 34 * bs, GOLD, 'left', 700); y += 46 * bs; continue; }
      const n = wrap(item.t, 76, y, 28 * bs, 570, CREAM, 36 * bs, 'left'); y += n * 36 * bs + 16;
    }
    if (sc === 'howto' && state.page === 0) {
      // a small drawing of the gesture: slide, pull back, release
      const oy = 1120; ctx.save(); ctx.fillStyle = 'rgba(232,196,128,0.22)'; ctx.beginPath(); ctx.roundRect(76, oy - 70, 568, 250, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,205,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(100, oy + 110); ctx.lineTo(620, oy + 110); ctx.stroke();
      drawPiece(ctx, 'S', 300, oy + 110, 1.1, 0.1); drawPiece(ctx, 'W', 470, oy - 10, 1, 0);
      dotted([[300, oy + 110], [452, oy + 4]], 'rgba(255,250,235,0.95)', 3.4, 2, 9); ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(470, oy - 10, 16, 0, TAU); ctx.stroke();
      ctx.lineCap = 'round'; ctx.strokeStyle = '#f0a03a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(296, oy + 132); ctx.lineTo(262, oy + 168); ctx.stroke(); ctx.fillStyle = '#fff5d7'; ctx.beginPath(); ctx.arc(258, oy + 172, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = CREAM; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(300 + d * 62, oy + 110); ctx.lineTo(300 + d * 46, oy + 100); ctx.lineTo(300 + d * 46, oy + 120); ctx.fill(); }
      text('1  slide', 200, oy - 32, 24, GOLD, 'center', 700); text('2  drag back', 170, oy + 168, 24, GOLD, 'center', 700); text('3  release', 540, oy + 74, 24, GOLD, 'center', 700); ctx.restore();
    }
    if (sc === 'howto') { button(PAGE.prev, 'Back', { dim: state.page === 0, size: 28 }); button(PAGE.next, 'Next', { dim: state.page === 1, size: 28 }); button(PAGE.back, 'Done', { primary: true, size: 28 }); text(`${state.page + 1} / 2`, CX, 1420, 24, 'rgba(255,243,214,0.7)'); }
    else button(PAGE.back, 'Done', { primary: true, size: 30 });
    return;
  }
  // Exhaustive Game Rules reference (content in pages.js). One topic per page; a piece page shows
  // the real in-game coin/queen/striker art via this game's own drawPiece(), never a separate icon.
  if (sc === 'rules') {
    backdrop();
    const list = GAME_RULES, page = list[state.page % list.length];
    shadowText('Game Rules', CX, 150, 76 * Math.min(bs, 1.05), GOLD);
    panel(40, 200, 640, 1190, 0.78);
    text(page.title, CX, 256, 40 * bs, GOLD, 'center', 700);
    let y = 306;
    if (page.pieces) {
      const ay = 384, names = { W: 'White', B: 'Black', Q: 'Queen', S: 'Striker' };
      if (page.pieces.length === 1) {
        const k = page.pieces[0], base = (k === 'S' ? R_STR : R_COIN) * K, R = 58;
        coinAt(k, CX, ay, R / base, 0); y = ay + R + 40;
      } else {
        const dx = 108, R = 46;
        page.pieces.forEach((k, i) => {
          const px = CX + (i === 0 ? -dx : dx), base = (k === 'S' ? R_STR : R_COIN) * K;
          coinAt(k, px, ay, R / base, 0);
          text(names[k] ?? '', px, ay + R + 32, 20, 'rgba(255,240,205,0.72)', 'center', 600);
        });
        y = ay + R + 78;
      }
    }
    for (const line of page.lines) { const n = wrap(line, 76, y, 28 * bs, 570, CREAM, 36 * bs, 'left'); y += n * 36 * bs + 16; }
    text(`Page ${(state.page % list.length) + 1} of ${list.length}`, CX, 1420, 24, 'rgba(255,243,214,0.7)');
    button(PAGE.prev, 'Back', { size: 28 }); button(PAGE.next, 'Next', { size: 28 }); button(PAGE.back, 'Done', { primary: true, size: 28 });
    return;
  }
  if (sc === 'settings') {
    backdrop(); shadowText('Settings', CX, 150, 76, GOLD); const rows = settingRows();
    const items = [['Sound', state.sound ? 'On' : 'Off'], ['Reduced motion', state.calm ? 'On' : 'Off'], ['Large text', state.big ? 'On' : 'Off'], ['Left-handed layout', state.left ? 'On' : 'Off'], ['Board', THEMES[state.theme].name], ['Aim guide', state.guide === 2 ? 'Long' : state.guide === 1 ? 'Short' : 'Off'], ['Restore purchases', '']];
    items.forEach((it, i) => { const r = rows[i]; button(r, '', { size: 32 }); text(it[0], r.x + 40, r.y + r.h / 2 + 11, 32, CREAM, 'left', 700); const on = it[1] === 'On' || it[1] === 'Long'; text(it[1], r.x + r.w - 40, r.y + r.h / 2 + 11, 32, on ? '#b6f28a' : GOLD, 'right', 700); });
    text('Tap a row to change it.', CX, 1200, 26, 'rgba(255,243,214,0.7)');
    button(PAGE.back, 'Done', { primary: true, size: 30 }); return;
  }
  if (sc === 'lessons') {
    backdrop(); shadowText('Learn to play', CX, 140, 72, GOLD); const rows = lessonRows();
    LESSONS.forEach((l, i) => { const r = rows[i], done = !!state.learned[i], locked = state.demoMode && i >= 3; button(r, `${i + 1}. ${l.title}`, { size: 30, dim: locked, tone: done ? '#4b6a2a' : undefined }); if (done) text('done', r.x + r.w - 34, r.y + r.h / 2 + 10, 26, '#c8f59a', 'right', 700); else if (locked) text('full game', r.x + r.w - 34, r.y + r.h / 2 + 10, 24, GOLD, 'right', 600); });
    button(PAGE.back, 'Back', { primary: true, size: 30 }); return;
  }
  if (sc === 'demo-limit') {
    backdrop(); shadowText('Enjoying the preview?', CX, 470, 66, GOLD); wrap('The free web preview ends here. Get the full game on iPhone and Android for every lesson, all four computer levels, the daily trick shot and unlimited boards.', CX, 560, 34, 560, CREAM, 46); button(PAGE.back, 'Back', { primary: true, size: 30 }); return;
  }

  // ---------------------------------------------------------------- BOARD SCENES
  drawTable(ctx); drawBoardOnly(ctx, state.theme);
  const side = g.turn, human = state.mode === 'two' || side === 'W' || sc !== 'play', phase = state.phase;
  const lifted = state.drag && state.drag.mode === 'aim';

  // pieces
  const world = g.world;
  for (const b of world) if (b.on && b.k !== 'S') coinAt(b.k, sx(b.x), sy(b.y), 1, 0);
  for (const f of state.fx) if (f.type === 'drop') { const a = Math.min(1, f.t / f.dur), e = a * a; coinAt(f.k, sx(f.x) + (sx(f.px) - sx(f.x)) * e, sy(f.y) + (sy(f.py) - sy(f.y)) * e, 1 - e * 0.55, 0, 1 - e * 0.9); }
  // striker: on its baseline while placing, in the world while flying
  const flying = phase === 'fly', st = findStriker(world);
  const showStriker = phase !== 'after' && phase !== 'over' && !(sc === 'play' && g.over);
  const invalid = state.blocked && (phase === 'aim');
  if (flying && st && st.on) coinAt('S', sx(st.x), sy(st.y), 1, 0);
  else if (showStriker && !flying) {
    const x = sx(state.sx), y = sy(BASE_Y[side]);
    if (invalid) { ctx.fillStyle = 'rgba(220,40,30,0.45)'; ctx.beginPath(); ctx.arc(x, y, (R_STR + 5) * K, 0, TAU); ctx.fill(); }
    const bob = state.calm || phase !== 'aim' ? 0 : Math.sin(t * 3) * 0.5;
    coinAt('S', x, y, 1, lifted ? 0.5 : 0.12 + bob * 0.1);
  }
  // baseline slide hint when nothing has been touched yet
  const canPlay = (phase === 'aim') && ((sc === 'play' && (state.mode === 'two' || side === 'W')) || sc === 'lesson' || sc === 'daily');
  if (canPlay && !state.drag && !state.aim && (state.hintPulse ?? 1)) {
    const y = sy(BASE_Y[side]), a = 0.5 + 0.5 * Math.sin(t * 4), x = sx(state.sx);
    ctx.save(); ctx.globalAlpha = state.calm ? 0.8 : 0.45 + a * 0.4; ctx.fillStyle = CREAM;
    for (const d of [-1, 1]) { const ax = x + d * (R_STR * K + 18 + (state.calm ? 0 : a * 6)); ctx.beginPath(); ctx.moveTo(ax + d * 12, y); ctx.lineTo(ax, y - 9); ctx.lineTo(ax, y + 9); ctx.fill(); }
    ctx.restore();
  }
  // aim overlay
  if (state.aim && (phase === 'aim' || phase === 'aiaim' || phase === 'aiplace') ) {
    const y0 = BASE_Y[side], a = state.aim.angle, pw = state.aim.power, dx = Math.cos(a), dy = Math.sin(a), sxu = state.sx;
    const base = world.filter((b) => b.k !== 'S');
    const t1 = trace(base, sxu, y0, dx, dy), p0 = [sx(sxu), sy(y0)];
    const glow = (pts, w, dash, gap, alpha = 1) => { dotted(pts, `rgba(20,8,0,${0.35 * alpha})`, w + 3, dash, gap); dotted(pts, `rgba(255,250,235,${0.95 * alpha})`, w, dash, gap); };
    const segs = [p0, [sx(t1.x), sy(t1.y)]];
    if (state.guide !== 0) {
      const lim = state.guide === 1 ? 0.45 : 1; const cut = (a0, b0) => { const f = lim; return [a0[0] + (b0[0] - a0[0]) * f, a0[1] + (b0[1] - a0[1]) * f]; };
      glow([p0, state.guide === 1 ? cut(p0, segs[1]) : segs[1]], 3.4, 2, 9);
      const cx = sx(t1.x), cy = sy(t1.y);
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,250,235,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R_STR * K, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,250,235,0.14)'; ctx.fill(); ctx.restore();
      if (t1.coin) {
        const c = t1.coin, nx0 = c.x - t1.x, ny0 = c.y - t1.y, d = Math.hypot(nx0, ny0) || 1, nx = nx0 / d, ny = ny0 / d;
        // coin leaves along the line of centres
        const tc = trace(base.filter((b) => b.id !== c.id), c.x, c.y, nx, ny, R_COIN, c.id), len = Math.min(tc.t, 90 + pw * 330);
        const ex = c.x + nx * len, ey = c.y + ny * len;
        glow([[sx(c.x), sy(c.y)], [sx(ex), sy(ey)]], 3.4, 2, 9, 0.95);
        ctx.fillStyle = 'rgba(255,250,235,0.95)'; const ang = Math.atan2(ey - c.y, ex - c.x), ax = sx(ex), ay = sy(ey); ctx.beginPath(); ctx.moveTo(ax + Math.cos(ang) * 11, ay + Math.sin(ang) * 11); ctx.lineTo(ax + Math.cos(ang + 2.5) * 9, ay + Math.sin(ang + 2.5) * 9); ctx.lineTo(ax + Math.cos(ang - 2.5) * 9, ay + Math.sin(ang - 2.5) * 9); ctx.fill();
        ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y), R_COIN * K + 3, 0, TAU); ctx.stroke();
        // striker after the hit: it keeps going, sideways of the line of centres
        const vn = dx * nx + dy * ny, kx = dx - 0.455 * vn * nx, ky = dy - 0.455 * vn * ny;
        const kd = Math.hypot(kx, ky) || 1; glow([[cx, cy], [cx + kx / kd * 46 * pw + kx / kd * 22, cy + ky / kd * 46 * pw + ky / kd * 22]], 2.4, 2, 8, 0.6);
      } else if (t1.wall && state.guide === 2) {
        const rx = t1.wall === 'x' ? -dx : dx, ry = t1.wall === 'y' ? -dy : dy, t2 = trace(base, t1.x, t1.y, rx, ry);
        glow([[sx(t1.x), sy(t1.y)], [sx(t2.x), sy(t2.y)]], 2.6, 2, 9, 0.7);
      }
    }
    // the pull-back band
    const pull = 30 + pw * 150, bx = p0[0] - dx * pull, by = p0[1] - dy * pull;
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(20,8,0,0.45)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(p0[0] - dx * 26, p0[1] - dy * 26); ctx.lineTo(bx, by); ctx.stroke();
    const pg = ctx.createLinearGradient(p0[0], p0[1], bx, by); pg.addColorStop(0, '#ffe08e'); pg.addColorStop(1, pw > 0.8 ? '#ff6a3a' : pw > 0.5 ? '#f0a03a' : '#9fe07a'); ctx.strokeStyle = pg; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p0[0] - dx * 26, p0[1] - dy * 26); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = 'rgba(255,245,215,0.95)'; ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(80,40,0,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  // effects
  for (const f of state.fx) {
    if (f.type === 'ring') { const a = f.t / f.dur; ctx.strokeStyle = `rgba(255,246,220,${0.7 * (1 - a)})`; ctx.lineWidth = 3 * (1 - a) + 1; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), (10 + a * 30 * f.s) * (state.calm ? 0.6 : 1), 0, TAU); ctx.stroke(); }
    else if (f.type === 'pop') { const a = f.t / f.dur; ctx.globalAlpha = Math.min(1, 2 - a * 2); text(f.text, sx(Math.max(90, Math.min(S - 90, f.x))), sy(Math.max(90, Math.min(S - 90, f.y))) - 20 - a * 50, 40, f.color ?? GOLD, 'center', 700); ctx.globalAlpha = 1; }
    else if (f.type === 'flash') { ctx.fillStyle = `rgba(255,70,50,${0.25 * (1 - f.t / f.dur)})`; ctx.fillRect(BX, BY, PLAY, PLAY); }
  }

  // ---- HUD: two player cards
  const card = (x, k, name, sub, active) => {
    const w = 320, h = 168, y = 92;
    ctx.save(); if (active) { ctx.shadowColor = 'rgba(255,200,90,0.9)'; ctx.shadowBlur = state.calm ? 16 : 18 + Math.sin(t * 4) * 8; }
    ctx.fillStyle = active ? 'rgba(70,38,14,0.94)' : 'rgba(26,13,6,0.82)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill(); ctx.restore();
    ctx.strokeStyle = active ? 'rgba(255,214,120,0.95)' : 'rgba(255,214,150,0.3)'; ctx.lineWidth = active ? 3 : 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.stroke();
    coinAt(k, x + 42, y + 46, 1.25, 0);
    text(name, x + 82, y + 46, 32 * Math.min(bs, 1.1), CREAM, 'left', 700); text(sub, x + 82, y + 78, 21 * Math.min(bs, 1.1), 'rgba(255,240,205,0.72)', 'left', 500);
    const n = down(g, k);
    for (let i = 0; i < 9; i++) { const cx = x + 30 + i * 32, cy = y + 128; if (i < n) coinAt(k, cx, cy, 0.86, 0); else { ctx.strokeStyle = 'rgba(255,240,205,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, R_COIN * K * 0.86, 0, TAU); ctx.stroke(); } }
    const q = g.queen; const own = q.state === k; const pend = q.state === 'pending' && q.by === k;
    if (own) coinAt('Q', x + w - 30, y + 46, 0.95, 0); else if (pend) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); coinAt('Q', x + w - 30, y + 46, 0.95, 0); ctx.globalAlpha = 1; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + w - 30, y + 46, 19, 0, TAU); ctx.stroke(); }
  };
  if (sc === 'lesson' || sc === 'daily') {
    const l = sc === 'lesson' ? LESSONS[state.lesson.i] : null;
    text(sc === 'lesson' ? `Lesson ${state.lesson.i + 1} of ${LESSONS.length}` : 'Daily trick shot', CX, 130, 28, 'rgba(255,240,205,0.8)', 'center', 500);
    shadowText(sc === 'lesson' ? l.title : 'Pocket ' + (state.pz.goal === 1 ? 'a white coin' : state.pz.goal + ' white coins') + ' in one stroke', CX, 190, (sc === 'lesson' ? 60 : 44) * Math.min(bs, 1.05), GOLD);
    if (sc === 'daily') text(`Attempts left: ${Math.max(0, state.pz.left)}   ·   Streak ${state.daily.streak}`, CX, 236, 26, 'rgba(255,240,205,0.85)', 'center', 500);
  } else {
    const two = state.mode === 'two';
    card(28, 'W', two ? 'Player 1' : 'You', 'White · ' + (g.turn === 'W' && !g.over ? 'to play' : 'waiting'), g.turn === 'W' && !g.over);
    card(372, 'B', two ? 'Player 2' : 'Computer', two ? 'Black · ' + (g.turn === 'B' && !g.over ? 'to play' : 'waiting') : AI_LEVELS[state.level].name + (g.turn === 'B' && !g.over ? ' · ' + (phase === 'think' ? 'thinking' : 'to play') : ''), g.turn === 'B' && !g.over);
  }
  // message strip
  const m = state.msg; const my = sc === 'play' ? 322 : 258;
  if (m) { const a = Math.min(1, (m.hold - m.t) * 2, m.t * 6 + 0.2); ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = 'rgba(20,10,4,0.72)'; ctx.beginPath(); ctx.roundRect(30, my, 660, sc === 'play' ? 104 : 170, 22); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.3)'; ctx.stroke(); wrap(m.text, CX, my + 42, 27 * bs, 620, CREAM, 33 * bs); ctx.globalAlpha = 1; }
  if (sc === 'lesson' && !state.lesson.done) {
    const l = LESSONS[state.lesson.i]; ctx.fillStyle = 'rgba(20,10,4,0.72)'; ctx.beginPath(); ctx.roundRect(30, 266, 660, 150, 22); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.3)'; ctx.stroke();
    wrap(l.text, CX, 306, 27 * bs, 610, CREAM, 33 * bs);
  }
  if (sc === 'daily' && state.pz.status === 'making') { ctx.fillStyle = 'rgba(10,4,0,0.7)'; ctx.fillRect(0, 0, W, H); text('Setting up today’s shot…', CX, 780, 40, GOLD); }

  // ---- below the board: power meter and the controls
  const pw = state.aim ? state.aim.power : 0, mr = METER;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(mr.x - 4, mr.y - 4, mr.w + 8, mr.h + 8, 20); ctx.fill();
  const mg = ctx.createLinearGradient(mr.x, 0, mr.x + mr.w, 0); mg.addColorStop(0, '#7fd35a'); mg.addColorStop(0.55, '#f1c34a'); mg.addColorStop(1, '#e8442c');
  ctx.save(); ctx.beginPath(); ctx.roundRect(mr.x, mr.y, mr.w, mr.h, 14); ctx.clip(); ctx.fillStyle = 'rgba(60,32,14,0.9)'; ctx.fillRect(mr.x, mr.y, mr.w, mr.h); ctx.fillStyle = mg; ctx.fillRect(mr.x, mr.y, mr.w * pw, mr.h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 10; i++) ctx.fillRect(mr.x + mr.w * i / 10 - 1, mr.y, 2, mr.h);
  const hg = ctx.createLinearGradient(0, mr.y, 0, mr.y + mr.h); hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = hg; ctx.fillRect(mr.x, mr.y, mr.w, mr.h); ctx.restore();
  text(state.aim ? `Power ${Math.round(pw * 100)}%` : 'Power', CX, mr.y + mr.h + 40, 26, 'rgba(255,243,214,0.85)', 'center', 600);
  const tip = state.tip; if (tip) wrap(tip, CX, 1330, 26 * bs, 620, 'rgba(255,243,214,0.85)', 33 * bs);
  if (sc === 'play' || sc === 'lesson' || sc === 'daily') {
    const pb = PLAYB, mirror = state.left;
    const at = (r) => (mirror ? { ...r, x: W - r.x - r.w } : r);
    button(at(pb.menu), 'Menu', { size: 28 });
    if (sc === 'play') button(at(pb.hint), state.hintsLeft > 0 ? `Hint ${state.hintsLeft}` : 'Hint', { size: 28, dim: state.hintsLeft <= 0 || phase !== 'aim' || (state.mode === 'ai' && side === 'B') || state.hintBusy });
    else button(at(pb.hint), 'Hint', { size: 28, dim: phase !== 'aim' || state.hintBusy });
    const ready = !!state.aim && phase === 'aim' && !state.drag && !state.blocked;
    button(at(pb.flick), 'Flick', { primary: ready, size: 30, dim: !ready });
  }

  // ---- overlays
  if (state.menu) {
    ctx.fillStyle = 'rgba(6,2,0,0.72)'; ctx.fillRect(0, 0, W, H); shadowText('Paused', CX, 500, 70, GOLD);
    button(MENU.resume, 'Resume', { primary: true, size: 34 }); button(MENU.restart, sc === 'play' ? 'New board' : 'Restart', { size: 34 }); button(MENU.settings, 'Settings', { size: 34 }); button(MENU.quit, 'Leave', { size: 34 });
  }
  if (sc === 'play' && g.over && state.phase === 'over') {
    ctx.fillStyle = 'rgba(6,2,0,0.66)'; ctx.fillRect(0, 0, W, H);
    const o = g.over, two = state.mode === 'two', win = o.winner === 'W' && !two;
    const title = o.winner === 'draw' ? 'A draw' : two ? `${o.winner === 'W' ? 'Player 1' : 'Player 2'} wins` : win ? 'You win!' : 'The computer wins';
    panel(60, 560, 600, 400, 0.9); shadowText(title, CX, 660, 68, GOLD);
    text(o.winner === 'draw' ? 'Equal coins when the board stalled.' : `${o.points} point${o.points === 1 ? '' : 's'} this board`, CX, 730, 34, CREAM, 'center', 600);
    text(o.winner === 'draw' ? '' : o.reason === 'stalled' ? 'More coins pocketed when the board stalled.' : `${SIDE_NAME[o.winner]} pocketed every coin` + (g.queen.state === o.winner ? ' and covered the queen (+3).' : '.'), CX, 780, 24, 'rgba(255,243,214,0.8)', 'center', 500);
    text(`Boards played ${state.stats.played}  ·  won ${state.stats.wins}`, CX, 850, 26, 'rgba(255,243,214,0.7)', 'center', 500);
    button(OVER.again, 'Play again', { primary: true, size: 36 }); button(OVER.menu, 'Menu', { size: 32 });
    if (win && !state.calm) for (let i = 0; i < 26; i++) { const a = i * 2.4 + t * 0.6, r = 260 + (i % 5) * 30, x = CX + Math.cos(a) * r, y = 480 + Math.sin(a * 1.3 + t) * 60 + ((t * 60 + i * 37) % 220); coinAt(i % 3 === 0 ? 'Q' : i % 2 ? 'W' : 'B', x, y, 0.8, 0, 0.9); }
  }
  if ((sc === 'lesson') && state.lesson.done) {
    ctx.fillStyle = 'rgba(6,2,0,0.6)'; ctx.fillRect(0, 0, W, H); panel(50, 520, 620, 420, 0.92);
    shadowText('Lesson complete', CX, 610, 58, GOLD); wrap(LESSONS[state.lesson.i].done, CX, 676, 28, 540, CREAM, 36);
    const last = state.lesson.i >= LESSONS.length - 1;
    button(LESSONB.next, last ? 'Finish' : 'Next lesson', { primary: true, size: 34 });
  }
  if (sc === 'daily' && state.pz.status === 'solved') {
    ctx.fillStyle = 'rgba(6,2,0,0.6)'; ctx.fillRect(0, 0, W, H); panel(50, 520, 620, 380, 0.92); shadowText('Solved!', CX, 620, 66, GOLD); wrap(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}. Come back tomorrow for a new shot.`, CX, 690, 30, 540, CREAM, 38); button(LESSONB.next, 'Done', { primary: true, size: 34 });
  }
  if (sc === 'daily' && state.pz.status === 'failed') {
    ctx.fillStyle = 'rgba(6,2,0,0.6)'; ctx.fillRect(0, 0, W, H); panel(50, 520, 620, 380, 0.92); shadowText('Out of attempts', CX, 620, 56, GOLD); wrap('Not this time. A new shot arrives tomorrow.', CX, 690, 30, 540, CREAM, 38); button(LESSONB.next, 'Done', { primary: true, size: 34 });
  }
}
