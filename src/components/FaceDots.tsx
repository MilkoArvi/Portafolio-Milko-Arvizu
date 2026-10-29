"use client";

import { useEffect, useRef } from "react";
import { getFacePoints } from "@/lib/face";

// Mi cara en puntos de semitono, blanco y verde.
// Los puntos llegan desde abajo al cargar y se apartan del cursor.
// Solo se redibuja mientras algo se mueve, así no gasta batería en reposo.

const WHITE = "#eef1ea";
const GREEN = "#8fcfa5";

export function FaceDots({ className = "", align = "right" }: { className?: string; align?: "right" | "center" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const small = window.matchMedia("(max-width: 640px)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pts = getFacePoints(small ? 2 : 1);
    const n = pts.length;
    const pos = new Float32Array(n * 2);
    const vel = new Float32Array(n * 2);
    const tgt = new Float32Array(n * 2);
    const delay = new Float32Array(n);
    let W = 0, H = 0, size = 0, ox = 0, oy = 0, cell = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const layout = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const center = align === "center" || W < 640;
      size = Math.min(H * 1.02, center ? W : W * 0.98);
      ox = center ? (W - size) / 2 : W - size;
      oy = H - size;
      cell = size / (128 / (small ? 2 : 1));
      for (let i = 0; i < n; i++) {
        tgt[i * 2] = ox + pts[i].x * size;
        tgt[i * 2 + 1] = oy + pts[i].y * size;
      }
    };
    layout();

    // Estado inicial: cada punto empieza abajo, como si subiera desde el suelo.
    for (let i = 0; i < n; i++) {
      if (reduce) {
        pos[i * 2] = tgt[i * 2];
        pos[i * 2 + 1] = tgt[i * 2 + 1];
      } else {
        pos[i * 2] = tgt[i * 2] + (Math.random() - 0.5) * 40;
        pos[i * 2 + 1] = H + 20 + Math.random() * H * 0.4;
      }
      // las filas de abajo llegan primero; un poco de azar para que no se vea mecánico
      delay[i] = (1 - pts[i].y) * 0.9 + Math.random() * 0.25;
    }

    const mouse = { x: -9999, y: -9999, active: false };
    let start = performance.now();
    let raf = 0;
    let running = false;
    let visible = true;

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      const R = coarse ? 70 : 110;
      let moving = false;
      // dos pasadas por color: menos cambios de fillStyle
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass === 0 ? GREEN : WHITE;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const p = pts[i];
          if ((pass === 0) !== p.green) continue;
          const ix = i * 2, iy = ix + 1;
          {
            const live = t > delay[i];
            if (live) {
              let fx = (tgt[ix] - pos[ix]) * 0.06;
              let fy = (tgt[iy] - pos[iy]) * 0.06;
              if (mouse.active) {
                const dx = pos[ix] - mouse.x, dy = pos[iy] - mouse.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < R * R) {
                  const d = Math.sqrt(d2) || 1;
                  const f = (1 - d / R) * 6;
                  fx += (dx / d) * f;
                  fy += (dy / d) * f;
                }
              }
              vel[ix] = (vel[ix] + fx) * 0.8;
              vel[iy] = (vel[iy] + fy) * 0.8;
              pos[ix] += vel[ix];
              pos[iy] += vel[iy];
              if (Math.abs(vel[ix]) + Math.abs(vel[iy]) > 0.05 || Math.abs(tgt[iy] - pos[iy]) > 0.5) moving = true;
            } else moving = true;
          }
          const r = cell * 0.5 * (0.18 + 0.8 * p.lum);
          ctx.moveTo(pos[ix] + r, pos[iy]);
          ctx.arc(pos[ix], pos[iy], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      if (moving && visible) raf = requestAnimationFrame(draw);
      else running = false;
    };
    const kick = () => {
      if (!running && visible) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    kick();

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = mouse.x > -40 && mouse.y > -40 && mouse.x < W + 40 && mouse.y < H + 40;
      kick();
    };
    const onLeave = () => { mouse.active = false; kick(); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
    io.observe(canvas);
    const ro = new ResizeObserver(() => { layout(); kick(); });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      ro.disconnect();
      start = 0;
    };
  }, [align]);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full touch-pan-y ${className}`} />;
}
