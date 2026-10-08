// Sky: a gradient dome with sun glow, a real star dome that turns with the night and the latitude, sun and moon discs, clouds, rain.
import { clamp, lerp, smooth, DEG, rng, canvasTex } from './util3.js';

// day keyframes by time of day (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk): zenith, horizon, sun colour, light intensity, ambient
const KEYS = [
  [0.00, '#050a1c', '#0c1a3a', '#9fb4ff', 0.0, 0.28],
  [0.19, '#07102a', '#1b2a58', '#9fb4ff', 0.0, 0.30],
  [0.235, '#2a3a78', '#e58a6c', '#ffb07a', 0.55, 0.42],
  [0.27, '#4f78c0', '#f6b987', '#ffd2a0', 1.7, 0.62],
  [0.34, '#3f86d6', '#a8cfee', '#fff0d8', 2.8, 0.85],
  [0.5, '#2c78d8', '#9fd0f0', '#fff6e6', 3.2, 0.95],
  [0.66, '#3a82d4', '#b2d4ee', '#fff0d8', 2.8, 0.85],
  [0.73, '#4a6fb8', '#f4b07a', '#ffc58a', 1.8, 0.62],
  [0.77, '#2b3170', '#d9627a', '#ff8e6a', 0.6, 0.42],
  [0.82, '#0b1230', '#2b2a5c', '#9fb4ff', 0.0, 0.30],
  [1.00, '#050a1c', '#0c1a3a', '#9fb4ff', 0.0, 0.28],
];
export function skyAt(THREE, tod) {
  tod = ((tod % 1) + 1) % 1;
  let i = 1; while (i < KEYS.length - 1 && tod > KEYS[i][0]) i++;
  const a = KEYS[i - 1], b = KEYS[i], t = clamp((tod - a[0]) / (b[0] - a[0]), 0, 1);
  const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return { zenith: c(a[1], b[1]), horizon: c(a[2], b[2]), sun: c(a[3], b[3]), keyI: lerp(a[4], b[4], t), amb: lerp(a[5], b[5], t) };
}
export function sunDir(THREE, tod) {
  const el = 76 * Math.sin((tod - 0.25) * Math.PI * 2) * DEG, az = (90 + ((tod - 0.25) / 0.5) * 180) * DEG;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
}
export function moonDir(THREE, tod) {
  const el = 62 * Math.sin((tod - 0.75) * Math.PI * 2) * DEG, az = (90 + (((tod + 0.5) % 1 - 0.25) / 0.5) * 180) * DEG;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
}

export const SKY_GLSL = `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uStorm; uniform vec3 uBelow;
vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(h, 0.5));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.45) * (1.0 - 0.7 * uStorm);
  c += uSunCol * exp(-abs(d.y) * 7.0) * pow(sd, 2.0) * 0.35;
  vec3 grey = vec3(dot(c, vec3(0.33))) * vec3(0.55, 0.58, 0.62);
  c = mix(c, grey, uStorm * 0.75);
  if (d.y < 0.0) c = mix(c, uBelow, smoothstep(0.0, -0.25, d.y));
  return c;
}`;

