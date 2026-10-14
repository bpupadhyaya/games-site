// Shared drawing helpers for every screen: rounded panels, flat buttons, wrapped text, and a vertical "flow" layout that scales with
// the player's text size and scrolls when it no longer fits, so nothing can overflow or clip at 300%.
export const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const DISPLAY = "'Futura', 'Avenir Next Condensed', 'Arial Narrow', 'Trebuchet MS', Impact, sans-serif";
export const C = {
  ink: '#14212e', cream: '#f7f2e6', sand: '#d9b27c', night: '#0f1d2b', dusk: '#1f3a55', coral: '#ef5b3a', coralDark: '#a9301a', gold: '#f6c445',
  teal: '#2f78c4', tealDark: '#18467c', crimson: '#d6322e', panel: 'rgba(250,246,236,0.97)', shadow: 'rgba(5,14,24,0.42)',
};

export function roundPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PRESS = { x: -1, y: -1, on: false };
export function setPress(ptr) {
  if (ptr.pressed) { PRESS.x = ptr.x; PRESS.y = ptr.y; PRESS.on = true; }
  if (!ptr.down) PRESS.on = false;
}
// Buttons are lacquered and rimmed like the rest of the lawn: a lit face (top light, lower shade), a brass or dark rim, a soft drop shadow,
// and they sink 3 px with the shade flipped while pressed. Variants: primary (deep red lacquer, brass rim), active (steel-blue enamel),
// dark (slate), plain (walnut), disabled (weathered grey).
const FILL = {
  disabled: { hi: '#b9b4a8', lo: '#8f8b80', rim: ['#7d796f', '#5b5850'], text: 'rgba(40,36,30,0.6)' },
  primary: { hi: '#ff7f56', lo: '#b3301a', rim: ['#ffe6a0', '#b8862a'], text: '#fff8ea' },
  active: { hi: '#5aa4ee', lo: '#1c4f90', rim: ['#d6ecff', '#5b86b8'], text: '#ffffff' },
  dark: { hi: '#40566e', lo: '#1b2a3a', rim: ['#8da4bc', '#3a4d62'], text: '#f2f6fa' },
  plain: { hi: '#a8794a', lo: '#5c3a1e', rim: ['#e8c88a', '#7a5026'], text: '#fff6e2' },
};
export function paintButton(ctx, r, o = {}) {
  const { primary = false, active = false, disabled = false, dark = false } = o;
  const k = disabled ? 'disabled' : primary ? 'primary' : active ? 'active' : dark ? 'dark' : 'plain';
  const pressed = !disabled && PRESS.on && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  const dy = pressed ? 3 : 0, F = FILL[k], rad = Math.min(20, r.h / 2.4);
  ctx.save();
  if (!disabled) { roundPath(ctx, r.x + 1, r.y + (pressed ? 3 : 7), r.w - 2, r.h, rad); ctx.fillStyle = pressed ? 'rgba(5,10,18,0.28)' : 'rgba(5,10,18,0.5)'; ctx.fill(); }
  // rim (brass / steel), then the face inset by 3 px
  const rim = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  rim.addColorStop(0, F.rim[0]); rim.addColorStop(1, F.rim[1]);
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.fillStyle = rim; ctx.fill();
  const ix = r.x + 3, iy = r.y + dy + 3, iw = r.w - 6, ih = r.h - 6;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  if (pressed) { g.addColorStop(0, F.lo); g.addColorStop(1, F.hi); } else { g.addColorStop(0, F.hi); g.addColorStop(1, F.lo); }
  roundPath(ctx, ix, iy, iw, ih, Math.max(4, rad - 3)); ctx.fillStyle = g; ctx.fill();
  if (!disabled) {
    // sheen: a soft light band across the upper half, and a thin dark line under the face
    ctx.save(); roundPath(ctx, ix, iy, iw, ih, Math.max(4, rad - 3)); ctx.clip();
    const sh = ctx.createLinearGradient(0, iy, 0, iy + ih * 0.55);
    sh.addColorStop(0, pressed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.3)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(ix, iy, iw, ih * 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(ix, iy + ih - 3, iw, 3);
    ctx.restore();
  }
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,10,4,0.65)'; roundPath(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.stroke();
  ctx.restore();
  return { dy, light: true, text: F.text };
}

