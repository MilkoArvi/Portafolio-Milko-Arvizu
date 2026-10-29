"use client";

import "@fontsource-variable/archivo/standard.css";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createProgram, doubleTarget, fitCanvas, fullscreenTriangle, getGL, loop, mountCanvas, prefersReducedMotion, releaseCanvas, VERT, type GL } from "@/lib/gl";
import type { Locale } from "@/config/site";
import { DISPLAY_FRAG, DYE_FRAG, SPLAT_FRAG, VELOCITY_FRAG } from "./shader";

// Concepto ficticio: cartel interactivo de una bienal de grabado en Guadalajara.
// Mantén presionado y arrastra: la tinta roja cae sobre la plancha de madera
// y el cartel aparece en papel dentro de la tinta.

const COPY = {
  es: {
    lines: ["BIENAL DE", "GRABADO DE", "OCCIDENTE"],
    cursor: ["Mantén", "y mueve"],
    auto: "Entintar por mí",
    clear: "Limpiar la plancha",
    revealTitle: "Bienal de Grabado de Occidente",
    revealBody: "Del 12 al 28 de marzo de 2027, en el centro de Guadalajara. 140 grabadores, 9 talleres abiertos y una prensa que no se apaga.",
    revealCta: "Registrarme como visitante",
    noGL: "Tu navegador no puede mostrar la tinta en tiempo real.",
  },
  en: {
    lines: ["BIENAL DE", "GRABADO DE", "OCCIDENTE"],
    cursor: ["Hold", "& move"],
    auto: "Ink it for me",
    clear: "Wipe the block",
    revealTitle: "Western Mexico Printmaking Biennial",
    revealBody: "March 12–28, 2027, in downtown Guadalajara. 140 printmakers, 9 open studios and a press that never stops.",
    revealCta: "Register as a visitor",
    noGL: "Your browser can't render the ink in real time.",
  },
};

type Sim = {
  splat: (x: number, y: number, dx: number, dy: number, amount: number) => void;
  clear: () => void;
};

