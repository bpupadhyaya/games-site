// Neolttwigi: everything that is painted but is not a girl or the interface: the sky, the hills, a hanok courtyard with its tiled roof,
// the onlookers, the straw bale and the board, falling petals, snow and lantern glow. Pure canvas 2D; a function of its arguments and
// the clock passed in. `cam` = { pivotX, groundY, s } where s is pixels per metre.
export const PAL = {
  ink: '#16203a', navy: '#1b2a52', indigo: '#2c3f86', teal: '#2fb3a8', tealHi: '#8ae6da', cream: '#fff6e2', gold: '#ffd36b', goldDeep: '#d29a2e',
  rose: '#ff7d97', red: '#d9344f', text: '#fff7e8', dim: 'rgba(255,247,232,0.66)', wood: '#b9824a', ember: '#ff9a4a',
};
export const DISPLAY = '"Cormorant Garamond", "Georgia", "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const SETTINGS = {
  morning: { sky: ['#8fd2ee', '#cfeaf2', '#ffeccf'], far: '#a9c9d8', near: '#7fb0a0', ground: ['#e7cfa0', '#c9a86e'], roof: '#4a5560', roofHi: '#7b8794', wall: '#f6efdc', wood: '#8a4a2a', glow: 0, tree: 'blossom', sun: [0.82, 0.18] },
  garden: { sky: ['#6fc0e6', '#bfe4ee', '#ffe8b8'], far: '#8fb8c0', near: '#6a9a76', ground: ['#dcc08a', '#bb9858'], roof: '#434d58', roofHi: '#738090', wall: '#f4ead2', wood: '#7e3f22', glow: 0, tree: 'persimmon', sun: [0.2, 0.2] },
  fair: { sky: ['#ffb36b', '#ffd9a0', '#fff1c8'], far: '#d6a78a', near: '#a98a6a', ground: ['#e8c98e', '#c49a58'], roof: '#3f434d', roofHi: '#6e7380', wall: '#f7ecd4', wood: '#7a3a20', glow: 0.1, tree: 'pine', bunting: true, sun: [0.78, 0.22] },
  night: { sky: ['#0f1738', '#2b2a62', '#7a4a78'], far: '#2a2d5a', near: '#1f2750', ground: ['#5a4a54', '#3a2f3c'], roof: '#1c2036', roofHi: '#3a4064', wall: '#cfc6d8', wood: '#4a2a28', glow: 1, tree: 'pine', lanterns: true, stars: true, sun: [0.15, 0.1] },
  snow: { sky: ['#b9c9e6', '#dde6f4', '#f6f8fc'], far: '#c5d0e4', near: '#aebbd6', ground: ['#f3f6fb', '#d3dcec'], roof: '#8f9db8', roofHi: '#ffffff', wall: '#f6efe0', wood: '#6a3a2c', glow: 0.15, tree: 'bare', snow: true, sun: [0.5, 0.12] },
};

// ---- backdrop -------------------------------------------------------------------------------------------------------------------------
function ridge(ctx, w, base, amp, seed, col, t) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, base + 4);
  for (let x = 0; x <= w + 20; x += 20) {
    const u = x / w * 6.2 + seed;
    ctx.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(u) + 0.15 * Math.sin(u * 2.7 + seed * 3) + 0.05 * Math.sin(t * 0.05 + x)));
  }
  ctx.lineTo(w, base + 4); ctx.closePath(); ctx.fill();
}

