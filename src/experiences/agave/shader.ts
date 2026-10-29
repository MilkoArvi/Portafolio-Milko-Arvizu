import { GLSL_COMMON } from "@/lib/gl";

// Seis escenas dibujadas solo con matemáticas y tramas de grabado.
// Cada viñeta del cómic llama a este shader con su número de escena.

export const AGAVE_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 u_res;     // tamaño de la viñeta en px
uniform vec2 u_origin;  // esquina inferior izquierda de la viñeta en px del canvas
uniform float u_time;
uniform float u_enter;  // 0→1 al aparecer
uniform float u_prog;   // 0 entra por abajo, 1 sale por arriba
uniform float u_dpr;
uniform float u_motion; // 0 si la persona pidió menos movimiento
uniform vec2 u_mouse;   // 0..1 dentro de la viñeta
uniform int u_scene;

const vec3 PAPER = vec3(0.949, 0.929, 0.890);
const vec3 INK   = vec3(0.071, 0.063, 0.063);
const vec3 RED   = vec3(0.862, 0.165, 0.110);
const vec3 AGAVE = vec3(0.235, 0.718, 0.690);

${GLSL_COMMON}

float pitch() { return 3.4 * u_dpr; }
float ease(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
float bounce(float x) {
  x = clamp(x, 0.0, 1.0);
  float n = 7.5625, d = 2.75;
  if (x < 1.0 / d) return n * x * x;
  if (x < 2.0 / d) { x -= 1.5 / d; return n * x * x + 0.75; }
  if (x < 2.5 / d) { x -= 2.25 / d; return n * x * x + 0.9375; }
  x -= 2.625 / d; return n * x * x + 0.984375;
}
// Trazo de contorno de tinta para un SDF.
float stroke(float d, float w) { float aa = fwidth(d); return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
// Pequeña estrella de agave (silueta de la planta vista de lejos).
float agaveStar(vec2 q, float r) {
  float a = atan(q.y, q.x);
  float spikes = pow(abs(cos(a * 3.5)), 5.0);
  float shape = r * (0.35 + 0.65 * spikes);
  return length(q) - shape * step(-0.15 * r, q.y);
}

// ── 0. El sol de Los Altos ────────────────────────────────────
vec3 scene0(vec2 p, vec2 px, float t) {
  float asp = u_res.x / u_res.y;
  float hz = -0.16;
  bool tall = asp < 1.0;
  vec2 sc = vec2(tall ? 0.0 : 0.26 * asp, mix(-0.42, tall ? -0.03 : 0.12, ease(u_enter * 1.1)) + 0.012 * sin(t * 0.4));
  vec3 col = RED;
  // rayos: líneas radiales oscuras sobre el rojo
  vec2 ds = p - sc;
  float ang = atan(ds.y, ds.x);
  float ray = abs(fract(ang * 18.0 / 6.2831 + t * 0.01) - 0.5);
  float rayInk = 1.0 - smoothstep(0.05, 0.09, ray);
  col = mix(col, col * 0.72, rayInk * smoothstep(0.3, 0.9, length(ds)) * 0.8);
  // sol con anillos grabados, más oscuro hacia la orilla
  float sr = tall ? 0.2 : 0.27;
  float sd = sdCircle(ds, sr);
  float sunDark = smoothstep(0.05, sr, length(ds)) * 0.42;
  float rings = engraveRings(px, (sc * u_res.y + 0.5 * u_res), sunDark, pitch(), 0.0);
  vec3 sun = mix(PAPER, INK, rings);
  col = mix(col, sun, fill(sd));
  col = mix(col, INK, stroke(sd, 1.2 * u_dpr / u_res.y));
  // cerros en la línea del horizonte
  float hill = hz + 0.035 + 0.09 * fbm(vec2(p.x * 1.6 + 3.0, 1.0)) - 0.03 * abs(p.x);
  float inHill = step(p.y, hill) * step(hz - 0.02, p.y);
  float hillDark = 0.55 + 0.35 * smoothstep(hill - 0.12, hill, p.y);
  float hillLines = engrave(px, hillDark, pitch(), 1.5708, 0.15 * vnoise(px * 0.02));
  col = mix(col, mix(PAPER, INK, hillLines), inHill);
  // campo en perspectiva con hileras de agaves
  if (p.y < hz) {
    float dz = hz - p.y;
    float zz = 1.0 / (dz + 0.02);
    float cx = p.x * zz * 0.9;
    vec2 cell = vec2(cx * 1.6, zz * 0.55);
    vec2 q = fract(cell) - 0.5;
    float star = agaveStar((q + vec2(0.0, 0.2)) * vec2(1.0, 1.2), 0.46);
    float plants = fill(star) * smoothstep(0.0, 0.05, dz);
    float furrow = engrave(vec2(cx * 1.6 * 40.0 + 20.0, 0.0), 0.05 + 0.1 * smoothstep(0.0, 0.5, dz), 40.0, 1.5708, 0.0);
    vec3 ground = mix(PAPER, INK, furrow * 0.9);
    vec3 plantCol = mix(AGAVE, INK, engrave(px, 0.35 + 0.3 * smoothstep(-0.2, 0.3, q.x), pitch() * 0.8, 1.5708, 0.0));
    float plantEdge = stroke(star, 0.02);
    ground = mix(ground, plantCol, plants);
    ground = mix(ground, INK, plantEdge * smoothstep(0.0, 0.08, dz));
    // sombra de cada planta
    float sh = length((q - vec2(0.12, -0.24)) * vec2(1.0, 3.0)) - 0.28;
    ground = mix(ground, INK, fill(sh) * (1.0 - plants) * engrave(px, 0.55, pitch() * 0.8, 0.5, 0.0) * smoothstep(0.0, 0.1, dz));
    // neblina hacia el horizonte
    ground = mix(ground, PAPER, smoothstep(0.05, 0.0, dz) * 0.85);
    col = mix(col, ground, 1.0 - inHill);
  }
  return col;
}

// ── 1. La planta ──────────────────────────────────────────────
vec3 scene1(vec2 p, vec2 px, float t) {
  vec3 col = RED;
  float bgLines = engrave(px, 0.14 + 0.08 * fbm(px * 0.004), pitch() * 1.2, 1.5708, 0.25 * vnoise(vec2(px.x * 0.05, px.y * 0.003)));
  col = mix(col, col * 0.55, bgLines);
  vec2 base = vec2(0.0, -0.42);
  // tierra
  float soil = sdBox(p - vec2(0.0, -0.52), vec2(2.0, 0.1));
  float soilLines = engrave(px, 0.5 + 0.3 * vnoise(px * 0.02), pitch(), 0.0, 0.0);
  col = mix(col, mix(PAPER, INK, soilLines), fill(soil));
  float grow = ease(u_enter * 1.15);
  for (int i = 0; i < 17; i++) {
    float fi = float(i);
    float k = fi / 16.0;
    float side = mod(fi, 2.0) * 2.0 - 1.0;
    // primero las hojas de atrás (más abiertas), al final las del frente
    float spread = (1.0 - k) * 1.35 + 0.05;
    float a = side * spread * (0.55 + 0.45 * hash11(fi * 3.1)) + 0.02 * sin(t * 0.7 + fi) * u_motion;
    float L = (0.42 + 0.5 * hash11(fi * 7.7)) * (0.55 + 0.45 * k) * grow;
    float W = 0.05 + 0.03 * k;
    vec2 q = rot(a) * (p - base);
    float tt = q.y / max(L, 1e-3);
    float teeth = 0.006 * step(0.55, fract(tt * 16.0)) * step(0.15, tt);
    float hw = W * pow(max(1.0 - tt, 0.0), 0.85) * smoothstep(-0.02, 0.06, tt) + teeth;
    float d = max(abs(q.x) - hw, max(-q.y, q.y - L));
    float spine = max(abs(q.x) - 0.0025, max(L - q.y, q.y - L - 0.05));
    float inLeaf = fill(d);
    float dark = 0.18 + 0.5 * smoothstep(-hw, hw * 1.4, q.x) + 0.25 * (1.0 - tt);
    float lines = engrave(rot(a) * px, dark, pitch() * 0.85, 1.5708, 0.0);
    vec3 leaf = mix(AGAVE, INK, lines);
    // vena central clara
    leaf = mix(leaf, PAPER, (1.0 - smoothstep(0.0, 0.004 + 0.004 * (1.0 - tt), abs(q.x))) * step(0.08, tt) * 0.8);
    col = mix(col, leaf, inLeaf);
    col = mix(col, INK, stroke(d, 0.9 * u_dpr / u_res.y) * step(0.0, tt));
    col = mix(col, INK, fill(spine) * step(0.3, grow));
  }
  return col;
}

// ── 2. La jima: piñas que caen ────────────────────────────────
vec3 scene2(vec2 p, vec2 px, float t) {
  vec3 col = PAPER;
  col = mix(col, INK, engrave(px, 0.07, pitch() * 1.4, 1.5708, 0.0));
  float floorY = -0.34;
  float floorD = floorY - p.y;
  col = mix(col, mix(PAPER, INK, engrave(px, 0.35 + 0.4 * smoothstep(0.0, 0.3, floorD), pitch(), 0.0, 0.1 * vnoise(px * 0.01))), step(0.0, floorD));
  vec3 centers[3] = vec3[3](vec3(-0.42, -0.12, 0.2), vec3(0.04, -0.14, 0.24), vec3(0.44, -0.1, 0.18));
  for (int i = 0; i < 3; i++) {
    vec3 c = centers[i];
    float drop = 1.0 - bounce(u_enter * 1.6 - float(i) * 0.22);
    vec2 cc = c.xy + vec2(0.0, drop * 1.3);
    // sombra en el piso
    vec2 sp = p - vec2(cc.x + 0.05, floorY - 0.02);
    float shadow = length(sp * vec2(1.0, 4.0)) - c.z * (1.0 - drop * 0.6);
    col = mix(col, INK, fill(shadow) * engrave(px, 0.8, pitch() * 0.7, 0.4, 0.0) * 0.9);
    vec2 q = (p - cc) / c.z;
    float d = length(q * vec2(1.0, 0.92)) - 1.0;
    // patrón de pencas cortadas: rombos
    vec2 g = rot(0.785) * q * 3.2;
    vec2 gf = abs(fract(g) - 0.5);
    float diamond = smoothstep(0.40, 0.46, max(gf.x, gf.y));
    float light = clamp(0.5 + 0.55 * dot(normalize(vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))))), normalize(vec3(-0.6, 0.6, 0.6))), 0.0, 1.0);
    float dark = (1.0 - light) * 0.7;
    float hatch = max(engrave(px, dark, pitch() * 0.8, 0.6, 0.0), engrave(px, dark - 0.35, pitch() * 0.8, -0.6, 0.0));
    vec3 pina = mix(mix(PAPER, AGAVE, 0.45), INK, max(hatch * 0.9, diamond));
    col = mix(col, pina, fill(d * c.z));
    col = mix(col, INK, stroke(d * c.z, 1.1 * u_dpr / u_res.y));
  }
  // la coa del jimador
  vec2 a0 = vec2(0.95, 0.55), a1 = vec2(0.38, 0.02);
  vec2 ba = a1 - a0, pa = p - a0;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float handle = length(pa - ba * h) - 0.012;
  col = mix(col, mix(PAPER, INK, engrave(px, 0.75, pitch() * 0.7, atan(ba.y, ba.x), 0.0)), fill(handle));
  float blade = max(sdCircle(p - a1 - vec2(-0.02, -0.05), 0.08), -sdCircle(p - a1 - vec2(0.03, -0.09), 0.08));
  col = mix(col, mix(PAPER, INK, 0.85), fill(blade));
  col = mix(col, INK, stroke(blade, 0.8 * u_dpr / u_res.y));
  return col;
}

