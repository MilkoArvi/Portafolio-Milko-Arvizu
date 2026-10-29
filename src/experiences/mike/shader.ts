// Agujero negro de Schwarzschild trazado por píxel.
// Unidades: el radio de Schwarzschild vale 1. Cada rayo sale de la cámara y se curva con
// la aceleración exacta de un fotón (-1.5 h² r / |r|⁵), así aparecen solos la sombra,
// el anillo de fotones y el disco de atrás doblado por encima y por debajo.
// El disco usa temperatura de un disco delgado, corrimiento Doppler y corrimiento gravitacional.

export const BLACKHOLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;

uniform vec2 u_res;
uniform float u_time;
uniform float u_spin;     // fase del giro del disco (se integra en JS)
uniform float u_energy;   // 0 reposo, 1 Mike hablando
uniform vec2 u_look;      // paralaje del puntero, -1..1
uniform vec2 u_shift;     // corrimiento del centro en pantalla
uniform float u_dist;     // distancia de la cámara
uniform float u_fov;      // focal
uniform float u_stars;    // 1 con fondo de estrellas, 0 transparente
uniform int u_steps;

const float R_IN = 2.6;
const float R_OUT = 13.0;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; }
  return v;
}

// Color de cuerpo negro (kelvin) en RGB lineal. Aproximación de Tanner Helland.
vec3 blackbody(float k) {
  float t = clamp(k, 1000.0, 40000.0) / 100.0;
  vec3 c;
  c.r = t <= 66.0 ? 1.0 : clamp(1.292936186 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
  c.g = t <= 66.0 ? clamp(0.3900815788 * log(t) - 0.6318414438, 0.0, 1.0) : clamp(1.129890861 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432067891 * log(t - 10.0) - 1.19625408914, 0.0, 1.0));
  return pow(c, vec3(2.2));
}

vec3 starfield(vec3 d) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float scale = l == 0 ? 70.0 : 170.0;
    vec3 q = d * scale;
    vec3 id = floor(q);
    float h = hash13(id + float(l) * 19.7);
    if (h > 0.9) {
      vec3 jit = vec3(hash13(id + 1.3), hash13(id + 2.7), hash13(id + 5.1)) - 0.5;
      float dist = length(fract(q) - 0.5 - jit * 0.55);
      float size = mix(0.05, 0.13, hash13(id + 9.1));
      float b = smoothstep(size, 0.0, dist);
      float twinkle = 0.75 + 0.25 * sin(u_time * (1.0 + h * 3.0) + h * 40.0);
      col += blackbody(mix(3200.0, 14000.0, hash13(id + 4.4))) * b * b * pow((h - 0.9) * 10.0, 2.0) * (l == 0 ? 3.0 : 1.4) * twinkle;
    }
  }
  // polvo de la galaxia, muy tenue, para que el lente se note también en el fondo
  float n = fbm(d.xy * 2.3 + d.z * 1.7);
  float band = exp(-pow((d.y - 0.18 * d.x) * 2.6, 2.0));
  col += (vec3(0.16, 0.1, 0.07) * n * n * band + vec3(0.012, 0.014, 0.02) * n) * 0.9;
  return col;
}

// Textura del disco con rotación diferencial. Dos fases que se cruzan evitan que
// el giro enrolle la textura sin fin con el paso de los minutos.
float diskTexture(vec2 xz, float r, float phase) {
  float w = phase * pow(R_IN / r, 1.5);
  float c = cos(w), s = sin(w);
  vec2 q = mat2(c, -s, s, c) * xz;
  float rings = fbm(vec2(r * 2.6, 0.5));
  float clumps = fbm(q * 0.85);
  float fine = vnoise(q * 3.1 + r);
  return rings * 0.55 + clumps * 0.75 + fine * 0.2;
}