function tiledRoof(ctx, x0, x1, y, hh, set, k) {
  // a hipped hanok roof: a long trapezoid with upturned eave corners, a thick ridge and rows of tiles
  const ov = hh * 0.55;
  const g = ctx.createLinearGradient(0, y - hh, 0, y);
  g.addColorStop(0, set.roofHi); g.addColorStop(0.35, set.roof); g.addColorStop(1, set.roof);
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(x0 - ov, y + hh * 0.1);
  ctx.quadraticCurveTo(x0 - ov * 0.3, y + hh * 0.12, x0 + hh * 0.1, y);
  ctx.lineTo(x0 + hh * 0.9, y - hh);
  ctx.lineTo(x1 - hh * 0.9, y - hh);
  ctx.lineTo(x1 - hh * 0.1, y);
  ctx.quadraticCurveTo(x1 + ov * 0.3, y + hh * 0.12, x1 + ov, y + hh * 0.1);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + hh * 0.36, x0 - ov, y + hh * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(1, 1.6 * k);
  for (let x = x0 - ov; x < x1 + ov; x += Math.max(7, 12 * k)) { ctx.beginPath(); ctx.moveTo(x + hh * 0.35, y - hh); ctx.lineTo(x, y + hh * 0.2); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = set.roofHi; ctx.fillRect(x0 + hh * 0.7, y - hh - hh * 0.1, x1 - x0 - hh * 1.4, hh * 0.14);   // ridge
  // eave edge
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(1.5, 3 * k);
  ctx.beginPath(); ctx.moveTo(x0 - ov, y + hh * 0.1); ctx.quadraticCurveTo((x0 + x1) / 2, y + hh * 0.36, x1 + ov, y + hh * 0.1); ctx.stroke();
}

function building(ctx, x0, x1, base, k, set, t) {
  const wallH = 2.1 * k * 100, hh = 0.95 * k * 100;
  const top = base - wallH;
  // white plaster wall with a stone footing
  ctx.fillStyle = set.wall; ctx.fillRect(x0, top, x1 - x0, wallH);
  ctx.fillStyle = '#a79c8e'; ctx.fillRect(x0 - 6, base - 0.28 * k * 100, x1 - x0 + 12, 0.28 * k * 100);
  // wooden pillars and hanji lattice windows
  const step = 1.9 * k * 100;
  for (let x = x0 + step * 0.2; x < x1; x += step) {
    ctx.fillStyle = set.wood; ctx.fillRect(x - 0.07 * k * 100, top, 0.14 * k * 100, wallH);
    const wx = x + 0.2 * k * 100, ww = step - 0.5 * k * 100, wy = top + 0.35 * k * 100, wh = wallH * 0.52;
    if (wx + ww > x1) continue;
    ctx.fillStyle = set.glow ? `rgba(255,${200 + 30 * Math.sin(t + x)},120,0.95)` : '#fffbe8'; ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = set.wood; ctx.lineWidth = Math.max(1.2, 2.2 * k);
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(wx + ww * i / 4, wy); ctx.lineTo(wx + ww * i / 4, wy + wh); }
    for (let j = 1; j < 3; j++) { ctx.moveTo(wx, wy + wh * j / 3); ctx.lineTo(wx + ww, wy + wh * j / 3); }
    ctx.stroke();
  }
  ctx.fillStyle = set.wood; ctx.fillRect(x0, top - 0.06 * k * 100, x1 - x0, 0.14 * k * 100);   // beam under the eaves
  tiledRoof(ctx, x0, x1, top, hh, set, k);
}

function tree(ctx, x, base, k, set, t) {
  ctx.fillStyle = '#4e3426'; ctx.beginPath();
  ctx.moveTo(x - 7 * k, base); ctx.quadraticCurveTo(x - 4 * k, base - 120 * k, x - 16 * k, base - 190 * k); ctx.lineTo(x + 6 * k, base - 190 * k); ctx.quadraticCurveTo(x + 6 * k, base - 110 * k, x + 8 * k, base); ctx.fill();
  const kind = set.tree;
  if (kind === 'bare') {
    ctx.strokeStyle = '#4e3426'; ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
    for (const [a, l] of [[-0.9, 90], [-0.35, 110], [0.4, 100], [0.95, 80]]) { ctx.beginPath(); ctx.moveTo(x - 4 * k, base - 185 * k); ctx.lineTo(x - 4 * k + Math.sin(a) * l * k, base - 185 * k - Math.cos(a) * l * k); ctx.stroke(); }
    return;
  }
  const col = kind === 'blossom' ? ['#ffc5d6', '#ff9fb9'] : kind === 'persimmon' ? ['#7fae5a', '#5f8f42'] : ['#2f6b4a', '#245a3c'];
  for (let i = 0; i < 6; i++) {
    const a = hash(i + 3) * TAU, rr = 40 * k + hash(i) * 22 * k;
    ctx.fillStyle = col[i % 2]; ctx.beginPath(); ctx.arc(x - 4 * k + Math.cos(a) * 46 * k, base - 215 * k + Math.sin(a) * 28 * k, rr, 0, TAU); ctx.fill();
  }
  if (kind === 'persimmon') for (let i = 0; i < 9; i++) { const a = hash(i * 2.3) * TAU, d = hash(i + 9) * 62 * k; ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, base - 205 * k + Math.sin(a) * d * 0.6, 7 * k, 0, TAU); ctx.fill(); }
}