// ── 3. El horno de piedra ─────────────────────────────────────
vec3 scene3(vec2 p, vec2 px, float t) {
  // muro de piedra
  vec2 bp = p * vec2(5.0, 9.0);
  bp.x += mod(floor(bp.y), 2.0) * 0.5;
  vec2 bf = fract(bp) - 0.5;
  float mortar = smoothstep(0.42, 0.47, max(abs(bf.x) * 1.0, abs(bf.y)));
  float stoneDark = 0.55 + 0.3 * hash21(floor(bp)) + 0.15 * fbm(px * 0.01);
  vec3 col = mix(PAPER, INK, engrave(px, stoneDark, pitch(), 0.0, 0.2 * vnoise(px * 0.03)));
  col = mix(col, PAPER * 0.92, mortar);
  // boca del horno: arco
  float arch = min(sdBox(p - vec2(0.0, -0.3), vec2(0.36, 0.22)), sdCircle(p - vec2(0.0, -0.08), 0.36));
  arch = max(arch, -(p.y + 0.52));
  float inArch = fill(arch);
  // fuego
  float tt = t * u_motion;
  float n = fbm(vec2(p.x * 3.2, p.y * 2.6 - tt * 1.4)) + 0.25 * fbm(vec2(p.x * 7.0 + 4.0, p.y * 6.0 - tt * 2.6));
  float flame = n - (p.y + 0.42) * 0.9 - 0.12;
  vec3 fire = INK;
  fire = mix(fire, RED, smoothstep(0.25, 0.32, flame));
  fire = mix(fire, mix(RED, PAPER, engrave(px, 0.45, pitch() * 0.9, 0.0, 0.3 * vnoise(vec2(px.x * 0.05, px.y * 0.01 - tt * 3.0)))), smoothstep(0.42, 0.5, flame));
  fire = mix(fire, PAPER, smoothstep(0.62, 0.7, flame));
  // piñas en el fondo del horno
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(-0.28 + fi * 0.14, -0.48 + 0.03 * hash11(fi));
    fire = mix(fire, INK, fill(length((p - c) * vec2(1.0, 1.2)) - 0.075));
  }
  // chispas
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float life = fract(tt * 0.35 + hash11(fi * 4.3));
    vec2 sp = vec2(-0.3 + 0.6 * hash11(fi * 9.1) + 0.05 * sin(life * 6.0 + fi), -0.45 + life * 0.75);
    fire = mix(fire, PAPER, fill(length(p - sp) - 0.006 * (1.0 - life)) * step(0.01, u_motion));
  }
  col = mix(col, fire, inArch);
  col = mix(col, INK, stroke(arch, 2.5 * u_dpr / u_res.y));
  return col;
}

