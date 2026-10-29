"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/useLocale";

// Cambio de proyecto con cortinilla de anime: franjas diagonales que entran de golpe,
// líneas de velocidad y el nombre del destino al centro, como una tarjeta de episodio.
// Vive en el layout raíz, así sobrevive a la navegación y puede abrir el telón en la página nueva.

type Go = (href: string, label?: string, color?: string, kicker?: string) => void;
const GoCtx = createContext<Go>(() => {});
export const useGo = () => useContext(GoCtx);

type Phase = "idle" | "cover" | "reveal";

// Líneas de velocidad fijas. Redondeadas: Node y el navegador no calculan Math.cos
// igual hasta el último decimal y React marcaría la diferencia al hidratar.
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const LINES = Array.from({ length: 56 }, (_, i) => {
  const a = (i / 56) * Math.PI * 2 + ((i * 37) % 11) * 0.012;
  const r0 = 18 + ((i * 53) % 17);
  return { x1: r3(Math.cos(a) * r0), y1: r3(Math.sin(a) * r0), x2: r3(Math.cos(a) * 90), y2: r3(Math.sin(a) * 90), w: r3(0.25 + ((i * 29) % 7) * 0.12) };
});

export function SpeedLines({ className = "", color = "#eef1ea" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice" className={className}>
      {LINES.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={l.w} strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const l = useLocale();
  const [phase, setPhase] = useState<Phase>("idle");
  const [card, setCard] = useState({ label: "", color: "#8fcfa5", kicker: "" });
  const phaseRef = useRef<Phase>("idle");
  const target = useRef<string | null>(null);
  const origin = useRef(pathname);
  const fallback = useRef<number | undefined>(undefined);

  const set = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const go = useCallback<Go>((href, label = "", color = "#8fcfa5", kicker = "") => {
    if (phaseRef.current !== "idle") return;
    const dest = href.split("#")[0] || "/";
    if (dest === window.location.pathname && !href.includes("#")) return;
    router.prefetch(dest);
    target.current = href;
    origin.current = window.location.pathname;
    setCard({ label, color, kicker });
    set("cover");
  }, [router]);

  // Telón cerrado: navegamos. Si la ruta no cambia (un ancla en la misma página), abrimos igual.
  const onCovered = () => {
    if (phaseRef.current !== "cover" || !target.current) return;
    router.push(target.current);
    clearTimeout(fallback.current);
    fallback.current = window.setTimeout(() => set("reveal"), 2500);
  };

  useEffect(() => {
    if (phaseRef.current === "cover" && pathname !== origin.current) {
      clearTimeout(fallback.current);
      // un instante para que la página nueva pinte su primer cuadro
      fallback.current = window.setTimeout(() => set("reveal"), 120);
    }
  }, [pathname]);

  useEffect(() => () => clearTimeout(fallback.current), []);

  const bands = useMemo(() => ["#0b0e0c", card.color, "#eef1ea", "#0b0e0c", card.color, "#131814"], [card.color]);

  return (
    <GoCtx.Provider value={go}>
      {children}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div key="wipe" aria-hidden className="pointer-events-auto fixed inset-0 z-[300] overflow-hidden" exit={{ opacity: 0, transition: { duration: 0.01 } }}>
            {reduce ? (
              <motion.div
                className="absolute inset-0 bg-[#0b0e0c]"
                initial={{ opacity: 0 }}
                animate={{ opacity: phase === "cover" ? 1 : 0 }}
                transition={{ duration: 0.25 }}
                onAnimationComplete={() => (phaseRef.current === "cover" ? onCovered() : set("idle"))}
              />
            ) : (
              <>
                {bands.map((c, i) => (
                  <motion.div
                    key={i}
                    className="absolute -inset-y-1/4"
                    style={{ left: `${i * 17 - 22}%`, width: "42%", background: c, skewX: -18 }}
                    initial={{ x: "170vw" }}
                    animate={{ x: phase === "cover" ? "0vw" : "-190vw" }}
                    transition={{ duration: phase === "cover" ? 0.46 : 0.5, ease: [0.76, 0, 0.24, 1], delay: phase === "cover" ? i * 0.04 : (bands.length - 1 - i) * 0.035 }}
                    onAnimationComplete={() => {
                      if (i !== bands.length - 1 && phase === "cover") return;
                      if (i !== 0 && phase === "reveal") return;
                      if (phase === "cover") onCovered();
                      else set("idle");
                    }}
                  />
                ))}
                {/* fondo sólido al final del golpe, para que ninguna esquina quede abierta */}
                <motion.div
                  className="absolute inset-0 bg-[#0b0e0c]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase === "cover" ? 1 : 0 }}
                  transition={{ duration: 0.12, delay: phase === "cover" ? 0.4 : 0 }}
                />
                <motion.div
                  className="absolute inset-0 grid place-items-center"
                  initial={{ opacity: 0, scale: 1.6 }}
                  animate={phase === "cover" ? { opacity: 1, scale: 1, rotate: [0, -1.5, 1, 0] } : { opacity: 0, scale: 0.85, x: "-30vw" }}
                  transition={{ duration: 0.38, delay: phase === "cover" ? 0.34 : 0, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SpeedLines className="absolute inset-0 size-full animate-[spin_9s_linear_infinite] opacity-25" color={card.color} />
                  {card.label && (
                    <div className="relative px-6 text-center">
                      <p className="font-mono text-xs tracking-[0.3em] text-[#eef1ea]/60">{card.kicker || (l === "en" ? "NEXT" : "SIGUIENTE")}</p>
                      <p
                        className="mt-3 max-w-[16ch] font-display text-[clamp(2.4rem,7vw,6rem)] font-semibold italic leading-[0.92] tracking-[-0.03em] text-[#eef1ea]"
                        style={{ textShadow: `5px 5px 0 #0b0e0c, 8px 8px 0 ${card.color}` }}
                      >
                        {card.label}
                      </p>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GoCtx.Provider>
  );
}
