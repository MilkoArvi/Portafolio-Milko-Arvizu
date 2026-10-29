import type { Locale } from "@/config/site";

// ─────────────────────────────────────────────────────────────
// Datos personales. Todo lo que vas a querer cambiar está aquí.
// ─────────────────────────────────────────────────────────────

export const profile = {
  name: "Milko Arvizu",
  role: "Front-end creativo",
  url: "https://milkoarvizu.vercel.app", // cambia por tu dominio cuando lo tengas
  location: "Zapopan, Jalisco",
  timeZone: "America/Mexico_City",
  available: true,
  summary:
    "Desarrollador front-end creativo en Zapopan. Diseño y construyo interfaces, sitios con motion, experiencias 3D y videojuegos, de la idea al lanzamiento.",

  // Deja en blanco lo que no quieras mostrar; el sitio oculta los vacíos.
  email: "arvizumilko@gmail.com",
  github: "https://github.com/MilkoArvi",
  linkedin: "https://www.linkedin.com/in/milko-sahy-martinez-arvizu-2842b1371/",
  instagram: "https://www.instagram.com/milki_dev/",
};

// Lo que cambia de un idioma a otro.
const COPY: Record<Locale, { role: string; summary: string }> = {
  es: { role: profile.role, summary: profile.summary },
  en: {
    role: "Creative front-end developer",
    summary:
      "Creative front-end developer in Zapopan, Mexico. I design and build interfaces, motion-driven sites, 3D experiences and video games, from idea to launch.",
  },
};
export const profileFor = (l: Locale) => ({ ...profile, ...COPY[l] });

export type Social = { id: "email" | "linkedin" | "github" | "instagram"; label: string; handle: string; href: string };

// Redes en el orden en que aparecen en el contacto y en la barra de arriba.
export const socialsFor = (l: Locale): Social[] =>
  (
    [
      profile.email && { id: "email", label: l === "en" ? "Email" : "Correo", handle: profile.email, href: `mailto:${profile.email}` },
      profile.linkedin && { id: "linkedin", label: "LinkedIn", handle: "in/milko-sahy-martinez-arvizu", href: profile.linkedin },
      profile.github && { id: "github", label: "GitHub", handle: "github.com/MilkoArvi", href: profile.github },
      profile.instagram && { id: "instagram", label: "Instagram", handle: "@milki_dev", href: profile.instagram },
    ] as (Social | "")[]
  ).filter((s): s is Social => Boolean(s));

export type Experience = { org: string; role: string; when: string; detail: string };

const EXPERIENCE: Record<Locale, Experience[]> = {
  es: [
    { org: "XRBS", role: "Front-end developer", when: "Abril 2025 a hoy", detail: "Interfaces en React, Next.js y TypeScript, con animación en Motion." },
    { org: "Punk Cowboy", role: "Fundador y director de programación", when: "En desarrollo", detail: "Videojuego indie de acción y aventura. Dirijo la programación y coordino al equipo de arte y diseño." },
    { org: "Freelance", role: "Diseño y desarrollo web", when: "2025 a hoy", detail: "Sitios con motion y dirección de arte para marcas y estudios creativos." },
  ],
  en: [
    { org: "XRBS", role: "Front-end developer", when: "April 2025 to now", detail: "Interfaces in React, Next.js and TypeScript, animated with Motion." },
    { org: "Punk Cowboy", role: "Founder and lead programmer", when: "In development", detail: "Indie action-adventure game. I lead programming and coordinate the art and design team." },
    { org: "Freelance", role: "Web design and development", when: "2025 to now", detail: "Motion-driven, art-directed sites for brands and creative studios." },
  ],
};

const EDUCATION: Record<Locale, { school: string; program: string }[]> = {
  es: [
    { school: "Hybridge", program: "Ingeniería en Inteligencia Artificial" },
    { school: "Amerike", program: "Desarrollo de Videojuegos y Software Interactivo" },
  ],
  en: [
    { school: "Hybridge", program: "Artificial Intelligence Engineering" },
    { school: "Amerike", program: "Video Game and Interactive Software Development" },
  ],
};

export const experienceFor = (l: Locale) => EXPERIENCE[l];
export const educationFor = (l: Locale) => EDUCATION[l];