// fx: { gasp (0..1: hands to the chest as a big jump rises), cheer (0..1: arms up and hopping at the top and after), gust }
function onlookers(ctx, w, y, k, t, excite, set, fx = {}) {
  const cols = ['#ffd24a', '#ffc4da', '#9ad66f', '#b9a2f0', '#ffffff', '#7fc4ff'], skirt = ['#cf2a50', '#2468b4', '#d83c3c', '#16938c', '#8a4fc2', '#e08a24'];
  const skins = ['#f3c9a0', '#efbf94', '#f6d2ae'];
  const step = 62 * k * 1.15;
  const shade = (c, a) => { const n = parseInt(c.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * a))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const gasp = clamp(fx.gasp || 0, 0, 1), cheer = clamp(fx.cheer || 0, 0, 1);
  for (let i = 0, x = -10; x < w + 40; x += step, i++) {
    // every onlooker has her own rhythm, reaction delay and favourite arm, so the row never waves in unison
    const hs = hash(i * 1.37), freq = 4.6 + 4.2 * hash(i * 7.7 + 1), ph = hash(i * 3.3 + 2) * TAU, delay = hash(i * 5.9 + 4);
    const reactG = clamp((gasp - delay * 0.4) / (1 - delay * 0.4), 0, 1), reactC = clamp((cheer - delay * 0.35) / (1 - delay * 0.35), 0, 1);
    const hop = Math.max(0, Math.sin(t * freq * 0.7 + ph)) * reactC * 7 * k;
    const bob = Math.sin(t * 3.4 + i * 1.3) * (1 + excite * 3) * k;
    const sx = x + hs * 14 * k, s = k * (0.9 + hs * 0.2), up = Math.max(0, bob) + hop;
    const sc = skirt[i % skirt.length], jc = cols[(i * 5) % cols.length], skin = skins[i % skins.length];
    // chima: a bell with a lit side and a hem band
    let g = ctx.createLinearGradient(sx - 26 * s, 0, sx + 26 * s, 0); g.addColorStop(0, shade(sc, 0.72)); g.addColorStop(0.45, sc); g.addColorStop(1, shade(sc, 0.82));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 9 * s, y - 40 * s - up); ctx.lineTo(sx + 9 * s, y - 40 * s - up); ctx.quadraticCurveTo(sx + 14 * s, y - 14 * s, sx + 27 * s, y); ctx.lineTo(sx - 27 * s, y); ctx.quadraticCurveTo(sx - 14 * s, y - 14 * s, sx - 9 * s, y - 40 * s - up); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx - 26 * s, y - 3 * s, 52 * s, 3 * s);
    // arms: shoulder -> elbow -> hand; calm = hanging with a little sway, excited = raised and waving, gasp = hands to the chest
    ctx.lineCap = 'round'; ctx.strokeStyle = shade(jc, 0.9); ctx.lineWidth = 8 * s;
    const lvlBase = clamp(excite * 0.9, 0, 1);
    for (const sgn of [-1, 1]) {
      const lead = sgn > 0 ? hs > 0.3 : hs > 0.6;                             // one arm is the cheering arm, the other joins in only sometimes
      const lvl = clamp((lead ? lvlBase : lvlBase * 0.35) * 0.8 + reactC * (lead ? 1 : 0.8 + hs * 0.2), 0, 1) * (lead || reactC > 0.4 ? 1 : 0.3);
      const wave = Math.sin(t * freq + ph + sgn * 0.9) * (0.35 + lvl * 0.6);
      const a = 0.16 + 2.55 * lvl + 0.07 * Math.sin(t * 1.7 + ph + sgn);       // upper arm: 0 hangs, PI/2 sideways, PI up
      const sh = [sx + sgn * 10 * s, y - 58 * s - up];
      let el = [sh[0] + sgn * Math.sin(a) * 13 * s, sh[1] + Math.cos(a) * 13 * s];
      const b = a + wave * 0.5 * (0.3 + lvl) + 0.28 * lvl;                     // forearm waves about the elbow
      let hand = [el[0] + sgn * Math.sin(b) * 12 * s, el[1] + Math.cos(b) * 12 * s];
      if (reactG > 0) {                                                          // gasp: both hands up to the chest
        const e2 = [sh[0] + sgn * 4 * s, sh[1] + 11 * s], h2 = [sx + sgn * 3 * s, y - 67 * s - up];
        const q = ease(reactG) * (1 - reactC);
        el = [el[0] + (e2[0] - el[0]) * q, el[1] + (e2[1] - el[1]) * q]; hand = [hand[0] + (h2[0] - hand[0]) * q, hand[1] + (h2[1] - hand[1]) * q];
      }
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(el[0], el[1]); ctx.lineTo(hand[0], hand[1]); ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hand[0], hand[1] - 1 * s, 4.3 * s, 0, TAU); ctx.fill();
    }
    // jeogori
    g = ctx.createLinearGradient(sx - 12 * s, 0, sx + 12 * s, 0); g.addColorStop(0, shade(jc, 0.8)); g.addColorStop(0.5, jc); g.addColorStop(1, shade(jc, 0.88));
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(sx - 12 * s, y - 63 * s - up, 24 * s, 25 * s, 7 * s); ctx.fill();
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(sx - 6 * s, y - 62 * s - up); ctx.lineTo(sx + 2 * s, y - 46 * s - up); ctx.moveTo(sx + 6 * s, y - 62 * s - up); ctx.lineTo(sx - 2 * s, y - 46 * s - up); ctx.stroke();
    // head: braid behind, face, hair cap with a centre parting, eyes; the head tips back to watch a high jump
    const tip = (reactG * (1 - reactC) * 3 + reactC * 2) * s;
    ctx.strokeStyle = '#1c1215'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(sx - 8 * s, y - 72 * s - up); ctx.quadraticCurveTo(sx - 17 * s, y - 56 * s - up, sx - 13 * s, y - 46 * s - up); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(sx, y - 75 * s - up, 10.5 * s, 11.5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1c1215'; ctx.beginPath(); ctx.moveTo(sx - 11.5 * s, y - 74 * s - up); ctx.bezierCurveTo(sx - 13 * s, y - 94 * s - up, sx + 13 * s, y - 94 * s - up, sx + 11.5 * s, y - 74 * s - up); ctx.quadraticCurveTo(sx + 7 * s, y - 80 * s - up, sx, y - 83 * s - up); ctx.quadraticCurveTo(sx - 7 * s, y - 80 * s - up, sx - 11.5 * s, y - 74 * s - up); ctx.fill();
    ctx.fillStyle = '#2a1a1c'; ctx.beginPath(); ctx.arc(sx - 4 * s, y - 73 * s - up - tip * 0.4, 1.3 * s, 0, TAU); ctx.arc(sx + 4 * s, y - 73 * s - up - tip * 0.4, 1.3 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,120,0.35)'; ctx.beginPath(); ctx.arc(sx - 7 * s, y - 69 * s - up, 2.2 * s, 0, TAU); ctx.arc(sx + 7 * s, y - 69 * s - up, 2.2 * s, 0, TAU); ctx.fill();
    if (reactG > 0.5 || reactC > 0.5) { ctx.fillStyle = '#7a2230'; ctx.beginPath(); ctx.ellipse(sx, y - 66.5 * s - up, 2.4 * s, (reactC > 0.5 ? 2.2 : 3) * s, 0, 0, TAU); ctx.fill(); }   // "oh!" / a cheer
    ctx.fillStyle = cols[(i * 3 + 1) % cols.length]; ctx.beginPath(); ctx.arc(sx - 13 * s, y - 45 * s - up, 3 * s, 0, TAU); ctx.fill();
  }
}

