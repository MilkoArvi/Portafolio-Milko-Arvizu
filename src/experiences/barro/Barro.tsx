"use client";

import "@fontsource-variable/fraunces";

import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createProgram, fitCanvas, fullscreenTriangle, getGL, loop, mountCanvas, prefersReducedMotion, releaseCanvas, VERT } from "@/lib/gl";
import type { Locale } from "@/config/site";
import { BARRO_FRAG } from "./shader";

// Concepto ficticio: taller de barro bruñido de Tonalá que lanza una pieza única.
// La interacción: mantener presionado "hornea" la pieza y derrite la cortina.

const HOLD_SECONDS = 2.4;

const COPY = {
  es: {
    brand: "Taller Cuatro Vientos, Tonalá",
    title: "Una pieza al mes. Esta es la de noviembre.",
    hold: "Mantén",
    holdHint: "Mantén presionado para hornear la pieza",
    skip: "Mostrar sin mantener",
    done: "Lista",
    name: "Cántaro No. 07",
    specs: [
      ["Técnica", "Barro bruñido a mano con piedra de río"],
      ["Medidas", "38 cm de alto, 24 cm de diámetro"],
      ["Horneado", "Leña, 900 °C, 11 horas"],
    ],
    price: "$6,800 MXN, una sola pieza",
    cta: "Apartar por WhatsApp",
    again: "Hornear otra vez",
    noGL: "Tu navegador no puede mostrar la pieza en tiempo real.",
  },
  en: {
    brand: "Taller Cuatro Vientos, Tonalá",
    title: "One piece a month. This is November's.",
    hold: "Hold",
    holdHint: "Press and hold to fire the piece",
    skip: "Show it without holding",
    done: "Ready",
    name: "Cántaro No. 07",
    specs: [
      ["Technique", "Hand-burnished with a river stone"],
      ["Size", "38 cm tall, 24 cm wide"],
      ["Firing", "Wood kiln, 900 °C, 11 hours"],
    ],
    price: "$6,800 MXN, one of one",
    cta: "Reserve on WhatsApp",
    again: "Fire it again",
    noGL: "Your browser can't render the piece in real time.",
  },
};

