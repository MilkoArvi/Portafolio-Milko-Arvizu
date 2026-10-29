// Ruido y mapas procedurales para que los modelos 3D tengan superficie real
// (veta, grano, gotas, huellas) sin descargar una sola imagen.
// Todo es repetible: la misma semilla da la misma textura en cada visita.

type Three = typeof import("three");

export function rng(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Ruido de valor que se repite cada `period` celdas: las texturas no muestran costura al repetirse.
export function makeNoise(seed = 1) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = (x: number, y: number) => perm[perm[x & 255] + (y & 255)] / 255;
  const noise = (x: number, y: number, period = 256) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = val(x0, y0), b = val(x1, y0), c = val(x0, y1), d = val(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number, period = 8, octaves = 5, gain = 0.5) => {
    let s = 0, amp = 0.5, norm = 0, f = 1;
    for (let o = 0; o < octaves; o++) {
      s += amp * noise(x * f, y * f, period * f);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return s / norm;
  };
  return { noise, fbm };
}

// Un campo de alturas en [0,1] que se recorre con (u, v) en [0,1).
export type Field = { w: number; h: number; data: Float32Array };
export function field(w: number, h: number, fn: (u: number, v: number, x: number, y: number) => number): Field {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fn(x / w, y / h, x, y);
  return { w, h, data };
}

// Alturas → mapa de normales (convención de three: +Y hacia arriba; el canvas va hacia abajo).
export function normalCanvas(f: Field, strength = 2) {
  const c = document.createElement("canvas");
  c.width = f.w; c.height = f.h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(f.w, f.h);
  const at = (x: number, y: number) => f.data[((y + f.h) % f.h) * f.w + ((x + f.w) % f.w)];
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * f.w + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Canvas de color desde una función por píxel (r, g, b en 0..1).
export function colorCanvas(w: number, h: number, fn: (u: number, v: number, x: number, y: number) => [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

type TexOpts = { repeat?: [number, number]; srgb?: boolean; aniso?: number };
export function tex(THREE: Three, c: HTMLCanvasElement, { repeat, srgb = false, aniso = 8 }: TexOpts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const hexRGB = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mixRGB = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export type PBRSet = { map: import("three").Texture; normalMap: import("three").Texture; roughnessMap: import("three").Texture };

// Madera: veta ondulada por ruido, nudos y desgaste. light/dark son los tonos de la veta.
// paint: pintura vieja encima, descarapelada donde el ruido lo decide.
export function wood(THREE: Three, { light, dark, seed = 3, size = 512, rings = 22, aniso = 8, paint }: { light: string; dark: string; seed?: number; size?: number; rings?: number; aniso?: number; paint?: string }): PBRSet {
  const n = makeNoise(seed);
  const L = hexRGB(light), D = hexRGB(dark);
  const r = rng(seed + 9);
  const knots = Array.from({ length: 3 }, () => ({ x: r(), y: r(), s: 0.02 + r() * 0.03 }));
  const grain = field(size, size, (u, v) => {
    // la veta corre a lo largo (v); el ruido la dobla
    const warp = n.fbm(u * 4, v * 1, 4, 4) * 2.2;
    let g = 0.5 + 0.5 * Math.sin((u * rings + warp * 3) * Math.PI * 2);
    for (const k of knots) {
      const dx = (u - k.x) * 3, dy = v - k.y, d = Math.hypot(dx, dy);
      g = mix(g, 0.5 + 0.5 * Math.sin(d / k.s * 6), Math.max(0, 1 - d / (k.s * 4)));
    }
    const fiber = n.fbm(u * 64, v * 4, 64, 3);
    return Math.pow(g, 1.8) * 0.75 + fiber * 0.25;
  });
  const wear = field(size, size, (u, v) => n.fbm(u * 3 + 11, v * 3 + 7, 3, 5));
  const P = paint ? hexRGB(paint) : null;
  const chip = P ? field(size, size, (u, v) => n.fbm(u * 6 + 40, v * 2 + 13, 6, 5)) : null;
  const painted = (i: number) => (chip ? Math.min(1, Math.max(0, (chip.data[i] - 0.42) * 9)) : 0);
  const map = colorCanvas(size, size, (_u, _v, x, y) => {
    const i = y * size + x;
    const g = grain.data[i], w = wear.data[i];
    const c = mixRGB(L, D, Math.min(1, g * 0.9 + (1 - w) * 0.25));
    const bleach = Math.max(0, w - 0.55) * 0.9; // sol y polvo aclaran la madera vieja
    const bare = mixRGB(c, [0.78, 0.72, 0.62], bleach);
    if (!P) return bare;
    const faded = mixRGB(P, [0.85, 0.8, 0.72], w * 0.35 + g * 0.08);
    return mixRGB(bare, faded, painted(i));
  });
  const rough = colorCanvas(size, size, (_u, _v, x, y) => { const i = y * size + x; const g = 0.72 + grain.data[i] * 0.22 - painted(i) * 0.12; return [g, g, g]; });
  const height = field(size, size, (_u, _v, x, y) => { const i = y * size + x; return grain.data[i] * 0.7 + n.noise(x * 0.5, y * 0.05, size / 2) * 0.3 + painted(i) * 0.25; });
  return { map: tex(THREE, map, { srgb: true, aniso }), normalMap: tex(THREE, normalCanvas(height, 3), { aniso }), roughnessMap: tex(THREE, rough, { aniso }) };
}

// Arena del desierto: color con manchas, ondas de viento y grano fino.
export function sand(THREE: Three, { base, shade, seed = 5, size = 512, aniso = 8 }: { base: string; shade: string; seed?: number; size?: number; aniso?: number }): PBRSet {
  const n = makeNoise(seed);
  const B = hexRGB(base), S = hexRGB(shade);
  const h = field(size, size, (u, v) => {
    const warp = n.fbm(u * 3, v * 3, 3, 4);
    const ripple = 0.5 + 0.5 * Math.sin((v * 18 + warp * 4 + u * 2) * Math.PI * 2);
    return ripple * 0.55 + n.fbm(u * 48, v * 48, 48, 2) * 0.45;
  });
  const map = colorCanvas(size, size, (u, v, x, y) => {
    const blot = n.fbm(u * 4 + 3, v * 4 + 9, 4, 5);
    const c = mixRGB(B, S, Math.min(1, Math.max(0, blot * 1.3 - 0.35)));
    const k = 0.9 + h.data[y * size + x] * 0.14;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  const rough = colorCanvas(size, size, () => [0.95, 0.95, 0.95]);
  return { map: tex(THREE, map, { srgb: true, aniso }), normalMap: tex(THREE, normalCanvas(h, 4), { aniso }), roughnessMap: tex(THREE, rough, { aniso }) };
}

// Roca sedimentaria: estratos horizontales, grietas y manchas de óxido.
export function rock(THREE: Three, { base, band, seed = 7, size = 512, aniso = 8 }: { base: string; band: string; seed?: number; size?: number; aniso?: number }): PBRSet {
  const n = makeNoise(seed);
  const B = hexRGB(base), K = hexRGB(band);
  const h = field(size, size, (u, v) => {
    const strata = 0.5 + 0.5 * Math.sin((v * 14 + n.fbm(u * 2, v * 2, 2, 3) * 2.5) * Math.PI * 2);
    return strata * 0.4 + n.fbm(u * 8, v * 8, 8, 6) * 0.6;
  });
  const map = colorCanvas(size, size, (u, v, x, y) => {
    const s = h.data[y * size + x];
    const c = mixRGB(B, K, Math.min(1, Math.max(0, (0.5 + 0.5 * Math.sin((v * 14 + n.fbm(u * 2, v * 2, 2, 3) * 2.5) * Math.PI * 2)) * 0.7)));
    const k = 0.75 + s * 0.4;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  const rough = colorCanvas(size, size, (_u, _v, x, y) => { const g = 0.82 + h.data[y * size + x] * 0.15; return [g, g, g]; });
  return { map: tex(THREE, map, { srgb: true, aniso }), normalMap: tex(THREE, normalCanvas(h, 5), { aniso }), roughnessMap: tex(THREE, rough, { aniso }) };
}

// Lámina oxidada: manchas de óxido, metal gris que asoma y picaduras.
export function rust(THREE: Three, { seed = 19, size = 512, aniso = 8 }: { seed?: number; size?: number; aniso?: number } = {}) {
  const n = makeNoise(seed);
  const amount = field(size, size, (u, v) => n.fbm(u * 5, v * 5, 5, 6));
  const pits = field(size, size, (u, v) => n.fbm(u * 40, v * 40, 40, 3));
  const map = colorCanvas(size, size, (u, v, x, y) => {
    const i = y * size + x;
    const a = Math.min(1, Math.max(0, (amount.data[i] - 0.38) * 3));
    const metal: [number, number, number] = [0.42, 0.42, 0.41];
    const rustA: [number, number, number] = [0.55, 0.27, 0.12], rustB: [number, number, number] = [0.32, 0.15, 0.08];
    const r = mixRGB(rustA, rustB, pits.data[i]);
    // escurrimientos verticales de óxido
    const streak = Math.max(0, n.noise(u * 60, v * 3, 60) - 0.6) * 1.5;
    return mixRGB(mixRGB(metal, r, a), rustB, streak);
  });
  const rough = colorCanvas(size, size, (_u, _v, x, y) => { const i = y * size + x; const g = 0.45 + Math.min(1, Math.max(0, (amount.data[i] - 0.38) * 3)) * 0.45; return [g, g, g]; });
  const metalness = colorCanvas(size, size, (_u, _v, x, y) => { const i = y * size + x; const m = 1 - Math.min(1, Math.max(0, (amount.data[i] - 0.38) * 3)) * 0.8; return [m, m, m]; });
  const h = field(size, size, (_u, _v, x, y) => pits.data[y * size + x] * 0.6 + amount.data[y * size + x] * 0.4);
  return {
    map: tex(THREE, map, { srgb: true, aniso }),
    normalMap: tex(THREE, normalCanvas(h, 4), { aniso }),
    roughnessMap: tex(THREE, rough, { aniso }),
    metalnessMap: tex(THREE, metalness, { aniso }),
  };
}

// Metal con pintura electrostática: microtextura de "piel de naranja".
export function powderNormal(THREE: Three, seed = 13, size = 256) {
  const n = makeNoise(seed);
  return tex(THREE, normalCanvas(field(size, size, (u, v) => n.fbm(u * 32, v * 32, 32, 3)), 1.2));
}

// Aluminio cepillado: rayas finas en una sola dirección (normales y rugosidad).
export function brushedSet(THREE: Three, seed = 17, size = 512) {
  const n = makeNoise(seed);
  const h = field(size, size, (u, v) => n.noise(u * 2, v * 380, 380) * 0.7 + n.noise(u * 6, v * 90, 90) * 0.3);
  const rough = colorCanvas(size, size, (_u, _v, x, y) => { const g = 0.45 + h.data[y * size + x] * 0.35; return [g, g, g]; });
  return { normalMap: tex(THREE, normalCanvas(h, 0.9)), roughnessMap: tex(THREE, rough) };
}

// Huellas y polvo para vidrio y superficies brillantes: canal verde = rugosidad.
export function smudges(THREE: Three, seed = 23, size = 512) {
  const n = makeNoise(seed);
  const r = rng(seed);
  const prints = Array.from({ length: 7 }, () => ({ x: r(), y: r(), s: 0.03 + r() * 0.04, a: r() * Math.PI }));
  const c = colorCanvas(size, size, (u, v) => {
    let g = 0.04 + n.fbm(u * 6, v * 6, 6, 4) * 0.08;
    for (const p of prints) {
      const dx = u - p.x, dy = v - p.y;
      const d = Math.hypot(dx, dy * 1.4);
      if (d < p.s) {
        const ridges = 0.5 + 0.5 * Math.sin(d * 900 + Math.atan2(dy, dx) * 2);
        g += (1 - d / p.s) * ridges * 0.25;
      }
    }
    g += Math.max(0, n.fbm(u * 40, v * 40, 40, 2) - 0.72) * 0.6; // motas de polvo
    return [g, Math.min(1, g), g];
  });
  return tex(THREE, c);
}