// Dibuja el texto del cartel en un canvas 2D y lo sube como textura.
async function makeTextTexture(gl: GL, w: number, h: number, lines: string[]) {
  try { await document.fonts.load("900 100px 'Archivo Variable'"); } catch {}
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  const portrait = h > w;
  const margin = w * 0.05;
  (ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = "expanded";
  let size = h * (portrait ? 0.12 : 0.235);
  ctx.font = `900 ${size}px 'Archivo Variable', sans-serif`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  size *= Math.min(1, (w - margin * 2) / widest);
  ctx.font = `900 ${size}px 'Archivo Variable', sans-serif`;
  const lh = size * 0.92;
  const total = lh * lines.length;
  const y0 = (h - total) / 2 + size * 0.78;
  lines.forEach((l, i) => ctx.fillText(l, margin, y0 + i * lh));
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function Tinta({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sim = useRef<Sim | null>(null);
  const painted = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);
  const cx = useMotionValue(-200);
  const cy = useMotionValue(-200);
  const sx = useSpring(cx, { stiffness: 500, damping: 40 });
  const sy = useSpring(cy, { stiffness: 500, damping: 40 });
  const last = useRef<{ x: number; y: number } | null>(null);
  const autoRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = mountCanvas(host);
    const gl = getGL(canvas, { alpha: false });
    if (!gl) { releaseCanvas(canvas, null); setNoGL(true); return; }
    fitCanvas(canvas, 1.5);
    const simW = Math.min(640, Math.round(canvas.width / 3));
    const simH = Math.round(simW * (canvas.height / canvas.width));
    const vel = doubleTarget(gl, simW, simH);
    const dye = doubleTarget(gl, simW, simH);
    if (!vel || !dye) { releaseCanvas(canvas, gl); setNoGL(true); return; }
    let progs;
    try {
      progs = {
        splat: createProgram(gl, VERT, SPLAT_FRAG),
        vel: createProgram(gl, VERT, VELOCITY_FRAG),
        dye: createProgram(gl, VERT, DYE_FRAG),
        show: createProgram(gl, VERT, DISPLAY_FRAG),
      };
    } catch (e) { console.error(e); releaseCanvas(canvas, gl); setNoGL(true); return; }
    const draw = fullscreenTriangle(gl);
    let textTex: WebGLTexture | null = null;
    let alive = true;
    makeTextTexture(gl, canvas.width, canvas.height, t.lines).then((tx) => { if (alive) textTex = tx; });

    const bind = (unit: number, tex: WebGLTexture) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
    const aspect = canvas.width / canvas.height;

    const splatInto = (target: NonNullable<typeof vel>, x: number, y: number, v: [number, number, number], radius: number) => {
      gl.useProgram(progs.splat.prog);
      gl.viewport(0, 0, simW, simH);
      bind(0, target.read.tex);
      gl.uniform1i(progs.splat.u.u_src, 0);
      gl.uniform2f(progs.splat.u.u_point, x, y);
      gl.uniform3f(progs.splat.u.u_value, ...v);
      gl.uniform1f(progs.splat.u.u_radius, radius);
      gl.uniform1f(progs.splat.u.u_aspect, aspect);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.fbo);
      draw();
      target.swap();
    };

    sim.current = {
      splat(x, y, dx, dy, amount) {
        splatInto(vel, x, y, [dx * 1.5, dy * 1.5, 0], 0.0011);
        splatInto(dye, x, y, [amount, 0, 0], 0.0009);
      },
      clear() { vel.clear(); dye.clear(); },
    };

    const reduce = prefersReducedMotion();
    const stop = loop((time, dt) => {
      const step = Math.min(dt, 1 / 30);
      const texel: [number, number] = [1 / simW, 1 / simH];
      // velocidad
      gl.useProgram(progs.vel.prog);
      gl.viewport(0, 0, simW, simH);
      bind(0, vel.read.tex); bind(1, dye.read.tex);
      gl.uniform1i(progs.vel.u.u_vel, 0); gl.uniform1i(progs.vel.u.u_dye, 1);
      gl.uniform2f(progs.vel.u.u_texel, ...texel);
      gl.uniform1f(progs.vel.u.u_dt, reduce ? step * 0.5 : step);
      gl.bindFramebuffer(gl.FRAMEBUFFER, vel.write.fbo);
      draw(); vel.swap();
      // tinta
      gl.useProgram(progs.dye.prog);
      bind(0, vel.read.tex); bind(1, dye.read.tex);
      gl.uniform1i(progs.dye.u.u_vel, 0); gl.uniform1i(progs.dye.u.u_dye, 1);
      gl.uniform2f(progs.dye.u.u_texel, ...texel);
      gl.uniform1f(progs.dye.u.u_dt, step);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dye.write.fbo);
      draw(); dye.swap();
      // pantalla
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(progs.show.prog);
      bind(0, dye.read.tex);
      if (textTex) bind(1, textTex);
      gl.uniform1i(progs.show.u.u_dye, 0); gl.uniform1i(progs.show.u.u_text, 1);
      gl.uniform2f(progs.show.u.u_res, canvas.width, canvas.height);
      gl.uniform2f(progs.show.u.u_texel, ...texel);
      gl.uniform1f(progs.show.u.u_time, time);
      gl.uniform1f(progs.show.u.u_dpr, canvas.width / canvas.clientWidth);
      draw();
    });
    return () => { alive = false; stop(); cancelAnimationFrame(autoRef.current); sim.current = null; releaseCanvas(canvas, gl); };
  }, [t.lines]);

  // Pinta un segmento con varias manchas para que el trazo sea continuo.
  const paintTo = (x: number, y: number) => {
    const el = wrapRef.current;
    if (!el || !sim.current) return;
    const r = el.getBoundingClientRect();
    const u = (x - r.left) / r.width;
    const v = 1 - (y - r.top) / r.height;
    const prev = last.current ?? { x: u, y: v };
    const dx = u - prev.x;
    const dy = v - prev.y;
    const dist = Math.hypot(dx * r.width, dy * r.height);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      sim.current.splat(prev.x + dx * k, prev.y + dy * k, dx / steps * 60, dy / steps * 60, 0.55);
    }
    last.current = { x: u, y: v };
    painted.current += dist;
    if (!revealed && painted.current > r.width * 3.2) setRevealed(true);
  };

  const autoPaint = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const start = performance.now();
    last.current = null;
    cancelAnimationFrame(autoRef.current);
    const tick = (now: number) => {
      const k = (now - start) / 3200;
      if (k > 1) { last.current = null; return; }
      // trazo en zigzag que recorre todo el cartel
      const x = r.left + r.width * (0.08 + 0.84 * (0.5 - 0.5 * Math.cos(k * Math.PI * 7)));
      const y = r.top + r.height * (0.18 + 0.64 * k);
      paintTo(x, y);
      autoRef.current = requestAnimationFrame(tick);
    };
    autoRef.current = requestAnimationFrame(tick);
  };

  const clear = () => { sim.current?.clear(); painted.current = 0; setRevealed(false); };

  return (
    <div
      ref={wrapRef}
      className="relative h-[calc(100svh-44px)] min-h-[560px] cursor-none touch-none select-none overflow-hidden bg-[#2a070c] text-[#f2ede3]"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => { setHover(false); setDown(false); last.current = null; }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        last.current = null;
        paintTo(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        cx.set(e.clientX);
        cy.set(e.clientY);
        if (down) paintTo(e.clientX, e.clientY);
      }}
      onPointerUp={() => { setDown(false); last.current = null; }}
    >
      <div ref={hostRef} aria-hidden className="absolute inset-0" />
      <h1 className="sr-only">{t.revealTitle}</h1>

      {/* Cursor propio, como el de la referencia */}
      <motion.div
        aria-hidden
        style={{ x: sx, y: sy }}
        animate={{ scale: down ? 0.55 : 1, opacity: hover ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="pointer-events-none fixed left-0 top-0 z-30 -ml-9 -mt-9 hidden size-[72px] place-items-center rounded-full bg-[#f2ede3] text-center text-[10px] font-bold leading-tight text-[#121010] [@media(pointer:fine)]:grid"
      >
        <span className={down ? "opacity-0" : ""}>{t.cursor[0]}<br />{t.cursor[1]}</span>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-5 sm:flex-row sm:justify-between sm:p-8">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <span key="empty" />
          ) : (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto max-w-md border-[1.5px] border-[#121010] bg-[#f2ede3] p-5 text-[#121010] shadow-[5px_5px_0_#121010]"
            >
              <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Archivo Variable', sans-serif", fontStretch: "125%" }}>
                {t.revealTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed">{t.revealBody}</p>
              <a href="#" onClick={(e) => e.preventDefault()} className="mt-4 inline-block bg-[#121010] px-4 py-2.5 text-sm font-semibold text-[#f2ede3] hover:bg-[#dc2a1c]">
                {t.revealCta}
              </a>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="pointer-events-auto flex gap-2">
          <button onClick={autoPaint} className="cursor-pointer rounded-full bg-[#f2ede3] px-4 py-2.5 text-sm font-semibold text-[#121010] hover:bg-white">
            {t.auto}
          </button>
          <button onClick={clear} className="cursor-pointer rounded-full border border-[#f2ede3]/60 bg-[#121010]/70 px-4 py-2.5 text-sm font-semibold backdrop-blur hover:border-[#f2ede3]">
            {t.clear}
          </button>
        </div>
      </div>

      {noGL && <p role="status" className="absolute inset-x-4 top-1/2 z-30 mx-auto max-w-md text-center">{t.noGL}</p>}
    </div>
  );
}
