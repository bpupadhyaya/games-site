// The players and their paddles, drawn procedurally. One function serves the court, the menus and the Rules page
// illustrations, so a player always sees the same art everywhere.
const TAU = Math.PI * 2;
export const SKINS = ['#e8b48a', '#c98e66', '#a8693f', '#7a4a2c', '#f1c9a5'];
export const LOOKS = {
  you: { skin: 1, hair: '#2a1a12', shirt: '#ff6a4a', stripe: '#fff2d6', shorts: '#12304a', hat: '#fff7e6', style: 'cap' },
  dana: { skin: 3, hair: '#1f130d', shirt: '#14a3b4', stripe: '#eafcff', shorts: '#e8d2a2', hat: null, style: 'pony' },
  noa: { skin: 4, hair: '#6b3f1d', shirt: '#ffc24b', stripe: '#fff7e2', shorts: '#d9472b', hat: null, style: 'pony' },
  eli: { skin: 0, hair: '#3a2416', shirt: '#2f7fb8', stripe: '#ffffff', shorts: '#f4f4ea', hat: '#2f7fb8', style: 'cap' },
  maya: { skin: 2, hair: '#1a110c', shirt: '#3bb273', stripe: '#eafff2', shorts: '#12304a', hat: null, style: 'band' },
  gal: { skin: 1, hair: '#14100e', shirt: '#8a5bc0', stripe: '#f1e7ff', shorts: '#1d1d2c', hat: null, style: 'short' },
  shira: { skin: 3, hair: '#120b08', shirt: '#fff7e2', stripe: '#ff6a4a', shorts: '#14a3b4', hat: null, style: 'shades' },
  coach: { skin: 0, hair: '#3a2416', shirt: '#14a3b4', stripe: '#ffffff', shorts: '#12304a', hat: null, style: 'short' },
};
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Paddle arm angle (radians, 0 = straight out to the side, positive = up) for a swing that has run `t` seconds.
export function swingAngle(t) {
  const READY = -0.6, BACK = 1.75, FRONT = -1.2;
  if (t < 0) return READY;
  if (t < 0.05) return lerp(READY, BACK, ease(t / 0.05));
  if (t < 0.31) return lerp(BACK, FRONT, ease((t - 0.05) / 0.26));
  if (t < 0.55) return lerp(FRONT, READY, ease((t - 0.31) / 0.24));
  return READY;
}

export function drawPaddle(ctx, hx, hy, ang, u, flip = 1) {
  // handle from the hand, blade beyond it; flip mirrors left/right
  const dx = Math.cos(ang) * flip, dy = -Math.sin(ang);
  const hl = 0.16 * u, bl = 0.3 * u, bw = 0.23 * u;
  const bx = hx + dx * (hl + bl * 0.5), by = hy + dy * (hl + bl * 0.5);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5d3a22'; ctx.lineWidth = 0.075 * u;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dx * hl, hy + dy * hl); ctx.stroke();
  ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 0.04 * u; ctx.setLineDash([0.03 * u, 0.04 * u]);
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dx * hl * 0.8, hy + dy * hl * 0.8); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(bx, by); ctx.rotate(Math.atan2(dy, dx));
  const g = ctx.createLinearGradient(-bl / 2, 0, bl / 2, 0);
  g.addColorStop(0, '#e8c58e'); g.addColorStop(0.5, '#d9a965'); g.addColorStop(1, '#c4894a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, bl / 2, bw / 2, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 0.025 * u; ctx.strokeStyle = '#8a5a2c'; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,76,36,0.45)'; ctx.lineWidth = 0.012 * u;
  for (const o of [-0.5, -0.2, 0.1, 0.38]) { ctx.beginPath(); ctx.moveTo(-bl * 0.42, o * bw * 0.6); ctx.quadraticCurveTo(0, o * bw * 0.6 + 0.012 * u, bl * 0.42, o * bw * 0.6); ctx.stroke(); }
  ctx.restore();
}

