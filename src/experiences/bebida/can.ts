import type * as T from "three";
import { field, makeNoise, normalCanvas, tex } from "@/lib/procedural";
import { drawLabel, drawMetalMask, FLAVORS } from "./label";
import { DROPS_CAUSTIC, DROPS_CLEARCOAT, DROPS_CLEARCOAT_NORMAL, DROPS_MAP, DROPS_NORMAL, DROPS_PARS, DROPS_PBR, surfaceCanvas } from "./condensation";

// La lata de Calma: perfil real de una lata de 355 ml (fondo en domo, cuello escalonado,
// borde enrollado), tapa con anillo, remache y línea de apertura, tinta metálica bajo barniz
// y el sudor de una lata recién sacada del refri: neblina, gotas que bajan y gotas que caen.

type Key = { x: number; y: number; rx: number; ry: number; rz: number; s: number };
const TAU = Math.PI * 2;
// Una pose por sección: portada, tres sabores y cierre.
const POSES: Key[] = [
  { x: 0, y: -0.05, rx: 0.32, ry: 0.3, rz: -0.14, s: 1 },
  { x: -1, y: 0, rx: 0.36, ry: TAU + 0.5, rz: 0.32, s: 1.02 },
  { x: 1, y: 0, rx: -0.2, ry: TAU * 2 + 0.2, rz: -0.38, s: 1.02 },
  { x: -1, y: 0, rx: 0.3, ry: TAU * 3 + 0.6, rz: 0.3, s: 1.02 },
  { x: 0, y: -0.1, rx: 0.9, ry: TAU * 4 + 0.4, rz: Math.PI / 2 - 0.25, s: 0.92 },
];
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function poseAt(p: number): Key & { label: number } {
  const seg = Math.min(POSES.length - 2, Math.floor(p * (POSES.length - 1)));
  const local = smoothstep(Math.min(1, Math.max(0, p * (POSES.length - 1) - seg)));
  const a = POSES[seg], b = POSES[seg + 1];
  const mix = (k: keyof Key) => a[k] + (b[k] - a[k]) * local;
  // La etiqueta cambia a medio giro, cuando el frente mira hacia atrás.
  const label = Math.min(2, Math.max(0, Math.round(p * (POSES.length - 1)) - 1));
  return { x: mix("x"), y: mix("y"), rx: mix("rx"), ry: mix("ry"), rz: mix("rz"), s: mix("s"), label };
}

