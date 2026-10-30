// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js, pieces.js).
// All geometry comes from the layout `L` (layout.js) for the live screen size: portrait column, or card | board | card in landscape.
import { host, COW_R, TEXT_SCALES, AUTO_THINK_STEPS, v3 } from './layout.js';
import { drawBackdrop, drawBoard, drawLife, band, PIGMENT, TAU } from './art.js';
import { drawCow } from './pieces.js';
import { drawCredit, drawTitleLockup, drawLockup, drawMoreLine } from './brand.js';
import { RULES as R } from './morabaraba.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PAGES, flow } from './info.js';
import { puzzleTitle, puzzleGoal } from './puzzles.js';
import { POINT_UV as UV } from './morabaraba.js';
import { BOARD_SEGMENTS as RULES_SEG } from './art.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const NAME = { 1: 'Dark', 2: 'Light' };
export const boardOf = (state) => (state.take ? state.take.board : state.game.board);
export const sceneKind = (scene) => (scene === 'lesson' ? 'lesson' : scene === 'puzzle' ? 'puzzle' : scene === 'auto' ? 'auto' : 'play');
// Reference-page scroll limits, measured while drawing and read by game.js.
export const infoMetrics = { max: 0, view: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function render(ctx, state, L) {
  const scene = state.scene, auto = scene === 'auto', D = state.auto;
  const g = auto ? D.game : state.game, a = auto ? D.anim : state.anim, big = state.big;
  const S = L.scene(sceneKind(scene)), B = S.board, bs = S.bs, W = L.w, H = L.h;
  const on3 = v3.on;   // a lit 3D scene (web/view3d) is behind this canvas: draw only the HUD and menus here
  if (!on3) { drawBackdrop(ctx, W, H); drawLife(ctx, state.t, state.calm, W, H); }
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'auto' || (scene === 'puzzle' && state.pz.status !== 'making');
  let cs = 1;                                           // the scale of the current transform (so text never drops below ~11 css px)
  const MIN = () => 11 / Math.max(0.2, host.px) / cs;

  const text = (str, x, y, size, color = '#fbe6b8', font = FONT, weight = 700, align = 'center', shadow = true) => {
    size = Math.max(size, MIN());
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(20,4,2,0.7)'; ctx.fillText(str, x + 1.5, y + 2); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${Math.max(size, MIN())}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center') => { const Ls = lines(str, maxW, size); Ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return Ls.length; };
  // Largest size (down to the minimum) at which `str` wraps to fit in maxW x maxH.
  const fitLines = (str, maxW, maxH, size0, lhK = 1.22, weight = 600) => {
    let size = Math.max(size0, MIN()), Ls = lines(str, maxW, size, weight);
    const lo = MIN();
    while (Ls.length * size * lhK > maxH && size > lo) { size = Math.max(lo, size - 1); Ls = lines(str, maxW, size, weight); }
    return { size, lines: Ls, lh: size * lhK };
  };
  // Shrinks a one-line title only if it would otherwise run past maxW (a no-op for every short title).
  const fitTitle = (str, base, maxW = 640, font = FONT, weight = 700) => {
    let size = base; ctx.font = `${weight} ${size}px ${font}`;
    while (ctx.measureText(str).width > maxW && size > 24) { size -= 2; ctx.font = `${weight} ${size}px ${font}`; }
    return size;
  };
  const button = (r, label, o = {}) => {
    if (!r) return;
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h * 0.26);
    ctx.fillStyle = 'rgba(12,3,1,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f4c35a'); gr.addColorStop(1, '#d48a26'); } else { gr.addColorStop(0, 'rgba(92,40,22,0.94)'); gr.addColorStop(1, 'rgba(52,20,10,0.94)'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,238,190,0.9)' : 'rgba(236,190,120,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    if (o.primary && r.h > 80 && !o.sub) { ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.clip(); band(ctx, r.x, r.y + r.h - 12, r.w, 12, 1); ctx.restore(); }
    const hasIcon = !!o.icon, stacked = hasIcon && o.stack;
    let size = Math.max(o.size ?? 30, MIN()); const maxW = r.w - (hasIcon && !stacked ? 22 + size * 1.4 : 22);
    ctx.font = `700 ${size}px ${UI}`; while (ctx.measureText(label).width > maxW && size > 11) { size -= 1; ctx.font = `700 ${size}px ${UI}`; }
    const ink = o.primary ? '#2a1204' : '#fbe6b8';
    if (stacked) {
      const ic = Math.min(r.h * 0.34, 34);
      drawIcon(ctx, o.icon, r.x + r.w / 2, r.y + r.h * 0.38, ic, o.primary ? '#2a1204' : '#f3c46a');
      text(label, r.x + r.w / 2, r.y + r.h * 0.84, size, ink, UI, 700, 'center', !o.primary);
    } else if (hasIcon) {
      ctx.font = `700 ${size}px ${UI}`; const tw = ctx.measureText(label).width, ic = size * 1.05, gx = r.x + r.w / 2 - (tw + ic + 14) / 2;
      drawIcon(ctx, o.icon, gx + ic / 2, r.y + r.h / 2 - (o.sub ? size * 0.32 : 0), ic, o.primary ? '#2a1204' : '#f3c46a');
      text(label, gx + ic + 14, r.y + r.h / 2 + size * 0.34 - (o.sub ? size * 0.32 : 0), size, ink, UI, 800, 'left', !o.primary);
      if (o.sub) text(o.sub, r.x + r.w / 2, r.y + r.h / 2 + size * 0.95, Math.max(18, size * 0.42), o.primary ? 'rgba(42,18,4,0.8)' : 'rgba(255,230,180,0.8)', UI, 600, 'center', false);
    } else text(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.34, size, ink, UI, 700, 'center', !o.primary);
    ctx.restore();
  };
  // a plaque in the world of the game: dark carved wood, a thin painted band along the top, a bone-coloured edge
  const panel = (x, y, w, h, alpha = 0.72, rad = 18, banded = false) => {
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, `rgba(58,26,14,${Math.min(0.96, alpha + 0.1)})`); gr.addColorStop(1, `rgba(26,10,5,${Math.min(0.96, alpha + 0.12)})`);
    ctx.fillStyle = 'rgba(10,2,0,0.35)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 5, w, h, rad); ctx.fill();
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill();
    if (banded && h > 60) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.clip(); band(ctx, x, y, w, 10, 3); ctx.restore(); }
    ctx.strokeStyle = 'rgba(236,190,120,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.stroke();
  };
  const panelR = (r, alpha, rad) => panel(r.x, r.y, r.w, r.h, alpha, rad);
  const titleLettering = (x, y, size, tag = false) => titleLetteringOn(ctx, x, y, size, tag);
  const glowAt = (i, rgb, pulse, r = 26) => { const p = B.pointAt(i); const gr = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * p.s * 1.5); gr.addColorStop(0, `rgba(${rgb},${0.75 + pulse * 0.2})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * p.s * 1.5, r * p.s * 1.25, 0, 0, TAU); ctx.fill(); };
  const cowAt = (i, side, o = {}) => { const p = B.pointAt(i); drawCow(ctx, p.x, p.y + 10 * p.s, COW_R * p.s * 1.28, side, o); };

  const token = (x, y, r, side) => {
    if (!on3) { drawCow(ctx, x, y + r * 0.76, r * 1.18, side, { face: side === 1 ? 1 : -1 }); return; }
    ctx.save(); ctx.fillStyle = 'rgba(10,2,0,0.4)'; ctx.beginPath(); ctx.arc(x + 2, y + 4, r, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); gr.addColorStop(0, side === 1 ? '#6a4636' : '#fff6de'); gr.addColorStop(1, side === 1 ? '#22130e' : '#cdb487');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#e8b866'; ctx.lineWidth = 3; ctx.stroke();
    drawIcon(ctx, side === 1 ? 'cow2' : 'cow1', x - r * 0.08, y + r * 0.05, r * 1.15, side === 1 ? '#f3e6c8' : '#3a2618'); ctx.restore();
  };
  // The status block (whose move it is, what to do, who the opponent is): a row in portrait, a centred stack in a landscape card.
  const status = (r, st) => {
    const stacked = L.wide, side = st.side;
    if (!stacked) {
      const titled = S.title, t = clamp((r.h - 124) / 76, 0, 1), off = (a0, a1) => a0 + (a1 - a0) * t;
      let ix = r.x + 92; if (!titled && host.back) ix = Math.max(ix, L.backBox.x + L.backBox.w + 44);
      const tx = ix + 58, maxW = r.x + r.w - 20 - tx, iy = r.y + off(62, 100);
      token(ix, iy - 26, 34, side);
      const f = fitTitle(st.turn, 34, maxW, UI, 700); text(st.turn, tx, r.y + off(30, 46), f, '#ffffff', UI, 700, 'left');
      const n = st.sub ? wrap(st.sub, tx, r.y + off(66, 86), 23, maxW, 'rgba(255,230,180,0.95)', 27, 'left') : 1;
      if (st.mode) text(st.mode, tx, r.y + off(100, 124) + (n - 1) * 27, 22, 'rgba(255,230,180,0.75)', UI, 500, 'left');
      return;
    }
    // stacked, centred in the card; shrink the type until everything fits
    const cx = r.x + r.w / 2, iw = r.w - 12;
    for (const k of [1, 0.9, 0.8, 0.7, 0.62]) {
      const sz = (v) => Math.max(v * k, MIN()), ir = 34 * Math.max(k, 0.8);
      const tl = lines(st.turn, iw, sz(28), 700), sl = st.sub ? lines(st.sub, iw, sz(21)) : [], ml = st.mode ? lines(st.mode, iw, sz(20), 500) : [];
      const hh = ir * 2 + 10 + tl.length * sz(28) * 1.15 + 6 + sl.length * sz(21) * 1.25 + 6 + ml.length * sz(20) * 1.2;
      if (hh <= r.h || k === 0.62) {
        let y = r.y + 4 + ir; token(cx, y - ir * 0.3, ir * 0.85, side); y += ir + 10 + sz(28);
        tl.forEach((ln, i) => text(ln, cx, y + i * sz(28) * 1.15, sz(28), '#ffffff', UI, 700)); y += (tl.length - 1) * sz(28) * 1.15 + 8 + sz(21);
        sl.forEach((ln, i) => text(ln, cx, y + i * sz(21) * 1.25, sz(21), 'rgba(255,230,180,0.95)', UI, 600)); y += (Math.max(sl.length, 1) - 1) * sz(21) * 1.25 + 8 + sz(20);
        ml.forEach((ln, i) => text(ln, cx, y + i * sz(20) * 1.2, sz(20), 'rgba(255,230,180,0.75)', UI, 500));
        return;
      }
    }
  };

  if (boardScene) {
    const twoLike = state.two || auto;
    const bottom = twoLike ? 1 : state.human, topSide = 3 - bottom;
    // ---- the cards (landscape) and the title on the sky (tall portrait) ----
    if (S.card) { panel(S.card.left.x, S.card.left.y, S.card.left.w, S.card.left.h, 0.5, 20, true); if (!on3) panelR(S.card.right, 0.5, 20); else panel(S.btnCard.x, S.btnCard.y, S.btnCard.w, S.btnCard.h, 0.5, 20, true); }
    if (on3 && !S.card) {   // the sky band above the board: a soft shade so the header reads over the scene
      const y1 = S.hdr.y + S.hdr.h + 10, sh = ctx.createLinearGradient(0, 0, 0, y1); sh.addColorStop(0, 'rgba(18,6,10,0.78)'); sh.addColorStop(0.75, 'rgba(18,6,10,0.5)'); sh.addColorStop(1, 'rgba(18,6,10,0)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, y1);
    }
    if (S.title) { titleLettering(W / 2, S.titleY, 56); }
    const hdr = S.hdr;
    if (scene === 'auto') {
      const phaseWord = D.phase === 'think' ? 'thinking' : D.phase === 'reveal' ? 'about to act' : 'playing';
      const sub = D.paused ? 'Paused. TAP Resume to carry on.' : D.phase === 'think' ? 'THINK: work out your own answer before it is revealed.' : D.phase === 'reveal' ? 'REVEAL: the highlighted move is the one about to be played.' : 'ACT: watch it play out.';
      status(hdr, { side: g.turn, turn: `${NAME[g.turn]} is ${phaseWord}`, sub, mode: 'Auto Play · Watch & Learn' });
    } else if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i], step = l.steps[Math.min(state.lesson.step, l.steps.length - 1)];
      const body = state.lesson.done ? l.done : step.text, titled = S.title;
      const ix = hdr.x + hdr.w / 2, labY = hdr.y + 22;
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, ix, labY, 24, 'rgba(255,230,180,0.9)', UI, 600);
      const tsz = fitTitle(l.title, L.wide ? 38 : titled ? 46 : 40, hdr.w - 20); text(l.title, ix, labY + 10 + tsz * 0.82, tsz);
      const py = hdr.y + (L.wide ? 74 : titled ? 96 : 84) + (tsz > 40 ? 0 : -4), ph = hdr.y + hdr.h - py - 2;
      panel(hdr.x + (L.wide ? 0 : 6), py, hdr.w - (L.wide ? 0 : 12), ph, 0.82);
      const px = hdr.x + (L.wide ? 0 : 6), pw = hdr.w - (L.wide ? 0 : 12), F = fitLines(body, pw - 28, ph - 18, big ? 27 : 23);
      const y0 = py + ph / 2 - ((F.lines.length - 1) * F.lh) / 2 + F.size * 0.34;
      F.lines.forEach((ln, i) => text(ln, px + pw / 2, y0 + i * F.lh, F.size, state.lesson.done ? '#d2f7c4' : '#fff3d6', UI, 600));
    } else if (scene === 'puzzle') {
      const ix = hdr.x + hdr.w / 2, labY = hdr.y + 22, titled = S.title;
      text('Daily puzzle', ix, labY, 26, 'rgba(255,230,180,0.9)', UI, 600);
      const tsz = fitTitle(puzzleTitle(state.pz.puzzle), L.wide ? 36 : titled ? 46 : 40, hdr.w - 20); text(puzzleTitle(state.pz.puzzle), ix, labY + 10 + tsz * 0.82, tsz);
      const body = state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow.` : puzzleGoal(state.pz.n);
      const by = labY + 14 + tsz + 22, F = fitLines(body, hdr.w - 24, L.wide ? hdr.h - (by - hdr.y) - 36 : 70, big ? 27 : 24);
      F.lines.forEach((ln, i) => text(ln, ix, by + i * F.lh, F.size, '#fff3d6', UI, 600));
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, ix, hdr.y + hdr.h - (L.wide ? 8 : 2), 22, 'rgba(255,230,180,0.85)', UI, 600);
    } else {
      const turnText = g.winner ? 'Game over' : state.take ? 'Shoot a cow: TAP a glowing one' : state.two ? `${NAME[g.turn]} to move` : g.turn === state.human ? `Your move (${NAME[g.turn].toLowerCase()})` : `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
      const ph = g.winner ? '' : R.phase(g, g.turn);
      const sub = state.take ? 'A mill! Choose one cow to shoot' : ph === 'place' ? `Place a cow (${g.hand[g.turn]} left to place)` : ph === 'fly' ? 'Down to three: this side may FLY anywhere' : ph === 'move' ? 'Slide a cow one step along a line' : '';
      status(hdr, { side: g.turn, turn: turnText, sub, mode: state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}` });
    }

    // ---- pens ----
    const pen = (which, side) => {
      const P = S.pens[which], R0 = P.rect, r = P.r;
      panelR(R0, 0.66); if (P.band) band(ctx, R0.x + 10, R0.y + 7, R0.w - 20, 9, side + 1);
      const lost = g.shots[3 - side];
      for (let i = 0; i < 12; i++) {
        const s = P.slot(i);
        if (i < g.hand[side]) drawCow(ctx, s.x, s.y + r * 0.38, r, side, { face: side === 1 ? 1 : -1 });
        else if (i >= 12 - lost) { drawCow(ctx, s.x, s.y + r * 0.38, r, side, { face: side === 1 ? 1 : -1, alpha: 0.25 }); ctx.strokeStyle = 'rgba(255,120,90,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - r * 0.52, s.y - r * 0.48); ctx.lineTo(s.x + r * 0.52, s.y + r * 0.48); ctx.moveTo(s.x + r * 0.52, s.y - r * 0.48); ctx.lineTo(s.x - r * 0.52, s.y + r * 0.48); ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(240,190,120,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y + r * 0.1, r * 0.72, r * 0.38, 0, 0, TAU); ctx.stroke(); }
      }
      const you = side === bottom, lb = P.kind === 'grid' ? `${NAME[side]}${twoLike ? '' : you ? ' · you' : ' · computer'}` : twoLike ? NAME[side] : you ? 'You' : 'Computer';
      text(lb, P.label.x, P.label.y, P.label.size, 'rgba(255,230,180,0.8)', UI, 600, P.label.align, false);
    };
    // with the 3D scene the herds stand in rows beside the board; a small plaque names each one
    const penPlaque = (which, side) => {
      const p = v3.penLabel(which), lost = g.shots[3 - side], you = side === bottom;
      const who = twoLike ? NAME[side] : you ? `You (${NAME[side].toLowerCase()})` : `Computer (${NAME[side].toLowerCase()})`;
      const info = `${g.hand[side]} to place${lost ? ` · ${lost} lost` : ''}`;
      ctx.font = `700 ${Math.max(22, MIN())}px ${UI}`; const w1 = ctx.measureText(who).width; ctx.font = `600 ${Math.max(20, MIN())}px ${UI}`; const w2 = ctx.measureText(info).width;
      if (L.wide) {
        const pw = S.hdr.w, ph = 66, x = S.hdr.x, y = S.hdr.y + S.hdr.h - (which === 'top' ? 2 : 1) * (ph + 10);
        panel(x, y, pw, ph, 0.55, 18);
        ctx.fillStyle = side === 1 ? '#2b1a15' : '#efe0bd'; ctx.strokeStyle = 'rgba(255,230,180,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 24, y + ph / 2, 10, 0, TAU); ctx.fill(); ctx.stroke();
        const f1 = fitTitle(who, 22, pw - 56, UI, 700); text(who, x + 44, y + 28, f1, '#ffffff', UI, 700, 'left', false); text(info, x + 44, y + 54, 20, 'rgba(255,230,180,0.85)', UI, 600, 'left', false);
        return;
      }
      const pw = w1 + w2 + 64, ph = 44, x = clamp(p.x - pw / 2, 8, W - pw - 8), PR = S.pens[which].rect, y = which === 'top' ? PR.y + 2 : PR.y + PR.h - ph - 2;
      panel(x, y, pw, ph, 0.62, 22);
      ctx.fillStyle = side === 1 ? '#2b1a15' : '#efe0bd'; ctx.strokeStyle = 'rgba(255,230,180,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 22, y + ph / 2, 9, 0, TAU); ctx.fill(); ctx.stroke();
      text(who, x + 40, y + ph / 2 + 8, 22, '#ffffff', UI, 700, 'left', false); text(info, x + 50 + w1, y + ph / 2 + 7, 20, 'rgba(255,230,180,0.85)', UI, 600, 'left', false);
    };
    if (on3) { if (v3.penLabel && scene !== 'over') { penPlaque('top', topSide); penPlaque('bottom', bottom); } } else { pen('top', topSide); pen('bottom', bottom); }

    // ---- the board (flat art; the 3D presenter draws its own) ----
    if (!on3) {
    drawBoard(ctx, B);
    const board = auto ? g.board : boardOf(state), pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
    // mills glow
    if (scene !== 'over') for (const s of [1, 2]) for (const k of R.heldMills(board, s)) {
      const m = R.mills[k], pts = m.map((i) => B.pointAt(i));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,190,70,${0.28 + pulse * 0.1})`; ctx.lineWidth = 16 * Math.max(bs, 0.6); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,170,0.75)'; ctx.lineWidth = 4 * Math.max(bs, 0.7); ctx.stroke(); ctx.restore();
    }
    const humanTurn = !g.winner && (state.two || g.turn === state.human);
    // legal destinations of the selected or dragged cow
    if (state.sel >= 0 && !a && !state.take) for (const m of R.basicMoves(g)) if (m.from === state.sel) glowAt(m.to, '255,236,140', pulse);
    if (state.hint && !a) { glowAt(state.hint.to, '120,255,170', pulse, 30); if (state.hint.from >= 0) glowAt(state.hint.from, '120,255,170', pulse, 30); }
    if (state.lessonGlow && !a) for (const i of state.lessonGlow) glowAt(i, '255,236,140', pulse, 30);
    // warnings: points where the other side would close a mill on its next move
    if (!auto && state.marks && humanTurn && !state.take && scene !== 'over' && scene !== 'lesson') for (const i of state.threats || []) glowAt(i, '255,90,70', pulse, 22);
    if (state.take) for (const i of state.take.opts) { glowAt(i, '255,80,60', pulse, 36); const p = B.pointAt(i); ctx.strokeStyle = `rgba(255,90,70,${0.6 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y + 10 * p.s, 34 * p.s, 15 * p.s, 0, 0, TAU); ctx.stroke(); }
    // Auto Play's REVEAL phase: every legal destination this turn (dim gold ring/glow), then the ONE
    // move actually about to be played highlighted far more strongly (bright green).
    if (scene === 'auto' && D.phase === 'reveal' && D.moves) {
      const isChosen = (m) => D.chosen && m.type === D.chosen.type && m.to === D.chosen.to && (m.from ?? -1) === (D.chosen.from ?? -1);
      for (const m of D.moves) { if (!isChosen(m)) glowAt(m.to, '255,224,140', pulse, 26); }
      const c = D.chosen;
      if (c) { glowAt(c.to, '120,255,170', pulse, 36); if (c.from >= 0) glowAt(c.from, '120,255,170', pulse, 32); }
    }
    // cows, far rows first
    const order = []; for (let i = 0; i < 24; i++) order.push(i); order.sort((x, y) => B.pointAt(x).y - B.pointAt(y).y);
    const moving = a && a.t < a.mdur && a.type !== 'shot';
    function shotCow(i) {
      const f = Math.max(0, (a.t - a.mdur) / a.sdur), p = B.pointAt(i);
      ctx.save(); ctx.globalAlpha = 1 - f; drawCow(ctx, p.x, p.y + 10 * p.s - f * 26 * bs, COW_R * p.s * 1.28 * (1 + f * 0.25), a.tside, {}); ctx.restore();
      if (!state.calm) { ctx.strokeStyle = `rgba(255,214,150,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + 6 * bs, (20 + 70 * f) * p.s, (12 + 40 * f) * p.s, 0, 0, TAU); ctx.stroke(); }
    }
    for (const i of order) {
      const k = board[i]; if (!k) { if (a && a.take === i && a.t < a.mdur + a.sdur) shotCow(i); continue; }
      if (moving && a.to === i) continue;
      if (state.drag && state.drag.moved && state.drag.from === i) continue;
      if (a && a.type === 'refuse' && a.from === i) continue;
      const lift = state.sel === i ? 0.32 + (state.calm ? 0 : Math.sin(state.t * 4) * 0.05) : 0;
      cowAt(i, k, { lift });
    }
    // the cow in motion
    if (a && a.type !== 'shot' && a.t < a.mdur + 0.0001) {
      const f = Math.min(1, a.t / a.mdur), e = f * f * (3 - 2 * f), to = B.pointAt(a.to);
      let from;
      if (a.type === 'place') { const P = S.pens[a.pen] || S.pens.bottom, s = P.slot(Math.min(11, Math.max(0, a.hand))); from = { x: s.x, y: s.y + P.r * 0.38, s: P.r / (COW_R * 0.73) }; } else from = B.pointAt(a.from);
      if (a.type === 'refuse') {
        const reach = a.to === a.from ? 0 : board[a.to] ? 0.55 : 0.92, out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, ee = out * out * (3 - 2 * out) * reach;
        const shake = state.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 * bs : a.to === a.from ? Math.sin(f * 40) * 6 * (1 - f) * bs : 0;
        drawCow(ctx, from.x + (to.x - from.x) * ee + shake, from.y + 10 * from.s + (to.y - from.y) * ee, COW_R * from.s * 1.28, board[a.from] || a.kind, { lift: 0.3 * Math.sin(Math.PI * Math.min(1, f * 1.1)) });
      } else {
        const sc = from.s + (to.s - from.s) * e, arc = Math.sin(Math.PI * f) * (a.type === 'fly' ? 1.6 : a.type === 'place' ? 1.0 : 0.45);
        drawCow(ctx, from.x + (to.x - from.x) * e, from.y + (a.type === 'place' ? 0 : 10 * from.s) + (to.y + 10 * to.s - from.y - (a.type === 'place' ? 0 : 10 * from.s)) * e, COW_R * sc * (a.type === 'place' ? 1 - 0.55 * (1 - e) + 0.28 : 1.28), a.kind, { lift: arc });
      }
    }
    if (state.drag && state.drag.moved) { const p = state.drag; drawCow(ctx, p.x, p.y + 20 * bs, COW_R * 1.35 * bs, g.board[p.from], { lift: 0.4 }); }
    if (state.kb && scene !== 'over') { const c = B.pointAt(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, 34 * c.s, 28 * c.s, 0, 0, TAU); ctx.stroke(); }
    }

    // ---- message and buttons ----
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), m = S.msg;
      const F = fitLines(state.msg.text, m.w - 50, m.h - 34, big ? 31 : 26, 1.28), h = Math.min(m.h, 30 + F.lines.length * F.lh);
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(m.x, m.y + (m.h - h) / 2, m.w, h, 0.9);
      F.lines.forEach((ln, i) => text(ln, m.x + m.w / 2, m.y + (m.h - h) / 2 + 15 + F.size * 0.95 + i * F.lh, F.size, '#fff3d6', UI, 600)); ctx.restore();
    }
    const BT = S.BTN;
    if (scene === 'play') { button(BT.menu, 'Menu', { size: 26, icon: 'menu' }); button(BT.undo, 'Take back', { size: 26, icon: 'undo' }); button(BT.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0, icon: 'hint' }); }
    else if (scene === 'lesson') { button(BT.menu, 'Menu', { size: 26 }); if (state.lesson.done) button(BT.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'puzzle') { button(BT.menu, 'Menu', { size: 26 }); if (state.pz.status === 'solved') button(BT.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'auto' && D.phase !== 'over') {
      button(BT.auto.exit, 'Exit', { size: 26 }); button(BT.auto.pause, D.paused ? 'Resume' : 'Pause', { size: 26, primary: D.paused }); button(BT.auto.skip, 'Skip wait', { size: 26, dim: D.phase === 'act' || D.paused });
      const T = S.think, thinkS = AUTO_THINK_STEPS[state.autoThinkIdx], atMin = state.autoThinkIdx === 0, atMax = state.autoThinkIdx === AUTO_THINK_STEPS.length - 1;
      const mm = S.msg; panelR(L.wide ? { x: mm.x, y: mm.y + mm.h - 80, w: mm.w, h: 76 } : mm, 0.5);
      button(T.dec, '−', { dim: atMin, size: 30 }); button(T.inc, '+', { dim: atMax, size: 30 });
      const mid = (T.dec.x + T.dec.w + T.inc.x) / 2, mw = T.inc.x - (T.dec.x + T.dec.w) - 8;
      const lbl = fitLines(`Think time: ${thinkS}s (max 10s)`, mw, T.dec.h, 21, 1.2);
      lbl.lines.forEach((ln, i) => text(ln, mid, T.label.y - ((lbl.lines.length - 1) * lbl.lh) / 2 + i * lbl.lh + lbl.size * 0.34, lbl.size, 'rgba(255,230,180,0.85)', UI, 500));
    }
  }

  // ---- the title and other full screens ----
  const showTitleArt = scene === 'title' || scene === 'demo-limit' || scene === 'info' || (scene === 'puzzle' && state.pz.status === 'making');
  const T = (scene === 'title' || scene === 'demo-limit' || scene === 'info' || scene === 'puzzle') ? L.title(!!state.saved) : null;
  if (showTitleArt) {
    const bob = state.calm ? 0 : Math.sin(state.t * 1.6) * 4, hr = T.heroRect;
    if (scene === 'info') { ctx.fillStyle = on3 ? 'rgba(20,5,2,0.62)' : 'rgba(20,5,2,0.5)'; ctx.fillRect(0, 0, W, H); }
    else {
      // shade behind the title lettering and behind the buttons, so both read over the sunset
      const tt = T.titleText, top = ctx.createLinearGradient(0, 0, 0, tt.y + 90); top.addColorStop(0, 'rgba(18,6,12,0.55)'); top.addColorStop(1, 'rgba(18,6,12,0)');
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, tt.y + 90);
      if (T.card) panel(T.card.x, T.card.y, T.card.w, T.card.h, 0.62, 24, true);
      else { const y0 = T.play.y - 60, sh = ctx.createLinearGradient(0, y0, 0, y0 + 120); sh.addColorStop(0, 'rgba(20,6,4,0)'); sh.addColorStop(1, 'rgba(20,6,4,0.72)'); ctx.fillStyle = sh; ctx.fillRect(0, y0, W, 120); ctx.fillStyle = 'rgba(20,6,4,0.72)'; ctx.fillRect(0, y0 + 120, W, H - y0 - 120); }
      if (scene !== 'title') { ctx.fillStyle = 'rgba(20,5,2,0.35)'; ctx.fillRect(0, 0, W, H); }
      titleLettering(T.titleText.x, T.titleText.y, T.titleText.size, true);
      if (!on3) {
        // flat hero: two carved cows and a small board between them, fitted to the hero rectangle
        const sc = Math.min(hr.w / 720, hr.h / 300), cx = hr.x + hr.w / 2, cy = hr.y + hr.h / 2;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); cs = sc;
        drawCow(ctx, -170, 110 + bob, 96, 1); drawCow(ctx, 170, 110 - bob, 96, 2);
        ctx.lineCap = 'round';
        for (const [lw, col, dy] of [[5, 'rgba(255,210,160,0.5)', 1.5], [4, '#2a0f08', 0]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
          for (const [a1, a2] of RULES_SEG) { const [u1, v1] = UV[a1], [u2, v2] = UV[a2]; ctx.moveTo(u1 * 21, dy + 40 + v1 * 16); ctx.lineTo(u2 * 21, dy + 40 + v2 * 16); }
          ctx.stroke();
        }
        ctx.restore(); cs = 1;
      }
      if (scene === 'title' && T.lock) drawTitleLockup(ctx, T.lock, state.lockPress > 0);
    }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text('Preparing today\'s puzzle…', L.misc.cx, L.misc.y, 34, '#fff3d6', UI, 600); button(L.misc.menu, 'Menu', { size: 26 }); }
  if (scene === 'title') {
    const RW = T.rows, solvedToday = state.daily.solvedDay === state.daily.day;
    if (RW.resume) { button(RW.resume, 'Continue', { primary: true, size: 46, icon: 'play', sub: 'your saved game' }); button(RW.dark, 'New game', { size: 24, icon: 'cow1' }); }
    else button(RW.dark, 'Play', { primary: true, size: 50, icon: 'play', sub: `against the computer · ${LEVELS[state.level].name}` });
    const lab = { learn: 'Learn', light: 'Play Light', two: '2 players', daily: solvedToday ? 'Daily ✓' : 'Daily', auto: 'Auto Play', settings: 'Settings', howto: 'How to play', rules: 'Rules', about: 'About' };
    const ic = { learn: 'learn', light: 'cow2', two: 'two', daily: 'daily', auto: 'auto', settings: 'gear', howto: 'help', rules: 'rules', about: 'about' };
    for (const id of Object.keys(lab)) button(RW[id], lab[id], { size: 20, icon: ic[id], stack: true, primary: id === 'learn' && !state.learned && !RW.resume ? false : false });
    if (!state.learned && !RW.resume) { const r = RW.learn; ctx.save(); ctx.strokeStyle = `rgba(255,214,110,${0.55 + 0.35 * Math.sin(state.t * 3)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 18); ctx.stroke(); ctx.restore(); }
    const st = T.stats, stars = Object.keys(state.stats.badges).length;
    text(`Played ${state.stats.games} · won ${state.stats.wins} · ★ ${stars} of ${LEVELS.length * 2}${state.daily.streak ? ` · daily streak ${state.daily.streak}` : ''}`, st.x + st.w / 2, st.y + 28, 21, 'rgba(255,230,180,0.8)', UI, 600, 'center', false);
    if (state.msg && !state.sheet) { const m = T.msg; panel(m.x, m.y, m.w, m.h, 0.7); const sz = fitTitle(state.msg.text, 21, m.w - 24, UI, 600); text(state.msg.text, m.x + m.w / 2, m.y + m.h / 2 + sz * 0.34, sz, '#fff3d6', UI, 600, 'center', false); }
    if (state.sheet) {
      const SH = T.sheet, P = SH.panel;
      ctx.fillStyle = 'rgba(12,4,2,0.6)'; ctx.fillRect(0, 0, W, H);
      panel(P.x, P.y, P.w, P.h, 0.9, 24, true);
      text('Settings', P.x + P.w / 2, P.y + 66, 46);
      const row = (r, label, value, on) => {
        panel(r.x, r.y, r.w, r.h, 0.5, 16);
        text(label, r.x + 22, r.y + r.h / 2 + 9, 25, '#fff3d6', UI, 600, 'left', false);
        const pw = Math.max(120, Math.min(220, r.w * 0.36)), pr = { x: r.x + r.w - pw - 14, y: r.y + 12, w: pw, h: r.h - 24 };
        ctx.fillStyle = on ? '#d9982e' : 'rgba(255,230,180,0.14)'; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, pr.h / 2); ctx.fill();
        const f = fitTitle(value, 22, pr.w - 16, UI, 700); text(value, pr.x + pr.w / 2, pr.y + pr.h / 2 + f * 0.34, f, on ? '#2a1204' : '#fbe6b8', UI, 700, 'center', false);
      };
      row(SH.level, 'Computer', LEVELS[state.level].name, true);
      row(SH.sound, 'Sound', state.sound ? 'On' : 'Off', state.sound);
      row(SH.marks, 'Mill warnings', state.marks ? 'On' : 'Off', state.marks);
      row(SH.calm, 'Reduced motion', state.calm ? 'On' : 'Off', state.calm);
      row(SH.big, 'Large text', state.big ? 'On' : 'Off', state.big);
      button(SH.close, 'Done', { primary: true, size: 30 });
      if (state.msg) text(state.msg.text, P.x + P.w / 2, P.y + P.h + 34, 21, '#fff3d6', UI, 600, 'center', true);
    }
  } else if (scene === 'demo-limit') {
    const M = L.misc;
    text('That was the free taste.', M.cx, M.y, 46); text('Get Morabaraba on iPhone and Android', M.cx, M.y + 60, 28, '#fff3d6', UI, 600); text('for unlimited games.', M.cx, M.y + 98, 28, '#fff3d6', UI, 600);
    button(M.menu, 'Menu', { size: 26 });
  } else if (scene === 'info') {
    drawInfo();
  } else if (scene === 'over' || (scene === 'auto' && D.phase === 'over')) {
    const O = L.over, isAuto = scene === 'auto';
    ctx.fillStyle = on3 ? 'rgba(14,4,2,0.55)' : 'rgba(14,4,2,0.72)'; ctx.fillRect(0, 0, W, H);
    if (O.card) panel(O.card.x, O.card.y, O.card.w, O.card.h, 0.62, 24, true);
    ctx.save(); ctx.translate(O.tx, O.ty); ctx.scale(O.sc, O.sc); cs = O.sc;
    const won = g.winner === 'draw' ? 'A draw' : isAuto || state.two ? `${NAME[g.winner]} wins` : g.winner === state.human ? 'You win!' : 'The computer wins';
    if (g.winner !== 'draw' && !on3) drawCow(ctx, 360, 600, 130, g.winner);
    text(won, 360, 720, 68); text(g.reason, 360, 780, 26, '#fff3d6', UI, 500);
    text(`${g.moves} moves · Dark shot ${g.shots[1]}, Light shot ${g.shots[2]}`, 360, 826, 22, 'rgba(255,230,180,0.75)', UI, 500);
    if (isAuto) text('A full Auto Play demonstration just finished. Nothing here was saved.', 360, 868, 22, '#ffd24a', UI, 600);
    else if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten as ${NAME[state.human]}`, 360, 868, 24, '#ffd24a', UI, 600);
      if (!state.calm) for (let k = 0; k < 14; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    ctx.restore(); cs = 1;
    button(O.again, isAuto ? 'Play again (auto)' : 'Play again', { primary: true, size: isAuto ? 30 : 34 }); button(O.back, isAuto ? 'Exit to menu' : 'Menu', { size: isAuto ? 28 : 30 });
    drawMoreLine(ctx, O.more.x, O.more.y, Math.max(22, MIN()));
  }

  // Rules / About / How to play: one framed panel (header with the text-size stepper, a scrolling body, page counter) and Menu / Back / Next.
  function drawInfo() {
    const I = L.info, P = I.panel, vp = I.viewport;
    const secs = flow(PAGES[state.info.which]);
    // Text scale for these reference pages only. Always guarded: an out-of-range saved index falls back to 1, never NaN.
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const heading = state.info.which === 'about' ? 'About' : state.info.which === 'rules' ? 'Rules' : 'How to play';
    panel(P.x, P.y, P.w, P.h, 0.82, 22);
    text(heading, I.headCx, P.y + 54, fitTitle(heading, 52, I.headW));
    band(ctx, P.x + 20, I.bandY, P.w - 40, 12, 3);
    // The body scrolls inside the viewport (drag, wheel, keys, scroll bar): one continuous document.
    const sc0 = clamp(state.info.scroll || 0, 0, infoMetrics.max);
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w + 14, vp.h); ctx.clip(); ctx.translate(0, -sc0);
    const cx = vp.x + vp.w / 2, tw = vp.w - 16;
    const bodySz = Math.round(30 * scale), lhh = Math.round(bodySz * 1.4);
    let y = vp.y;
    secs.forEach((sec, i) => {
      // a section title is a heading, not the body copy the stepper grows, so it is capped like the header (min(scale, 1.15)).
      const titleSize = fitTitle(sec.title, Math.round(40 * Math.min(scale, 1.15)), tw);
      y += (i === 0 ? 8 : 26) + Math.round(titleSize * 0.8);
      text(sec.title, cx, y, titleSize);
      // the gap from the title's baseline down to the body has to clear the title's descent AND the body font's ascent
      y += Math.round(titleSize * 0.5) + Math.round(bodySz * 0.85) + 14;
      // a rules section about the cow shows the real in-game sprite, both sides, the same drawCow() the board itself uses.
      if (sec.cows) {
        const ay = y + 50, dx = 108, r = 50;
        drawCow(ctx, cx - dx, ay, r, 1); drawCow(ctx, cx + dx, ay, r, 2);
        text('Dark', cx - dx, ay + 46, 18, 'rgba(255,230,180,0.8)', UI, 600, 'center', false);
        text('Light', cx + dx, ay + 46, 18, 'rgba(255,230,180,0.8)', UI, 600, 'center', false);
        y = ay + 46 + 30 + Math.round(bodySz * 0.9);
      }
      for (const para of sec.paras) { const n = wrap(para, vp.x + 8, y, bodySz, tw, '#fff3d6', lhh, 'left'); y += n * lhh + 26; }
      y -= 10;
    });
    const contentH = y - vp.y + 10;
    ctx.restore();
    infoMetrics.view = vp.h; infoMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h);
    if (infoMetrics.max > 0) {                                           // scroll bar
      const sb = I.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / infoMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(255,230,180,0.12)'; ctx.beginPath(); ctx.roundRect(sb.x + 8, sb.y, 6, sb.h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,150,0.6)'; ctx.beginPath(); ctx.roundRect(sb.x + 6, ty, 10, th, 5); ctx.fill();
    }
    text(infoMetrics.max > 0 ? (sc0 >= infoMetrics.max - 1 ? 'End' : 'Scroll or tap Next for more') : '', P.x + P.w / 2, I.counterY, 22, 'rgba(255,230,180,0.75)', UI, 600, 'center', false);
    // The footer: Menu always leaves; Back and Next move one screenful, and Next reads Done at the end.
    const F = I.footer(true, true);
    button(F.menu, 'Menu', { size: 26 });
    button(F.back, 'Back', { size: 26, dim: sc0 <= 0 });
    button(F.next, infoMetrics.max <= 0 || sc0 >= infoMetrics.max - 1 ? 'Done' : 'Next', { size: 26, primary: true });
    const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
    button(I.header.textDec, 'A−', { dim: atMin, size: 30 });
    button(I.header.textInc, 'A+', { dim: atMax, size: 30 });
  }
}

// The title lettering: warm gold serif with a dark cut shadow and a painted band underneath.
function titleLetteringOn(ctx, x, y, size, tagline) {
  const FONT_T = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${size}px ${FONT_T}`;
  const w = Math.min(ctx.measureText('Morabaraba').width, 660);
  ctx.fillStyle = 'rgba(14,3,2,0.75)'; ctx.fillText('Morabaraba', x + size * 0.03, y + size * 0.05);
  const g = ctx.createLinearGradient(0, y - size * 0.75, 0, y + size * 0.1); g.addColorStop(0, '#fff2c8'); g.addColorStop(0.55, '#f2c060'); g.addColorStop(1, '#c97a26');
  ctx.fillStyle = g; ctx.fillText('Morabaraba', x, y);
  band(ctx, x - w * 0.42, y + size * 0.2, w * 0.84, Math.max(10, size * 0.17), 2);
  if (tagline) { ctx.font = `700 ${Math.round(size * 0.36)}px ${FONT_T}`; ctx.fillStyle = 'rgba(14,3,2,0.7)'; ctx.fillText('The game of twelve cows', x + 1.5, y + size * 0.72 + 2); ctx.fillStyle = '#fde9c0'; ctx.fillText('The game of twelve cows', x, y + size * 0.72); }
  ctx.restore();
}
// Simple line icons for the menu buttons (drawn, not bitmaps). s = icon size, c = ink.
export function drawIcon(ctx, id, x, y, s, c) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = s / 2, P = () => ctx.beginPath();
  if (id === 'play') { P(); ctx.moveTo(-h * 0.6, -h * 0.8); ctx.lineTo(h * 0.8, 0); ctx.lineTo(-h * 0.6, h * 0.8); ctx.closePath(); ctx.fill(); }
  else if (id === 'learn') { P(); ctx.moveTo(0, -h * 0.55); ctx.quadraticCurveTo(-h * 0.5, -h * 0.85, -h, -h * 0.6); ctx.lineTo(-h, h * 0.6); ctx.quadraticCurveTo(-h * 0.5, h * 0.4, 0, h * 0.75); ctx.quadraticCurveTo(h * 0.5, h * 0.4, h, h * 0.6); ctx.lineTo(h, -h * 0.6); ctx.quadraticCurveTo(h * 0.5, -h * 0.85, 0, -h * 0.55); ctx.lineTo(0, h * 0.75); ctx.stroke(); }
  else if (id === 'cow1' || id === 'cow2') {
    ctx.fillStyle = id === 'cow1' ? '#2b1a15' : '#efe0bd'; ctx.strokeStyle = c;
    P(); ctx.ellipse(-h * 0.1, h * 0.05, h * 0.62, h * 0.36, 0, 0, TAU); ctx.fill(); ctx.stroke();
    P(); ctx.ellipse(h * 0.62, -h * 0.12, h * 0.26, h * 0.2, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
    P(); ctx.moveTo(h * 0.55, -h * 0.3); ctx.quadraticCurveTo(h * 0.45, -h * 0.85, h * 0.8, -h * 0.9); ctx.moveTo(h * 0.72, -h * 0.28); ctx.quadraticCurveTo(h * 0.85, -h * 0.7, h * 1.05, -h * 0.72); ctx.stroke();
    P(); for (const lx of [-h * 0.5, -h * 0.2, h * 0.15, h * 0.35]) { ctx.moveTo(lx, h * 0.35); ctx.lineTo(lx, h * 0.85); } ctx.stroke();
  }
  else if (id === 'two') { for (const dx of [-h * 0.45, h * 0.45]) { P(); ctx.arc(dx, -h * 0.4, h * 0.3, 0, TAU); ctx.stroke(); P(); ctx.arc(dx, h * 0.75, h * 0.55, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); } }
  else if (id === 'daily') { P(); ctx.roundRect(-h * 0.85, -h * 0.65, h * 1.7, h * 1.5, h * 0.2); ctx.stroke(); P(); ctx.moveTo(-h * 0.85, -h * 0.2); ctx.lineTo(h * 0.85, -h * 0.2); ctx.moveTo(-h * 0.4, -h * 0.9); ctx.lineTo(-h * 0.4, -h * 0.5); ctx.moveTo(h * 0.4, -h * 0.9); ctx.lineTo(h * 0.4, -h * 0.5); ctx.stroke(); P(); ctx.arc(0, h * 0.32, h * 0.2, 0, TAU); ctx.fill(); }
  else if (id === 'auto') { P(); ctx.ellipse(0, 0, h, h * 0.58, 0, 0, TAU); ctx.stroke(); P(); ctx.arc(0, 0, h * 0.3, 0, TAU); ctx.fill(); }
  else if (id === 'gear') { P(); for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, r = k % 2 ? h * 0.72 : h * 0.95; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.stroke(); P(); ctx.arc(0, 0, h * 0.32, 0, TAU); ctx.stroke(); }
  else if (id === 'help') { P(); ctx.arc(0, 0, h * 0.95, 0, TAU); ctx.stroke(); ctx.font = `800 ${s * 0.72}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('?', 0, s * 0.25); }
  else if (id === 'rules') { P(); ctx.roundRect(-h * 0.7, -h * 0.9, h * 1.4, h * 1.8, h * 0.15); ctx.stroke(); P(); for (const yy of [-0.45, 0, 0.45]) { ctx.moveTo(-h * 0.4, yy * h); ctx.lineTo(h * 0.4, yy * h); } ctx.stroke(); }
  else if (id === 'about') { P(); ctx.arc(0, 0, h * 0.95, 0, TAU); ctx.stroke(); P(); ctx.arc(0, -h * 0.45, h * 0.12, 0, TAU); ctx.fill(); P(); ctx.moveTo(0, -h * 0.12); ctx.lineTo(0, h * 0.55); ctx.stroke(); }
  else if (id === 'menu') { P(); for (const yy of [-0.55, 0, 0.55]) { ctx.moveTo(-h * 0.75, yy * h); ctx.lineTo(h * 0.75, yy * h); } ctx.stroke(); }
  else if (id === 'undo') { P(); ctx.arc(h * 0.05, h * 0.1, h * 0.65, Math.PI * 1.1, Math.PI * 0.55, false); ctx.stroke(); P(); ctx.moveTo(-h * 0.85, -h * 0.55); ctx.lineTo(-h * 0.6, h * 0.05); ctx.lineTo(-h * 0.05, -h * 0.25); ctx.stroke(); }
  else if (id === 'hint') { P(); ctx.arc(0, -h * 0.2, h * 0.58, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); P(); ctx.moveTo(-h * 0.3, h * 0.55); ctx.lineTo(h * 0.3, h * 0.55); ctx.moveTo(-h * 0.22, h * 0.85); ctx.lineTo(h * 0.22, h * 0.85); ctx.stroke(); }
  ctx.restore();
}