export function drawButton(ctx, r, label, opts = {}) {
  const { disabled = false, sub = null, size = 28 } = opts;
  const { dy, text } = paintButton(ctx, r, opts);
  ctx.save();
  ctx.fillStyle = text;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = sub ? Math.round(size * 0.9) : size;
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 24 && px > 12) { px -= 1; ctx.font = `700 ${px}px ${FONT}`; }
  if (!disabled) { ctx.shadowColor = 'rgba(20,8,2,0.55)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1.5; }
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 - (sub ? 11 : 0));
  if (sub) { ctx.font = `400 ${Math.round(size * 0.58)}px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText(sub, r.x + r.w / 2, r.y + dy + r.h / 2 + size * 0.5); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function panel(ctx, x, y, w, h, o = {}) {
  const { r = 26, fill = C.panel, stroke = 'rgba(30,50,80,0.55)', shadow = true } = o;
  ctx.save();
  if (shadow) { roundPath(ctx, x + 2, y + 9, w - 4, h, r); ctx.fillStyle = 'rgba(5,10,18,0.5)'; ctx.fill(); }
  // walnut frame with a brass hairline, then the fill inset by 7 px
  const fr = ctx.createLinearGradient(0, y, 0, y + h);
  fr.addColorStop(0, '#9a6c3e'); fr.addColorStop(0.5, '#6a4425'); fr.addColorStop(1, '#4a2e17');
  roundPath(ctx, x, y, w, h, r); ctx.fillStyle = fr; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,226,150,0.55)'; roundPath(ctx, x + 1, y + 1, w - 2, h - 2, r - 1); ctx.stroke();
  const b = 7;
  roundPath(ctx, x + b, y + b, w - 2 * b, h - 2 * b, Math.max(6, r - b + 2)); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.restore();
}

// ---- the lawn-side woodwork behind the play HUD -----------------------------------------------------------------------------------
// A walnut board (planks, grain, a soft vignette) painted once per size into an offscreen canvas.
const WOOD = { key: '', cv: null, make: null };
export const setCanvasFactory = (fn) => { WOOD.make = fn; };   // main.js hands in an offscreen canvas maker
export function woodBackdrop(ctx, w, h) {
  const key = `${w}x${h}`;
  if (WOOD.make && WOOD.key !== key) {
    const c = WOOD.make(); c.width = w; c.height = h;
    paintWood(c.getContext('2d'), w, h); WOOD.key = key; WOOD.cv = c;
  }
  if (WOOD.cv && WOOD.key === key) ctx.drawImage(WOOD.cv, 0, 0);
  else { ctx.fillStyle = '#3a2412'; ctx.fillRect(0, 0, w, h); }
}
function paintWood(g, w, h) {
  const planks = Math.max(3, Math.round(w / 180)), pw = w / planks;
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < planks; i++) {
    const t = 0.82 + rnd() * 0.3, x = i * pw;
    const gr = g.createLinearGradient(x, 0, x + pw, 0);
    gr.addColorStop(0, `rgb(${Math.round(70 * t)},${Math.round(44 * t)},${Math.round(24 * t)})`);
    gr.addColorStop(0.5, `rgb(${Math.round(86 * t)},${Math.round(55 * t)},${Math.round(30 * t)})`);
    gr.addColorStop(1, `rgb(${Math.round(64 * t)},${Math.round(40 * t)},${Math.round(22 * t)})`);
    g.fillStyle = gr; g.fillRect(x, 0, pw + 1, h);
    for (let k = 0; k < 26; k++) {
      const gx = x + 6 + rnd() * (pw - 12), a = 0.05 + rnd() * 0.1, wob = (rnd() - 0.5) * 14;
      g.strokeStyle = rnd() > 0.5 ? `rgba(20,10,4,${a})` : `rgba(190,130,70,${a * 0.8})`; g.lineWidth = 0.7 + rnd() * 1.4;
      g.beginPath(); g.moveTo(gx, 0); g.bezierCurveTo(gx + wob, h * 0.33, gx - wob, h * 0.66, gx + wob * 0.4, h); g.stroke();
    }
    g.fillStyle = 'rgba(10,5,2,0.55)'; g.fillRect(x, 0, 2, h);
    g.fillStyle = 'rgba(255,214,150,0.08)'; g.fillRect(x + 2, 0, 1.5, h);
  }
  const v = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

// A rounded window in the HUD where the 3D scene shows through (the kit canvas is transparent behind it), with a walnut frame
// and a short inner shadow so it reads as a recess.
export function glWindow(ctx, r, rad = 22) {
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip(); ctx.clearRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  const sh = ctx.createLinearGradient(0, r.y, 0, r.y + 26); sh.addColorStop(0, 'rgba(0,0,0,0.38)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, 26);
  ctx.restore();
  const b = 8;
  ctx.save();
  ctx.beginPath();
  const rr = (x, y, w, h, q) => { ctx.moveTo(x + q, y); ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q); ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath(); };
  rr(r.x - b, r.y - b, r.w + 2 * b, r.h + 2 * b, rad + b); rr(r.x, r.y, r.w, r.h, rad);
  const fr = ctx.createLinearGradient(0, r.y - b, 0, r.y + r.h + b);
  fr.addColorStop(0, '#b98650'); fr.addColorStop(0.5, '#7a5028'); fr.addColorStop(1, '#4e301a');
  ctx.fillStyle = fr; ctx.fill('evenodd');
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,226,150,0.6)'; roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,10,4,0.8)'; roundPath(ctx, r.x - b, r.y - b, r.w + 2 * b, r.h + 2 * b, rad + b); ctx.stroke();
  ctx.restore();
}

// Embossed lettering: steel or gold. Dark outline, a vertical metal gradient with a bright band, a rim light along the top edge,
// and a contact shadow, so the title reads as cast metal rather than flat type.
export function metalText(ctx, text, x, y, px, o = {}) {
  const { kind = 'steel', font = `700 ${px}px ${DISPLAY}`, align = 'center', outline = 'rgba(14,8,4,0.92)' } = o;
  const P = kind === 'gold'
    ? [[0, '#fff3b8'], [0.28, '#ffd35a'], [0.5, '#e0a023'], [0.55, '#fff0a0'], [0.8, '#c88410'], [1, '#8a540a']]
    : [[0, '#ffffff'], [0.3, '#dfe6ee'], [0.5, '#aab6c3'], [0.55, '#e9eff5'], [0.8, '#8794a3'], [1, '#56626f']];
  ctx.save();
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = px * 0.18; ctx.shadowOffsetY = px * 0.07;
  ctx.lineWidth = Math.max(3, px * 0.1); ctx.strokeStyle = outline; ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, y - px * 0.78, 0, y + px * 0.04);
  for (const [t, c] of P) g.addColorStop(t, c);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.lineWidth = Math.max(1, px * 0.02); ctx.strokeStyle = kind === 'gold' ? 'rgba(255,250,210,0.85)' : 'rgba(255,255,255,0.8)';
  ctx.save(); ctx.beginPath(); ctx.rect(x - 2000, y - px * 0.9, 4000, px * 0.28); ctx.clip(); ctx.strokeText(text, x, y - px * 0.012); ctx.restore();
  ctx.restore();
}

export function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
export function textShadow(ctx, text, x, y, fill = '#f7f2e6', blur = 4) {
  ctx.save();
  ctx.shadowColor = 'rgba(5,14,24,0.75)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// ---- flow layout -----------------------------------------------------------------------------------------------------------
//   widget: { t: 'h'|'p'|'btn'|'gap'|'art', id, label, sub, row, primary, active, disabled, dark, h, draw }
const GAP = 14;
export function flowLayout(ctx, widgets, scale, o = {}) {
  const x0 = o.x ?? 40, w0 = o.w ?? 640;
  let y = 0;
  const out = [];
  let i = 0;
  while (i < widgets.length) {
    const wd = widgets[i];
    if (wd.t === 'btn' && wd.row !== undefined) {
      const group = [];
      while (i < widgets.length && widgets[i].t === 'btn' && widgets[i].row === wd.row) group.push(widgets[i++]);
      const fs = Math.round((o.btn ?? 26) * Math.min(scale, 3));
      ctx.font = `700 ${fs}px ${FONT}`;
      const cw0 = (w0 - GAP * (group.length - 1)) / group.length;
      const tooWide = group.some((g) => g.label.split(' ').some((word) => ctx.measureText(word).width > cw0 - 28));
      if (tooWide || (scale > 1.5 && group.length > 1)) { widgets.splice(i, 0, ...group.map((g) => ({ ...g, row: undefined, h: g.h ?? 88 }))); continue; }
      let hmax = 0;
      const prepared = group.map((g) => {
        ctx.font = `700 ${fs}px ${FONT}`;
        const lines = wrapLines(ctx, g.label, cw0 - 28), sub = g.sub ? wrapLines(ctx, g.sub, cw0 - 28).length : 0;
        const h = Math.max(g.h ?? 88, lines.length * fs * 1.15 + sub * fs * 0.72 + 34);
        hmax = Math.max(hmax, h);
        return { g, lines, h };
      });
      prepared.forEach((p, k) => out.push({ w: p.g, x: x0 + k * (cw0 + GAP), y, wd: cw0, h: hmax, fs, lines: p.lines }));
      y += hmax + GAP;
      continue;
    }
    i++;
    if (wd.t === 'gap') { y += wd.h ?? 20; continue; }
    if (wd.t === 'art') { out.push({ w: wd, x: x0, y, wd: w0, h: wd.h }); y += wd.h + GAP; continue; }
    if (wd.t === 'h') {
      const fs = Math.round((wd.size ?? 44) * Math.min(scale, wd.cap ?? 1.7));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0), h = lines.length * fs * 1.18;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'p') {
      const fs = Math.round((wd.size ?? 26) * Math.min(scale, wd.cap ?? 3));
      ctx.font = `${wd.bold ? 700 : 400} ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - (wd.pad ?? 0) * 2), h = lines.length * fs * 1.3;
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
      continue;
    }
    if (wd.t === 'btn') {
      const fs = Math.round((o.btn ?? 26) * Math.min(scale, 3));
      ctx.font = `700 ${fs}px ${FONT}`;
      const lines = wrapLines(ctx, wd.label, w0 - 28), sub = wd.sub ? wrapLines(ctx, wd.sub, w0 - 28).length : 0;
      const h = Math.max(wd.h ?? 88, lines.length * fs * 1.15 + sub * fs * 0.72 + 34);
      out.push({ w: wd, x: x0, y, wd: w0, h, fs, lines }); y += h + GAP;
    }
  }
  return { items: out, contentH: y };
}

