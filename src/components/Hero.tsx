"use client";

import { motion } from "motion/react";
import { profile } from "@/data/profile";
import { useLocale } from "@/lib/useLocale";
import { FaceDots } from "./FaceDots";

const TOOLS = ["React", "Next.js", "TypeScript", "Motion", "Three.js", "GLSL", "Unity", "C#", "Figma", "Python"];
const ease = [0.16, 1, 0.3, 1] as const;

const COPY = {
  es: {
    title: "front-end creativo que lleva productos de la idea al lanzamiento.",
    body: "Hoy construyo interfaces en XRBS y dirijo la programación de Punk Cowboy, mi propio videojuego. Diseño, programo y animo, y casi nunca en ese orden.",
    projects: "Ver los 8 proyectos",
    talk: "Hablemos",
    tools: "Trabajo con",
    country: "México",
  },
  en: {
    title: "creative front-end developer taking products from idea to launch.",
    body: "Today I build interfaces at XRBS and lead programming on Punk Cowboy, my own video game. I design, code and animate, and almost never in that order.",
    projects: "See all 8 projects",
    talk: "Let's talk",
    tools: "I work with",
    country: "Mexico",
  },
};

export function Hero() {
  const t = COPY[useLocale()];
  return (
    <section className="relative overflow-hidden bg-night text-bone">
      {/* cuadrícula muy tenue, como papel milimétrico */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "linear-gradient(#eef1ea 1px, transparent 1px), linear-gradient(90deg, #eef1ea 1px, transparent 1px)", backgroundSize: "48px 48px" }}
      />
      <div className="relative mx-auto flex min-h-[min(92svh,900px)] max-w-[1440px] flex-col px-4 sm:px-8">
        <div className="relative -mx-4 -mb-16 mt-2 h-[86vw] sm:absolute sm:inset-y-0 sm:right-0 sm:mx-0 sm:mb-0 sm:mt-0 sm:h-auto sm:w-[78%] lg:w-[54%]">
          <FaceDots />
          {/* degradado para que el texto se lea sobre la cara en pantallas angostas */}
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-night via-transparent to-transparent sm:block" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center pb-10 pt-4 sm:pt-20">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease, delay: 0.2 }}
            className="max-w-[17ch] font-display text-[clamp(2.4rem,6.2vw,5.6rem)] font-medium leading-[0.98] tracking-[-0.03em]"
          >
            <span className="text-bone/45">{profile.name},</span>
            <br />
            {t.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mt-6 max-w-[42ch] text-[1.02rem] leading-relaxed text-bone/70 sm:text-lg"
          >
            {t.body}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.9 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <a href="#proyectos" className="rounded-full bg-mint px-6 py-3 font-semibold text-night transition-colors hover:bg-bone">
              {t.projects}
            </a>
            <a href="#contacto" className="rounded-full border border-bone/25 px-6 py-3 font-semibold transition-colors hover:border-bone">
              {t.talk}
            </a>
          </motion.div>
        </div>

        <div className="relative z-10 flex flex-col gap-4 border-t border-bone/12 py-5 text-[0.82rem] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-bone/45">{t.tools}</span>
            {TOOLS.map((t) => (
              <span key={t} className="text-bone/80">{t}</span>
            ))}
          </div>
          <span className="text-bone/45">{profile.location}, {t.country}</span>
        </div>
      </div>
    </section>
  );
}
