"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/config/site";

// Bajo el vidrio templado: mi PC real, armada pieza por pieza con el scroll.
// La escena vive en scene.ts; aquí solo está la interfaz que la acompaña.

const COPY = {
  es: {
    title: "Bajo el vidrio templado: mi PC armada pieza por pieza",
    aria: "Modelo 3D de la PC de Milko armándose pieza por pieza",
    noGL: "Tu navegador no puede mostrar el modelo 3D.",
    stages: [
  { name: "Gabinete", spec: "Gabinete ATX con panel lateral de vidrio templado." },
  { name: "Tarjeta madre", spec: "Socket AM5, la base donde se conecta todo." },
  { name: "Procesador", spec: "AMD Ryzen 5 7600: 6 núcleos y 12 hilos bajo un IHS de níquel con las muescas de AM5." },
  { name: "Disipador", spec: "Aletas radiales y un ventilador encima: mantiene al procesador fresco mientras compila." },
  { name: "Memoria", spec: "8 GB de RAM DDR5." },
  { name: "Tarjeta gráfica", spec: "NVIDIA GeForce RTX 3060 con 12 GB de VRAM." },
  { name: "Fuente de poder", spec: "Alimenta todo desde la cámara inferior; los cables suben por detrás de la placa." },
  { name: "Ventiladores y vidrio", spec: "El aire fresco entra por el frente y sale por atrás. Se cierra el vidrio." },
  { name: "Encendido", spec: "Barrido de luz y ventiladores a toda velocidad. Lista para programar, renderizar y jugar." },
    ],
  },
  en: {
    title: "Under tempered glass: my PC, built piece by piece",
    aria: "3D model of Milko's PC assembling piece by piece",
    noGL: "Your browser can't display the 3D model.",
    stages: [
  { name: "Case", spec: "ATX case with a tempered glass side panel." },
  { name: "Motherboard", spec: "AM5 socket, the base everything plugs into." },
  { name: "Processor", spec: "AMD Ryzen 5 7600: 6 cores and 12 threads under a nickel IHS with the AM5 notches." },
  { name: "Cooler", spec: "Radial fins and a fan on top: keeps the processor cool while it compiles." },
  { name: "Memory", spec: "8 GB of DDR5 RAM." },
  { name: "Graphics card", spec: "NVIDIA GeForce RTX 3060 with 12 GB of VRAM." },
  { name: "Power supply", spec: "Feeds everything from the bottom chamber; the cables run up behind the board." },
  { name: "Fans and glass", spec: "Cool air comes in the front and leaves out the back. The glass closes." },
  { name: "Power on", spec: "A sweep of light and fans at full speed. Ready to code, render and play." },
    ],
  },
};
const N = COPY.es.stages.length;

export function PcBuild({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const STAGES = t.stages;
  const wrap = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progress.current = v;
    setStage(Math.min(N - 1, Math.max(0, Math.floor(v * N * 0.999))));
  });

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let disposed = false;
    let dispose = () => {};
    const test = document.createElement("canvas");
    if (!test.getContext("webgl2")) { setFallback(true); return; }

    import("./scene")
      .then(({ createPcScene }) =>
        createPcScene({
          host: el,
          progress: () => progress.current,
          stages: N,
          wide: () => window.matchMedia("(min-width: 768px)").matches,
        }),
      )
      .then((s) => {
        if (disposed) { s.dispose(); return; }
        dispose = s.dispose;
        setReady(true);
      })
      .catch((e) => { console.error(e); if (!disposed) setFallback(true); });

    return () => { disposed = true; dispose(); };
  }, []);

  const on = stage === N - 1;

  return (
    <div ref={wrap} className="relative bg-[#060807] text-bone" style={{ height: `${N * 70 + 100}vh` }}>
      <div className="sticky top-11 h-[calc(100svh-44px)] overflow-hidden">
        <h1 className="sr-only">{t.title}</h1>
        <div ref={holder} role="img" aria-label={t.aria} className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`} />
        {!ready && !fallback && (
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="size-10 rounded-full border-2 border-mint/20 border-t-mint motion-safe:animate-[speedspin_0.9s_linear_infinite]" />
          </div>
        )}

        {/* Lista de piezas */}
        <ol className="pointer-events-none absolute left-8 top-10 hidden space-y-1.5 md:block">
          {STAGES.map((s, i) => (
            <li key={s.name} className={`flex items-center gap-3 text-sm transition-colors duration-500 ${i === stage ? "text-bone" : i < stage ? "text-bone/50" : "text-bone/25"}`}>
              <motion.span
                animate={i === stage ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
                className={`grid size-5 place-items-center rounded-full border font-mono text-[0.6rem] ${i <= stage ? "border-mint bg-mint/15 text-mint" : "border-bone/20"}`}
              >
                {i < stage ? "✓" : i + 1}
              </motion.span>
              {s.name}
            </li>
          ))}
        </ol>

        <div className="absolute inset-x-4 bottom-5 sm:inset-x-auto sm:bottom-10 sm:right-24 sm:w-[340px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 18, skewY: 2 }}
              animate={{ opacity: 1, y: 0, skewY: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={`rounded-2xl border bg-[#0a0d0b]/75 p-5 backdrop-blur-md ${on ? "border-mint/50 shadow-[0_0_60px_-20px_#8fcfa5]" : "border-bone/10"}`}
            >
              <p className="font-mono text-xs text-mint">{String(stage + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}</p>
              <p className="mt-1 font-display text-2xl font-medium">{STAGES[stage].name}</p>
              <p className="mt-2 leading-relaxed text-bone/70">{STAGES[stage].spec}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        {fallback && <p role="status" className="absolute inset-x-4 top-1/2 text-center">{t.noGL}</p>}
      </div>
    </div>
  );
}
