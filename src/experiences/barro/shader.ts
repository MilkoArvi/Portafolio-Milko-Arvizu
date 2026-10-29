import { GLSL_COMMON } from "@/lib/gl";

// Cortina de líneas que se derrite mientras mantienes presionado,
// y una vasija de barro "torneada" en el shader que gira despacio.

export const BARRO_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform float u_hold;  // 0→1 mientras se mantiene presionado
uniform float u_done;  // 0→1 después de completar
uniform float u_dpr;
uniform float u_motion;
uniform vec2 u_mouse;

const vec3 PAPER = vec3(0.949, 0.929, 0.890);
const vec3 INK   = vec3(0.071, 0.063, 0.063);
const vec3 RED   = vec3(0.862, 0.165, 0.110);
const vec3 CLAY  = vec3(0.690, 0.290, 0.180);
const vec3 COBALT= vec3(0.137, 0.275, 0.788);

${GLSL_COMMON}

float pitch() { return 3.2 * u_dpr; }
float stroke(float d, float w) { float aa = fwidth(d); return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }

// Perfil de la vasija: radio según la altura normalizada s (0 base, 1 boca).
float profile(float s) {
  float belly = pow(sin(3.14159 * clamp(s * 1.02, 0.0, 1.0)), 0.85);
  return 0.085 + 0.175 * belly - 0.07 * smoothstep(0.62, 0.9, s) + 0.05 * smoothstep(0.9, 1.0, s);
}

