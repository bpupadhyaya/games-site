// The camera director: frames the action from the sim's positions (never the other way round) and cuts between a wide view of the raid,
// a medium follow view, a side view of the two bodies at a contact and a close three-quarter view of a hold. Deterministic: it only
// advances with the dt it is given.
export function createDirector(THREE, camera) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const pos = V(0, 5, -9), look = V(0, 1, 2);
  const want = V(), wantLook = V();
  const keep = {};
  let shot = 'wide', t = 0, snap = true, fov = 40, wantFov = 40, seed = 1;
  const bbox = (pts) => { const b = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; for (const p of pts) { b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.z0 = Math.min(b.z0, p.z); b.z1 = Math.max(b.z1, p.z); } return b; };

  // `ctx`: { dir: +1/-1 raid direction along z, raider:{x,z}, lead:{x,z}|null, near:[{x,z}], all:[{x,z}], aspect, regionAspect, side: +1/-1 }
  function setShot(name, cut = false) {
    if (name === 'follow') name = 'wide';                                // only three stable shots: wide, pair, hold
    if (name !== shot) { const leaving = shot === 'pair' || shot === 'hold'; shot = name; t = 0; if (cut || leaving) snap = true; keep.ang = null; keep.fix = null; keep.wide = null; }
  }
  let fixed = null;
  function update(dt, ctx) {
    t += dt;
    if (fixed) { pos.set(...fixed.pos); look.set(...fixed.look); fov = wantFov = fixed.fov; camera.position.copy(pos); camera.lookAt(look); return; }
    const f = ctx.dir, side = ctx.side || 1;
    const R = ctx.raider;
    const tanH = Math.tan((wantFov * Math.PI) / 360) * ctx.regionAspect;     // half horizontal extent per unit distance
    const fitDist = (pts, margin = 1.1, minD = 4.5, maxD = 13, lift = 0) => {
      const b = bbox(pts), w = Math.max(1.8, b.x1 - b.x0 + margin * 2), dz = Math.max(1, b.z1 - b.z0);
      return Math.min(maxD, Math.max(minD, (w / 2) / tanH + dz / 2));
    };
    let k = 0.35;
    if (shot === 'wide') {
      const pts = [R, ...ctx.all];
      const b = bbox(pts);
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      wantFov = 36;
      const d = fitDist(pts, 1.4, 7.5, 12);
      const cw = V(cx * 0.6 - side * 0.8, 3.8 + d * 0.3, cz - f * (d * 0.95)), cl = V(cx, 0.9, cz + f * 0.2);
      // a steady shot: it only re-frames (one slow glide) when the action leaves the safe zone around the current framing
      if (!keep.wide || Math.abs(cl.x - keep.wide.look.x) > 1.6 || Math.abs(cl.z - keep.wide.look.z) > 2.4 || Math.abs(cw.y - keep.wide.pos.y) > 1.2) keep.wide = { pos: cw, look: cl };
      want.copy(keep.wide.pos); wantLook.copy(keep.wide.look);
      k = 0.9;
    } else if (shot === 'follow') {
      const pts = [R, ...(ctx.near.length ? ctx.near : ctx.all)];
      const b = bbox(pts), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      wantFov = 38;
      const d = fitDist(pts, 1.7, 6.6, 12);
      want.set(cx - side * d * 0.22, 2.8 + d * 0.22, cz - f * d * 0.9);
      wantLook.set(cx, 1.0, cz + f * 0.15);
      k = 0.32;
    } else if (shot === 'pair' || shot === 'hold') {
      // over the raider's shoulder: behind him, at the angle where nobody stands between the camera and the contact and the camera stays in the
      // hall, so both bodies read (his reaching hand, the defender's answer)
      const L = ctx.lead || { x: R.x, z: R.z + f * 1.3 };
      const mx = (R.x * 0.55 + L.x * 0.45), mz = (R.z * 0.55 + L.z * 0.45);
      let dx = L.x - R.x, dz = L.z - R.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      if (shot === 'hold') { dx = 0; dz = f; }                           // the hold camera ignores the defenders' last steps and keeps a steady angle
      const hold = shot === 'hold', sway = Math.min(1, t / 1.6);
      const d = hold ? 4.3 : 4.4;
      const bx = -dx, bz = -dz;
      if (!keep.ang || keep.shot !== shot || keep.key !== ctx.key) {
        let best = null;
        for (const ang of hold ? [1.05, -1.05, 1.45, -1.45, 1.9, -1.9, 0.8, -0.8] : [0.5, -0.5, 0.95, -0.95, 0.2, -0.2, 1.35, -1.35]) {
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const cx = mx + (bx * ca - bz * sa) * d, cz = mz + (bx * sa + bz * ca) * d;
          let cost = hold ? Math.abs(Math.abs(ang) - 1.2) * 0.4 : Math.abs(ang) * 0.4;
          if (Math.abs(cx) > 5.9) cost += 4 + (Math.abs(cx) - 5.9) * 3;
          if (Math.abs(cz) > 8.4) cost += 4 + (Math.abs(cz) - 8.4) * 3;
          for (const o of ctx.all) {                                       // anybody close to the camera-to-contact line, nearer to the camera than the contact
            const px = o.x - cx, pz = o.z - cz, vx = mx - cx, vz = mz - cz, vl = Math.hypot(vx, vz) || 1;
            const along = (px * vx + pz * vz) / vl, perp = Math.abs(px * vz - pz * vx) / vl;
            if (along > 0.4 && along < vl - 0.5 && perp < 0.8 && Math.hypot(o.x - L.x, o.z - L.z) > 0.2) cost += 3;
          }
          if (!best || cost < best.cost) best = { ang, cost };
        }
        keep.ang = best.ang; keep.shot = shot; keep.key = ctx.key; keep.fix = null;
      }
      const ca = Math.cos(keep.ang), sa = Math.sin(keep.ang);
      wantFov = 36;
      // fixed for the whole shot: framed once at the cut, no easing or drift while the contact plays out
      if (!keep.fix) keep.fix = { pos: V(mx + (bx * ca - bz * sa) * d, hold ? 1.5 : 1.65, mz + (bx * sa + bz * ca) * d), look: V(mx, 0.95, mz) };
      want.copy(keep.fix.pos); wantLook.copy(keep.fix.look);
      k = 0.05;
    } else {
      wantFov = 40; want.set(0, 5, -9 * f); wantLook.set(0, 1, 0);
    }
    want.x = Math.max(-5.9, Math.min(5.9, want.x)); want.z = Math.max(-8.4, Math.min(8.4, want.z));
    if (snap) { pos.copy(want); look.copy(wantLook); fov = wantFov; snap = false; }
    else {
      const a = 1 - Math.exp(-dt / Math.max(0.02, k));
      pos.lerp(want, a); look.lerp(wantLook, a); fov += (wantFov - fov) * (1 - Math.exp(-dt / 0.3));
    }
    // the camera never ends up inside a player: anybody closer than 1.4 m (at body height) pushes it away
    for (const [o, rad] of [[R, 2.6], ...(ctx.all || []).map((q) => [q, 1.3]), ...(ctx.lead ? [[ctx.lead, 2.0]] : [])]) {
      const dx = pos.x - o.x, dz = pos.z - o.z, dd = Math.hypot(dx, dz);
      if (dd < rad && pos.y < 2.4) { const k2 = rad / Math.max(dd, 0.05); pos.x = o.x + dx * k2; pos.z = o.z + dz * k2; }
    }
    camera.position.copy(pos);
    camera.lookAt(look);
  }
  return {
    update, setShot, fix(v) { fixed = v; }, snap: () => { snap = true; }, shot: () => shot, fov: () => fov,
    shake() {},                                                            // the camera never shakes (fixed surface rule)
    state: () => ({ pos: pos.clone(), look: look.clone(), fov }),
  };
}
