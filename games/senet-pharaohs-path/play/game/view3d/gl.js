// A small WebGL2 renderer for the Senet chamber: lit meshes (key + fill hemisphere + rim + four flickering lamp lights, soft PCF shadows,
// glaze reflections, ACES tone mapping), unlit/additive quads (flames, glows, motes, blob shadows) and screen-space layers.
// Everything is rebuilt from CPU-side sources after a context loss (see createRenderer().rebuild).
import { m4 } from './math.js';

const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv;
uniform mat4 uProj, uView, uModel, uLightVP; uniform mat3 uNrmM; uniform vec4 uUvXf;
out vec3 vW; out vec3 vN; out vec2 vUv; out vec4 vL;
void main(){ vec4 w = uModel * vec4(aPos,1.0); vW = w.xyz; vN = uNrmM * aNrm; vUv = aUv * uUvXf.xy + uUvXf.zw; vL = uLightVP * w; gl_Position = uProj * uView * w; }`;

const LIT_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec2 vUv; in vec4 vL; out vec4 o;
uniform vec3 uColor, uEmis, uEye, uKeyDir, uKeyCol, uSky, uGround, uRimDir, uRimCol;
uniform vec4 uLamp[4]; uniform vec3 uLampCol[4]; uniform int uLamps;
uniform float uRough, uSpec, uGlaze, uAlpha, uShadowOn, uMapOn, uBump, uExposure, uSat;
uniform sampler2D uMap; uniform sampler2DShadow uShadow;
uniform vec2 uShadowTexel;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float shadow(){
  if (uShadowOn < 0.5) return 1.0;
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0; float b = 0.0012;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uShadow, vec3(p.xy + vec2(float(x), float(y)) * uShadowTexel * 1.5, p.z - b));
  return s / 9.0;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec4 tx = uMapOn > 0.5 ? texture(uMap, vUv) : vec4(1.0);
  vec3 alb = uColor * lin(tx.rgb);
  vec3 N = normalize(vN);
  if (uBump > 0.0 && uMapOn > 0.5) {   // cheap relief from the albedo luminance: tilt the normal by its screen-space gradient
    float l = dot(tx.rgb, vec3(0.3,0.59,0.11));
    N = normalize(N - uBump * (dFdx(l) * normalize(dFdx(vW)) + dFdy(l) * normalize(dFdy(vW))) * 0.6);
  }
  vec3 V = normalize(uEye - vW);
  float sh = shadow();
  vec3 L = normalize(-uKeyDir);
  float nl = max(dot(N, L), 0.0);
  float shin = mix(180.0, 6.0, uRough);
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), shin) * (shin + 8.0) / 25.0 * uSpec;
  vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 col = alb * (amb + uKeyCol * nl * sh) + uKeyCol * sp * sh;
  for (int i = 0; i < 4; i++) {
    if (i >= uLamps) break;
    vec3 d = uLamp[i].xyz - vW; float dist = length(d); vec3 Ld = d / dist;
    float att = uLamp[i].w / (1.0 + dist * dist * 0.9);
    float dl = max(dot(N, Ld), 0.0);
    vec3 Hl = normalize(Ld + V);
    col += uLampCol[i] * att * (alb * dl + pow(max(dot(N, Hl), 0.0), shin) * (shin + 8.0) / 40.0 * uSpec);
  }
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uRimCol * fr * max(dot(N, normalize(-uRimDir)) * 0.6 + 0.4, 0.0) * (0.35 + uSpec * 0.4);
  if (uGlaze > 0.0) {   // glazed faience: a warm room reflection, stronger at grazing angles
    vec3 R = reflect(-V, N);
    vec3 env = mix(vec3(0.05, 0.03, 0.02), vec3(1.0, 0.78, 0.5), smoothstep(-0.1, 0.8, R.y)) + vec3(1.2, 0.9, 0.6) * pow(max(dot(R, L), 0.0), 60.0);
    col += env * uGlaze * (0.06 + 0.5 * fr);
  }
  col += uEmis;
  col *= uExposure;
  col = aces(col);
  float g = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(vec3(g), col, uSat);
  o = vec4(pow(col, vec3(1.0/2.2)), uAlpha * tx.a);
}`;

