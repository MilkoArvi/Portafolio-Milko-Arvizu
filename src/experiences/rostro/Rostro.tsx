"use client";

import { useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getFacePoints, FACE_GRID } from "@/lib/face";
import type { Locale } from "@/config/site";

const COPY = {
  es: { aria: "Fragmentos de código que se acomodan hasta formar la cara de Milko", code: "Esto es código.", slow: "Baja despacio.", face: "Y esto también.", hover: "Mueve el cursor sobre la cara." },
  en: { aria: "Code fragments settling into Milko's face", code: "This is code.", slow: "Scroll slowly.", face: "So is this.", hover: "Move your cursor over the face." },
};

// Rostro en código. Arriba: un archivo de código como en el editor.
// Al bajar, cada carácter viaja a su lugar y juntos forman mi cara.
// Los caracteres se dibujan desde un atlas (una sola imagen) para que sea rápido.

const CODE = `// Rostro en código: cada carácter es un punto de mi cara.
import { getFacePoints } from "@/lib/face";

export function drawFace(ctx: CanvasRenderingContext2D, progress: number) {
  const points = getFacePoints(isMobile ? 2 : 1);
  for (const [i, p] of points.entries()) {
    const t = ease(clamp(progress * 1.4 - stagger(i)));
    const x = mix(codeX[i], faceX(p), t);
    const y = mix(codeY[i], faceY(p), t);
    const size = mix(fontSize, cell * (0.55 + 0.75 * p.lum), t);
    const color = p.green ? MINT : BONE;
    drawGlyph(ctx, glyphs[i], x, y, size, t > 0.5 ? color : CODE_COLOR);
  }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function repel(p: Point, mouse: Point, radius = 120) {
  const dx = p.x - mouse.x, dy = p.y - mouse.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d > radius) return { x: 0, y: 0 };
  const force = (1 - d / radius) * 18;
  return { x: (dx / d) * force, y: (dy / d) * force };
}

type Point = { x: number; y: number };
export const MINT = "#8fcfa5", BONE = "#eef1ea";
// Next.js + TypeScript + Canvas 2D. Hecho por Milko Arvizu en Zapopan.
`;

const MINT = "#8fcfa5";
const BONE = "#eef1ea";
const CODE_COLOR = "#7f8a82";

