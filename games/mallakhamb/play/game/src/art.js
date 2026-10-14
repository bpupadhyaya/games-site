// Mallakhamb: all the painting that is not the performer or the interface. A dusk courtyard: sky, arches, string lights, a crowd, a
// pit of red earth, the lathe-turned wooden pole, chalk and sparks. Pure canvas 2D; a function of its arguments and the clock passed in.
export const PAL = {
  ink: '#120c24', night: '#1c1236', plum: '#2e1740', marigold: '#ffb43c', saffron: '#f08a24', ember: '#e0502c', teal: '#2fc4b2', tealHi: '#8ef0dc',
  cream: '#fff3da', gold: '#ffd77a', goldDeep: '#d29a34', earth: '#7a3b22', text: '#fdf1dc', dim: 'rgba(253,241,220,0.64)', rose: '#ff8aa0',
};
export const DISPLAY = '"Dela Gothic One", Impact, "Arial Black", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---- the courtyard ----------------------------------------------------------------------------------------------------------------
// cam: { horizon, ground, poleX, k } in screen units. mood: 0 menus (calmer), 1 play. excite 0..1 lifts the crowd.
export function drawCourtyard(ctx, w, h, t, cam, pulse = 0, excite = 0) {
  const hz = cam.horizon, gy = cam.ground;
  // sky
  const sk = ctx.createLinearGradient(0, 0, 0, hz + 30);
  sk.addColorStop(0, '#0f0a26'); sk.addColorStop(0.45, '#35184a'); sk.addColorStop(0.8, '#a8402f'); sk.addColorStop(1, '#f4a04a');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, w, Math.max(hz + 30, 1));
  // stars high in the sky
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3.1) * w, y = hash(i * 7.7) * hz * 0.55, a = 0.25 + 0.4 * hash(i) * (0.6 + 0.4 * Math.sin(t * 1.3 + i));
    ctx.fillStyle = `rgba(255,236,200,${a})`; ctx.fillRect(x, y, 1.6, 1.6);
  }
  // a low moon glow behind the arches
  const mg = ctx.createRadialGradient(w * 0.78, hz - 60, 4, w * 0.78, hz - 60, Math.max(w, h) * 0.32);
  mg.addColorStop(0, 'rgba(255,214,150,0.5)'); mg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = mg; ctx.fillRect(0, 0, w, hz + 30);
  // the arcade of arches along the horizon
  const aw = Math.max(110, w / 6), ah = Math.min(h * 0.17, 230);
  ctx.fillStyle = '#1b0f2c';
  ctx.fillRect(0, hz - ah * 0.55, w, ah * 0.55 + 6);
  for (let x = -aw * 0.5, i = 0; x < w + aw; x += aw, i++) {
    // pillar
    ctx.fillStyle = '#26143a'; ctx.fillRect(x - 7, hz - ah, 14, ah + 6);
    // pointed arch opening, lit warm from inside
    ctx.beginPath(); ctx.moveTo(x + 9, hz); ctx.lineTo(x + 9, hz - ah * 0.55);
    ctx.quadraticCurveTo(x + aw * 0.5, hz - ah * 1.12, x + aw - 9, hz - ah * 0.55); ctx.lineTo(x + aw - 9, hz); ctx.closePath();
    const g = ctx.createLinearGradient(0, hz - ah, 0, hz);
    g.addColorStop(0, 'rgba(255,170,80,0.0)'); g.addColorStop(1, `rgba(255,150,60,${0.55 + 0.1 * Math.sin(t * 2 + i)})`);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,190,110,0.4)'; ctx.stroke();
  }
  // a parapet line of small domes
  ctx.fillStyle = '#1b0f2c';
  for (let x = aw * 0.5, i = 0; x < w + aw; x += aw, i++) {
    ctx.beginPath(); ctx.arc(x, hz - ah * 1.02, aw * 0.12, Math.PI, 0); ctx.fill();
    ctx.fillRect(x - 2, hz - ah * 1.02 - aw * 0.2, 4, aw * 0.1);
  }
  // string lights across the top
  for (let r = 0; r < 2; r++) {
    const y0 = h * (0.045 + r * 0.05), sag = h * 0.028;
    ctx.strokeStyle = 'rgba(40,20,20,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) { const y = y0 + Math.sin(x / w * Math.PI * (3 + r)) * sag; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    for (let i = 0, n = 15 + r * 3; i < n; i++) {
      const x = (i + 0.5) * w / n, y = y0 + Math.sin(x / w * Math.PI * (3 + r)) * sag + 5;
      const tw = 0.75 + 0.25 * Math.sin(t * 2.4 + i * 1.9 + r) + pulse * 0.15;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 22);
      gl.addColorStop(0, `rgba(255,210,110,${0.85 * tw})`); gl.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 24, y - 24, 48, 48);
      ctx.fillStyle = `rgba(255,244,205,${tw})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
    }
  }
  // the crowd: two rows of heads and shoulders in front of the arches, bobbing to the beat
  const rowY = [hz + 4, hz + 26];
  for (let r = 0; r < 2; r++) {
    const step = r === 0 ? 34 : 40, size = r === 0 ? 15 : 19;
    for (let x = -10 + (r ? 14 : 0), i = 0; x < w + 20; x += step, i++) {
      const hs = hash(i * 1.7 + r * 50), bob = Math.sin(t * 3 + i * 0.9) * (1 + excite * 3) + pulse * excite * 2.5;
      const y = rowY[r] - bob - (hs > 0.8 ? size * 0.4 : 0) + (cam.k > 0 ? 0 : 0);
      const shade = r === 0 ? '#1d1030' : '#140a22';
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.ellipse(x, y + size * 1.7, size * 1.2, size * 1.1, 0, Math.PI, 0); ctx.fill();   // shoulders
      ctx.beginPath(); ctx.arc(x, y + size * 0.9, size * 0.72, 0, TAU); ctx.fill();                          // head
      if (hs > 0.55 && excite > 0.25) { ctx.strokeStyle = shade; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + size * 0.8, y + size * 1.6); ctx.lineTo(x + size * 1.3, y - size * (0.2 + excite * 0.8) + size * 0.4); ctx.stroke(); }
      // warm rim light on the side facing the lamps
      ctx.fillStyle = 'rgba(255,170,90,0.28)'; ctx.beginPath(); ctx.arc(x + size * 0.34, y + size * 0.8, size * 0.5, -1.2, 1.0); ctx.lineTo(x + size * 0.34, y + size * 0.8); ctx.fill();
    }
  }
  // the ground: red earth sloping away, with a bright pit round the pole
  const gr = ctx.createLinearGradient(0, hz + 40, 0, h);
  gr.addColorStop(0, '#5b2a2a'); gr.addColorStop(0.35, '#7a3b22'); gr.addColorStop(1, '#3a1810');
  ctx.fillStyle = gr; ctx.fillRect(0, hz + 40, w, h - hz - 40);
  // footing lines (a swept earth floor)
  ctx.strokeStyle = 'rgba(255,200,150,0.07)'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) { const y = hz + 40 + (h - hz - 40) * (i / 6) ** 1.6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const pw = Math.min(w * 0.6, 420 * cam.k * 1.4);
  const pit = ctx.createRadialGradient(cam.poleX, gy + 6, 8, cam.poleX, gy + 6, pw);
  pit.addColorStop(0, 'rgba(255,210,150,0.95)'); pit.addColorStop(0.25, 'rgba(226,150,90,0.8)'); pit.addColorStop(1, 'rgba(120,50,30,0)');
  ctx.save(); ctx.translate(cam.poleX, gy + 6); ctx.scale(1, 0.26); ctx.translate(-cam.poleX, -(gy + 6));
  ctx.fillStyle = pit; ctx.beginPath(); ctx.arc(cam.poleX, gy + 6, pw, 0, TAU); ctx.fill(); ctx.restore();
  // soft vignette
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,16,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// A cone of warm light from above the pole, brighter with the flow.
export function drawSpot(ctx, x, topY, botY, w, a) {
  const g = ctx.createLinearGradient(0, topY, 0, botY);
  g.addColorStop(0, `rgba(255,226,170,${0.0})`); g.addColorStop(0.3, `rgba(255,226,170,${0.10 * a})`); g.addColorStop(1, `rgba(255,214,150,${0.16 * a})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.18, topY); ctx.lineTo(x + w * 0.18, topY); ctx.lineTo(x + w * 0.62, botY); ctx.lineTo(x - w * 0.62, botY); ctx.closePath(); ctx.fill();
}

