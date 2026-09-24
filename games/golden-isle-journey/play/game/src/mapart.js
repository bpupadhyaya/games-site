// The chapter road's painted map scroll: one tall backdrop painted ONCE (sky blending through the regions plus a
// scenic vignette behind every stop) and blitted per frame. See ui.js `road`.
import { sprite, stats, mix } from './paint/kit.js';
import { skylineP, ridgeP, treeP, hallP, softBlob, parseCol } from './scenery.js';

const W = 720, TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rgb = (c, k = 1) => `rgb(${c.map((v) => Math.round(v * k)).join(',')})`;
const hexOf = (c, k) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('');

// Paint fn(t) into a temporary layer covering [y0, y0+h] and fade its top and bottom edges into the backdrop.
function faded(g, y0, h, fn, alpha) {
  const sp = g._sp; if (!sp || !sp.make) return;
  const c = sp.make(Math.ceil(W * sp.res), Math.ceil(h * sp.res)), t = c.getContext('2d');
  t.scale(sp.res, sp.res); t.translate(0, -y0); t._sp = sp; t.lineCap = 'round'; t.lineJoin = 'round';
  fn(t);
  t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'destination-in';
  const m = t.createLinearGradient(0, 0, 0, c.height); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.28, 'rgba(0,0,0,1)'); m.addColorStop(0.74, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = m; t.fillRect(0, 0, c.width, c.height);
  g.save(); g.globalAlpha = alpha; g.drawImage(c, 0, y0, W, h); g.restore();
}

export function roadBackdrop(ctx, { n, RH, nodeY, region, scroll }) {
  const sp = sprite('roadbg|' + n, W, RH, 0, 0, 0.5, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, RH);
    for (let i = n - 1; i >= 0; i--) {
      const u = nodeY(i) / RH, c = region[i];
      lg.addColorStop(Math.max(0, Math.min(1, u)), rgb(c, 0.36));
    }
    g.fillStyle = lg; g.fillRect(0, 0, W, RH);
    for (let i = 0; i < 160; i++) { const y = hash(i * 3) * RH; softBlob(g, hash(i * 5) * W, y, 120 + hash(i) * 260, 40 + hash(i * 7) * 110, hash(i * 11) > 0.5 ? '255,214,160' : '20,8,30', 0.05 + hash(i * 13) * 0.07); }
    g.fillStyle = 'rgba(255,240,210,0.7)';
    for (let i = 0; i < 90; i++) { const r = 0.8 + hash(i * 9) * 1.5; g.fillRect(hash(i * 3 + 1) * W, hash(i * 3 + 2) * RH * 0.9, r, r); }
    for (let i = 0; i < n; i++) {
      const y = nodeY(i), c = region[i], col = (k) => hexOf(c, k);
      softBlob(g, W / 2, y, 520, 300, c.join(','), 0.5);
      const base = y + 170;
      faded(g, y - 300, 640, (g) => {
      switch (i) {
        case 0: case 3: hallP(g, { scroll: 60, color: col(0.3), top: y - 260, floor: y + 130, gap: 240 }); break;
        case 1: skylineP(g, { base, scroll: 0, color: col(0.3), seed: 3, h: 300, gap: 200, kind: 'palace', lit: '255,210,140' }); break;
        case 12: skylineP(g, { base, scroll: 40, color: col(0.26), seed: 7, h: 300, gap: 190, kind: 'palace', lit: '255,214,140' }); break;
        case 2: case 4: ridgeP(g, { base: base - 60, amp: 70, wl: 300, color: col(0.36), seed: i, bottom: base + 60 }); treeP(g, { base, scroll: i * 90, color: col(0.3), seed: i, h: 360, gap: 150, cut: 'rgba(238,230,150,0.3)' }); break;
        case 5: ridgeP(g, { base: base - 60, amp: 120, wl: 380, color: col(0.44), seed: 2, bottom: base }); ridgeP(g, { base, amp: 90, wl: 300, color: col(0.3), seed: 5, bottom: base + 80 }); break;
        case 6: case 9: {
          const wg = g.createLinearGradient(0, base - 60, 0, base + 160); wg.addColorStop(0, rgb(c, 0.7)); wg.addColorStop(1, rgb(c, 0.2)); g.fillStyle = wg; g.fillRect(0, base - 60, W, 240);
          for (let k = 0; k < 40; k++) softBlob(g, hash(k + i) * W, base - 30 + hash(k * 3 + i) * 190, 40 + hash(k) * 70, 3 + hash(k * 5) * 5, '255,210,160', 0.4);
          if (i === 9) skylineP(g, { base: base - 60, scroll: 100, color: col(0.3), seed: 5, h: 220, gap: 130, kind: 'lanka', lit: '255,220,150' });
          break;
        }
        default: skylineP(g, { base, scroll: i * 60, color: col(0.3), seed: i * 3, h: i === 7 ? 300 : 260, gap: 150, kind: 'lanka', lit: i === 8 || i === 10 || i === 11 ? '255,170,80' : '255,214,140' });
      }
      }, 0.7);
      // keep the labels legible: a soft dark bed under the text column nearest the node
      softBlob(g, W / 2, y, 380, 100, '10,4,10', 0.28);
    }
  });
  if (sp.c) { stats.blits++; ctx.drawImage(sp.c, 0, -scroll, W, RH); }
}
