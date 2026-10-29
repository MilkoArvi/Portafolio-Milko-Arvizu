"use client";

import "@fontsource-variable/bodoni-moda/opsz.css";
import { motion, useScroll, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createProgram, fitCanvas, fullscreenTriangle, getGL, loop, mountCanvas, prefersReducedMotion, releaseCanvas, VERT } from "@/lib/gl";
import type { Locale } from "@/config/site";
import { AGAVE_FRAG } from "./shader";

// Concepto ficticio: tequila añejo de Los Altos de Jalisco contado como cómic.
// Un solo canvas fijo dibuja todas las viñetas: cada una es un recorte (scissor)
// del mismo contexto WebGL, así el navegador no abre seis contextos.

const C = { paper: "#f2ede3", ink: "#121010", red: "#dc2a1c", agave: "#3cb7b0" };

const COPY = {
  es: {
    place: "Los Altos de Jalisco",
    title: ["Agave", "Negro"],
    kicker: "Tequila añejo de altura",
    c0: "Aquí el sol tarda siete años en hacer una botella.",
    c1: "Primero, la planta. Un agave azul crece siete años antes de dar su corazón.",
    c2: "El jimador corta las pencas a mano. Lo que queda es la piña: hasta 60 kilos de azúcar.",
    c3: "Tres días en horno de piedra. Fuego lento, como lo hacía mi abuelo.",
    c4: "Luego, silencio. Dos años en barrica de roble, a 2,100 metros sobre el mar.",
    quote: "No se apura lo que tardó siete años.",
    c5: "Agave Negro Añejo. 750 ml, 40 % Alc. Vol.",
    cta: "Encontrar una botella",
    credit: "Todo el arte de esta página está dibujado con código, en tiempo real. No hay una sola imagen.",
    noGL: "Tu navegador no puede mostrar las ilustraciones en tiempo real. Prueba en Chrome, Safari o Firefox actualizados.",
  },
  en: {
    place: "The Highlands of Jalisco",
    title: ["Agave", "Negro"],
    kicker: "Highland extra-aged tequila",
    c0: "Out here, the sun takes seven years to make a bottle.",
    c1: "First, the plant. A blue agave grows for seven years before it gives up its heart.",
    c2: "The jimador cuts the leaves by hand. What's left is the piña: up to 60 kilos of sugar.",
    c3: "Three days in a stone oven. A slow fire, the way my grandfather did it.",
    c4: "Then, silence. Two years in oak barrels, 2,100 meters above the sea.",
    quote: "You don't rush what took seven years.",
    c5: "Agave Negro Añejo. 750 ml, 40% ABV.",
    cta: "Find a bottle",
    credit: "Every illustration on this page is drawn with code, in real time. There isn't a single image.",
    noGL: "Your browser can't render the real-time illustrations. Try an up-to-date Chrome, Safari or Firefox.",
  },
};

function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    // El contenedor se observa sin recorte; el recorte va en el hijo
    // (un elemento recortado al 100 % nunca cuenta como visible).
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.8 }} className={`absolute z-10 ${className}`}>
      <motion.p
        variants={{ hidden: { clipPath: "inset(-10% 100% -30% 0%)" }, show: { clipPath: "inset(-10% -10% -30% 0%)" } }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: 0.5 }}
        className="max-w-[30ch] border-[1.5px] border-[#121010] bg-[#f2ede3] px-3.5 py-2.5 text-[0.82rem] leading-snug text-[#121010] shadow-[4px_4px_0_#121010] sm:text-[0.9rem]"
      >
        {children}
      </motion.p>
    </motion.div>
  );
}

function Panel({ scene, className = "", children }: { scene: number; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`relative border-[5px] border-[#121010] ${className}`}>
      <div data-scene={scene} className="absolute inset-0" style={{ background: scene === 2 || scene === 4 ? C.paper : C.red }} />
      {children}
    </div>
  );
}

