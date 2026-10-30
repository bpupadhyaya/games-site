// Store icon, rendered from the game's own 3D world (open icon.html?s=1024 in a 1024x1024 window; the page sets document.title = 'READY').
// One subject: a big glossy conker on its string, the pale patch toward us, a hairline crack, against the soft golden park.
import * as THREE from '../vendor3d/three.js';
import { makeConker, makeString, setString, buildPark, buildLights } from './world.js';

const T = THREE;
const S = Number(new URLSearchParams(location.search).get('s') || 1024);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene(); scene.background = new T.Color(0x3a2612); scene.fog = new T.Fog(0xd6ad6c, 7, 30);
const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7;
const L = buildLights(scene);
const park = buildPark(scene, { quality: 'high' });
park.leaves.forEach((m) => { m.visible = false; }); park.bokeh.forEach((m) => { m.visible = false; });
park.backdrop.visible = park.frame.visible = park.lawn.visible = false; park.husks.forEach((h) => { h.visible = false; }); park.loose.forEach((c) => { c.mesh.visible = false; });
// the icon's own backdrop: a low golden sun through autumn trees, fully out of focus (bokeh discs), darker toward the corners
{
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#3a2a14'); g.addColorStop(0.5, '#8a5a22'); g.addColorStop(1, '#2a1a0a'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const sun = x.createRadialGradient(150, 150, 5, 150, 150, 330); sun.addColorStop(0, 'rgba(255,226,150,1)'); sun.addColorStop(0.35, 'rgba(236,160,70,0.75)'); sun.addColorStop(1, 'rgba(120,50,15,0)'); x.fillStyle = sun; x.fillRect(0, 0, 512, 512);
  const cols = ['rgba(255,214,140,', 'rgba(240,150,60,', 'rgba(200,90,30,', 'rgba(160,140,60,'];
  let k = 7; const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) { const bx = rnd() * 512, by = rnd() * 512, br = 16 + rnd() * 40; x.fillStyle = cols[i % 4] + (0.18 + rnd() * 0.3) + ')'; x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = 'rgba(40,22,10,0.55)'; x.fillRect(420, 0, 40, 512); x.fillRect(30, 0, 22, 512);
  const v = x.createRadialGradient(256, 256, 150, 256, 256, 380); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,5,2,0.7)'); x.fillStyle = v; x.fillRect(0, 0, 512, 512);
  const o = document.createElement('canvas'); o.width = o.height = 512; const ox = o.getContext('2d'); ox.filter = 'blur(5px)'; ox.drawImage(c, 0, 0);
  const t = new T.CanvasTexture(o); t.colorSpace = T.SRGBColorSpace;
  const bg = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: t, fog: false, toneMapped: false })); bg.position.set(0, 0.95, -6); bg.scale.set(4.4, 4.4, 1); scene.add(bg);
  park.vignette.visible = false;
}
const c = makeConker(3, 1024); c.setDamage(0.2);
const Y = 1.0, r = 0.07;
c.mesh.scale.setScalar(r); c.mesh.position.set(0, Y, 0);
// pale patch toward the lens and a little down-left, the way the 2D art shows it
const n = new T.Vector3(-0.45, -0.35, 0.82).normalize(), up = new T.Vector3(0.12, 1, 0).normalize();
const y = up.clone().addScaledVector(n, -up.dot(n)).normalize(), z = new T.Vector3().crossVectors(n, y);
c.mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(n, y, z));
scene.add(c.mesh, c.hole, c.knot);
c.hole.scale.setScalar(r); c.hole.position.copy(c.mesh.position).addScaledVector(up, r * 0.93); c.hole.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), up);
c.knot.scale.setScalar(r * 0.55); c.knot.position.copy(c.mesh.position).addScaledVector(up, -r * 1.02); c.knot.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), up);
const s = makeString(0.0032); scene.add(s); setString(s, c.mesh.position.clone().addScaledVector(up, r * 0.9), c.mesh.position.clone().addScaledVector(up, 1.2));
const cam = new T.PerspectiveCamera(22, 1, 0.05, 200);
cam.position.set(0.0, Y - 0.05, 0.56); cam.lookAt(0.0, Y + 0.012, 0);
L.key.position.set(-1.6, Y + 1.8, 2.2); L.key.target.position.set(0, Y, 0); L.key.intensity = 2.4;
L.rim.position.set(1.8, Y + 1.0, -2.2); L.rim.target.position.set(0, Y, 0); L.rim.intensity = 4.5;
park.update(3, cam); park.vignette.visible = false;
renderer.render(scene, cam);
requestAnimationFrame(() => { renderer.render(scene, cam); document.title = 'READY'; });
