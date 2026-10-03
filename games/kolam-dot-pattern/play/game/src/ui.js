// Deterministic text measuring + a small document layout engine used by every text-bearing screen
// (menu, level select, rules, how to play, about, settings, overlays). The same layout is computed
// for drawing (view.js) and for hit-testing (game.js), so what you see is exactly what you tap, at
// every text-zoom step. No canvas access here: widths come from a per-character estimate.

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

const CJK = /[⺀-鿿＀-￯　-〿]/;
const NARROW = new Set("iIl.,'!:;|`·".split(''));
const MID = new Set('fjrt()[]/\\-"“”’'.split(''));
const WIDE = new Set('mwMW@%'.split(''));

export function charW(ch) {
  if (CJK.test(ch)) return 1;
  if (ch === ' ') return 0.29;
  if (NARROW.has(ch)) return 0.3;
  if (MID.has(ch)) return 0.4;
  if (WIDE.has(ch)) return 0.9;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  if (ch >= '0' && ch <= '9') return 0.6;
  return 0.56;
}

export function tw(str, size) {
  let w = 0;
  for (const ch of String(str)) w += charW(ch);
  return w * size * 1.08;
}

const TOKEN = /[⺀-鿿＀-￯　-〿]|[^\s⺀-鿿＀-￯　-〿]+|\s+/g;

// Wraps into lines no wider than maxW (a single over-long word is allowed to overflow, then broken).
export function wrap(text, size, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const tokens = para.match(TOKEN) ?? [''];
    let line = '';
    for (const tok of tokens) {
      const isSpace = /^\s+$/.test(tok);
      if (isSpace && !line) continue;
      const trial = line + tok;
      if (tw(trial.trimEnd(), size) <= maxW || !line) {
        // a lone token wider than the line: split by characters
        if (!line && !isSpace && tw(tok, size) > maxW) {
          let part = '';
          for (const ch of tok) {
            if (tw(part + ch, size) > maxW && part) { lines.push(part); part = ch; } else part += ch;
          }
          line = part;
        } else line = trial;
      } else {
        lines.push(line.trimEnd());
        line = isSpace ? '' : tok;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

const sp = (v, scale) => v * (0.55 + 0.45 * scale);

// Block types:
//  h    { text, size }                 heading (display font)
//  p    { text, size, align, dim }     paragraph
//  img  { h, name, data }              illustration drawn by view.js (fixed height)
//  btn  { id, label, kind, size, sub } full-width button (kind: primary | normal | on | danger)
//  row  { items:[{ id, label, kind, disabled, flex }], size }  equal-width buttons / static labels (id null)
//  grid { cols, cells:[{ id, label, sub, state, stars, locked }] } level cells
//  gap  { h }
export function layoutDoc(blocks, scale, width, opts = {}) {
  const items = [];
  let y = 0;
  const side = opts.side ?? 0;
  const W = width - side * 2;
  for (const b of blocks) {
    const it = { b, y, h: 0, x: side, w: W, lines: null, size: 0, line: 0, btns: [] };
    if (b.t === 'h') {
      it.size = (b.size ?? 34) * scale;
      it.line = it.size * 1.25;
      it.lines = wrap(b.text, it.size, W);
      it.h = it.lines.length * it.line + sp(14, scale);
    } else if (b.t === 'p') {
      it.size = (b.size ?? 26) * scale;
      it.line = it.size * 1.4;
      it.lines = wrap(b.text, it.size, W);
      it.h = it.lines.length * it.line + sp(b.gap ?? 16, scale);
    } else if (b.t === 'img') {
      it.h = b.h + sp(14, scale);
    } else if (b.t === 'gap') {
      it.h = sp(b.h, scale);
    } else if (b.t === 'btn') {
      it.size = (b.size ?? 30) * scale;
      it.line = it.size * 1.22;
      const padX = sp(26, scale);
      it.lines = wrap(b.label, it.size, W - padX * 2);
      const subLines = b.sub ? wrap(b.sub, it.size * 0.62, W - padX * 2) : [];
      it.sub = subLines;
      const inner = it.lines.length * it.line + (subLines.length ? subLines.length * it.size * 0.78 + sp(4, scale) : 0);
      const h = Math.max(sp(b.minH ?? 84, scale), inner + sp(34, scale));
      it.h = h + sp(16, scale);
      it.btns.push({ id: b.id, x: side, y, w: W, h, disabled: b.disabled });
      it.bh = h;
    } else if (b.t === 'row') {
      it.size = (b.size ?? 28) * scale;
      it.line = it.size * 1.2;
      const n = b.items.length;
      const gap = sp(12, scale);
      const flexTotal = b.items.reduce((s, q) => s + (q.flex ?? 1), 0);
      const unit = (W - gap * (n - 1)) / flexTotal;
      const pad = sp(20, scale);
      const longest = (label) => Math.max(...String(label).split(/\s+/).map((wd) => tw(wd, it.size)));
      // when a word will not fit its share of the row (large text), stack the buttons instead
      const stack = b.items.some((q) => longest(q.label) > unit * (q.flex ?? 1) - pad || (scale >= 2 && /\s/.test(q.label)));
      if (stack) {
        let yy = y;
        for (const q of b.items) {
          const lines = wrap(q.label, it.size, W - pad);
          const h = Math.max(sp(b.minH ?? 84, scale), lines.length * it.line + sp(32, scale));
          it.btns.push({ id: q.id, x: side, y: yy, w: W, h, disabled: q.disabled, label: q.label, lines, kind: q.kind });
          yy += h + sp(12, scale);
        }
        it.h = yy - y + sp(4, scale);
      } else {
        let x = side, maxH = 0;
        const cells = [];
        for (const q of b.items) {
          const w = unit * (q.flex ?? 1);
          const lines = wrap(q.label, it.size, w - pad);
          const h = Math.max(sp(b.minH ?? 84, scale), lines.length * it.line + sp(32, scale));
          maxH = Math.max(maxH, h);
          cells.push({ q, x, w, lines });
          x += w + gap;
        }
        for (const c of cells) {
          it.btns.push({ id: c.q.id, x: c.x, y, w: c.w, h: maxH, disabled: c.q.disabled, label: c.q.label, lines: c.lines, kind: c.q.kind, flex: c.q.flex });
        }
        it.h = maxH + sp(16, scale);
      }
    } else if (b.t === 'grid') {
      const gap = 14;
      const cols = Math.max(1, Math.min(b.cols, Math.floor((W + gap) / 86)));
      const cw = (W - gap * (cols - 1)) / cols;
      const ch = cw * (b.aspect ?? 1.06);
      const rows = Math.ceil(b.cells.length / cols);
      b.cells.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        it.btns.push({ id: c.id, x: side + col * (cw + gap), y: y + row * (ch + gap), w: cw, h: ch, cell: c });
      });
      it.cols = cols; it.cw = cw; it.ch = ch;
      it.h = rows * (ch + gap) + sp(10, scale);
    }
    items.push(it);
    y += it.h;
  }
  return { items, height: y };
}

export function hitDoc(layout, x, y) {
  for (const it of layout.items) {
    for (const bt of it.btns) {
      if (bt.id != null && x >= bt.x && x <= bt.x + bt.w && y >= bt.y && y <= bt.y + bt.h) return bt;
    }
  }
  return null;
}

export const clampScroll = (scroll, contentH, viewH) => Math.min(Math.max(0, scroll), Math.max(0, contentH - viewH));
