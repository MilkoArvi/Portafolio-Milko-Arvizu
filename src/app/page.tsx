import { MetaStrip } from "@/components/Chrome";
import { Hero } from "@/components/Hero";
import { ProofStrip } from "@/components/ProofStrip";
import { Skills } from "@/components/Skills";
import { Ladder } from "@/components/Ladder";
import { Trajectory } from "@/components/Closing";
import { Contact } from "@/components/Contact";
import { profile } from "@/data/profile";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.role,
    url: profile.url,
    address: { "@type": "PostalAddress", addressLocality: "Zapopan", addressRegion: "Jalisco", addressCountry: "MX" },
    email: profile.email || undefined,
    sameAs: [profile.github, profile.linkedin, profile.instagram].filter(Boolean),
    knowsAbout: ["UI/UX", "Diseño web", "Front-end", "React", "Next.js", "TypeScript", "Motion", "Three.js", "WebGL", "Unity", "C#"],
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
        <Trajectory />
      </main>
      <Contact />
    </>
  );
}
