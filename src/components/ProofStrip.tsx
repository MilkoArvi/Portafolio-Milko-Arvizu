"use client";

import Link from "next/link";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { projectsFor, thumbOf, type Project } from "@/data/projects";
import { projectHref } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { useGo } from "./Transition";

// La tira de contactos: los 8 proyectos como cuadros de una película.
// En escritorio la tira avanza de lado mientras bajas; en celular se desliza con el dedo.
// Al pasar el cursor sobre un cuadro aparece una lupa, como al revisar negativos.

function Sprockets() {
  return (
    <div
      aria-hidden
      className="h-5 w-full"
      style={{
        backgroundImage: "linear-gradient(90deg, transparent 0 9px, #e1e3db 9px 23px, transparent 23px 32px)",
        backgroundSize: "32px 9px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "0 center",
        opacity: 0.16,
      }}
    />
  );
}

function Frame({ p, i }: { p: Project; i: number }) {
  const go = useGo();
  const href = projectHref(useLocale(), p.slug);
  const [hasImg, setHasImg] = useState(true);
  const [loupe, setLoupe] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const src = thumbOf(p);
  const code = String(i + 1).padStart(2, "0");

  return (
    <Link
      href={href}
      onClick={(e) => { e.preventDefault(); go(href, p.title, p.accent); }}
      className="group block w-[78vw] max-w-[380px] shrink-0 snap-start outline-none sm:w-[360px]"
      aria-label={`${p.title}: ${p.pitch}`}
    >
      <div className="flex items-baseline justify-between px-1 pb-1.5 font-mono text-[0.68rem] text-mint/70">
        <span>MA {code}</span>
        <span>{p.techniques[0]}</span>
        <span>{code}A</span>
      </div>
      <div
        className="relative aspect-[16/11] overflow-hidden rounded-[3px] ring-1 ring-bone/10 transition-transform duration-500 ease-out group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-mint"
        style={{ background: p.tone.bg }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || !hasImg) return;
          const r = e.currentTarget.getBoundingClientRect();
          setLoupe({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
        }}
        onPointerLeave={() => setLoupe(null)}
      >
        {hasImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" decoding="async" onError={() => setHasImg(false)} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-end p-4 font-display text-2xl" style={{ color: p.tone.fg }}>
            {p.title}
          </div>
        )}
        {loupe && (
          <div
            aria-hidden
            className="pointer-events-none absolute size-36 rounded-full shadow-[0_0_0_2px_#eef1ea,0_14px_30px_-10px_rgba(0,0,0,0.7)]"
            style={{
              left: loupe.x - 72,
              top: loupe.y - 72,
              backgroundImage: `url(${src})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${loupe.w * 2.4}px ${loupe.h * 2.4}px`,
              backgroundPosition: `${-(loupe.x * 2.4 - 72)}px ${-(loupe.y * 2.4 - 72)}px`,
            }}
          />
        )}
      </div>
      <div className="px-1 pt-4">
        <h3 className="font-display text-xl font-medium leading-tight text-bone">{p.title}</h3>
        <p className="mt-1.5 text-[0.92rem] leading-snug text-bone/60">{p.pitch}</p>
      </div>
    </Link>
  );
}

const COPY = {
  es: { title: "Hoja de contactos", body: "Ocho proyectos revelados en el mismo rollo. Pasa el cursor por un cuadro para verlo con lupa." },
  en: { title: "Contact sheet", body: "Eight projects developed on the same roll. Hover over a frame to see it through a loupe." },
};

export function ProofStrip() {
  const l = useLocale();
  const t = COPY[l];
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => {
      setDesktop(mq.matches);
      if (track.current) setDistance(Math.max(0, track.current.scrollWidth - window.innerWidth));
    };
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => { mq.removeEventListener("change", update); window.removeEventListener("resize", update); };
  }, []);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const raw = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const x = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });
  const still = useMotionValue(0);
  const progress = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      id="proyectos"
      ref={section}
      className="relative scroll-mt-0 bg-night-2 text-bone"
      style={{ height: desktop ? `calc(100vh + ${distance}px)` : undefined }}
    >
      <div className={desktop ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : "py-16"}>
        <div className="mx-auto mb-8 flex w-full max-w-[1440px] flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <h2 className="font-display text-[clamp(2rem,4.4vw,3.6rem)] font-medium leading-none tracking-[-0.02em]">{t.title}</h2>
          <p className="max-w-[44ch] text-bone/60">{t.body}</p>
        </div>

        <div className="border-y border-bone/10 bg-[#0e120f]">
          <Sprockets />
          <motion.div
            ref={track}
            style={{ x: desktop ? x : still }}
            className={`flex gap-6 px-4 py-4 sm:gap-8 sm:px-8 ${desktop ? "w-max" : "no-scrollbar snap-x snap-mandatory overflow-x-auto"}`}
          >
            {projectsFor(l).map((p, i) => (
              <Frame key={p.slug} p={p} i={i} />
            ))}
            <div aria-hidden className="w-2 shrink-0" />
          </motion.div>
          <Sprockets />
        </div>

        {desktop && (
          <div className="mx-auto mt-6 w-full max-w-[1440px] px-8">
            <div className="h-px w-full bg-bone/10">
              <motion.div style={{ width: progress }} className="h-px bg-mint" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
