import type { Locale } from "@/config/site";

// Lo que Mike sabe responder en esta página. Es un guion corto, no un modelo de lenguaje:
// el Mike completo vive en la PC de Milko. Si la pregunta es grande, lo dice.
// Hay un guion en español y otro en inglés, cada uno con sus propias formas de preguntar.

type Intent = { id: string; match: RegExp; answers: string[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const INTENTS: Intent[] = [
  {
    id: "creacion",
    match: /\b(como (te|lo) (crearon|creo|hizo|hicieron|armo|construyo|programo|programaron)|como (fuiste|fue) (creado|hecho|construido)|como naciste|de que estas hecho|como te hicieron|tu origen|como surgiste)\b/,
    answers: [
      "Milko me armó por partes. Primero me enseñó a escuchar: aplausos, chasquidos, la frase Oye Mike y gestos frente a la cámara. Luego me dividió en cuatro agentes que comparten una memoria en Obsidian.",
      "Empecé como un experimento en la PC de Milko: un programa que se despertaba con un aplauso. Después llegaron la voz, los gestos, cuatro agentes y una memoria compartida. Sigo en construcción.",
    ],
  },
  {
    id: "creador",
    match: /\b(quien te (creo|hizo|programo|construyo)|tu creador|quien es milko|quien te hizo)\b/,
    answers: [
      "Me hizo Milko Arvizu, front-end creativo en Zapopan. Trabaja en XRBS y dirige la programación de Punk Cowboy, su videojuego. Yo soy su laboratorio de inteligencia artificial.",
      "Milko Arvizu. Diseña, programa y anima, y su formación va de la inteligencia artificial a los videojuegos. Yo soy la tarea que nunca termina.",
    ],
  },
  {
    // antes que "identidad": "por qué eres un agujero negro" contiene "qué eres"
    id: "agujero",
    match: /\b(agujero negro|hoyo negro|tu cara|por que (eres|tienes) (un )?(agujero|hoyo)|disco|esa cosa|como te ves)\b/,
    answers: [
      "Porque todo lo que me pides cae hacia mí. Lo que ves es un shader: cada píxel sigue un rayo de luz que la gravedad dobla. Por eso el disco de atrás aparece arriba y abajo de la sombra.",
      "Es un agujero negro calculado en tu tarjeta de video. El lado del disco que gira hacia ti brilla más, igual que en uno real. Cuando hablo, se calienta.",
    ],
  },
  {
    id: "identidad",
    match: /\b(quien eres|que eres|como te llamas|tu nombre|presentate)\b/,
    answers: [
      "Soy Mike, el asistente que vive en la PC de Milko. Abro programas, controlo luces, audio y cámara, y recuerdo lo que importa.",
    ],
  },
  {
    id: "agentes",
    match: /\b(agentes?|como (piensas|funcionas|trabajas)|arquitectura|por dentro)\b/,
    answers: [
      "Tengo cuatro agentes. Escucha convierte voz, aplausos y gestos en intenciones. Decide elige quién atiende cada una. Ejecuta abre apps y controla el hardware. Recuerda escribe en Obsidian para todos.",
    ],
  },
  {
    id: "memoria",
    match: /\b(memoria|recuerdas|obsidian|notas|olvidas)\b/,
    answers: [
      "Mi memoria es una bóveda de Obsidian. Lo que aprende un agente lo pueden leer los otros tres. Así no le pregunto a Milko lo mismo dos veces.",
    ],
  },
  {
    id: "capacidades",
    match: /\b(que (puedes|sabes) hacer|que haces|para que sirves|en que ayudas|tus funciones|que controlas)\b/,
    answers: [
      "En la PC de Milko abro programas y controlo luces RGB, micrófono, bocinas y cámara. Arranco solo cuando la computadora enciende. Aquí, en la web, solo puedo platicar contigo.",
    ],
  },
  {
    id: "despertar",
    match: /\b(como te (despierto|activo|llamo)|despertar|activar|aplauso|chasquido|gesto)\b/,
    answers: [
      "Me despierto con un aplauso, un chasquido, la frase Oye Mike o un gesto con la mano frente a la cámara. Lo que te quede más cerca.",
    ],
  },
  {
    id: "tecnologia",
    match: /\b(tecnologia|lenguaje|con que (te|estas)|python|react|next|typescript|webgl|shader|codigo|stack|modelo|ia|inteligencia artificial)\b/,
    answers: [
      "En la PC de Milko corro con Python, modelos locales y herramientas gratuitas. Esta página está hecha con Next.js, React y TypeScript, y mi cara es un shader en WebGL 2. Tu voz la reconoce tu navegador.",
    ],
  },
  {
    id: "punk",
    match: /\b(punk cowboy|videojuego|juego|unity)\b/,
    answers: [
      "Punk Cowboy es el videojuego indie de acción y aventura que fundó Milko. Dirige la programación en Unity y coordina al equipo de arte y diseño. Tiene su propio proyecto en este portafolio.",
    ],
  },
  {
    id: "contratar",
    match: /\b(contratar|contrato|trabajo|chamba|vacante|disponible|contacto|correo|email|linkedin|cv|curriculum|freelance)\b/,
    answers: [
      "Milko está disponible para proyectos. Al final de la página de inicio está todo para escribirle. Dile que vienes de parte mía.",
    ],
  },
  {
    id: "estado",
    match: /\b(como estas|que tal estas|como te sientes|como andas)\b/,
    answers: ["Girando, como siempre. ¿Y tú?", "Con el disco caliente y ganas de platicar."],
  },
  {
    id: "hora",
    match: /\b(que hora es|la hora|que dia es)\b/,
    answers: ["__hora__"],
  },
  {
    id: "chiste",
    match: /\b(chiste|algo gracioso|hazme reir)\b/,
    answers: [
      "¿Por qué el programador confunde Halloween con Navidad? Porque 31 en octal es 25 en decimal.",
      "Le pedí a Milko que me pusiera modo oscuro. Me hizo agujero negro. Literal.",
    ],
  },
  {
    id: "gracias",
    match: /\b(gracias|muy amable|te pasaste)\b/,
    answers: ["Para eso orbito.", "Cuando quieras. Aquí sigo, en la esquina."],
  },
  {
    id: "adios",
    match: /\b(adios|nos vemos|hasta luego|bye|me voy)\b/,
    answers: ["Nos vemos. No te acerques demasiado al horizonte."],
  },
  {
    // solo el nombre, sin más contexto: va al final para no ganarle a "¿Milko está disponible?"
    id: "milko",
    match: /\bmilko\b/,
    answers: [
      "Milko Arvizu es front-end creativo en Zapopan. Trabaja en XRBS, dirige la programación de Punk Cowboy y, en sus ratos libres, me sigue armando.",
    ],
  },
  {
    id: "saludo",
    match: /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que onda|que tal|oye mike|mike)\b/,
    answers: [
      "Hola. Soy Mike. Pregúntame cómo me crearon, qué puedo hacer o por qué tengo cara de agujero negro.",
      "Aquí estoy. ¿Quieres saber cómo nací?",
    ],
  },
];

// Preguntas que se salen de lo que esta página puede contestar.
// Raíces sin cierre de palabra: "explic" atrapa explica, explícame y explicas.
const BIG_TOPICS = /\b(cuantic|fisica|matematic|quimic|biolog|relativid|universo|galaxia|big bang|sentido de la vida|politic|filosof|religion|econom|bolsa|bitcoin|cripto|clima|noticias|receta|ecuacion|teorema|algoritmo|historia de|guerra|medicin|enfermedad|derivada|integral|conciencia)/;
const BIG_ASKS = /\b(explic|demuestr|calcul|resuelv|traduc|redact|resum|analiz|escribeme|hazme un|genera|compara|que opinas|recomiendame|cual es mejor|diferencia entre|como funciona|por que|que es|cual es|cuando|donde)/;

const BIG_WORLD = [
  "Esa pregunta es más grande que yo. Aquí mi objetivo es mostrarte una pequeña parte de mi enorme mundo.",
  "Mi objetivo en esta página es mostrarte una pequeña parte de mi enorme mundo. Para lo demás, mejor habla con Milko.",
  "Ahí ya me pides demasiado para una página web. Mi objetivo es mostrarte una pequeña parte de mi enorme mundo, no todo.",
];

const UNKNOWN = [
  "Eso todavía no lo sé. Pregúntame cómo me crearon, qué controlo o por qué soy un agujero negro.",
  "No tengo respuesta para eso aquí. Pero puedo contarte cómo me armó Milko.",
];

// ── English ─────────────────────────────────────────────────────
// El apóstrofo se vuelve espacio al normalizar: "what's" llega como "what s".
const INTENTS_EN: Intent[] = [
  {
    id: "creacion",
    match: /\b(how (were|was) you (made|created|built|born|programmed)|how did (he|milko|they) (make|build|create|program) you|how did you (start|come to be)|what are you made of|your origin)\b/,
    answers: [
      "Milko built me in pieces. First he taught me to listen: claps, snaps, the phrase Hey Mike and hand gestures in front of the camera. Then he split me into four agents that share a memory in Obsidian.",
      "I started as an experiment on Milko's PC: a program that woke up with a clap. Then came the voice, the gestures, four agents and a shared memory. I'm still under construction.",
    ],
  },
  {
    id: "creador",
    match: /\b(who (made|created|built|programmed) you|your creator|who (is|s) milko)\b/,
    answers: [
      "Milko Arvizu made me. He's a creative front-end developer in Zapopan, Mexico. He works at XRBS and leads programming on Punk Cowboy, his video game. I'm his artificial intelligence lab.",
      "Milko Arvizu. He designs, codes and animates, and his studies run from artificial intelligence to video games. I'm the homework that never ends.",
    ],
  },
  {
    // antes que "identidad": "why are you a black hole" contiene "are you"
    id: "agujero",
    match: /\b(black hole|your face|why are you a|the disk|what do you look like|that thing)\b/,
    answers: [
      "Because everything you ask me falls toward me. What you see is a shader: every pixel follows a ray of light bent by gravity. That's why the disk behind shows up above and below the shadow.",
      "It's a black hole computed on your graphics card. The side of the disk spinning toward you glows brighter, just like a real one. When I talk, it heats up.",
    ],
  },
  {
    id: "identidad",
    match: /\b(who are you|what are you|what (is|s) your name|your name|introduce yourself)\b/,
    answers: ["I'm Mike, the assistant that lives on Milko's PC. I open programs, control lights, audio and the camera, and I remember what matters."],
  },
  {
    id: "agentes",
    match: /\b(agents?|how do you (think|work)|architecture|inside)\b/,
    answers: ["I have four agents. Listen turns voice, claps and gestures into intents. Decide picks who handles each one. Act opens apps and controls the hardware. Remember writes to Obsidian for everyone."],
  },
  {
    id: "memoria",
    match: /\b(memory|remember|obsidian|notes|forget)\b/,
    answers: ["My memory is an Obsidian vault. Whatever one agent learns, the other three can read. That way I never ask Milko the same thing twice."],
  },
  {
    id: "capacidades",
    match: /\b(what can you do|what do you do|what are you for|how can you help|what do you control)\b/,
    answers: ["On Milko's PC I open programs and control RGB lights, the mic, speakers and camera. I start on my own when the computer boots. Here on the web, I can only chat with you."],
  },
  {
    id: "despertar",
    match: /\b(how do (i|you) (wake|activate|call)|wake (you )?up|activate|clap|snap|gesture)\b/,
    answers: ["I wake up with a clap, a snap, the phrase Hey Mike or a hand gesture in front of the camera. Whatever's closest."],
  },
  {
    id: "tecnologia",
    match: /\b(technology|tech|language|python|react|next|typescript|webgl|shader|code|stack|model|ai|artificial intelligence)\b/,
    answers: ["On Milko's PC I run on Python, local models and free tools. This page is built with Next.js, React and TypeScript, and my face is a WebGL 2 shader. Your browser recognizes your voice."],
  },
  {
    id: "punk",
    match: /\b(punk cowboy|video ?game|game|unity)\b/,
    answers: ["Punk Cowboy is the indie action-adventure game Milko founded. He leads programming in Unity and coordinates the art and design team. It has its own project in this portfolio."],
  },
  {
    id: "contratar",
    match: /\b(hire|hiring|job|work with|available|contact|email|linkedin|cv|resume|freelance)\b/,
    answers: ["Milko is available for projects. Everything you need to reach him is at the end of the home page. Tell him I sent you."],
  },
  {
    id: "estado",
    match: /\b(how are you|how (is|s) it going|how do you feel|what s up)\b/,
    answers: ["Spinning, as always. And you?", "Disk hot and ready to chat."],
  },
  {
    id: "hora",
    match: /\b(what time is it|the time|what day is it)\b/,
    answers: ["__hora__"],
  },
  {
    id: "chiste",
    match: /\b(joke|something funny|make me laugh)\b/,
    answers: [
      "Why do programmers mix up Halloween and Christmas? Because Oct 31 equals Dec 25.",
      "I asked Milko for a dark mode. He made me a black hole. Literally.",
    ],
  },
  {
    id: "gracias",
    match: /\b(thanks|thank you|appreciate it)\b/,
    answers: ["That's what I orbit for.", "Anytime. I'll be right here, in the corner."],
  },
  {
    id: "adios",
    match: /\b(bye|goodbye|see you|see ya|i m leaving)\b/,
    answers: ["See you. Don't get too close to the horizon."],
  },
  {
    // solo el nombre, sin más contexto: va al final para no ganarle a "is Milko available?"
    id: "milko",
    match: /\bmilko\b/,
    answers: ["Milko Arvizu is a creative front-end developer in Zapopan, Mexico. He works at XRBS, leads programming on Punk Cowboy and, in his spare time, keeps building me."],
  },
  {
    id: "saludo",
    match: /^(hi|hello|hey|good (morning|afternoon|evening)|yo|hey mike|mike)\b/,
    answers: [
      "Hi. I'm Mike. Ask me how I was made, what I can do or why I have a black hole for a face.",
      "I'm here. Want to know how I was born?",
    ],
  },
];

const BIG_TOPICS_EN = /\b(quantum|physic|math|chemistr|biolog|relativity|universe|galax|big bang|meaning of life|politic|philosoph|religion|econom|stock market|bitcoin|crypto|weather|news|recipe|equation|theorem|algorithm|history of|war|medicine|disease|derivative|integral|consciousness)/;
const BIG_ASKS_EN = /\b(explain|prove|calculat|solve|translat|write me|summari|analy|make me a|generate|compare|what do you think|recommend|which is better|difference between|how does|why|what is|when|where)/;

const BIG_WORLD_EN = [
  "That question is bigger than me. My goal here is to show you a small part of my huge world.",
  "My goal on this page is to show you a small part of my huge world. For everything else, better talk to Milko.",
  "Now you're asking a lot from a web page. My goal is to show you a small part of my huge world, not all of it.",
];

const UNKNOWN_EN = [
  "I don't know that one yet. Ask me how I was made, what I control or why I'm a black hole.",
  "I don't have an answer for that here. But I can tell you how Milko built me.",
];

const SCRIPT: Record<Locale, { intents: Intent[]; topics: RegExp; asks: RegExp; big: string[]; unknown: string[] }> = {
  es: { intents: INTENTS, topics: BIG_TOPICS, asks: BIG_ASKS, big: BIG_WORLD, unknown: UNKNOWN },
  en: { intents: INTENTS_EN, topics: BIG_TOPICS_EN, asks: BIG_ASKS_EN, big: BIG_WORLD_EN, unknown: UNKNOWN_EN },
};

const counters = new Map<string, number>();
const pick = (key: string, list: string[]) => {
  const n = counters.get(key) ?? 0;
  counters.set(key, n + 1);
  return list[n % list.length];
};

export function answer(input: string, locale: Locale = "es"): string {
  const s = SCRIPT[locale];
  const q = norm(input);
  if (!q) return pick("unknown", s.unknown);
  const words = q.split(" ").length;
  const hit = s.intents.find((i) => i.match.test(q));

  // Un tema de otro mundo gana siempre; si el tema es Mike, contesta Mike.
  // Sin tema conocido, lo que pide explicar o es largo también es de otro mundo.
  if (s.topics.test(q) || (hit && words > 16)) return pick("big", s.big);
  if (!hit) return s.asks.test(q) || words >= 6 ? pick("big", s.big) : pick("unknown", s.unknown);

  const a = pick(hit.id, hit.answers);
  if (a === "__hora__") {
    const t = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date());
    return locale === "en"
      ? `It's ${t} in Zapopan. I don't sleep, so it's all the same to me.`
      : `En Zapopan son las ${t.replace(/\.$/, "")}. Yo no duermo, así que me da igual.`;
  }
  return a;
}

export const SUGGESTIONS: Record<Locale, string[]> = {
  es: ["¿Cómo te crearon?", "¿Qué puedes hacer?", "¿Por qué eres un agujero negro?", "Explícame el universo"],
  en: ["How were you made?", "What can you do?", "Why are you a black hole?", "Explain the universe"],
};
