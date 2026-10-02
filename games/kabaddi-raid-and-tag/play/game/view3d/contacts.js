// Where a contact happens on a body, worked out from the other player's skeleton each frame (the sim only decides WHEN and between whom;
// these points make the hands and feet land on the surface of the other body, never inside it).
export function makeContacts(THREE) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const flat = (a, b) => { const d = b.clone().sub(a); d.y = 0; const l = d.length() || 1; return d.multiplyScalar(1 / l); };
  const mid = (a, b, k = 0.5) => a.clone().lerp(b, k);
  return {
    // the raider's right hand rests on top of the defender's left shoulder (the one nearest to it); the point is on the surface, not inside
    touchPoint(D, R) {
      const p = D.bonePosition('L_UpperArm', V());
      p.y += globalThis.__touchUp ?? 0.09;
      return p;
    },
    // the toe touches the front of the defender's shin
    toePoint(D, R) {
      const k = D.bonePosition('R_Calf', V()), f = D.bonePosition('R_Foot', V());
      const p = mid(k, f, 0.3); p.addScaledVector(flat(p, R.bonePosition('Pelvis', V())), 0.27);    // this target is the ankle: the toe reaches 0.17 m beyond it
      return p;
    },
    // two hands behind the raider's thighs (the front hold)
    thighPoints(R, back) {
      const out = [];
      for (const s of ['L', 'R']) {
        const a = R.bonePosition(`${s}_Thigh`, V()), b = R.bonePosition(`${s}_Calf`, V());
        const p = mid(a, b, 0.3); p.addScaledVector(back, 0.075); p.x += (s === 'L' ? 1 : -1) * 0.095;
        out.push(p);
      }
      return out;
    },
    anklePoints(R, back) {
      const out = [];
      for (const s of ['L', 'R']) { const a = R.bonePosition(`${s}_Calf`, V()), b = R.bonePosition(`${s}_Foot`, V()); const p = mid(a, b, 0.45); p.addScaledVector(back, 0.065); p.x += (s === 'L' ? 1 : -1) * 0.075; out.push(p); }
      return out;
    },
    // a side defender: one hand on the raider's waist, the other on the lead defender's shoulder
    waistPoint(R, side, toward) { const p = R.bonePosition('Spine', V()); p.addScaledVector(side, 0.17); return p; },
  };
}
