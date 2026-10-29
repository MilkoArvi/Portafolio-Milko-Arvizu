import type { Locale } from "@/config/site";

// Los 8 proyectos, en el orden en que se recorren. Cada uno trae su texto en español y en inglés.

export type SkillId = "uiux" | "web" | "frontend" | "motion" | "webgl" | "games" | "ai";

type Copy = {
  title: string;
  pitch: string; // una línea para la tira
  summary: string; // un párrafo para la ficha
  techniques: string[];
  hint: string; // aparece solo si la persona se queda quieta
};

type Base = {
  slug: string;
  skills: SkillId[];
  depth: 1 | 2 | 3 | 4 | 5; // cuántas capas técnicas suma: interfaz, movimiento, shader, simulación, 3D
  chrome: "dark" | "light"; // tono de la barra superior
  thumb?: string; // miniatura; por defecto /proof/<slug>.webp
  tone: { bg: string; fg: string }; // color del cuadro mientras carga la miniatura
  accent: string; // color de las transiciones y del índice
};

export type Project = Base & Copy;

const PROJECTS: (Base & Record<Locale, Copy>)[] = [
  {
    slug: "mike",
    skills: ["ai", "uiux", "motion", "webgl"],
    depth: 4,
    chrome: "dark",
    tone: { bg: "#050606", fg: "#ffcf8a" },
    accent: "#ffb45e",
    es: {
      title: "Mike, horizonte de sucesos",
      pitch: "Mi asistente de IA vive en un agujero negro. Háblale.",
      summary:
        "Mike es el asistente que estoy construyendo para mi PC. Aquí tiene cara de agujero negro de verdad: cada píxel sigue un rayo de luz que la gravedad dobla. Puedes hablarle y te cuenta cómo nació.",
      techniques: ["GLSL con trazado de rayos", "Web Speech API", "Motion", "SVG"],
      hint: "Toca el micrófono y pregúntale a Mike cómo lo crearon.",
    },
    en: {
      title: "Mike, event horizon",
      pitch: "My AI assistant lives in a black hole. Talk to it.",
      summary:
        "Mike is the assistant I'm building for my PC. Here it has the face of a real black hole: every pixel follows a ray of light bent by gravity. You can talk to it and it'll tell you how it was born.",
      techniques: ["Ray-traced GLSL", "Web Speech API", "Motion", "SVG"],
      hint: "Tap the mic and ask Mike how it was made.",
    },
  },
  {
    slug: "rostro",
    skills: ["frontend", "motion", "webgl"],
    depth: 2,
    chrome: "dark",
    tone: { bg: "#131814", fg: "#eef1ea" },
    accent: "#8fcfa5",
    es: {
      title: "Autorretrato compilado",
      pitch: "Mi cara, hecha con 5,000 caracteres de código.",
      summary:
        "Fragmentos de código que caen y, con el scroll, se acomodan hasta formar mi cara. Cada carácter sale del brillo y los bordes de una foto convertida en datos.",
      techniques: ["Canvas 2D", "Atlas de glifos", "Partículas con resortes", "Procesado de imagen"],
      hint: "Baja despacio para compilar la cara. Después pasa el cursor encima.",
    },
    en: {
      title: "Compiled self-portrait",
      pitch: "My face, made of 5,000 characters of code.",
      summary:
        "Code fragments fall and, as you scroll, settle into my face. Every character comes from the brightness and edges of a photo turned into data.",
      techniques: ["Canvas 2D", "Glyph atlas", "Spring particles", "Image processing"],
      hint: "Scroll slowly to compile the face. Then hover over it.",
    },
  },
  {
    slug: "agave",
    skills: ["web", "webgl", "motion"],
    depth: 3,
    chrome: "light",
    tone: { bg: "#dc2a1c", fg: "#f2ede3" },
    accent: "#ff4a36",
    es: {
      title: "Siete años, seis viñetas",
      pitch: "Un tequila de Los Altos contado como cómic.",
      summary:
        "Seis viñetas ilustradas en tiempo real con tramas de grabado. Entran goteando y se derriten al salir con el scroll. No hay una sola imagen.",
      techniques: ["GLSL", "Un canvas para todas las viñetas", "Scroll", "Tipografía editorial"],
      hint: "Baja con calma: cada viñeta se entinta al llegar a la pantalla.",
    },
    en: {
      title: "Seven years, six panels",
      pitch: "A tequila from Los Altos told as a comic.",
      summary:
        "Six panels illustrated in real time with engraving hatches. They drip in and melt away as you scroll. There isn't a single image.",
      techniques: ["GLSL", "One canvas for every panel", "Scroll", "Editorial type"],
      hint: "Scroll slowly: each panel gets inked as it reaches the screen.",
    },
  },
  {
    slug: "tinta",
    skills: ["webgl", "uiux", "web"],
    depth: 3,
    chrome: "dark",
    tone: { bg: "#78132a", fg: "#f2ede3" },
    accent: "#e2405f",
    es: {
      title: "Manos a la tinta",
      pitch: "Arrastra tinta y descubre el cartel.",
      summary:
        "Una simulación de tinta líquida sobre una plancha de madera. La tinta acumulada gotea, brilla con su propio relieve y deja ver el cartel dentro de la mancha.",
      techniques: ["Simulación de fluidos", "Texturas ping-pong", "Normales del relieve", "Cursor propio"],
      hint: "Mantén presionado y arrastra para entintar la plancha.",
    },
    en: {
      title: "Hands in the ink",
      pitch: "Drag ink around to reveal the poster.",
      summary:
        "A liquid ink simulation on a woodblock. Pooled ink drips, shines with its own relief and reveals the poster inside the stain.",
      techniques: ["Fluid simulation", "Ping-pong textures", "Relief normals", "Custom cursor"],
      hint: "Press and drag to ink the block.",
    },
  },
  {
    slug: "punk-cowboy",
    skills: ["games", "webgl", "motion"],
    depth: 5,
    chrome: "dark",
    tone: { bg: "#2a1238", fg: "#ffb36b" },
    accent: "#ff4fa3",
    es: {
      title: "Punk Cowboy, forajido en desarrollo",
      pitch: "Mi videojuego, del prototipo en gris al duelo al atardecer.",
      summary:
        "Punk Cowboy es el videojuego indie de acción y aventura que fundé y donde dirijo la programación, en Unity y C#. Esta escena cuenta cómo lo trabajamos: primero en gris, luego arte, después luz. Al final se juega.",
      techniques: ["Three.js", "Raycasting", "Bloom y niebla", "Dirección técnica"],
      hint: "Baja hasta el duelo y haz clic en las botellas para dispararles.",
    },
    en: {
      title: "Punk Cowboy, outlaw in development",
      pitch: "My video game, from gray-box prototype to a sunset duel.",
      summary:
        "Punk Cowboy is the indie action-adventure game I founded, where I lead programming in Unity and C#. This scene shows how we build it: first in gray, then art, then light. At the end, you get to play.",
      techniques: ["Three.js", "Raycasting", "Bloom and fog", "Technical direction"],
      hint: "Scroll down to the duel and click the bottles to shoot them.",
    },
  },
  {
    slug: "barro",
    skills: ["webgl", "uiux", "web"],
    depth: 3,
    chrome: "dark",
    tone: { bg: "#b04a2e", fg: "#f2ede3" },
    accent: "#e0703f",
    es: {
      title: "A fuego lento",
      pitch: "Mantén presionado para hornear la pieza.",
      summary:
        "Un lanzamiento de cerámica de Tonalá. Mientras mantienes presionado, la cortina se derrite y aparece una vasija torneada y bruñida, iluminada en tiempo real.",
      techniques: ["GLSL", "Iluminación por píxel", "Mantener para revelar", "Teclado y táctil"],
      hint: "Mantén presionado el botón, o la barra espaciadora, para hornear la pieza.",
    },
    en: {
      title: "Slow fire",
      pitch: "Press and hold to fire the piece.",
      summary:
        "A ceramics launch from Tonalá. While you hold, the curtain melts away and a wheel-thrown, burnished vessel appears, lit in real time.",
      techniques: ["GLSL", "Per-pixel lighting", "Hold to reveal", "Keyboard and touch"],
      hint: "Press and hold the button, or the space bar, to fire the piece.",
    },
  },
  {
    slug: "bebida",
    skills: ["webgl", "web", "motion"],
    depth: 4,
    chrome: "light",
    tone: { bg: "#c96b5e", fg: "#f6ece4" },
    accent: "#4f7d60",
    es: {
      title: "Calma, a 360°",
      pitch: "Una lata en 3D que gira con el scroll.",
      summary:
        "Una marca de bebida inventada con tres sabores. La lata gira, se voltea y cambia de etiqueta mientras haces scroll, con el nombre de cada sabor enorme detrás.",
      techniques: ["Three.js", "Texturas generadas", "Scroll 3D", "Dirección de arte"],
      hint: "Baja para cambiar de sabor. Arrastra la lata para girarla; si la agitas, escurren las gotas.",
    },
    en: {
      title: "Calma, in 360°",
      pitch: "A 3D can that spins as you scroll.",
      summary:
        "A made-up drinks brand with three flavors. The can spins, flips and changes label as you scroll, with each flavor's name huge behind it.",
      techniques: ["Three.js", "Generated textures", "3D scroll", "Art direction"],
      hint: "Scroll to change flavor. Drag the can to spin it; shake it and the drops start to run.",
    },
  },
  {
    slug: "pc",
    skills: ["webgl", "motion", "frontend"],
    depth: 5,
    chrome: "dark",
    tone: { bg: "#0b0e0c", fg: "#8fcfa5" },
    accent: "#8fcfa5",
    es: {
      title: "Bajo el vidrio templado",
      pitch: "Mi PC real, armada pieza por pieza hasta encender.",
      summary:
        "La computadora con la que trabajo, modelada con código: gabinete, tarjeta madre AM5, Ryzen 5 7600, memoria DDR5, RTX 3060 de 12 GB, fuente y ventiladores. Reflejos en tiempo real, bloom y antialiasing multimuestra. Al final enciende.",
      techniques: ["Three.js", "Modelado por código", "Reflejos y bloom", "MSAA"],
      hint: "Baja para armarla pieza por pieza. Arrastra para girarla.",
    },
    en: {
      title: "Under tempered glass",
      pitch: "My real PC, built piece by piece until it powers on.",
      summary:
        "The computer I work on, modeled in code: case, AM5 motherboard, Ryzen 5 7600, DDR5 memory, 12 GB RTX 3060, power supply and fans. Real-time reflections, bloom and multisample antialiasing. At the end, it powers on.",
      techniques: ["Three.js", "Modeling in code", "Reflections and bloom", "MSAA"],
      hint: "Scroll to build it piece by piece. Drag to rotate it.",
    },
  },
];

const BY_LOCALE: Record<Locale, Project[]> = {
  es: PROJECTS.map(({ es, en: _en, ...b }) => ({ ...b, ...es })),
  en: PROJECTS.map(({ en, es: _es, ...b }) => ({ ...b, ...en })),
};

export const projectsFor = (l: Locale) => BY_LOCALE[l];
export const SLUGS = PROJECTS.map((p) => p.slug);
export const bySlug = (slug: string, l: Locale = "es") => BY_LOCALE[l].find((p) => p.slug === slug);
export const thumbOf = (p: Project) => p.thumb ?? `/proof/${p.slug}.webp`;
export const neighbors = (slug: string, l: Locale = "es") => {
  const list = BY_LOCALE[l];
  const i = list.findIndex((p) => p.slug === slug);
  return { prev: list[i - 1], next: list[i + 1] };
};