export function AgaveNegro({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [noGL, setNoGL] = useState(false);
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });

  useEffect(() => {
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) return;
    const canvas = mountCanvas(host, "block h-full w-full");
    const gl = getGL(canvas);
    if (!gl) { releaseCanvas(canvas, null); setNoGL(true); return; }
    let prog: ReturnType<typeof createProgram>;
    try {
      prog = createProgram(gl, VERT, AGAVE_FRAG);
    } catch (e) {
      console.error(e);
      releaseCanvas(canvas, gl);
      setNoGL(true);
      return;
    }
    const draw = fullscreenTriangle(gl);
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    const reduce = prefersReducedMotion();
    const enterAt = new Map<HTMLElement, number>();
    const mouse = { x: -1, y: -1 };
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("pointermove", onMove, { passive: true });
    root.classList.add("gl-on");

    const stop = loop((time) => {
      fitCanvas(canvas, 1.5);
      const dpr = canvas.width / canvas.clientWidth;
      const vh = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      gl.useProgram(prog.prog);
      gl.uniform1f(prog.u.u_time, reduce ? 4.0 : time);
      gl.uniform1f(prog.u.u_dpr, dpr);
      gl.uniform1f(prog.u.u_motion, reduce ? 0 : 1);
      for (const el of panels) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.width < 2) continue;
        const visible = (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height;
        if (!enterAt.has(el) && visible > 0.3) enterAt.set(el, time);
        const started = enterAt.get(el);
        const enter = reduce ? (started !== undefined ? 1 : 0) : started === undefined ? 0 : Math.min(1, (time - started) / 1.8);
        const x = Math.round(r.left * dpr);
        const y = Math.round((vh - r.bottom) * dpr);
        const w = Math.round(r.width * dpr);
        const h = Math.round(r.height * dpr);
        gl.viewport(x, y, w, h);
        gl.scissor(Math.max(0, x), Math.max(0, y), w, h);
        gl.uniform2f(prog.u.u_res, w, h);
        gl.uniform2f(prog.u.u_origin, x, y);
        gl.uniform1f(prog.u.u_enter, enter);
        gl.uniform1f(prog.u.u_prog, Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height))));
        gl.uniform2f(prog.u.u_mouse, mouse.x < 0 ? 0.5 : (mouse.x - r.left) / r.width, mouse.y < 0 ? 0.5 : 1 - (mouse.y - r.top) / r.height);
        gl.uniform1i(prog.u.u_scene, Number(el.dataset.scene));
        draw();
      }
    });
    return () => {
      stop();
      window.removeEventListener("pointermove", onMove);
      root.classList.remove("gl-on");
      releaseCanvas(canvas, gl);
    };
  }, []);

  const serif = { fontFamily: "'Bodoni Moda Variable', serif" };

  return (
    <div ref={rootRef} className="relative" style={{ background: C.paper, color: C.ink }}>
      <motion.div aria-hidden style={{ scaleX: bar, background: C.red }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left" />
      <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-[1]" />

      <div className="relative z-[2] mx-auto flex max-w-[1500px] flex-col gap-3.5 p-3.5 sm:gap-4 sm:p-5">
        {/* Portada */}
        <Panel scene={0} className="h-[88svh] min-h-[520px] overflow-hidden">
          <div className="absolute left-5 top-5 z-10 sm:left-10 sm:top-9">
            <p className="text-sm text-[#f2ede3]/85 sm:text-base">{t.place}</p>
            <h1 className="mt-2 leading-[0.82] text-[#f2ede3]" style={{ ...serif, fontSize: "clamp(4rem, 12vw, 12rem)", fontWeight: 600, fontVariationSettings: "'opsz' 96" }}>
              {t.title.map((w, i) => (
                <span key={w} className="block overflow-hidden pb-[0.06em]">
                  <motion.span
                    className="block"
                    initial={{ y: "105%" }}
                    animate={{ y: "0%" }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.5 + i * 0.14 }}
                  >
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.8 }} className="mt-4 text-[#f2ede3] sm:text-lg" style={serif}>
              {t.kicker}
            </motion.p>
          </div>
          <Caption className="bottom-5 right-5 sm:bottom-8 sm:right-8">{t.c0}</Caption>
        </Panel>

        {/* Página 2 */}
        <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-12">
          <Panel scene={1} className="h-[78svh] min-h-[480px] lg:col-span-5 lg:h-[92svh]">
            <Caption className="left-4 top-4">{t.c1}</Caption>
          </Panel>
          <div className="grid gap-3.5 sm:gap-4 lg:col-span-7">
            <Panel scene={2} className="h-[52svh] min-h-[340px] lg:h-auto">
              <Caption className="right-4 top-4">{t.c2}</Caption>
            </Panel>
            <Panel scene={3} className="h-[52svh] min-h-[340px] lg:h-auto">
              <Caption className="bottom-4 left-4">{t.c3}</Caption>
            </Panel>
          </div>
        </div>

        {/* Página 3 */}
        <Panel scene={4} className="h-[60svh] min-h-[360px]">
          <Caption className="left-4 top-4">{t.c4}</Caption>
        </Panel>

        <div className="grid gap-3.5 sm:gap-4 lg:grid-cols-12">
          <div className="flex min-h-[44svh] items-end border-[5px] border-[#121010] p-6 sm:p-10 lg:col-span-5" style={{ background: C.ink }}>
            <motion.blockquote
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="leading-[0.98] text-[#f2ede3]"
              style={{ ...serif, fontSize: "clamp(2.4rem, 5vw, 4.6rem)", fontStyle: "italic", fontWeight: 500 }}
            >
              {t.quote}
            </motion.blockquote>
          </div>
          <Panel scene={5} className="h-[90svh] min-h-[520px] lg:col-span-7">
            <Caption className="left-4 top-4">{t.c5}</Caption>
            <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center">
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="border-[1.5px] border-[#121010] bg-[#f2ede3] px-6 py-3 font-semibold text-[#121010] shadow-[4px_4px_0_#121010] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#121010]"
              >
                {t.cta}
              </a>
            </div>
          </Panel>
        </div>

        <p className="mx-auto max-w-[56ch] py-14 text-center text-base leading-relaxed sm:text-lg" style={serif}>
          {t.credit}
        </p>
        {noGL && (
          <p role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg border-[1.5px] border-[#121010] bg-[#f2ede3] p-4 text-sm shadow-[4px_4px_0_#121010]">
            {t.noGL}
          </p>
        )}
      </div>
    </div>
  );
}
