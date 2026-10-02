// Blob shadows: a soft dark disc under each person, ALL in one instanced draw call. Cheap replacement for shadow maps on low-end devices (stage.setQuality('low')
// switches them on) and a cheap grounding cue for crowds.
import * as THREE from './three.js';

let _tex = null;
function blobTexture() {
  if (_tex) return _tex;
  const c = globalThis.document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _tex = new THREE.CanvasTexture(c); _tex.colorSpace = THREE.SRGBColorSpace;
  return _tex;
}

/** max instances; returns { mesh, set(i, x, z, radius, y?), sync(humans), hideFrom(n) }. Radius is in metres (a person is ~0.45). */
export function createBlobShadows(max = 32, { radius = 0.5, opacity = 1, y = 0.012 } = {}) {
  const geo = new THREE.CircleGeometry(1, 20); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.frustumCulled = false; mesh.renderOrder = -1; mesh.count = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const api = {
    mesh,
    set(i, x, z, r = radius, yy = y) { p.set(x, yy, z); sc.set(r, 1, r); m.compose(p, q, sc); mesh.setMatrixAt(i, m); mesh.instanceMatrix.needsUpdate = true; },
    sync(humans) {
      let n = 0;
      for (const h of humans) { if (n >= max) break; if (!h.root.visible) continue; const wp = h.root.position; api.set(n++, wp.x, wp.z, radius * ((h.info.height || 1.75) / 1.75), (h.groundY || 0) + y); }
      mesh.count = n;
    },
    hideFrom(n) { mesh.count = Math.min(mesh.count, n); },
  };
  return api;
}
