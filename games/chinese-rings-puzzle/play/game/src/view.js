// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawRoom, drawScene, drawDiagram, diagramSize, drawRingIcon, sceneGeom, FINISHES } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { canMove, movesLeft, isSolved, solution, allOn, toggle, parAll } from './rules.js';
import { drawLockup, drawMoreLine, edgeStroke } from './brand.js';

const FONT = '"Cinzel", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BRASS = '#e6b45c', CREAM = '#f7ecd4', DIM = 'rgba(230,180,92,0.82)', VERM = '#e2523a', JADE = '#4fd1a5';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);
const easeBack = (f) => { const c = 1.35, x = f - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const lerp = (a, b, f) => a + (b - a) * f;

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, P = state.pz, bits = P.bits, n = bits.length;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const fin = FINISHES[state.finish] || FINISHES.steel;

  // ---------------------------------------------------------------- helpers
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fitText = (str, x, y, size, maxW, color, font = UI, weight = 700, align = 'center', min = minU) => {
    const s = memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
    text(str, x, y, s, color, font, weight, align); return s;
  };
  const lines = (str, size, maxW, weight = 600, font = UI) => memo(`l|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrapBox = (str, r, size, lhRatio, color, align = 'center', min = minU, valign = 'middle') => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${lhRatio}|${min}`, () => { let q = size, l2 = lines(str, q, r.w); while (q > min && (l2.length * q * lhRatio > r.h || l2.some((l) => ctx.measureText(l).width > r.w + 0.5))) { q -= 1; l2 = lines(str, q, r.w); } return q; });
    const ls = lines(str, s, r.w), lh = s * lhRatio, x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    const y0 = valign === 'middle' ? r.y + (r.h - ls.length * lh) / 2 : r.y;
    ls.forEach((ln, i) => text(ln, x, y0 + s * 0.85 + i * lh, s, color, UI, 600, align));
    return ls.length;
  };
  const panel = (r, rad = 16, fill = 'rgba(24,12,14,0.74)', stroke = 'rgba(230,180,92,0.26)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.34);
  };
  // Flat, clean buttons: one solid fill and one line; no inner gloss shape.
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(14, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 4, r.w, r.h, rad); ctx.fill();
    ctx.fillStyle = o.primary ? '#e0a23a' : o.on ? '#5b2a22' : '#2b1618'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? '#ffe3a0' : o.on ? '#e6b45c' : 'rgba(230,180,92,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#2a1400' : BRASS, cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${FONT}`; return ctx.measureText(str).width; };
    let s1 = size; while (s1 > minU && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size * 0.74) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > minU && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.25 > r.h)) s2 -= 1;
        if (s2 > best.s) best = { s: s2, ls };
      }
    }
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, FONT, 700); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(42,20,0,0.8)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, FONT, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, FONT, 700));
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  drawRoom(ctx, L, state.t);
  if (!state.calm) motes(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(10,5,7,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ---- the ring scene: positions follow the logic with an eased, slightly springy slide through the bar
  function ringState(bitsNow, anims) {
    const pos = [], squash = [];
    for (let i = 0; i < bitsNow.length; i++) {
      const a = anims ? anims[i] : null;
      if (a) { const f = clamp(a.t / a.dur, 0, 1); pos.push(lerp(a.from, a.to, easeBack(f))); squash.push(Math.sin(Math.PI * f)); } else { pos.push(bitsNow[i] ? 1 : 0); squash.push(0); }
    }
    return { pos, squash };
  }
  function sceneOf(sc, bitsNow, anims, o = {}) {
    const rs = ringState(bitsNow, anims), pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 4.5);
    const glow = Array(bitsNow.length).fill(0), glowRgb = Array(bitsNow.length).fill(fin.glow);
    if (o.assist) for (let i = 0; i < bitsNow.length; i++) if (canMove(bitsNow, i)) glow[i] = 0.55 + 0.25 * pulse;
    if (o.hint) { glow[o.hint.ring] = 1; glowRgb[o.hint.ring] = '90,230,170'; }
    ctx.save(); ctx.translate(sc.ox, sc.oy); ctx.scale(sc.k, sc.k);
    drawScene(ctx, sc.G, { pos: rs.pos, squash: rs.squash, glow, glowRgb, shake: o.shake ? o.shake.map((s) => Math.sin(s * 28) * 7 * s) : null, finish: state.finish, t: state.t, k: sc.k, font: FONT, sel: o.sel ?? -1, labels: true });
    if (o.hint) hintArrow(sc.G, o.hint, rs.pos[o.hint.ring]);
    ctx.restore();
  }
  function hintArrow(G, h, posNow) {
    const x = G.ringX(h.ring), y0 = lerp(G.yOff, G.barY, posNow), up = h.on, bob = state.calm ? 0 : Math.sin(state.t * 5) * 5;
    const ay = up ? y0 + G.R + 30 + bob : y0 - G.R - 30 - bob;
    ctx.save(); ctx.fillStyle = JADE; ctx.strokeStyle = 'rgba(0,40,28,0.9)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (up) { ctx.moveTo(x, ay - 20); ctx.lineTo(x + 20, ay + 10); ctx.lineTo(x + 7, ay + 10); ctx.lineTo(x + 7, ay + 24); ctx.lineTo(x - 7, ay + 24); ctx.lineTo(x - 7, ay + 10); ctx.lineTo(x - 20, ay + 10); }
    else { ctx.moveTo(x, ay + 20); ctx.lineTo(x + 20, ay - 10); ctx.lineTo(x + 7, ay - 10); ctx.lineTo(x + 7, ay - 24); ctx.lineTo(x - 7, ay - 24); ctx.lineTo(x - 7, ay - 10); ctx.lineTo(x - 20, ay - 10); }
    ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(24,12,14,0.62)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(24,12,14,0.78)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 44, r.w - 40, BRASS, FONT, 700);
      wrapBox('Get Chinese Rings on iPhone and Android for unlimited puzzles, three to nine rings, every lesson and every ring finish.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your puzzle', { primary: true, size: 28 });
      button(Rr.play, 'Play', { primary: !Rr.resume, size: 34, sub: `${state.mode === 'classic' ? 'Classic' : 'Scramble'} · ${n} rings` });
      button(Rr.mode, state.mode === 'classic' ? 'Classic' : 'Scramble', { size: 24 });
      button(Rr.ringsMinus, '−', { size: 32, dim: n <= 3 }); button(Rr.ringsPlus, '+', { size: 32, dim: n >= 9 });
      fitText(`${n} rings`, Rr.ringsLabel.x + Rr.ringsLabel.w / 2, Rr.ringsLabel.y + Rr.ringsLabel.h / 2 + 8, 26, Rr.ringsLabel.w - 6, CREAM, FONT, 700);
      button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 24 }); button(Rr.auto, 'Auto Play', { size: 24 });
      button(Rr.rules, 'Rules', { size: 24 }); button(Rr.how, 'How to Play', { size: 24 });
      button(Rr.about, 'About', { size: 24 }); button(Rr.settings, 'Settings', { size: 24 });
      if (state.msg) fitText(state.msg.text, L.w / 2, Rr.play.y - 14, 22, L.w - 40, BRASS, UI, 600);
    }
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 8.2, r.h / 4.2), 28, 92), sub = Math.max(minU, ts * 0.27);
    const y0 = r.y + ts * 1.0;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff0c2'); grad.addColorStop(1, '#d99a3a');
    fitText('CHINESE RINGS', cx, y0, ts, r.w - 20, grad, FONT, 700);
    ctx.restore();
    const py = y0 + ts * 0.26, pw = Math.min(r.w * 0.8, ts * 8.4);
    ctx.fillStyle = '#b8321f'; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.9, sub * 0.95); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
    fitText('A MECHANICAL PUZZLE FROM CHINA', cx, py + sub * 1.34, sub, pw - 24, '#ffeccb', FONT, 700);
    const top = py + sub * 1.9 + ts * 0.3, room = r.y + r.h - top;
    if (room > 90) {
      const G = sceneGeom(4), k = Math.min((r.w - 16) / G.W, room / G.H, 1.7), sc = { ox: cx - G.W * k / 2, oy: top + (room - G.H * k) / 2, k, G };
      // the title animation: a four-ring puzzle solving itself, move by move, then starting over
      const seq = solution(allOn(4)), step = 1.15, cyc = (seq.length + 2) * step, tt = state.calm ? 0 : state.t % cyc, idx = Math.min(seq.length, Math.floor(tt / step));
      let b = allOn(4); for (let i = 0; i < idx; i++) b = toggle(b, seq[i]);
      const anims = Array(4).fill(null); if (idx > 0 && idx <= seq.length && tt - (idx - 1) * step < 0.5) { const k2 = seq[idx - 1]; anims[k2] = { from: b[k2] ? 0 : 1, to: b[k2] ? 1 : 0, t: tt - (idx - 1) * step, dur: 0.5 }; }
      sceneOf(sc, b, anims, {});
    }
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over', sc = L.sc;
    if (L.land && L.rightCard && !isLesson) panel(L.rightCard, 18);
    const hint = state.hint && !over ? state.hint : null;
    sceneOf(sc, bits, state.anim, { assist: state.assist && !over && !state.autoMode, hint, shake: state.shake, sel: state.kb && !over && !state.autoMode ? state.cursor : -1 });
    if (isLesson) lessonBox(); else chips();
    if (state.lamps) lamps();
    buttonsFor();
    if (over) overlay();
  }

  function lamps() {
    const r = (scene === 'lesson' && L.lessonLamps) || L.lamps; if (!r) return;
    const pitch = L.land ? Math.min(r.w / n, 56) : null, rr = clamp(Math.min(L.land ? pitch * 0.4 : L.sc.G.p * L.sc.k * 0.28, r.h * 0.36), 9, 26);
    const cy = r.y + r.h / 2, pulse = state.calm ? 0.5 : 0.5 + 0.5 * Math.sin(state.t * 4.5);
    if (!L.land) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.roundRect(r.x, r.y + 4, r.w, r.h - 8, 14); ctx.fill(); }
    for (let i = 0; i < n; i++) {
      const x = L.land ? r.x + r.w / 2 + (n - 1 - i - (n - 1) / 2) * pitch : L.ringXY(i).x, on = bits[i], mv = canMove(bits, i);
      const g = ctx.createRadialGradient(x - rr * 0.3, cy - rr * 0.3, rr * 0.1, x, cy, rr);
      if (on) { g.addColorStop(0, '#fff3c0'); g.addColorStop(1, '#e19a28'); } else { g.addColorStop(0, '#4a2a22'); g.addColorStop(1, '#1d0e0c'); }
      if (on) { const hg = ctx.createRadialGradient(x, cy, rr * 0.5, x, cy, rr * 2); hg.addColorStop(0, 'rgba(255,190,90,0.35)'); hg.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = hg; ctx.fillRect(x - rr * 2, cy - rr * 2, rr * 4, rr * 4); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = mv && state.assist ? `rgba(90,230,170,${0.6 + 0.3 * pulse})` : 'rgba(230,180,92,0.4)'; ctx.lineWidth = mv && state.assist ? 3 : 1.5; ctx.stroke();
      fitText(String(i + 1), x, cy + rr * 0.34, Math.round(rr * 1.0), rr * 1.6, on ? '#3a1d02' : 'rgba(230,180,92,0.6)', FONT, 700, 'center', 9);
    }
  }

  function chips() {
    const vals = [['Moves', String(P.moves), CREAM], ['To go', String(movesLeft(bits)), JADE], [state.autoMode ? 'Auto Play' : state.mode === 'classic' ? 'Classic' : 'Scramble', `${n} rings`, BRASS]];
    L.chips.forEach((r, i) => {
      panel(r, 14, 'rgba(24,12,14,0.74)', i === 1 ? 'rgba(79,209,165,0.5)' : 'rgba(230,180,92,0.26)', true);
      const tight = r.h < 70;
      fitText(vals[i][0].toUpperCase(), r.x + r.w / 2, r.y + (tight ? 22 : 28), tight ? 14 : 17, r.w - 16, DIM, UI, 700, 'center', 10);
      fitText(vals[i][1], r.x + r.w / 2, r.y + r.h - (tight ? 12 : 17), tight ? 30 : 44, r.w - 16, vals[i][2], FONT, 700, 'center', 14);
    });
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the puzzle solves itself.' : isSolved(bits) ? '' : 'Tap a glowing ring to move it.';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 2, M.w, M.h - 4, 14); ctx.fillStyle = 'rgba(12,6,7,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(230,180,92,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 6, M.w - 28, M.h - 12), big ? 30 : 26, 1.18, CREAM);
      ctx.restore();
    } else if (base) wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(24,12,14,0.8)', 'rgba(230,180,92,0.45)');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 28, Math.max(minU, 18), DIM, UI, 600, 'left');
    fitText(l.title, r.x + pad, r.y + 28 + 38, 34, r.w - 2 * pad, BRASS, FONT, 700, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : l.text;
    wrapBox(body, R(r.x + pad, r.y + 76, r.w - 2 * pad, r.h - 86), big ? 30 : 26, 1.25, state.lesson.done ? '#c4f5d8' : CREAM, 'left', minU, 'top');
  }
  function buttonsFor() {
    const BTN = L.BTN, sz = 24;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 22 }); button(BTN.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 22, primary: state.autoPaused });
        button(BTN.auto.dec, '- Think', { size: 20, dim: state.autoThinkIdx <= 0 }); button(BTN.auto.inc, 'Think +', { size: 20, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
        fitText(`think time ${THINK_STEPS[state.autoThinkIdx]} s`, L.land ? BTN.auto.dec.x + BTN.auto.dec.w : L.w / 2, L.land ? BTN.auto.dec.y + BTN.auto.dec.h + 24 : BTN.auto.dec.y - 12, 20, 200, DIM, UI, 600, 'center');
      } else {
        button(BTN.menu, 'Menu', { size: sz }); button(BTN.undo, 'Undo', { size: sz, dim: !state.undo.length }); button(BTN.hint, 'Hint', { size: sz, primary: !!state.hint }); button(BTN.restart, 'Restart', { size: sz - 2, dim: !P.moves });
      }
    } else if (scene === 'lesson') {
      button(BTN.menu, 'Menu', { size: sz });
      if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 });
      else { button(BTN.undo, 'Undo', { size: sz, dim: !state.undo.length }); button(BTN.hint, 'Hint', { size: sz, primary: !!state.hint }); button(BTN.restart, 'Restart', { size: sz - 2, dim: !P.moves }); }
    }
  }
  function overlay() {
    ctx.fillStyle = 'rgba(8,3,5,0.74)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(26,13,15,0.95)', 'rgba(230,180,92,0.55)');
    const res = state.result || { moves: P.moves, par: P.par, stars: 3, rings: n }, k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    for (let i = 0; i < 3; i++) drawRingIcon(ctx, (i - 1) * 74, 96 + (i === 1 ? -10 : 6) + (state.calm ? 0 : Math.sin(state.t * 2 + i) * 4), 54, state.finish, k * 0.9);
    fitText(res.auto ? 'Puzzle solved' : 'All rings free!', 0, 232, 54, cw2 - 40, BRASS, FONT, 700);
    for (let i = 0; i < 3; i++) star(-70 + i * 70, 290, 28, i < res.stars ? '#ffcf4a' : 'rgba(255,255,255,0.14)');
    wrapBox(res.auto ? `Solved in ${res.moves} moves, the fewest possible for ${res.rings} rings.` : res.moves <= res.par ? `${res.moves} moves: the fewest possible from the start.` : `${res.moves} moves. The fewest possible was ${res.par}.`, R(-cw2 / 2 + 30, 320, cw2 - 60, 70), 26, 1.25, CREAM);
    if (res.newBest) fitText('A new best for this size', 0, 412, 24, cw2 - 40, '#ffd24a', UI, 700);
    ctx.restore();
    if (res.stars === 3 && !res.auto) confetti(cx, c.y + 220 * k);
    button(O.again, res.auto ? 'Watch another' : 'Play again', { primary: true, size: 30 }); button(O.back, 'Menu', { size: 26 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function star(x, y, r, fill) {
    ctx.beginPath();
    for (let q = 0; q < 10; q++) { const rad = q % 2 ? r * 0.46 : r, ang = -Math.PI / 2 + q * Math.PI / 5; q ? ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad) : ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function confetti(cx, cy) {
    if (state.calm) return;
    for (let q = 0; q < 26; q++) {
      const ph = (state.t * 0.3 + q * 0.0917) % 1, x = cx + Math.sin(q * 2.4 + state.t) * (60 + 170 * ph), y = cy - ph * 160 + ph * ph * 190;
      ctx.fillStyle = q % 4 === 0 ? `rgba(255,205,100,${0.9 * (1 - ph)})` : q % 4 === 1 ? `rgba(226,82,58,${0.85 * (1 - ph)})` : q % 4 === 2 ? `rgba(79,209,165,${0.85 * (1 - ph)})` : `rgba(255,244,222,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(q + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    ctx.fillStyle = 'rgba(8,3,5,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(58,22,22,0.9)'); pg.addColorStop(1, 'rgba(22,9,11,0.95)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(230,180,92,0.34)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 42, D.header.textDec.x - 100 - hx, BRASS, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(230,180,92,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kind === 'rules' ? RULES : kind === 'how' ? HOWTO : kind === 'about' ? ABOUT : [{ title: '', items: settingsItems(state) }];
    const sc0 = Math.max(0, Math.min(state.doc.scroll || 0, docMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = D.bodyW, cxp = vp.x + vp.w / 2, left = cxp - bodyW / 2;
    const size = Math.round(27 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    let y = vp.y - sc0 + 4;
    const vis = (y0, h) => y0 + h > vp.y - 40 && y0 < vp.y + vp.h + 40;
    secs.forEach((sec, si) => {
      if (sec.title) {
        const t0 = Math.round(32 * Math.min(scale, 2));
        if (si > 0) y += Math.round(18 * Math.min(scale, 2));
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd27a', FONT, 700, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(29 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd27a', FONT, 700, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const spec = it.spec, dw = Math.min(bodyW - 16, 500 * (1 + (Math.min(scale, 2) - 1) * 0.3)), ds = diagramSize(spec, dw);
          if (vis(y, ds.h)) drawDiagram(ctx, { ...spec, glow: spec.glow ?? bitsLegal(spec.bits) }, cxp - dw / 2, y, dw, state.finish, state.t);
          y += ds.h + gap + 6;
        } else if (it.k === 'seg') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), ls = lines(it.label, fs, bodyW, 600);
          if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const nOpts = it.opts.length, os = fs, bh = Math.round(66 * Math.min(scale, 2.2));
          let per = nOpts; ctx.font = `700 ${os}px ${FONT}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(nOpts / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(36,14,15,${a0})`); gr.addColorStop(1, `rgba(36,14,15,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(230,180,92,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(230,180,92,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(230,180,92,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(12,6,7,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(230,180,92,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

const legalMemo = new Map();
function bitsLegal(bits) { const k = bits.join(''); let v = legalMemo.get(k); if (!v) { v = []; for (let i = 0; i < bits.length; i++) if (canMove(bits, i)) v.push(i); legalMemo.set(k, v); } return v; }
void parAll; void isSolved;

function motes(ctx, L, t) {
  for (let k = 0; k < 16; k++) {
    const sp = 5 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 - t * (4 + (k % 3) * 2) + L.h * 4) % L.h, r = 1.6 + (k % 5), a = 0.05 + 0.035 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(255,190,120,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