vec3 vase(vec2 p, vec2 px, float t, float heat, out float inside) {
  const float y0 = -0.36, y1 = 0.33;
  float s = (p.y - y0) / (y1 - y0);
  float r = profile(s);
  float d = abs(p.x) - r;
  d = max(d, max(y0 - p.y, p.y - y1));
  inside = 1.0 - smoothstep(-fwidth(d), fwidth(d), d);
  float nx = clamp(p.x / max(r, 1e-3), -1.0, 1.0);
  float nz = sqrt(max(0.0, 1.0 - nx * nx));
  // inclinación aproximada de la superficie por el cambio de radio
  float dr = (profile(s + 0.01) - profile(s - 0.01)) / 0.02 / (y1 - y0);
  vec3 n = normalize(vec3(nx * nz, -dr * 0.6, nz));
  vec3 L = normalize(vec3(-0.55 + (u_mouse.x - 0.5) * 0.8 * u_motion, 0.35 + (u_mouse.y - 0.5) * 0.5 * u_motion, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float rim = pow(1.0 - nz, 3.0);
  // líneas de grabado que siguen el contorno (se curvan como elipses)
  float lc = (p.y - 0.03 * nz) * u_res.y / pitch();
  float lf = abs(fract(lc) - 0.5);
  float dark = clamp(0.95 - diff * 1.05 + rim * 0.35, 0.0, 1.0);
  float aa = fwidth(lc);
  float lines = 1.0 - smoothstep(dark * 0.5 - aa, dark * 0.5 + aa, lf);
  // ángulo alrededor del eje, para que el patrón gire con la pieza
  float th = asin(nx) + t * 0.35;
  vec3 body = CLAY;
  // banda bruñida con motivo de aves estilizadas
  float band = smoothstep(0.43, 0.44, s) * (1.0 - smoothstep(0.66, 0.67, s));
  float bs = (s - 0.43) / 0.24;
  float u = th * 6.0 / 3.14159;
  vec2 cell = vec2(fract(u) - 0.5, bs - 0.5);
  float wing = abs(cell.y + 0.18 * cos(cell.x * 6.2831)) - 0.05;
  float bird = max(wing, abs(cell.x) - 0.36);
  float dotm = length(vec2(fract(u + 0.5) - 0.5, (bs - 0.12) * 2.0)) - 0.09;
  float motif = min(bird, dotm);
  vec3 bandCol = mix(PAPER, COBALT, 1.0 - smoothstep(-0.02, 0.02, motif));
  body = mix(body, bandCol, band * step(0.0, nz - 0.08));
  body = mix(body, INK, (stroke(s - 0.43, 0.004) + stroke(s - 0.67, 0.004)) * 0.9);
  // líneas verticales del bruñido
  float burn = abs(fract(th * 18.0 / 3.14159) - 0.5);
  body = mix(body, body * 0.82, (1.0 - smoothstep(0.03, 0.08, burn)) * (1.0 - band) * 0.6);
  vec3 col = mix(body, INK, lines);
  // brillo del bruñido
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0, 1.0), 24.0);
  col = mix(col, PAPER, spec * 0.85 * (1.0 - band));
  // boca: interior oscuro
  float mouth = length((p - vec2(0.0, y1)) * vec2(1.0, 4.5)) - profile(1.0) * 0.92;
  col = mix(col, INK, 1.0 - smoothstep(-0.002, 0.002, mouth));
  // calor del horno: la pieza brilla roja y se va enfriando
  vec3 hot = mix(RED, PAPER, pow(diff, 3.0));
  col = mix(col, hot, heat * 0.85);
  col = mix(col, INK, stroke(d, 1.2 * u_dpr / u_res.y));
  return col;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res;
  float t = u_time * u_motion;
  float h = u_hold;
  // ondas de calor mientras se hornea
  float haze = (h * (1.0 - u_done)) * 0.006 * u_motion;
  vec2 hp = px + vec2(sin(px.y * 0.05 / u_dpr + t * 6.0), 0.0) * haze * u_res.y;
  vec2 p = (hp - 0.5 * u_res) / u_res.y;
  p.y += 0.02;
  // en pantallas anchas la pieza se corre a la derecha del texto; en vertical sube
  float asp = u_res.x / u_res.y;
  if (asp > 1.2) p.x -= 0.2 * min(asp - 1.0, 0.7);
  if (asp < 1.0) { p *= 1.3; p.y -= 0.2; }
  p *= 1.08;

  // escena revelada: papel, piso y la vasija
  vec3 col = mix(PAPER, INK, engrave(px, 0.035 + 0.04 * fbm(px * 0.003), pitch() * 2.0, 1.5708, 0.2 * vnoise(vec2(px.x * 0.03, px.y * 0.002))));
  float floorY = -0.38;
  if (p.y < floorY) col = mix(PAPER, INK, engrave(px, 0.22 + 0.5 * smoothstep(0.0, 0.25, floorY - p.y), pitch(), 0.0, 0.0));
  float sh = length((p - vec2(0.08, floorY)) * vec2(1.0, 5.5)) - 0.24;
  col = mix(col, INK, (1.0 - smoothstep(-0.01, 0.01, sh)) * engrave(px, 0.7, pitch() * 0.7, 0.5, 0.0));
  float inside;
  float heat = clamp(1.0 - u_done * 1.2, 0.0, 1.0) * smoothstep(0.2, 1.0, h);
  vec3 v = vase(p, hp, t, heat, inside);
  col = mix(col, v, inside);

  // cortina de líneas rojas que se derrite hacia abajo
  float colW = 4.0 * u_dpr;
  float cid = floor(px.x / colW);
  float r = hash11(cid * 0.731 + 1.7);
  float r2 = hash11(cid * 3.17);
  float fall = pow(h, 1.6) * 1.7 - r * 0.55 - r2 * 0.15;
  float top = 1.0 - clamp(fall, 0.0, 1.2);   // borde superior de la cortina en uv.y
  float inCurtain = step(uv.y, top);
  float thick = 0.25 + 0.6 * fbm(vec2(cid * 0.09, uv.y * 0.6 + t * 0.03)) + 0.25 * sin(cid * 0.35 + t * 0.4);
  float lineC = abs(fract(px.x / colW) - 0.5);
  float redLine = 1.0 - smoothstep(thick * 0.5 - 0.08, thick * 0.5 + 0.08, lineC);
  vec3 curtain = mix(INK, RED, redLine * (0.55 + 0.45 * smoothstep(0.0, 0.6, uv.y)));
  // cabeza de la gota en el borde
  float head = smoothstep(0.035, 0.0, top - uv.y) * step(uv.y, top);
  curtain = mix(curtain, RED * 1.08, head * redLine);
  col = mix(col, curtain, inCurtain);
  o = vec4(col, 1.0);
}`;
