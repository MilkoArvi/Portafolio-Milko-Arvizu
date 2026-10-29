"use client";

import Link from "next/link";
import { motion, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import { projects, type Project } from "@/data/projects";
import { useGo } from "./Transition";

// "Un perfil con profundidad": perfil como el de LinkedIn y como el dibujo de lado;
// profundidad como la del 3D y como la de alguien que no se queda en la superficie.
// Cada fila muestra cuántas capas técnicas apila el proyecto.

const LAYERS = ["Interfaz", "Movimiento", "Shader", "Simulación", "3D"];

function DepthStack({ depth }: { depth: Project["depth"] }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Profundidad: ${depth} de 5 capas`}>
      <div className="flex items-end gap-[3px]">
        {LAYERS.map((l, i) => (
          <motion.span
            key={l}
            title={l}
            className={`w-2.5 rounded-[2px] ${i < depth ? "bg-mint-deep" : "bg-line"}`}
            initial={{ height: 4 }}
            whileInView={{ height: 6 + i * 4 }}
            viewport={{ once: true, amount: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: i * 0.05 }}
          />
        ))}
      </div>
      <span className="text-xs text-muted">{depth} de 5 capas</span>
    </div>
  );
}

export function Ladder() {
  const ref = useRef<HTMLOListElement>(null);
  const go = useGo();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-8 sm:pb-32">
      <div className="grid gap-4 border-t border-line pt-16 lg:grid-cols-2 lg:items-end">
        <h2 className="font-display text-[clamp(2rem,4.4vw,3.6rem)] font-medium leading-none tracking-[-0.02em]">
          Un perfil con <span className="italic text-mint-deep">profundidad</span>
        </h2>
        <p className="measure text-lg leading-relaxed text-muted">
          Empecé en plano: interfaces, tipografía, movimiento. Con los años le sumé luz, física y volumen. Aquí se ve cuántas capas apila cada proyecto.
        </p>
      </div>

      <ol ref={ref} className="relative mt-12">
        <motion.span aria-hidden style={{ scaleY }} className="absolute bottom-0 left-[1.15rem] top-0 hidden w-px origin-top bg-mint-deep sm:block" />
        {projects.map((p, i) => (
          <li key={p.slug} className="border-b border-line first:border-t">
            <Link
              href={`/proyectos/${p.slug}`}
              onClick={(e) => { e.preventDefault(); go(`/proyectos/${p.slug}`, p.title, p.accent); }}
              className="group grid gap-x-8 gap-y-3 py-7 sm:grid-cols-[2.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] sm:items-center"
            >
              <span className="relative z-10 grid size-9 place-items-center rounded-full border border-line bg-paper font-mono text-xs transition-colors group-hover:border-mint-deep group-hover:bg-mint-deep group-hover:text-paper">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-display text-[clamp(1.35rem,2.4vw,2rem)] font-medium leading-tight tracking-[-0.01em] transition-transform duration-300 group-hover:translate-x-1">
                  {p.title}
                </h3>
                <p className="mt-1 text-[0.95rem] text-muted">{p.techniques.join(", ")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <DepthStack depth={p.depth} />
                <p className="text-[0.95rem] leading-snug text-ink/75">{p.pitch}</p>
              </div>
              <span className="text-sm font-semibold text-mint-deep">Abrir</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
