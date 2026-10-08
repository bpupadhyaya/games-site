// A small immediate-mode UI kit for the canvas: every control is drawn AND registered as a hit rect in the same call, so what
// you tap is exactly what was drawn. All text goes through ui.text so text zoom (up to 300%) and the minimum readable size
// are applied in one place. Scrolling areas keep content reachable at any zoom.
import { brandGradient } from './brand.js';

export const FONT_D = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", system-ui, sans-serif';
export const FONT_B = '"Barlow", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const COL = {
  bg: '#070d1a', ink: '#eef5ff', dim: 'rgba(205,222,250,0.72)', faint: 'rgba(205,222,250,0.42)', line: 'rgba(160,190,240,0.22)',
  orange: '#ff8a2a', orange2: '#ffb347', cyan: '#2fd4e6', blue: '#3b82f6', violet: '#8b5cf6', red: '#ff5a5f', green: '#35d07f', gold: '#ffd25a',
  panel: 'rgba(8,15,30,0.78)', panel2: 'rgba(14,26,50,0.82)', navy: '#0a1428',
};

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const R = (x, y, w, h) => ({ x, y, w, h });

export function createUI() {
  const ui = {
    hits: [], prev: [], zoom: 1, k: 0.55, clip: null, regions: {}, key: 'main', t: 0,
    begin(k, t) { ui.prev = ui.hits; ui.hits = []; ui.k = k || 0.55; ui.t = t; ui.clip = null; ui.zoom = 1; },
    hit(id, r, data) { ui.hits.push({ id, r, data, clip: ui.clip }); },
    // topmost control under a point, from the previous frame
    at(x, y) {
      for (let i = ui.prev.length - 1; i >= 0; i--) {
        const h = ui.prev[i];
        if (inRect(h.r, x, y) && (!h.clip || inRect(h.clip, x, y))) return h;
      }
      return null;
    },
    fs(size) { return Math.max(size * ui.zoom, 11.5 / ui.k); },
    text(ctx, str, x, y, size, o = {}) {
      let s = o.fixed ? size : ui.fs(size);
      if (o.fit) {
        const fam = o.disp ? FONT_D : FONT_B, f0 = s, floor = Math.max(f0 * 0.55, 11.5 / ui.k);
        const wd = (sz) => { ctx.font = `${o.weight ?? 600} ${sz}px ${fam}`; return ctx.measureText(str).width; };
        while (s > floor && wd(s) > o.fit) s -= 1;
        if (wd(s) > o.fit) { let t = str; while (t.length > 1 && wd(s) > o.fit) { t = t.slice(0, -1); str = t + '\u2026'; if (wd(s) <= o.fit) break; } }
        o = { ...o, fixed: true };
      }
      ctx.font = `${o.weight ?? 600} ${s}px ${o.disp ? FONT_D : FONT_B}`;
      ctx.fillStyle = o.color ?? COL.ink; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'alphabetic';
      if (o.shadow) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(str, x + 0, y + s * 0.07); ctx.restore(); ctx.fillStyle = o.color ?? COL.ink; }
      if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? '#08122a'; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
      ctx.fillText(str, x, y);
      return s;
    },
    measure(ctx, str, size, o = {}) {
      const s = o.fixed ? size : ui.fs(size);
      ctx.font = `${o.weight ?? 600} ${s}px ${o.disp ? FONT_D : FONT_B}`;
      return ctx.measureText(str).width;
    },
    lines(ctx, str, maxW, size, o = {}) {
      const s = o.fixed ? size : ui.fs(size);
      ctx.font = `${o.weight ?? 600} ${s}px ${o.disp ? FONT_D : FONT_B}`;
      const out = [];
      for (const para of String(str).split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const next = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
        }
        out.push(line);
      }
      return out;
    },
    // draws wrapped text, returns the height used
    para(ctx, str, x, y, maxW, size, o = {}) {
      const s = o.fixed ? size : ui.fs(size), lh = s * (o.lh ?? 1.32);
      const ls = ui.lines(ctx, str, maxW, size, o);
      let yy = y;
      for (const l of ls) { ui.text(ctx, l, x, yy + s, size, o); yy += lh; }
      return yy - y;
    },
    paraHeight(ctx, str, maxW, size, o = {}) {
      const s = o.fixed ? size : ui.fs(size);
      return ui.lines(ctx, str, maxW, size, o).length * s * (o.lh ?? 1.32);
    },
    panel(ctx, r, o = {}) {
      const rad = o.radius ?? 22;
      ctx.save();
      if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.roundRect(r.x, r.y + 5, r.w, r.h, rad); ctx.fill(); }
      ctx.fillStyle = o.fill ?? COL.panel; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
      if (o.edge !== false) {
        ctx.lineWidth = 1.5; ctx.strokeStyle = brandGradient(ctx, r.x, r.y, r.x + r.w, r.y + r.h, o.edgeAlpha ?? 0.5);
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.stroke();
      }
      ctx.restore();
    },
    // kind: 'primary' | 'secondary' | 'ghost' | 'danger' | 'chip' | 'on'
    button(ctx, id, r, label, o = {}) {
      const kind = o.kind ?? 'secondary', pressed = o.pressed || ui.pressedId === id;
      const dis = !!o.disabled;
      const rad = o.radius ?? Math.min(r.h / 2, 26), oy = pressed && !dis ? 3 : 0;
      ctx.save();
      const fill = kind === 'primary' ? COL.orange : kind === 'danger' ? '#d9434a' : kind === 'on' ? '#1f6fe0' : kind === 'chip' ? 'rgba(255,255,255,0.1)' : kind === 'ghost' ? 'rgba(255,255,255,0.0)' : 'rgba(26,42,78,0.9)';
      const under = kind === 'primary' ? '#b4540c' : kind === 'danger' ? '#8e2229' : kind === 'on' ? '#123f86' : kind === 'ghost' ? null : 'rgba(0,0,0,0.38)';
      if (under && !pressed) { ctx.fillStyle = under; ctx.beginPath(); ctx.roundRect(r.x, r.y + 5, r.w, r.h, rad); ctx.fill(); }
      ctx.globalAlpha = dis ? 0.4 : 1;
      ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(r.x, r.y + oy, r.w, r.h, rad); ctx.fill();
      if (kind === 'secondary' || kind === 'chip' || kind === 'ghost') { ctx.lineWidth = 1.5; ctx.strokeStyle = kind === 'ghost' ? 'rgba(180,205,250,0.38)' : 'rgba(160,190,240,0.32)'; ctx.beginPath(); ctx.roundRect(r.x, r.y + oy, r.w, r.h, rad); ctx.stroke(); }
      const tc = kind === 'primary' ? '#1a1206' : COL.ink;
      const size = Math.min(o.size ?? Math.min(34, r.h * 0.46), Math.max(11.5 / ui.k, (r.h * 0.5) / Math.max(1, ui.zoom)));
      const hasSub = !!o.sub;
      let label2 = label;
      const iconW = o.icon ? size * 1.5 : 0;
      let tw = ui.measure(ctx, label2, size, { disp: true, weight: 800 });
      const maxW = r.w - 24 - iconW;
      let sz = size;
      while (tw > maxW && sz > 12) { sz -= 1; tw = ui.measure(ctx, label2, sz, { disp: true, weight: 800, fixed: true }); }
      const fixed = sz !== size;
      const cy = r.y + oy + r.h / 2;
      const startX = r.x + r.w / 2 - (tw + iconW) / 2;
      if (o.icon) icon(ctx, o.icon, startX + size * 0.55, cy - (hasSub ? r.h * 0.08 : 0), size * 0.95, tc);
      ui.text(ctx, label2, startX + iconW + (o.align === 'left' ? 0 : 0), cy + (hasSub ? -r.h * 0.04 : sz * 0.33), sz, { disp: true, weight: 800, color: tc, fixed });
      if (hasSub) ui.text(ctx, o.sub, r.x + r.w / 2, cy + r.h * 0.3, Math.max(Math.min(20, r.h * 0.2), 11.5 / ui.k), { align: 'center', color: kind === 'primary' ? 'rgba(26,18,6,0.78)' : COL.dim, weight: 600, fixed: true, fit: r.w - 24 });
      ctx.restore();
      if (!dis) ui.hit(id, r, o.data);
    },
    // switch row: label left, pill right. Height grows with the text (zoom).
    toggleHeight(ctx, w, label, sub) {
      const pw = Math.min(110, w * 0.3);
      return Math.max(76, ui.fs(26) * 1.3 + (sub ? ui.paraHeight(ctx, sub, w - pw - 16, 20) : 0) + 22);
    },
    toggle(ctx, id, r, label, on, sub) {
      const pw = Math.min(110, r.w * 0.3), ph = 44, tw = r.w - pw - 16;
      ui.text(ctx, label, r.x, r.y + 12 + ui.fs(26), 26, { weight: 700, fit: tw });
      if (sub) ui.para(ctx, sub, r.x, r.y + 14 + ui.fs(26) * 1.3, tw, 20, { color: COL.dim, weight: 500 });
      const px = r.x + r.w - pw, py = r.y + Math.min(r.h / 2, 40) - ph / 2 + (r.h > 100 ? 8 : 0);
      ctx.save(); ctx.fillStyle = on ? COL.green : 'rgba(120,140,180,0.35)'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(on ? px + pw - ph / 2 : px + ph / 2, py + ph / 2, ph / 2 - 4, 0, 6.3); ctx.fill(); ctx.restore();
      ui.hit(id, R(r.x - 8, r.y, r.w + 16, r.h));
    },
    // segmented chooser: options [{id,label}], current id
    segment(ctx, idPrefix, r, options, cur) {
      const n = options.length, gap = 8, w = (r.w - gap * (n - 1)) / n;
      options.forEach((o, i) => ui.button(ctx, `${idPrefix}:${o.id}`, R(r.x + i * (w + gap), r.y, w, r.h), o.label, { kind: o.id === cur ? 'on' : 'chip', size: Math.min(26, r.h * 0.44) }));
    },
    // ---- scrolling: any number of independent regions, keyed ------------------------------------------------------------
    region(key) { return ui.regions[key] || (ui.regions[key] = { y: 0, max: 0, view: null, drag: null, seen: 0 }); },
    beginScroll(ctx, view, key = 'main') {
      const s = ui.region(key); s.view = view; s.seen = ui.t; ui.key = key;
      ctx.save(); ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
      ui.clip = view; ctx.translate(0, -s.y);
      return view.y;
    },
    endScroll(ctx, contentH, key = ui.key) {
      const s = ui.region(key); ctx.restore(); ui.clip = null;
      s.max = Math.max(0, contentH - s.view.h);
      s.y = Math.max(0, Math.min(s.y, s.max));
      if (s.max > 0) {
        const v = s.view, th = Math.max(36, v.h * (v.h / contentH)), ty = v.y + (v.h - th) * (s.y / s.max);
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(v.x + v.w - 8, v.y, 5, v.h, 3); ctx.fill();
        ctx.fillStyle = 'rgba(160,200,255,0.55)'; ctx.beginPath(); ctx.roundRect(v.x + v.w - 8, ty, 5, th, 3); ctx.fill(); ctx.restore();
      }
    },
    resetScroll() { ui.regions = {}; },
    scrollWheel(p, dy) {
      for (const k of Object.keys(ui.regions)) { const s = ui.regions[k]; if (s.view && s.seen >= ui.t - 0.2 && inRect(s.view, p.x, p.y)) { s.y = Math.max(0, Math.min(s.max, s.y + dy)); return; } }
      const m = ui.regions.main; if (m) m.y = Math.max(0, Math.min(m.max, m.y + dy));
    },
    // call from update with the pointer; returns true while a drag is scrolling (so taps are not fired)
    scrollInput(p) {
      let moved = false;
      for (const k of Object.keys(ui.regions)) {
        const s = ui.regions[k];
        if (!s.view || s.max <= 0 || s.seen < ui.t - 0.2) { s.drag = null; continue; }
        if (p.pressed && inRect(s.view, p.x, p.y)) s.drag = { y0: p.y, s0: s.y, moved: false };
        if (s.drag) {
          if (!p.down) { if (s.drag.moved) moved = true; s.drag = null; continue; }
          if (Math.abs(p.y - s.drag.y0) > 10) s.drag.moved = true;
          if (s.drag.moved) { s.y = Math.max(0, Math.min(s.max, s.drag.s0 - (p.y - s.drag.y0))); moved = true; }
        }
      }
      return moved;
    },
    pressedId: null,
  };
  return ui;
}

