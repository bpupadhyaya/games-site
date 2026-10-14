// The play screen: the painted place with its eight spots, the children, the clues and the HUD around it. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, playLayout, sceneRect, spotPos, homePos } from './layout.js';
import { spotXZ, homeXZ, project } from './worldmap.js';
import { PLACES, LEVELS, NSPOT, COUNT_T, ADJ, HOME, canSneak } from './sim.js';
import { THEMES, drawPlace, drawSpot, drawKid, badge, roundRectPath } from './art.js';
import { FONT, DISPLAY, drawButton, textShadow, wrapLines, ease } from './ui.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(Math.min(1.6, TEXT_SCALES[state.settings.textIdx]), !!(state.run && state.run.mode === 'watch'));
const COL = { cold: '#4aa8e8', warm: '#f2a92e', hot: '#e8503a', ok: '#6fe0a0', gold: '#ffd97a' };
const minPx = (host) => (host && host.px > 0 ? Math.ceil(11 / host.px) : 0);

// ---- the world --------------------------------------------------------------------------------------------------------------
// Everything in the place is a "world" object in metres (worldmap.js). With the 3D layer loaded (view3d/world.js) they are rendered
// as a lit 3D scene; without it (no WebGL2, load failure, context loss) the same model is drawn with the 2D pictures at the projected
// positions, so hit-testing and overlays are identical in both.
const world = () => globalThis.__world3d && globalThis.__world3d.ready ? globalThis.__world3d : null;
const KINDS = PLACES.map((pl) => pl.spots.map((s) => ({ kind: s.kind, v: s.v })));
const ease2 = { inOut: ease.inOut };

