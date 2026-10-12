// The dictionary sheet: a full-width panel, 85% of the screen high, anchored to the bottom, drawn over whatever page the player came from.
// Two views: SEARCH (a text field, up to 6 suggestions or the last 8 searches, an on-screen keyboard) and WORD (a word card).
// geom() is pure arithmetic shared by hit testing (game.js) and drawing (drawLookup); nothing here changes game state.
import { SCHEMES } from './schemes.js';
import { TEXT_SCALES } from './layout.js';

const UI_STD = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', DISPLAY_STD = '"Cormorant Garamond", Georgia, "Times New Roman", serif', DYS = 'Verdana, "Trebuchet MS", "DejaVu Sans", sans-serif';
const CYAN = '#39d0ea', GOLD = '#ffd166', TAU = Math.PI * 2;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const SLOTS = 8, SUGG_MAX = 6;
export const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export function geom(L, view) {
  const w = L.w, h = L.h, ins = L.ins ?? { t: 0, r: 0, b: 0, l: 0 }, sh = Math.round(h * 0.85), y0 = h - sh;
  const G = { sheet: R(0, y0, w, sh), wide: L.wide };
  const colW = Math.min(w - 2 * 24 - (ins.l ?? 0) - (ins.r ?? 0), L.wide ? 1300 : 900), cx0 = Math.round((w - colW) / 2);
  G.colX = cx0; G.colW = colW;
  const row1 = y0 + 20, bottom = h - (ins.b ?? 0) - 16;
  G.done = R(cx0 + colW - 168, row1, 168, 76); G.back = R(cx0, row1, 84, 76);
  G.titleX = cx0; G.titleMax = colW - 168 - 24;
  const tabY = row1 + 76 + 8, tabW = Math.floor((colW - 12) / 2);
  G.tabM = R(cx0, tabY, tabW, 50); G.tabT = R(cx0 + tabW + 12, tabY, colW - tabW - 12, 50);
  const y2 = tabY + 50 + 8;
  if (view === 'word') {
    G.hear = R(cx0, y2, 240, 70); G.inc = R(cx0 + colW - 96, y2, 96, 70); G.dec = R(cx0 + colW - 96 * 2 - 10, y2, 96, 70);
    const top = y2 + 70 + 14;
    G.vp = R(cx0, top, colW - 24, Math.max(60, bottom - top)); G.sb = R(cx0 + colW - 14, top, 14, G.vp.h);
    return G;
  }
  G.field = R(cx0, y2, colW - 184, 82); G.go = R(cx0 + colW - 172, y2, 172, 82); G.clear = R(G.field.x + G.field.w - 76, y2 + 4, 72, 74);
  const y3 = y2 + 82 + 14, gap = 8;
  G.labelY = y3 + 24;
  let listTop, listW, listX, kb;
  if (!L.wide) {
    listTop = y3 + 34; listX = cx0; listW = colW;
    const kbMin = 4 * 52 + 3 * gap, avail = bottom - listTop;
    G.rowH = clamp(Math.floor((avail - kbMin - 12) / SLOTS), 34, 64);
    const kbTop = listTop + SLOTS * G.rowH + 12;
    kb = R(cx0, kbTop, colW, Math.max(kbMin, bottom - kbTop));
  } else {
    const lw = Math.floor(colW * 0.42);
    listTop = y3 + 34; listX = cx0; listW = lw;
    G.rowH = clamp(Math.floor((bottom - listTop) / SLOTS), 36, 62);
    kb = R(cx0 + lw + 24, y3, colW - lw - 24, bottom - y3);
  }
  G.rowRect = (i) => R(listX, listTop + i * G.rowH, listW, G.rowH - 6);
  // the keyboard
  const kh = clamp(Math.floor((kb.h - 3 * gap) / 4), 44, 88), kw = Math.floor((kb.w - 9 * gap) / 10);
  G.keys = [];
  const rowsTop = kb.y + Math.max(0, Math.floor((kb.h - (4 * kh + 3 * gap)) / 2));
  KEY_ROWS.forEach((chars, ri) => {
    const n = chars.length + (ri === 2 ? 1.6 : 0), rowW = n * kw + (n - 1) * gap, x0 = kb.x + Math.floor((kb.w - rowW) / 2);
    [...chars].forEach((c, i) => G.keys.push({ id: `k:${c}`, label: c, r: R(x0 + i * (kw + gap), rowsTop + ri * (kh + gap), kw, kh) }));
    if (ri === 2) G.keys.push({ id: 'k:back', label: '⌫', r: R(x0 + chars.length * (kw + gap), rowsTop + ri * (kh + gap), Math.round(kw * 1.6), kh) });
  });
  const by = rowsTop + 3 * (kh + gap), wq = kw * 2 + gap;
  G.keys.push({ id: "k:'", label: "'", r: R(kb.x, by, kw, kh) }, { id: 'k:-', label: '-', r: R(kb.x + kw + gap, by, kw, kh) });
  const spX = kb.x + 2 * (kw + gap), goW = Math.round(kw * 2.6);
  G.keys.push({ id: 'k:space', label: 'space', r: R(spX, by, kb.x + kb.w - goW - gap - spX, kh) }, { id: 'k:go', label: 'Look up', r: R(kb.x + kb.w - goW, by, goW, kh), primary: true });
  void wq;
  return G;
}

