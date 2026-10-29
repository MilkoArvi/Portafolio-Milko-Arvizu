// Lo que Mike sabe responder en esta página. Es un guion corto, no un modelo de lenguaje:
// el Mike completo vive en la PC de Milko. Si la pregunta es grande, lo dice.

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

const counters = new Map<string, number>();
const pick = (key: string, list: string[]) => {
  const n = counters.get(key) ?? 0;
  counters.set(key, n + 1);
  return list[n % list.length];
};

export function answer(input: string): string {
  const q = norm(input);
  if (!q) return pick("unknown", UNKNOWN);
  const words = q.split(" ").length;
  const hit = INTENTS.find((i) => i.match.test(q));

  // Un tema de otro mundo gana siempre; si el tema es Mike, contesta Mike.
  // Sin tema conocido, lo que pide explicar o es largo también es de otro mundo.
  if (BIG_TOPICS.test(q) || (hit && words > 16)) return pick("big", BIG_WORLD);
  if (!hit) return BIG_ASKS.test(q) || words >= 6 ? pick("big", BIG_WORLD) : pick("unknown", UNKNOWN);

  const a = pick(hit.id, hit.answers);
  if (a === "__hora__") {
    const t = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date());
    return `En Zapopan son las ${t.replace(/\.$/, "")}. Yo no duermo, así que me da igual.`;
  }
  return a;
}

export const SUGGESTIONS = ["¿Cómo te crearon?", "¿Qué puedes hacer?", "¿Por qué eres un agujero negro?", "Explícame el universo"];