export function Barro({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const hostRef = useRef<HTMLDivElement>(null);
  const holding = useRef(false);
  const state = useRef({ hold: 0, done: 0, finished: false });
  const progress = useMotionValue(0);
  const dash = useTransform(progress, (v) => 289 * (1 - v));
  const titleFade = useTransform(progress, [0, 0.45], [1, 0]);
  const [finished, setFinished] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = mountCanvas(host);
    const gl = getGL(canvas, { alpha: false });
    if (!gl) { releaseCanvas(canvas, null); setNoGL(true); return; }
    let prog: ReturnType<typeof createProgram>;
    try { prog = createProgram(gl, VERT, BARRO_FRAG); } catch (e) { console.error(e); releaseCanvas(canvas, gl); setNoGL(true); return; }
    const draw = fullscreenTriangle(gl);
    const reduce = prefersReducedMotion();
    const mouse = { x: 0.5, y: 0.5 };
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX / window.innerWidth; mouse.y = 1 - e.clientY / window.innerHeight; };
    window.addEventListener("pointermove", onMove, { passive: true });
    let smooth = 0;
    let prev = 0;

    const stop = loop((time, capped) => {
      // el progreso usa el tiempo real, para que en equipos lentos dure lo mismo
      const dt = prev ? Math.min(0.25, time - prev) : capped;
      prev = time;
      const s = state.current;
      if (!s.finished) {
        s.hold = holding.current ? s.hold + dt / HOLD_SECONDS : Math.max(0, s.hold - dt / 0.8);
        if (s.hold >= 1) {
          s.hold = 1;
          s.finished = true;
          holding.current = false;
          setPressed(false);
          setFinished(true);
          navigator.vibrate?.(30);
        }
      } else {
        s.done = Math.min(1, s.done + dt / 2.2);
      }
      smooth += (s.hold - smooth) * Math.min(1, dt * 10);
      progress.set(s.hold);
      fitCanvas(canvas, 1.75);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog.prog);
      gl.uniform2f(prog.u.u_res, canvas.width, canvas.height);
      gl.uniform1f(prog.u.u_time, time);
      gl.uniform1f(prog.u.u_hold, smooth);
      gl.uniform1f(prog.u.u_done, s.done);
      gl.uniform1f(prog.u.u_dpr, canvas.width / canvas.clientWidth);
      gl.uniform1f(prog.u.u_motion, reduce ? 0 : 1);
      gl.uniform2f(prog.u.u_mouse, mouse.x, mouse.y);
      draw();
    });
    return () => { stop(); window.removeEventListener("pointermove", onMove); releaseCanvas(canvas, gl); };
  }, [progress]);

  const start = () => { if (!state.current.finished) { holding.current = true; setPressed(true); } };
  const end = () => { holding.current = false; setPressed(false); };
  const reset = () => { state.current = { hold: 0, done: 0, finished: false }; setFinished(false); };
  const skip = () => { state.current = { hold: 1, done: 0, finished: true }; setFinished(true); };

  const display = { fontFamily: "'Fraunces Variable', serif" };

  return (
    <div className="relative h-[calc(100svh-44px)] min-h-[560px] overflow-hidden bg-[#121010] text-[#f2ede3]">
      <div ref={hostRef} aria-hidden className="absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-5 mix-blend-difference sm:p-8">
        <p className="text-sm sm:text-base">{t.brand}</p>
        <AnimatePresence>
          {finished && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hidden text-sm sm:block sm:text-base">
              {t.price}
            </motion.p>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence mode="wait">
        {!finished ? (
          <motion.div
            key="intro"
            exit={{ opacity: 0, y: -16, transition: { duration: 0.4 } }}
            style={{ opacity: titleFade }}
            className="absolute inset-x-0 top-[16%] z-10 px-5 text-center"
          >
            <h1 className="mx-auto max-w-[14ch] leading-[0.95]" style={{ ...display, fontSize: "clamp(2.6rem, 7vw, 6.2rem)", fontWeight: 400, fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}>
              {t.title}
            </h1>
          </motion.div>
        ) : (
          <motion.div
            key="piece"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.9 } } }}
            className="absolute bottom-0 left-0 z-10 w-full bg-gradient-to-t from-[#f2ede3] via-[#f2ede3]/95 to-transparent p-5 pt-10 text-[#121010] sm:bottom-auto sm:left-8 sm:top-1/2 sm:w-[min(360px,32vw)] sm:-translate-y-1/2 sm:bg-none sm:p-0"
          >
            <motion.h2
              variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
              className="leading-[0.95]"
              style={{ ...display, fontSize: "clamp(2.4rem, 4.6vw, 4.4rem)", fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}
            >
              {t.name}
            </motion.h2>
            <motion.p variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} className="mt-2 text-sm sm:hidden">
              {t.price}
            </motion.p>
            <motion.dl variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} className="mt-5 hidden space-y-2.5 text-sm sm:block">
              {t.specs.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-[#121010]/25 pt-2.5">
                  <dt className="text-[#121010]/60">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </motion.dl>
            <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} className="mt-6 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/523300000000?text=${encodeURIComponent(`Hola, quiero apartar el ${t.name}.`)}`}
                target="_blank"
                rel="noopener"
                className="rounded-full bg-[#121010] px-5 py-3 text-sm font-semibold text-[#f2ede3] hover:bg-[#dc2a1c]"
              >
                {t.cta}
              </a>
              <button onClick={reset} className="rounded-full border border-[#121010] px-5 py-3 text-sm font-semibold hover:bg-[#121010]/5">
                {t.again}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón de mantener */}
      <AnimatePresence>
        {!finished && (
          <motion.div
            key="hold"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.4 } }}
            exit={{ opacity: 0, scale: 1.4, transition: { duration: 0.35 } }}
            className="absolute bottom-[12%] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-4"
          >
            <motion.button
              type="button"
              aria-label={t.holdHint}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start(); }}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
              onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") end(); }}
              onContextMenu={(e) => e.preventDefault()}
              animate={{ scale: pressed ? 0.9 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="relative grid size-24 touch-none select-none place-items-center rounded-full bg-[#f2ede3] text-sm font-semibold text-[#121010]"
            >
              <svg aria-hidden viewBox="0 0 100 100" className="absolute -inset-2 size-[calc(100%+16px)] -rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#f2ede3" strokeOpacity="0.25" strokeWidth="2" />
                <motion.circle cx="50" cy="50" r="46" fill="none" stroke="#dc2a1c" strokeWidth="3" strokeLinecap="round" strokeDasharray="289" style={{ strokeDashoffset: dash }} />
              </svg>
              {t.hold}
            </motion.button>
            <button onClick={skip} className="text-xs text-[#f2ede3]/60 underline underline-offset-4 hover:text-[#f2ede3]">
              {t.skip}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {noGL && <p role="status" className="absolute inset-x-4 top-1/2 z-30 mx-auto max-w-md text-center">{t.noGL}</p>}
    </div>
  );
}