// ---- the pole ---------------------------------------------------------------------------------------------------------------------
// A turned wooden pole with a rounded top. `turn` (radians) slides the carved spiral so a wrap visibly rotates it.
export function drawPole(ctx, x, topY, botY, wd, turn) {
  const r = wd / 2;
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, '#3a1c0e'); g.addColorStop(0.18, '#7a4020'); g.addColorStop(0.42, '#d49a5e'); g.addColorStop(0.55, '#f0c490'); g.addColorStop(0.78, '#9a5a2c'); g.addColorStop(1, '#3a1c0e');
  ctx.fillStyle = g; ctx.fillRect(x - r, topY, wd, botY - topY);
  // rounded cap
  ctx.beginPath(); ctx.ellipse(x, topY, r, r * 0.9, 0, Math.PI, 0); ctx.fillStyle = '#b6733b'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - r * 0.25, topY - r * 0.2, r * 0.38, r * 0.3, 0, 0, TAU); ctx.fillStyle = 'rgba(255,230,190,0.45)'; ctx.fill();
  // spiral grain lines: each is a sine in x over y; the phase moves with the spin, so the wood turns
  ctx.save(); ctx.beginPath(); ctx.rect(x - r, topY, wd, botY - topY); ctx.clip();
  const span = wd * 3.1;
  for (let i = 0; i < 4; i++) {
    const ph = turn + i * (TAU / 4);
    ctx.beginPath();
    for (let y = topY; y <= botY; y += 10) {
      const q = Math.sin((y - topY) / span * TAU + ph);
      const px = x + Math.sin(ph + (y - topY) * 0.045) * r * 0.78;
      void q;
      if (y === topY) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.strokeStyle = 'rgba(60,28,10,0.32)'; ctx.lineWidth = Math.max(1.2, wd * 0.05); ctx.stroke();
  }
  ctx.restore();
  // chalk-and-oil rings: a pale band every so often
  for (let y = botY - wd * 7; y > topY; y -= wd * 7) { ctx.fillStyle = 'rgba(255,240,210,0.16)'; ctx.fillRect(x - r, y, wd, wd * 0.22); }
  // base: a ring of packed earth
  ctx.fillStyle = 'rgba(40,16,8,0.55)'; ctx.beginPath(); ctx.ellipse(x, botY + 3, r * 1.9, r * 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6b3a1d'; ctx.beginPath(); ctx.ellipse(x, botY, r, r * 0.3, 0, 0, TAU); ctx.fill();
}

// ---- particles and popups ---------------------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, n, col, power = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(40, 190) * power;
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * up, life: 0, max: rng.range(0.4, 0.9), r: rng.range(2, 4.6), col });
  }
  if (list.length > 160) list.splice(0, list.length - 160);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 1 - 1.2 * dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, list) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const a = 1 - p.life / p.max;
    ctx.fillStyle = rgba(p.col, 0.8 * a); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + 0.6 * a), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.45 : size, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#a8741a' : 'rgba(255,255,255,0.25)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}
