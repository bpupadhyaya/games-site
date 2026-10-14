// Procedural canvas textures for the steppe scene (no image files). Everything is seeded, so renders are reproducible.
// Pure canvas 2D; the caller wraps the canvases into THREE textures.
export const rngOf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
export const cv = (w, h = w) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---- one feather: alpha shape with barbs. kinds: prim (slim, notched), sec (broad, rounded), cov (short, round), tail (long, banded), nape (pointed hackle)
// UV: u across (0..1), v along (0 root .. 1 tip, canvas top = tip).
export function featherCanvas(kind = 'sec', seed = 1, W = 96, H = 256) {
  const c = cv(W, H), g = c.getContext('2d'), r = rngOf(seed + 13);
  g.clearRect(0, 0, W, H);
  const half = (t) => {   // half width of the vane (0..0.5) at t (0 root..1 tip)
    const root = 0.35 + 0.65 * Math.min(1, t / 0.16);
    let w;
    if (kind === 'prim') { w = 0.5 * (1 - Math.pow(t, 3.2)) ** 0.7 * (t > 0.55 && t < 0.78 ? 0.78 : 1); }
    else if (kind === 'cov') { w = 0.5 * (1 - Math.pow(t, 2.2)) ** 0.55; }
    else if (kind === 'nape') { w = 0.5 * Math.pow(1 - t, 0.7) * Math.min(1, t * 5 + 0.3); }
    else if (kind === 'tail') { w = 0.5 * (1 - Math.pow(t, 6)) ** 0.5; }
    else { w = 0.5 * (1 - Math.pow(t, 4.2)) ** 0.6; }
    return Math.max(0.004, w * root);
  };
  const N = 64;
  // vane: left and right edge (right edge a little narrower: the leading vane is the narrower one)
  const path = () => {
    g.beginPath();
    for (let i = 0; i <= N; i++) { const t = i / N, y = H - t * H, x = W * (0.5 - half(t) * 0.82); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    for (let i = N; i >= 0; i--) { const t = i / N, y = H - t * H, x = W * (0.5 + half(t)); g.lineTo(x, y); }
    g.closePath();
  };
  path(); g.fillStyle = '#e6e6e6'; g.fill();
  g.save(); path(); g.clip();
  // barbs: slanted fine lines from the shaft toward the tip, alternating value
  for (let i = 0; i < 230; i++) {
    const t0 = r(), y0 = H - t0 * H, side = r() < 0.5 ? -1 : 1, len = 0.15 + r() * 0.4;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(150,150,150,0.35)'; g.lineWidth = 0.7 + r() * 0.8;
    g.beginPath(); g.moveTo(W * 0.5, y0); g.lineTo(W * (0.5 + side * len), y0 - (0.2 + r() * 0.18) * H * (0.35 + t0 * 0.3)); g.stroke();
  }
  if (kind === 'tail') {   // pale bars and a dark terminal band are painted by the vertex colours; faint bars here too
    g.fillStyle = 'rgba(80,80,80,0.28)'; g.fillRect(0, H * 0.34, W, H * 0.06); g.fillRect(0, H * 0.52, W, H * 0.07);
  }
  if (kind === 'prim' || kind === 'sec') { g.fillStyle = 'rgba(70,70,70,0.22)'; g.fillRect(0, 0, W, H * 0.1); }
  g.restore();
  // shaft
  g.strokeStyle = 'rgba(255,248,226,0.95)'; g.lineWidth = kind === 'cov' ? 1.4 : 2.2;
  g.beginPath(); g.moveTo(W * 0.5, H); g.lineTo(W * 0.5, H * (kind === 'nape' ? 0.02 : 0.045)); g.stroke();
  // frayed edge: erase a few notches along the border so the silhouette reads as feather
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const t = 0.2 + r() * 0.8, y = H - t * H, side = r() < 0.5 ? -1 : 1, x = W * (0.5 + side * half(t) * 0.97);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - side * W * 0.1, y - H * 0.012); g.lineTo(x + side * W * 0.08, y - H * 0.035); g.closePath(); g.fill();
  }
  return c;
}

