// Texturas de la PC dibujadas con Canvas 2D: no se descarga ninguna imagen.

type Three = typeof import("three");

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};

// Números pseudoaleatorios repetibles: la placa se ve igual en cada visita.
export function rng(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const FONT = "'Funnel Sans Variable', 'Funnel Display Variable', sans-serif";

function srgb(THREE: Three, c: HTMLCanvasElement, aniso: number) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

// Tarjeta madre: PCB negro mate, pistas, serigrafía y componentes SMD.
// Coordenadas de la placa: 2.6 × 3.2 unidades → 1040 × 1280 px (400 px por unidad).
export const PCB = { w: 2.6, h: 3.2, ppu: 400 };
export function pcbTexture(THREE: Three, aniso: number) {
  const [c, ctx] = canvas(PCB.w * PCB.ppu, PCB.h * PCB.ppu);
  const r = rng(11);
  const px = (x: number) => (x + PCB.w / 2) * PCB.ppu;
  const py = (y: number) => (PCB.h / 2 - y) * PCB.ppu;
  ctx.fillStyle = "#101312";
  ctx.fillRect(0, 0, c.width, c.height);
  // grano de la máscara de soldadura
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
    ctx.fillRect(r() * c.width, r() * c.height, 2, 2);
  }
  // pistas: tramos en 0° y 45°, como las rutea un programa de PCB
  ctx.lineCap = "round";
  for (let i = 0; i < 260; i++) {
    let x = r() * c.width, y = r() * c.height;
    ctx.strokeStyle = `rgba(58,78,68,${0.25 + r() * 0.35})`;
    ctx.lineWidth = r() > 0.85 ? 3 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      const len = 30 + r() * 160;
      const dir = Math.floor(r() * 8) * (Math.PI / 4);
      x += Math.cos(dir) * len;
      y += Math.sin(dir) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(170,160,120,0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // componentes SMD pequeños
  for (let i = 0; i < 520; i++) {
    const w = 6 + r() * 10, h = 3 + r() * 5;
    const x = r() * c.width, y = r() * c.height;
    ctx.fillStyle = r() > 0.5 ? "#2a2724" : "#1b1d1c";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9c9a92";
    ctx.fillRect(x - 1.5, y, 1.5, h);
    ctx.fillRect(x + w, y, 1.5, h);
  }
  // barrenos de montaje
  const holes: [number, number][] = [[-1.18, 1.48], [0.2, 1.48], [1.18, 1.48], [-1.18, 0.05], [0.2, 0.05], [1.18, 0.05], [-1.18, -1.45], [0.2, -1.45], [1.18, -1.45]];
  for (const [x, y] of holes) {
    ctx.fillStyle = "#b8b3a2";
    ctx.beginPath();
    ctx.arc(px(x), py(y), 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#050605";
    ctx.beginPath();
    ctx.arc(px(x), py(y), 11, 0, Math.PI * 2);
    ctx.fill();
  }
  // serigrafía
  ctx.fillStyle = "rgba(230,232,226,0.62)";
  ctx.font = `600 26px ${FONT}`;
  const silk: [string, number, number][] = [
    ["AM5", -0.68, 1.22], ["DDR5_A1", 0.36, 1.68], ["DDR5_A2", 0.46, 1.68], ["DDR5_B1", 0.56, 1.68], ["DDR5_B2", 0.66, 1.68],
    ["PCIEX16_1", -1.0, -0.24], ["M2_1", -0.95, 0.2], ["CPU_FAN", -0.05, 1.83], ["ATX_24P", 0.98, -0.05], ["EPS_8P", -1.25, 1.83],
    ["SYS_FAN1", 0.85, -1.4], ["BIOS", 0.4, -1.05], ["F_PANEL", 0.6, -1.52], ["AUDIO", -1.15, -1.3],
  ];
  for (const [t, x, y] of silk) ctx.fillText(t, px(x), py(y));
  ctx.strokeStyle = "rgba(230,232,226,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px(-0.5), py(1.22), 0.6 * PCB.ppu, 0.6 * PCB.ppu);
  return srgb(THREE, c, aniso);
}

// Texto suelto sobre fondo transparente o de color.
export function textTexture(
  THREE: Three,
  lines: { text: string; size: number; color: string; weight?: number; font?: string; track?: number }[],
  w: number,
  h: number,
  aniso: number,
  bg?: string,
) {
  const [c, ctx] = canvas(w, h);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const total = lines.reduce((s, l) => s + l.size * 1.2, 0);
  let y = (h - total) / 2;
  for (const l of lines) {
    ctx.fillStyle = l.color;
    ctx.font = `${l.weight ?? 700} ${l.size}px ${l.font ?? "'Funnel Display Variable', sans-serif"}`;
    if ("letterSpacing" in ctx && l.track) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.track}px`;
    y += l.size * 0.6;
    ctx.fillText(l.text, w / 2, y);
    y += l.size * 0.6;
  }
  return srgb(THREE, c, aniso);
}

// Malla hexagonal para el frente y el filtro de polvo: blanco = metal, negro = hueco.
export function meshAlpha(THREE: Three, aniso: number) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#000";
  const s = 32, rr = 12.5;
  for (let row = -1; row < 10; row++) {
    for (let col = -1; col < 10; col++) {
      const x = col * s + (row % 2 ? s / 2 : 0);
      const y = row * s * 0.866;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// Rayado del aluminio cepillado, como mapa de rugosidad.
export function brushed(THREE: Three, aniso: number) {
  const [c, ctx] = canvas(512, 512);
  const r = rng(3);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) {
    const v = 90 + r() * 90;
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.fillRect(0, r() * 512, 512, 1 + r() * 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// Malla trenzada de los cables.
export function sleeve(THREE: Three, aniso: number, base: string, line: string) {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  for (let i = -64; i < 128; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + 64, 0); ctx.lineTo(i, 64); ctx.stroke();
  }
  const t = srgb(THREE, c, aniso);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Sombra de contacto: un degradado radial bajo el gabinete.
export function contactShadow(THREE: Three) {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.95)");
  g.addColorStop(0.55, "rgba(0,0,0,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Puertos de video del bracket de la tarjeta gráfica.
export function bracketTexture(THREE: Three, aniso: number) {
  const [c, ctx] = canvas(128, 512);
  ctx.fillStyle = "#b9bec0";
  ctx.fillRect(0, 0, 128, 512);
  ctx.fillStyle = "#0b0c0c";
  [70, 150, 230].forEach((y) => ctx.fillRect(34, y, 60, 46));
  ctx.fillRect(40, 310, 48, 40);
  for (let i = 0; i < 10; i++) ctx.fillRect(28 + (i % 2) * 40, 380 + Math.floor(i / 2) * 22, 28, 12);
  return srgb(THREE, c, aniso);
}
