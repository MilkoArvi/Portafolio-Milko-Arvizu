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

export type Social = { id: "email" | "linkedin" | "github" | "instagram"; label: string; handle: string; href: string };

// Redes en el orden en que aparecen en el contacto y en la barra de arriba.
export const socials: Social[] = (
  [
    profile.email && { id: "email", label: "Correo", handle: profile.email, href: `mailto:${profile.email}` },
    profile.linkedin && { id: "linkedin", label: "LinkedIn", handle: "in/milko-sahy-martinez-arvizu", href: profile.linkedin },
    profile.github && { id: "github", label: "GitHub", handle: "github.com/MilkoArvi", href: profile.github },
    profile.instagram && { id: "instagram", label: "Instagram", handle: "@milki_dev", href: profile.instagram },
  ] as (Social | "")[]
).filter((s): s is Social => Boolean(s));

export type Experience = { org: string; role: string; when: string; detail: string };

export const experience: Experience[] = [
  {
    org: "XRBS",
    role: "Front-end developer",
    when: "Abril 2025 a hoy",
    detail: "Interfaces en React, Next.js y TypeScript, con animación en Motion.",
  },
  {
    org: "Punk Cowboy",
    role: "Fundador y director de programación",
    when: "En desarrollo",
    detail: "Videojuego indie de acción y aventura. Dirijo la programación y coordino al equipo de arte y diseño.",
  },
  {
    org: "Freelance",
    role: "Diseño y desarrollo web",
    when: "2025 a hoy",
    detail: "Sitios con motion y dirección de arte para marcas y estudios creativos.",
  },
];

export const education = [
  { school: "Hybridge", program: "Ingeniería en Inteligencia Artificial" },
  { school: "Amerike", program: "Desarrollo de Videojuegos y Software Interactivo" },
];