export function drawScene(ctx, w, h, t, cam, setName, excite = 0, fx = {}) {
  const set = SETTINGS[setName] ?? SETTINGS.morning;
  const gy = cam.groundY, s = cam.s, hz = gy - 0.45 * s;           // hz: where the courtyard floor meets the wall
  const k = Math.max(0.25, s / 100);
  const sk = ctx.createLinearGradient(0, 0, 0, hz);
  sk.addColorStop(0, set.sky[0]); sk.addColorStop(0.6, set.sky[1]); sk.addColorStop(1, set.sky[2]);
  ctx.fillStyle = sk; ctx.fillRect(0, 0, w, hz + 2);
  if (set.stars) for (let i = 0; i < 40; i++) { const a = 0.3 + 0.5 * hash(i) * (0.6 + 0.4 * Math.sin(t * 1.6 + i)); ctx.fillStyle = `rgba(255,248,220,${a})`; ctx.fillRect(hash(i * 3.1) * w, hash(i * 7.7) * hz * 0.6, 2, 2); }
  // sun or moon
  const sx = w * set.sun[0], sy = hz * (0.2 + set.sun[1]);
  const gl = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.max(w, hz) * 0.3);
  gl.addColorStop(0, set.stars ? 'rgba(255,248,214,0.6)' : 'rgba(255,240,200,0.7)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, w, hz);
  ctx.fillStyle = set.stars ? '#fff8dc' : 'rgba(255,252,236,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(14, s * 0.22), 0, TAU); ctx.fill();
  // clouds
  if (!set.stars) for (let i = 0; i < 4; i++) {
    const cx = ((hash(i * 5.3) * (w + 400) + t * (6 + i * 2)) % (w + 400)) - 200, cy = hz * (0.1 + 0.12 * hash(i * 2.1));
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const [dx, dy, r] of [[0, 0, 26], [28, 6, 20], [-26, 8, 18], [50, 10, 14]]) { ctx.beginPath(); ctx.arc(cx + dx * k, cy + dy * k, r * k, 0, TAU); ctx.fill(); }
  }
  ridge(ctx, w, hz - 0.6 * s, s * 1.6, 1.3, set.far, t);
  ridge(ctx, w, hz - 0.1 * s, s * 1.0, 4.1, set.near, t);
  // buildings and trees
  const kb = k * 0.62;
  building(ctx, -w * 0.05, w * 0.62, hz, kb, set, t);
  { // the tree answers a hard landing: the whole crown rocks about its trunk
    const tx = w * 0.78, tb = hz + 4, sh = (fx.shake || 0) + 0.012 * Math.sin(t * 0.9);
    ctx.save(); ctx.translate(tx, tb); ctx.rotate(sh * 0.05); ctx.translate(-tx, -tb);
    tree(ctx, tx, tb, kb * 0.9, set, t);
    ctx.restore();
  }
  if (set.bunting || set.lanterns) {
    const n = set.lanterns ? 9 : 14;
    for (let r = 0; r < 2; r++) {
      const y0 = hz - (set.lanterns ? 2.6 : 3.0) * s + r * 0.5 * s, sag = 0.25 * s;
      ctx.strokeStyle = 'rgba(60,30,20,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = 0; x <= w; x += 14) { const y = y0 + Math.sin(x / w * Math.PI * (2 + r)) * sag; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * w / n, y = y0 + Math.sin(x / w * Math.PI * (2 + r)) * sag, sw = Math.sin(t * 2 + i) * 3 * k;
        if (set.lanterns) {
          const gl2 = ctx.createRadialGradient(x, y + 22 * k, 2, x, y + 22 * k, 46 * k); gl2.addColorStop(0, 'rgba(255,180,90,0.7)'); gl2.addColorStop(1, 'rgba(255,150,60,0)');
          ctx.fillStyle = gl2; ctx.fillRect(x - 50 * k, y - 30 * k, 100 * k, 110 * k);
          ctx.fillStyle = i % 2 ? '#ff5a3c' : '#ffb13c'; ctx.beginPath(); ctx.ellipse(x + sw, y + 22 * k, 13 * k, 18 * k, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3a1c10'; ctx.fillRect(x - 5 * k + sw, y + 3 * k, 10 * k, 4 * k); ctx.fillRect(x - 5 * k + sw, y + 38 * k, 10 * k, 4 * k);
        } else {
          const cols = ['#ff5a6e', '#ffd24a', '#3fc1b0', '#6a8cff', '#ffffff'];
          ctx.fillStyle = cols[(i + r * 2) % cols.length]; ctx.beginPath(); ctx.moveTo(x - 9 * k, y); ctx.lineTo(x + 9 * k, y); ctx.lineTo(x + sw, y + 24 * k); ctx.closePath(); ctx.fill();
        }
      }
    }
  }
  // the low stone wall and the onlookers behind it
  onlookers(ctx, w, hz + 0.02 * s, k * 0.75, t, excite, set, fx);
  ctx.fillStyle = '#b3a89a'; ctx.fillRect(0, hz - 0.02 * s, w, 0.4 * s);
  ctx.fillStyle = '#d6ccbf'; ctx.fillRect(0, hz - 0.02 * s, w, 0.08 * s);
  ctx.strokeStyle = 'rgba(80,70,60,0.25)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 0.7 * s) { ctx.beginPath(); ctx.moveTo(x, hz + 0.06 * s); ctx.lineTo(x, hz + 0.38 * s); ctx.stroke(); }
  // courtyard floor
  const fl = ctx.createLinearGradient(0, hz + 0.36 * s, 0, h);
  fl.addColorStop(0, set.ground[0]); fl.addColorStop(1, set.ground[1]);
  ctx.fillStyle = fl; ctx.fillRect(0, hz + 0.36 * s, w, h - hz - 0.36 * s);
  ctx.strokeStyle = 'rgba(80,50,20,0.1)'; ctx.lineWidth = 2;
  for (let i = 1; i < 7; i++) { const y = hz + 0.36 * s + (h - hz - 0.36 * s) * (i / 7) ** 1.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // a woven straw mat under the board
  const mw = 4.4 * s, mh = 0.34 * s, my = gy - 0.03 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(cam.pivotX, my + mh * 0.5, mw * 0.55, mh * 0.55, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9b865'; ctx.beginPath(); ctx.roundRect(cam.pivotX - mw / 2, my - mh * 0.05, mw, mh, mh * 0.2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,20,0.35)'; ctx.lineWidth = 1.4;
  for (let x = cam.pivotX - mw / 2 + 8; x < cam.pivotX + mw / 2; x += 9) { ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + mh * 0.9); ctx.stroke(); }
  if (set.snow) { ctx.fillStyle = 'rgba(255,255,255,0.0)'; }
  // falling petals, leaves or snow
  const kindCol = set.snow ? '#ffffff' : set.tree === 'blossom' ? '#ffb7cc' : set.tree === 'persimmon' ? '#e8a24a' : null;
  if (kindCol) for (let i = 0; i < (set.snow ? 70 : 22); i++) {
    // a jump stirs the air: petals are lifted and blown sideways while a girl is climbing, then drift back down
    const gust = fx.gust || 0, shk = fx.shake || 0;
    const sp = set.snow ? 30 : 22, x0 = (hash(i * 9.1) * (w + 100) + Math.sin(t * 0.8 + i) * 18 + t * 8) % (w + 100) - 50, y0 = (hash(i * 3.7) * h + t * sp * (0.6 + hash(i))) % h;
    const x = x0 + gust * (30 + 50 * hash(i + 4)) * Math.sin(t * 2 + i) + shk * 40 * hash(i + 8), y = y0 - gust * (50 + 70 * hash(i + 6));
    ctx.fillStyle = kindCol; ctx.globalAlpha = set.snow ? 0.85 : 0.75; ctx.beginPath(); ctx.ellipse(x, y, set.snow ? 2.6 : 4.5, set.snow ? 2.6 : 2.4, i, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // atmosphere: soft shafts of light from the sun / moon, a low mist over the courtyard wall and warm bounce light from the ground
  if (!set.snow) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const bx = w * set.sun[0] + (i - 1.5) * w * 0.12, sway = Math.sin(t * 0.25 + i) * 6;
      const g2 = ctx.createLinearGradient(w * set.sun[0], hz * 0.2, bx + (bx - w * set.sun[0]) * 2, hz * 1.1);
      g2.addColorStop(0, set.stars ? 'rgba(190,200,255,0.05)' : 'rgba(255,240,190,0.05)'); g2.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g2; ctx.beginPath();
      ctx.moveTo(w * set.sun[0] - 8, hz * 0.2); ctx.lineTo(w * set.sun[0] + 8, hz * 0.2);
      ctx.lineTo(bx + (bx - w * set.sun[0]) * 2.4 + 34 + sway, hz * 1.1); ctx.lineTo(bx + (bx - w * set.sun[0]) * 2.4 - 34 + sway, hz * 1.1); ctx.fill();
    }
    ctx.restore();
  }
  const mist = ctx.createLinearGradient(0, hz - 0.9 * s, 0, hz + 0.1 * s);
  mist.addColorStop(0, 'rgba(255,250,240,0)'); mist.addColorStop(1, set.stars ? 'rgba(150,150,210,0.22)' : 'rgba(255,248,235,0.30)');
  ctx.fillStyle = mist; ctx.fillRect(0, hz - 0.9 * s, w, 1.0 * s);
  const bounce = ctx.createLinearGradient(0, gy - 0.1 * s, 0, h);
  bounce.addColorStop(0, 'rgba(255,214,140,0.0)'); bounce.addColorStop(1, 'rgba(120,70,20,0.28)');
  ctx.fillStyle = bounce; ctx.fillRect(0, gy - 0.1 * s, w, h - gy + 0.1 * s);
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, set.stars ? 'rgba(4,6,24,0.5)' : 'rgba(30,20,10,0.28)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// ---- the bale and the board ---------------------------------------------------------------------------------------------------------
export const BOARD = { len: 3.2, thick: 0.1, bale: 0.5, endX: 1.2 };

export function drawBale(ctx, cx, gy, s, sq = 0) {
  // sq: how far the straw is squashed under the board (0..~0.12): it gets shorter and bulges at the sides
  const bw = 0.95 * s * (1 + 0.5 * sq), bh = BOARD.bale * s * (1 - sq);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, gy + 0.02 * s, bw * 0.62, 0.07 * s, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  g.addColorStop(0, '#a07a2e'); g.addColorStop(0.3, '#e6c25c'); g.addColorStop(0.65, '#f3d97f'); g.addColorStop(1, '#a98433');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - bw / 2, gy - bh, bw, bh, bh * 0.38); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(cx - bw / 2, gy - bh, bw, bh, bh * 0.38); ctx.clip();
  ctx.strokeStyle = 'rgba(110,70,10,0.4)'; ctx.lineWidth = Math.max(1, s * 0.012);
  for (let i = 0; i < 16; i++) { const y = gy - bh + (i + 0.5) * bh / 16; ctx.beginPath(); ctx.moveTo(cx - bw / 2, y + Math.sin(i) * 2); ctx.quadraticCurveTo(cx, y + Math.cos(i * 1.7) * 3, cx + bw / 2, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,245,200,0.35)';
  for (let i = 0; i < 9; i++) { const y = gy - bh + (i + 0.3) * bh / 9; ctx.beginPath(); ctx.moveTo(cx - bw * 0.45, y); ctx.lineTo(cx + bw * 0.3, y + 1); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#7a4a22';                                    // two rope bands
  for (const f of [0.28, 0.72]) ctx.fillRect(cx - bw / 2 + bw * f - s * 0.025, gy - bh, s * 0.05, bh);
}

// angle a: positive = right end DOWN. Returns the end tops in screen space.
export function boardPoints(cam, a) {
  // cam.sq squashes the bale and cam.flex bends the board: the ends droop under a landing and spring back
  const bale = BOARD.bale * (1 - (cam.sq || 0)), fl = cam.flex || 0, half = BOARD.len / 2;
  const p = (lx, ly) => { const lyy = ly - fl * (lx / half) * (lx / half); return { x: cam.pivotX + (lx * Math.cos(a) + lyy * Math.sin(a)) * cam.s, y: cam.groundY - bale * cam.s + (lx * Math.sin(a) - lyy * Math.cos(a)) * cam.s }; };
  return { left: p(-BOARD.endX, BOARD.thick), right: p(BOARD.endX, BOARD.thick), pivot: p(0, 0), at: p };
}

export function drawBoard(ctx, cam, a, pads) {
  const { s } = cam, L = BOARD.len, th = BOARD.thick, fl = (cam.flex || 0) * s;
  const px = cam.pivotX, py = cam.groundY - BOARD.bale * (1 - (cam.sq || 0)) * s;
  const half = L / 2 * s, sag = (x) => fl * (x / half) * (x / half);          // the ends droop by fl under load
  const outline = (dy0, dy1, off = 0) => {                                     // the board's flexed outline between two heights
    ctx.beginPath();
    const N = 14;
    for (let i = 0; i <= N; i++) { const x = -half + 2 * half * i / N; ctx[i ? 'lineTo' : 'moveTo'](x + off, dy0 + sag(x)); }
    for (let i = N; i >= 0; i--) { const x = -half + 2 * half * i / N; ctx.lineTo(x + off, dy1 + sag(x)); }
    ctx.closePath();
  };
  ctx.save(); ctx.translate(px, py); ctx.rotate(a);
  const g = ctx.createLinearGradient(0, -th * s, 0, 0);
  g.addColorStop(0, '#e2ad72'); g.addColorStop(0.45, '#c68a50'); g.addColorStop(1, '#8c5a2e');
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; outline(-th * s + 6, 6, 3); ctx.fill();
  ctx.fillStyle = g; outline(-th * s, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(70,35,10,0.5)'; ctx.lineWidth = Math.max(1.5, s * 0.014); ctx.stroke();
  ctx.save(); outline(-th * s, 0); ctx.clip();
  ctx.strokeStyle = 'rgba(80,40,10,0.28)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) { const y = -th * s + (i + 0.6) * th * s / 7; ctx.beginPath(); for (let x = -L / 2; x <= L / 2 + 1e-6; x += 0.4) ctx[x <= -L / 2 + 1e-6 ? 'moveTo' : 'lineTo'](x * s, y + Math.sin(x * 3 + i) * 1.2 + sag(x * s)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,235,190,0.45)'; outline(-th * s, -th * s * 0.86); ctx.fill();
  ctx.restore();
  // cloth pads where the girls stand
  if (pads) for (const [i, col] of pads.entries()) {
    const cx = (i ? 1 : -1) * BOARD.endX * s;
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(cx - 0.34 * s, -th * s - 0.02 * s + sag(cx), 0.68 * s, 0.045 * s, 0.02 * s); ctx.fill();
  }
  ctx.restore();
}

// ---- particles and popups -------------------------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, n, col, power = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(40, 190) * power;
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70 * up, life: 0, max: rng.range(0.45, 0.95), r: rng.range(2, 4.8), col });
  }
  if (list.length > 150) list.splice(0, list.length - 150);
}
// A soft dust puff / straw fleck: they swell and drift instead of falling like sparks.
export function puff(list, rng, x, y, n, col, size = 1, dir = 0) {
  for (let i = 0; i < n; i++) {
    const side = rng.chance(0.5) ? -1 : 1;
    list.push({ kind: 'puff', x: x + rng.range(-8, 8) * size, y: y + rng.range(-3, 2) * size, vx: (dir * 18 + side * rng.range(20, 85)) * size, vy: rng.range(-26, -6) * size, life: 0, max: rng.range(0.55, 1.0), r: rng.range(7, 13) * size, col });
  }
  if (list.length > 150) list.splice(0, list.length - 150);
}
export function stepParticles(list, dt) {
  for (const p of list) {
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'puff') { p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 1.6 * dt; p.vy -= 10 * dt; }
    else { p.vy += 280 * dt; p.vx *= 1 - 1.4 * dt; }
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  ctx.save();
  for (const p of list) {
    const a = 1 - p.life / p.max;
    if (p.kind === 'puff') {
      const r = p.r * (0.7 + 1.5 * (1 - a)), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, rgba(p.col, 0.5 * a)); g.addColorStop(1, rgba(p.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      continue;
    }
    ctx.fillStyle = rgba(p.col, 0.9 * a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + 0.6 * a), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let q = 0; q < 10; q++) { const r = q % 2 ? size * 0.45 : size, a = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = i < n ? '#ffd45a' : 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#a8741a' : 'rgba(255,255,255,0.28)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}