// the model one frame shows: where every child stands and what they do (look = which child), plus the markers
function buildModel(sc, w, place, t, opts) {
  const tall = sc.tall, pl = PLACES[place];
  const XZ = (i) => spotXZ(i, tall);
  const [hx, hz] = homeXZ(tall);
  const kids = [];
  const hide = w && w.mode === 'hide';
  const sideOf = (X) => (X > 0 ? -1 : 1);
  const behind = (i) => { const [X, Z] = XZ(i); return [X + 0.08, Z - 0.75]; };
  const beside = (i, d = 1.35) => { const [X, Z] = XZ(i); return [X + sideOf(X) * d, Z + 0.55]; };
  if (w) {
    if (hide && w.me) {
      const m = w.me;
      if (w.phase === 'pick' || (m.spot < 0 && !m.moving)) kids.push({ look: 5, X: hx + 1.2, Z: hz + 1.1, pose: 'stand', visible: true });
      else if (w.over && w.win && m.spot >= 0) { const [X, Z] = beside(m.spot, 1.4); kids.push({ look: 5, X, Z, pose: 'cheer', visible: true }); }
      else if (w.over && !w.win && m.spot >= 0) { const [X, Z] = beside(w.sk.target >= 0 ? w.sk.target : m.spot, 1.1); kids.push({ look: 5, X, Z, pose: 'startle', visible: true }); }
      else if (m.moving) { const [X, Z] = behind(m.to); kids.push({ look: 5, X, Z, pose: 'crouch', visible: true }); }
      else if (m.spot >= 0) { const [X, Z] = behind(m.spot); kids.push({ look: 5, X, Z, pose: 'crouch', visible: true }); }
    }
    if (w.mode === 'seek') {
      const sk = opts.seekerPos;
      w.hiders.forEach((h) => {
        if (!h.found) return;
        const [X, Z] = beside(h.spot, 1.3);
        const near = sk ? Math.hypot(sk.x - X, sk.z - Z) < 2.8 : true;
        const show = near || h.ft > 2.4;
        kids.push({ look: h.kid, X, Z, pose: h.ft < 0.9 ? 'startle' : 'cheer', visible: show, slide: true });
      });
    }
  }
  // the seeker
  {
    const v = opts.vis;
    let X, Z, face = null, pose = 'stand';
    const home = () => { X = hx + 0.75; Z = hz + 0.2; face = [hx, hz - 0.2]; };
    const to = v ? v.to : -1;
    if (to < 0) home(); else { const [sx, sz] = XZ(to); X = sx + sideOf(sx) * 1.35 * -1; Z = sz + 0.65; face = [sx, sz]; }
    // stand on the side of the spot that faces the middle of the place
    if (to >= 0) { const [sx, sz] = XZ(to); const d = sx > 0 ? -1 : 1; X = sx + d * 1.3; Z = sz + 0.6; }
    const counting = w && (w.phase === 'count' || w.phase === 'pick') && to < 0;
    if (counting) pose = 'eyes';
    kids.push({ look: 4, X, Z, pose, faceX: face ? face[0] : null, faceZ: face ? face[1] : null, visible: true, seeker: true });
  }
  const model = {
    place, kinds: KINDS[place], tall, cam: sc.cam, rect: sc.stage, t, round: w ? `${w.mode}${w.place}${w.level}${w.looks}` : 'x',
    shake: opts.vis && opts.vis.shake ? opts.vis.shake.map((x, i) => (w && w.anim && w.anim.type === 'look' && w.anim.spot === i ? Math.max(x, 1 - Math.min(1, w.anim.t / w.anim.dur)) : x)) : null,
    kids,
  };
  if (w) {
    model.looked = w.mode === 'seek' ? w.looked : null; model.clue = w.clue;
    model.found = w.mode === 'seek' ? w.hiders.filter((h) => h.found).map((h) => h.spot) : [];
    model.mine = hide && w.me && !w.me.moving && w.me.spot >= 0 && w.phase !== 'pick' ? w.me.spot : -1;
    model.hint = opts.hint && opts.hint.id != null && opts.hint.kind !== 'listen' ? opts.hint.id : -1;
    model.cursor = opts.cursor != null ? opts.cursor : -1;
    model.target = hide && w.phase === 'search' && !w.over && w.sk.phase !== 'think' ? w.sk.target : -1;
    model.sneak = hide && w.phase === 'search' && !w.over && w.me.spot >= 0 && !w.me.moving ? ADJ[w.me.spot].filter((s) => canSneak(w, s)) : [];
    model.listen = w.anim && w.anim.type === 'listen' ? w.anim.group : [];
    model.listenA = w.anim && w.anim.type === 'listen' ? w.anim.t / w.anim.dur : 0;
  }
  return model;
}