// ── 4. El reposo: barricas ────────────────────────────────────
vec3 scene4(vec2 p, vec2 px, float t) {
  float asp = u_res.x / u_res.y;
  vec3 col = mix(PAPER, INK, engrave(px, 0.62 + 0.25 * smoothstep(0.3, -0.4, p.y), pitch(), 1.5708, 0.2 * vnoise(vec2(px.x * 0.02, px.y * 0.002))));
  // haz de luz roja que entra por una ventana
  float beam = p.x * 0.55 + p.y - 0.15 + 0.1 * (u_prog - 0.5);
  float inBeam = smoothstep(0.0, 0.02, beam) * smoothstep(0.42, 0.38, beam);
  col = mix(col, mix(RED, INK, engrave(px, 0.18, pitch(), 0.0, 0.0)), inBeam * 0.92);
  vec2 vp = vec2(0.45 * asp + 0.25 * (u_prog - 0.5), 0.05);
  for (int k = 7; k >= 0; k--) {
    float fk = float(k);
    float s = 1.0 / (1.0 + fk * 0.42);
    for (int row = 0; row < 2; row++) {
      vec2 base = vec2(-0.75 * asp, -0.22 + float(row) * 0.5);
      vec2 c = vp + (base - vp) * s;
      float r = 0.25 * s;
      vec2 q = p - c;
      float d = length(q) - r;
      float dark = 0.25 + 0.45 * smoothstep(0.0, r, length(q - vec2(-0.3, 0.3) * r)) + 0.25 * (1.0 - s);
      float woodRings = engraveRings(px, c * u_res.y + 0.5 * u_res, dark, pitch() * (0.7 + 0.5 * s), 0.25 * vnoise(q * 30.0 / max(r, 0.01)));
      vec3 head = mix(PAPER, INK, woodRings);
      float hoop = smoothstep(0.86, 0.88, length(q) / r) * (1.0 - smoothstep(0.96, 0.98, length(q) / r));
      head = mix(head, INK, hoop);
      head = mix(head, INK, fill(length(q - vec2(0.0, -0.35 * r)) - 0.06 * r));
      head = mix(head, mix(head, RED, 0.6), inBeam * 0.5);
      col = mix(col, head, fill(d));
      col = mix(col, INK, stroke(d, 1.2 * u_dpr / u_res.y));
    }
  }
  return col;
}