// ---- body plumage: scalloped contour feathers, greyscale (the vertex colours tint it)
export function plumageCanvas(seed = 3, S = 256) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, S, S);
  for (let row = 0; row < 18; row++) {
    for (let k = -1; k < 12; k++) {
      const x = k * (S / 10) + (row % 2) * (S / 20) + (r() - 0.5) * 6, y = row * (S / 16) + (r() - 0.5) * 3, rad = S / 14;
      const v = 205 + r() * 50;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.ellipse(x, y, rad * 0.92, rad * 1.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,20,20,0.28)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(x, y + rad * 0.7, rad * 0.92, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(x, y - rad * 0.4); g.lineTo(x, y + rad * 0.7); g.stroke();
    }
  }
  return c;
}

// ---- fur (tileable): fine strands, greyscale
export function furCanvas(seed = 5, S = 256, dark = 0.0) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = `rgb(${215 - dark * 40},${215 - dark * 40},${215 - dark * 40})`; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3200; i++) {
    const x = r() * S, y = r() * S, l = 6 + r() * 14, a = Math.PI / 2 + (r() - 0.5) * 0.7, v = 170 + r() * 85;
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 0.8 + r() * 1.2;
    for (const ox of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + Math.cos(a) * l * 0.4, y + Math.sin(a) * l); g.stroke(); }
  }
  return c;
}

// ---- soft leather (tileable): grain + creases, greyscale
export function leatherCanvas(seed = 9, S = 256) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, rad = 1 + r() * 2.6, v = 140 + r() * 80;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 7); g.fill(); }
  }
  g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.3) * 26; y += (r() - 0.5) * 26; g.lineTo(x, y); } g.stroke(); }
  return c;
}

// ---- quilted cloth (padded coat): diamond stitch lines, greyscale; also a thread weave
export function quiltCanvas(S = 256, n = 6) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(21);
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
  const cell = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.72);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0.0)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(cx, cy - cell / 2); g.lineTo(cx + cell / 2, cy); g.lineTo(cx, cy + cell / 2); g.lineTo(cx - cell / 2, cy); g.closePath(); g.fill();
  }
  g.strokeStyle = 'rgba(30,30,30,0.7)'; g.lineWidth = 2.2;
  for (let k = -n; k <= 2 * n; k++) { g.beginPath(); g.moveTo(k * cell, 0); g.lineTo(k * cell + S, S); g.stroke(); g.beginPath(); g.moveTo(k * cell, S); g.lineTo(k * cell + S, 0); g.stroke(); }
  for (let i = 0; i < 4000; i++) { const x = r() * S, y = r() * S, v = 90 + r() * 130; g.fillStyle = `rgba(${v},${v},${v},0.16)`; g.fillRect(x, y, 1.4, 1.4); }
  return c;
}

