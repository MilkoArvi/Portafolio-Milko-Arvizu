"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { profile, socials, type Social } from "@/data/profile";
import { LocalTime } from "./Chrome";
import { SOCIAL_ICON } from "./Icons";

// Contacto, el final del recorrido. Llegas y hay una pared de bloques que dice HOLA en pixel art;
// se abre desde la costura del centro hacia los lados, como un telón, bloque por bloque.
// Detrás están el correo y las redes, cada una en un bloque que se levanta al pasar y se hunde al picarle.

const GLYPHS: Record<string, string[]> = {
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
};
const BASE = ["#131814", "#161d18", "#1b221d", "#111512", "#18201a"];
const INK = ["#8fcfa5", "#86c79c", "#9ad6ae"];

const BRICK: Record<Social["id"], { bg: string; side: string; ink: string; glow: string }> = {
  email: { bg: "#8fcfa5", side: "#3f7d57", ink: "#0b0e0c", glow: "#b3e4c3" },
  linkedin: { bg: "#0a66c2", side: "#06427e", ink: "#ffffff", glow: "#2a82dc" },
  github: { bg: "#eef1ea", side: "#9ba59c", ink: "#0b0e0c", glow: "#ffffff" },
  instagram: { bg: "#d93a74", side: "#8f1d47", ink: "#ffffff", glow: "#ef5f93" },
};

// Azar repetible: el mismo bloque sale del mismo color en el servidor y en el navegador.
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const steps = (n: number) => (t: number) => Math.min(1, Math.ceil(t * n - 1e-6) / n);
const PIX = Array.from({ length: 40 }, (_, i) => Math.round(hash(i, 7) * 260));
const BURST = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + hash(i, 3) * 0.4;
  const d = 34 + hash(i, 9) * 34;
  return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d), c: ["#8fcfa5", "#eef1ea", "#d93a74", "#0a66c2"][i % 4] };
});

type Phase = "wall" | "open" | "build";

