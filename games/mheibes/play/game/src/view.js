// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawRoom, drawPerson, drawFist, drawRing, SKINS } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { LEVELS, PERS_INFO, KIND_LABEL, PLAYERS, STARES, handPlayer, seekScore } from './rules.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { CARPETS, CARPET_KEYS } from './art.js';
import { v3 } from './v3.js';

const FONT = 'Fredoka, "Trebuchet MS", system-ui, sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f6cf75', CREAM = '#fff6e4', DIM = 'rgba(246,207,117,0.82)', PLUM = '#2a2158';
const TAU = Math.PI * 2;
const DARKUI = 'rgba(14,10,38,0.74)';
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const SAMPLE = [
  { look: 0, skin: 1, beard: 1, pers: 'open' }, { look: 3, skin: 0, beard: 0, pers: 'steady' }, { look: 1, skin: 2, beard: 2, pers: 'showman' },
  { look: 4, skin: 3, beard: 0, pers: 'jittery' }, { look: 2, skin: 4, beard: 1, pers: 'steady' },
];
export const SETTINGS_ITEMS = (s, isOpen, UNLOCK, ROUND_CHOICES) => [
  { k: 'h', t: 'Game' },
  { k: 'seg', id: 'level', label: 'Computer level', cur: s.level, opts: LEVELS.map((l, i) => ({ v: i, l: l.name })) },
  { k: 'seg', id: 'rounds', label: 'Rounds in a match', cur: s.rounds, opts: ROUND_CHOICES.map((v) => ({ v, l: String(v) })) },
  { k: 'h', t: 'Look and sound' },
  { k: 'seg', id: 'carpet', label: 'Carpet', cur: s.carpet, opts: CARPET_KEYS.map((v) => ({ v, l: CARPETS[v].name, locked: !isOpen(s.stats, 'carpet', v), need: UNLOCK.carpet[v] })) },
  { k: 'seg', id: 'sound', label: 'Sound', cur: s.sound ? 1 : 0, opts: [{ v: 1, l: 'On' }, { v: 0, l: 'Off' }] },
  { k: 'seg', id: 'calm', label: 'Reduced motion', cur: s.calm ? 1 : 0, opts: [{ v: 0, l: 'Off' }, { v: 1, l: 'On' }] },
  { k: 'p', t: `Matches won so far: ${s.stats.wins || 0} of ${s.stats.matches || 0}. Carpets open as you win matches against the computer.` },
  ...(s.demo ? [] : [
    { k: 'h', t: 'Purchases' },
    { k: 'seg', id: 'restore', label: s.owned ? 'Thank you. The full game is unlocked on this device.' : 'Already bought the full game on this store account? Restore it here.', cur: s.owned ? 0 : -1, opts: [{ v: 0, l: s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase' }] },
  ]),
  { k: 'h', t: 'Text size' },
  { k: 'p', t: 'Use A- and A+ at the top of this screen to change the size of the text on the Rules, How to Play, About and Settings screens, up to 300%.' },
];

export function render(ctx, state, L, deps = {}) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, rd = state.rd, m = state.m, T = state.t;
  const minU = Math.max(12, 11 / (host.px || 0.6));

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
  const panel = (r, rad = 18, fill = DARKUI, stroke = 'rgba(246,207,117,0.26)', brand = true) => {
    if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind: rad >= 24 ? 'card' : 'plaque' }); return; }   // the 3D plaque is drawn behind this canvas
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.34);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = v3.on ? 0.62 : 0.45;
    const rad = Math.min(16, r.h / 3);
    if (v3.on) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: Math.min(20, r.h / 2.4), kind: o.dim ? 'dim' : o.primary ? 'primary' : o.on ? 'on' : 'quiet', label });
    if (!v3.on) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f0a63c'); gr.addColorStop(1, '#b05a14'); } else if (o.on) { gr.addColorStop(0, '#6e5a9e'); gr.addColorStop(1, '#46367a'); } else { gr.addColorStop(0, '#3d3278'); gr.addColorStop(1, '#241c4e'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,226,160,0.85)' : 'rgba(246,207,117,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#fffaf0' : GOLD, cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${UI}`; return ctx.measureText(str).width; };
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
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, UI, 700); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(255,240,210,0.9)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };

  // A row of people (used by the title, the Rules diagrams and the lessons' picture strip).
  function miniRow(r, spec, tt) {
    const n = 5, pitch = r.w / n, s = Math.min(pitch / 150, r.h / 190) * 0.98;
    const cy = r.y + r.h * 0.4, open = spec.open || [], ex = spec.exprs || {};
    for (let p = 0; p < n; p++) {
      const x = r.x + pitch * (p + 0.5), mem = SAMPLE[p];
      drawPerson(ctx, x, cy, s, mem, ex[p] || { kind: 'calm', side: 0 }, { t: tt, id: p, calm: true });
      for (const sd of [0, 1]) {
        const h = p * 2 + sd, fx = x + (sd ? 1 : -1) * 34 * s, fy = cy + 84 * s;
        const isOpen = open.includes(h);
        drawFist(ctx, fx, fy, 25 * s, isOpen ? (spec.ring === h ? 'ring' : 'open') : 'closed', { skin: mem.skin, side: sd, t: tt });
      }
    }
  }
  function facesStrip(r, tt) {
    const kinds = ['calm', 'smirk', 'tense', 'glance', 'bright'], pitch = r.w / 5, s = Math.min(pitch / 150, (r.h - 36) / 130);
    kinds.forEach((k, i) => {
      const x = r.x + pitch * (i + 0.5);
      drawPerson(ctx, x, r.y + 52 * s + 6, s * 0.92, { ...SAMPLE[(i + 1) % 5], pers: 'steady' }, { kind: k, side: i % 2 }, { t: tt, id: i, calm: true });
      fitText(k === 'glance' ? 'glancing' : KIND_LABEL[k], x, r.y + r.h - 8, 22, pitch - 6, GOLD, UI, 700);
    });
  }

  // ---------------------------------------------------------------- scenes
  const horizon = drawRoom(ctx, L, state.carpet);
  void horizon;
  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else if (scene === 'over') { drawPlayScreen(); drawOver(); }
  else drawPlayScreen();
  if (state.sceneT < 0.22) { const fa = (1 - state.sceneT / 0.22) * 0.85; if (v3.on) v3.scrim = Math.max(v3.scrim, fa); else { ctx.fillStyle = `rgba(8,5,24,${fa})`; ctx.fillRect(0, 0, L.w, L.h); } }

  // ================================================================ title
  function drawTitle() {
    const Tt = L.title(), Rr = Tt.rows;
    if (Tt.card) panel(Tt.card, 24, 'rgba(12,8,34,0.66)');
    hero(Tt.hero);
    if (scene === 'demo-limit') {
      const r = Tt.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!Tt.card) panel(r, 24, 'rgba(12,8,34,0.82)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Mheibes on iPhone and Android for full matches, all three levels, Auto Play and two players on one phone.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      button(Rr.play, 'Play the computer', { primary: true, size: 32, sub: `${LEVELS[state.level].name} level · ${state.rounds} rounds` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26 });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, Rr.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    const lk = Tt.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }
  function hero(r) {
    const cx = r.x + r.w / 2, ts = clamp(Math.min(r.w / 5.2, r.h / 4.0), 44, 128), y0 = r.y + ts * 0.95;
    ctx.save();
    for (let i = 9; i >= 1; i--) fitText('Mheibes', cx, y0 + i * ts * 0.011, ts, r.w - 10, i > 5 ? '#2c1004' : '#6a2f08', FONT, 700);   // extruded edge
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff2c2'); grad.addColorStop(1, '#f0a63c');
    fitText('Mheibes', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.24), pw = Math.min(r.w * 0.78, ts * 6.2), py = y0 + ts * 0.26;
    ctx.fillStyle = '#7a2a52'; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.75, sub * 0.9); ctx.fill();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('H U N T   T H E   R I N G  ·  I R A Q', cx, py + sub * 1.24);
    if (v3.on) { const tw = Math.min(r.w - 12, ts * 5.6), th = ts * 0.52; v3.panels.push({ r: { x: cx - tw / 2, y: py + sub * 1.75 + ts * 0.36 - th * 0.66, w: tw, h: th }, rad: th / 2.2, kind: 'tag' }); }
    fitText('Read the faces. Find the fist.', cx, py + sub * 1.75 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(246,207,117,0.92)', FONT, 600);
    const top = py + sub * 1.75 + ts * 0.62, room = r.y + r.h - top;
    if (room > 100) {
      const tt = state.frozen ? 1.5 : T, k = Math.floor(tt / 2.4) % 3, ph = (tt % 2.4) / 2.4;
      const ex = { 0: { kind: 'calm', side: 0 }, 1: ph > 0.25 ? { kind: k === 0 ? 'glance' : k === 1 ? 'tense' : 'smirk', side: k === 0 ? 1 : 0 } : { kind: 'calm', side: 0 }, 2: { kind: ph > 0.6 ? 'smirk' : 'calm', side: 1 } };
      const rr = R(r.x + r.w * 0.03, top + 4, r.w * 0.94, room - 16), n = 3, pitch = rr.w / n, s = Math.min(pitch / 122, rr.h / 196);
      const cyp = rr.y + rr.h * 0.44;
      for (let i = 0; i < n; i++) {
        const x = rr.x + pitch * (i + 0.5), mem = SAMPLE[[0, 3, 2][i]];
        drawPerson(ctx, x, cyp, s, mem, ex[i], { t: tt, id: i + 1 });
        for (const sd of [0, 1]) drawFist(ctx, x + (sd ? 1 : -1) * 34 * s, cyp + 84 * s, 25 * s, 'closed', { skin: mem.skin, side: sd, t: tt, squeeze: i === 1 && sd === 1 ? Math.max(0, Math.sin(tt * 3)) : 0 });
      }
      const bob = Math.sin(tt * 2.2) * 5; drawRing(ctx, rr.x + pitch * 1.5 + 34 * s, cyp + 84 * s - 40 * s + bob, Math.max(9, 11 * s), tt, 0.7);
    }
  }

  // ================================================================ play
  function figureExpr(p) {
    const ts = state.tellShow;
    if (ts && ts.p === p) return { kind: ts.kind, side: ts.side };
    return { kind: 'calm', side: 0 };
  }
  function drawStage() {
    const r = rd.round;
    const finale = rd.phase === 'finale' || rd.phase === 'done';
    const order = [0, 1, 2, 3, 4].sort((a, b) => L.seats[a].y - L.seats[b].y);
    const shk = state.shake > 0 ? Math.sin(state.t * 60) * 4 * state.shake : 0;
    ctx.save(); ctx.translate(shk, 0);
    for (const p of order) {
      const q = L.seats[p], mem = rd.team[p], ex = figureExpr(p), ts = state.tellShow;
      const focus = ts && ts.p === p ? 1 + 0.05 * Math.sin(Math.min(1, ts.t * 4) * Math.PI) : 1;
      const s = q.s * focus;
      if (ts && ts.p === p) {                                       // a spotlight on the face being read
        const g = ctx.createRadialGradient(q.x, q.y, 10, q.x, q.y, 110 * q.s); g.addColorStop(0, 'rgba(255,236,170,0.55)'); g.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 110 * q.s, 0, TAU); ctx.fill();
      }
      const look = state.sel >= 0 && !state.calm && handPlayer(state.sel) !== p ? { x: Math.sign(L.fist(state.sel).x - q.x) * 0.6, y: 0.6 } : null;
      drawPerson(ctx, q.x, q.y, s, mem, ex, { t: state.t, id: p, calm: state.calm, lookTo: look });
      if (state.hint && state.hint.p === p) {
        ctx.strokeStyle = `rgba(160,225,255,${0.55 + 0.35 * Math.sin(state.t * 6)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(q.x, q.y + 4 * q.s, 62 * q.s, 0, TAU); ctx.stroke();
      }
      // fists
      for (const sd of [0, 1]) {
        const h = p * 2 + sd, f = L.fist(h);
        let st = 'closed', op = false;
        if (r) {
          if (r.open[h]) { st = 'open'; op = true; }
          if (h === r.ring && (finale || r.status !== 'seek')) { st = 'ring'; op = true; }
        }
        const age = state.t - state.openAt[h], grow = op && age >= 0 && age < 0.4 && !state.calm ? 0.65 + 0.35 * (age / 0.4) : 1;
        const peek = r && h === r.ring && !op && rd.role === 'hide' && m.mode === 'ai';
        const pickPeek = rd.phase === 'pick' || rd.phase === 'perf' ? rd.pick === h : false;
        const squeeze = r && h === r.ring && !op && ts ? 0 : 0;
        drawFist(ctx, f.x, f.y, f.r * grow, st, { skin: mem.skin, side: sd, t: state.t, sel: state.sel === h, hl: state.hint && state.hint.h === h, dim: op && st === 'open', ring: peek || pickPeek, squeeze });
        if (state.kb && state.cursor === h && !state.autoMode) { ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.moveTo(f.x, f.y - f.r * 1.5); ctx.lineTo(f.x - f.r * 0.5, f.y - f.r * 2.1); ctx.lineTo(f.x + f.r * 0.5, f.y - f.r * 2.1); ctx.closePath(); ctx.fill(); }
        if (r && r.open[h] && st === 'open') { ctx.strokeStyle = 'rgba(255,255,255,0.0)'; }
      }
      // name plate and what has been seen
      const nm = L.nameAt(p), pw = Math.min(L.seats.length ? q.s * 150 : 140, 170) * 1.0;
      const tellNow = !!(ts && ts.p === p), obs = tellNow ? [] : (rd.notes[p] || []).slice(-3), isPerf = rd.performer === p && rd.role === 'hide' && rd.phase !== 'pick';
      const nameSize = Math.max(minU + 2, 24 * q.s);
      {
        const tr = { x: nm.x - pw * 0.52, y: nm.y - nameSize * 0.95, w: pw * 1.04, h: nameSize * 1.35 + (obs.length || finale || isPerf ? nameSize * 0.95 : 0) };
        if (v3.on) v3.panels.push({ r: tr, rad: 10, kind: 'tag' });
        else { ctx.fillStyle = 'rgba(8,5,26,0.62)'; ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 10); ctx.fill(); }
      }
      fitText(mem.name, nm.x, nm.y, nameSize, pw * (v3.on ? 0.86 : 0.98), CREAM, UI, 700, 'center', minU);
      if (finale) fitText(PERS_INFO[mem.pers].name, nm.x, nm.y + nameSize * 1.0, nameSize * 0.82, pw * (v3.on ? 0.86 : 0.98), '#ffd24a', UI, 700, 'center', minU);
      else if (obs.length) fitText(obs.map((o) => (o.kind === 'glance' ? (o.side ? 'look R' : 'look L') : o.kind)).join(' · '), nm.x, nm.y + nameSize * 1.0, nameSize * 0.8, pw * (v3.on ? 0.86 : 0.98), DIM, UI, 600, 'center', minU);
      if (isPerf) fitText('performer', nm.x, nm.y + nameSize * 1.0, nameSize * 0.8, pw * (v3.on ? 0.86 : 1), '#ffb6d8', UI, 700, 'center', minU);
    }
    // the tell, spoken: drawn last and over the speaker's own name plate, so it never hides another player's note
    if (state.tellShow) {
      const ts = state.tellShow, p = ts.p, q = L.seats[p], nm = L.nameAt(p);
      const word = ts.kind === 'glance' ? (ts.side ? 'glances right' : 'glances left') : KIND_LABEL[ts.kind], bs = Math.max(minU + 2, 22 * q.s), by = nm.y + bs * 0.12;
      ctx.font = `700 ${bs}px ${UI}`; const bw = Math.min(ctx.measureText(word).width + 26, Math.max(L.stage.w * 0.5, 120));
      const bx = clamp(q.x, L.stage.x + bw / 2 + 4, L.stage.x + L.stage.w - bw / 2 - 4);
      const a = clamp(1 - Math.max(0, ts.t - 1.4) / 0.5, 0, 1);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ts.free ? '#3b6a5c' : '#7a2a52'; ctx.beginPath(); ctx.roundRect(bx - bw / 2, by - bs * 1.0, bw, bs * 1.5, bs * 0.7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,226,160,0.8)'; ctx.lineWidth = 2; ctx.stroke(); text(word, bx, by - bs * 0.05, bs, CREAM, UI, 700); ctx.restore();
    }
    ctx.restore();
  }
  function stares(r, x, y, size) {
    for (let i = 0; i < STARES; i++) {
      const on = r ? i < r.staresLeft : false;
      ctx.beginPath(); ctx.arc(x + i * size * 1.5, y, size * 0.5, 0, TAU); ctx.fillStyle = on ? '#ffe58a' : 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,226,160,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  function drawPlayScreen() {
    const lesson = scene === 'lesson';
    const r = rd.round, hdr = L.header;
    if (rd.phase === 'cover' && v3.on) { v3.scrim = 0.97; drawCover(); return; }
    drawStage();
    // header: round, score, role
    panel(hdr, 20, 'rgba(12,8,34,0.78)');
    const two = m.mode === 'two';
    const meL = two ? 'Player 1' : 'You', thL = two ? 'Player 2' : 'Computer';
    const roleText = lesson ? `Lesson ${state.lesson.i + 1} of ${LESSONS.length}` : two ? `${rd.seekerName || ''} seeks` : rd.role === 'seek' ? 'You seek' : 'You hide';
    const hc = hdr.x + hdr.w / 2;
    const nameTxt = lesson ? LESSONS[state.lesson.i].name : `Round ${m.i + 1} of ${m.n}`;
    if (!L.land) {
      const lw = hdr.w * 0.33;
      fitText(nameTxt, hdr.x + 20, hdr.y + 38, 28, lw, GOLD, FONT, 700, 'left');
      fitText(roleText, hdr.x + 20, hdr.y + 70, 24, lw, CREAM, UI, 600, 'left');
      if (!lesson) {
        fitText(meL, hc - 56, hdr.y + 24, 20, 100, DIM, UI, 600, 'right'); fitText(thL, hc + 56, hdr.y + 24, 20, 100, DIM, UI, 600, 'left');
        fitText(`${m.score[0]}`, hc - 22, hdr.y + 72, 52, 70, CREAM, FONT, 700, 'right'); fitText(':', hc, hdr.y + 68, 44, 24, DIM, FONT, 700);
        fitText(`${m.score[1]}`, hc + 22, hdr.y + 72, 52, 70, CREAM, FONT, 700, 'left');
      }
      if (r) { fitText('Stares', hdr.x + hdr.w - 20, hdr.y + 28, 22, lw, DIM, UI, 600, 'right'); stares(r, hdr.x + hdr.w - 20 - (STARES - 1) * 21 - 10, hdr.y + 58, 14); }
    } else {
      fitText(nameTxt, hc, hdr.y + 28, 24, hdr.w - 24, GOLD, FONT, 700);
      fitText(roleText, hc, hdr.y + 52, 20, hdr.w - 24, CREAM, UI, 600);
      if (!lesson) fitText(`${meL} ${m.score[0]} : ${m.score[1]} ${thL}`, hc, hdr.y + 86, 34, hdr.w - 24, CREAM, FONT, 700);
      if (r) { fitText('Stares', hc - 34, hdr.y + (lesson ? 90 : 106), 18, 80, DIM, UI, 600, 'right'); stares(r, hc - 20, hdr.y + (lesson ? 84 : 100), 12); }
    }
    // message
    const msgR = L.msg;
    panel(msgR, 16, 'rgba(10,6,30,0.84)', 'rgba(246,207,117,0.45)', false);
    let msg = state.msg ? state.msg.text : '';
    if (!msg) {
      if (rd.phase === 'done') msg = rd.text || '';
      else if (rd.phase === 'seek') msg = `Stare at a face, then tap a fist to Bat or Bas. ${r ? r.staresLeft : 0} stare${r && r.staresLeft === 1 ? '' : 's'} left.`;
      else if (rd.phase === 'watch') msg = 'The seeker is studying the faces...';
      else if (rd.phase === 'pick') msg = 'Tap the fist that will hold the ring.';
      else if (rd.phase === 'perf') msg = 'Tap a teammate to be the performer, or press Skip.';
    }
    if (rd.phase === 'done' && state.msg == null) msg = rd.text || msg;
    if (scene === 'lesson' && !state.msg) msg = LESSONS[state.lesson.i].text;
    wrapBox(msg, R(msgR.x + 14, msgR.y + 6, msgR.w - 28, msgR.h - 12), 28, 1.18, CREAM);
    // buttons
    const B = L.BTN;
    if (state.autoMode) {
      button(B.auto.exit, 'Exit', { size: 26 });
      button(B.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 26, primary: true });
      button(B.auto.dec, 'Think −', { size: 24, sub: `${THINK_STEPS[state.autoThinkIdx]} s`, dim: state.autoThinkIdx === 0 });
      button(B.auto.inc, 'Think +', { size: 24, dim: state.autoThinkIdx === THINK_STEPS.length - 1 });
      if (state.autoPaused) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(L.stage.x, L.stage.y, L.stage.w, L.stage.h); fitText('Paused', L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h / 2, 64, L.stage.w - 40, CREAM, FONT, 700); }
    } else if (scene === 'lesson') {
      button(B.menu, 'Menu', { size: 26 });
      if (state.lesson.done) button(B.cont, state.lesson.i + 1 < LESSONS.length ? 'Next' : 'Done', { size: 34, primary: true });
    } else if (rd.phase === 'done') {
      button(B.menu, 'Menu', { size: 26 }); button(B.cont, m.i + 1 >= m.n ? 'See the result' : 'Next round', { size: 34, primary: true });
    } else if (rd.phase === 'seek') {
      const none = state.sel < 0;
      button(B.menu, state.menuArm > 0 ? 'Sure?' : 'Menu', { size: 26 });
      button(B.bat, 'Bat', { size: 30, dim: none, sub: 'open it' }); button(B.bas, 'Bas', { size: 30, primary: !none, dim: none, sub: 'answer' });
      button(B.hint, 'Hint', { size: 26, dim: state.hintsLeft <= 0, sub: `${state.hintsLeft} left` });
    } else if (rd.phase === 'pick') {
      button(B.menu, state.menuArm > 0 ? 'Sure?' : 'Menu', { size: 26 });
      button(B.confirm, 'Hide here', { size: 26, primary: rd.pick >= 0, dim: rd.pick < 0 });
    } else if (rd.phase === 'perf') {
      button(B.menu, state.menuArm > 0 ? 'Sure?' : 'Menu', { size: 26 });
      button(B.skip, 'Skip', { size: 26, primary: true, sub: 'no performer' }); button(B.undo, 'Back', { size: 26 });
    } else {
      button(B.menu, state.menuArm > 0 ? 'Sure?' : 'Menu', { size: 26 });
    }
    if (rd.phase === 'cover') { ctx.fillStyle = 'rgba(8,5,26,0.97)'; ctx.fillRect(0, 0, L.w, L.h); drawCover(); }
  }
  function drawCover() {
    const cw = Math.min(L.U.w - 60, 620), cx = L.w / 2, cy = L.h / 2;
    panel(R(cx - cw / 2, cy - 190, cw, 380), 26, 'rgba(30,22,70,0.92)');
    fitText('Pass the phone', cx, cy - 100, 52, cw - 40, GOLD, FONT, 700);
    wrapBox(rd.cover, R(cx - cw / 2 + 30, cy - 70, cw - 60, 150), 30, 1.25, CREAM);
    fitText('Tap when only the right player is looking', cx, cy + 140, 24, cw - 40, DIM, UI, 600);
  }

  // ================================================================ result card
  function drawOver() {
    const O = L.over, c = O.card, res = state.result || { score: m.score, winner: 0 };
    if (v3.on) v3.scrim = 0.6; else { ctx.fillStyle = 'rgba(6,3,20,0.62)'; ctx.fillRect(0, 0, L.w, L.h); }
    panel(c, 28, 'rgba(24,17,62,0.95)');
    const cx = c.x + c.w / 2, two = m.mode === 'two';
    const head = res.winner === 1 ? (two ? 'Player 1 wins' : 'You win the match') : res.winner === 2 ? (two ? 'Player 2 wins' : 'The computer wins') : 'A draw';
    fitText(head, cx, c.y + 90, 52, c.w - 50, GOLD, FONT, 700);
    fitText(`${res.score[0]}  :  ${res.score[1]}`, cx, c.y + 190, 92, c.w - 60, CREAM, FONT, 700);
    fitText(two ? 'Player 1  vs  Player 2' : `You  vs  ${LEVELS[state.level].name} computer team`, cx, c.y + 235, 24, c.w - 60, DIM, UI, 600);
    const best = `Counters are only a score. Matches won: ${state.stats.wins} of ${state.stats.matches}.`;
    wrapBox(state.autoMode ? 'That was Auto Play: the computer played both sides of a short match.' : best, R(c.x + 40, c.y + 260, c.w - 80, 70), 24, 1.2, CREAM);
    button(O.again, 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 30 });
    drawMoreLine(ctx, cx, c.y + c.h - 18, 18);
  }

  // ================================================================ documents
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kindDoc = state.doc.kind;
    if (v3.on) { v3.scrim = 0.55; v3.panels.push({ r: { x: panelR.x, y: panelR.y, w: panelR.w, h: panelR.h }, rad: 26, kind: 'doc' }); }
    else {
      ctx.fillStyle = 'rgba(6,3,20,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
      ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
      const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(46,34,100,0.9)'); pg.addColorStop(1, 'rgba(14,10,42,0.95)');
      ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(246,207,117,0.34)'; ctx.lineWidth = 2; ctx.stroke();
      edgeStroke(ctx, panelR, 26, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kindDoc];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 90 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(246,207,117,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kindDoc === 'rules' ? RULES : kindDoc === 'how' ? HOWTO : kindDoc === 'about' ? ABOUT : [{ title: '', items: deps.settings ? deps.settings(state) : [] }];
    const sc0 = Math.max(0, Math.min(state.doc.scroll || 0, docMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = D.bodyW, cxp = vp.x + vp.w / 2, left = cxp - bodyW / 2;
    const size = Math.round(27 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    let y = vp.y - sc0 + 4;
    const vis = (y0, h) => y0 + h > vp.y - 40 && y0 < vp.y + vp.h + 40;
    secs.forEach((sec, si) => {
      if (sec.title) {
        const t0 = Math.round(34 * Math.min(scale, 2));
        if (si > 0) y += Math.round(18 * Math.min(scale, 2));
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd24a', FONT, 700, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd24a', UI, 800, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const wd = Math.min(bodyW - 24, 640), hd = wd * (it.spec.type === 'faces' ? 0.36 : 0.44);
          if (vis(y, hd)) { const rr = R(cxp - wd / 2, y, wd, hd); if (it.spec.type === 'faces') facesStrip(rr, state.t); else miniRow(rr, it.spec, state.t); }
          y += hd + gap + 6;
        } else if (it.k === 'seg') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), ls = lines(it.label, fs, bodyW, 600);
          if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${UI}`;
          const fitsRow = (p2) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p2 - 1) * 10) / p2);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(28,20,70,${a0})`); gr.addColorStop(1, `rgba(28,20,70,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,207,117,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,207,117,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(246,207,117,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(10,6,30,0.97)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,207,117,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}
void PLAYERS; void seekScore; void drawBadgeStack; void SKINS;