// f: { x, y (feet, screen), s (px per metre), back (true = we see the player's back), look, run, speed, swingT, face: 1 }
export function drawFigure(ctx, f) {
  const u = f.s, L = LOOKS[f.look] ?? LOOKS.you, skin = SKINS[L.skin];
  const back = f.back !== false, dir = back ? 1 : -1;      // screen side of the paddle arm
  const mv = Math.min(1, (f.speed ?? 0) / 2.6);
  const ph = (f.run ?? 0) * 3.3;
  const bob = Math.abs(Math.sin(ph)) * 0.04 * mv + (f.swingT >= 0 && f.swingT < 0.31 ? 0.015 : 0);
  const X = (dx) => f.x + dx * u, Y = (h) => f.y - (h + bob) * u;
  const swing = f.swingT ?? -1;
  const lean = (f.lean ?? 0) * mv * 0.07;
  ctx.save();
  // shadow
  const sh = f.shade ?? [0.3, 0.3];
  ctx.fillStyle = `rgba(60,40,20,${0.22 * (f.alpha ?? 1)})`;
  ctx.beginPath(); ctx.ellipse(f.x + sh[0] * 0.45 * u, f.y + 0.02 * u, (0.34 + Math.abs(sh[0]) * 0.18) * u, 0.1 * u, 0, 0, TAU); ctx.fill();
  const sway = Math.sin(ph) * 0.5 * mv;
  // legs
  const leg = (side, phase) => {
    const sw = Math.sin(ph + phase) * 0.42 * mv, lift = Math.max(0, Math.cos(ph + phase)) * 0.12 * mv;
    const hx = X(side * 0.1 + lean), hy = Y(0.88);
    const fx = X(side * 0.11 + sw * 0.22 + lean * 0.4), fy = f.y - lift * u;
    ctx.strokeStyle = skin; ctx.lineWidth = 0.13 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lerp(hx, fx, 0.5) + side * 0.02 * u, lerp(hy, fy, 0.52)); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(fx, fy, 0.09 * u, 0.04 * u, 0, 0, TAU); ctx.fill();
  };
  leg(-1, 0); leg(1, Math.PI);
  // shorts
  ctx.fillStyle = L.shorts;
  ctx.beginPath(); ctx.moveTo(X(-0.2 + lean), Y(0.9)); ctx.lineTo(X(0.2 + lean), Y(0.9)); ctx.lineTo(X(0.22 + lean), Y(0.62)); ctx.lineTo(X(0.02 + lean), Y(0.66)); ctx.lineTo(X(-0.02 + lean), Y(0.66)); ctx.lineTo(X(-0.22 + lean), Y(0.62)); ctx.closePath(); ctx.fill();
  // far arm (the one not holding the paddle), behind the torso
  const shoulderY = 1.38, shX = X(lean + 0.0);
  ctx.strokeStyle = skin; ctx.lineWidth = 0.1 * u; ctx.lineCap = 'round';
  const ba = (-0.1 + sway) * -1;
  ctx.beginPath(); ctx.moveTo(shX - dir * 0.2 * u, Y(shoulderY)); ctx.lineTo(shX - dir * (0.27 + Math.sin(ph + 1) * 0.06 * mv) * u, Y(1.0)); ctx.stroke();
  // torso
  ctx.fillStyle = L.shirt;
  ctx.beginPath(); ctx.moveTo(X(-0.22 + lean), Y(1.42)); ctx.quadraticCurveTo(X(lean), Y(1.5), X(0.22 + lean), Y(1.42)); ctx.lineTo(X(0.19 + lean), Y(0.88)); ctx.lineTo(X(-0.19 + lean), Y(0.88)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = L.stripe; ctx.globalAlpha = 0.85;
  ctx.fillRect(X(-0.205 + lean), Y(1.18), 0.41 * u, 0.07 * u); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.moveTo(X(lean + dir * 0.02), Y(1.44)); ctx.lineTo(X(0.2 * dir + lean), Y(1.42)); ctx.lineTo(X(0.18 * dir + lean), Y(0.88)); ctx.lineTo(X(lean + dir * 0.02), Y(0.88)); ctx.closePath(); ctx.fill();
  // neck + head
  ctx.fillStyle = skin; ctx.fillRect(X(-0.05 + lean), Y(1.5), 0.1 * u, 0.1 * u);
  const hx = X(lean * 1.2), hy = Y(1.6), hr = 0.125 * u;
  if (back) {
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(hx, hy - 0.01 * u, hr * 1.02, Math.PI * 0.98, Math.PI * 2.02); ctx.lineTo(hx + hr, hy + 0.06 * u); ctx.quadraticCurveTo(hx, hy + 0.2 * u, hx - hr, hy + 0.06 * u); ctx.closePath(); ctx.fill();
    if (L.style === 'pony') { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(hx - 0.02 * u + Math.sin(ph) * 0.03 * u * mv, hy + 0.16 * u, 0.05 * u, 0.15 * u, 0.1, 0, TAU); ctx.fill(); }
  } else {
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(hx, hy - 0.025 * u, hr * 1.04, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
    if (L.style === 'shades') { ctx.fillStyle = '#10232f'; ctx.fillRect(hx - 0.1 * u, hy - 0.025 * u, 0.2 * u, 0.045 * u); }
    else { ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.arc(hx - 0.045 * u, hy, 0.014 * u, 0, TAU); ctx.arc(hx + 0.045 * u, hy, 0.014 * u, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(120,50,40,0.8)'; ctx.lineWidth = 0.012 * u; ctx.beginPath(); ctx.arc(hx, hy + 0.045 * u, 0.04 * u, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  if (L.style === 'band') { ctx.fillStyle = '#ffc24b'; ctx.fillRect(hx - hr, hy - 0.06 * u, hr * 2, 0.04 * u); }
  if (L.hat) {
    ctx.fillStyle = L.hat; ctx.beginPath(); ctx.arc(hx, hy - 0.03 * u, hr * 1.08, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(hx - hr * 1.1, hy - 0.035 * u, hr * 2.2, 0.025 * u);
    if (!back) { ctx.fillStyle = L.hat; ctx.beginPath(); ctx.ellipse(hx, hy - 0.03 * u, hr * 1.25, 0.03 * u, 0, 0, TAU); ctx.fill(); }
  }
  // paddle arm
  const ang = swingAngle(swing);
  const shx = X(dir * 0.22 + lean), shy = Y(shoulderY);
  const ax = Math.cos(ang) * dir, ay = -Math.sin(ang);
  const reachArm = 0.5 * u;
  const hxp = shx + ax * reachArm * 0.95, hyp = shy + ay * reachArm * 0.95 + (swing < 0 ? 0.16 * u : 0);
  if (swing >= 0.05 && swing < 0.36) {
    // swish
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineCap = 'round';
    const a0 = swingAngle(0.05), a1 = ang;
    ctx.lineWidth = 0.16 * u; ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); const px = shx + Math.cos(a) * dir * 0.82 * u, py = shy - Math.sin(a) * 0.82 * u; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = skin; ctx.lineWidth = 0.1 * u; ctx.lineCap = 'round';
  const elbowX = lerp(shx, hxp, 0.5) - ax * 0.0, elbowY = lerp(shy, hyp, 0.5) + 0.05 * u;
  ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(elbowX, elbowY); ctx.lineTo(hxp, hyp); ctx.stroke();
  drawPaddle(ctx, hxp, hyp, ang, u, dir);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hxp, hyp, 0.055 * u, 0, TAU); ctx.fill();
  ctx.restore();
}

// where the paddle blade is on screen (for hit effects): returns {x, y}
export function paddlePos(f) {
  const u = f.s, back = f.back !== false, dir = back ? 1 : -1;
  const ang = swingAngle(f.swingT ?? -1);
  const shx = f.x + dir * 0.22 * u, shy = f.y - 1.38 * u;
  return { x: shx + Math.cos(ang) * dir * 0.95 * u, y: shy - Math.sin(ang) * 0.95 * u };
}
