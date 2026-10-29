"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/config/site";
import type { PunkScene } from "./scene";

// Punk Cowboy, forajido en desarrollo. El scroll recorre el proceso del juego
// y al final la cámara se planta frente a la cerca para un duelo contra seis botellas.

const COPY = {
  es: {
    chapters: [
  { kicker: "Prototipo", title: "Primero, todo en gris", body: "En Punk Cowboy nada recibe arte hasta que se siente bien en gris: distancias, alturas y tiempos de disparo. Esta escena arranca igual, en cajas." },
  { kicker: "Arte", title: "Después llega el color", body: "Con la mecánica probada entra el equipo de arte. Mi trabajo ahí es que escenas y prefabs estén tan ordenados que nadie pise el trabajo de nadie." },
  { kicker: "Luz", title: "Al atardecer, todo se pone serio", body: "Neón, polvo en el aire y un sol que ya se va. Con la luz el pueblo deja de ser maqueta y empieza a parecer peligroso." },
  { kicker: "Duelo", title: "Seis botellas, un revólver", body: "Tu mejor tiempo se queda guardado en este navegador." },
    ],
    pops: ["¡PUM!", "¡BANG!", "¡CRASH!", "¡ZAS!", "¡PLAF!"],
    miss: "fallaste",
    title: "Punk Cowboy, forajido en desarrollo",
    aria: "Pueblo del oeste de Punk Cowboy hecho en 3D",
    credit: "Escena original para este portafolio, hecha con Three.js. El juego se desarrolla en Unity.",
    left: (n: number) => `${n} botellas restantes`,
    won: "DUELO GANADO",
    record: "Nuevo récord en este navegador.",
    best: (s: string) => `Tu mejor tiempo: ${s} s`,
    again: "Otra ronda",
    noGL: "Tu navegador no puede mostrar la escena en 3D.",
  },
  en: {
    chapters: [
  { kicker: "Prototype", title: "First, everything in gray", body: "In Punk Cowboy nothing gets art until it feels right in gray: distances, heights and shot timing. This scene starts the same way, in boxes." },
  { kicker: "Art", title: "Then the color arrives", body: "With the mechanic proven, the art team comes in. My job there is keeping scenes and prefabs so tidy that nobody steps on anybody's work." },
  { kicker: "Light", title: "At sunset, things get serious", body: "Neon, dust in the air and a sun on its way out. With light, the town stops being a model and starts to look dangerous." },
  { kicker: "Duel", title: "Six bottles, one revolver", body: "Your best time stays saved in this browser." },
    ],
    pops: ["BANG!", "POW!", "CRASH!", "ZAP!", "SPLAT!"],
    miss: "missed",
    title: "Punk Cowboy, outlaw in development",
    aria: "Punk Cowboy's western town made in 3D",
    credit: "An original scene for this portfolio, made with Three.js. The game itself is built in Unity.",
    left: (n: number) => `${n} bottles left`,
    won: "DUEL WON",
    record: "New record in this browser.",
    best: (s: string) => `Your best time: ${s} s`,
    again: "Another round",
    noGL: "Your browser can't display the 3D scene.",
  },
};
const BEST_KEY = "punk-cowboy-mejor";

type Pop = { id: number; x: number; y: number; text: string; miss?: boolean };

