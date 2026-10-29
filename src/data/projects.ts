// Los 8 proyectos, en el orden en que se recorren.

export type SkillId = "uiux" | "web" | "frontend" | "motion" | "webgl" | "games" | "ai";

export type Project = {
  slug: string;
  title: string;
  pitch: string; // una línea para la tira
  summary: string; // un párrafo para la ficha
  techniques: string[];
  skills: SkillId[];
  hint: string; // aparece solo si la persona se queda quieta
  depth: 1 | 2 | 3 | 4 | 5; // cuántas capas técnicas suma: interfaz, movimiento, shader, simulación, 3D
  chrome: "dark" | "light"; // tono de la barra superior
  thumb?: string; // miniatura; por defecto /proof/<slug>.webp
  tone: { bg: string; fg: string }; // color del cuadro mientras carga la miniatura
  accent: string; // color de las transiciones y del índice
};

export const projects: Project[] = [
  {
    slug: "mike",
    title: "Mike, horizonte de sucesos",
    pitch: "Mi asistente de IA vive en un agujero negro. Háblale.",
    summary:
      "Mike es el asistente que estoy construyendo para mi PC. Aquí tiene cara de agujero negro de verdad: cada píxel sigue un rayo de luz que la gravedad dobla. Puedes hablarle y te cuenta cómo nació.",
    techniques: ["GLSL con trazado de rayos", "Web Speech API", "Motion", "SVG"],
    skills: ["ai", "uiux", "motion", "webgl"],
    hint: "Toca el micrófono y pregúntale a Mike cómo lo crearon.",
    depth: 4,
    chrome: "dark",
    tone: { bg: "#050606", fg: "#ffcf8a" },
    accent: "#ffb45e",
  },
  {
    slug: "rostro",
    title: "Autorretrato compilado",
    pitch: "Mi cara, hecha con 5,000 caracteres de código.",
    summary:
      "Fragmentos de código que caen y, con el scroll, se acomodan hasta formar mi cara. Cada carácter sale del brillo y los bordes de una foto convertida en datos.",
    techniques: ["Canvas 2D", "Atlas de glifos", "Partículas con resortes", "Procesado de imagen"],
    skills: ["frontend", "motion", "webgl"],
    hint: "Baja despacio para compilar la cara. Después pasa el cursor encima.",
    depth: 2,
    chrome: "dark",
    tone: { bg: "#131814", fg: "#eef1ea" },
    accent: "#8fcfa5",
  },
  {
    slug: "agave",
    title: "Siete años, seis viñetas",
    pitch: "Un tequila de Los Altos contado como cómic.",
    summary:
      "Seis viñetas ilustradas en tiempo real con tramas de grabado. Entran goteando y se derriten al salir con el scroll. No hay una sola imagen.",
    techniques: ["GLSL", "Un canvas para todas las viñetas", "Scroll", "Tipografía editorial"],
    skills: ["web", "webgl", "motion"],
    hint: "Baja con calma: cada viñeta se entinta al llegar a la pantalla.",
    depth: 3,
    chrome: "light",
    tone: { bg: "#dc2a1c", fg: "#f2ede3" },
    accent: "#ff4a36",
  },
  {
    slug: "tinta",
    title: "Manos a la tinta",
    pitch: "Arrastra tinta y descubre el cartel.",
    summary:
      "Una simulación de tinta líquida sobre una plancha de madera. La tinta acumulada gotea, brilla con su propio relieve y deja ver el cartel dentro de la mancha.",
    techniques: ["Simulación de fluidos", "Texturas ping-pong", "Normales del relieve", "Cursor propio"],
    skills: ["webgl", "uiux", "web"],
    hint: "Mantén presionado y arrastra para entintar la plancha.",
    depth: 3,
    chrome: "dark",
    tone: { bg: "#78132a", fg: "#f2ede3" },
    accent: "#e2405f",
  },
  {
    slug: "punk-cowboy",
    title: "Punk Cowboy, forajido en desarrollo",
    pitch: "Mi videojuego, del prototipo en gris al duelo al atardecer.",
    summary:
      "Punk Cowboy es el videojuego indie de acción y aventura que fundé y donde dirijo la programación, en Unity y C#. Esta escena cuenta cómo lo trabajamos: primero en gris, luego arte, después luz. Al final se juega.",
    techniques: ["Three.js", "Raycasting", "Bloom y niebla", "Dirección técnica"],
    skills: ["games", "webgl", "motion"],
    hint: "Baja hasta el duelo y haz clic en las botellas para dispararles.",
    depth: 5,
    chrome: "dark",
    tone: { bg: "#2a1238", fg: "#ffb36b" },
    accent: "#ff4fa3",
  },
  {
    slug: "barro",
    title: "A fuego lento",
    pitch: "Mantén presionado para hornear la pieza.",
    summary:
      "Un lanzamiento de cerámica de Tonalá. Mientras mantienes presionado, la cortina se derrite y aparece una vasija torneada y bruñida, iluminada en tiempo real.",
    techniques: ["GLSL", "Iluminación por píxel", "Mantener para revelar", "Teclado y táctil"],
    skills: ["webgl", "uiux", "web"],
    hint: "Mantén presionado el botón, o la barra espaciadora, para hornear la pieza.",
    depth: 3,
    chrome: "dark",
    tone: { bg: "#b04a2e", fg: "#f2ede3" },
    accent: "#e0703f",
  },
  {
    slug: "bebida",
    title: "Calma, a 360°",
    pitch: "Una lata en 3D que gira con el scroll.",
    summary:
      "Una marca de bebida inventada con tres sabores. La lata gira, se voltea y cambia de etiqueta mientras haces scroll, con el nombre de cada sabor enorme detrás.",
    techniques: ["Three.js", "Texturas generadas", "Scroll 3D", "Dirección de arte"],
    skills: ["webgl", "web", "motion"],
    hint: "Baja para cambiar de sabor. Arrastra la lata para girarla; si la agitas, escurren las gotas.",
    depth: 4,
    chrome: "light",
    tone: { bg: "#c96b5e", fg: "#f6ece4" },
    accent: "#4f7d60",
  },
  {
    slug: "pc",
    title: "Bajo el vidrio templado",
    pitch: "Mi PC real, armada pieza por pieza hasta encender.",
    summary:
      "La computadora con la que trabajo, modelada con código: gabinete, tarjeta madre AM5, Ryzen 5 7600, memoria DDR5, RTX 3060 de 12 GB, fuente y ventiladores. Reflejos en tiempo real, bloom y antialiasing multimuestra. Al final enciende.",
    techniques: ["Three.js", "Modelado por código", "Reflejos y bloom", "MSAA"],
    skills: ["webgl", "motion", "frontend"],
    hint: "Baja para armarla pieza por pieza. Arrastra para girarla.",
    depth: 5,
    chrome: "dark",
    tone: { bg: "#0b0e0c", fg: "#8fcfa5" },
    accent: "#8fcfa5",
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);
export const thumbOf = (p: Project) => p.thumb ?? `/proof/${p.slug}.webp`;
export const neighbors = (slug: string) => {
  const i = projects.findIndex((p) => p.slug === slug);
  return { prev: projects[i - 1], next: projects[i + 1] };
};