export async function createCanScene({ host, progress }: { host: HTMLElement; progress: () => number }) {
  const THREE = await import("three");
  await Promise.all([
    document.fonts.load("800 40px 'Funnel Display Variable'"),
    document.fonts.load("400 20px 'Funnel Sans Variable'"),
    document.fonts.load("500 20px 'JetBrains Mono Variable'"),
  ]).catch(() => {});

  const small = window.matchMedia("(max-width: 768px)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "absolute inset-0 block h-full w-full";
  canvas.style.touchAction = "pan-y";
  host.appendChild(canvas);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // Estudio de producto: softboxes altos a los lados (las franjas de luz verticales de una lata real),
  // uno grande arriba y una tira de contraluz.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  // fondo gris medio: el aluminio sin tinta y la tapa necesitan algo claro que reflejar desde cualquier ángulo
  env.background = new THREE.Color("#3a3b3d");
  const panel = (w: number, h: number, k: number, pos: [number, number, number], tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k * tint[0], k * tint[1], k * tint[2]), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(1.6, 12, 6, [-6, 0, 4]);
  panel(1.0, 12, 3.5, [6.5, 0, 3]);
  panel(10, 6, 2.5, [0, 9, 0]);
  panel(0.8, 12, 4, [-3, 0, -7], [0.9, 0.95, 1]);
  panel(0.8, 12, 4, [4, 0, -7]);
  panel(30, 30, 0.35, [0, -10, 0]);
  panel(14, 4, 1.6, [0, 3, 9]);
  panel(8, 8, 1.2, [-7, 6, -2]);
  const envTex = pmrem.fromScene(env, 0.02).texture;
  env.traverse((o) => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as T.Material).dispose(); } });
  scene.environment = envTex;

  const key = new THREE.DirectionalLight("#ffffff", 1.6);
  key.position.set(-3, 5, 5);
  // luz de rebote del jugo: tiñe los bordes de la lata con el color del sabor
  const bounce = new THREE.PointLight("#ffffff", 0, 12, 1.5);
  bounce.position.set(0, -1, -3);
  const fill = new THREE.HemisphereLight("#ffffff", "#ffffff", 0.25);
  scene.add(key, bounce, fill);

  // ── Geometría ──────────────────────────────────────────────────
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  const seg = small ? 96 : 160;
  const bodyPts: T.Vector2[] = [];
  for (let i = 0; i <= 32; i++) bodyPts.push(V(0.5, -1.0 + (2.0 * i) / 32));
  const bodyGeo = new THREE.LatheGeometry(bodyPts, seg);
  const bottomGeo = new THREE.LatheGeometry([
    V(0.0, -1.085), V(0.1, -1.09), V(0.2, -1.105), V(0.28, -1.13), V(0.32, -1.16), V(0.335, -1.18), V(0.345, -1.195),
    V(0.36, -1.2), V(0.375, -1.198), V(0.395, -1.18), V(0.425, -1.155), V(0.46, -1.12), V(0.485, -1.08), V(0.497, -1.04), V(0.5, -1.0),
  ], seg);
  const topGeo = new THREE.LatheGeometry([
    V(0.5, 1.0), V(0.498, 1.02), V(0.49, 1.045), V(0.475, 1.07), V(0.455, 1.095), V(0.44, 1.115), V(0.432, 1.13), V(0.43, 1.15),
    V(0.432, 1.162), V(0.44, 1.172), V(0.446, 1.182), V(0.446, 1.192), V(0.44, 1.2), V(0.43, 1.202), V(0.42, 1.197), V(0.415, 1.185),
    V(0.412, 1.165), V(0.408, 1.14), V(0.402, 1.122), V(0.392, 1.115), V(0.38, 1.118), V(0.372, 1.13), V(0.36, 1.138), V(0.34, 1.139),
    V(0.33, 1.142), V(0.32, 1.141), V(0.25, 1.143), V(0.12, 1.145), V(0.0, 1.146),
  ], seg);

  // ── Materiales ─────────────────────────────────────────────────
  const textures: T.Texture[] = [];
  const keep = <X extends T.Texture>(t: X) => { textures.push(t); return t; };
  // aluminio torneado: el cepillado corre alrededor, como en las tapas reales
  const alu = new THREE.MeshPhysicalMaterial({ color: "#d4d8db", metalness: 1, roughness: 0.24, anisotropy: 0.65, clearcoat: 0.3, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
  // el cuello y el fondo también sudan: el frío llega hasta donde hay líquido
  const neck = alu.clone();
  neck.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vCanY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCanY = position.y;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCanY;")
      .replace("#include <color_fragment>", "#include <color_fragment>\nfloat nFog = smoothstep(1.17, 1.01, abs(vCanY)) * 0.8;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), nFog * 0.1);")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(roughness, 0.4, nFog);")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = metalness * (1.0 - nFog * 0.25);");
  };

  const LW = small ? 1280 : 2048, LH = Math.round(LW * 0.635);
  const labels = FLAVORS.map((f) => keep(tex(THREE, drawLabel(f, LW, LH), { srgb: true, aniso })));
  labels.forEach((t) => (t.wrapT = THREE.ClampToEdgeWrapping));

  // aluminio sin tinta y neblina, a la misma escala que la etiqueta
  const CW = small ? 640 : 1024, CH = Math.round(CW * 0.635);
  const bare = drawMetalMask(CW, CH).getContext("2d")!.getImageData(0, 0, CW, CH).data;
  const surf = keep(tex(THREE, surfaceCanvas(CW, CH, bare), { aniso }));
  surf.wrapT = THREE.ClampToEdgeWrapping;

  // barniz con piel de naranja y las líneas finas del planchado del cuerpo
  const n = makeNoise(41);
  const micro = keep(tex(THREE, normalCanvas(field(256, 256, (u, v) =>
    n.fbm(u * 20, v * 20, 20, 3) * 0.75 + (0.5 + 0.5 * Math.sin((u * 48 + n.fbm(u * 4, v * 4, 4, 2) * 2) * TAU)) * 0.1), 1.2), { aniso, repeat: [6, 4] }));

  const drops = { uSurf: { value: surf }, uSlide: { value: 30 }, uCaustic: { value: 1.1 } };
  const body = new THREE.MeshPhysicalMaterial({
    map: labels[0],
    metalness: 1,
    roughness: 1,
    normalMap: micro,
    normalScale: new THREE.Vector2(0.08, 0.08),
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    clearcoatNormalMap: micro,
    clearcoatNormalScale: new THREE.Vector2(0.25, 0.25),
  });
  body.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, drops);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${DROPS_PARS}`)
      .replace("#include <map_fragment>", DROPS_MAP)
      .replace("#include <roughnessmap_fragment>", DROPS_PBR)
      .replace("#include <metalnessmap_fragment>", "")
      .replace("#include <normal_fragment_maps>", DROPS_NORMAL)
      .replace("#include <clearcoat_normal_fragment_maps>", DROPS_CLEARCOAT_NORMAL)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${DROPS_CAUSTIC}`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>\n${DROPS_CLEARCOAT}`);
  };

  const can = new THREE.Group();
  can.add(new THREE.Mesh(bodyGeo, body), new THREE.Mesh(bottomGeo, neck), new THREE.Mesh(topGeo, neck));

  // anillo: forma con hueco para el dedo, extruida con bisel y un poco levantada en la punta
  const roundRect = (s: T.Shape | T.Path, x: number, y: number, w: number, h: number, r: number) => {
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  };
  const tabShape = new THREE.Shape();
  roundRect(tabShape, -0.085, -0.075, 0.17, 0.315, 0.065);
  const hole = new THREE.Path();
  roundRect(hole, -0.055, 0.075, 0.11, 0.125, 0.05);
  tabShape.holes.push(hole);
  const tabGeo = new THREE.ExtrudeGeometry(tabShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.007, bevelSegments: 3, curveSegments: 20 });
  tabGeo.rotateX(-Math.PI / 2);
  const tab = new THREE.Mesh(tabGeo, alu);
  tab.position.set(0, 1.152, 0);
  // la punta corta empuja la línea de apertura; el lado del dedo queda del lado contrario y un poco levantado
  tab.rotation.set(0.05, 0, 0);
  const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 12, 0, TAU, 0, Math.PI / 2), alu);
  rivet.scale.set(1, 0.35, 1);
  rivet.position.set(0, 1.158, 0);
  // línea de apertura en relieve: la gota que se rompe al abrir
  const score = new THREE.CatmullRomCurve3(Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * TAU;
    return new THREE.Vector3(Math.sin(a) * 0.105 * (1 - 0.25 * Math.cos(a)), 1.1465, 0.17 + Math.cos(a) * 0.1);
  }), true);
  const scoreLine = new THREE.Mesh(new THREE.TubeGeometry(score, 96, 0.0032, 6, true), alu);
  can.add(tab, rivet, scoreLine);
  scene.add(can);

  // ── Gotas que caen ─────────────────────────────────────────────
  // Escurren hasta el aro de apoyo, se hinchan colgando y se sueltan.
  const RING = { r: 0.372, y: -1.2 };
  const dripGeo = new THREE.SphereGeometry(1, 20, 14);
  const water = new THREE.MeshPhysicalMaterial({ color: "#cfdde3", metalness: 0, roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.4, depthWrite: false });
  type Drip = { m: T.Mesh; t: number; hang: number; r: number; falling: boolean; vy: number };
  const drips: Drip[] = Array.from({ length: small ? 3 : 5 }, () => ({ m: new THREE.Mesh(dripGeo, water), t: 0, hang: 1, r: 0, falling: false, vy: 0 }));
  let dripIn = 1.4;
  const spawnDrip = () => {
    const d = drips.find((x) => !x.m.parent);
    if (!d) return;
    // el punto más bajo del aro, con algo de azar
    const e = can.matrixWorld.elements;
    const phi = Math.atan2(-e[1], -e[9]) + (Math.random() - 0.5) * 1.2;
    d.m.position.set(Math.sin(phi) * RING.r, RING.y, Math.cos(phi) * RING.r);
    d.m.rotation.set(0, 0, 0);
    d.m.scale.setScalar(0.001);
    Object.assign(d, { t: 0, hang: 0.8 + Math.random() * 1.1, r: 0.024 + Math.random() * 0.018, falling: false, vy: 0 });
    can.add(d.m);
  };
  const updateDrips = (dt: number) => {
    for (const d of drips) {
      if (!d.m.parent) continue;
      d.t += dt;
      if (!d.falling) {
        const g = Math.min(1, d.t / d.hang);
        const s = d.r * (0.3 + 0.7 * smoothstep(g));
        d.m.scale.set(s, s * (1 + g * 0.5), s);
        d.m.position.y = RING.y - s * (0.55 + g * 0.6);
        if (g >= 1) {
          // se suelta: pasa de la lata a la escena sin moverse de lugar
          scene.attach(d.m);
          d.m.rotation.set(0, 0, 0);
          d.falling = true;
        }
      } else {
        d.vy -= 26 * dt;
        d.m.position.y += d.vy * dt;
        const sp = Math.abs(d.vy);
        d.m.scale.set(d.r * 0.85, d.r * (1.35 + sp * 0.1), d.r * 0.85);
        if (d.m.position.y < -4) d.m.removeFromParent();
      }
    }
  };

  // ── Profundidad ────────────────────────────────────────────────
  // una sombra suave sobre el fondo y burbujas fuera de foco que pasan por delante de la lata
  const alphaCanvas = (w: number, h: number, fn: (u: number, v: number) => number) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const im = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
      im.data[i + 3] = Math.max(0, Math.min(1, fn((x + 0.5) / w, (y + 0.5) / h))) * 255;
    }
    ctx.putImageData(im, 0, 0);
    const t = keep(tex(THREE, c));
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: "#000000", transparent: true, opacity: 0.26, depthWrite: false,
    map: alphaCanvas(64, 128, (u, v) => {
      const d = Math.hypot(Math.abs(u - 0.5) * 2, Math.max(0, Math.abs(v - 0.5) * 2 - 0.55) / 0.45);
      return Math.pow(Math.max(0, 1 - d), 2.2);
    }),
  }));
  shadow.renderOrder = -1;
  scene.add(shadow);

  const bokehMat = new THREE.SpriteMaterial({
    transparent: true, opacity: 0.55, depthWrite: false,
    map: alphaCanvas(128, 128, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      if (d > 1) return 0;
      const ring = Math.exp(-(((d - 0.8) / 0.12) ** 2)) * 0.55;
      const glint = Math.exp(-(((u - 0.35) / 0.09) ** 2 + ((v - 0.3) / 0.07) ** 2)) * 0.8;
      return (ring + glint + 0.06) * (1 - smoothstep(Math.max(0, (d - 0.9) / 0.1)));
    }),
  });
  const bokeh = Array.from({ length: small ? 3 : 7 }, () => {
    const s = new THREE.Sprite(bokehMat);
    s.scale.setScalar(0.14 + Math.random() * 0.32);
    s.position.set(0, (Math.random() - 0.5) * 5, 2.5 + Math.random() * 2.5);
    s.userData = { x0: (Math.random() - 0.5) * 5, speed: 0.1 + Math.random() * 0.2, wob: Math.random() * TAU };
    scene.add(s);
    return s;
  });

  // ── Interacción y bucle ────────────────────────────────────────
  // arrastrar a los lados la gira con inercia; arriba y abajo la ladea, como en la mano
  const drag = { value: 0, vel: 0, tilt: 0, down: false, lastX: 0, lastY: 0 };
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  const onDown = (e: PointerEvent) => { drag.down = true; drag.lastX = e.clientX; drag.lastY = e.clientY; };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      const r = host.getBoundingClientRect();
      lean.tx = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      lean.ty = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
    }
    if (!drag.down) return;
    drag.vel = (e.clientX - drag.lastX) * 0.012;
    drag.value += drag.vel;
    drag.tilt = Math.max(-0.45, Math.min(0.45, drag.tilt + (e.clientY - drag.lastY) * 0.004));
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  };
  const onUp = () => { drag.down = false; };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);

  let W = 1, H = 1;
  const resize = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const juice = new THREE.Color();
  const WHITE = new THREE.Color("#ffffff");
  const up = new THREE.Vector3();
  // el líquido adentro tarda en alcanzar el giro: la lata se mece un poco al frenar
  const slosh = { a: 0, v: 0, spin: 0, lastRy: NaN };
  let raf = 0, visible = true, last = performance.now(), current = 0;
  const cur = { ...POSES[0] };
  const frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(1e-3, (now - last) / 1000));
    last = now;
    const p = progress();
    const target = poseAt(p);
    const k = 1 - Math.pow(0.0015, dt);
    (Object.keys(cur) as (keyof Key)[]).forEach((key) => { cur[key] += (target[key] - cur[key]) * k; });
    if (!drag.down) {
      drag.vel *= Math.pow(0.04, dt);
      drag.value += drag.vel;
      drag.tilt *= Math.pow(0.03, dt);
    }
    lean.x += (lean.tx - lean.x) * Math.min(1, dt * 4);
    lean.y += (lean.ty - lean.y) * Math.min(1, dt * 4);

    const ry = cur.ry + drag.value + (reduce ? 0 : now / 6000);
    const spin = Number.isNaN(slosh.lastRy) ? 0 : (ry - slosh.lastRy) / dt;
    slosh.lastRy = ry;
    const before = slosh.spin;
    slosh.spin += (spin - slosh.spin) * Math.min(1, dt * 10);
    const accel = Math.max(-30, Math.min(30, (slosh.spin - before) / dt));
    if (!reduce) {
      slosh.v += (-accel * 0.15 - slosh.a * 55 - slosh.v * 4.5) * dt;
      slosh.a += slosh.v * dt;
    }

    const spread = W < 768 ? 0.42 : 1.55;
    can.position.set(cur.x * spread + slosh.a * 0.25, cur.y + (reduce ? 0 : Math.sin(now / 900) * 0.04), 0);
    can.rotation.set(cur.rx + drag.tilt + lean.y * 0.16, ry, cur.rz + slosh.a - lean.x * 0.12);
    can.scale.setScalar(cur.s * (W < 768 ? 0.82 : 1));
    if (target.label !== current) { current = target.label; body.map = labels[current]; body.needsUpdate = true; }

    // las gotas bajan con la gravedad: más rápido si la lata está de pie y si la agitas
    can.updateMatrixWorld();
    const upright = Math.max(0, up.set(0, 1, 0).applyQuaternion(can.quaternion).y);
    const shake = Math.min(5, Math.abs(slosh.spin) * 0.3);
    if (!reduce) {
      drops.uSlide.value += dt * upright * (1 + shake);
      dripIn -= dt * (1 + shake * 0.8);
      if (dripIn <= 0 && upright > 0.75) { spawnDrip(); dripIn = 1.6 + Math.random() * 2.8; }
      updateDrips(dt);
    }

    // el rebote toma el color del jugo que hay detrás
    const f = Math.min(3, Math.max(0, Math.round(p * 4)));
    juice.set(f >= 1 && f <= 3 ? FLAVORS[f - 1].juice[1] : "#efe9dc");
    bounce.color.lerp(juice, Math.min(1, dt * 3));
    bounce.intensity = 9;
    fill.color.copy(bounce.color);
    fill.groundColor.copy(bounce.color).multiplyScalar(0.4);
    water.color.copy(bounce.color).lerp(WHITE, 0.4);
    bokehMat.color.copy(bounce.color).lerp(WHITE, 0.55);

    // la sombra sigue el eje de la lata, abajo a la derecha de la luz principal
    const s = can.scale.x;
    shadow.position.set(can.position.x + 0.32, can.position.y - 0.42, -2.2);
    shadow.rotation.z = -Math.atan2(up.x, up.y);
    shadow.scale.set(1.3 * s, (1.1 + 2.6 * Math.hypot(up.x, up.y)) * s, 1);
    for (const b of bokeh) {
      const u = b.userData as { x0: number; speed: number; wob: number };
      if (!reduce) b.position.y += dt * u.speed * (1 + shake * 0.3);
      if (b.position.y > 2.7) { b.position.y = -2.7; u.x0 = (Math.random() - 0.5) * 5; }
      // paralaje: lo cercano se mueve más que la lata cuando mueves el puntero
      b.position.x = u.x0 + Math.sin(now / 1500 + u.wob) * 0.08 - lean.x * 0.3 * (b.position.z - 1);
    }

    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(host);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      [bodyGeo, bottomGeo, topGeo, tabGeo, rivet.geometry, scoreLine.geometry, dripGeo, shadow.geometry].forEach((g) => g.dispose());
      [alu, neck, body, water, shadow.material, bokehMat].forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
