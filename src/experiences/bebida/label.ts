// Etiquetas de la lata, dibujadas con Canvas 2D (no hay imágenes).
// Hay dos capas: la tinta (color) y una máscara de aluminio sin tinta, que en 3D brilla como metal.

export type Flavor = {
  id: string;
  name: string;
  short: string;
  notes: string;
  bg: string; // respaldo del fondo si no hay WebGL
  juice: [string, string, string]; // jugo: superficie con luz, cuerpo y fondo
  can: string; // tinta de la lata
  ink: string; // texto sobre la lata
  accent: string;
  text: string; // color del texto de la página sobre el jugo
};

export const FLAVORS: Flavor[] = [
  { id: "jamaica", name: "Jamaica y cardamomo", short: "JAMAICA", notes: "Flor de jamaica de Guerrero, cardamomo verde y un toque de limón.", bg: "#7c1230", juice: ["#d63a5e", "#8e1235", "#3d0414"], can: "#9e2f43", ink: "#f8e9ea", accent: "#f2c9bd", text: "#fff3f4" },
  { id: "pepino", name: "Pepino y menta", short: "PEPINO", notes: "Pepino recién prensado, hierbabuena y agua mineral de manantial.", bg: "#5f9a5c", juice: ["#c7ec9e", "#6fae5f", "#22512d"], can: "#3f7a55", ink: "#eef6ea", accent: "#cfe3c6", text: "#f4fbef" },
  { id: "toronja", name: "Toronja y romero", short: "TORONJA", notes: "Toronja rosada, romero tostado y una pizca de sal de Colima.", bg: "#e7735d", juice: ["#ffc49a", "#f0745e", "#a8303a"], can: "#d0613f", ink: "#fff1e6", accent: "#f6d4b5", text: "#fff6ee" },
];

// Agua mineral de la portada y el cierre.
export const WATER: [string, string, string] = ["#f6f3ea", "#e3e0d4", "#c8c9bc"];

// Hojas en línea fina. Las mismas posiciones sirven para la tinta y para la máscara de metal.
const LEAVES = Array.from({ length: 9 }, (_, i) => ({ x: 0.55 + 0.05 * i, y: 0.25 + (i % 3) * 0.2, len: 0.16 + (i % 2) * 0.07, ang: -0.9 + i * 0.4 }));

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = color;
  ctx.lineWidth = len * 0.035;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -len * 0.28, len * 0.75, -len * 0.22, len, 0);
  ctx.bezierCurveTo(len * 0.75, len * 0.22, len * 0.3, len * 0.28, 0, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.92, 0);
  ctx.stroke();
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(len * t, 0);
    ctx.lineTo(len * (t + 0.08), -len * 0.12 * (1 - Math.abs(t - 0.5)));
    ctx.moveTo(len * t, 0);
    ctx.lineTo(len * (t + 0.08), len * 0.12 * (1 - Math.abs(t - 0.5)));
    ctx.stroke();
  }
  ctx.restore();
}

const SILVER = "#e4e8ea";

export function drawLabel(f: Flavor, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // tinta con un leve degradado de impresión
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, f.can);
  g.addColorStop(1, shade(f.can, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }

  // hojas: aluminio sin tinta (la máscara las vuelve metálicas)
  for (const l of LEAVES) leaf(ctx, w * l.x, h * l.y, h * l.len, l.ang, SILVER);

  // marca en vertical
  ctx.save();
  ctx.translate(w * 0.17, h * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = f.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${h * 0.26}px 'Funnel Display Variable', sans-serif`;
  ctx.fillText("calma", 0, 0);
  ctx.restore();

  // sabor y datos
  ctx.fillStyle = f.ink;
  ctx.textAlign = "left";
  ctx.font = `700 ${h * 0.06}px 'Funnel Display Variable', sans-serif`;
  ctx.fillText(f.short, w * 0.28, h * 0.32);
  ctx.font = `400 ${h * 0.034}px 'Funnel Sans Variable', sans-serif`;
  ctx.fillText(f.name.toLowerCase(), w * 0.28, h * 0.38);
  ctx.fillText("agua botánica con gas", w * 0.28, h * 0.43);
  ctx.font = `600 ${h * 0.03}px 'Funnel Sans Variable', sans-serif`;
  ctx.fillText("355 ml", w * 0.28, h * 0.8);

  // dorso: tabla nutrimental, código de barras y reciclaje
  ctx.globalAlpha = 0.82;
  ctx.font = `400 ${h * 0.02}px 'Funnel Sans Variable', sans-serif`;
  ["Sin azúcar añadida", "Hecha en Jalisco", "Marca ficticia de portafolio"].forEach((t, i) => ctx.fillText(t, w * 0.78, h * (0.62 + i * 0.032)));
  const tx = w * 0.78, ty = h * 0.24;
  ctx.font = `700 ${h * 0.022}px 'Funnel Sans Variable', sans-serif`;
  ctx.fillText("Información nutrimental", tx, ty);
  ctx.font = `400 ${h * 0.018}px 'Funnel Sans Variable', sans-serif`;
  [["Contenido energético", "8 kcal"], ["Grasas", "0 g"], ["Carbohidratos", "2 g"], ["Sodio", "12 mg"]].forEach(([k, v], i) => {
    const y = ty + h * (0.035 + i * 0.028);
    ctx.fillText(k, tx, y);
    ctx.fillText(v, tx + w * 0.12, y);
    ctx.fillRect(tx, y + h * 0.008, w * 0.15, 1);
  });
  ctx.globalAlpha = 1;
  // código de barras sobre un recuadro claro
  const bx = w * 0.78, by = h * 0.76, bw = w * 0.11, bh = h * 0.1;
  ctx.fillStyle = "#f4f2ee";
  ctx.fillRect(bx - 8, by - 8, bw + 16, bh + 30);
  ctx.fillStyle = "#111";
  let x = bx;
  const r = mulberry(f.id.length * 97);
  while (x < bx + bw) { const bar = 1 + Math.floor(r() * 4); if (r() > 0.45) ctx.fillRect(x, by, bar, bh); x += bar + 1 + Math.floor(r() * 3); }
  ctx.font = `500 ${h * 0.016}px 'JetBrains Mono Variable', monospace`;
  ctx.fillText("7 501234 56789 0", bx, by + bh + 18);
  // sello de reciclaje
  ctx.strokeStyle = f.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.94, h * 0.84, h * 0.028, 0, Math.PI * 1.7);
  ctx.stroke();
  ctx.font = `700 ${h * 0.016}px 'Funnel Sans Variable', sans-serif`;
  ctx.fillStyle = f.ink;
  ctx.textAlign = "center";
  ctx.fillText("ALU", w * 0.94, h * 0.846);
  return c;
}

// Máscara de aluminio sin tinta: blanco = metal desnudo.
export function drawMetalMask(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  for (const l of LEAVES) leaf(ctx, w * l.x, h * l.y, h * l.len, l.ang, "#fff");
  return c;
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + k))));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function mulberry(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