export function createSky(THREE, scene, quality) {
  const group = new THREE.Group();
  const R = 2600;
  const uniforms = {
    uZenith: { value: new THREE.Color('#2c78d8') }, uHorizon: { value: new THREE.Color('#9fd0f0') }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#fff') },
    uStorm: { value: 0 }, uBelow: { value: new THREE.Color('#0b2a3c') },
  };
  const domeMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  domeMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDir;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDir = normalize(position);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vDir;\n${SKY_GLSL}`).replace('#include <opaque_fragment>', 'gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);');
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), domeMat);
  dome.renderOrder = -10; dome.frustumCulled = false;
  group.add(dome);

  // ---- stars (about 60 named stars, the Milky Way band and faint field stars), drawn in celestial coordinates --------------
  let stars = null, starPivot = null, starMat = null;
  const STARS = [ // name, RA hours, Dec degrees, magnitude
    ['Polaris', 2.53, 89.26, 2.0], ['Sirius', 6.75, -16.72, -1.4], ['Canopus', 6.4, -52.7, -0.7], ['Betelgeuse', 5.92, 7.41, 0.5], ['Rigel', 5.24, -8.2, 0.1], ['Alnitak', 5.68, -1.94, 1.8], ['Alnilam', 5.6, -1.2, 1.7], ['Mintaka', 5.53, -0.3, 2.2],
    ['Aldebaran', 4.6, 16.5, 0.9], ['Pleiades', 3.79, 24.1, 1.6], ['Arcturus', 14.26, 19.18, -0.05], ['Spica', 13.42, -11.16, 1.0], ['Antares', 16.49, -26.43, 1.0], ['Vega', 18.62, 38.78, 0.0], ['Altair', 19.85, 8.87, 0.8], ['Deneb', 20.69, 45.28, 1.3],
    ['Acrux', 12.44, -63.1, 0.8], ['Mimosa', 12.8, -59.69, 1.3], ['Gacrux', 12.52, -57.11, 1.6], ['Imai', 12.25, -58.75, 2.6], ['Rigil Kent', 14.66, -60.83, 0.0], ['Hadar', 14.06, -60.37, 0.6], ['Fomalhaut', 22.96, -29.62, 1.2], ['Regulus', 10.14, 11.97, 1.4],
    ['Dubhe', 11.06, 61.75, 1.8], ['Merak', 11.03, 56.38, 2.3], ['Phecda', 11.9, 53.69, 2.4], ['Megrez', 12.26, 57.03, 3.3], ['Alioth', 12.9, 55.96, 1.8], ['Mizar', 13.4, 54.93, 2.2], ['Alkaid', 13.79, 49.31, 1.9],
    ['Schedar', 0.68, 56.54, 2.2], ['Caph', 0.15, 59.15, 2.3], ['Gamma Cas', 0.95, 60.72, 2.4], ['Ruchbah', 1.43, 60.24, 2.7], ['Alpheratz', 0.14, 29.09, 2.1], ['Mirach', 1.16, 35.62, 2.1], ['Capella', 5.28, 46.0, 0.1], ['Procyon', 7.65, 5.22, 0.4], ['Pollux', 7.76, 28.03, 1.1], ['Castor', 7.58, 31.89, 1.6],
    ['Shaula', 17.56, -37.1, 1.6], ['Sargas', 17.62, -43.0, 1.9], ['Kaus Aust', 18.4, -34.4, 1.8], ['Nunki', 18.92, -26.3, 2.0], ['Achernar', 1.63, -57.24, 0.5], ['Alphard', 9.46, -8.66, 2.0], ['Miaplacidus', 9.22, -69.7, 1.7], ['Avior', 8.38, -59.5, 1.9],
    ['Menkent', 14.11, -36.4, 2.1], ['Zubenelgenubi', 14.85, -16.0, 2.7], ['Dschubba', 16.0, -22.6, 2.3], ['Eltanin', 17.94, 51.49, 2.2], ['Rasalhague', 17.58, 12.56, 2.1], ['Albireo', 19.51, 27.96, 3.1], ['Enif', 21.74, 9.88, 2.4], ['Markab', 23.08, 15.2, 2.5], ['Scheat', 23.06, 28.08, 2.4], ['Algenib', 0.22, 15.18, 2.8], ['Hamal', 2.12, 23.46, 2.0],
  ];
  const LINES = [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'], ['Acrux', 'Gacrux'], ['Mimosa', 'Imai']];
  function buildStarTexture() {
    return canvasTex(THREE, quality === 'low' ? 1024 : 2048, quality === 'low' ? 512 : 1024, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const R = rng(99), px = (ra, dec) => [((ra / 24) % 1) * w, ((90 - dec) / 180) * h];
      // Milky Way band: points scattered around the galactic plane
      const m = (a, b, c) => [a, b, c];
      const gp = (Math.PI / 180);
      const ngp = [192.86 * gp, 27.13 * gp];   // galactic north pole (RA, Dec)
      const nv = [Math.cos(ngp[1]) * Math.cos(ngp[0]), Math.cos(ngp[1]) * Math.sin(ngp[0]), Math.sin(ngp[1])];
      const e1 = (() => { const v = [-nv[1], nv[0], 0]; const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l, 0]; })();
      const e2 = [nv[1] * e1[2] - nv[2] * e1[1], nv[2] * e1[0] - nv[0] * e1[2], nv[0] * e1[1] - nv[1] * e1[0]];
      void m;
      for (let i = 0; i < 9000; i++) {
        const l = R() * Math.PI * 2, b = (R() + R() + R() - 1.5) * 0.28 * (0.5 + 0.8 * Math.cos(l - 0.3) ** 2);
        const v = [0, 1, 2].map((k) => Math.cos(b) * (Math.cos(l) * e1[k] + Math.sin(l) * e2[k]) + Math.sin(b) * nv[k]);
        const ra = (Math.atan2(v[1], v[0]) / gp / 15 + 24) % 24, dec = Math.asin(v[2]) / gp;
        const [x, y] = px(ra, dec); g.fillStyle = `rgba(190,200,235,${0.025 + R() * 0.06})`; g.beginPath(); g.arc(x, y, 1 + R() * 2.4, 0, 7); g.fill();
      }
      for (let i = 0; i < 2200; i++) {
        const ra = R() * 24, dec = Math.asin(R() * 2 - 1) / gp, [x, y] = px(ra, dec), a = 0.25 + R() * 0.6;
        g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, 1.2, 1.2);
      }
      const byName = {};
      for (const [n, ra, dec, mag] of STARS) {
        const [x, y] = px(ra, dec), r = clamp(3.4 - mag * 0.9, 1.4, 6.5), warm = n === 'Antares' || n === 'Betelgeuse' || n === 'Arcturus' || n === 'Aldebaran' ? '255,200,150' : n === 'Rigel' || n === 'Sirius' || n === 'Vega' ? '200,220,255' : '255,250,240';
        const grd = g.createRadialGradient(x, y, 0, x, y, r * 3); grd.addColorStop(0, `rgba(${warm},1)`); grd.addColorStop(0.3, `rgba(${warm},0.55)`); grd.addColorStop(1, `rgba(${warm},0)`);
        g.fillStyle = grd; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); byName[n] = [x, y];
      }
      g.strokeStyle = 'rgba(180,200,255,0.22)'; g.lineWidth = 1.4;
      for (const [a, b] of LINES) { if (byName[a] && byName[b]) { g.beginPath(); g.moveTo(...byName[a]); g.lineTo(...byName[b]); g.stroke(); } }
    });
  }
  function initStars() {
    const tex = buildStarTexture();
    starMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 });
    stars = new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 48, 24), starMat);
    stars.frustumCulled = false; stars.renderOrder = -9;
    starPivot = new THREE.Group(); starPivot.add(stars); group.add(starPivot);
    // markers for the guiding stars (read back to aim the camera during a sight)
    const mk = (ra, dec) => { const o = new THREE.Group(); const phi = (ra / 24) * Math.PI * 2, th = ((90 - dec) / 180) * Math.PI; o.position.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)).multiplyScalar(R * 0.9); stars.add(o); return o; };
    stars.userData.polaris = mk(2.53, 89.26); stars.userData.acrux = mk(12.44, -63.1);
  }
  initStars();

  // ---- sun, moon, clouds -----------------------------------------------------------------------------------------------------------------------------------
  const glowTex = canvasTex(THREE, 128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,245,225,0.95)'); gr.addColorStop(0.3, 'rgba(255,225,170,0.35)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  sunSpr.scale.set(560, 560, 1); sunSpr.renderOrder = -8; group.add(sunSpr);
  const moonTex = canvasTex(THREE, 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,250,235,0.5)'); gr.addColorStop(1, 'rgba(200,215,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe0'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.17, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,160,150,0.35)'; for (const [x, y, r] of [[0.46, 0.46, 0.04], [0.55, 0.52, 0.05], [0.5, 0.6, 0.03], [0.44, 0.55, 0.025]]) { g.beginPath(); g.arc(w * x, h * y, w * r, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(w * 0.6, h * 0.46, w * 0.15, 0, 7); g.fill();
  });
  const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, depthWrite: false, fog: false, transparent: true }));
  moonSpr.scale.set(190, 190, 1); moonSpr.renderOrder = -8; group.add(moonSpr);

  const cloudTex = canvasTex(THREE, 256, 128, (g, w, h) => {
    const R = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = w * (0.18 + 0.64 * R()), y = h * (0.45 + 0.2 * R()) - Math.abs(x - w / 2) * 0.1, r = h * (0.16 + 0.22 * R());
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const clouds = [];
  const Rc = rng(31);
  const nClouds = quality === 'low' ? 9 : 18;
  for (let i = 0; i < nClouds; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, depthWrite: false, fog: false, transparent: true, opacity: 0.9, rotation: 0 });
    const s = new THREE.Sprite(m); const az = Rc() * Math.PI * 2, el = (0.07 + 0.38 * Rc()) * 1.2, d = 2100;
    s.userData = { az, el, d, sz: 480 + 700 * Rc(), sp: 0.002 + 0.004 * Rc() };
    s.scale.set(s.userData.sz, s.userData.sz * 0.5, 1); s.renderOrder = -7; group.add(s); clouds.push(s);
  }
  scene.add(group);

  const tmpC = new THREE.Color();
  return {
    group, uniforms, clouds, stars, starPivot,
    // ship position follows: the dome is centred on the camera each frame
    update({ tod, camPos, lat, storm, windFrom, t }) {
      const k = skyAt(THREE, tod), sd = sunDir(THREE, tod), md = moonDir(THREE, tod);
      group.position.copy(camPos);
      const st = storm || 0;
      uniforms.uZenith.value.copy(k.zenith); uniforms.uHorizon.value.copy(k.horizon); uniforms.uSunCol.value.copy(k.sun); uniforms.uSunDir.value.copy(sd); uniforms.uStorm.value = st;
      uniforms.uBelow.value.copy(k.horizon).multiplyScalar(0.55);
      const night = clamp((0.3 - Math.max(0, sd.y + 0.12)) / 0.3, 0, 1);
      starMat.opacity = clamp(night * (1 - st * 0.85), 0, 1);
      stars.visible = starMat.opacity > 0.01;
      // turn the star dome: the pole stands at an altitude equal to the latitude
      starPivot.rotation.x = (lat - 90) * DEG;
      stars.rotation.y = tod * Math.PI * 2 + 1.2;
      sunSpr.position.copy(sd).multiplyScalar(2400); sunSpr.material.opacity = clamp(sd.y * 6 + 0.9, 0, 1) * (1 - st * 0.8);
      sunSpr.material.color.copy(k.sun);
      moonSpr.position.copy(md).multiplyScalar(2300); moonSpr.material.opacity = clamp(md.y * 5 + 0.2, 0, 1) * (1 - st * 0.7);
      for (const c of clouds) {
        const u = c.userData; u.az += u.sp * 0.0016;
        const az = u.az, el = u.el;
        c.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(u.d);
        const lit = clamp(k.amb * 1.1 + 0.15, 0.1, 1.15);
        c.material.color.setRGB(lit * (0.82 + k.sun.r * 0.18), lit * (0.84 + k.sun.g * 0.16), lit * (0.9 + k.sun.b * 0.1)).lerp(tmpC.setRGB(0.18, 0.19, 0.22), st * 0.8);
        c.material.opacity = (0.55 + 0.4 * st) * (night > 0.8 ? 0.55 : 1);
      }
      void windFrom; void t;
      return { k, sd, md, night };
    },
    starTarget(lat) { return (lat >= 0 ? stars.userData.polaris : stars.userData.acrux); },
    stormClouds(on) { for (const c of clouds) c.userData.storm = on; },
  };
}
