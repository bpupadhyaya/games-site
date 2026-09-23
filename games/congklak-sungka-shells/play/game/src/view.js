// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The ground, board and shell sprites are cached (art.js).
import { W, H, PIT_R, PITCH, STORE_BOX, BTN, SET, HULL, TEXT_STEPPER, TEXT_SCALES, posXY, titleRows } from './layout.js';
import { drawGround, drawBoard, drawSeed, slot, drawHousePit, drawStorePit, WOODS, SEEDSETS } from './art.js';
import { legalMoves, STORE, SEQ, nextRound, clone } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './about.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, CREAM = '#fbe8bf', GOLD = '#f3cf7a';
export const MATCHES = { single: 'One round', short: 'Three rounds', full: 'Full match' };

export function render(ctx, state) {
  const scene = state.scene, big = state.big, g = state.game, A = state.anim, calm = state.calm, t = state.t;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'puzzle' || scene === 'round';

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(10,6,20,0.6)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.3, align = 'center') => { const L = lines(str, maxW, size); L.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return L.length; };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(8,4,16,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, 24); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffe4a0'); gr.addColorStop(0.55, '#e2a842'); gr.addColorStop(1, '#a86a1c'); } else { gr.addColorStop(0, '#6a3f22'); gr.addColorStop(0.5, '#47260f'); gr.addColorStop(1, '#2c1408'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 24); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(243,207,122,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    // a carved inner line, like the board's rim
    ctx.strokeStyle = o.primary ? 'rgba(120,70,10,0.5)' : 'rgba(243,207,122,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14, 18); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 3, r.w - 10, r.h * 0.42, 18); ctx.stroke();
    const sz = o.size ?? 30;
    ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${UI}`;
    ctx.fillStyle = o.primary ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.5)'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36 + 1.5);
    ctx.fillStyle = o.primary ? '#2a1606' : CREAM; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.88) => {
    ctx.save(); ctx.fillStyle = `rgba(20,12,34,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(243,207,122,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(243,207,122,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 20); ctx.stroke(); ctx.restore();
  };
  const star = (x, y, r, a) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,250,225,${a})`; ctx.beginPath(); for (let k = 0; k < 8; k++) { const rad = k % 2 ? r * 0.22 : r; const ang = k * Math.PI / 4; ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); } ctx.closePath(); ctx.fill(); ctx.restore(); };

  // ---- the board's contents: shells in houses, stores, plugs of burnt houses, glows, hands --------------------------------
  function contents(sb, opts = {}) {
    const set = state.seeds, pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 5), burnt = opts.burnt || g.burnt;
    const glow = (pos, rgb, a) => { const p = posXY(pos), gr = ctx.createRadialGradient(p.x, p.y, PIT_R * 0.5, p.x, p.y, PIT_R + 22); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},${0.6 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 22, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},${0.95 * a})`; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 3, 0, TAU); ctx.stroke(); };
    for (const i of opts.legal || []) glow(i, '255,222,120', 0.5 + pulse * 0.5);
    if (state.hint && !A) glow(state.hint.pit, '130,255,170', 0.6 + pulse * 0.4);
    if (opts.picks) for (const pl of [0, 1]) if (opts.picks[pl] != null && (state.two || pl === 0)) glow(opts.picks[pl], '140,220,255', 0.9);
    if (A && A.cap) for (const pos of [A.cap.e.pos, A.cap.e.from]) glow(pos, '255,190,80', 0.5 + Math.abs(Math.sin(A.cap.t * 14)) * 0.5);
    for (let i = 0; i < 15; i++) {
      if (i === 7) continue;
      const p = posXY(i);
      if (burnt[i]) { plug(p.x, p.y); continue; }
      const n = sb[i]; if (n <= 0) continue;
      const flyN = A && A.cap && (A.cap.e.pos === i || A.cap.e.from === i);
      if (flyN) continue;
      let dx = 0; if (state.ref && state.ref.pit === i && !calm) dx = Math.sin(state.ref.t * 60) * 5 * (1 - state.ref.t / 0.6);
      const ld = A ? A.lastDrop[i] : undefined;
      for (let k = 0; k < n; k++) {
        const s = slot(i, k); let oy = 0;
        if (ld !== undefined && k === n - 1 && A.tt - ld < 0.14 && !calm) oy = -10 * (1 - (A.tt - ld) / 0.14);
        drawSeed(ctx, set, s.v, p.x + s.x + dx, p.y + s.y + oy, s.rot, 1.42);
      }
    }
    if (state.ref && !A) { const p = posXY(state.ref.pit); ctx.strokeStyle = `rgba(255,120,90,${0.9 * (1 - state.ref.t / 0.6)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 4, 0, TAU); ctx.stroke(); }
    if (opts.counts !== false) for (let i = 0; i < 15; i++) {
      if (i === 7 || burnt[i]) continue; const n = sb[i]; if (n <= 0) continue; const p = posXY(i), left = i > 7;
      const sz = big ? 34 : 28; ctx.textAlign = 'center'; ctx.font = `800 ${sz}px ${UI}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,14,2,0.85)';
      const x = p.x + (left ? -(PIT_R + 26) : PIT_R + 26), y = p.y + 10; ctx.strokeText(String(n), x, y); ctx.fillStyle = '#ffecc0'; ctx.fillText(String(n), x, y);
    }
    // storehouses
    for (const pl of [0, 1]) {
      const S = STORE_BOX[pl], n = sb[STORE[pl]], flyInto = A && A.cap && A.cap.e.p === pl;
      for (let k = 0; k < n; k++) { const col = k % 7, row = Math.floor(k / 7) % 3, ext = Math.floor(k / 21); drawSeed(ctx, set, (k * 3 + pl) % 4, S.x + 26 + col * 14 + (row % 2) * 6 + ext * 3, S.y + 46 + row * 12 + ext * 2, ((k * 97) % 360) * Math.PI / 180, 0.8); }
      void flyInto;
      if (opts.counts !== false) {
        const label = opts.labels ? opts.labels[pl] : pl === 0 ? 'You' : 'Computer';
        text(label, S.x + 20, S.y + 26, big ? 22 : 19, CREAM, UI, 700, 'left');
        text(String(n), S.x + S.w - 20, S.y + S.h / 2 + 16, big ? 52 : 46, GOLD, FONT, 700, 'right');
      }
    }
  }
  function plug(x, y) {                                     // a burnt house: a charred plug pressed into the hole
    const r = PIT_R - 2, gr = ctx.createRadialGradient(x - 8, y - 10, 3, x, y, r); gr.addColorStop(0, '#4a3226'); gr.addColorStop(0.6, '#1e1310'); gr.addColorStop(1, '#0a0605');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,50,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 3, 0.2, 2.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - 20, y - 16); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x + 20, y + 22); ctx.moveTo(x + 18, y - 20); ctx.lineTo(x - 4, y + 2); ctx.lineTo(x - 18, y + 20); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 1, 0.6, 2.4); ctx.stroke();
  }

  // ---- the ground, and the boat ------------------------------------------------------------------------------------------
  drawGround(ctx);
  if (!calm) { // a slow band of tropical light drifting over the ground
    const f = ((t * 0.045) % 1) * (W + 900) - 450; const gr = ctx.createLinearGradient(f - 260, 0, f + 260, H * 0.5); gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(0.5, 'rgba(255,214,140,0.085)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 100, W, H - 200);
  }
  const chev = () => {
    if (calm) return; const y0 = posXY(6).y, y1 = posXY(0).y, f = (t * 0.45) % 1;
    for (const [x, d] of [[400, -1], [320, 1]]) {           // up the right-hand side of the middle, down the left
      for (let k = 0; k < 3; k++) { const ff = (f + k / 3) % 1, y = d < 0 ? y1 - (y1 - y0) * ff : y0 + (y1 - y0) * ff; ctx.strokeStyle = `rgba(255,222,150,${0.75 * Math.sin(Math.PI * ff)})`; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 10, y - d * 9); ctx.lineTo(x, y + d * 9); ctx.lineTo(x + 10, y - d * 9); ctx.stroke(); }
    }
  };

  if (boardScene) {
    drawBoard(ctx, state.wood);
    // header
    if (scene === 'lesson') {
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 128, 26, 'rgba(251,232,191,0.9)', UI, 600);
      text(LESSONS[state.lesson.i].title, 360, 204, 64, CREAM, FONT);
    } else if (scene === 'puzzle') {
      text('Daily puzzle' + (state.pz.puzzle.hard ? ' (weekend)' : ''), 360, 128, 26, 'rgba(251,232,191,0.9)', UI, 600);
      text('Collect the most', 360, 204, 64, CREAM, FONT);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 246, 24, GOLD, UI, 600);
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(t * 3) % 3)) : null;
      let line;
      if (g.phase === 'matchOver') line = 'Game over';
      else if (g.opening) line = state.two ? 'Both players: choose a house' : 'Choose your first house';
      else line = state.two ? (g.turn === 0 ? 'Player one: right column' : 'Player two: left column') : g.turn === 0 ? (g.extra ? 'Play again!' : 'Your move') : (th || 'The computer moves');
      text(line, 360, 170, big ? 56 : 62, CREAM, FONT);
      text(state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name}`, 360, 212, 22, 'rgba(251,232,191,0.9)', UI, 600);
      const wins = [g.rounds.filter((r) => r.a > r.b).length, g.rounds.filter((r) => r.b > r.a).length];
      text(g.mode === 'single' ? 'One round: most shells wins' : `Round ${g.round}${g.mode === 'short' ? ' of 3' : ''} · rounds won ${wins[0]} : ${wins[1]}`, 360, 248, 22, GOLD, UI, 600);
    }
    // glows for whichever houses can be played now
    let legal = [];
    const human = !A && g.phase === 'play' && (scene === 'play' ? (state.two || g.turn === 0 || g.opening) : scene === 'lesson' ? !state.lesson.done : (state.pz.status !== 'solved' && state.pz.wrong <= 0));
    if (human) {
      if (g.opening) legal = [...legalMoves(g, 0).filter((h) => !state.pick || state.pick[0] == null), ...(state.two ? legalMoves(g, 1).filter((h) => !state.pick || state.pick[1] == null) : [])];
      else legal = scene === 'lesson' ? LESSONS[state.lesson.i].steps[state.lesson.step].want.filter((p) => legalMoves(g).includes(p)) : legalMoves(g);
    }
    chev();
    contents(state.shown, { legal, picks: g.opening ? state.pick : null, labels: scene === 'lesson' || scene === 'puzzle' ? ['You', 'Opponent'] : state.two ? ['Player 1', 'Player 2'] : ['You', 'Computer'] });
    if (state.kb && human) { const pos = g.opening || g.turn === 0 ? state.cursor : 14 - state.cursor; const p = posXY(pos); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 8, 0, TAU); ctx.stroke(); }
    // hands carrying shells, and the capture flourish
    if (A) {
      for (const pl of [0, 1]) {
        const h = A.hands[pl]; if (!h || h.n <= 0) continue;
        const hop = calm ? 0 : Math.sin(Math.PI * Math.min(1, A.timer / A.sd)) * 22, y = h.y - 30 - hop;
        ctx.fillStyle = 'rgba(8,4,16,0.32)'; ctx.beginPath(); ctx.ellipse(h.x + 6, h.y + 10, 26, 11, 0, 0, TAU); ctx.fill();
        const n = Math.min(h.n, 9); for (let k = 0; k < n; k++) { const s = slot(99, k, 30); drawSeed(ctx, state.seeds, s.v, h.x + s.x * 0.75, y + s.y * 0.65, s.rot, 1.05); }
        ctx.fillStyle = 'rgba(20,10,30,0.92)'; ctx.beginPath(); ctx.arc(h.x + 27, y - 20, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = pl === 0 ? GOLD : '#9fd4ff'; ctx.lineWidth = 2.2; ctx.stroke();
        text(String(h.n), h.x + 27, y - 13, 20, '#ffe9b0', UI, 800, 'center', false);
      }
      if (A.cap) {
        const e = A.cap.e, T = posXY(STORE[e.p]), f = Math.min(1, A.cap.t / Math.max(0.01, A.cap.dur)), ez = f * f * (3 - 2 * f);
        for (const pos of [e.from, e.pos]) {
          const p = posXY(pos), cnt = state.shown[pos];
          for (let k = 0; k < cnt; k++) { const s = slot(pos, k), x = p.x + s.x + (T.x - p.x - s.x) * ez, y = p.y + s.y + (T.y - p.y - s.y) * ez - Math.sin(Math.PI * ez) * 60; drawSeed(ctx, state.seeds, s.v, x, y, s.rot + ez * 6, 1.18 + 0.15 * Math.sin(Math.PI * ez)); }
        }
        const p = posXY(e.from);
        if (!calm) { ctx.strokeStyle = `rgba(255,214,120,${0.85 * (1 - f)})`; ctx.lineWidth = 7 * (1 - f) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R * (0.8 + 0.9 * f), 0, TAU); ctx.stroke(); }
        text(`+${e.n}`, p.x, p.y - 50 - f * 30, 38, `rgba(255,224,130,${1 - f * 0.6})`, FONT, 700);
      }
      if (!A.fast && A.ev.length > 40 && scene !== 'over') text('TAP to fast-forward', 360, 296, 22, 'rgba(251,232,191,0.85)', UI, 600);
    }
    if (g.opening && !A && scene === 'play' && state.pick && state.pick[0] != null && !state.two) text('Waiting…', 360, 786, 26, '#bfe6ff', UI, 700);
    // message panel
    const showMsg = state.msg && scene !== 'over' && scene !== 'round';
    const lessonText = scene === 'lesson' && !state.lesson.done && !A ? LESSONS[state.lesson.i].steps[state.lesson.step].text : null;
    const body = showMsg ? state.msg.text : lessonText;
    if (body) {
      const al = showMsg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 1;
      let ms = big ? 30 : 26, L = lines(body, 620, ms);
      while (L.length * ms * 1.26 > 80 && ms > 16) { ms -= 1; L = lines(body, 620, ms); }
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(40, 1322, 640, 94, 0.92);
      const top = 1322 + 47 - (L.length * ms * 1.26) / 2 + ms * 0.9; L.forEach((ln, i) => text(ln, 360, top + i * ms * 1.26, ms, '#fff3d6', UI, 600, 'center', false));
      ctx.restore();
    }
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 28 }); button(BTN.undo, 'Undo', { size: 28 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 28 }); if (state.lesson.done && !A) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !A) button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    if (scene === 'play' && state.dev) text('DEV', 40, 130, 20, '#7dff9a', UI, 700, 'left');
  }

  if (scene === 'title' || scene === 'demo-limit') {
    // the boat, on its side, rocking on water
    const sway = calm ? 0 : Math.sin(t * 0.9) * 0.03, bob = calm ? 0 : Math.sin(t * 1.3) * 7;
    const wave = (base, amp, k, col, crest, ph) => {
      ctx.beginPath(); ctx.moveTo(0, base + 200); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, base + Math.sin(x / 70 + t * (calm ? 0 : k) + ph) * amp + Math.sin(x / 31 + t * (calm ? 0 : k * 1.7)) * amp * 0.3); ctx.lineTo(W, base + 200); ctx.closePath();
      const gr = ctx.createLinearGradient(0, base - amp, 0, base + 150); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); ctx.fillStyle = gr; ctx.fill();
      ctx.beginPath(); for (let x = 0; x <= W; x += 12) { const y = base + Math.sin(x / 70 + t * (calm ? 0 : k) + ph) * amp + Math.sin(x / 31 + t * (calm ? 0 : k * 1.7)) * amp * 0.3; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = crest; ctx.lineWidth = 3; ctx.stroke();
    };
    wave(690, 9, 0.9, ['rgba(20,90,110,0.85)', 'rgba(10,40,70,0)'], 'rgba(200,240,235,0.5)', 0);
    ctx.save(); ctx.translate(360, 520 + bob); ctx.rotate(-Math.PI / 2 + sway); ctx.scale(0.6, 0.6); ctx.translate(-360, -HULL.cy);
    drawBoard(ctx, state.wood);
    const full = new Array(16).fill(7); full[7] = 0; full[15] = 0;
    contents(full, { counts: false, burnt: new Array(16).fill(false) });
    ctx.restore();
    if (!calm) for (let k = 0; k < 4; k++) { const ph = (t * 0.35 + k * 0.27) % 1; star(190 + k * 110 + Math.sin(k * 5) * 30, 430 + ((k * 53) % 200), 9 * Math.sin(Math.PI * ph) + 1, Math.sin(Math.PI * ph)); }
    wave(668, 12, 1.2, ['rgba(30,120,140,0.55)', 'rgba(14,60,90,0)'], 'rgba(220,250,245,0.7)', 2);
    wave(716, 10, 1.6, ['rgba(20,100,125,0.9)', 'rgba(8,36,66,0)'], 'rgba(200,240,235,0.55)', 4);
    text('Congklak', 360, 196, 130, CREAM, FONT);
    text('The shell game of Southeast Asia', 360, 250, 28, 'rgba(251,232,191,0.95)', FONT, 700);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solved = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    button(R.two, 'Two players, one phone', { size: 30 });
    button(R.daily, solved ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 30 });
    button(R.about, 'About', { size: 21 }); button(R.how, 'Controls', { size: 21 }); button(R.rules, 'Rules', { size: 21 }); button(R.settings, 'Settings', { size: 21 });
    const y = R.about.y + 130;
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, y, 22, 'rgba(251,232,191,0.9)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    text(stars.trim(), 360, y + 40, 30, GOLD, UI, 700);
    if (state.msg) wrap(state.msg.text, 360, 1440, 24, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    panel(60, 800, 600, 380, 0.9);
    text('That was the free taste.', 360, 920, 56, CREAM, FONT);
    text('Get Congklak on iPhone and Android', 360, 1010, 28, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1052, 28, '#fff3d6', UI, 600);
  } else if (scene === 'settings') {
    panel(40, 130, 640, 1130, 0.55);
    text('Settings', 360, 230, 70, CREAM, FONT);
    const lv = LEVELS[state.level];
    button(SET.level, `Computer level: ${lv.name}`, { size: 30 });
    button(SET.match, `Match: ${MATCHES[state.match]}`, { size: 30 });
    button(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    button(SET.calm, calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    button(SET.big, big ? 'Large text: on' : 'Large text: off', { size: 30 });
    button(SET.seeds, `Pieces: ${SEEDSETS[state.seeds]}`, { size: 30 });
    button(SET.wood, `Board: ${WOODS[state.wood].name}`, { size: 30 });
    wrap(lv.blurb, 360, 1040, 26, 600, '#ffe9b0');
    wrap(state.match === 'single' ? 'One round: whoever holds more shells at the end wins.' : state.match === 'short' ? 'Three rounds, with burnt houses after each. Win more rounds, or leave your opponent with no houses.' : 'Play on until one player has no houses left (nine rounds at most).', 360, 1100, 24, 590, 'rgba(251,232,191,0.9)');
    for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, 210 + k * 38, 1200, k * 0.7, 1.5);
    button(SET.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about' || scene === 'how') {
    const P = scene === 'about' ? ABOUT : HOWTO;
    // Text scale for these reference pages only (independent of the gameplay "Large text" setting,
    // which also affects house/store numerals during play, not this reading screen). Always guarded:
    // an out-of-range saved index (e.g. from a build with a shorter TEXT_SCALES array) falls back to 1.
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    // Paginated one part per page, the same as Rules: at the top text-size step, all six parts
    // never fit on one screen, and cramming them in defeats the point of bigger text.
    const parts = P.parts, [h, body] = parts[state.page % parts.length];
    panel(36, 116, 648, 1250, 0.92);
    text(P.title, 360, 206, Math.round(64 * Math.min(scale, 1.15)), CREAM, FONT);
    text(h, 70, 280, Math.round(34 * scale), GOLD, FONT, 700, 'left');
    const bodySize = Math.round(28 * scale), lh = Math.round(38 * scale);
    wrap(body, 70, 280 + Math.round(50 * scale), bodySize, 580, '#fff3d6', lh, 'left');
    text(`Page ${(state.page % parts.length) + 1} of ${parts.length}`, 360, 1340, 20, 'rgba(251,232,191,0.6)', UI, 600);
    button(BTN.aboutBack, 'Back', { size: 30 });
    button(BTN.aboutNext, 'Next', { primary: true, size: 30 });
    const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
    button(TEXT_STEPPER.dec, 'A−', { dim: atMin, size: 32 });
    button(TEXT_STEPPER.inc, 'A+', { dim: atMax, size: 32 });
  } else if (scene === 'rules') {
    const pages = RULES, page = pages[state.page % pages.length];
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    panel(36, 116, 648, 1250, 0.92);
    text('Rules', 360, 206, Math.round(64 * Math.min(scale, 1.15)), CREAM, FONT);
    text(page.title, 360, 258, Math.round(32 * scale), GOLD, FONT, 700);
    let y = 300;
    // Illustrations reuse the board's own real pit/store/seed drawing functions (art.js) — never a
    // separate simplified icon, so the picture on this page always matches what is on the board.
    if (page.art === 'house') {
      const cx = 360, cy = y + 84;
      drawHousePit(ctx, cx, cy, PIT_R);
      for (let k = 0; k < 4; k++) { const s = slot(0, k); drawSeed(ctx, state.seeds, s.v, cx + s.x, cy + s.y, s.rot, 1.42); }
      text('A house with shells in it', 360, y + 168, 20, 'rgba(251,232,191,0.75)', UI, 600);
      y += 200;
    } else if (page.art === 'store') {
      const S = { x: 255, y: y, w: 210, h: 86 };
      drawStorePit(ctx, S.x, S.y, S.w, S.h);
      for (let k = 0; k < 10; k++) { const col = k % 7, row = Math.floor(k / 7); drawSeed(ctx, state.seeds, (k * 3) % 4, S.x + 26 + col * 14 + (row % 2) * 6, S.y + 46 + row * 12, ((k * 97) % 360) * Math.PI / 180, 0.8); }
      text('Your storehouse, banking shells', 360, y + S.h + 30, 20, 'rgba(251,232,191,0.75)', UI, 600);
      y += S.h + 62;
    } else if (page.art === 'capture') {
      const cy = y + 84, xa = 200, xb = 520;
      drawHousePit(ctx, xa, cy, PIT_R);
      drawHousePit(ctx, xb, cy, PIT_R);
      for (let k = 0; k < 4; k++) { const s = slot(1, k); drawSeed(ctx, state.seeds, s.v, xb + s.x, cy + s.y, s.rot, 1.42); }
      text('Yours: empty', xa, cy + 68, 18, 'rgba(251,232,191,0.75)', UI, 600);
      text('Opposite: captured', xb, cy + 68, 18, 'rgba(251,232,191,0.75)', UI, 600);
      y += 190;
    }
    const bodySize = Math.round(28 * scale), lh = Math.round(bodySize * 1.4);
    for (const para of page.lines) { const n = wrap(para, 70, y, bodySize, 580, '#fff3d6', lh, 'left'); y += n * lh + 18; }
    text(`Page ${(state.page % pages.length) + 1} of ${pages.length}`, 360, 1340, 20, 'rgba(251,232,191,0.6)', UI, 600);
    button(BTN.rulesBack, 'Back', { size: 30 });
    button(BTN.rulesNext, 'Next', { primary: true, size: 30 });
    const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
    button(TEXT_STEPPER.dec, 'A−', { dim: atMin, size: 32 });
    button(TEXT_STEPPER.inc, 'A+', { dim: atMax, size: 32 });
  } else if (scene === 'round') {
    ctx.fillStyle = 'rgba(12,6,24,0.72)'; ctx.fillRect(0, 0, W, H);
    const rr = g.roundResult, mine = rr.a, theirs = rr.b, won = mine > theirs ? 0 : mine < theirs ? 1 : -1;
    const who = (pl) => (state.two ? (pl === 0 ? 'Player one' : 'Player two') : pl === 0 ? 'You' : 'The computer');
    text(['', 'Round one', 'Round two', 'Round three', 'Round four', 'Round five', 'Round six', 'Round seven', 'Round eight', 'Round nine'][rr.round] + ' over', 360, 470, 84, CREAM, FONT);
    text(won < 0 ? 'A tied round' : `${who(won)} won the round`, 360, 530, 34, GOLD, FONT);
    text(`${mine} : ${theirs}`, 360, 700, 130, GOLD, FONT);
    text(state.two ? 'Player one : Player two' : 'You : Computer', 360, 770, 24, 'rgba(251,232,191,0.9)', UI, 600);
    const c = clone(g), before = g.burnt.slice(); nextRound(c);
    const lost = [0, 1].map((pl) => SEQ[pl].filter((h) => c.burnt[h] && !before[h]).length);
    const open = [0, 1].map((pl) => SEQ[pl].filter((h) => !c.burnt[h]).length);
    wrap(`Refilled houses: ${open[0]} for ${who(0).toLowerCase()}, ${open[1]} for ${who(1).toLowerCase()}.`, 360, 830, 28, 590, '#fff3d6');
    wrap(lost[0] + lost[1] === 0 ? 'Nobody loses a house this time.' : `${lost[0] ? `${who(0)}: ${lost[0]} house${lost[0] === 1 ? '' : 's'} burnt shut. ` : ''}${lost[1] ? `${who(1)}: ${lost[1]} house${lost[1] === 1 ? '' : 's'} burnt shut.` : ''}`, 360, 900, 26, 590, '#ffd7a0');
    button(BTN.cont, 'Next round', { primary: true, size: 36 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(12,6,24,0.74)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? (g.winner === 0 ? 'Player one wins' : 'Player two wins') : g.winner === 0 ? 'You win!' : 'The computer wins';
    text(won, 360, 470, 96, CREAM, FONT);
    const last = g.rounds[g.rounds.length - 1] || { a: 0, b: 0 };
    text(`${last.a} : ${last.b}`, 360, 690, 120, GOLD, FONT);
    text(g.mode === 'single' ? 'Final shell count' : `Last round · ${g.rounds.length} round${g.rounds.length === 1 ? '' : 's'} played`, 360, 735, 24, 'rgba(251,232,191,0.9)', UI, 600);
    text(state.two ? 'Player one : Player two' : 'You : Computer', 360, 775, 24, 'rgba(251,232,191,0.75)', UI, 500);
    if (!state.two && g.winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, 360, 850, 32, GOLD, UI, 700);
      if (!calm) for (let k = 0; k < 16; k++) { const ph = (t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (170 + 90 * ph), y = 640 - ph * 420; drawSeed(ctx, state.seeds, k % 4, x, y, ph * 6, 1 - ph * 0.5); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 36 }); button(BTN.back, 'Menu', { size: 32 });
  }
  void H; void PITCH;
}
