"use client";

import { AnimatePresence, motion, useInView, useScroll, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlackHole } from "./BlackHole";
import { answer, SUGGESTIONS } from "./brain";

// Mike, el asistente de Milko. Arriba vive su cara (un agujero negro trazado en la GPU)
// y se le puede hablar: el navegador reconoce la voz, Mike contesta en voz alta.

const ease = [0.16, 1, 0.3, 1] as const;
const REST = 0.12;

// ── Voz ─────────────────────────────────────────────────────────
// Tipos mínimos de la Web Speech API (TypeScript aún no los trae completos).
type RecResult = { isFinal: boolean; 0: { transcript: string } };
type RecEvent = { resultIndex: number; results: ArrayLike<RecResult> };
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecCtor = new () => Recognition;

type Status = "idle" | "asking" | "listening" | "thinking" | "speaking";

const ERRORS: Record<string, string> = {
  denied: "Sin permiso para el micrófono. Actívalo en el candado de la barra de direcciones o escríbele.",
  unsupported: "Tu navegador no reconoce voz. Escríbele a Mike y te contesta en voz alta.",
  network: "Este navegador no trae reconocimiento de voz (pasa en Opera y Brave). Escríbele a Mike; contesta en voz alta igual.",
  "no-speech": "No te escuché. Toca el micrófono e inténtalo otra vez.",
  "audio-capture": "No encontré un micrófono conectado.",
};

function useMike() {
  const energy = useRef(REST);
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [supported, setSupported] = useState(true);
  const rec = useRef<Recognition | null>(null);
  const mic = useRef<{ stop: () => void } | null>(null);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const timers = useRef<number[]>([]);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    if (!("speechSynthesis" in window)) return;
    const choose = () => {
      const vs = speechSynthesis.getVoices();
      voice.current = vs.find((v) => v.lang === "es-MX") ?? vs.find((v) => v.lang === "es-US") ?? vs.find((v) => v.lang.startsWith("es")) ?? null;
    };
    choose();
    speechSynthesis.addEventListener("voiceschanged", choose);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", choose);
      speechSynthesis.cancel();
      rec.current?.abort();
      mic.current?.stop();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const speak = useCallback((text: string) => {
    setReply(text);
    if (!soundRef.current || !("speechSynthesis" in window)) {
      setStatus("speaking");
      energy.current = 0.8;
      later(() => { setStatus("idle"); energy.current = REST; }, Math.min(6000, 900 + text.length * 45));
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice.current?.lang ?? "es-MX";
    if (voice.current) u.voice = voice.current;
    u.rate = 1.02;
    u.pitch = 0.82;
    u.onstart = () => { setStatus("speaking"); energy.current = 0.75; };
    // cada palabra le da un golpe de energía al disco
    u.onboundary = () => { energy.current = 1; later(() => { if (energy.current > 0.75) energy.current = 0.75; }, 120); };
    u.onend = u.onerror = () => { setStatus("idle"); energy.current = REST; };
    // Chrome a veces ignora un speak() justo después de cancel(); un respiro lo evita
    later(() => speechSynthesis.speak(u), 60);
  }, []);

  const ask = useCallback((text: string) => {
    const q = text.trim();
    if (!q) return;
    setError(null);
    setHeard(q);
    setReply("");
    setStatus("thinking");
    energy.current = 0.5;
    later(() => speak(answer(q)), 520);
  }, [speak]);

  const listen = useCallback(async () => {
    if (status === "listening") { rec.current?.stop(); return; }
    setError(null);
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setError(ERRORS.unsupported); return; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();

    // Pedimos el micrófono de forma explícita: así aparece el permiso y además medimos el volumen.
    setStatus("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setStatus("idle");
      setError(ERRORS.denied);
      return;
    }
    const ac = new AudioContext();
    const an = ac.createAnalyser();
    an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    let raf = 0;
    const meter = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      energy.current = Math.min(1, 0.32 + Math.sqrt(sum / buf.length) * 5);
      raf = requestAnimationFrame(meter);
    };
    meter();
    mic.current = { stop: () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ac.close().catch(() => {}); mic.current = null; } };

    const r = new Ctor();
    rec.current = r;
    r.lang = "es-MX";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let final = "";
    let failed = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = text;
      }
      setHeard(text);
    };
    r.onerror = (e) => { failed = e.error; };
    r.onend = () => {
      mic.current?.stop();
      rec.current = null;
      if (final) ask(final);
      else {
        setStatus("idle");
        energy.current = REST;
        if (failed === "not-allowed" || failed === "service-not-allowed") setError(ERRORS.denied);
        else if (failed && failed !== "aborted") setError(ERRORS[failed] ?? ERRORS.network);
        else if (!failed) setError(ERRORS["no-speech"]);
      }
    };
    setHeard("");
    setReply("");
    setStatus("listening");
    try { r.start(); } catch { r.onend?.(); }
  }, [ask, status]);

  const wake = useCallback(() => {
    energy.current = 1;
    later(() => { if (energy.current === 1) energy.current = REST; }, 1800);
  }, []);

  return { energy, status, heard, reply, error, sound, setSound, supported, listen, ask, wake };
}