function useGrid(host: RefObject<HTMLElement | null>) {
  const [g, setG] = useState<{ cols: number; rows: number; size: number; view: number } | null>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const size = Math.round(Math.min(52, Math.max(26, w / 30)));
      const rows = Math.ceil(h / size);
      setG((o) => (o && o.size === size && o.rows === rows && o.cols === Math.ceil(w / size) ? o : { cols: Math.ceil(w / size), rows, size, view: Math.min(rows, Math.floor(window.innerHeight / size)) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [host]);
  return g;
}

function Mosaic({ host, phase }: { host: RefObject<HTMLElement | null>; phase: Phase }) {
  const g = useGrid(host);
  const tiles = useMemo(() => {
    if (!g) return [];
    const { cols, rows, view } = g;
    // HOLA en una línea si cabe; en pantallas angostas, HO arriba y LA abajo
    const lines = cols >= 27 ? ["HOLA"] : ["HO", "LA"];
    const lit = new Set<string>();
    const top = Math.max(1, Math.floor(view / 2 - (lines.length * 8 - 1) / 2));
    lines.forEach((line, li) => {
      const left = Math.floor((cols - (line.length * 6 - 1)) / 2);
      [...line].forEach((ch, ci) => GLYPHS[ch].forEach((row, ry) => [...row].forEach((b, rx) => {
        if (b === "1") lit.add(`${top + li * 8 + ry},${left + ci * 6 + rx}`);
      })));
    });
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const nx = ((c + 0.5) / cols) * 2 - 1;
      const ny = Math.min(1, (r + 0.5) / view) * 2 - 1;
      const k = hash(c, r);
      const side = nx < 0 ? -1 : 1;
      out.push({
        key: `${r}-${c}`,
        color: lit.has(`${r},${c}`) ? INK[Math.floor(k * INK.length)] : BASE[Math.floor(k * BASE.length)],
        // telón: abre desde el centro; al armarse, los bloques bajan de las orillas hacia el centro
        open: Math.abs(nx) * 0.55 + Math.abs(ny) * 0.08 + k * 0.12,
        build: (1 - Math.abs(nx)) * 0.35 + (r / rows) * 0.25 + k * 0.1,
        dx: `${Math.round(side * (90 + Math.abs(nx) * 220 + k * 80))}%`,
        dy: `${Math.round(60 + k * 160)}%`,
        rot: `${Math.round(side * (12 + k * 50))}deg`,
      });
    }
    return out;
  }, [g]);

  if (!g) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 grid overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${g.cols}, ${g.size}px)`, gridAutoRows: `${g.size}px` }}
    >
      {tiles.map((t) => (
        <span
          key={t.key}
          className={`brick ${phase === "open" ? "brick-pop" : phase === "build" ? "brick-in" : ""}`}
          style={{ "--c": t.color, "--d": `${phase === "open" ? t.open : t.build}s`, "--dx": t.dx, "--dy": t.dy, "--r": t.rot } as CSSProperties}
        />
      ))}
    </div>
  );
}

// Una línea de texto que aparece en escalones, como un barrido de 8 bits.
function Wipe({ show, delay = 0, className = "", children }: { show: boolean; delay?: number; className?: string; children: ReactNode }) {
  return (
    <motion.span
      className={`block ${className}`}
      initial={{ clipPath: "inset(-15% 100% -15% 0)" }}
      animate={{ clipPath: show ? "inset(-15% 0% -15% 0)" : "inset(-15% 100% -15% 0)" }}
      transition={{ duration: show ? 0.6 : 0.2, delay: show ? delay : 0, ease: steps(10) }}
    >
      {children}
    </motion.span>
  );
}

function PixelHeart() {
  const rows = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 7 6"
      className="size-4"
      shapeRendering="crispEdges"
      animate={{ scale: [1, 1.25, 1, 1.15, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: steps(4), repeatDelay: 0.6 }}
    >
      {rows.flatMap((row, y) => [...row].map((b, x) => (b === "1" ? <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null)))}
    </motion.svg>
  );
}

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(0);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(0), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied((n) => n + 1);
    } catch {
      // sin permiso para el portapapeles: el enlace del correo sigue a un lado
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="relative rounded-full border border-bone/25 px-5 py-2.5 text-[0.95rem] font-semibold transition-colors hover:border-mint hover:text-mint"
    >
      <span aria-live="polite">{copied ? "¡Copiado!" : "Copiar correo"}</span>
      <AnimatePresence>
        {copied > 0 && (
          <span key={copied} aria-hidden className="pointer-events-none absolute inset-0">
            {BURST.map((b, i) => (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 size-2"
                style={{ background: b.c }}
                initial={{ x: -4, y: -4, opacity: 1, scale: 1 }}
                animate={{ x: b.x - 4, y: b.y - 4, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </span>
        )}
      </AnimatePresence>
    </button>
  );
}

function SocialBrick({ s, i, show }: { s: Social; i: number; show: boolean }) {
  const c = BRICK[s.id];
  const Icon = SOCIAL_ICON[s.id];
  const external = s.id !== "email";
  return (
    <motion.li
      initial={{ y: -70, opacity: 0, rotate: i % 2 ? 4 : -4 }}
      animate={show ? { y: 0, opacity: 1, rotate: 0 } : { y: -70, opacity: 0, rotate: i % 2 ? 4 : -4 }}
      transition={show ? { type: "spring", stiffness: 520, damping: 17, delay: 0.55 + i * 0.1 } : { duration: 0.15 }}
    >
      <motion.a
        href={s.href}
        target={external ? "_blank" : undefined}
        rel="noopener"
        aria-label={`${s.label}: ${s.handle}`}
        className="group relative block pt-[10px] outline-none"
        whileHover={{ y: -6 }}
        whileTap={{ y: 5 }}
        transition={{ type: "spring", stiffness: 600, damping: 20 }}
      >
        {/* los cuatro botones de arriba del bloque */}
        <span aria-hidden className="absolute inset-x-0 top-0 flex justify-around px-[9%]">
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="h-[11px] w-[15%] max-w-10 rounded-t-[5px]" style={{ background: c.bg, boxShadow: `inset 0 2px 0 rgba(255,255,255,0.38), inset 0 -3px 0 ${c.side}` }} />
          ))}
        </span>
        <span
          className="relative block overflow-hidden rounded-[10px] px-5 pb-5 pt-5 transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-bone"
          style={{ background: c.bg, color: c.ink, boxShadow: `inset 0 2px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.12), 0 9px 0 ${c.side}, 0 22px 30px -14px rgba(0,0,0,0.7)` }}
        >
          {/* al pasar, el bloque se ilumina píxel por píxel */}
          <span aria-hidden className="absolute inset-0 grid grid-cols-8 grid-rows-5">
            {PIX.map((d, k) => (
              <span key={k} className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" style={{ background: c.glow, transitionDelay: `${d}ms` }} />
            ))}
          </span>
          <span className="relative flex items-center justify-between">
            <Icon className="size-7" />
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth="2.2" strokeLinecap="square">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
          <span className="relative mt-10 block font-display text-[1.6rem] font-semibold leading-none tracking-[-0.01em]">{s.label}</span>
          <span className="relative mt-2 block truncate font-mono text-[0.78rem] opacity-75">{s.handle}</span>
        </span>
      </motion.a>
    </motion.li>
  );
}

export function Contact() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.3 });
  const [phase, setPhase] = useState<Phase>("wall");
  const [settled, setSettled] = useState(false);
  const show = phase === "open";

  useEffect(() => { if (reduce) setPhase("open"); }, [reduce]);
  // la pared se deja ver un momento y luego se abre
  useEffect(() => {
    if (phase !== "wall" || !inView) return;
    const t = setTimeout(() => setPhase("open"), 550);
    return () => clearTimeout(t);
  }, [inView, phase]);
  useEffect(() => {
    if (phase === "build") {
      const t = setTimeout(() => setPhase("open"), 1800);
      return () => clearTimeout(t);
    }
    if (phase !== "open") return;
    // cuando el último bloque salió, la pared se quita del DOM
    const t = setTimeout(() => setSettled(true), 2000);
    return () => clearTimeout(t);
  }, [phase]);
  const rebuild = () => { setSettled(false); setPhase("build"); };

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: show ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { duration: 0.6, delay: show ? delay : 0, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id="contacto" ref={ref} className="relative overflow-hidden bg-night text-bone">
      {/* base de bloques: la superficie donde se arma todo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle, #eef1ea 0 5px, transparent 6px)", backgroundSize: "26px 26px", backgroundPosition: "13px 13px" }}
      />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-32">
        <motion.p {...fade(0)} className="flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-mint">
          <PixelHeart />
          CONTACTO
        </motion.p>
        <h2 className="mt-6 max-w-[18ch] font-display text-[clamp(2.4rem,6.4vw,5.8rem)] font-medium leading-[0.98] tracking-[-0.035em]">
          <Wipe show={show} delay={0.15}>¿Tienes una idea que necesita moverse?</Wipe>
          <Wipe show={show} delay={0.4} className="text-mint">Construyámosla pieza por pieza.</Wipe>
        </h2>
        <motion.p {...fade(0.55)} className="mt-7 max-w-[48ch] text-lg leading-relaxed text-bone/65">
          Trabajo con equipos de producto, agencias y marcas, en español o en inglés. Respondo en menos de un día.
        </motion.p>

        {profile.email && (
          <motion.div {...fade(0.65)} className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-4">
            <a
              href={`mailto:${profile.email}`}
              className="break-all font-display text-[clamp(1.5rem,4.2vw,3.4rem)] font-medium leading-none tracking-[-0.02em] underline decoration-mint/40 decoration-2 underline-offset-[0.2em] transition-colors hover:text-mint hover:decoration-mint"
            >
              {profile.email}
            </a>
            <CopyEmail email={profile.email} />
          </motion.div>
        )}

        <ul className="mt-16 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {socials.map((s, i) => <SocialBrick key={s.id} s={s} i={i} show={show} />)}
        </ul>

        <motion.div {...fade(1)} className="mt-16 flex flex-wrap items-center justify-between gap-4 text-sm text-bone/50">
          <p>
            <LocalTime />, {profile.location.split(",")[1]?.trim()}, México
          </p>
          {!reduce && (
            <button type="button" onClick={rebuild} disabled={phase !== "open"} className="font-mono text-xs tracking-[0.2em] transition-colors hover:text-mint disabled:opacity-40">
              ARMAR LA PARED OTRA VEZ
            </button>
          )}
        </motion.div>
      </div>

      <footer className="relative border-t border-bone/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-sm text-bone/45 sm:flex-row sm:justify-between sm:px-8">
          <p suppressHydrationWarning>© {new Date().getFullYear()} {profile.name}</p>
          <p>Diseñado y programado a mano en {profile.location}.</p>
        </div>
      </footer>

      {!reduce && !settled && <Mosaic host={ref} phase={phase} />}
    </section>
  );
}