// ---- felt (yurt wall / cover): short wool fibres, off-white
export function feltCanvas(seed = 11, S = 256) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = '#e9e1cd'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, a = r() * 6.28, l = 3 + r() * 9, v = 190 + r() * 60;
    g.strokeStyle = `rgba(${v},${v - 6},${v - 24},0.38)`; g.lineWidth = 0.9;
    for (const ox of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,100,70,${0.04 + r() * 0.05})`; g.beginPath(); g.arc(r() * S, r() * S, 10 + r() * 30, 0, 7); g.fill(); }
  return c;
}

// ---- snow surface: fine grain + wind-carved ripples (tileable). Colour is mostly white; the vertex colours add blue shade and warm sun.
export function snowCanvas(seed = 7, S = 512) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = '#f2f6fc'; g.fillRect(0, 0, S, S);
  // long wind ripples along x
  for (let i = 0; i < 90; i++) {
    const y = r() * S, x = r() * S, l = 40 + r() * 160, a = (r() - 0.5) * 0.06, amp = 1.5 + r() * 2.2;
    const grd = g.createLinearGradient(0, y - amp * 2, 0, y + amp * 2);
    grd.addColorStop(0, 'rgba(160,185,225,0)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.65)'); grd.addColorStop(0.7, 'rgba(150,176,220,0.4)'); grd.addColorStop(1, 'rgba(160,185,225,0)');
    g.save(); g.translate(x, y); g.rotate(a);
    for (const ox of [-S, 0, S]) { g.save(); g.translate(ox, 0); g.fillStyle = grd; g.fillRect(-l / 2, -amp * 2, l, amp * 4); g.restore(); }
    g.restore();
  }
  for (let i = 0; i < 6000; i++) { const x = r() * S, y = r() * S, v = r() < 0.5 ? 255 : 205; g.fillStyle = `rgba(${v},${v},${Math.min(255, v + 8)},0.28)`; g.fillRect(x, y, 1.3, 1.3); }
  return c;
}
export function snowBumpCanvas(seed = 8, S = 512) {
  const c = cv(S), g = c.getContext('2d'), r = rngOf(seed);
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 130; i++) {
    const x = r() * S, y = r() * S, l = 30 + r() * 150, amp = 2 + r() * 4;
    const grd = g.createLinearGradient(0, y - amp, 0, y + amp);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.7)'); grd.addColorStop(0.75, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    for (const ox of [-S, 0, S]) { g.save(); g.translate(x + ox, y); g.rotate((r() - 0.5) * 0.08); g.fillStyle = grd; g.fillRect(-l / 2, -amp, l, amp * 2); g.restore(); }
  }
  for (let i = 0; i < 5000; i++) { const x = r() * S, y = r() * S, v = Math.round(r() * 255); g.fillStyle = `rgba(${v},${v},${v},0.18)`; g.fillRect(x, y, 1.6, 1.6); }
  return c;
}

// ---- dry steppe grass tuft (alpha card): a fan of thin curved blades
export function tuftCanvas(seed = 4, W = 128, H = 128) {
  const c = cv(W, H), g = c.getContext('2d'), r = rngOf(seed);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 34; i++) {
    const x0 = W * (0.5 + (r() - 0.5) * 0.3), a = (r() - 0.5) * 1.9, h = H * (0.35 + r() * 0.6), bend = (r() - 0.5) * 40;
    const v = 205 + r() * 45;
    const grd = g.createLinearGradient(0, H, 0, H - h);
    grd.addColorStop(0, `rgb(${v - 60},${v - 80},${v - 130})`); grd.addColorStop(0.5, `rgb(${v},${v - 28},${v - 90})`); grd.addColorStop(1, `rgb(${v},${v - 18},${v - 60})`);
    g.strokeStyle = grd; g.lineWidth = 1.1 + r() * 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, H - 1); g.quadraticCurveTo(x0 + Math.sin(a) * h * 0.4, H - h * 0.55, x0 + Math.sin(a) * h * 0.6 + bend, H - h); g.stroke();
  }
  return c;
}

// ---- yurt felt cover with a wide patterned band (koshkar-muiz inspired scrolls) as a stripe texture
export function yurtBandCanvas(col1 = '#b5322c', col2 = '#1b4d8c', S = 256) {
  const c = cv(S, 64), g = c.getContext('2d');
  g.fillStyle = col2; g.fillRect(0, 0, S, 64);
  g.strokeStyle = '#f4ead0'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const x = i * 32 + 16;
    g.beginPath(); g.moveTo(x - 10, 46); g.bezierCurveTo(x - 14, 14, x + 14, 14, x + 8, 34); g.bezierCurveTo(x + 4, 44, x - 6, 40, x - 2, 30); g.stroke();
    g.fillStyle = col1; g.beginPath(); g.arc(x + 14, 48, 4, 0, 7); g.fill();
  }
  g.fillStyle = '#e9c35a'; g.fillRect(0, 0, S, 4); g.fillRect(0, 60, S, 4);
  return c;
}
