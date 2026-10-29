"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createProgram, fullscreenTriangle, getGL, loop, mountCanvas, prefersReducedMotion, releaseCanvas, VERT, fitCanvas } from "@/lib/gl";
import { FLAVORS, WATER } from "./label";
import { JUICE_FRAG } from "./juice";

// Calma: una lata 3D que gira, se voltea y cambia de sabor con el scroll.
// Detrás está el jugo de cada sabor, con burbujas y luz; Three.js solo se descarga en esta página.

const SECTIONS = [
  { big: "CALMA", title: "Agua botánica con gas", body: "Una marca inventada para mostrar scroll en 3D. Tres sabores, cero azúcar añadida y una lata que se deja ver por todos lados." },
  ...FLAVORS.map((f) => ({ big: f.short, title: f.name, body: f.notes })),
  { big: "SALUD", title: "Pruébalas las tres", body: "Todo lo que ves, incluida la etiqueta y las gotas de la lata, está hecho con código." },
];
const PALETTES = [WATER, ...FLAVORS.map((f) => f.juice), WATER];
const DARK = "#2a2522";

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const PAL = PALETTES.map((p) => p.map(rgb));

export function Bebida() {
  const wrap = useRef<HTMLDivElement>(null);
  const juiceHost = useRef<HTMLDivElement>(null);
  const canHost = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState(0);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const bg = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], PALETTES.map((p) => p[1]));
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progress.current = v;
    setSection(Math.round(v * 4));
  });

  // Fondo: el jugo del sabor en pantalla
  useEffect(() => {
    const host = juiceHost.current;
    if (!host) return;
    const canvas = mountCanvas(host);
    const gl = getGL(canvas, { alpha: false });
    if (!gl) { releaseCanvas(canvas, null); return; }
    let prog: ReturnType<typeof createProgram>;
    try { prog = createProgram(gl, VERT, JUICE_FRAG); } catch (e) { console.error(e); releaseCanvas(canvas, gl); return; }
    const draw = fullscreenTriangle(gl);
    const reduce = prefersReducedMotion();
    const col = [new Float32Array(3), new Float32Array(3), new Float32Array(3)];
    let shown = 0, last = 0, rise = 0, visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(host);
    const stop = loop((time, dt) => {
      if (!visible) return;
      const p = progress.current;
      // la velocidad del scroll empuja las burbujas
      rise += (Math.min(3, Math.abs(p - last) / Math.max(dt, 1e-3) * 4) - rise) * Math.min(1, dt * 3);
      last = p;
      shown += (p - shown) * Math.min(1, dt * 5);
      const x = Math.min(3.999, shown * 4);
      const i = Math.floor(x);
      const f = x - i;
      // cada sabor se sostiene y cambia entre secciones
      const t = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
      const k = t * t * (3 - 2 * t);
      for (let c = 0; c < 3; c++) for (let ch = 0; ch < 3; ch++) col[c][ch] = PAL[i][c][ch] + (PAL[i + 1][c][ch] - PAL[i][c][ch]) * k;
      const fizzA = i === 0 || i === 4 ? 0.3 : 1, fizzB = i + 1 === 4 ? 0.3 : 1;
      fitCanvas(canvas, 1.25);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog.prog);
      gl.uniform2f(prog.u.u_res, canvas.width, canvas.height);
      gl.uniform1f(prog.u.u_time, reduce ? 0 : time);
      gl.uniform3fv(prog.u.u_top, col[0]);
      gl.uniform3fv(prog.u.u_mid, col[1]);
      gl.uniform3fv(prog.u.u_bot, col[2]);
      gl.uniform1f(prog.u.u_fizz, fizzA + (fizzB - fizzA) * k);
      gl.uniform1f(prog.u.u_rise, reduce ? 0 : rise);
      draw();
    });
    return () => { stop(); io.disconnect(); releaseCanvas(canvas, gl); };
  }, []);

  // La lata
  useEffect(() => {
    const el = canHost.current;
    if (!el) return;
    let disposed = false;
    let dispose = () => {};
    const test = document.createElement("canvas");
    if (!test.getContext("webgl2")) { setFallback(true); return; }
    import("./can")
      .then(({ createCanScene }) => createCanScene({ host: el, progress: () => progress.current }))
      .then((s) => {
        if (disposed) { s.dispose(); return; }
        dispose = s.dispose;
        setReady(true);
      })
      .catch((e) => { console.error(e); if (!disposed) setFallback(true); });
    return () => { disposed = true; dispose(); };
  }, []);

  const onJuice = section >= 1 && section <= 3;
  const ink = onJuice ? FLAVORS[section - 1].text : DARK;

  return (
    <motion.div ref={wrap} style={{ backgroundColor: bg }} className="relative h-[520vh]">
      <div className="sticky top-11 h-[calc(100svh-44px)] overflow-hidden">
        <div ref={juiceHost} aria-hidden className="absolute inset-0" />

        {/* Texto enorme detrás de la lata */}
        {SECTIONS.map((s, i) => (
          <motion.p
            key={s.big}
            aria-hidden
            initial={false}
            animate={{ opacity: section === i ? 1 : 0, y: section === i ? 0 : section > i ? -60 : 60 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display font-extrabold leading-none tracking-[-0.05em] ${i >= 1 && i <= 3 ? "text-white/20" : "text-white/70"}`}
            style={{ fontSize: "clamp(5rem, 23vw, 22rem)" }}
          >
            {s.big}
          </motion.p>
        ))}

        <div ref={canHost} className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} aria-label="Lata de Calma en 3D; arrástrala para girarla" role="img" />

        {/* Texto de cada sección */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 transition-colors duration-700 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:p-10" style={{ color: ink, textShadow: onJuice ? "0 1px 14px rgba(0,0,0,0.28)" : "none" }}>
          {SECTIONS.map((s, i) => {
            const right = i === 1 || i === 3;
            return (
              <motion.div
                key={s.title}
                initial={false}
                animate={{ opacity: section === i ? 1 : 0, y: section === i ? 0 : 16 }}
                transition={{ duration: 0.5 }}
                className={`absolute bottom-5 max-w-[30ch] rounded-2xl p-5 backdrop-blur-md sm:static sm:bottom-auto sm:bg-transparent sm:p-0 sm:backdrop-blur-none ${onJuice ? "bg-black/25" : "bg-white/45"} ${section === i ? "" : "sm:hidden"} ${right ? "left-5 sm:ml-auto sm:mr-[4vw] sm:text-right" : "left-5 sm:ml-[4vw]"}`}
              >
                <p className="text-sm opacity-75">{i === 0 || i === 4 ? "Calma" : `Sabor ${i} de 3`}</p>
                <h2 className="mt-1 font-display text-[clamp(1.6rem,3vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.02em]">{s.title}</h2>
                <p className="mt-3 leading-relaxed opacity-85">{s.body}</p>
              </motion.div>
            );
          })}
        </div>
        {fallback && <p role="status" className="absolute inset-x-4 top-1/2 text-center">Tu navegador no puede mostrar la lata en 3D.</p>}
      </div>
    </motion.div>
  );
}