// ---- drawing -----------------------------------------------------------------------------------------------
export function drawLookup(ctx, state, L, K) {
  const { G, lk } = K, PF = state.prefs ?? {}, dys = PF.font === 'dys', UI = dys ? DYS : UI_STD, DISPLAY = dys ? DYS : DISPLAY_STD;
  const sc = SCHEMES[state.scheme] ?? SCHEMES[0], hc = Boolean(sc.hc), w = L.w, h = L.h, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const soft = (a) => (hc ? '#ffffff' : hexA(sc.text, a));
  const rr = (x, y, ww, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
  const text = (str, x, y, size, color, o = {}) => {
    let px = size; const font = () => `${o.weight ?? 700} ${px}px ${o.font ?? UI}`;
    ctx.font = font();
    if (o.maxW) { const mw = ctx.measureText(str).width; if (mw > o.maxW) { px = Math.max(10, Math.floor((size * o.maxW) / mw)); ctx.font = font(); } }
    ctx.textAlign = o.align ?? 'center'; ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const btn = (r, label, o = {}) => {
    ctx.save(); if (o.disabled) ctx.globalAlpha = 0.4;
    const lit = o.primary || o.on, rad = Math.min(22, r.h / 2.4);
    if (hc) { ctx.fillStyle = lit ? '#ffffff' : '#000000'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    else {
      ctx.fillStyle = lit ? '#084a5e' : 'rgba(2,12,18,0.85)'; rr(r.x, r.y + 5, r.w, r.h, rad); ctx.fill();
      ctx.fillStyle = lit ? '#22b8d6' : 'rgba(14,46,60,0.96)'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(210,250,255,0.9)' : 'rgba(150,232,248,0.5)'; ctx.lineWidth = 2; rr(r.x, r.y, r.w, r.h, rad); ctx.stroke();
    }
    if (label) text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 28) * 0.35, o.size ?? 28, hc ? (lit ? '#000000' : '#ffffff') : lit ? '#04222c' : '#ffffff', { weight: 700, maxW: r.w - 16 });
    ctx.restore();
  };
  // Meaning / Thesaurus tabs: the selected one is mint green (like the app's other selected buttons), bold, with a thick bottom bar and a tick,
  // so it still reads without colour; the other is dark, light weight, thin outline, no bar.
  const tab = (r, label, on) => {
    const rad = Math.min(22, r.h / 2.4);
    ctx.save();
    if (hc) { ctx.fillStyle = on ? '#ffffff' : '#000000'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = on ? 3 : 2; ctx.stroke(); }
    else {
      ctx.fillStyle = on ? '#7ff0c0' : 'rgba(14,46,60,0.96)'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill();
      ctx.strokeStyle = on ? '#e8fff4' : 'rgba(150,232,248,0.4)'; ctx.lineWidth = on ? 3 : 1.5; rr(r.x, r.y, r.w, r.h, rad); ctx.stroke();
    }
    if (on) { ctx.fillStyle = hc ? '#000000' : '#0b6b4a'; rr(r.x + 14, r.y + r.h - 9, r.w - 28, 6, 3); ctx.fill(); }
    const fg = hc ? (on ? '#000000' : '#ffffff') : on ? '#04281c' : '#cfeaf2';
    text(on ? `\u2713 ${label}` : label, r.x + r.w / 2, r.y + r.h / 2 + 8, 28, fg, { weight: on ? 800 : 500, maxW: r.w - 16 });
    ctx.restore();
  };
  const speaker = (r, color) => {
    const u = Math.min(r.w, r.h) / 100, cx = r.x + 40 * u + (r.w > r.h * 1.5 ? 14 : 0), cy = r.y + r.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 6 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-26 * u, -12 * u); ctx.lineTo(-10 * u, -12 * u); ctx.lineTo(10 * u, -28 * u); ctx.lineTo(10 * u, 28 * u); ctx.lineTo(-10 * u, 12 * u); ctx.lineTo(-26 * u, 12 * u); ctx.closePath(); ctx.fill();
    for (let a = 1; a <= 2; a += 1) { ctx.beginPath(); ctx.arc(14 * u, 0, (12 + a * 12) * u, -0.9, 0.9); ctx.stroke(); }
    ctx.restore();
  };

  // shade + sheet
  ctx.save();
  ctx.fillStyle = hc ? 'rgba(0,0,0,0.85)' : 'rgba(2,8,14,0.62)'; ctx.fillRect(0, 0, w, h);
  const S = G.sheet;
  if (hc) { ctx.fillStyle = '#000000'; rr(S.x, S.y, S.w, S.h + 40, [30, 30, 0, 0]); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
  else {
    const g = ctx.createLinearGradient(0, S.y, 0, S.y + S.h); g.addColorStop(0, 'rgba(10,44,58,0.99)'); g.addColorStop(1, 'rgba(3,14,22,1)');
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.fillStyle = g; rr(S.x, S.y, S.w, S.h + 40, [30, 30, 0, 0]); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = hexA(CYAN, 0.55); ctx.lineWidth = 3; rr(S.x, S.y, S.w, S.h + 40, [30, 30, 0, 0]); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; rr(w / 2 - 36, S.y + 7, 72, 6, 3); ctx.fill();
  }
  // header
  const tx = G.titleX + (K.canBack ? 100 : 0);
  if (K.canBack) btn(G.back, '←', { size: 40 });
  text(K.title, tx, G.done.y + 54, K.view === 'word' ? 56 : 44, hc ? '#ffffff' : '#ffffff', { font: DISPLAY, align: 'left', maxW: G.titleMax - (K.canBack ? 100 : 0) });
  btn(G.done, 'Done', { primary: true, size: 32 });
  tab(G.tabM, 'Meaning', K.tab === 'meaning'); tab(G.tabT, 'Thesaurus', K.tab === 'thes');

  if (K.view === 'search') {
    const F = G.field;
    ctx.fillStyle = hc ? '#000000' : 'rgba(2,10,16,0.9)'; rr(F.x, F.y, F.w, F.h, 20); ctx.fill();
    ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.9); ctx.lineWidth = 3; rr(F.x, F.y, F.w, F.h, 20); ctx.stroke();
    ctx.save(); ctx.strokeStyle = soft(0.7); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(F.x + 40, F.y + 38, 14, 0, TAU); ctx.moveTo(F.x + 50, F.y + 48); ctx.lineTo(F.x + 62, F.y + 60); ctx.stroke(); ctx.restore();
    const q = lk.q, caretOn = Math.floor(state.t * 2) % 2 === 0;
    if (q) {
      text(q, F.x + 84, F.y + F.h / 2 + 15, 44, '#ffffff', { align: 'left', maxW: F.w - 84 - 90 });
      ctx.font = `700 ${44}px ${UI}`; const cw = Math.min(ctx.measureText(q).width, F.w - 84 - 90);
      if (caretOn) { ctx.fillStyle = hc ? '#ffffff' : GOLD; ctx.fillRect(F.x + 84 + cw + 3, F.y + 18, 4, 46); }
      text('✕', K.G.clear.x + K.G.clear.w / 2, F.y + F.h / 2 + 12, 34, soft(0.8));
    } else {
      text(K.tab === 'thes' ? 'Type a word to find similar words' : 'Type any English word', F.x + 84, F.y + F.h / 2 + 12, 34, soft(0.55), { align: 'left', weight: 600, maxW: F.w - 100 });
      if (caretOn) { ctx.fillStyle = hc ? '#ffffff' : GOLD; ctx.fillRect(F.x + 82, F.y + 18, 4, 46); }
    }
    btn(G.go, 'Look up', { primary: true, size: 30, disabled: !q });
    const list = K.list;
    text(K.listLabel, G.colX, G.labelY, 24, soft(0.75), { align: 'left', weight: 700 });
    list.forEach((wd, i) => {
      const r = G.rowRect(i), on = i === lk.hl;
      ctx.fillStyle = hc ? '#000000' : on ? 'rgba(34,184,214,0.35)' : 'rgba(10,36,48,0.9)'; rr(r.x, r.y, r.w, r.h, 14); ctx.fill();
      ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, on ? 0.95 : 0.4); ctx.lineWidth = on ? 3 : 2; rr(r.x, r.y, r.w, r.h, 14); ctx.stroke();
      const q2 = K.listIsSugg && lk.q && wd.startsWith(lk.q.trim().toLowerCase()) ? lk.q.trim().length : 0;
      const sz = Math.min(36, Math.floor(r.h * 0.62));
      ctx.font = `700 ${sz}px ${UI}`; ctx.textAlign = 'left';
      if (q2) { const head = wd.slice(0, q2), tail = wd.slice(q2); ctx.fillStyle = hc ? '#ffffff' : GOLD; ctx.fillText(head, r.x + 22, r.y + r.h / 2 + sz * 0.35); const hw = ctx.measureText(head).width; ctx.fillStyle = '#ffffff'; ctx.fillText(tail, r.x + 22 + hw, r.y + r.h / 2 + sz * 0.35); }
      else { ctx.fillStyle = '#ffffff'; ctx.fillText(wd, r.x + 22, r.y + r.h / 2 + sz * 0.35); }
    });
    if (!list.length) text(K.emptyNote, G.colX, G.rowRect(0).y + 34, 26, soft(0.7), { align: 'left', weight: 500, maxW: G.wide ? G.colW * 0.42 : G.colW });
    for (const k of G.keys) btn(k.r, k.label, { primary: k.primary, size: k.label.length > 1 ? Math.min(28, Math.floor(k.r.h * 0.4)) : Math.floor(k.r.h * 0.55) });
    ctx.restore();
    return;
  }

  // word view: speaker, text size, content
  btn(G.hear, '', { disabled: !K.hearOk });
  speaker(R(G.hear.x + 10, G.hear.y, 64, G.hear.h), K.hearOk ? (hc ? '#ffffff' : '#8fe6f7') : soft(0.4));
  text('Hear it', G.hear.x + 86 + (G.hear.w - 96) / 2, G.hear.y + G.hear.h / 2 + 10, 28, K.hearOk ? '#ffffff' : soft(0.5), { maxW: G.hear.w - 100 });
  btn(G.dec, 'A−', { size: 30, disabled: state.textScaleIdx <= 0 }); btn(G.inc, 'A+', { size: 30, disabled: state.textScaleIdx >= TEXT_SCALES.length - 1 });
  const vp = G.vp, F = K.layout, maxS = Math.max(0, F.height - vp.h), sy = clamp(lk.scroll, 0, maxS), left = vp.x, width = vp.w;
  const ink = hc ? '#ffffff' : '#8fe6f7', S_ = (n) => Math.round(n * scale);
  const chip = (r, label, o = {}) => {
    ctx.save(); if (o.disabled) ctx.globalAlpha = 0.35;
    const rad = Math.min(24, r.h / 2.4);
    if (hc) { ctx.fillStyle = o.on ? '#ffffff' : '#000000'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    else { ctx.fillStyle = o.on ? '#1fb3d1' : 'rgba(10,36,48,0.9)'; rr(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = o.on ? 'rgba(210,250,255,0.9)' : 'rgba(150,232,248,0.45)'; ctx.lineWidth = 2.2; rr(r.x, r.y, r.w, r.h, rad); ctx.stroke(); }
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.sz ?? 25) * 0.35, o.sz ?? 25, hc ? (o.on ? '#000000' : '#ffffff') : o.on ? '#04222c' : '#ffffff', { weight: 700, maxW: r.w - 16 });
    ctx.restore();
  };
  ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 4, vp.y, vp.w + 8, vp.h); ctx.clip();
  for (const it of F.items) {
    const top = vp.y + it.y - sy; if (top > vp.y + vp.h + 4 || top + it.h < vp.y - 4) continue;
    const row = it.row;
    switch (row.k) {
      case 'h': it.lines.forEach((ln, i) => text(ln, left, top + it.size + i * it.lh, it.size, ink, { align: 'left', weight: 800, maxW: width })); break;
      case 'p': it.lines.forEach((ln, i) => text(ln, left, top + it.size + i * it.lh, it.size, soft(row.small ? 0.8 : 0.95), { align: 'left', weight: 500, maxW: width })); break;
      case 'sub': it.lines.forEach((ln, i) => text(ln, left, top + it.size + 6 + i * it.lh, it.size, hc ? '#ffffff' : GOLD, { align: 'left', weight: 800, maxW: width })); break;
      case 'pre': it.lines.forEach((ln, i) => text(ln, left, top + it.size + i * it.lh, it.size, soft(0.88), { align: 'left', weight: 500, maxW: width })); break;
      case 'rule': ctx.fillStyle = soft(0.18); ctx.fillRect(left, top + it.h / 2, width, 2); break;
      case 'kv':
        text(row.l, left, top + it.size + 4, it.size, soft(0.9), { align: 'left', weight: 600, maxW: width * 0.4 });
        it.lines.forEach((ln, i) => text(ln, left + width, top + it.size + 4 + i * it.lh, it.size, '#ffffff', { align: 'right', weight: 700, maxW: width * 0.58 }));
        break;
      case 'chips':
        if (row.label) text(row.label, left, top + S_(26), S_(25), soft(0.92), { align: 'left', weight: 700, maxW: width });
        for (const hh of it.hits) chip({ x: left + hh.x, y: top + hh.y, w: hh.w, h: hh.h }, hh.label, { on: hh.on, disabled: hh.disabled, sz: hh.sz });
        break;
      case 'btn': case 'btn2':
        for (const hh of it.hits) btn({ x: left + hh.x, y: top + hh.y, w: hh.w, h: hh.h }, hh.label, { primary: hh.style === 'primary', size: S_(30), disabled: hh.disabled });
        break;
      default: break;
    }
  }
  ctx.restore();
  if (maxS > 0) {
    const sb = G.sb; ctx.fillStyle = hc ? '#333333' : 'rgba(255,255,255,0.14)'; rr(sb.x, sb.y, sb.w, sb.h, sb.w / 2); ctx.fill();
    const th = Math.max(48, sb.h * vp.h / F.height), ty = sb.y + (sb.h - th) * (sy / maxS); ctx.fillStyle = hc ? '#ffffff' : hexA(CYAN, 0.9); rr(sb.x, ty, sb.w, th, sb.w / 2); ctx.fill();
  }
  ctx.restore();
}

