// Utilidades mínimas de WebGL2, sin dependencias.
// Las tres experiencias comparten este archivo.

export type GL = WebGL2RenderingContext;

export function getGL(canvas: HTMLCanvasElement, opts: WebGLContextAttributes = {}): GL | null {
  return canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
    ...opts,
  }) as GL | null;
}

// Cada montaje crea su propio canvas dentro de `host`.
// Antes el canvas vivía en el JSX: al desmontar perdíamos su contexto y React
// (que en desarrollo monta dos veces) volvía a pedir el mismo canvas ya muerto.
// Chrome y Opera devolvían ese contexto perdido y ningún shader compilaba.
export function mountCanvas(host: HTMLElement, className = "absolute inset-0 block h-full w-full") {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  return canvas;
}

// Libera la GPU y quita el canvas del DOM.
export function releaseCanvas(canvas: HTMLCanvasElement, gl: GL | null) {
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  canvas.remove();
}

function compile(gl: GL, type: number, src: string) {
  if (gl.isContextLost()) throw new Error("Shader: el contexto WebGL se perdió");
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader: ${log}`);
  }
  return s;
}

export type Program = {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
};

export function createProgram(gl: GL, vs: string, fs: string): Program {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(prog, 0, "a");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Link: ${gl.getProgramInfoLog(prog)}`);
  const u: Program["u"] = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i)!;
    const name = info.name.replace(/\[0\]$/, "");
    u[name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u };
}

// Un triángulo que cubre toda la pantalla.
export function fullscreenTriangle(gl: GL) {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

export const VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a;
out vec2 vUv;
void main() {
  vUv = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}`;

export type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

// Textura de media precisión para simulaciones; devuelve null si el equipo no la soporta.
export function createTarget(gl: GL, w: number, h: number): Target | null {
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) return null;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? { fbo, tex, w, h } : null;
}

export function doubleTarget(gl: GL, w: number, h: number) {
  const a = createTarget(gl, w, h);
  const b = createTarget(gl, w, h);
  if (!a || !b) return null;
  let read = a;
  let write = b;
  return {
    get read() { return read; },
    get write() { return write; },
    swap() { [read, write] = [write, read]; },
    clear() {
      for (const t of [a, b]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
  };
}

// Ajusta el canvas a su tamaño en pantalla, con densidad de píxeles limitada.
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 1.75) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

// Bucle de animación que se pausa cuando la pestaña no está visible.
export function loop(frame: (t: number, dt: number) => void) {
  let raf = 0;
  let last = performance.now();
  const start = last;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame((now - start) / 1000, dt);
    raf = requestAnimationFrame(tick);
  };
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVis);
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVis);
  };
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── GLSL compartido ─────────────────────────────────────────────
export const GLSL_COMMON = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Trama de grabado: líneas paralelas cuyo grosor crece con la oscuridad.
// px: coordenadas en píxeles; dark: 0 papel, 1 tinta; pitch: separación en px; ang: ángulo de las líneas.
float engrave(vec2 px, float dark, float pitch, float ang, float wob) {
  vec2 n = vec2(-sin(ang), cos(ang));
  float c = dot(px, n) / pitch + wob;
  float f = abs(fract(c) - 0.5);
  float aa = fwidth(c) * 0.75;
  float w = clamp(dark, 0.0, 1.0) * 0.5;
  return 1.0 - smoothstep(w - aa, w + aa, f);
}
// Igual, pero las líneas siguen anillos concéntricos alrededor de un centro.
float engraveRings(vec2 px, vec2 center, float dark, float pitch, float wob) {
  float c = length(px - center) / pitch + wob;
  float f = abs(fract(c) - 0.5);
  float aa = fwidth(c) * 0.75;
  float w = clamp(dark, 0.0, 1.0) * 0.5;
  return 1.0 - smoothstep(w - aa, w + aa, f);
}
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float fill(float d) { float aa = fwidth(d); return 1.0 - smoothstep(-aa, aa, d); }
`;