// ---- vector icons ---------------------------------------------------------------------------------------------------------
export function icon(ctx, name, cx, cy, s, color = '#fff') {
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = s / 2;
  switch (name) {
    case 'pause': ctx.fillRect(-h * 0.55, -h * 0.7, h * 0.4, h * 1.4); ctx.fillRect(h * 0.15, -h * 0.7, h * 0.4, h * 1.4); break;
    case 'play': ctx.beginPath(); ctx.moveTo(-h * 0.5, -h * 0.75); ctx.lineTo(h * 0.8, 0); ctx.lineTo(-h * 0.5, h * 0.75); ctx.closePath(); ctx.fill(); break;
    case 'back': ctx.beginPath(); ctx.moveTo(h * 0.35, -h * 0.7); ctx.lineTo(-h * 0.4, 0); ctx.lineTo(h * 0.35, h * 0.7); ctx.stroke(); break;
    case 'close': ctx.beginPath(); ctx.moveTo(-h * 0.6, -h * 0.6); ctx.lineTo(h * 0.6, h * 0.6); ctx.moveTo(h * 0.6, -h * 0.6); ctx.lineTo(-h * 0.6, h * 0.6); ctx.stroke(); break;
    case 'gear': { ctx.beginPath(); ctx.arc(0, 0, h * 0.5, 0, 6.3); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; ctx.beginPath(); ctx.moveTo(Math.cos(a) * h * 0.62, Math.sin(a) * h * 0.62); ctx.lineTo(Math.cos(a) * h * 0.9, Math.sin(a) * h * 0.9); ctx.stroke(); } break; }
    case 'info': ctx.beginPath(); ctx.arc(0, 0, h * 0.85, 0, 6.3); ctx.stroke(); ctx.fillRect(-h * 0.08, -h * 0.1, h * 0.16, h * 0.6); ctx.beginPath(); ctx.arc(0, -h * 0.4, h * 0.1, 0, 6.3); ctx.fill(); break;
    case 'book': ctx.beginPath(); ctx.moveTo(-h * 0.8, -h * 0.6); ctx.lineTo(0, -h * 0.4); ctx.lineTo(h * 0.8, -h * 0.6); ctx.lineTo(h * 0.8, h * 0.6); ctx.lineTo(0, h * 0.8); ctx.lineTo(-h * 0.8, h * 0.6); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -h * 0.4); ctx.lineTo(0, h * 0.8); ctx.stroke(); break;
    case 'trophy': ctx.beginPath(); ctx.moveTo(-h * 0.5, -h * 0.7); ctx.lineTo(h * 0.5, -h * 0.7); ctx.lineTo(h * 0.4, h * 0.05); ctx.quadraticCurveTo(0, h * 0.4, -h * 0.4, h * 0.05); ctx.closePath(); ctx.fill(); ctx.fillRect(-h * 0.08, h * 0.2, h * 0.16, h * 0.4); ctx.fillRect(-h * 0.4, h * 0.6, h * 0.8, h * 0.14); ctx.beginPath(); ctx.arc(-h * 0.62, -h * 0.35, h * 0.22, 1.2, 4.9); ctx.stroke(); ctx.beginPath(); ctx.arc(h * 0.62, -h * 0.35, h * 0.22, 4.4, 8.1); ctx.stroke(); break;
    case 'bulb': ctx.beginPath(); ctx.arc(0, -h * 0.2, h * 0.55, 0, 6.3); ctx.stroke(); ctx.fillRect(-h * 0.25, h * 0.4, h * 0.5, h * 0.12); ctx.fillRect(-h * 0.18, h * 0.62, h * 0.36, h * 0.1); break;
    case 'sound': ctx.beginPath(); ctx.moveTo(-h * 0.7, -h * 0.25); ctx.lineTo(-h * 0.3, -h * 0.25); ctx.lineTo(h * 0.15, -h * 0.65); ctx.lineTo(h * 0.15, h * 0.65); ctx.lineTo(-h * 0.3, h * 0.25); ctx.lineTo(-h * 0.7, h * 0.25); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(h * 0.15, 0, h * 0.5, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(h * 0.15, 0, h * 0.85, -0.8, 0.8); ctx.stroke(); break;
    case 'mute': ctx.beginPath(); ctx.moveTo(-h * 0.7, -h * 0.25); ctx.lineTo(-h * 0.3, -h * 0.25); ctx.lineTo(h * 0.15, -h * 0.65); ctx.lineTo(h * 0.15, h * 0.65); ctx.lineTo(-h * 0.3, h * 0.25); ctx.lineTo(-h * 0.7, h * 0.25); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(h * 0.45, -h * 0.35); ctx.lineTo(h * 0.95, h * 0.35); ctx.moveTo(h * 0.95, -h * 0.35); ctx.lineTo(h * 0.45, h * 0.35); ctx.stroke(); break;
    case 'ball': ctx.beginPath(); ctx.arc(0, 0, h * 0.7, 0, 6.3); ctx.fill(); break;
    case 'eye': ctx.beginPath(); ctx.moveTo(-h * 0.9, 0); ctx.quadraticCurveTo(0, -h * 0.9, h * 0.9, 0); ctx.quadraticCurveTo(0, h * 0.9, -h * 0.9, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.26, 0, 6.3); ctx.fill(); break;
    case 'target': ctx.beginPath(); ctx.arc(0, 0, h * 0.8, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.4, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.1, 0, 6.3); ctx.fill(); break;
    case 'paddle': ctx.beginPath(); ctx.arc(0, -h * 0.2, h * 0.62, 0, 6.3); ctx.fill(); ctx.fillRect(-h * 0.1, h * 0.35, h * 0.2, h * 0.55); break;
    case 'cup': ctx.beginPath(); ctx.moveTo(-h * 0.55, -h * 0.65); ctx.lineTo(h * 0.55, -h * 0.65); ctx.lineTo(h * 0.35, h * 0.2); ctx.lineTo(-h * 0.35, h * 0.2); ctx.closePath(); ctx.fill(); ctx.fillRect(-h * 0.1, h * 0.2, h * 0.2, h * 0.35); ctx.fillRect(-h * 0.45, h * 0.55, h * 0.9, h * 0.16); break;
    case 'lock': ctx.fillRect(-h * 0.5, -h * 0.1, h, h * 0.8); ctx.beginPath(); ctx.arc(0, -h * 0.1, h * 0.35, Math.PI, 0); ctx.stroke(); break;
    case 'check': ctx.beginPath(); ctx.moveTo(-h * 0.6, 0); ctx.lineTo(-h * 0.15, h * 0.45); ctx.lineTo(h * 0.65, -h * 0.5); ctx.stroke(); break;
    case 'star': { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? h * 0.38 : h * 0.85, a = -1.5708 + i * 0.6283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break; }
    case 'refresh': ctx.beginPath(); ctx.arc(0, 0, h * 0.65, 0.5, 5.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(h * 0.45, -h * 0.9); ctx.lineTo(h * 0.75, -h * 0.4); ctx.lineTo(h * 0.2, -h * 0.35); ctx.closePath(); ctx.fill(); break;
    default: break;
  }
  ctx.restore();
}

export function textZoomBar(ctx, ui, r, scaleIdx, count) {
  // A- [ 150% ] A+
  const bw = Math.min(r.h * 1.5, r.w * 0.28);
  ui.button(ctx, 'zoom-', R(r.x, r.y, bw, r.h), 'A−', { kind: 'chip', disabled: scaleIdx <= 0, size: r.h * 0.5 });
  ui.button(ctx, 'zoom+', R(r.x + r.w - bw, r.y, bw, r.h), 'A+', { kind: 'chip', disabled: scaleIdx >= count - 1, size: r.h * 0.5 });
}
