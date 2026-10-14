// The dhol player beside the pit: a real view3d man in kurta, dhoti and turban, a barrel drum on a strap, both hands striking the heads on the beat.
// Presentation only (reads the beat pulse the presenter is given).
import { THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Mesh, MeshStandardMaterial, Group } = THREE;

function drumMesh() {
  const g = new Group();
  const wood = new MeshStandardMaterial({ color: 0x7a3d1a, roughness: 0.55, metalness: 0, envMapIntensity: 1 });
  const head = new MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.8, metalness: 0 });
  const rope = new MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.8, metalness: 0 });
  const brass = new MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 });
  // barrel along x: slightly bulged
  const pts = []; const L = 0.56, R0 = 0.155, R1 = 0.175;
  for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(R0 + (R1 - R0) * Math.sin(u * Math.PI), (u - 0.5) * L)); }
  const body = new Mesh(new THREE.LatheGeometry(pts, 28), wood); body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
  for (const s of [-1, 1]) {
    const h = new Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 28), head); h.rotation.z = Math.PI / 2; h.position.x = s * (L / 2 + 0.005); h.castShadow = true; g.add(h);
    const ring = new Mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 28), brass); ring.rotation.y = Math.PI / 2; ring.position.x = s * (L / 2 + 0.02); g.add(ring);
  }
  // rope lacing: zig-zag cords on the shell
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, c = new Mesh(new THREE.CylinderGeometry(0.004, 0.004, L * 0.95, 4), rope);
    c.rotation.z = Math.PI / 2; c.position.set(0, Math.cos(a) * 0.178, Math.sin(a) * 0.178); g.add(c);
  }
  return g;
}

export async function createDrummer({ stage, loadHuman, base, parent }) {
  const h = await loadHuman({ character: 'athlete_m', base, kit: { top: '#e7b94a', bottoms: '#f1ece0', socks: '#c4875a' }, skin: '#b87a4c', hair: 'black' });
  h.groundClamp = 'feet'; h.footPlanting = false;
  h.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  h.play('idle', { loop: true });
  stage.add(h);
  const root = new Group(); parent.add(root); root.add(h.root);
  const drum = drumMesh(); parent.add(drum);
  // turban: a wound cloth cap on the head bone
  h._applyRest(); h.root.updateMatrixWorld(true);
  const hb = h.bones.Bip01_Head, hp = hb.getWorldPosition(new Vector3()), inv = hb.getWorldQuaternion(new Quaternion()).invert();
  const cream = new MeshStandardMaterial({ color: 0xf1e7cf, roughness: 0.85, metalness: 0 }), saf = new MeshStandardMaterial({ color: 0xe0831c, roughness: 0.8, metalness: 0 });
  const tg = new Group();
  const t1 = new Mesh(new THREE.SphereGeometry(0.107, 22, 16), cream); t1.scale.set(1, 0.78, 1.1); tg.add(t1);
  for (let i = 0; i < 3; i++) { const t = new Mesh(new THREE.TorusGeometry(0.098 - i * 0.012, 0.022, 8, 28), i === 1 ? saf : cream); t.rotation.x = Math.PI / 2; t.rotation.y = (i - 1) * 0.18; t.position.y = -0.045 + i * 0.045; t.scale.set(1, 1.1, 1); tg.add(t); }
  const tail = new Mesh(new THREE.PlaneGeometry(0.06, 0.2), new MeshStandardMaterial({ color: 0xe0831c, roughness: 0.8, side: THREE.DoubleSide })); tail.position.set(0.09, -0.08, -0.06); tail.rotation.set(0.1, 0.5, 0.15); tg.add(tail);
  tg.quaternion.copy(inv); tg.position.copy(new Vector3(0, 0.14, 0.012).applyQuaternion(inv)); hb.add(tg);
  // dhoti: a long cloth skirt from the waist to the shins, on the pelvis bone
  {
    const pb = h.bones.Bip01_Pelvis, pw = pb.getWorldPosition(new Vector3()), pi = pb.getWorldQuaternion(new Quaternion()).invert();
    const sk = new Mesh(new THREE.CylinderGeometry(0.165, 0.205, 0.78, 28, 6, true), new MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }));
    sk.castShadow = true; sk.quaternion.copy(pi); sk.position.copy(new Vector3(0, -0.34, 0.01).applyQuaternion(pi)); pb.add(sk);
  }
  void hp;
  h.setFingers('both', 'relaxed');
  const st = { phase: 0, lastPulse: 0, hit: [0, 0], strikeL: 0, strikeR: 0 };
  const f = new Vector3(), r = new Vector3(), c = new Vector3(), a = new Vector3(), b = new Vector3(), pole = new Vector3();
  return {
    h, root, drum,
    place(x, z, yaw) { h.setPosition(x, 0, z); h.setFacing(yaw, { snap: true }); st.x = x; st.z = z; st.yaw = yaw; },
    setVisible(v) { root.visible = v; drum.visible = v; },
    update(dt, t, pulse, excite) {
      if (pulse > st.lastPulse + 0.2) { st.phase = 0; }
      st.lastPulse = pulse;
      st.phase += dt * (3.2 + excite * 2.2);
      const yaw = st.yaw || 0;
      f.set(Math.sin(yaw), 0, Math.cos(yaw)); r.set(Math.cos(yaw), 0, -Math.sin(yaw));
      c.set(st.x || 0, 0.93 + 0.01 * Math.sin(t * 2), st.z || 0).addScaledVector(f, 0.3);
      drum.position.copy(c); drum.rotation.set(0, Math.atan2(r.x, r.z) - Math.PI / 2 + Math.PI, 0);
      drum.rotation.y = yaw; drum.rotation.z = 0.12;
      // two strikes per cycle: the right hand (thin stick) on the treble head, the left (curved stick) on the bass head
      const sr = Math.max(0, Math.sin(st.phase * Math.PI * 2)), sl = Math.max(0, Math.sin(st.phase * Math.PI * 2 * 0.5 + 1.3));
      a.copy(c).addScaledVector(r, 0.34).addScaledVector(f, 0.12); a.y += 0.14 * Math.pow(sr, 1.5) + 0.02;
      b.copy(c).addScaledVector(r, -0.34).addScaledVector(f, 0.12); b.y += 0.16 * Math.pow(sl, 1.5) + 0.02;
      pole.copy(c).addScaledVector(r, 0.5).addScaledVector(f, 0.25); pole.y -= 0.1;
      parent.updateMatrixWorld(true);
      const W = (v) => parent.localToWorld(v.clone());
      h.setReach('L', W(a), { weight: 1, pole: W(pole) });
      pole.copy(c).addScaledVector(r, -0.5).addScaledVector(f, 0.25); pole.y -= 0.1;
      h.setReach('R', W(b), { weight: 1, pole: W(pole) });
      h.update(dt);
    },
  };
}