function MicButton({ status, onClick }: { status: Status; onClick: () => void }) {
  const live = status === "listening";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={live}
      aria-label={live ? "Dejar de escuchar" : "Hablar con Mike"}
      className="relative grid size-16 shrink-0 place-items-center rounded-full bg-[#ffcf8a] text-[#120c06] shadow-[0_0_40px_-6px_rgba(255,190,110,0.7)] transition-transform active:scale-90"
    >
      {live && [0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-[#ffcf8a]"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
        />
      ))}
      <svg aria-hidden viewBox="0 0 24 24" className="size-7 fill-none stroke-current" strokeWidth={1.9} strokeLinecap="round">
        {live ? <rect x="7" y="7" width="10" height="10" rx="2" className="fill-current" /> : <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" />}
      </svg>
    </button>
  );
}

const STATUS_TEXT: Record<Status, string> = {
  idle: "Mike está en órbita",
  asking: "Esperando permiso del micrófono",
  listening: "Te escucho",
  thinking: "Pensando",
  speaking: "Mike está hablando",
};

function Console({ m }: { m: ReturnType<typeof useMike> }) {
  const [text, setText] = useState("");
  return (
    <div className="w-full rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl sm:p-5">
      <div className="flex items-center gap-4">
        <MicButton status={m.status} onClick={m.listen} />
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.p key={m.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="font-display text-lg">
              {STATUS_TEXT[m.status]}
              {(m.status === "listening" || m.status === "thinking") && <span className="motion-safe:animate-pulse">…</span>}
            </motion.p>
          </AnimatePresence>
          <p className="truncate text-sm text-white/45">{m.supported ? "Pregúntale cómo lo crearon." : "Escríbele abajo."}</p>
        </div>
        <button
          type="button"
          onClick={() => { m.setSound(!m.sound); if (m.sound && "speechSynthesis" in window) speechSynthesis.cancel(); }}
          aria-pressed={m.sound}
          aria-label={m.sound ? "Silenciar la voz de Mike" : "Activar la voz de Mike"}
          className="grid size-10 place-items-center rounded-full border border-white/15 text-white/70 hover:border-white/40 hover:text-white"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            {m.sound ? <path d="M16 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" /> : <path d="m17 9 5 6m0-6-5 6" />}
          </svg>
        </button>
      </div>

      <div aria-live="polite" className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {m.heard && (
            <motion.p key={`q${m.heard}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-white/10 px-3.5 py-2 text-sm text-white/85">
              {m.heard}
            </motion.p>
          )}
          {m.reply && (
            <motion.p key={`a${m.reply}`} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="w-fit max-w-[95%] rounded-2xl rounded-bl-md border border-[#ffcf8a]/25 bg-[#ffcf8a]/10 px-3.5 py-2.5 leading-relaxed text-[#ffe9c9]">
              {m.reply.split(" ").map((w, i) => (
                <motion.span key={i} initial={{ opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ delay: i * 0.045, duration: 0.25 }}>
                  {w}{" "}
                </motion.span>
              ))}
            </motion.p>
          )}
        </AnimatePresence>
        {m.error && <p role="status" className="text-sm text-[#ffb59e]">{m.error}</p>}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); m.ask(text); setText(""); }}
      >
        <label className="sr-only" htmlFor="ask-mike">Escríbele a Mike</label>
        <input
          id="ask-mike"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="O escríbele aquí"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-[#ffcf8a]/60 focus:outline-none"
        />
        <button type="submit" className="rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">Enviar</button>
      </form>
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => m.ask(s)} className="shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/70 hover:border-[#ffcf8a]/50 hover:text-white">
            {s}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[0.7rem] leading-snug text-white/35">El reconocimiento de voz lo hace tu navegador. Este sitio no guarda audio ni texto.</p>
    </div>
  );
}

// ── Capítulos ───────────────────────────────────────────────────
function Chapter({ kicker, title, body, children, flip = false }: { kicker: string; title: string; body: string; children: React.ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-[1300px] items-center gap-10 px-4 py-24 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-36">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.8, ease }}
        className={flip ? "lg:order-2" : ""}
      >
        <p className="text-sm text-mint">{kicker}</p>
        <h2 className="mt-3 max-w-[16ch] font-display text-[clamp(2rem,4.2vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.02em]">{title}</h2>
        <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-bone/65">{body}</p>
      </motion.div>
      <div className={flip ? "lg:order-1" : ""}>{children}</div>
    </section>
  );
}

const TRIGGERS = [
  { id: "aplauso", label: "Aplauso", icon: "M7 11V6a2 2 0 1 1 4 0v5m0-2V4a2 2 0 1 1 4 0v7m0-3a2 2 0 1 1 4 0v6a7 7 0 0 1-12 5l-3-4a2 2 0 0 1 3-3l1 1" },
  { id: "chasquido", label: "Chasquido", icon: "M9 12l2-7a2 2 0 0 1 4 1l-1 5h4a2 2 0 0 1 2 2c0 4-3 8-8 8a6 6 0 0 1-6-6V9M5 4l1 2M3 8h2M8 2v2" },
  { id: "voz", label: "“Oye, Mike”", icon: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3" },
  { id: "gesto", label: "Gesto con la mano", icon: "M18 11V6a2 2 0 0 0-4 0v5m0-1V4a2 2 0 0 0-4 0v6m0 0V6a2 2 0 0 0-4 0v8l-2-2a2 2 0 0 0-3 3l4 5a7 7 0 0 0 13-4v-5a2 2 0 0 0-4 0" },
];

function Waveform({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="flex h-14 items-center gap-[3px]">
      {Array.from({ length: 42 }, (_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-mint"
          animate={{ height: active ? [6, 10 + ((i * 37) % 40), 8, 6 + ((i * 13) % 30), 6] : 4 }}
          transition={active ? { duration: 0.9, repeat: Infinity, delay: i * 0.02 } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function Triggers({ wake }: { wake: () => void }) {
  const [heardFrom, setHeardFrom] = useState<string | null>(null);
  const [awake, setAwake] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <div className="rounded-2xl border border-bone/12 bg-black/25 p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-3">
        {TRIGGERS.map((x) => (
          <button key={x.id} onClick={() => { setHeardFrom(x.label); setAwake(true); wake(); clearTimeout(t.current); t.current = window.setTimeout(() => setAwake(false), 2200); }}
            className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors ${heardFrom === x.label && awake ? "border-mint bg-mint/10" : "border-bone/12 hover:border-bone/40"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-6 fill-none stroke-mint" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d={x.icon} /></svg>
            <span className="font-medium">{x.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <Waveform active={awake} />
        <AnimatePresence mode="wait">
          <motion.p key={awake ? "on" : "off"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-right text-sm text-bone/60">
            {awake && heardFrom ? `Detectado: ${heardFrom}` : "En espera"}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// El orbe pequeño se expande hasta llenar la pantalla.
function ScreenTakeover() {
  const ref = useRef<HTMLDivElement>(null);
  const mini = useRef(0.35);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const clip = useTransform(scrollYProgress, [0.15, 0.7], ["circle(5.5% at 9% 86%)", "circle(150% at 9% 86%)"]);
  const label = useTransform(scrollYProgress, [0.1, 0.25], [1, 0]);
  const panel = useTransform(scrollYProgress, [0.6, 0.8], [0, 1]);
  return (
    <div ref={ref} className="relative h-[220vh]">
      <div className="sticky top-11 flex h-[calc(100vh-44px)] items-center justify-center px-4 sm:px-8">
        <div className="relative aspect-[16/10] w-full max-w-[1100px] overflow-hidden rounded-xl border border-bone/15 bg-[#0d110e] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 grid grid-cols-6 content-start gap-4 p-6 opacity-40">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="size-9 rounded-lg bg-bone/15 sm:size-11" />
                <span className="h-1.5 w-10 rounded bg-bone/15" />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-9 items-center gap-2 border-t border-bone/10 bg-black/40 px-3">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="size-4 rounded bg-bone/20" />)}
          </div>
          <motion.div style={{ opacity: label }} className="absolute bottom-[3%] left-[1%] aspect-square w-[17%] min-w-24">
            <BlackHole energyRef={mini} mode="mini" />
          </motion.div>
          <motion.p style={{ opacity: label }} className="absolute bottom-12 left-[19%] text-sm text-bone/70">
            Mike espera aquí, en la esquina.
          </motion.p>
          <motion.div style={{ clipPath: clip }} className="absolute inset-0 bg-[radial-gradient(circle_at_9%_86%,#2a1d10_0%,#070605_60%)]">
            <motion.div style={{ opacity: panel }} className="flex h-full flex-col justify-center gap-5 p-6 sm:p-12">
              <p className="text-sm text-[#ffcf8a]">Te muestro un ejemplo</p>
              <p className="max-w-[24ch] font-display text-[clamp(1.4rem,3vw,2.6rem)] leading-tight">Así se centra cualquier cosa con Grid.</p>
              <pre className="max-w-md overflow-hidden rounded-lg bg-black/50 p-4 font-mono text-[0.75rem] leading-relaxed text-bone/85 sm:text-sm">
{`.contenedor {
  display: grid;
  place-items: center;
}`}
              </pre>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const AGENTS = [
  { id: "escucha", name: "Escucha", job: "Convierte voz, aplausos y gestos en intenciones.", x: 80, y: 70 },
  { id: "decide", name: "Decide", job: "Elige qué agente atiende cada intención.", x: 320, y: 70 },
  { id: "ejecuta", name: "Ejecuta", job: "Abre apps y controla luces, audio y cámara.", x: 320, y: 290 },
  { id: "recuerda", name: "Recuerda", job: "Lee y escribe notas en Obsidian para todos.", x: 80, y: 290 },
];
const NOTES = [
  { x: 168, y: 150 }, { x: 236, y: 152 }, { x: 200, y: 210 }, { x: 150, y: 214 }, { x: 252, y: 208 }, { x: 200, y: 128 },
];

function AgentsGraph() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [hover, setHover] = useState<string | null>(null);
  const shown = AGENTS.find((a) => a.id === hover);
  return (
    <div className="relative">
      <svg ref={ref} viewBox="0 0 400 360" className="w-full" role="img" aria-label="Cuatro agentes conectados a una memoria compartida en Obsidian">
        {NOTES.map((a, i) =>
          NOTES.slice(i + 1).map((b, j) =>
            (i + j) % 2 === 0 ? (
              <motion.line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#eef1ea" strokeOpacity={0.18} strokeWidth={1}
                initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 0.8, delay: 0.8 + i * 0.1 }} />
            ) : null,
          ),
        )}
        {AGENTS.map((a, i) => (
          <motion.line key={a.id} x1={a.x} y1={a.y} x2={200} y2={180} stroke="#8fcfa5" strokeWidth={1.25} strokeDasharray="3 5"
            initial={{ pathLength: 0, opacity: 0 }} animate={inView ? { pathLength: 1, opacity: hover && hover !== a.id ? 0.2 : 0.9 } : {}}
            transition={{ duration: 0.9, delay: 0.2 + i * 0.15 }} />
        ))}
        {NOTES.map((n, i) => (
          <motion.circle key={i} cx={n.x} cy={n.y} r={i === 2 ? 7 : 4} fill={i === 2 ? "#8fcfa5" : "#eef1ea"}
            initial={{ scale: 0 }} animate={inView ? { scale: 1 } : {}} transition={{ type: "spring", delay: 1 + i * 0.12 }} />
        ))}
        <text x={200} y={250} textAnchor="middle" fill="#eef1ea" fillOpacity={0.55} fontSize={11}>memoria compartida</text>
        {AGENTS.map((a, i) => (
          <motion.g key={a.id} initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 + i * 0.15, duration: 0.6, ease }}
            onPointerEnter={() => setHover(a.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(a.id)} onBlur={() => setHover(null)}
            tabIndex={0} role="button" aria-label={`${a.name}: ${a.job}`} style={{ cursor: "default" }}>
            <circle cx={a.x} cy={a.y} r={34} fill="#131814" stroke={hover === a.id ? "#8fcfa5" : "#eef1ea"} strokeOpacity={hover === a.id ? 1 : 0.35} strokeWidth={1.5} />
            <text x={a.x} y={a.y + 4} textAnchor="middle" fill="#eef1ea" fontSize={12} fontWeight={600}>{a.name}</text>
          </motion.g>
        ))}
      </svg>
      <div className="min-h-12 text-center text-bone/70" aria-live="polite">
        {shown && <p><span className="text-mint">{shown.name}:</span> {shown.job}</p>}
      </div>
    </div>
  );
}

const DEVICES = [
  { id: "rgb", name: "Luces RGB" },
  { id: "mic", name: "Micrófono" },
  { id: "bocinas", name: "Bocinas" },
  { id: "camara", name: "Cámara" },
  { id: "apps", name: "Apps" },
];

function Hardware() {
  const [on, setOn] = useState<Record<string, boolean>>({ rgb: true, apps: true });
  return (
    <div className="rounded-2xl border border-bone/12 bg-black/25 p-5 sm:p-7">
      <motion.div
        aria-hidden
        className="mb-6 h-3 rounded-full"
        animate={on.rgb ? { backgroundPositionX: ["0%", "200%"], opacity: 1 } : { opacity: 0.12 }}
        transition={on.rgb ? { duration: 4, repeat: Infinity, ease: "linear" } : { duration: 0.4 }}
        style={{ backgroundImage: "linear-gradient(90deg,#8fcfa5,#9ec5e8,#c6a6e6,#e8b7a6,#8fcfa5)", backgroundSize: "200% 100%", boxShadow: on.rgb ? "0 0 24px rgba(143,207,165,0.45)" : "none" }}
      />
      <ul className="grid gap-2">
        {DEVICES.map((d) => (
          <li key={d.id}>
            <button
              role="switch"
              aria-checked={!!on[d.id]}
              onClick={() => setOn((s) => ({ ...s, [d.id]: !s[d.id] }))}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-bone/5"
            >
              <span>{d.name}</span>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${on[d.id] ? "bg-mint" : "bg-bone/15"}`}>
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className={`absolute top-1 size-4 rounded-full ${on[d.id] ? "right-1 bg-night" : "left-1 bg-bone/70"}`} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BOOT = [
  "[ ok ] Sesión iniciada",
  "[ ok ] Cargando memoria compartida (Obsidian)",
  "[ ok ] Agente Escucha: micrófono y cámara listos",
  "[ ok ] Agente Ejecuta: apps y dispositivos conectados",
  "[ ok ] Agente Recuerda: notas indexadas",
  "[ ok ] Agente Decide: en línea",
  "Mike está listo.",
];

function Boot() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <div ref={ref} className="rounded-xl border border-bone/12 bg-black/40 p-5 font-mono text-[0.8rem] leading-7 sm:text-sm">
      <p className="mb-2 text-bone/35">mike@milko-pc ~ inicio automático</p>
      {BOOT.map((l, i) => (
        <motion.p key={l} initial={{ opacity: 0, x: -6 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.25 + i * 0.32, duration: 0.25 }}
          className={i === BOOT.length - 1 ? "mt-2 text-mint" : "text-bone/75"}>
          {l}
        </motion.p>
      ))}
    </div>
  );
}

export function Mike() {
  const m = useMike();

  return (
    <div className="bg-night text-bone">
      {/* Portada: el agujero negro llena la pantalla y la consola flota encima */}
      <section className="relative min-h-[calc(100svh-44px)] overflow-hidden bg-black">
        <BlackHole energyRef={m.energy} mode="hero" className="!absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_45%,rgba(0,0,0,0.65)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div className="relative flex min-h-[calc(100svh-44px)] flex-col justify-end px-4 pb-8 pt-[38vh] sm:px-10 sm:pb-12">
          <div className="mx-auto grid w-full max-w-[1300px] items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1.2, ease, delay: 0.2 }}
                className="font-display text-[clamp(4rem,13vw,10rem)] font-medium leading-[0.85] tracking-[-0.05em] text-[#fff4e4]">
                Mike
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} className="mt-4 max-w-[38ch] text-lg leading-relaxed text-white/65">
                Un asistente que vive en mi PC. Aquí tiene cara de agujero negro de verdad: la luz se dobla, el disco quema y, si le hablas, contesta.
              </motion.p>
            </div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.8, ease }}>
              <Console m={m} />
            </motion.div>
          </div>
        </div>
      </section>

      <Chapter kicker="Activación" title="Se despierta como tú quieras" body="Mike responde a un aplauso, un chasquido, la frase “Oye, Mike” o un gesto frente a la cámara. Prueba cada uno.">
        <Triggers wake={m.wake} />
      </Chapter>

      <section className="px-4 pt-10 text-center sm:px-8">
        <p className="text-sm text-mint">Interfaz</p>
        <h2 className="mx-auto mt-3 max-w-[20ch] font-display text-[clamp(2rem,4.2vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.02em]">Un agujero negro en la esquina</h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-lg text-bone/65">Vive pequeño abajo a la izquierda. Cuando tiene algo que enseñarte, se traga la pantalla.</p>
      </section>
      <ScreenTakeover />

      <Chapter kicker="Arquitectura" title="Cuatro agentes, una memoria" body="Cada agente hace una sola cosa bien. Comparten lo que saben en una bóveda de Obsidian, así lo que uno aprende lo usan los demás." flip>
        <AgentsGraph />
      </Chapter>

      <Chapter kicker="Control" title="Mueve lo que tocas a diario" body="Mike abre programas y controla el hardware de la PC: luces, micrófono, bocinas y cámara. Todo con herramientas gratuitas.">
        <Hardware />
      </Chapter>

      <Chapter kicker="Arranque" title="Se enciende con la PC" body="No hay que abrirlo. Cuando la computadora arranca, Mike carga su memoria, levanta a sus agentes y se queda esperando." flip>
        <Boot />
      </Chapter>
    </div>
  );
}