export function Rostro({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const [label, setLabel] = useState<"code" | "face" | null>("code");

  useEffect(
    () =>
      scrollYProgress.on("change", (v) => {
        progressRef.current = v;
        setLabel(v < 0.2 ? "code" : v > 0.78 ? "face" : null);
      }),
    [scrollYProgress],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const small = window.matchMedia("(max-width: 640px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = small ? 2 : 1;
    const pts = getFacePoints(step, 0.08);
    const n = pts.length;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // El código sin espacios, en orden de lectura: un carácter por punto.
    const src = CODE.replace(/\s+/g, "");
    const glyphs = Array.from({ length: n }, (_, i) => src[i % src.length]);
    const unique = Array.from(new Set(glyphs));
    const index = new Map(unique.map((c, i) => [c, i]));

    // Atlas: 3 filas (código, blanco, verde) × caracteres únicos.
    const G = 40;
    const atlas = document.createElement("canvas");
    const buildAtlas = () => {
      atlas.width = unique.length * G;
      atlas.height = G * 3;
      const a = atlas.getContext("2d")!;
      a.font = `700 ${G * 0.82}px 'JetBrains Mono Variable', monospace`;
      a.textAlign = "center";
      a.textBaseline = "middle";
      [CODE_COLOR, BONE, MINT].forEach((c, row) => {
        a.fillStyle = c;
        unique.forEach((ch, i) => a.fillText(ch, i * G + G / 2, row * G + G / 2 + 1));
      });
    };

    const codeX = new Float32Array(n), codeY = new Float32Array(n);
    const faceX = new Float32Array(n), faceY = new Float32Array(n);
    const offX = new Float32Array(n), offY = new Float32Array(n);
    const velX = new Float32Array(n), velY = new Float32Array(n);
    const stagger = new Float32Array(n);
    let W = 0, H = 0, cell = 0, fontSize = 0;

    const layout = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // cara centrada
      const size = Math.min(W * 0.96, H * 0.94);
      const fx = (W - size) / 2, fy = (H - size) / 2 + H * 0.02;
      cell = size / (FACE_GRID / step);
      // código como en el editor: recorre el texto real respetando saltos de línea y sangría
      const lines = CODE.split("\n");
      const maxCols = Math.max(...lines.map((l) => l.length));
      // repetimos el archivo hasta cubrir todos los puntos y ajustamos la letra a la altura
      let totalLines = 0, count = 0;
      while (count < n) { for (const l of lines) { totalLines++; count += l.replace(/\s/g, "").length; if (count >= n) break; } }
      // Repartimos el archivo en columnas, como un editor dividido, para que la letra se lea.
      let best = { C: 1, adv: 0, per: totalLines };
      for (let C = 1; C <= 4; C++) {
        const per = Math.ceil(totalLines / C);
        const adv = Math.min((W * 0.92) / (C * maxCols + (C - 1) * 4), (H * 0.88) / (per * 1.6));
        if (adv > best.adv) best = { C, adv, per };
      }
      const adv = best.adv, lh = adv * 1.6, colW = (maxCols + 4) * adv;
      fontSize = adv * 1.45;
      const x0 = (W - (best.C * maxCols + (best.C - 1) * 4) * adv) / 2;
      const y0 = (H - best.per * lh) / 2 + lh / 2;
      let k = 0, row = 0;
      outer: while (k < n) {
        for (const l of lines) {
          const col = Math.floor(row / best.per), r = row % best.per;
          for (let c = 0; c < l.length; c++) {
            if (/\s/.test(l[c])) continue;
            codeX[k] = x0 + col * colW + c * adv + adv / 2;
            codeY[k] = y0 + r * lh;
            k++;
            if (k >= n) break outer;
          }
          row++;
        }
      }
      for (let i = 0; i < n; i++) {
        faceX[i] = fx + pts[i].x * size;
        faceY[i] = fy + pts[i].y * size;
        stagger[i] = (i / n) * 0.28 + Math.random() * 0.08;
      }
    };

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const mouse = { x: -9999, y: -9999 };
    let raf = 0, visible = true;

    const frame = () => {
      const p = reduce ? (progressRef.current > 0.4 ? 1 : 0) : progressRef.current;
      ctx.clearRect(0, 0, W, H);
      const R = small ? 70 : 120;
      for (let i = 0; i < n; i++) {
        const t = ease(Math.min(1, Math.max(0, (p - 0.12) * 1.75 - stagger[i])));
        let x = codeX[i] + (faceX[i] - codeX[i]) * t;
        let y = codeY[i] + (faceY[i] - codeY[i]) * t;
        // el cursor desarma la cara (solo cuando ya está formada)
        if (t > 0.95) {
          const dx = x + offX[i] - mouse.x, dy = y + offY[i] - mouse.y;
          const d2 = dx * dx + dy * dy;
          let fx = -offX[i] * 0.07, fy = -offY[i] * 0.07;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1; const f = (1 - d / R) * 5; fx += (dx / d) * f; fy += (dy / d) * f; }
          velX[i] = (velX[i] + fx) * 0.82; velY[i] = (velY[i] + fy) * 0.82;
          offX[i] += velX[i]; offY[i] += velY[i];
          x += offX[i]; y += offY[i];
        }
        const s = fontSize + (cell * (0.95 + 1.15 * pts[i].lum) - fontSize) * t;
        const rowAtlas = t < 0.5 ? 0 : pts[i].green ? 2 : 1;
        ctx.globalAlpha = t < 0.5 ? 0.85 : 0.45 + 0.55 * pts[i].lum;
        ctx.drawImage(atlas, index.get(glyphs[i])! * G, rowAtlas * G, G, G, x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (visible) raf = requestAnimationFrame(frame);
    };

    let alive = true;
    document.fonts.load("600 20px 'JetBrains Mono Variable'").catch(() => {}).finally(() => {
      if (!alive) return;
      buildAtlas();
      layout();
      raf = requestAnimationFrame(frame);
    });
    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onLeave = () => { mouse.x = mouse.y = -9999; };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible && alive) raf = requestAnimationFrame(frame); });
    io.observe(canvas);
    const ro = new ResizeObserver(() => layout());
    ro.observe(canvas);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      io.disconnect(); ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="relative h-[320vh] bg-night text-bone">
      <div className="sticky top-11 h-[calc(100svh-44px)] overflow-hidden">
        <canvas ref={canvasRef} aria-label={t.aria} role="img" className="absolute inset-0 size-full" />
        <div className={`pointer-events-none absolute inset-x-0 bottom-6 px-4 text-center transition-opacity duration-500 ${label === "code" ? "opacity-100" : "opacity-0"}`}>
          <p className="font-display text-2xl sm:text-3xl">{t.code}</p>
          <p className="mt-1 text-sm text-bone/55">{t.slow}</p>
        </div>
        <div className={`pointer-events-none absolute inset-x-0 bottom-6 px-4 text-center transition-opacity duration-500 ${label === "face" ? "opacity-100" : "opacity-0"}`}>
          <p className="font-display text-2xl sm:text-3xl">{t.face}</p>
          <p className="mt-1 text-sm text-bone/55">{t.hover}</p>
        </div>
      </div>
    </div>
  );
}