const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uLightVP, uModel; void main(){ gl_Position = uLightVP * uModel * vec4(aPos,1.0); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main(){ o = vec4(1.0); }`;

// Unlit textured quad: world-space (billboard optional) or screen-space (uScreen = 1: aPos.xy in virtual units, uProj = ortho).
const FX_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=2) in vec2 aUv;
uniform mat4 uProj, uView, uModel; uniform float uBill; uniform vec4 uUvXf;
out vec2 vUv;
void main(){
  vUv = aUv * uUvXf.xy + uUvXf.zw;
  if (uBill > 0.5) { vec4 c = uView * uModel * vec4(0.0,0.0,0.0,1.0); float sx = length(uModel[0].xyz), sy = length(uModel[1].xyz); gl_Position = uProj * (c + vec4(aPos.x * sx, aPos.y * sy, 0.0, 0.0)); }
  else gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
}`;
const FX_FS = `#version 300 es
precision mediump float; in vec2 vUv; out vec4 o; uniform sampler2D uMap; uniform vec4 uTint; uniform float uMapOn, uMul;
void main(){ vec4 t = uMapOn > 0.5 ? texture(uMap, vUv) : vec4(1.0); o = t * uTint; if (uMul > 0.5) o = vec4(mix(vec3(1.0), t.rgb * uTint.rgb, uTint.a), 1.0); }`;

function compile(gl, vs, fs) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function createRenderer(canvas, { onLost, onRestored } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return null;
  const R = { gl, canvas, meshes: new Set(), textures: new Set(), lost: false, shadowSize: 2048 };
  let lit, depth, fx, aniso, shadowTex = null, shadowFbo = null;

  function init() {
    lit = compile(gl, LIT_VS, LIT_FS); depth = compile(gl, DEPTH_VS, DEPTH_FS); fx = compile(gl, FX_VS, FX_FS);
    aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    for (const m of R.meshes) upload(m);
    for (const t of R.textures) uploadTex(t);
    makeShadow(R.shadowSize);
  }
  function makeShadow(size) {
    if (shadowTex) gl.deleteTexture(shadowTex); if (shadowFbo) gl.deleteFramebuffer(shadowFbo);
    R.shadowSize = size;
    shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function upload(m) {
    const g = m.geo;
    m.vao = gl.createVertexArray(); gl.bindVertexArray(m.vao);
    const buf = (data, loc, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    buf(g.pos, 0, 3); buf(g.nrm, 1, 3); buf(g.uv, 2, 2);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    m.type = g.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT; m.count = g.idx.length;
    gl.bindVertexArray(null);
  }
  function uploadTex(t) {
    t.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.src);
    const wrap = t.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  R.mesh = (geo) => { const m = { geo }; R.meshes.add(m); if (!R.lost) upload(m); return m; };
  R.texture = (src, { repeat = false } = {}) => { const t = { src, repeat }; R.textures.add(t); if (!R.lost) uploadTex(t); return t; };
  R.updateTexture = (t) => { if (R.lost || !t.tex) return; gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.src); gl.generateMipmap(gl.TEXTURE_2D); };
  R.setShadowSize = (s) => { if (s !== R.shadowSize && !R.lost) makeShadow(s); else R.shadowSize = s; };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.lost = true; onLost && onLost(); });
  canvas.addEventListener('webglcontextrestored', () => { R.lost = false; init(); onRestored && onRestored(); });
  init();

  const nrmCache = new WeakMap();
  // Shadow pass. items: [{ mesh, model, cast }]
  R.shadowPass = (items, lightVP) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo); gl.viewport(0, 0, R.shadowSize, R.shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.colorMask(false, false, false, false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    gl.useProgram(depth.p); gl.uniformMatrix4fv(depth.u.uLightVP, false, lightVP);
    for (const it of items) { if (!it.cast || it.hidden) continue; gl.uniformMatrix4fv(depth.u.uModel, false, it.model); gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0); }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  R.begin = (w, h, clear = [0, 0, 0, 0]) => {
    gl.viewport(0, 0, w, h); gl.clearColor(...clear); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
  R.clearDepth = () => gl.clear(gl.DEPTH_BUFFER_BIT);
  // Lit pass. cam = { proj, view, eye }, env = lights. items: [{ mesh, model, mat }]
  R.litPass = (items, cam, env, { transparent = false } = {}) => {
    gl.useProgram(lit.p); const u = lit.u;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    if (transparent) { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
    gl.uniformMatrix4fv(u.uProj, false, cam.proj); gl.uniformMatrix4fv(u.uView, false, cam.view); gl.uniform3fv(u.uEye, cam.eye);
    gl.uniformMatrix4fv(u.uLightVP, false, env.lightVP);
    gl.uniform3fv(u.uKeyDir, env.keyDir); gl.uniform3fv(u.uKeyCol, env.keyCol); gl.uniform3fv(u.uSky, env.sky); gl.uniform3fv(u.uGround, env.ground);
    gl.uniform3fv(u.uRimDir, env.rimDir); gl.uniform3fv(u.uRimCol, env.rimCol);
    gl.uniform1i(u.uLamps, env.lamps.length);
    if (env.lamps.length) { gl.uniform4fv(u.uLamp, env.lampPos); gl.uniform3fv(u.uLampCol, env.lampCol); }
    gl.uniform1f(u.uExposure, env.exposure ?? 1); gl.uniform1f(u.uSat, env.sat ?? 1);
    gl.uniform1f(u.uShadowOn, env.shadowOn ? 1 : 0); gl.uniform2f(u.uShadowTexel, 1 / R.shadowSize, 1 / R.shadowSize);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(u.uShadow, 1); gl.uniform1i(u.uMap, 0);
    for (const it of items) {
      if (it.hidden) continue;
      const mt = it.mat;
      let nm = nrmCache.get(it.model); if (!nm || it.dyn) { nm = m4.normal3(it.model); nrmCache.set(it.model, nm); }
      gl.uniformMatrix4fv(u.uModel, false, it.model); gl.uniformMatrix3fv(u.uNrmM, false, nm);
      gl.uniform3fv(u.uColor, mt.color); gl.uniform3fv(u.uEmis, mt.emis || [0, 0, 0]);
      gl.uniform1f(u.uRough, mt.rough ?? 0.6); gl.uniform1f(u.uSpec, mt.spec ?? 0.2); gl.uniform1f(u.uGlaze, mt.glaze ?? 0);
      gl.uniform1f(u.uAlpha, it.alpha ?? mt.alpha ?? 1); gl.uniform1f(u.uBump, mt.bump ?? 0);
      gl.uniform4fv(u.uUvXf, mt.uvXf || [1, 1, 0, 0]);
      gl.activeTexture(gl.TEXTURE0);
      if (mt.map && mt.map.tex) { gl.bindTexture(gl.TEXTURE_2D, mt.map.tex); gl.uniform1f(u.uMapOn, 1); } else { gl.bindTexture(gl.TEXTURE_2D, null); gl.uniform1f(u.uMapOn, 0); }
      gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
  };
  // Effects pass: unlit quads. blend: 'add' | 'alpha' | 'mul'
  R.fxPass = (items, cam, { depthTest = true } = {}) => {
    gl.useProgram(fx.p); const u = fx.u;
    gl.uniformMatrix4fv(u.uProj, false, cam.proj); gl.uniformMatrix4fv(u.uView, false, cam.view); gl.uniform1i(u.uMap, 0);
    if (depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false); gl.enable(gl.BLEND);
    for (const it of items) {
      if (it.hidden) continue;
      if (it.blend === 'add') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
      else if (it.blend === 'mul') gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.ONE);
      else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(u.uModel, false, it.model); gl.uniform1f(u.uBill, it.bill ? 1 : 0); gl.uniform1f(u.uMul, it.blend === 'mul' ? 1 : 0); gl.uniform4fv(u.uTint, it.tint);
      gl.uniform4fv(u.uUvXf, it.uvXf || [1, 1, 0, 0]);
      gl.activeTexture(gl.TEXTURE0);
      if (it.map && it.map.tex) { gl.bindTexture(gl.TEXTURE_2D, it.map.tex); gl.uniform1f(u.uMapOn, 1); } else gl.uniform1f(u.uMapOn, 0);
      gl.bindVertexArray(it.mesh.vao); gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
    }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  };
  return R;
}
