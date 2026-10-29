import { FACE_EDGE, FACE_LUM, FACE_N } from "@/data/face";

export type FacePoint = {
  x: number; // 0..1
  y: number; // 0..1
  lum: number; // 0..1
  green: boolean; // ojos, lentes, cejas, contorno y sombras
};

function decode(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cache: { step: number; pts: FacePoint[] } | null = null;

// step = 1 usa toda la cuadrícula; 2 usa uno de cada dos (para celulares).
export function getFacePoints(step = 1, threshold = 0.06): FacePoint[] {
  if (cache && cache.step === step) return cache.pts;
  const lum = decode(FACE_LUM);
  const edge = decode(FACE_EDGE);
  const pts: FacePoint[] = [];
  for (let y = 0; y < FACE_N; y += step) {
    for (let x = 0; x < FACE_N; x += step) {
      const i = y * FACE_N + x;
      const l = lum[i] / 255;
      if (l < threshold) continue;
      pts.push({
        x: (x + 0.5) / FACE_N,
        y: (y + 0.5) / FACE_N,
        lum: l,
        green: edge[i] / 255 > 0.45 || l < 0.4,
      });
    }
  }
  cache = { step, pts };
  return pts;
}

export const FACE_GRID = FACE_N;
