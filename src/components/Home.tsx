import type { Locale } from "@/config/site";
import { MetaStrip } from "@/components/Chrome";
import { Hero } from "@/components/Hero";
import { ProofStrip } from "@/components/ProofStrip";
import { Skills } from "@/components/Skills";
import { Ladder } from "@/components/Ladder";
import { Trajectory } from "@/components/Closing";
import { Contact } from "@/components/Contact";
import { profileFor } from "@/data/profile";
import { homeHref } from "@/lib/i18n";

// La página principal, la misma en los dos idiomas.
export function Home({ locale }: { locale: Locale }) {
  const me = profileFor(locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: me.name,
    jobTitle: me.role,
    url: `${me.url}${homeHref(locale)}`.replace(/\/$/, ""),
    email: me.email || undefined,
    address: { "@type": "PostalAddress", addressLocality: "Zapopan", addressRegion: "Jalisco", addressCountry: "MX" },
    sameAs: [me.github, me.linkedin, me.instagram].filter(Boolean),
    knowsAbout: ["UI/UX", locale === "en" ? "Web design" : "Diseño web", "Front-end", "React", "Next.js", "TypeScript", "Motion", "Three.js", "WebGL", "Unity", "C#"],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MetaStrip />
      <main>
        <Hero />
        <ProofStrip />
        <Skills />
        <Ladder />
        <Trajectory locale={locale} />
      </main>
      <Contact />
    </>
  );
}
