"use client";

import { useEffect, useRef } from "react";
import { createProgram, fullscreenTriangle, getGL, loop, mountCanvas, prefersReducedMotion, releaseCanvas, VERT } from "@/lib/gl";
import { BLACKHOLE_FRAG } from "./shader";

// La cara de Mike: un agujero negro trazado por píxel en la GPU.
// energy (0..1) calienta el disco y lo acelera cuando Mike escucha o habla.
// "hero": pantalla completa con estrellas. "mini": transparente, para la esquina del escritorio.

type Mode = "hero" | "mini";

const PRESET: Record<Mode, { dist: number; fov: number; stars: number; shift: [number, number]; budget: number }> = {
  hero: { dist: 21, fov: 1.55, stars: 1, shift: [0, 0.06], budget: 1.25e6 },
  mini: { dist: 30, fov: 1.25, stars: 0, shift: [0, 0], budget: 0.18e6 },
};

export function BlackHole({ energyRef, mode = "hero", className = "" }: { energyRef: React.RefObject<number>; mode?: Mode; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = mountCanvas(el);
    const gl = getGL(canvas, { alpha: true, premultipliedAlpha: true });
    if (!gl) { releaseCanvas(canvas, null); return; }
    let prog: ReturnType<typeof createProgram>;
    try { prog = createProgram(gl, VERT, BLACKHOLE_FRAG); } catch (e) { console.error(e); releaseCanvas(canvas, gl); return; }
    const draw = fullscreenTriangle(gl);
    const cfg = PRESET[mode];
    const reduce = prefersReducedMotion();
    const small = window.matchMedia("(max-width: 768px)").matches;
    const steps = small ? 150 : 230;

    // Resolución adaptable: arrancamos con un presupuesto de píxeles y bajamos si el equipo no llega a 50 fps.
    let scale = 1;
    let avg = 16;
    let lastAdjust = 0;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fitScale = Math.min(dpr, Math.sqrt((small ? cfg.budget * 0.5 : cfg.budget) / Math.max(1, w * h)));
      const s = Math.max(0.35, fitScale * scale);
      const cw = Math.max(2, Math.round(w * s)), ch = Math.max(2, Math.round(h * s));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    };

    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      look.tx = (e.clientX / window.innerWidth) * 2 - 1;
      look.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    if (mode === "hero" && !reduce) window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    let energy = 0, spin = 0, prevNow = performance.now();
    const stop = loop((time, dt) => {
      if (!visible) return;
      const now = performance.now();
      const frameMs = now - prevNow;
      prevNow = now;
      if (frameMs < 200) avg = avg * 0.92 + frameMs * 0.08;
      if (time - lastAdjust > 1.2) {
        lastAdjust = time;
        if (avg > 21 && scale > 0.45) scale *= 0.85;
        else if (avg < 13 && scale < 1) scale = Math.min(1, scale * 1.08);
      }
      fit();
      energy += ((energyRef.current ?? 0) - energy) * Math.min(1, dt * 3);
      spin += reduce ? 0 : dt * (0.45 + energy * 1.6);
      look.x += (look.tx - look.x) * Math.min(1, dt * 2);
      look.y += (look.ty - look.y) * Math.min(1, dt * 2);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog.prog);
      gl.uniform2f(prog.u.u_res, canvas.width, canvas.height);
      gl.uniform1f(prog.u.u_time, reduce ? 0 : time);
      gl.uniform1f(prog.u.u_spin, spin);
      gl.uniform1f(prog.u.u_energy, energy);
      gl.uniform2f(prog.u.u_look, look.x, look.y);
      // en vertical subimos el agujero para dejar abajo el título y la consola
      const portrait = canvas.height > canvas.width * 1.1;
      gl.uniform2f(prog.u.u_shift, cfg.shift[0], portrait && mode === "hero" ? 0.42 : cfg.shift[1]);
      gl.uniform1f(prog.u.u_dist, cfg.dist);
      gl.uniform1f(prog.u.u_fov, cfg.fov);
      gl.uniform1f(prog.u.u_stars, cfg.stars);
      gl.uniform1i(prog.u.u_steps, steps);
      draw();
    });

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      releaseCanvas(canvas, gl);
    };
  }, [energyRef, mode]);

  return <div ref={host} aria-hidden className={`relative size-full ${className}`} />;
}