// ── 5. La botella ─────────────────────────────────────────────
float bottleSDF(vec2 q) {
  float body = sdBox(q - vec2(0.0, -0.12), vec2(0.15, 0.27)) - 0.04;
  float shoulder = sdCircle((q - vec2(0.0, 0.14)) * vec2(1.0, 1.6), 0.16);
  float neck = sdBox(q - vec2(0.0, 0.3), vec2(0.045, 0.1));
  float k = 0.06;
  float hh = clamp(0.5 + 0.5 * (neck - min(body, shoulder)) / k, 0.0, 1.0);
  float bs = min(body, shoulder);
  return mix(neck, bs, hh) - k * hh * (1.0 - hh);
}
vec3 scene5(vec2 p, vec2 px, float t) {
  vec3 col = RED;
  float ang = atan(p.y - 0.05, p.x);
  float ray = abs(fract(ang * 24.0 / 6.2831 - t * 0.012 * u_motion) - 0.5);
  col = mix(col, INK, (1.0 - smoothstep(0.06, 0.1, ray)) * smoothstep(0.25, 0.8, length(p - vec2(0.0, 0.05))));
  float rise = 1.0 - ease(u_enter * 1.2);
  vec2 q = p - vec2(0.0, -0.06 - rise * 0.9);
  // sombra en el piso
  col = mix(col, INK, fill(length((q - vec2(0.04, -0.43)) * vec2(1.0, 5.0)) - 0.2) * 0.85);
  float d = bottleSDF(q);
  float hw = 0.19;
  float nx = clamp(q.x / hw, -1.0, 1.0);
  float hl = pow(max(0.0, 1.0 - abs(nx + 0.48) * 2.6), 1.5) + 0.35 * pow(max(0.0, 1.0 - abs(nx - 0.62) * 5.0), 2.0);
  vec3 glass = mix(INK, PAPER, engrave(px, hl * 0.9, pitch() * 0.8, 1.5708, 0.0));
  // etiqueta
  float label = sdBox(q - vec2(0.0, -0.16), vec2(0.155, 0.11));
  float frame = stroke(sdBox(q - vec2(0.0, -0.16), vec2(0.135, 0.09)), 0.0025);
  vec3 lab = mix(PAPER, INK, max(frame, engrave(px, 0.06, pitch(), 0.0, 0.0)));
  float emblem = agaveStar((q - vec2(0.0, -0.17)) * 1.0, 0.06);
  lab = mix(lab, AGAVE, fill(emblem));
  lab = mix(lab, INK, stroke(emblem, 0.0015));
  glass = mix(glass, lab, fill(label));
  // tapón con estrías
  float cap = sdBox(q - vec2(0.0, 0.43), vec2(0.06, 0.05)) - 0.008;
  vec3 capCol = mix(RED * 0.8, PAPER, engrave(px, 0.25, pitch() * 0.9, 1.5708, 0.0));
  col = mix(col, glass, fill(d));
  col = mix(col, capCol, fill(cap));
  col = mix(col, INK, max(stroke(d, 0.0025), stroke(cap, 0.0022)));
  return col;
}

