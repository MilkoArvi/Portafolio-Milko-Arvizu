"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { bySlug, neighbors, projects, thumbOf } from "@/data/projects";
import { skills } from "@/data/skills";
import { SpeedLines, useGo } from "./Transition";

const slugFrom = (path: string) => path.split("/")[2] ?? "";
const springy = { type: "spring", stiffness: 420, damping: 24 } as const;

// Barra fija arriba de cada proyecto: solo el camino de regreso y el contacto.
export function ProjectBar() {
  const p = bySlug(slugFrom(usePathname()));
  const tone = p?.chrome === "light" ? "bg-paper/90 text-ink border-line" : "bg-night/90 text-bone border-bone/10";
  return (
    <div className={`sticky top-0 z-[70] flex h-11 items-center justify-between gap-4 border-b px-4 text-[0.82rem] backdrop-blur sm:px-6 ${tone}`}>
      <Link href="/#proyectos" className="flex items-center gap-2 hover:underline hover:underline-offset-4">
        <span aria-hidden className="size-1.5 rounded-full bg-mint" />
        Milko Arvizu
      </Link>
      <Link href="/#contacto" className="hover:underline hover:underline-offset-4">Hablemos</Link>
    </div>
  );
}

// Botón flotante a la derecha: abre el índice de proyectos con entrada de anime.
export function ProjectDock() {
  const pathname = usePathname();
  const current = slugFrom(pathname);
  const go = useGo();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <motion.button
        ref={button}
        type="button"
        aria-label="Elegir proyecto"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group fixed right-3 top-1/2 z-[95] grid size-12 -translate-y-1/2 place-items-center rounded-full border border-mint/40 bg-night/80 text-mint shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md sm:right-5"
        initial={{ x: 80, rotate: 120 }}
        animate={{ x: 0, rotate: open ? 135 : 0 }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.86 }}
        transition={springy}
      >
        <span aria-hidden className="absolute -inset-1.5 rounded-full border border-dashed border-mint/35 motion-safe:animate-[speedspin_12s_linear_infinite]" />
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-current">
          {open
            ? <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
            : [4, 10.5, 17].flatMap((y) => [4, 10.5, 17].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="3" height="3" rx="1" />))}
        </svg>
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-full bg-night/90 px-3 py-1 text-xs text-bone opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          Proyectos
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div key="dock" className="fixed inset-0 z-[90]" initial="closed" animate="open" exit="closed">
            <motion.button
              type="button"
              aria-label="Cerrar"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-default bg-[#070908]/70 backdrop-blur-[3px]"
              variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              variants={{ closed: { opacity: 0, scale: 1.4 }, open: { opacity: 0.16, scale: 1 } }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <SpeedLines className="size-full motion-safe:animate-[speedspin_40s_linear_infinite]" color="#8fcfa5" />
            </motion.div>

            <motion.nav
              aria-label="Proyectos"
              className="absolute inset-y-3 right-3 flex w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-bone/10 bg-[#0b0e0c] text-bone shadow-[-12px_12px_0_#8fcfa5] sm:right-20"
              variants={{
                closed: { x: "115%", skewX: -14, transition: { duration: 0.28, ease: [0.7, 0, 0.84, 0] } },
                open: { x: 0, skewX: 0, transition: { type: "spring", stiffness: 260, damping: 22, staggerChildren: 0.045, delayChildren: 0.08 } },
              }}
            >
              <div className="flex items-baseline justify-between border-b border-bone/10 px-5 py-4">
                <p className="font-display text-xl font-medium">Elige uno</p>
                <p className="font-mono text-[0.68rem] text-bone/40">ESC para cerrar</p>
              </div>
              <ul className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto p-2.5">
                {projects.map((p, i) => {
                  const here = p.slug === current;
                  return (
                    <motion.li
                      key={p.slug}
                      variants={{ closed: { opacity: 0, x: 70, skewX: -22 }, open: { opacity: 1, x: 0, skewX: 0, transition: springy } }}
                    >
                      <motion.button
                        ref={i === 0 ? first : undefined}
                        type="button"
                        aria-current={here ? "page" : undefined}
                        onClick={() => { setOpen(false); if (!here) go(`/proyectos/${p.slug}`, p.title, p.accent); }}
                        whileHover={{ x: -6, rotate: -0.6, boxShadow: `6px 6px 0 ${p.accent}` }}
                        whileTap={{ scale: 0.97, x: 2 }}
                        transition={springy}
                        className={`relative flex w-full items-center gap-3.5 rounded-xl border p-2 text-left ${here ? "border-mint/60 bg-mint/10" : "border-bone/8 bg-bone/[0.03]"}`}
                      >
                        <span className="relative h-[52px] w-[76px] shrink-0 overflow-hidden rounded-md" style={{ background: p.tone.bg }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumbOf(p)} alt="" loading="lazy" className="size-full object-cover" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-[1.02rem] font-medium leading-tight">{p.title}</span>
                          <span className="mt-0.5 block truncate text-[0.8rem] text-bone/55">{p.pitch}</span>
                        </span>
                        {here && (
                          <motion.span
                            aria-hidden
                            className="absolute -right-1 -top-1 text-mint"
                            animate={{ rotate: [0, 90, 180], scale: [1, 1.25, 1] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" /></svg>
                          </motion.span>
                        )}
                      </motion.button>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Pista de qué hacer: solo aparece si la persona lleva un rato sin moverse.
export function IdleHint() {
  const pathname = usePathname();
  const p = bySlug(slugFrom(pathname));
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    if (!p) return;
    let shown = 0;
    let timer = 0;
    let visible = false;
    const arm = () => {
      clearTimeout(timer);
      if (shown >= 3) return;
      timer = window.setTimeout(() => { visible = true; shown++; setShow(true); }, shown === 0 ? 6500 : 11000);
    };
    const activity = () => {
      if (visible) { visible = false; setShow(false); }
      arm();
    };
    const evs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, activity, { passive: true, capture: true }));
    arm();
    return () => {
      clearTimeout(timer);
      evs.forEach((e) => window.removeEventListener(e, activity, { capture: true }));
    };
  }, [p]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-[85] flex justify-center px-4">
      <AnimatePresence>
        {show && p && (
          <motion.div
            key={p.slug}
            initial={{ opacity: 0, y: -18, scale: 0.6, rotate: -5 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.9, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 520, damping: 18 }}
            className="relative flex max-w-[460px] items-center gap-3 rounded-2xl border-[2.5px] border-[#0b0e0c] bg-[#f4f6f1] py-2.5 pl-2.5 pr-4 text-[0.95rem] leading-snug text-[#0b0e0c] shadow-[5px_5px_0_#8fcfa5]"
          >
            <motion.span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center bg-[#8fcfa5] font-display text-xl font-black"
              style={{ clipPath: "polygon(50% 0,62% 30%,96% 18%,74% 46%,100% 66%,66% 70%,64% 100%,46% 74%,16% 96%,26% 64%,0 44%,32% 36%,22% 6%)" }}
              animate={{ rotate: [0, -12, 10, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              !
            </motion.span>
            {p.hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Final de cada proyecto: una ficha corta y, al seguir bajando, el siguiente proyecto.
export function ProjectOutro({ slug }: { slug: string }) {
  const p = bySlug(slug)!;
  const used = skills.filter((s) => p.skills.includes(s.id)).map((s) => s.name);
  return (
    <>
      <section className="relative z-[5] bg-paper text-ink">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] font-medium leading-none tracking-[-0.02em]">{p.title}</h2>
            <p className="measure mt-5 text-lg leading-relaxed text-ink/80">{p.summary}</p>
          </div>
          <dl className="grid content-start gap-5 border-t border-line pt-5 text-[0.98rem]">
            <div className="grid grid-cols-[7rem_1fr] gap-4"><dt className="text-muted">Técnicas</dt><dd>{p.techniques.join(", ")}</dd></div>
            <div className="grid grid-cols-[7rem_1fr] gap-4"><dt className="text-muted">Disciplinas</dt><dd>{used.join(", ")}</dd></div>
          </dl>
        </div>
      </section>
      <NextPortal slug={slug} />
    </>
  );
}

// Al llegar al fondo, el scroll te lleva solo al siguiente proyecto.
function NextPortal({ slug }: { slug: string }) {
  const { next } = neighbors(slug);
  const go = useGo();
  const ref = useRef<HTMLElement>(null);
  const armed = useRef(false);
  const fired = useRef(false);
  const href = next ? `/proyectos/${next.slug}` : "/#contacto";
  const label = next ? next.title : "Hablemos";
  const accent = next ? next.accent : "#8fcfa5";
  const bg = next ? next.tone.bg : "#131814";

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });
  const scale = useTransform(p, [0.35, 1], [0.82, 1.12]);
  const lines = useTransform(p, [0.3, 1], [0, 0.35]);
  const ring = useTransform(p, [0.4, 0.985], [0, 1]);
  const shake = useTransform(p, (v) => (v > 0.9 ? Math.sin(v * 900) * (v - 0.9) * 40 : 0));

  // Si vuelves con el botón de atrás y el navegador te deja abajo, no saltamos de inmediato:
  // primero hay que subir un poco y volver a bajar.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v < 0.9) armed.current = true;
    if (armed.current && !fired.current && v > 0.985) {
      fired.current = true;
      go(href, label, accent);
    }
  });

  return (
    <section ref={ref} aria-label={`Siguiente: ${label}`} className="relative h-[170vh]" style={{ background: bg }}>
      <div className="sticky top-11 flex h-[calc(100svh-44px)] items-center justify-center overflow-hidden">
        <motion.div aria-hidden style={{ opacity: lines }} className="absolute inset-0">
          <SpeedLines className="size-full motion-safe:animate-[speedspin_30s_linear_infinite]" color={accent} />
        </motion.div>
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, transparent 0%, ${bg} 72%)` }} />
        <motion.div style={{ scale, x: shake }} className="relative px-6 text-center">
          <p className="font-mono text-xs tracking-[0.3em]" style={{ color: accent }}>{next ? "SIGUIENTE" : "FIN DEL RECORRIDO"}</p>
          <Link
            href={href}
            onClick={(e) => { e.preventDefault(); go(href, label, accent); }}
            className="mt-4 block max-w-[14ch] font-display text-[clamp(2.8rem,8.5vw,8rem)] font-semibold italic leading-[0.9] tracking-[-0.035em] text-[#f4f6f1]"
            style={{ textShadow: `6px 6px 0 #0b0e0c, 9px 9px 0 ${accent}` }}
          >
            {label}
          </Link>
          <svg aria-hidden viewBox="0 0 48 48" className="mx-auto mt-10 size-14">
            <circle cx="24" cy="24" r="21" fill="none" stroke="#f4f6f1" strokeOpacity="0.18" strokeWidth="2" />
            <motion.circle cx="24" cy="24" r="21" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: ring, rotate: -90 }} />
            <path d="M24 15v17m-7-7 7 7 7-7" fill="none" stroke="#f4f6f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