// opts: { hint, hover, noHud, pick, vis (visual state: seeker position), pops, fx, host }
export function drawScene(ctx, stage, w, place, t, opts = {}) {
  const sc = sceneRect(stage), th = PLACES[place].theme, pl = PLACES[place];
  const pos = (i) => spotPos(sc, i);
  const fsz = Math.max(Math.round(15 * sc.s * 1.1), minPx(opts.host), 12);
  const hide = w && w.mode === 'hide';
  const look = w && w.anim && w.anim.type === 'look' ? w.anim : null;
  const wd = world();
  const W3 = wd && !globalThis.__world3dOff;
  const sk3 = W3 && wd.kids[4] && wd.kids[4].have ? { x: wd.kids[4].x, z: wd.kids[4].z } : null;
  const model = buildModel(sc, w, place, t, { ...opts, seekerPos: sk3 });
  let drew3 = false;
  if (W3) { try { drew3 = wd.render(ctx, model); } catch (e) { console.warn('3D world failed, using the 2D picture', e); globalThis.__world3dOff = true; } }
  if (!drew3) draw2D(ctx, sc, w, place, t, opts, model, th, pl);

  // clue badges, listen marks, the hint ring and the target marker sit on top of everything
  if (w) {
    if (w.mode === 'seek') {
      for (let i = 0; i < NSPOT; i++) {
        if (w.looked[i] === 0) continue;
        const p = pos(i), c = w.clue[i], lv = LEVELS[w.level];
        const col = c <= 0 ? COL.cold : c === 1 ? COL.warm : COL.hot;
        const text = lv.counts ? String(c) : c > 0 ? 'warm' : 'cold';
        badge(ctx, text, p.x, p.y + 30 * p.k, Math.max(fsz, lv.counts ? 15 : 12), col);
      }
      w.marks.forEach((g, gi) => {
        const latest = gi === w.marks.length - 1;
        g.forEach((s) => {
          if (w.looked[s] !== 0) return;
          const p = pos(s), bob = Math.sin(t * 3 + s) * 4 * p.k;
          ctx.save(); ctx.globalAlpha = latest ? 1 : 0.45;
          ctx.translate(p.x, p.y - 188 * p.k + bob);
          ctx.fillStyle = 'rgba(255,248,214,0.95)'; ctx.strokeStyle = '#d9a52c'; ctx.lineWidth = 3;
          roundRectPath(ctx, -22 * Math.max(0.6, p.k), -16 * Math.max(0.6, p.k), 44 * Math.max(0.6, p.k), 30 * Math.max(0.6, p.k), 12); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#8a5a14'; ctx.font = `800 ${Math.round(22 * Math.max(0.6, p.k))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', 0, 1);
          ctx.restore();
        });
      });
    }
    if (hide && w.phase === 'search' && !w.over) {
      const k = w.sk;
      if (k.phase !== 'think' && k.target >= 0) {
        const p = pos(k.target);
        badge(ctx, 'looking here', p.x, p.y - 226 * p.k - 10, Math.max(fsz, 12), '#c8362a');
      }
    }
    if (hide && w.me && w.me.spot >= 0 && w.phase !== 'pick' && !w.me.moving) {
      const p = pos(w.me.spot);
      badge(ctx, 'you', p.x, p.y - 190 * p.k, Math.max(fsz, 13), '#2f9c5a');
    }
    if (!drew3) {
      // the 2D fallback has no 3D markers: draw the rings and cones as before
      if (w.mode === 'seek' && w.anim && w.anim.type === 'listen') {
        const a = w.anim.t / w.anim.dur;
        w.anim.group.forEach((s) => { const p = pos(s); ctx.save(); ctx.globalAlpha = Math.sin(a * Math.PI); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 4 * p.k; ctx.beginPath(); ctx.ellipse(p.x, p.y - 60 * p.k, (50 + a * 36) * p.k, (60 + a * 24) * p.k, 0, 0, TAU); ctx.stroke(); ctx.restore(); });
      }
      if (hide && w.phase === 'search' && !w.over) {
        const k = w.sk;
        if (k.phase !== 'think' && k.target >= 0) {
          const p = pos(k.target), pulse = 0.5 + 0.5 * Math.sin(t * 9);
          ctx.save(); ctx.translate(p.x, p.y - 196 * p.k - pulse * 6 * p.k);
          ctx.fillStyle = '#e8503a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(0, 20 * p.k + 8); ctx.lineTo(-18 * Math.max(0.7, p.k), -6); ctx.lineTo(18 * Math.max(0.7, p.k), -6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        if (w.me.spot >= 0 && !w.me.moving) {
          ADJ[w.me.spot].forEach((s) => {
            if (!canSneak(w, s)) return;
            const p = pos(s), pulse = 0.5 + 0.5 * Math.sin(t * 4 + s);
            ctx.save(); ctx.globalAlpha = 0.55 + 0.35 * pulse; ctx.strokeStyle = '#8af0b0'; ctx.lineWidth = 5 * Math.max(0.7, p.k); ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.ellipse(p.x, p.y - 4 * p.k, 70 * p.k, 18 * p.k, 0, 0, TAU); ctx.stroke(); ctx.restore();
          });
        }
      }
      if (opts.cursor != null && opts.cursor >= 0) {
        const p = pos(opts.cursor);
        ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * Math.max(0.7, p.k); ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 70 * p.k, 82 * p.k, 92 * p.k, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (opts.hint && opts.hint.id != null && opts.hint.kind !== 'listen') {
        const p = pos(opts.hint.id), pulse = 0.5 + 0.5 * Math.sin(t * 5);
        ctx.save(); ctx.strokeStyle = `rgba(255,224,110,${0.65 + 0.3 * pulse})`; ctx.lineWidth = 6 * Math.max(0.7, p.k); ctx.setLineDash([16, 12]);
        ctx.beginPath(); ctx.ellipse(p.x, p.y - 70 * p.k, (86 + pulse * 8) * p.k, (96 + pulse * 8) * p.k, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
  }
  void look; void hide; void th; void pl; void ease2;
  return sc;
}

// the 2D picture of the same model (fallback)
function draw2D(ctx, sc, w, place, t, opts, model, th, pl) {
  drawPlace(ctx, th, sc.stage, sc.hz, t, 0, sc.s);
  const items = [];
  const pos = (i) => spotPos(sc, i);
  const hide = w && w.mode === 'hide';
  const look = w && w.anim && w.anim.type === 'look' ? w.anim : null;
  if (w) {
    for (let i = 0; i < NSPOT; i++) {
      if (w.mode !== 'seek' || w.looked[i] === 0) continue;
      const p = pos(i), c = w.clue[i];
      const col = c <= 0 ? COL.cold : c === 1 ? COL.warm : COL.hot;
      ctx.save(); ctx.translate(p.x, p.y + 4 * p.k); ctx.scale(1, 0.26);
      ctx.beginPath(); ctx.arc(0, 0, 92 * p.k, 0, TAU); ctx.lineWidth = 9 * p.k; ctx.strokeStyle = col; ctx.globalAlpha = 0.85; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 92 * p.k, 0, TAU); ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }
  }
  const mineSpot = hide && w.me && !w.me.moving && w.me.spot >= 0 && w.phase !== 'pick' ? w.me.spot : -1;
  for (let i = 0; i < NSPOT; i++) {
    const p = pos(i);
    items.push({ y: p.y, draw: () => {
      const sp = pl.spots[i];
      const mine = mineSpot === i;
      if (mine) drawKid(ctx, 5, p.x + 4 * p.k, p.y - 4 * p.k, 112 * p.k, 'crouch', t, {});
      const shake = look && look.spot === i ? Math.min(1, look.t / look.dur) : (opts.vis && opts.vis.shake && opts.vis.shake[i] > 0 ? 1 - opts.vis.shake[i] : 0);
      const lit = opts.hint && opts.hint.id === i && opts.hint.kind !== 'listen' ? 0.5 + 0.5 * Math.sin(t * 5) : (opts.pickLit ? 0.25 + 0.2 * Math.sin(t * 3 + i) : 0);
      drawSpot(ctx, th, sp.kind, p.x, p.y, p.k, { v: sp.v, t, shake, light: lit });
      if (mine) drawKid(ctx, 5, p.x + 4 * p.k, p.y - 4 * p.k, 112 * p.k, 'crouch', t, { alpha: 0.38 });
    } });
  }
  for (const c of model.kids) {
    if (!c.visible || (c.look === 5 && c.pose === 'crouch' && mineSpot >= 0)) continue;
    const p = project(sc.cam, c.X, 0, c.Z);
    const pose = c.pose === 'startle' ? 'cheer' : c.pose;
    items.push({ y: p.y + 4, draw: () => drawKid(ctx, c.look, p.x, p.y, 100 * p.k, pose, t + c.look, { flip: c.faceX != null && c.faceX < c.X }) });
  }
  items.sort((a, b) => a.y - b.y);
  items.forEach((it) => it.draw());
}

// the title and menus backdrop: a place where children peek out of the spots, one after another
export function drawAttract(ctx, stage, place, t, host) {
  const sc = sceneRect(stage), th = PLACES[place].theme, pl = PLACES[place];
  const tall = sc.tall, kids = [];
  for (let i = 0; i < NSPOT; i++) {
    const [X, Z] = spotXZ(i, tall);
    const ph = ((t * 0.32 + i * 0.37) % 3.2), up = ph < 1.4 ? Math.sin((ph / 1.4) * Math.PI) : 0, dir = i % 2 ? -1 : 1;
    if (up > 0.03) kids.push({ look: i % 6, X: X + dir * (0.25 + 0.85 * Math.min(1, up * 1.6)), Z: Z - 0.55 + 0.1 * up, pose: 'peek', visible: true, faceX: X, faceZ: Z + 2, noChase: true });
  }
  const wd = world();
  let drew3 = false;
  if (wd && !globalThis.__world3dOff) {
    // hero shot: a low, slowly drifting camera on the middle of the place, framed into the part the menu leaves free
    const land = stage.w > stage.h, d = Math.sin(t * 0.11);
    const cam = land
      ? { fov: 30 * Math.PI / 180, pitch: 9 * Math.PI / 180, pos: [d * 1.6 + 0.6, 2.3, 9.5], shift: [0.42, -0.1] }
      : { ...sc.cam, pos: [sc.cam.pos[0] + d * 0.8, sc.cam.pos[1], sc.cam.pos[2]], shift: [0, -0.1] };
    const model = { place, kinds: KINDS[place], tall, cam, rect: sc.stage, t, round: 'attract', kids, attract: true };
    try { drew3 = wd.render(ctx, model); } catch (e) { console.warn('3D world failed, using the 2D picture', e); globalThis.__world3dOff = true; }
  }
  if (!drew3) {
    drawPlace(ctx, th, stage, sc.hz, t, 0, sc.s);
    const items = [];
    for (let i = 0; i < NSPOT; i++) {
      const p = spotPos(sc, i), ph = ((t * 0.32 + i * 0.37) % 3.2), up = ph < 1.4 ? Math.sin((ph / 1.4) * Math.PI) : 0, dir = i % 2 ? -1 : 1;
      items.push({ y: p.y, draw: () => {
        if (up > 0.02) { ctx.save(); ctx.beginPath(); ctx.rect(p.x - 140 * p.k, p.y - 400 * p.k, 280 * p.k, 400 * p.k + 2); ctx.clip(); drawKid(ctx, i % 4, p.x + dir * 40 * p.k, p.y + (1 - up) * 96 * p.k, 120 * p.k, 'peek', t + i); ctx.restore(); }
        drawSpot(ctx, th, pl.spots[i].kind, p.x, p.y, p.k, { v: pl.spots[i].v, t });
      } });
    }
    items.sort((a, b) => a.y - b.y); items.forEach((it) => it.draw());
  }
  void host;
  return sc;
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------
function hudText(ctx, text, x, y, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${size}px ${o.font ?? FONT}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle';
  if (o.shadow !== false) textShadow(ctx, text, x, y, o.col ?? '#fff6e6', 5); else { ctx.fillStyle = o.col ?? '#fff6e6'; ctx.fillText(text, x, y); }
}
// a carved wooden plaque with a brass edge (score, looks, tray): depth from a lit top edge, a dark inset and a drop shadow
function chip(ctx, r, fill) {
  const rad = Math.min(20, r.h / 2);
  ctx.save();
  roundRectPath(ctx, r.x + 1, r.y + 5, r.w - 2, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#5b3a22'); g.addColorStop(0.5, '#3f2716'); g.addColorStop(1, '#2c1b0f');
  ctx.fillStyle = fill || g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.16; ctx.strokeStyle = '#000';
  for (let y = r.y + 5; y < r.y + r.h; y += 7) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x, y); ctx.bezierCurveTo(r.x + r.w * 0.3, y - 2, r.x + r.w * 0.6, y + 2, r.x + r.w, y); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
  roundRectPath(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, rad - 1.5); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.stroke();
  roundRectPath(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, Math.max(4, rad - 5)); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,5,0,0.35)'; ctx.stroke();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c9a04a'; ctx.stroke();
  ctx.restore();
}
export const modeName = (m) => (m === 'seek' ? 'Seek' : m === 'hide' ? 'Hide' : m === 'daily' ? 'Daily Hunt' : 'Watch & Learn');

export function renderPlay(ctx, state, host) {
  const L = layoutOf(state), w = state.ws, run = state.run, t = state.t;
  const watch = run.mode === 'watch', hide = w.mode === 'hide', fs = L.fs;
  const sc = drawScene(ctx, L.stage, w, w.place, t, { hint: state.hint, vis: state.vis, host, cursor: state.cur, pickLit: hide && w.phase === 'pick' });
  state.sc = sc;
  void H;

  // score
  chip(ctx, L.score);
  hudText(ctx, `${w.score}`, L.score.x + L.score.w / 2, L.score.y + L.score.h * 0.42, fs.big, { font: DISPLAY, weight: 800, col: COL.gold });
  const sub = hide ? (w.over ? 'finished' : w.phase === 'pick' ? 'choose your hiding place' : `survived ${Math.max(0, w.looksUsed)} of ${w.looks}`)
    : w.over ? 'finished' : `${w.found} of ${w.hiders.length} found`;
  hudText(ctx, sub, L.score.x + L.score.w / 2, L.score.y + L.score.h - fs.small * 1.15, fs.small, { weight: 600, col: 'rgba(255,240,220,0.85)' });

  // buttons
  if (!watch) {
    drawButton(ctx, L.pause, 'Pause', { dark: true, size: fs.btn });
    drawButton(ctx, L.think, state.hint ? 'Close' : 'Think', { dark: true, size: fs.btn, active: !!state.hint });
  } else {
    const D = L.demo, st = state.settings, dis = st.thinkIdx;
    drawButton(ctx, D.dec, '−', { dark: true, size: fs.btn, disabled: dis === 0 });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: fs.btn });
    drawButton(ctx, D.inc, '+', { dark: true, size: fs.btn, disabled: dis >= 3 });
    drawButton(ctx, D.exit, 'Exit', { dark: true, size: fs.btn });
  }

  // looks strip
  const G = L.gauge; chip(ctx, G);
  const n = w.looks, pad = 14, pr = Math.min(G.h * 0.3, 22), room = G.w - 2 * pad - Math.round(fs.lab * 5.4);
  const step = Math.min(pr * 2 + 8, room / Math.max(1, n));
  for (let i = 0; i < n; i++) {
    const cx = G.x + pad + pr + i * step, cy = G.y + G.h / 2, used = i < w.looksUsed, r = Math.min(pr, step / 2 - 2);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    if (hide) { ctx.fillStyle = used ? 'rgba(111,224,160,0.9)' : 'rgba(255,255,255,0.16)'; } else { ctx.fillStyle = used ? 'rgba(255,255,255,0.12)' : '#fff6df'; }
    ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = hide ? (used ? '#2f9c5a' : 'rgba(255,255,255,0.35)') : (used ? 'rgba(255,255,255,0.3)' : '#e8a43a'); ctx.stroke();
    if (!hide && used) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.5); ctx.lineTo(cx + r * 0.5, cy + r * 0.5); ctx.moveTo(cx + r * 0.5, cy - r * 0.5); ctx.lineTo(cx - r * 0.5, cy + r * 0.5); ctx.stroke(); }
  }
  const lx = G.x + G.w - pad - Math.round(fs.lab * 2.4);
  hudText(ctx, hide ? `${w.looksUsed}/${w.looks}` : `${w.looks - w.looksUsed}`, lx, G.y + G.h * 0.4, fs.lab * 1.15, { weight: 800, col: COL.gold });
  hudText(ctx, hide ? 'SEEKER LOOKS' : 'LOOKS LEFT', lx, G.y + G.h * 0.76, Math.max(10, Math.round(fs.lab * 0.55)), { weight: 700, col: 'rgba(255,240,220,0.7)', shadow: false });

  // tray: who is found + Listen (seek) or your status (hide)
  const B = L.tray; chip(ctx, B);
  if (!hide) {
    const K = L.kids, cnt = w.hiders.length, ic = Math.min(K.h * 0.82, K.w / cnt, 70);
    for (let i = 0; i < cnt; i++) {
      const h = w.hiders[i], cx = K.x + (i + 0.5) * (K.w / cnt), cy = K.y + K.h * 0.5;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, ic * 0.5, 0, TAU); ctx.fillStyle = h.found ? 'rgba(255,246,223,0.95)' : 'rgba(255,255,255,0.12)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = h.found ? COL.ok : 'rgba(255,255,255,0.3)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, ic * 0.5 - 2, 0, TAU); ctx.clip();
      if (h.found) { const wd = world(), pc = wd && wd.portrait(h.kid, 128); if (pc) ctx.drawImage(pc, cx - ic * 0.5, cy - ic * 0.5, ic, ic); else drawKid(ctx, h.kid, cx, cy + ic * 0.78, ic * 1.5, 'stand', 0); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `800 ${Math.round(ic * 0.5)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cx, cy + 2); }
      ctx.restore();
    }
    const can = !watch && w.phase === 'search' && !w.anim && !w.over && w.listens > 0 && w.looksUsed < w.looks;
    const lh = state.hint && state.hint.kind === 'listen';
    drawButton(ctx, L.listen, 'Listen', { sub: `${w.listens} left, costs a look`, size: fs.btn, disabled: !can, active: !!lh, dark: !lh });
    if (lh) { const pulse = 0.5 + 0.5 * Math.sin(t * 6); ctx.save(); ctx.strokeStyle = `rgba(255,224,110,${0.6 + 0.35 * pulse})`; ctx.lineWidth = 5; roundRectPath(ctx, L.listen.x - 4, L.listen.y - 4, L.listen.w + 8, L.listen.h + 8, 22); ctx.stroke(); ctx.restore(); }
  } else {
    const K = L.tray, m = w.me, sp = PLACES[w.place].spots, tx = K.x + 18, size = Math.max(fs.mid, 15);
    const l1 = w.phase === 'pick' ? 'Tap a place to hide' : m.moving ? 'Sneaking…' : `Hiding: ${sp[m.spot].name}`;
    const l2 = w.phase === 'pick' ? 'The seeker remembers where you like to hide.' : `Sneaks made: ${m.hops}${w.sk.heard >= 0 ? ' · a rustle was heard' : ''}`;
    if (K.h > K.w * 0.55) {
      hudText(ctx, l1, K.x + K.w / 2, K.y + K.h * 0.3, size, { col: '#fff6e6' });
      const lines = wrapLines((ctx.font = `600 ${fs.small}px ${FONT}`, ctx), l2, K.w - 30);
      lines.forEach((l, i) => hudText(ctx, l, K.x + K.w / 2, K.y + K.h * 0.3 + fs.small * 1.8 + i * fs.small * 1.3, fs.small, { weight: 600, col: 'rgba(255,240,220,0.8)' }));
      const tip = w.phase === 'pick' ? 'Good places hide best, but the seeker learns your habits: vary them.' : 'When the red marker lands on you, tap a green dotted neighbour to sneak there. Sneaking makes a little noise.';
      const tl = wrapLines((ctx.font = `600 ${fs.small}px ${FONT}`, ctx), tip, K.w - 40), y0 = K.y + K.h * 0.3 + fs.small * 1.8 + lines.length * fs.small * 1.3 + fs.small * 1.4;
      if (y0 + tl.length * fs.small * 1.3 < K.y + K.h - 10) tl.forEach((l, i) => hudText(ctx, l, K.x + K.w / 2, y0 + i * fs.small * 1.3, fs.small, { weight: 600, col: '#bfe9ff' }));
    } else {
      hudText(ctx, l1, tx, K.y + K.h * 0.34, size, { align: 'left', col: '#fff6e6' });
      hudText(ctx, l2, tx, K.y + K.h * 0.7, fs.small, { align: 'left', weight: 600, col: 'rgba(255,240,220,0.8)' });
    }
  }

  // pops and banners
  for (const p of state.pops) {
    const a = p.t / p.max, sp = spotPos(sc, p.spot), x = sp.x, y = sp.y - 150 * sp.k - a * 60;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - a * a); hudText(ctx, p.text, x, y, Math.round(34 * p.size), { font: DISPLAY, weight: 800, col: p.col }); ctx.restore();
  }
  const S = L.stage;
  if (state.banner) {
    const b = state.banner, a = b.t / b.max, k = a < 0.12 ? ease.outBack(a / 0.12) : 1, o = a > 0.8 ? 1 - (a - 0.8) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = o; ctx.translate(S.x + S.w / 2, S.y + S.h * 0.3); ctx.scale(k, k);
    hudText(ctx, b.text, 0, 0, Math.round(Math.min(86, S.w * 0.12)), { font: DISPLAY, weight: 800, col: b.col });
    hudText(ctx, b.sub, 0, Math.min(56, S.w * 0.08), Math.round(Math.max(18, fs.mid)), { weight: 700, col: '#fff6e6' });
    ctx.restore();
  }
  // the count
  if (w.phase === 'count' && !w.over) {
    const left = Math.max(1, Math.ceil(10 * (1 - w.phaseT / COUNT_T)));
    hudText(ctx, w.mode === 'hide' ? `Counting… ${left}` : `Counting… ${left}`, S.x + S.w / 2, S.y + S.h * 0.14, Math.round(Math.min(70, S.w * 0.1)), { font: DISPLAY, weight: 800, col: '#fff6e6' });
  } else if (hide && w.phase === 'pick') {
    hudText(ctx, 'Where will you hide?', S.x + S.w / 2, S.y + S.h * 0.1, Math.round(Math.min(52, S.w * 0.075)), { font: DISPLAY, weight: 800, col: '#fff6e6' });
  }
  // Think text, Watch & Learn status
  if (state.hint) drawNote(ctx, S, state.hint.why, '#ffe9a0');
  else if (watch && state.dec) {
    const d = state.dec, left = Math.max(0, d.dur - d.t);
    const msg = d.phase === 'think' ? `Thinking… ${Math.ceil(left)} s` : d.phase === 'reveal' ? `Choosing: ${d.why}` : 'Looking';
    drawNote(ctx, S, msg, '#ffe9a0');
  } else if (state.toastT > 0 && state.toast) drawNote(ctx, S, state.toast, '#fff6e6');
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(10,8,34,0.35)'; ctx.fillRect(S.x, S.y, S.w, S.h);
    hudText(ctx, 'Paused', S.x + S.w / 2, S.y + S.h / 2, 64, { font: DISPLAY, weight: 800, col: '#fff6e6' });
  }
  void HOME; void THEMES;
}

function drawNote(ctx, S, text, col) {
  const size = Math.max(15, Math.round(Math.min(S.w, 900) * 0.034)), pad = 12;
  ctx.font = `700 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, text, S.w - 60), h = lines.length * size * 1.25 + pad * 2, w = Math.min(S.w - 24, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + 6);
  const x = S.x + (S.w - w) / 2, y = S.y + S.h - h - 12;
  roundRectPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(16,12,46,0.84)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.5)'; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, S.x + S.w / 2, y + pad + size * 0.65 + i * size * 1.25));
}