vec3 render(vec2 p, vec2 px, float t) {
  if (u_scene == 0) return scene0(p, px, t);
  if (u_scene == 1) return scene1(p, px, t);
  if (u_scene == 2) return scene2(p, px, t);
  if (u_scene == 3) return scene3(p, px, t);
  if (u_scene == 4) return scene4(p, px, t);
  return scene5(p, px, t);
}

void main() {
  vec2 px = gl_FragCoord.xy - u_origin;
  vec2 uv = px / u_res;
  float t = u_time;
  // columnas para la entrada en goteo y la salida que se derrite
  float colW = 5.0 * u_dpr;
  float colId = floor(px.x / colW);
  float r = hash11(colId * 1.37 + 3.0);
  float melt = u_motion * pow(clamp((u_prog - 0.8) / 0.2, 0.0, 1.0), 2.0);
  vec2 spx = px + vec2(0.0, melt * (0.25 + 0.75 * r) * u_res.y * 0.6);
  vec2 p = (spx - 0.5 * u_res) / u_res.y;
  p += (u_mouse - 0.5) * 0.012 * u_motion;
  vec3 col = render(p, spx, t);
  // gotas de tinta en la salida
  col = mix(col, INK, melt * step(0.8, r) * 0.9);
  // entrada: las columnas bajan desde arriba
  float y = 1.0 - uv.y;
  float front = u_enter * 1.5 - r * 0.4;
  float shown = step(y, front);
  float edge = smoothstep(0.0, 0.045, front - y);
  col = mix(INK, col, edge);
  col = mix(PAPER, col, shown);
  o = vec4(col, 1.0);
}`;
