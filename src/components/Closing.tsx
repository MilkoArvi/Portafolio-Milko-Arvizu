import type { Locale } from "@/config/site";
import { educationFor, experienceFor } from "@/data/profile";

export function Trajectory({ locale }: { locale: Locale }) {
  const en = locale === "en";
  return (
    <section id="trayectoria" className="bg-paper-2">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 className="font-display text-[clamp(2rem,4.4vw,3.6rem)] font-medium leading-none tracking-[-0.02em]">{en ? "Experience" : "Trayectoria"}</h2>
        <div>
          <ul className="border-t border-line">
            {experienceFor(locale).map((e) => (
              <li key={e.org} className="grid gap-2 border-b border-line py-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] sm:gap-8">
                <div>
                  <p className="font-display text-xl font-medium">{e.org}</p>
                  <p className="text-muted">{e.role}</p>
                </div>
                <p className="leading-relaxed text-ink/80">{e.detail}</p>
                <p className="text-sm text-muted sm:text-right">{e.when}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-12 text-sm font-semibold text-muted">{en ? "Education" : "Formación"}</h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {educationFor(locale).map((e) => (
              <li key={e.school} className="rounded-lg border border-line bg-paper p-5">
                <p className="font-display text-lg font-medium leading-snug">{e.program}</p>
                <p className="mt-1 text-muted">{e.school}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