vec4 disk(vec3 hp, float r, vec3 rayDir) {
  // Doppler relativista: el lado que viene hacia nosotros se ve más brillante y más azul
  float beta = sqrt(0.5 / (r - 1.0));
  vec3 tangent = normalize(vec3(-hp.z, 0.0, hp.x));
  float gamma = inversesqrt(1.0 - beta * beta);
  float cosT = dot(tangent, -rayDir);
  float dop = 1.0 / (gamma * (1.0 - beta * cosT));
  float g = dop * sqrt(max(0.0, 1.0 - 1.0 / r));

  // temperatura de un disco delgado, más caliente cerca del borde interno
  float x = R_IN / r;
  float temp = 6200.0 * pow(x, 0.75) * pow(max(0.02, 1.0 - sqrt(x * 0.9)), 0.25) * 1.65 * (1.0 + u_energy * 0.6);

  float period = 40.0;
  float a = mod(u_spin, period), b = mod(u_spin + period * 0.5, period);
  float blend = abs(a / period - 0.5) * 2.0;
  float tex = mix(diskTexture(hp.xz, r, a), diskTexture(hp.xz, r, b + 97.0), blend);

  float edgeIn = smoothstep(R_IN, R_IN + 0.9, r);
  float edgeOut = 1.0 - smoothstep(R_OUT * 0.45, R_OUT, r);
  float dens = edgeIn * edgeOut * clamp(tex * 1.35 - 0.25, 0.0, 1.0);

  vec3 emit = blackbody(temp * g) * pow(g, 3.0) * pow(x, 1.25) * dens * (3.4 + 3.0 * u_energy);
  return vec4(emit, clamp(dens * 0.9, 0.0, 0.96));
}

void main() {
  // normalizamos por el lado corto: en vertical el disco no se sale de la pantalla
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y) - u_shift;

  float yaw = u_look.x * 0.22 + sin(u_time * 0.05) * 0.06;
  float pitch = 0.085 + u_look.y * 0.05;
  vec3 cam = u_dist * vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch));
  vec3 fw = normalize(-cam);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  float roll = -0.1;
  uv = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;
  vec3 dir = normalize(fw * u_fov + rt * uv.x + up * uv.y);

  vec3 p = cam;
  vec3 v = dir;
  float h2 = dot(cross(p, v), cross(p, v));
  vec3 col = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  vec3 haloCol = blackbody(4200.0 + u_energy * 2500.0) * 0.022 * (1.0 + u_energy);

  for (int i = 0; i < 400; i++) {
    if (i >= u_steps) break;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    float dt = clamp((r - 1.0) * 0.11, 0.015, 0.85);
    vec3 prev = p;
    v += -1.5 * h2 * p / (r2 * r2 * r) * dt;
    p += v * dt;

    // cruce del plano del disco: el disco es delgado, así que basta el cambio de signo
    if (prev.y * p.y < 0.0) {
      vec3 hp = mix(prev, p, prev.y / (prev.y - p.y));
      float hr = length(hp.xz);
      if (hr > R_IN && hr < R_OUT) {
        vec4 d = disk(hp, hr, normalize(v));
        col += trans * d.rgb;
        trans *= 1.0 - d.a;
        if (trans < 0.02) break;
      }
    }
    // resplandor tenue sobre el disco, le da grosor sin costo de volumen
    float hr2 = length(p.xz);
    if (hr2 > R_IN && hr2 < R_OUT * 0.8) {
      float halo = exp(-abs(p.y) * 6.0) * smoothstep(R_IN, R_IN + 2.0, hr2) * (1.0 - smoothstep(4.0, R_OUT * 0.8, hr2));
      col += trans * dt * halo * haloCol;
    }
    if (r2 < 1.0) { captured = true; break; }
    if (r2 > 1600.0 && dot(p, v) > 0.0) break;
  }

  if (!captured) col += trans * starfield(normalize(v)) * u_stars;

  // tonemapping ACES y salida en sRGB
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  // grano fino para que el degradado no se escalone
  col += (hash12(gl_FragCoord.xy + fract(u_time) * 91.0) - 0.5) / 255.0;

  // sin estrellas el canvas es transparente; el color va premultiplicado y nunca supera al alfa
  float alpha = u_stars > 0.5 || captured ? 1.0 : clamp(max(1.0 - trans, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  o = vec4(col, alpha);
}`;
