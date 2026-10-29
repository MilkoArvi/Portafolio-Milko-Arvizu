import type { Locale } from "@/config/site";
import type { SkillId } from "./projects";

// Qué hago, en qué me especializo y cómo lo pongo en práctica, en español y en inglés.
export type Skill = {
  id: SkillId;
  name: string;
  what: string;
  specialties: string[];
  practice: string[];
  tools: string[];
};

type Copy = Omit<Skill, "id">;

const SKILLS: ({ id: SkillId } & Record<Locale, Copy>)[] = [
  {
    id: "uiux",
    es: {
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
    en: {
      name: "UI/UX",
      what: "Interfaces that make sense at first sight and feel good to use.",
      specialties: ["User flows and information architecture", "Clickable prototypes", "Purposeful microinteractions", "Accessibility and interface copy"],
      practice: [
        "I start from the person's task, not from the screen.",
        "I prototype in code early to test how it feels, not just how it looks.",
        "I check keyboard focus, contrast and reduced motion before shipping.",
      ],
      tools: ["Figma", "Motion", "User testing"],
    },
  },
  {
    id: "web",
    es: {
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
    en: {
      name: "Web design",
      what: "Sites with their own visual direction, made for the brand and not for a template.",
      specialties: ["Art direction", "Typography and grid", "Design systems", "Landing pages and brand sites"],
      practice: [
        "I pull the palette and the type from the client's world.",
        "I spend the boldness on a single element and keep the rest calm.",
        "I design for phones first, then for desktop.",
      ],
      tools: ["Figma", "Tailwind", "Variable fonts"],
    },
  },
  {
    id: "frontend",
    es: {
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
    en: {
      name: "Front-end",
      what: "Production code in React and Next.js, fast and easy to maintain.",
      specialties: ["React and Next.js", "TypeScript", "Performance and Core Web Vitals", "SEO, i18n and content"],
      practice: [
        "Small, typed components with the data kept apart from the view.",
        "Heavy things load only where they're used: this site's 3D never touches the home page.",
        "I measure on modest machines and on phones, not just on my PC.",
      ],
      tools: ["React", "Next.js", "TypeScript", "Vercel"],
    },
  },
  {
    id: "motion",
    es: {
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
    en: {
      name: "Motion",
      what: "Animation that explains what changed and guides attention.",
      specialties: ["Scroll-linked animation", "Layout transitions", "Spring physics", "Entrance choreography"],
      practice: [
        "One well-made moment of motion beats ten loose effects.",
        "I animate transform and opacity to hold 60 frames per second.",
        "Everything respects the system's reduced-motion setting.",
      ],
      tools: ["Motion", "CSS", "SVG"],
    },
  },
  {
    id: "webgl",
    es: {
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
    en: {
      name: "3D and WebGL",
      what: "3D scenes and shaders that run in the browser, phones included.",
      specialties: ["Three.js", "GLSL shaders", "GPU simulations", "Modeling in code"],
      practice: [
        "I generate textures and models in code so the site stays light.",
        "I cap pixel density and pause whatever is off screen.",
        "There's always a version that works without WebGL.",
      ],
      tools: ["Three.js", "GLSL", "WebGL2"],
    },
  },
  {
    id: "games",
    es: {
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
    en: {
      name: "Video games",
      what: "Games in Unity, 2D and 3D, from prototype to team.",
      specialties: ["Unity 2D: tilemaps, sprites, 2D physics", "Unity 3D: scenes, lighting, camera", "Gameplay programming in C#", "Technical team lead"],
      practice: [
        "I prototype the mechanic in gray before asking for art.",
        "I organize scenes and prefabs so the team never steps on each other.",
        "I lead programming on Punk Cowboy with artists and designers.",
      ],
      tools: ["Unity", "C#", "Git"],
    },
  },
  {
    id: "ai",
    es: {
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
    en: {
      name: "Applied AI",
      what: "AI assistants and tools that live on your computer.",
      specialties: ["Agents with shared memory", "Voice and gestures as input", "Desktop automation", "Local models"],
      practice: [
        "I design the assistant's interface like any other product.",
        "I prefer local models and free tools whenever I can.",
        "Mike is my lab: voice, gestures, four agents and memory in Obsidian.",
      ],
      tools: ["Python", "Local models", "Obsidian"],
    },
  },
];

const BY_LOCALE: Record<Locale, Skill[]> = {
  es: SKILLS.map((s) => ({ id: s.id, ...s.es })),
  en: SKILLS.map((s) => ({ id: s.id, ...s.en })),
};

export const skillsFor = (l: Locale) => BY_LOCALE[l];