// the Word of the day card on the home screen (one card; a tap opens the dictionary sheet)
export function drawWotdCard(ctx, r, wd, o) {
  const { hc, soft, hexA, text } = o;
  ctx.save();
  ctx.fillStyle = hc ? '#000000' : 'rgba(3,16,24,0.62)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 4); ctx.fill();
  ctx.strokeStyle = hc ? '#ffffff' : hexA(GOLD, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 4); ctx.stroke();
  const px = r.x + 22, mw = r.w - 44;
  text('WORD OF THE DAY', px, r.y + r.h * 0.26, Math.round(r.h * 0.17), hc ? '#ffffff' : GOLD, { align: 'left', weight: 800, maxW: mw * 0.5 });
  if (o.yesterday) text(`Yesterday: ${o.yesterday} ›`, r.x + r.w - 22, r.y + r.h * 0.27, Math.round(r.h * 0.2), hc ? '#ffffff' : '#8fe6f7', { align: 'right', weight: 700, maxW: mw * 0.46 });
  text(wd.w, px, r.y + r.h * 0.58, Math.round(r.h * 0.34), '#ffffff', { align: 'left', weight: 800, maxW: mw * 0.5 });
  text(wd.gloss, px, r.y + r.h * 0.86, Math.round(r.h * 0.19), soft(0.85), { align: 'left', weight: 500, maxW: mw });
  ctx.restore();
}

