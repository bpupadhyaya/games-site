// Muscle definition painted onto the athlete's torso texture (UV layout of athlete_m: front panel x 325..702, y 30..545; back panel y 560..880)
// plus a matching bump map, so the chest, abdominals, ribs, lats and spine catch the light like a trained gymnast instead of a flat
// mannequin. Pure canvas 2D, deterministic.

const TAU = Math.PI * 2;

// soft elliptical dab: colour fades from `c` at the centre to nothing at the edge
function dab(g, cx, cy, rx, ry, rot, rgb, a, hard = 0.0) {
  g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, rx * hard, 0, 0, rx);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
}
// a soft stroked curve (grooves)
function groove(g, pts, w, rgb, a) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [k, al] of [[5, 0.16], [3, 0.26], [1.6, 0.42]]) {
    g.strokeStyle = `rgba(${rgb},${a * al})`; g.lineWidth = w * k; g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  }
  g.restore();
}

const DARK = '60,26,12', LIGHT = '255,224,196';
const H_UP = '255,255,255', H_DN = '0,0,0';

/**
 * Paint onto the albedo (`g`) and bump (`b`) canvases. Both 1024x1024. cx is the panel centre line.
 * Bump: mid grey = flat, lighter = raised, darker = grooves.
 */
export function paintMuscles(g, b) {
  const cx = 500;
  // ----------------------------------------------------------------------------------------------- front (x 390..610, y 525..835)
  for (const s of [-1, 1]) {
    const px = cx + s * 50, py = 630;
    dab(b, px, py, 62, 44, s * -0.2, H_UP, 0.6, 0.1);                                   // the pectoral mass
    dab(g, px - s * 4, py - 14, 50, 22, s * -0.2, LIGHT, 0.28);                        // lit upper chest
    dab(g, px, py + 30, 58, 14, s * 0.1, DARK, 0.38);                                  // under-pec shadow
    dab(b, px, py + 34, 60, 9, s * 0.08, H_DN, 0.6);
    groove(g, [[px - s * 48, py + 18], [px - s * 18, py + 36], [px + s * 16, py + 36], [px + s * 52, py + 14]], 1.8, DARK, 0.5);
    groove(b, [[px - s * 48, py + 18], [px - s * 18, py + 36], [px + s * 16, py + 36], [px + s * 52, py + 14]], 2, H_DN, 0.6);
    // collar bone
    groove(g, [[cx + s * 10, 548], [cx + s * 52, 541], [cx + s * 96, 556]], 1.6, DARK, 0.4); groove(b, [[cx + s * 10, 548], [cx + s * 52, 541], [cx + s * 96, 556]], 1.8, H_DN, 0.5);
    // front deltoid cap on the panel edge
    dab(b, cx + s * 100, 600, 24, 48, 0, H_UP, 0.45, 0.1); dab(g, cx + s * 100, 596, 18, 34, 0, LIGHT, 0.18);
    // serratus fingers
    for (let i = 0; i < 4; i++) {
      const y = 676 + i * 19, x0 = cx + s * (72 + i * 3), x1 = cx + s * (92 + i * 2);
      groove(g, [[x0, y], [x1, y + 8]], 1.6, DARK, 0.4); groove(b, [[x0, y], [x1, y + 8]], 1.8, H_DN, 0.5);
    }
    // external oblique and hip crest V
    dab(b, cx + s * 80, 770, 24, 66, s * 0.1, H_UP, 0.32, 0.1); dab(g, cx + s * 88, 780, 18, 52, s * 0.15, DARK, 0.2);
    groove(g, [[cx + s * 66, 800], [cx + s * 46, 822], [cx + s * 18, 836]], 2, DARK, 0.5); groove(b, [[cx + s * 66, 800], [cx + s * 46, 822], [cx + s * 18, 836]], 2.2, H_DN, 0.6);
  }
  groove(g, [[cx, 560], [cx, 674]], 1.8, DARK, 0.4); groove(b, [[cx, 560], [cx, 674]], 2, H_DN, 0.6);
  // abdominals: linea alba, tendon bands and the blocks between them
  groove(g, [[cx, 676], [cx, 834]], 1.8, DARK, 0.4); groove(b, [[cx, 676], [cx, 834]], 2, H_DN, 0.6);
  const bands = [694, 726, 758, 790];
  for (const y of bands) for (const s of [-1, 1]) {
    groove(g, [[cx + s * 3, y], [cx + s * 22, y + 2], [cx + s * 42, y - 1]], 1.8, DARK, 0.5);
    groove(b, [[cx + s * 3, y], [cx + s * 22, y + 2], [cx + s * 42, y - 1]], 2, H_DN, 0.65);
  }
  const blocks = [680, 710, 742, 774, 810];
  blocks.forEach((y, r) => {
    for (const s of [-1, 1]) {
      const w = r === 0 ? 20 : 24 - r * 0.8;
      dab(b, cx + s * 22, y, w, 15, 0, H_UP, 0.55, 0.15);
      dab(g, cx + s * 20, y - 5, w * 0.8, 8, 0, LIGHT, 0.24);
      dab(g, cx + s * 22, y + 11, w * 0.9, 4, 0, DARK, 0.2);
    }
  });
  dab(g, cx, 770, 4, 4, 0, DARK, 0.7);   // navel
  // ----------------------------------------------------------------------------------------------- back (x 390..610, y 100..430; neck at the top y 430)
  const sp = [[cx, 100], [cx, 420]];
  groove(g, sp, 2, DARK, 0.4); groove(b, sp, 2.4, H_DN, 0.6);
  for (const s of [-1, 1]) {
    // trapezius: kite from neck to shoulder points and down the spine
    dab(b, cx + s * 40, 372, 50, 40, s * 0.7, H_UP, 0.45, 0.1); dab(g, cx + s * 42, 366, 40, 26, s * 0.7, LIGHT, 0.2);
    // rear deltoid at the panel edge, scapula blade and the lines that frame it
    dab(b, cx + s * 100, 380, 26, 36, 0, H_UP, 0.5, 0.1); dab(g, cx + s * 100, 376, 18, 26, 0, LIGHT, 0.2);
    dab(b, cx + s * 54, 320, 34, 36, s * 0.3, H_UP, 0.4, 0.1);
    groove(g, [[cx + s * 20, 296], [cx + s * 54, 306], [cx + s * 86, 330]], 1.8, DARK, 0.45); groove(b, [[cx + s * 20, 296], [cx + s * 54, 306], [cx + s * 86, 330]], 2, H_DN, 0.55);
    // latissimus wings sweeping to the waist
    dab(b, cx + s * 72, 230, 46, 74, s * -0.25, H_UP, 0.45, 0.1); dab(g, cx + s * 66, 240, 34, 56, s * -0.25, LIGHT, 0.16);
    groove(g, [[cx + s * 100, 300], [cx + s * 88, 210], [cx + s * 56, 150]], 2, DARK, 0.4); groove(b, [[cx + s * 100, 300], [cx + s * 88, 210], [cx + s * 56, 150]], 2.2, H_DN, 0.55);
    // erector spinae columns
    dab(b, cx + s * 20, 160, 16, 62, 0, H_UP, 0.5, 0.1); dab(g, cx + s * 20, 170, 11, 44, 0, LIGHT, 0.16);
  }
}

/** A cloth bump map (folds) for the langot: horizontal pleats that tilt, used by the red trunks. Returns a 256 canvas. */
export function clothBump() {
  const c = globalThis.document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 34; i++) {
    const x = (i * 97.3) % 256, w = 4 + (i % 5) * 3, a = 0.22 + (i % 3) * 0.1, d = i % 2;
    const gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(128,128,128,0)'); gr.addColorStop(0.5, d ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = gr; g.save(); g.translate(128, 128); g.rotate(0.35 + (i % 4) * 0.08); g.translate(-128, -128); g.fillRect(x - w - 80, -80, 2 * w, 420); g.restore();
  }
  return c;
}
