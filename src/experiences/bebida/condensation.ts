import { makeNoise, rng } from "@/lib/procedural";

// Sudor de lata fría. Un velo fino se dibuja una vez en CPU (con la huella de la mano que la tomó)
// y las gotas viven en el shader del cuerpo: gotas quietas de cuatro tamaños, de borde irregular,
// y gotas gordas que bajan a tirones, se tragan las que encuentran y dejan un rastro limpio.
// Entre gota y gota el barniz sigue brillando, como en una lata de verdad recién sacada del refri.
// Coordenadas físicas del cuerpo: x alrededor (π unidades de circunferencia), y hacia arriba (2 de alto).

const CIRC = Math.PI;
const TALL = 2;

// Distancia de p al segmento ab.
function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// R: aluminio sin tinta, G: velo de agua, B: grano fino del velo.
export function surfaceCanvas(W: number, H: number, bare: Uint8ClampedArray) {
  const n = makeNoise(31);
  const r = rng(5);
  // la mano: cuatro dedos que rodean la lata, el pulgar del otro lado y la palma entre ellos
  const x0 = 0.62 * CIRC;
  const fingers = [
    { y: 1.34, len: 0.56, w: 0.082 },
    { y: 1.13, len: 0.64, w: 0.088 },
    { y: 0.92, len: 0.6, w: 0.085 },
    { y: 0.73, len: 0.47, w: 0.074 },
  ].map((f) => ({ ...f, tilt: (r() - 0.5) * 0.06 }));
  const hand = (x: number, y: number) => {
    let c = 0;
    for (const f of fingers) {
      const d = seg(x, y, x0 - 0.04, f.y, x0 + f.len, f.y - 0.05 + f.tilt);
      c = Math.max(c, 1 - smooth(f.w * 0.45, f.w * 0.8, d));
    }
    // pulgar
    c = Math.max(c, 1 - smooth(0.06, 0.095, seg(x, y, x0 - 0.78, 0.98, x0 - 0.42, 1.27)));
    // palma: toca menos y por eso limpia menos
    const pd = Math.hypot((x - (x0 - 0.2)) / 0.26, (y - 1.0) / 0.5);
    c = Math.max(c, (1 - smooth(0.6, 1, pd)) * 0.3);
    return c;
  };
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    // el canvas va de arriba hacia abajo; v = 1 es el borde de arriba de la lata
    const v = 1 - j / H;
    for (let i = 0; i < W; i++) {
      const u = i / W;
      const x = u * CIRC, y = v * TALL;
      // la mano no toca la costura: fuera de su recuadro no hay nada que medir
      const inHand = x > x0 - 0.9 && x < x0 + 0.72 && y > 0.6 && y < 1.55;
      const wiped = inHand ? Math.min(1, Math.max(0, hand(x, y) * 1.25 - n.fbm(u * 40, v * 26, 40, 3) * 0.35)) : 0;
      // velo parejo: el frío es el mismo en toda la lata, solo varía un poco
      const fog = Math.min(1, Math.max(0, 0.62 + (n.fbm(u * 6, v * 4, 6, 4) - 0.5) * 0.7));
      const k = (j * W + i) * 4;
      img.data[k] = bare[k];
      img.data[k + 1] = fog * (1 - wiped * 0.85) * 255;
      img.data[k + 2] = r() * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ── GLSL ──────────────────────────────────────────────────────────

export const DROPS_PARS = /* glsl */ `
uniform sampler2D uSurf;
uniform float uSlide;
uniform float uCaustic;
#define CIRC 3.14159265
#define TALL 2.0

float dh1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float dh2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 dh22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

// acc guarda la pendiente (xy), la altura (z) y el radio (w) de la gota más alta en este punto.
void dropAdd(inout vec4 acc, inout float cov, vec2 d, float r, float aa) {
  float l = length(d) / r;
  float c = 1.0 - smoothstep(1.0 - aa / r, 1.0, l);
  if (c <= 0.0) return;
  float h = sqrt(max(0.0, 1.0 - l * l)) * c;
  if (h > acc.z) acc = vec4(d / r * c, h, r);
  cov = max(cov, c);
}

// Gotas quietas: una por celda, con tamaño, lugar y contorno al azar.
void dropsStill(vec2 p, float s, vec2 rr, float dens, float seed, float wet, float aa, inout vec4 acc, inout float cov) {
  float n = floor(CIRC / s + 0.5);
  vec2 g = vec2(p.x / CIRC * n, p.y / s);
  vec2 id = vec2(mod(floor(g.x), n), floor(g.y));
  vec2 f = fract(g) - 0.5;
  if (dh2(id * 1.37 + seed) > dens * wet) return;
  float k = dh2(id + seed * 2.3);
  float r = mix(rr.x, rr.y, k * k);
  vec2 c = (dh22(id * 2.11 + seed) - 0.5) * (1.0 - 2.6 * r / s);
  vec2 d = (f - c) * s;
  d.y *= d.y < 0.0 ? 0.8 : 1.06; // el agua se junta abajo
  // ninguna gota es un círculo perfecto
  float a = atan(d.y, d.x);
  d /= 1.0 + 0.08 * sin(a * 3.0 + k * 31.0) + 0.05 * sin(a * 5.0 + k * 17.0);
  dropAdd(acc, cov, d, r, aa);
}

float pathX(float y, float k, float cw) {
  return (sin(y * (3.0 + k * 4.0) + k * 40.0) * 0.6 + sin(y * (8.0 + k * 5.0) + k * 17.0) * 0.4) * cw * 0.12 + (k - 0.5) * cw * 0.18;
}

// Gotas que bajan: una por columna y por "vida". Devuelve cuánto limpió su rastro.
float dropsSlide(vec2 p, float colW, float seed, float t, float aa, inout vec4 acc, inout float cov) {
  float n = floor(CIRC / colW + 0.5);
  float cw = CIRC / n;
  float gx = p.x / cw;
  float col = mod(floor(gx), n);
  float lx = (fract(gx) - 0.5) * cw;
  float kc = dh1(col * 7.31 + seed);
  float m = t / mix(7.0, 13.0, kc) + kc * 17.0;
  float life = floor(m), lt = fract(m);
  vec2 lid = vec2(col, life) + seed;
  if (dh2(lid) > 0.58) return 0.0;
  float k = dh2(lid + 3.7);
  float y0 = mix(0.85, 1.85, dh2(lid + 9.1));
  float r = mix(0.024, 0.04, dh2(lid + 1.3));
  // a tirones: se detiene, junta agua y vuelve a bajar
  float st = clamp((lt - 0.12) / 0.76, 0.0, 1.0) * 6.0;
  float go = smoothstep(0.4, 1.0, fract(st));
  float yd = y0 - min(1.0, (floor(st) + go) / 6.0) * (y0 + 0.2);
  float moving = st < 6.0 ? sin(go * 3.14159) : 0.0;
  r *= 0.55 + 0.45 * smoothstep(0.0, 0.12, lt);
  float fade = 1.0 - smoothstep(0.84, 1.0, lt);
  float trail = 0.0;
  float above = p.y - yd;
  if (above > 0.0 && p.y < y0 + r) {
    float dx = lx - pathX(p.y, k, cw);
    float w = r * 0.8;
    trail = (1.0 - smoothstep(w * 0.45, w, abs(dx))) * mix(1.0, 0.45, smoothstep(0.0, 1.4, above)) * fade;
    // gotitas que deja atrás
    float ts = 0.042;
    float ty = floor(p.y / ts);
    vec2 tk = dh22(vec2(ty, col) + lid);
    if (tk.x < 0.6 && above > r * 1.9) {
      float tr = mix(0.0045, 0.012, tk.x / 0.6) * (1.0 - smoothstep(0.5, 1.6, above) * 0.45) * fade;
      vec2 d = vec2(dx - (tk.y - 0.5) * w * 0.7, p.y - (ty + 0.3 + tk.y * 0.4) * ts);
      dropAdd(acc, cov, d, tr, aa);
    }
  }
  // cabeza redonda abajo, cola estirada arriba
  vec2 d = vec2(lx - pathX(yd, k, cw), above);
  d.y = d.y > 0.0 ? d.y / (1.25 + moving * 0.6) : d.y * 0.92;
  d.x *= 1.0 + max(0.0, d.y / r) * 0.3;
  dropAdd(acc, cov, d, r, aa);
  return trail;
}
`;

// Sustituye a <map_fragment>: la etiqueta se lee a través de las gotas (lupa) y el velo la aclara apenas.
export const DROPS_MAP = /* glsl */ `
vec2 cp = vec2(vMapUv.x * CIRC, vMapUv.y * TALL);
float caa = max(length(fwidth(cp)), 1e-4);
vec4 surf = texture2D(uSurf, vMapUv);
vec4 cAcc = vec4(0.0);
float cCov = 0.0;
float cTrail = max(
  dropsSlide(cp, 0.24, 1.0, uSlide, caa, cAcc, cCov),
  dropsSlide(cp + vec2(0.11, 0.0), 0.31, 7.0, uSlide * 0.83 + 40.0, caa, cAcc, cCov));
// donde la mano limpió no hay gotas; donde bajó una gota, tampoco
float cWetArea = smoothstep(0.04, 0.3, surf.g) * (1.0 - cTrail);
dropsStill(cp + vec2(0.05, 0.07), 0.22, vec2(0.034, 0.06), 0.32, 41.0, cWetArea, caa, cAcc, cCov);
dropsStill(cp, 0.13, vec2(0.016, 0.042), 0.72, 3.0, cWetArea, caa, cAcc, cCov);
dropsStill(cp + vec2(0.031, 0.017), 0.06, vec2(0.0065, 0.02), 0.9, 11.0, cWetArea, caa, cAcc, cCov);
dropsStill(cp + vec2(0.013, 0.009), 0.028, vec2(0.003, 0.0085), 0.85, 23.0, cWetArea, caa, cAcc, cCov);
float cWet = cCov;
float cFog = surf.g * (1.0 - cTrail) * (1.0 - cWet) * (0.75 + 0.5 * surf.b) * 0.55;
// cada gota es una lupa: aumenta lo que tiene debajo
vec2 cUv = vMapUv - cAcc.xy * cAcc.w * 0.45 / vec2(CIRC, TALL);
vec4 sampledDiffuseColor = texture2D(map, cUv);
diffuseColor *= sampledDiffuseColor;
float cBare = texture2D(uSurf, cUv).r;
float cLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
// tinta blanca o negra: opaca. La de color es translúcida y deja ver el aluminio.
float cOpaque = max(smoothstep(0.3, 0.62, cLum), smoothstep(0.02, 0.004, cLum)) * (1.0 - cBare);
// el agua oscurece un filo delgado en el borde de la gota (refracción) y satura la tinta
float cEdge = smoothstep(0.72, 1.0, length(cAcc.xy)) * cWet;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * diffuseColor.rgb * 1.5 + diffuseColor.rgb * 0.25, cWet * 0.25);
diffuseColor.rgb *= 1.0 - cEdge * 0.45;
// el velo: gotitas tan pequeñas que solo aclaran la tinta
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.82, 0.84) * (0.45 + 0.55 * cLum) + diffuseColor.rgb * 0.45, cFog * 0.5);
`;

// Sustituye a <roughnessmap_fragment> y <metalnessmap_fragment>.
export const DROPS_PBR = /* glsl */ `
float metalnessFactor = mix(mix(0.92, 0.0, cOpaque), 1.0, cBare);
float roughnessFactor = mix(mix(0.22, 0.32, cOpaque), 0.12, cBare);
metalnessFactor *= 1.0 - cFog * 0.5;
roughnessFactor = mix(roughnessFactor, 0.48, cFog);
`;

// Sustituye a <normal_fragment_maps>. La lámina no es un cilindro perfecto: ondula apenas,
// y eso es lo que hace que los reflejos no se vean dibujados con regla.
export const DROPS_NORMAL = /* glsl */ `
vec2 cWave = vec2(sin(cp.x * 6.0 + cp.y * 2.3) + 0.6 * sin(cp.x * 10.0 - cp.y * 4.1), sin(cp.y * 5.0 + cp.x * 4.0)) * 0.012;
vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
mapN.xy *= normalScale * (1.0 - cWet);
mapN.xy += cAcc.xy * 0.45 + cWave;
normal = normalize(tbn * mapN);
`;

export const DROPS_CLEARCOAT_NORMAL = /* glsl */ `
vec3 clearcoatMapN = texture2D(clearcoatNormalMap, vClearcoatNormalMapUv).xyz * 2.0 - 1.0;
clearcoatMapN.xy *= clearcoatNormalScale * (1.0 - cWet);
clearcoatMapN.xy += cAcc.xy * 1.6 + cWave;
clearcoatNormal = normalize(tbn2 * clearcoatMapN);
`;

// Va después de <lights_physical_fragment>: el barniz brilla, el velo lo apaga un poco y el agua es espejo.
export const DROPS_CLEARCOAT = /* glsl */ `
material.clearcoat = mix(mix(1.0, 0.55, cFog), 1.0, cWet);
material.clearcoatRoughness = min(max(mix(mix(0.04, 0.3, cFog), 0.02, cWet), 0.0525) + geometryRoughness, 1.0);
`;

// Va después de <emissivemap_fragment>: la luz de arriba se concentra en la parte baja de cada gota.
export const DROPS_CAUSTIC = /* glsl */ `
float cCau = (1.0 - smoothstep(0.08, 0.5, length(cAcc.xy - vec2(0.0, -0.48)))) * cWet;
totalEmissiveRadiance += (diffuseColor.rgb * 1.2 + 0.05) * cCau * uCaustic;
`;