// the search entry on the home screen
export function drawSearchEntry(ctx, r, o) {
  const { hc, soft, hexA, text } = o;
  ctx.save();
  ctx.fillStyle = hc ? '#000000' : 'rgba(3,16,24,0.78)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2.2); ctx.fill();
  ctx.strokeStyle = hc ? '#ffffff' : hexA(CYAN, 0.95); ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2.2); ctx.stroke();
  const mx = r.x + r.h * 0.55, my = r.y + r.h * 0.46, rad = r.h * 0.2;
  ctx.strokeStyle = hc ? '#ffffff' : GOLD; ctx.lineWidth = Math.max(3, r.h * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(mx, my, rad, 0, TAU); ctx.moveTo(mx + rad * 0.72, my + rad * 0.72); ctx.lineTo(mx + rad * 1.6, my + rad * 1.6); ctx.stroke();
  text('Dictionary and thesaurus', r.x + r.h + 4, r.y + r.h * 0.5, Math.round(r.h * 0.36), '#ffffff', { align: 'left', maxW: r.w - r.h - 20 });
  text('meanings, synonyms, opposites · works offline', r.x + r.h + 4, r.y + r.h * 0.8, Math.round(r.h * 0.22), soft(0.78), { align: 'left', weight: 500, maxW: r.w - r.h - 20 });
  ctx.restore();
}
