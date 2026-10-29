"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { profile, socials } from "@/data/profile";
import { SOCIAL_ICON } from "./Icons";

export function LocalTime({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: profile.timeZone, hour12: false });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      {now ? `${now} en ${profile.location.split(",")[0]}` : profile.location}
    </span>
  );
}

export function MetaStrip() {
  return (
    <header className="relative z-20 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 text-[0.82rem] sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 leading-tight">
          <span aria-hidden className="relative flex size-2">
            {profile.available && <span className="absolute inset-0 animate-ping rounded-full bg-mint-deep opacity-50 motion-reduce:hidden" />}
            <span className="relative size-2 rounded-full bg-mint-deep" />
          </span>
          <span>
            <span className="font-semibold">{profile.name}</span>
            <span className="hidden text-muted sm:inline">, {profile.role.toLowerCase()}{profile.available ? ", disponible para proyectos" : ""}</span>
          </span>
        </Link>
        <nav aria-label="Secciones" className="hidden items-center gap-6 md:flex">
          <a href="#proyectos" className="hover:text-mint-deep">Proyectos</a>
          <a href="#habilidades" className="hover:text-mint-deep">Habilidades</a>
          <a href="#trayectoria" className="hover:text-mint-deep">Trayectoria</a>
          <a href="#contacto" className="hover:text-mint-deep">Contacto</a>
        </nav>
        <div className="flex items-center gap-3.5">
          <LocalTime className="hidden text-muted lg:inline" />
          {socials.map((s) => {
            const Icon = SOCIAL_ICON[s.id];
            return (
              <a key={s.id} href={s.href} target={s.id === "email" ? undefined : "_blank"} rel="noopener" aria-label={`${s.label} de Milko`} className="transition-colors hover:text-mint-deep">
                <Icon />
              </a>
            );
          })}
        </div>
      </div>
    </header>
  );
}
