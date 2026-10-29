// Fondo de la bebida: estás dentro del jugo. Tres tonos de líquido, haces de luz que entran
// desde la superficie, cáusticas y burbujas de gas en cuatro profundidades.

export const JUICE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_top;
uniform vec3 u_mid;
uniform vec3 u_bot;
uniform float u_fizz;   // 0 agua quieta, 1 refresco recién abierto
uniform float u_rise;   // empuje extra de las burbujas al hacer scroll

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2((uv.x - 0.5) * asp, uv.y);
  float t = u_time;

  // cuerpo del jugo: más oscuro al fondo, turbulencia lenta
  float n = fbm(p * 1.4 + vec2(0.0, -t * 0.025));
  float y = uv.y + (n - 0.5) * 0.14;
  vec3 col = mix(u_bot, u_mid, smoothstep(-0.05, 0.6, y));
  col = mix(col, u_top, smoothstep(0.5, 1.1, y));

  // haces de luz desde la superficie
  float rays = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x = p.x * (1.1 + fi * 0.6) + p.y * (0.3 - fi * 0.18) + sin(t * 0.11 + fi * 2.1) * 0.5;
    rays += pow(0.5 + 0.5 * sin(x * 3.3 + fi * 1.7), 12.0);
  }
  col += u_top * rays * 0.07 * smoothstep(0.05, 1.0, uv.y);

  // cáusticas: crestas de luz que se mueven cerca de la superficie
  vec2 cq = p * 4.5 + vec2(t * 0.12, -t * 0.08);
  float c1 = 1.0 - abs(vnoise(cq) * 2.0 - 1.0);
  float c2 = 1.0 - abs(vnoise(cq * 1.8 + 4.0 + t * 0.15) * 2.0 - 1.0);
  col += mix(u_top, vec3(1.0), 0.4) * (pow(c1, 9.0) + pow(c2, 12.0) * 0.6) * 0.11 * smoothstep(0.3, 1.0, uv.y);

  // burbujas fuera de foco, como detrás de un producto fotografiado con poca profundidad de campo
  for (int l = 0; l < 4; l++) {
    float fl = float(l) / 3.0;
    float scale = mix(30.0, 7.5, fl);
    float speed = mix(0.04, 0.2, fl) * (0.5 + u_fizz * 0.9) + u_rise * mix(0.02, 0.08, fl);
    vec2 q = p * scale;
    q.y -= t * speed * scale;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id + float(l) * 31.7);
    if (h > 1.0 - mix(0.1, 0.3, u_fizz) * mix(1.0, 0.7, fl)) {
      float r = mix(0.1, 0.3, hash(id + 2.3));
      vec2 c = (vec2(hash(id + 5.1), hash(id + 7.9)) - 0.5) * (0.9 - 2.0 * r);
      c.x += sin(t * (1.4 + h * 2.0) + h * 40.0) * 0.07;
      vec2 d = f - c;
      float dist = length(d);
      float soft = mix(0.42, 0.3, fl) * r + fwidth(dist) * 1.2;
      float inside = 1.0 - smoothstep(r - soft, r, dist);
      float rim = inside * smoothstep(r * 0.5, r, dist);
      float hl = 1.0 - smoothstep(0.0, r * 0.45, length(d - vec2(-0.3, 0.34) * r));
      float a = mix(0.35, 1.0, fl);
      col = mix(col, col * 0.88 + u_top * 0.22, inside * 0.4 * a);
      col += (rim * 0.22 + hl * 0.45) * a * mix(vec3(1.0), u_top, 0.3);
    }
  }

  // viñeta y grano fino contra el bandeo de los degradados
  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.45;
  col += (hash(gl_FragCoord.xy + fract(t) * 37.0) - 0.5) / 160.0;
  o = vec4(col, 1.0);
}`;
