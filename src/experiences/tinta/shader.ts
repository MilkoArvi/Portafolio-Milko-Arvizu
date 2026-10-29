import { GLSL_COMMON } from "@/lib/gl";

// Simulación sencilla de tinta: velocidad y tinta en texturas que se
// realimentan cada cuadro. La tinta gruesa gotea por gravedad.

export const SPLAT_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_point;
uniform vec3 u_value;
uniform float u_radius;
uniform float u_aspect;
void main() {
  vec2 d = vUv - u_point; d.x *= u_aspect;
  vec3 base = texture(u_src, vUv).xyz;
  o = vec4(base + u_value * exp(-dot(d, d) / u_radius), 1.0);
}`;

export const VELOCITY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D u_vel;
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform float u_dt;
void main() {
  vec2 v0 = texture(u_vel, vUv).xy;
  vec2 v = texture(u_vel, vUv - u_dt * v0).xy;
  // viscosidad: promedio con vecinos
  vec2 avg = 0.25 * (texture(u_vel, vUv + vec2(u_texel.x, 0)).xy + texture(u_vel, vUv - vec2(u_texel.x, 0)).xy
                   + texture(u_vel, vUv + vec2(0, u_texel.y)).xy + texture(u_vel, vUv - vec2(0, u_texel.y)).xy);
  v = mix(v, avg, 0.3);
  float d = texture(u_dye, vUv).x;
  // gravedad: solo la tinta acumulada gotea
  v.y -= 0.35 * smoothstep(0.9, 2.2, d) * u_dt;
  v *= pow(0.12, u_dt);
  o = vec4(v, 0.0, 1.0);
}`;

export const DYE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D u_vel;
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform float u_dt;
void main() {
  vec2 v = texture(u_vel, vUv).xy;
  float d = texture(u_dye, vUv - u_dt * v).x;
  float avg = 0.25 * (texture(u_dye, vUv + vec2(u_texel.x, 0)).x + texture(u_dye, vUv - vec2(u_texel.x, 0)).x
                    + texture(u_dye, vUv + vec2(0, u_texel.y)).x + texture(u_dye, vUv - vec2(0, u_texel.y)).x);
  d = mix(d, avg, 0.06);
  o = vec4(min(d, 4.0), 0.0, 0.0, 1.0);
}`;

export const DISPLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D u_dye;
uniform sampler2D u_text;
uniform vec2 u_res;
uniform vec2 u_texel;
uniform float u_time;
uniform float u_dpr;

const vec3 PAPER = vec3(0.949, 0.929, 0.890);
const vec3 INK   = vec3(0.055, 0.035, 0.040);
const vec3 WOOD  = vec3(0.47, 0.075, 0.13);
const vec3 RED   = vec3(0.93, 0.08, 0.07);

${GLSL_COMMON}

float dyeAt(vec2 uv) { return texture(u_dye, uv).x; }

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 p = (px - 0.5 * u_res) / u_res.y;
  // madera: vetas negras sobre carmín, con nudos
  vec2 kn = vec2(0.35, 0.18);
  float knot = exp(-dot(p - kn, p - kn) * 40.0);
  vec2 kp = p - kn;
  float g = p.x * 9.0 + 2.2 * fbm(vec2(p.x * 1.1, p.y * 0.32)) + 0.5 * fbm(p * 3.0) + knot * (length(kp * vec2(1.0, 0.6)) * 30.0);
  float lf = abs(fract(g) - 0.5);
  float w = 0.018 + 0.11 * pow(vnoise(vec2(g * 0.7, p.y * 1.6)), 2.0);
  float aa = fwidth(g) * 0.8;
  float grain = 1.0 - smoothstep(w - aa, w + aa, lf);
  vec3 col = mix(WOOD, INK, grain);
  float fine = abs(fract(px.x / (3.0 * u_dpr) + 0.3 * vnoise(px * 0.01)) - 0.5);
  col = mix(col, col * 0.82, (1.0 - smoothstep(0.1, 0.2, fine)) * 0.5);
  col *= 0.88 + 0.12 * smoothstep(1.1, 0.2, length(p));

  // tinta
  vec2 uv = vUv;
  float d = dyeAt(uv);
  float dx = dyeAt(uv + vec2(u_texel.x, 0)) - dyeAt(uv - vec2(u_texel.x, 0));
  float dy = dyeAt(uv + vec2(0, u_texel.y)) - dyeAt(uv - vec2(0, u_texel.y));
  float ink = smoothstep(0.32, 0.42, d);
  vec3 n = normalize(vec3(-dx * 2.5, -dy * 2.5, 1.0));
  vec3 L = normalize(vec3(-0.4, 0.6, 0.7));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0, 1.0), 40.0);
  vec3 inkCol = mix(RED * 0.55, RED, smoothstep(0.35, 1.1, d)) * (0.75 + 0.35 * diff);
  // el cartel aparece en papel dentro de la tinta
  float txt = texture(u_text, uv).r;
  inkCol = mix(inkCol, PAPER * (0.9 + 0.1 * diff), txt);
  inkCol += spec * 0.75 * (1.0 - txt * 0.6);
  // borde oscuro de la mancha
  float rim = smoothstep(0.32, 0.36, d) - smoothstep(0.36, 0.5, d);
  inkCol = mix(inkCol, INK, rim * 0.35);
  col = mix(col, inkCol, ink);
  o = vec4(col, 1.0);
}`;
