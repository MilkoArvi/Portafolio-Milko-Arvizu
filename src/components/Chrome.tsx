"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { profile, profileFor, socialsFor } from "@/data/profile";
import { homeHref, intlLocale, localeOf, translatedHref } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { SOCIAL_ICON } from "./Icons";
import { ThemeToggle } from "./Theme";
import { useGo } from "./Transition";

const COPY = {
  es: {
    at: "en",
    available: "disponible para proyectos",
    sections: "Secciones",
    nav: [["#proyectos", "Proyectos"], ["#habilidades", "Habilidades"], ["#trayectoria", "Trayectoria"], ["#contacto", "Contacto"]],
    social: (label: string) => `${label} de Milko`,
  },
  en: {
    at: "in",
    available: "available for projects",
    sections: "Sections",
    nav: [["#proyectos", "Projects"], ["#habilidades", "Skills"], ["#trayectoria", "Experience"], ["#contacto", "Contact"]],
    social: (label: string) => `Milko on ${label}`,
  },
};

export function LocalTime({ className = "" }: { className?: string }) {
  const l = useLocale();
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(l), { hour: "2-digit", minute: "2-digit", timeZone: profile.timeZone, hour12: false });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [l]);
  return (
    <span className={className} suppressHydrationWarning>
      {now ? `${now} ${COPY[l].at} ${profile.location.split(",")[0]}` : profile.location}
    </span>
  );
}

// Cambia a la misma página en el otro idioma, con la cortinilla de siempre.
export function LangSwitch({ className = "" }: { className?: string }) {
  const path = usePathname() ?? "/";
  const l = localeOf(path);
  const go = useGo();
  const href = translatedHref(path);
  const en = l === "es";
  return (
    <Link
      href={href}
      hrefLang={en ? "en" : "es"}
      lang={en ? "en" : "es"}
      aria-label={en ? "Read this site in English" : "Leer el sitio en español"}
      onClick={(e) => { e.preventDefault(); go(href, en ? "English" : "Español", "#8fcfa5", en ? "LANGUAGE" : "IDIOMA"); }}
      className={`rounded-full border border-current/25 px-2 py-0.5 font-mono text-[0.7rem] font-semibold tracking-[0.12em] transition-colors hover:border-current ${className}`}
    >
      {en ? "EN" : "ES"}
    </Link>
  );
}

export function MetaStrip() {
  const l = useLocale();
  const t = COPY[l];
  const me = profileFor(l);
  return (
    <header className="relative z-20 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 text-[0.82rem] sm:px-8">
        <Link href={homeHref(l)} className="flex items-center gap-2.5 leading-tight">
          <span aria-hidden className="relative flex size-2">
            {profile.available && <span className="absolute inset-0 animate-ping rounded-full bg-mint-deep opacity-50 motion-reduce:hidden" />}
            <span className="relative size-2 rounded-full bg-mint-deep" />
          </span>
          <span>
            <span className="font-semibold">{profile.name}</span>
            <span className="hidden text-muted sm:inline">, {me.role.toLowerCase()}{profile.available ? `, ${t.available}` : ""}</span>
          </span>
        </Link>
        <nav aria-label={t.sections} className="hidden items-center gap-6 md:flex">
          {t.nav.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-mint-deep">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3.5">
          <LocalTime className="hidden text-muted lg:inline" />
          <span className="hidden items-center gap-3.5 sm:flex">
            {socialsFor(l).map((s) => {
              const Icon = SOCIAL_ICON[s.id];
              return (
                <a key={s.id} href={s.href} target={s.id === "email" ? undefined : "_blank"} rel="noopener" aria-label={t.social(s.label)} className="transition-colors hover:text-mint-deep">
                  <Icon />
                </a>
              );
            })}
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
          <ThemeToggle className="hover:text-mint-deep" />
          <LangSwitch className="hover:text-mint-deep" />
        </div>
      </div>
    </header>
  );
}
