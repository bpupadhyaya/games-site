// One-draw-call soft particles (dust puffs, splash drops, sparks, confetti) in the presenter's camera-relative metric frame.
// CPU simulated with the render dt; purely cosmetic, never read by the simulation.
export class Particles {
  constructor(THREE, scene, max = 320) {
    this.T = THREE; this.max = max; this.n = 0;
    this.p = []; // { x,y,z,vx,vy,vz,life,max,size,grow,r,g,b,a,drag,grav }
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uniforms = { uScale: { value: 300 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vC; uniform float uScale; void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0, aSize*uScale/max(0.5,-mv.z)); }',
      fragmentShader: 'varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; float a=smoothstep(1.0,0.35,r)*vC.a; if(a<0.01) discard; gl_FragColor=vec4(vC.rgb,a); }',
    });
    this.mesh = new THREE.Points(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
    scene.add(this.mesh);
  }
  setScale(s) { this.uniforms.uScale.value = s; }
  /** Emit n particles around (x,y,z) with the given options. */
  emit(x, y, z, n, o = {}) {
    const rnd = o.rnd || Math.random;
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const a = rnd() * 6.2832, sp = (o.speed ?? 0.5) * (0.4 + rnd() * 0.8);
      this.p.push({
        x: x + (rnd() - 0.5) * (o.spread ?? 0.1), y: y + (rnd()) * (o.rise ?? 0.02), z: z + (rnd() - 0.5) * (o.spread ?? 0.1),
        vx: Math.cos(a) * sp + (o.vx ?? 0), vy: (o.up ?? 0.5) * (0.5 + rnd()) + (o.vy ?? 0), vz: Math.sin(a) * sp + (o.vz ?? 0),
        life: 0, max: (o.life ?? 0.7) * (0.7 + rnd() * 0.6), size: (o.size ?? 0.18) * (0.7 + rnd() * 0.6), grow: o.grow ?? 1.8,
        r: o.r ?? 0.8, g: o.g ?? 0.7, b: o.b ?? 0.55, a: o.a ?? 0.5, drag: o.drag ?? 2.0, grav: o.grav ?? 0,
      });
    }
  }
  update(dt) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.life += dt;
      if (q.life >= q.max) { P.splice(i, 1); continue; }
      const k = Math.exp(-q.drag * dt);
      q.vx *= k; q.vz *= k; q.vy = q.vy * k - q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    let n = 0;
    for (const q of P) {
      const u = q.life / q.max, fade = (u < 0.15 ? u / 0.15 : 1) * (1 - u) * (1 - u * 0.3);
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      this.col[n * 4] = q.r; this.col[n * 4 + 1] = q.g; this.col[n * 4 + 2] = q.b; this.col[n * 4 + 3] = q.a * fade;
      this.size[n] = q.size * (1 + q.grow * u);
      n++;
    }
    this.n = n;
    const g = this.mesh.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
  clear() { this.p.length = 0; this.n = 0; this.mesh.geometry.setDrawRange(0, 0); }
}
