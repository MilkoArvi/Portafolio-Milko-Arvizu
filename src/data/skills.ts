import type { SkillId } from "./projects";

// Qué hago, en qué me especializo y cómo lo pongo en práctica.
export type Skill = {
  id: SkillId;
  name: string;
  what: string;
  specialties: string[];
  practice: string[];
  tools: string[];
};

export const skills: Skill[] = [
  {
    id: "uiux",
    name: "UI/UX",
    what: "Interfaces que se entienden a la primera y se sienten bien al usarlas.",
    specialties: ["Flujos y arquitectura de información", "Prototipos navegables", "Microinteracciones con propósito", "Accesibilidad y textos de interfaz"],
    practice: [
      "Empiezo por la tarea de la persona, no por la pantalla.",
      "Prototipo en código desde temprano para probar cómo se siente, no solo cómo se ve.",
      "Reviso foco de teclado, contraste y movimiento reducido antes de entregar.",
    ],
    tools: ["Figma", "Motion", "Pruebas con usuarios"],
  },
  {
    id: "web",
    name: "Diseño web",
    what: "Sitios con dirección visual propia, pensados para la marca y no para una plantilla.",
    specialties: ["Dirección de arte", "Tipografía y retícula", "Sistemas de diseño", "Landings y sitios de marca"],
    practice: [
      "Saco la paleta y la tipografía del mundo del cliente.",
      "Gasto lo atrevido en un solo elemento y dejo el resto en calma.",
      "Diseño primero para celular y luego para escritorio.",
    ],
    tools: ["Figma", "Tailwind", "Tipografía variable"],
  },
  {
    id: "frontend",
    name: "Front-end",
    what: "Código de producción en React y Next.js, rápido y fácil de mantener.",
    specialties: ["React y Next.js", "TypeScript", "Rendimiento y Core Web Vitals", "SEO, i18n y contenido"],
    practice: [
      "Componentes pequeños, tipados y con datos separados de la vista.",
      "Cargo lo pesado solo donde se usa: el 3D de este sitio no toca la página principal.",
      "Mido en equipos modestos y en celular, no solo en mi PC.",
    ],
    tools: ["React", "Next.js", "TypeScript", "Vercel"],
  },
  {
    id: "motion",
    name: "Motion",
    what: "Animación que explica qué cambió y guía la atención.",
    specialties: ["Animación ligada al scroll", "Transiciones de layout", "Física con resortes", "Coreografía de entrada"],
    practice: [
      "Un momento de movimiento bien hecho vale más que diez efectos sueltos.",
      "Animo transform y opacity para mantener 60 cuadros por segundo.",
      "Todo respeta la preferencia de menos movimiento del sistema.",
    ],
    tools: ["Motion", "CSS", "SVG"],
  },
  {
    id: "webgl",
    name: "3D y WebGL",
    what: "Escenas 3D y shaders que corren en el navegador, también en celular.",
    specialties: ["Three.js", "Shaders GLSL", "Simulaciones en GPU", "Modelado por código"],
    practice: [
      "Genero texturas y modelos con código para que el sitio pese poco.",
      "Limito la densidad de píxeles y pauso lo que no está en pantalla.",
      "Siempre hay una versión que funciona sin WebGL.",
    ],
    tools: ["Three.js", "GLSL", "WebGL2"],
  },
  {
    id: "games",
    name: "Videojuegos",
    what: "Juegos en Unity, en 2D y en 3D, del prototipo al equipo.",
    specialties: ["Unity 2D: tilemaps, sprites, física 2D", "Unity 3D: escenas, iluminación, cámara", "Programación de gameplay en C#", "Dirección técnica de equipo"],
    practice: [
      "Prototipo la mecánica en gris antes de pedir arte.",
      "Organizo escenas y prefabs para que el equipo trabaje sin pisarse.",
      "Dirijo la programación de Punk Cowboy con artistas y diseñadores.",
    ],
    tools: ["Unity", "C#", "Git"],
  },
  {
    id: "ai",
    name: "IA aplicada",
    what: "Asistentes y herramientas con IA que viven en tu computadora.",
    specialties: ["Agentes con memoria compartida", "Voz y gestos como entrada", "Automatización de escritorio", "Modelos locales"],
    practice: [
      "Diseño la interfaz del asistente igual que cualquier producto.",
      "Prefiero modelos locales y herramientas gratuitas cuando se puede.",
      "Mike es mi laboratorio: voz, gestos, cuatro agentes y memoria en Obsidian.",
    ],
    tools: ["Python", "Modelos locales", "Obsidian"],
  },
];
