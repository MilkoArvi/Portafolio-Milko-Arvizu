"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { skills } from "@/data/skills";
import { projects } from "@/data/projects";

export function Skills() {
  const [active, setActive] = useState(skills[0].id);
  const skill = skills.find((s) => s.id === active)!;
  const related = projects.filter((p) => p.skills.includes(active));

  return (
    <section id="habilidades" className="mx-auto max-w-[1440px] scroll-mt-4 px-4 py-24 sm:px-8 sm:py-32">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-end">
        <h2 className="font-display text-[clamp(2rem,4.4vw,3.6rem)] font-medium leading-none tracking-[-0.02em]">
          Lo que hago y cómo lo hago
        </h2>
        <p className="measure text-lg leading-relaxed text-muted">
          Siete disciplinas que se cruzan en cada proyecto. Elige una para ver en qué me especializo, cómo la pongo en práctica y dónde se ve.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:gap-14">
        {/* Lista de disciplinas */}
        <div role="tablist" aria-label="Disciplinas" aria-orientation="vertical" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-line lg:px-0">
          {skills.map((s) => {
            const on = s.id === active;
            const count = projects.filter((p) => p.skills.includes(s.id)).length;
            return (
              <button
                key={s.id}
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={on}
                aria-controls="skill-panel"
                onClick={() => setActive(s.id)}
                className={`relative shrink-0 rounded-full border px-4 py-2 text-left transition-colors lg:flex lg:items-center lg:justify-between lg:rounded-none lg:border-0 lg:border-b lg:border-line lg:px-0 lg:py-4 ${
                  on ? "border-ink bg-ink text-paper lg:bg-transparent lg:text-ink" : "border-line text-muted hover:text-ink"
                }`}
              >
                <span className="relative z-10 font-display text-[1.05rem] lg:text-2xl">{s.name}</span>
                <span className="relative z-10 hidden text-sm lg:inline">{count} {count === 1 ? "proyecto" : "proyectos"}</span>
                {on && <motion.span layoutId="skill-bar" className="absolute -left-4 top-1/2 hidden h-6 w-[3px] -translate-y-1/2 rounded-full bg-mint-deep lg:block" />}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div id="skill-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="max-w-[34ch] font-display text-[clamp(1.5rem,2.6vw,2.2rem)] leading-[1.15] tracking-[-0.01em]">{skill.what}</p>

              <div className="mt-10 grid gap-10 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-muted">En qué me especializo</h3>
                  <ul className="mt-4 space-y-3">
                    {skill.specialties.map((s) => (
                      <li key={s} className="flex gap-3 leading-snug">
                        <span aria-hidden className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-mint-deep" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted">Cómo lo pongo en práctica</h3>
                  <ul className="mt-4 space-y-3">
                    {skill.practice.map((s) => (
                      <li key={s} className="leading-snug text-ink/85">{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-muted">Herramientas</h3>
                  <p className="mt-2">{skill.tools.join(", ")}</p>
                </div>
                <div className="sm:text-right">
                  <h3 className="text-sm font-semibold text-muted">Dónde se ve</h3>
                  <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                    {related.map((p) => (
                      <Link key={p.slug} href={`/proyectos/${p.slug}`} className="rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:border-ink hover:bg-ink hover:text-paper">
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