export function PunkCowboy({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const CHAPTERS = t.chapters;
  const tRef = useRef(t);
  tRef.current = t;
  const wrap = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const sceneRef = useRef<PunkScene | null>(null);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [left, setLeft] = useState(6);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [now, setNow] = useState(0);
  const startRef = useRef<number | null>(null);
  const popId = useRef(0);

  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progress.current = v;
    setChapter(Math.min(3, Math.floor(v * 4 * 0.999)));
  });
  const playing = chapter === 3;

  useEffect(() => {
    try { const b = Number(localStorage.getItem(BEST_KEY)); if (b > 0) setBest(b); } catch { /* sin almacenamiento */ }
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let disposed = false;
    const test = document.createElement("canvas");
    if (!test.getContext("webgl2")) { setFallback(true); return; }
    const pop = (x: number, y: number, miss = false) => {
      const id = ++popId.current;
      const text = miss ? tRef.current.miss : tRef.current.pops[id % tRef.current.pops.length];
      setPops((ps) => [...ps.slice(-5), { id, x, y, text, miss }]);
      window.setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== id)), 900);
    };
    import("./scene")
      .then(({ createPunkScene }) =>
        createPunkScene({
          host: el,
          progress: () => progress.current,
          onHit: (x, y, remaining) => {
            if (startRef.current === null) { startRef.current = performance.now(); setStartedAt(startRef.current); }
            pop(x, y);
            setLeft(remaining);
            if (remaining === 0 && startRef.current !== null) {
              const t = (performance.now() - startRef.current) / 1000;
              setTime(t);
              setBest((b) => {
                const nb = b === null ? t : Math.min(b, t);
                try { localStorage.setItem(BEST_KEY, String(nb)); } catch { /* sin almacenamiento */ }
                return nb;
              });
            }
          },
          onMiss: (x, y) => {
            if (startRef.current === null) { startRef.current = performance.now(); setStartedAt(startRef.current); }
            pop(x, y, true);
          },
        }),
      )
      .then((s) => {
        if (disposed) { s.dispose(); return; }
        sceneRef.current = s;
        setReady(true);
      })
      .catch((e) => { console.error(e); if (!disposed) setFallback(true); });
    return () => { disposed = true; sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setActive(playing && time === null); }, [playing, ready, time]);

  // reloj del duelo
  useEffect(() => {
    if (startedAt === null || time !== null) return;
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startedAt, time]);

  const again = () => {
    sceneRef.current?.reset();
    startRef.current = null;
    setStartedAt(null);
    setTime(null);
    setLeft(6);
  };

  const elapsed = time ?? (startedAt !== null ? (now - startedAt) / 1000 : 0);
  const c = CHAPTERS[chapter];

  return (
    <div ref={wrap} className="relative h-[560vh] bg-[#130b18] text-[#fff3e6]">
      <div className="sticky top-11 h-[calc(100svh-44px)] overflow-hidden">
        <h1 className="sr-only">{t.title}</h1>
        <div ref={holder} role="img" aria-label={t.aria} className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`} />
        {!ready && !fallback && (
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="size-10 rounded-full border-2 border-[#ffb36b]/20 border-t-[#ffb36b] motion-safe:animate-[speedspin_0.9s_linear_infinite]" />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgba(10,4,14,0.55)_100%)]" />

        {/* Capítulo */}
        <div className="pointer-events-none absolute inset-x-4 bottom-6 sm:inset-x-auto sm:bottom-auto sm:left-10 sm:top-12 sm:w-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={chapter}
              initial={{ opacity: 0, x: -40, skewX: -10 }}
              animate={{ opacity: 1, x: 0, skewX: 0 }}
              exit={{ opacity: 0, x: 30, skewX: 8, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="rounded-2xl border border-white/10 bg-[#1a0f22]/70 p-5 backdrop-blur-md"
            >
              <p className="font-mono text-xs tracking-[0.25em] text-[#ffb36b]">{c.kicker.toUpperCase()}</p>
              <h2 className="mt-2 font-display text-[clamp(1.6rem,2.6vw,2.3rem)] font-semibold leading-[1.02] tracking-[-0.02em]">{c.title}</h2>
              <p className="mt-3 leading-relaxed text-white/70">{c.body}</p>
              {chapter < 3 && <p className="mt-4 text-xs text-white/40">{t.credit}</p>}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Marcador del duelo */}
        <AnimatePresence>
          {playing && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="absolute right-20 top-5 flex items-center gap-4 rounded-2xl border-[2.5px] border-[#120a14] bg-[#ffe9c9] px-4 py-2.5 font-display text-[#120a14] shadow-[5px_5px_0_#ff4fa3] sm:right-24 sm:top-8"
            >
              <span aria-label={t.left(left)} className="flex gap-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <motion.span key={i} animate={{ scale: i < left ? 1 : 0.6, opacity: i < left ? 1 : 0.25 }} className="h-5 w-2 rounded-t-full bg-[#2f8f4f]" />
                ))}
              </span>
              <span className="font-mono text-lg tabular-nums">{elapsed.toFixed(2)} s</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {playing && time !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              className="absolute left-1/2 top-1/2 w-[min(360px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-[3px] border-[#120a14] bg-[#ffe9c9] p-6 text-center text-[#120a14] shadow-[8px_8px_0_#46e6ff]"
            >
              <p className="font-mono text-xs tracking-[0.3em]">{t.won}</p>
              <p className="mt-2 font-display text-6xl font-black italic tabular-nums">{time.toFixed(2)}<span className="text-2xl"> s</span></p>
              {best !== null && <p className="mt-1 text-sm">{best >= time - 1e-6 ? t.record : t.best(best.toFixed(2))}</p>}
              <button type="button" onClick={again} className="mt-5 rounded-full bg-[#120a14] px-6 py-3 font-semibold text-[#ffe9c9] transition-transform hover:-translate-y-0.5 active:translate-y-0.5">
                {t.again}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onomatopeyas de cómic en cada disparo */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <AnimatePresence>
            {pops.map((p) => (
              <motion.span
                key={p.id}
                className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap font-display font-black italic ${p.miss ? "text-lg text-white/70" : "text-4xl text-[#ffe14f] sm:text-5xl"}`}
                style={{ left: p.x, top: p.y, WebkitTextStroke: p.miss ? undefined : "2px #120a14", textShadow: p.miss ? undefined : "4px 4px 0 #ff4fa3" }}
                initial={{ scale: 0.3, rotate: -14, opacity: 0, y: 0 }}
                animate={{ scale: [0.3, 1.25, 1], rotate: [-14, 6, -4], opacity: 1, y: -30 }}
                exit={{ opacity: 0, scale: 1.4, y: -50, transition: { duration: 0.25 } }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        {fallback && <p role="status" className="absolute inset-x-4 top-1/2 text-center">{t.noGL}</p>}
      </div>
    </div>
  );
}