export function drawFlow(ctx, lay, top, bottom, scroll, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(o.clipX ?? 0, top, o.clipW ?? 100000, bottom - top); ctx.clip();
  for (const it of lay.items) {
    const y = top + it.y - scroll;
    if (y > bottom || y + it.h < top) continue;
    const wd = it.w;
    if (wd.t === 'art') { ctx.save(); ctx.translate(it.x, y); wd.draw(ctx, it.wd, it.h); ctx.restore(); }
    else if (wd.t === 'h') {
      ctx.font = `700 ${it.fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, k) => textShadow(ctx, l, it.x + it.wd / 2, y + it.fs * (0.9 + k * 1.18), wd.color ?? '#f7f2e6', 6));
    } else if (wd.t === 'p') {
      ctx.fillStyle = wd.color ?? 'rgba(247,242,230,0.95)'; ctx.font = `${wd.bold ? 700 : 400} ${it.fs}px ${FONT}`;
      ctx.textAlign = wd.align ?? 'center'; ctx.textBaseline = 'alphabetic';
      const px = wd.align === 'left' ? it.x + (wd.pad ?? 0) : it.x + it.wd / 2;
      it.lines.forEach((l, k) => { ctx.save(); ctx.shadowColor = 'rgba(5,14,24,0.6)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(l, px, y + it.fs * (1 + k * 1.3)); ctx.restore(); });
    } else if (wd.t === 'btn') drawButtonRect(ctx, { x: it.x, y, w: it.wd, h: it.h }, it, wd);
  }
  ctx.restore();
}
function drawButtonRect(ctx, r, it, wd) {
  const { dy, text } = paintButton(ctx, r, wd);
  ctx.save();
  ctx.fillStyle = text;
  if (!wd.disabled) { ctx.shadowColor = 'rgba(20,8,2,0.55)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1.5; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${Math.round(it.fs * 0.72)}px ${FONT}`;
  const subLines = wd.sub ? wrapLines(ctx, wd.sub, r.w - 28) : [];
  ctx.font = `700 ${it.fs}px ${FONT}`;
  const total = it.lines.length * it.fs * 1.15 + subLines.length * it.fs * 0.72;
  let y = r.y + dy + (r.h - total) / 2 + it.fs * 0.88;
  it.lines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 1.15; });
  if (subLines.length) {
    ctx.font = `400 ${Math.round(it.fs * 0.72)}px ${FONT}`; ctx.globalAlpha = 0.85; y -= it.fs * 0.2;
    subLines.forEach((l) => { ctx.fillText(l, r.x + r.w / 2, y); y += it.fs * 0.72; });
    ctx.globalAlpha = 1;
  }
  if (wd.stars) {
    ctx.font = `400 ${Math.round(it.fs * 0.7)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffe9a0';
    ctx.fillText('★'.repeat(wd.stars) + '☆'.repeat(5 - wd.stars), r.x + r.w - 16, r.y + dy + it.fs * 0.95);
  }
  ctx.restore();
}
export function flowHit(lay, top, scroll, x, y) {
  for (const it of lay.items) {
    if (it.w.t !== 'btn' || (it.w.disabled && !it.w.hitDisabled)) continue;
    const yy = top + it.y - scroll;
    if (x >= it.x && x <= it.x + it.wd && y >= yy && y <= yy + it.h) return it.w.id;
  }
  return null;
}
