import type * as T from "three";
import { colorCanvas, field, makeNoise, normalCanvas, rng, rock as rockSet, rust as rustSet, sand as sandSet, tex, wood as woodSet, type PBRSet } from "@/lib/procedural";

// Pueblo de Punk Cowboy hecho con código. El scroll recorre el proceso del juego:
// 1) prototipo en cajas grises, 2) el arte reemplaza cada caja (se disuelve de abajo hacia arriba),
// 3) atardecer con cielo físico y neón, 4) duelo: seis botellas, raycasting y vidrio que vuela.

export type PunkOptions = {
  host: HTMLElement;
  progress: () => number;
  onHit: (x: number, y: number, left: number) => void;
  onMiss: (x: number, y: number) => void;
};

export type PunkScene = { dispose: () => void; reset: () => void; setActive: (on: boolean) => void };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

// Disolución: el arte aparece donde el ruido + la altura quedan bajo el umbral; el prototipo, al revés.
const DISSOLVE_GLSL = /* glsl */ `
varying vec3 vDPos;
uniform float uReveal;
float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

export async function createPunkScene({ host, progress, onHit, onMiss }: PunkOptions): Promise<PunkScene> {
  const THREE = await import("three");
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { Sky }, { mergeGeometries, mergeVertices }] = await Promise.all([
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
    import("three/examples/jsm/objects/Sky.js"),
    import("three/examples/jsm/utils/BufferGeometryUtils.js"),
  ]);
  await document.fonts.load("800 80px 'Funnel Display Variable'").catch(() => {});

  const small = window.matchMedia("(max-width: 768px)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shadows = !small;
  const R = rng(42);
  const TS = small ? 256 : 512; // tamaño de las texturas procedurales

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "absolute inset-0 block h-full w-full";
  canvas.style.touchAction = "pan-y";
  host.appendChild(canvas);
  const samples = Math.min(small ? 4 : 8, renderer.capabilities.maxSamples);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  scene.fog = new THREE.FogExp2("#9a9b9c", 0.009);

  // ── Disolución y gris ──────────────────────────────────────────
  const reveal = { value: 0 };
  const dissolve = <M extends T.Material>(mat: M, role: "art" | "block"): M => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uReveal = reveal;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vDPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\n  vec4 dp = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  dp = instanceMatrix * dp;\n  #endif\n  vDPos = (modelMatrix * dp).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + DISSOLVE_GLSL)
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  float dk = dNoise(vDPos * 1.6) * 0.3 + clamp(vDPos.y / 11.0, 0.0, 1.0) * 0.7;
  float dEdge = uReveal * 1.2 - 0.1;
  ${role === "art" ? "if (dk > dEdge) discard;" : "if (dk < dEdge) discard;"}
  float dGlow = smoothstep(0.03, 0.0, abs(dk - dEdge)) * step(0.001, uReveal) * step(uReveal, 0.999);`)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.5, 0.2) * dGlow * 4.0;");
    };
    mat.customProgramCacheKey = () => "dissolve-" + role;
    return mat;
  };
  // terreno, mesetas y rocas: no se disuelven, se colorean
  const greyable = <M extends T.Material>(mat: M): M => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uReveal = reveal;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uReveal;")
        .replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb = mix(vec3(0.5, 0.505, 0.51), diffuseColor.rgb, uReveal);");
    };
    mat.customProgramCacheKey = () => "greyable";
    return mat;
  };

  // ── Texturas ───────────────────────────────────────────────────
  const textures: T.Texture[] = [];
  const keepSet = <S extends Partial<PBRSet> & Record<string, T.Texture>>(s: S) => { Object.values(s).forEach((t) => textures.push(t)); return s; };
  const woodA = keepSet(woodSet(THREE, { light: "#b38c64", dark: "#5c3b24", seed: 3, size: TS, aniso }));
  await yieldFrame();
  const woodB = keepSet(woodSet(THREE, { light: "#8a6748", dark: "#3b2819", seed: 8, rings: 30, size: TS, aniso }));
  await yieldFrame();
  const woodRed = keepSet(woodSet(THREE, { light: "#a98660", dark: "#56381f", seed: 11, paint: "#8e2f25", size: TS, aniso }));
  await yieldFrame();
  const woodTeal = keepSet(woodSet(THREE, { light: "#a98660", dark: "#56381f", seed: 14, paint: "#3f6f6a", size: small ? 256 : 384, aniso }));
  await yieldFrame();
  const rustS = keepSet(rustSet(THREE, { size: small ? 256 : 384, aniso }));
  await yieldFrame();
  const sandS = keepSet(sandSet(THREE, { base: "#d3a676", shade: "#ab7a50", size: TS, aniso }));
  const dirtS = keepSet(sandSet(THREE, { base: "#9c7656", shade: "#76553f", seed: 9, size: 256, aniso }));
  await yieldFrame();
  const rockS = keepSet(rockSet(THREE, { base: "#b0623f", band: "#d69466", size: TS, aniso }));
  await yieldFrame();

  const woodMat = (s: PBRSet) => dissolve(new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) }), "art");
  const WA = woodMat(woodA), WB = woodMat(woodB), WR = woodMat(woodRed), WT = woodMat(woodTeal);
  const RUST = dissolve(new THREE.MeshStandardMaterial({ map: rustS.map, normalMap: rustS.normalMap, roughnessMap: rustS.roughnessMap, metalnessMap: rustS.metalnessMap, roughness: 1, metalness: 1, side: THREE.DoubleSide }), "art");
  const DARK = dissolve(new THREE.MeshStandardMaterial({ color: "#1b120c", roughness: 0.95 }), "art");
  const GLASS = dissolve(new THREE.MeshPhysicalMaterial({ color: "#1c1a18", roughness: 0.12, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.55 }), "art");
  const BLOCK = dissolve(new THREE.MeshStandardMaterial({ color: "#8e9093", roughness: 0.9 }), "block");

  const mesh = (g: T.BufferGeometry, m: T.Material | T.Material[], cast = true) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = cast && shadows;
    o.receiveShadow = shadows;
    return o;
  };

  // Tablas: cada una con su propio pedazo de veta, unidas en una sola malla por material.
  type Board = { s: [number, number, number]; p: [number, number, number]; r?: [number, number, number] };
  const boardUV = (g: T.BufferGeometry, long: number, S: number, ou: number, ov: number) => {
    const p = g.attributes.position as T.BufferAttribute, n = g.attributes.normal as T.BufferAttribute, uv = g.attributes.uv as T.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const axis = ax > ay && ax > az ? 0 : ay > az ? 1 : 2;
      const c = [p.getX(i), p.getY(i), p.getZ(i)];
      const plane = [0, 1, 2].filter((a) => a !== axis);
      const vA = plane.includes(long) ? long : plane[1];
      const uA = plane.find((a) => a !== vA)!;
      uv.setXY(i, c[uA] / S + ou, c[vA] / S + ov);
    }
  };
  const boards = (list: Board[], mat: T.Material, S = 1.6) => {
    const geos = list.map((b) => {
      const g = new THREE.BoxGeometry(...b.s);
      boardUV(g, b.s.indexOf(Math.max(...b.s)), S, R(), R());
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...b.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(b.r ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1)));
      return g;
    });
    const merged = mergeGeometries(geos)!;
    geos.forEach((g) => g.dispose());
    return mesh(merged, mat);
  };
  const jitter = (a: number) => (R() - 0.5) * a;

  // Lámina corrugada
  const corrugated = (w: number, d: number) => {
    const g = new THREE.PlaneGeometry(w, d, Math.round(w * 14), 1);
    const p = g.attributes.position as T.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 0.14) * Math.PI * 2) * 0.035);
    g.computeVertexNormals();
    const uv = g.attributes.uv as T.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
    g.rotateX(-Math.PI / 2);
    return mesh(g, RUST);
  };

  // ── Cielo físico, con un domo gris para el prototipo ───────────
  const sky = new Sky();
  sky.scale.setScalar(450);
  const skyU = sky.material.uniforms;
  skyU.turbidity.value = 4;
  skyU.rayleigh.value = 1.6;
  skyU.mieCoefficient.value = 0.006;
  skyU.mieDirectionalG.value = 0.82;
  skyU.cloudCoverage.value = 0.32;
  skyU.cloudDensity.value = 0.35;
  // el cielo físico entrega valores de luz enormes: le bajamos la ganancia para que conviva con la escena
  skyU.skyGain = { value: 0.32 };
  sky.material.fragmentShader = "uniform float skyGain;\n" + sky.material.fragmentShader.replace("gl_FragColor = vec4( texColor, 1.0 );", "gl_FragColor = vec4( texColor * skyGain, 1.0 );");
  sky.material.needsUpdate = true;
  scene.add(sky);
  const greyDome = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), new THREE.MeshBasicMaterial({ color: "#9c9ea1", side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
  greyDome.renderOrder = -1;
  scene.add(greyDome);

  // ── Terreno ────────────────────────────────────────────────────
  const noise = makeNoise(5);
  {
    const size = 300, seg = small ? 110 : 180;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as T.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const flat = smooth(clamp((Math.hypot(x, z * 1.3) - 26) / 34));
      const dunes = Math.sin(x * 0.045) * 1.6 + Math.sin(z * 0.06 + x * 0.02) * 1.3 + (noise.fbm(x * 0.02 + 50, z * 0.02 + 50, 256, 4) - 0.5) * 5;
      pos.setY(i, dunes * flat + (noise.noise(x * 0.4, z * 0.4) - 0.5) * 0.12);
    }
    g.computeVertexNormals();
    sandS.map.repeat.set(55, 55); sandS.normalMap.repeat.set(55, 55); sandS.roughnessMap.repeat.set(55, 55);
    const ground = mesh(g, greyable(new THREE.MeshStandardMaterial({ map: sandS.map, normalMap: sandS.normalMap, roughnessMap: sandS.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) })), false);
    scene.add(ground);
    // camino de tierra con orillas irregulares, no un rectángulo
    const edge = colorCanvas(512, 64, (u, v) => { const n = noise.fbm(u * 12, v * 2, 12, 4); const d = Math.abs(v - 0.5) * 2; const a = clamp((1 - d) * 2.2 - 0.4 + (n - 0.5) * 0.9); return [a, a, a]; });
    const edgeTex = tex(THREE, edge);
    edgeTex.wrapT = THREE.ClampToEdgeWrapping;
    textures.push(edgeTex);
    dirtS.map.repeat.set(16, 1.4); dirtS.normalMap.repeat.set(16, 1.4);
    const street = mesh(new THREE.PlaneGeometry(100, 9), greyable(new THREE.MeshStandardMaterial({ map: dirtS.map, normalMap: dirtS.normalMap, roughness: 1, alphaMap: edgeTex, transparent: true, depthWrite: false })), false);
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0.03, 1.5);
    scene.add(street);
  }

  // ── Mesetas erosionadas ────────────────────────────────────────
  {
    const mesaMat = greyable(new THREE.MeshStandardMaterial({ map: rockS.map, normalMap: rockS.normalMap, roughnessMap: rockS.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) }));
    for (let i = 0; i < 9; i++) {
      const rad = 8 + R() * 10, height = 9 + R() * 18;
      const g = new THREE.CylinderGeometry(rad, rad, height, 72, 28);
      const p = g.attributes.position as T.BufferAttribute;
      const seed = R() * 100;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const r = Math.hypot(x, z);
        if (r < 1e-3) continue;
        const a = Math.atan2(z, x), t = (y + height / 2) / height;
        const outline = 0.75 + noise.fbm(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed, 64, 5) * 0.55;
        const talus = 1 + Math.pow(1 - t, 3) * 0.55; // pie de escombros más ancho
        const ledge = 1 + (noise.fbm(a * 3 + seed, t * 9, 64, 3) - 0.5) * 0.16 + Math.round(t * 5) * 0.004;
        const s = outline * talus * ledge;
        p.setXYZ(k, x * s, y, z * s);
      }
      g.computeVertexNormals();
      const uv = g.attributes.uv as T.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (rad * 6) / 14, uv.getY(k) * height / 14);
      const m = mesh(g, mesaMat, false);
      const ang = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.75 + (R() - 0.5) * 0.2;
      const dist = 80 + R() * 50;
      m.position.set(Math.cos(ang) * dist, height / 2 - 2.2, Math.sin(ang) * dist);
      m.rotation.y = R() * Math.PI;
      scene.add(m);
    }
  }

  // ── Rocas ──────────────────────────────────────────────────────
  {
    const rockMat = greyable(new THREE.MeshStandardMaterial({ map: rockS.map, normalMap: rockS.normalMap, roughnessMap: rockS.roughnessMap, roughness: 1 }));
    for (let i = 0; i < 30; i++) {
      const a = R() * Math.PI * 2, d = 14 + R() * 40;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const size = 0.4 + R() * 1.3, seed = R() * 50;
      if (z > 4 && Math.abs(x) < 16) continue; // nada entre la cámara del duelo y la cerca
      let g: T.BufferGeometry = new THREE.IcosahedronGeometry(1, small ? 2 : 3);
      g.deleteAttribute("normal");
      g.deleteAttribute("uv");
      g = mergeVertices(g);
      const p = g.attributes.position as T.BufferAttribute;
      const uvs = new Float32Array(p.count * 2);
      for (let k = 0; k < p.count; k++) {
        const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k);
        const n = noise.fbm(vx * 1.3 + seed, vz * 1.3 + vy * 0.7, 256, 5);
        const s = 0.7 + n * 0.6;
        p.setXYZ(k, vx * s * 1.2, Math.max(-0.3, vy * s * 0.75), vz * s);
        uvs[k * 2] = (Math.atan2(vz, vx) / Math.PI + 1) * 1.5;
        uvs[k * 2 + 1] = vy * 1.5;
      }
      g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      g.computeVertexNormals();
      const m = mesh(g, rockMat);
      m.scale.setScalar(size);
      m.position.set(x, size * 0.2, z);
      m.rotation.y = R() * Math.PI * 2;
      scene.add(m);
    }
  }

  // ── Prototipo: cajas grises con aristas blancas ────────────────
  const protoMat = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  const blockout = new THREE.Group();
  const art = new THREE.Group();
  scene.add(blockout, art);
  const bbox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), BLOCK);
    m.position.set(x, y, z);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), protoMat);
    e.position.copy(m.position);
    blockout.add(m, e);
    return m;
  };
  const bcyl = (r: number, h: number, x: number, y: number, z: number) => {
    const m = mesh(new THREE.CylinderGeometry(r, r, h, 10), BLOCK);
    m.position.set(x, y, z);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), protoMat);
    e.position.copy(m.position);
    blockout.add(m, e);
  };
  // saloon, tienda, torre, cerca, cactus y postes en cajas
  bbox(9, 5.2, 7, 0, 2.6, -6.2); bbox(9.4, 8.4, 0.4, 0, 4.2, -2.7); bbox(5, 1.1, 0.4, 0, 8.9, -2.7);
  bbox(9.6, 0.25, 3, 0, 3.7, -1.2); bbox(9.6, 0.3, 3, 0, 0.15, -1.2);
  for (const x of [-4.5, -1.6, 1.6, 4.5]) bbox(0.25, 3.6, 0.25, x, 1.8, 0.2);
  bbox(6, 4, 6, 11.5, 2, -6); bbox(6.4, 5.6, 0.35, 11.5, 2.8, -2.9); bbox(6.6, 0.22, 2.4, 11.5, 3.2, -1.7);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bbox(0.25, 7, 0.25, -13 + x * 1.6, 3.5, -8 + z * 1.6);
  bcyl(2.4, 3.4, -13, 8.7, -8);
  const FENCE_Z = 8;
  for (let i = -3; i <= 3; i++) bbox(0.28, 1.5, 0.28, i * 2.1, 0.75, FENCE_Z);
  bbox(13, 0.08, 0.32, 0, 1.54, FENCE_Z);
  bbox(13, 0.16, 0.12, 0, 0.62, FENCE_Z + 0.17);
  const CACTI: [number, number, number][] = [[-9, 6, 4.2], [16, 3, 5], [-22, -2, 5.5], [24, -12, 6], [-30, -14, 4.5], [21, 15, 5.2], [-20, 17, 4.8], [30, 6, 5.8]];
  for (const [x, z, h] of CACTI) bcyl(0.42, h, x, h / 2, z);
  for (const x of [-36, -22, -8, 8, 22, 36]) bbox(0.22, 7, 0.22, x, 3.5, 4.4);

  // ── Arte: el saloon ────────────────────────────────────────────
  const glowMats: { mat: T.MeshBasicMaterial; base: T.Color; flicker: number }[] = [];
  const glowMat = (map: T.Texture | null, color: string, flicker = 0) => {
    const mat = dissolve(new THREE.MeshBasicMaterial({ map, color, transparent: !!map, depthWrite: !map, fog: false }), "art");
    glowMats.push({ mat, base: new THREE.Color(color), flicker });
    return mat;
  };
  // letrero pintado sobre la misma madera
  const signTexture = (text: string, paint: string) => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(woodB.map.image as HTMLCanvasElement, 0, 0, 1024, 200);
    ctx.fillStyle = paint;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 118px 'Funnel Display Variable', serif";
    ctx.globalAlpha = 0.92;
    ctx.fillText(text, 512, 106);
    // pintura gastada: le quitamos pedazos
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 900; i++) { ctx.globalAlpha = R() * 0.5; ctx.fillRect(R() * 1024, R() * 200, 2 + R() * 10, 1 + R() * 3); }
    ctx.globalCompositeOperation = "destination-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(woodB.map.image as HTMLCanvasElement, 0, 0, 1024, 200);
    const t = tex(THREE, c, { srgb: true, aniso });
    textures.push(t);
    return t;
  };
  const neonTexture = (text: string, colA: string, colB: string) => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 220;
    const ctx = c.getContext("2d")!;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 132px 'Funnel Display Variable', sans-serif";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "6px";
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, colA);
    grad.addColorStop(1, colB);
    ctx.lineJoin = "round";
    ctx.shadowColor = colA;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 9;
    ctx.strokeText(text, 512, 116);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(text, 512, 116);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    textures.push(t);
    return t;
  };
  const warm = glowMat(null, "#ffae5c");

  // ventana: marco, travesaños, vidrio sucio y la luz de adentro
  const windowAt = (g: T.Group, x: number, y: number, z: number, w: number, h: number, frame: T.Material) => {
    const t = 0.12;
    g.add(boards([
      { s: [w + t * 2, t, t], p: [x, y + h / 2 + t / 2, z] },
      { s: [w + t * 2, t * 1.3, t * 1.4], p: [x, y - h / 2 - t / 2, z + 0.03] },
      { s: [t, h, t], p: [x - w / 2 - t / 2, y, z] },
      { s: [t, h, t], p: [x + w / 2 + t / 2, y, z] },
      { s: [0.045, h, 0.05], p: [x, y, z] },
      { s: [w, 0.045, 0.05], p: [x, y + h * 0.1, z] },
    ], frame));
    const glass = mesh(new THREE.PlaneGeometry(w, h), GLASS, false);
    glass.position.set(x, y, z - 0.01);
    const inside = mesh(new THREE.PlaneGeometry(w, h), warm, false);
    inside.position.set(x, y, z - 0.25);
    g.add(glass, inside);
  };

  {
    const S = new THREE.Group();
    // cuerpo cerrado por dentro y muros de tablas traslapadas
    S.add(mesh(new THREE.BoxGeometry(8.85, 5.15, 6.85), DARK).translateY(2.6).translateZ(-6.2));
    const lap: Board[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 17; i++) lap.push({ s: [0.07, 0.36, 7.0 + jitter(0.06)], p: [side * 4.47, 0.2 + i * 0.3, -6.2 + jitter(0.04)], r: [0, 0, side * 0.08] });
    S.add(boards(lap, WA));
    const roof = corrugated(9.8, 7.6);
    roof.position.set(0, 5.32, -6.3);
    roof.rotation.x = 0.06;
    S.add(roof);
    // fachada falsa: tablones verticales con pintura roja vieja y tapajuntas
    const front: Board[] = [], battens: Board[] = [];
    for (let x = -4.64; x <= 4.65; x += 0.29) {
      const h = (Math.abs(x) < 2.4 ? 9.4 : 8.4) + jitter(0.08);
      front.push({ s: [0.27, h, 0.08], p: [x, h / 2, -2.62 + jitter(0.014)], r: [jitter(0.006), 0, jitter(0.01)] });
      battens.push({ s: [0.06, h - 0.1, 0.04], p: [x + 0.145, h / 2, -2.56], r: [0, 0, jitter(0.008)] });
    }
    S.add(boards(front, WR), boards(battens, WB));
    S.add(boards([
      { s: [2.45, 0.18, 0.24], p: [-3.6, 8.48, -2.6] }, { s: [2.45, 0.18, 0.24], p: [3.6, 8.48, -2.6] },
      { s: [4.95, 0.2, 0.26], p: [0, 9.48, -2.6] },
      { s: [0.18, 1.1, 0.24], p: [-2.47, 8.95, -2.6] }, { s: [0.18, 1.1, 0.24], p: [2.47, 8.95, -2.6] },
      { s: [0.22, 8.4, 0.22], p: [-4.78, 4.2, -2.6] }, { s: [0.22, 8.4, 0.22], p: [4.78, 4.2, -2.6] },
      { s: [9.7, 0.2, 0.18], p: [0, 3.92, -2.55] },
    ], WB));
    windowAt(S, -3.1, 2.0, -2.5, 1.5, 1.7, WB);
    windowAt(S, 3.1, 2.0, -2.5, 1.5, 1.7, WB);
    windowAt(S, -2.6, 6.1, -2.5, 1.2, 1.2, WB);
    windowAt(S, 2.6, 6.1, -2.5, 1.2, 1.2, WB);
    // puertas batientes de persiana, con la luz del salón detrás
    const door: Board[] = [];
    for (const side of [-1, 1]) {
      const cx = side * 0.45;
      door.push({ s: [0.08, 1.45, 0.07], p: [cx - 0.4, 1.6, -2.45] }, { s: [0.08, 1.45, 0.07], p: [cx + 0.4, 1.6, -2.45] });
      door.push({ s: [0.86, 0.1, 0.07], p: [cx, 2.28, -2.45] }, { s: [0.86, 0.12, 0.07], p: [cx, 0.92, -2.45] });
      for (let k = 0; k < 7; k++) door.push({ s: [0.74, 0.12, 0.025], p: [cx, 1.05 + k * 0.17, -2.45], r: [0.55, 0, 0] });
    }
    S.add(boards(door, WB));
    const behind = mesh(new THREE.PlaneGeometry(1.8, 2.6), warm, false);
    behind.position.set(0, 1.4, -2.85);
    S.add(behind);
    // porche: piso, postes con escuadras, viga y techo de lámina
    const porch: Board[] = [{ s: [9.7, 0.28, 3.0], p: [0, 0.14, -1.2] }];
    for (let x = -4.75; x <= 4.76; x += 0.25) porch.push({ s: [0.23, 0.07, 3.05 + jitter(0.08)], p: [x, 0.315, -1.2 + jitter(0.03)], r: [0, jitter(0.01), 0] });
    S.add(boards(porch, WA));
    const posts: Board[] = [{ s: [9.8, 0.28, 0.24], p: [0, 3.76, 0.18] }];
    for (const x of [-4.5, -1.6, 1.6, 4.5]) {
      posts.push({ s: [0.24, 3.5, 0.24], p: [x, 2.0, 0.18], r: [jitter(0.02), 0, jitter(0.02)] });
      for (const s of [-1, 1]) if (Math.abs(x + s * 0.5) < 4.9) posts.push({ s: [0.09, 0.85, 0.09], p: [x + s * 0.3, 3.35, 0.18], r: [0, 0, s * 0.78] });
    }
    S.add(boards(posts, WA));
    const porchRoof = corrugated(9.9, 3.3);
    porchRoof.position.set(0, 4.0, -1.05);
    porchRoof.rotation.x = 0.17;
    S.add(porchRoof);
    // letreros
    const sign = mesh(new THREE.PlaneGeometry(5.2, 1.0), dissolve(new THREE.MeshStandardMaterial({ map: signTexture("SALOON", "#efdcb8"), roughness: 0.9 }), "art"), false);
    sign.position.set(0, 7.75, -2.5);
    S.add(sign);
    S.add(boards([{ s: [7.7, 1.9, 0.06], p: [0, 4.75, -2.5] }], RUST));
    S.add(boards([{ s: [0.06, 0.06, 0.35], p: [-3.4, 4.75, -2.35] }, { s: [0.06, 0.06, 0.35], p: [3.4, 4.75, -2.35] }], RUST));
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.6), glowMat(neonTexture("PUNK COWBOY", "#ff4fa3", "#46e6ff"), "#ffffff", 1));
    neon.position.set(0, 4.75, -2.44);
    S.add(neon);
    // poste para amarrar caballos
    const rail = mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 14).rotateZ(Math.PI / 2), WA);
    rail.position.set(-1.5, 1.05, 1.6);
    S.add(rail, boards([{ s: [0.2, 1.1, 0.2], p: [-3.5, 0.55, 1.6] }, { s: [0.2, 1.1, 0.2], p: [0.5, 0.55, 1.6] }], WA));
    art.add(S);
  }

  // barriles: duelas, aros oxidados y tapa
  {
    const stave = document.createElement("canvas");
    stave.width = 512; stave.height = 512;
    const sctx = stave.getContext("2d")!;
    sctx.drawImage(woodB.map.image as HTMLCanvasElement, 0, 0, 512, 512);
    sctx.fillStyle = "rgba(20,12,6,0.85)";
    for (let i = 0; i < 16; i++) sctx.fillRect((i / 16) * 512, 0, 3, 512);
    const staveTex = tex(THREE, stave, { srgb: true, aniso });
    staveTex.repeat.set(2, 1);
    textures.push(staveTex);
    const barrelMat = dissolve(new THREE.MeshStandardMaterial({ map: staveTex, normalMap: woodB.normalMap, roughness: 0.9 }), "art");
    const prof: T.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(0.4 + Math.sin(Math.PI * t) * 0.07, t * 1.15)); }
    const barrelGeo = new THREE.LatheGeometry(prof, 32);
    for (const [x, z, ry] of [[-5.4, -0.6, 0], [-5.95, 0.25, 1], [5.5, -0.4, 2], [9.2, -0.9, 3]]) {
      const b = new THREE.Group();
      b.add(mesh(barrelGeo, barrelMat));
      for (const y of [0.16, 0.42, 0.73, 0.99]) {
        const r = 0.4 + Math.sin(Math.PI * (y / 1.15)) * 0.07 + 0.008;
        b.add(mesh(new THREE.TorusGeometry(r, 0.018, 6, 40).rotateX(Math.PI / 2), RUST).translateY(y));
      }
      b.add(mesh(new THREE.CircleGeometry(0.4, 32).rotateX(-Math.PI / 2), WB).translateY(1.12));
      b.position.set(x, 0.3 * (Math.abs(x) < 7 ? 1 : 0), z);
      b.rotation.y = ry;
      art.add(b);
    }
  }

  // la tienda de la derecha
  {
    const G = new THREE.Group();
    G.add(mesh(new THREE.BoxGeometry(5.85, 3.95, 5.85), DARK).translateX(11.5).translateY(2).translateZ(-6));
    const lap: Board[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 13; i++) lap.push({ s: [0.07, 0.36, 6.0], p: [11.5 + side * 2.97, 0.2 + i * 0.3, -6], r: [0, 0, side * 0.08] });
    G.add(boards(lap, WA));
    const roof = corrugated(6.4, 6.6);
    roof.position.set(11.5, 4.08, -6.1);
    roof.rotation.x = 0.06;
    G.add(roof);
    const front: Board[] = [];
    for (let x = -3.05; x <= 3.06; x += 0.29) front.push({ s: [0.27, 5.6 + jitter(0.06), 0.08], p: [11.5 + x, 2.8, -2.86 + jitter(0.012)], r: [0, 0, jitter(0.01)] });
    G.add(boards(front, WT));
    G.add(boards([{ s: [6.6, 0.18, 0.22], p: [11.5, 5.65, -2.8] }, { s: [6.7, 0.24, 0.22], p: [11.5, 3.12, -0.55] }, { s: [0.2, 3.1, 0.2], p: [8.4, 1.55, -0.55] }, { s: [0.2, 3.1, 0.2], p: [14.6, 1.55, -0.55] }], WB));
    const proof = corrugated(6.8, 2.5);
    proof.position.set(11.5, 3.3, -1.7);
    proof.rotation.x = 0.16;
    G.add(proof);
    windowAt(G, 9.7, 2.0, -2.75, 1.4, 1.3, WB);
    G.add(boards([{ s: [1.15, 2.2, 0.07], p: [11.9, 1.1, -2.78] }, { s: [1.35, 0.12, 0.12], p: [11.9, 2.26, -2.74] }], WB));
    const sign = mesh(new THREE.PlaneGeometry(3.6, 0.8), dissolve(new THREE.MeshStandardMaterial({ map: signTexture("GENERAL", "#e9d9b6"), roughness: 0.9 }), "art"), false);
    sign.position.set(11.5, 4.7, -2.78);
    G.add(sign);
    // cajas de madera
    for (const [x, z, s] of [[14.2, -0.2, 0.75], [13.5, 0.4, 0.6], [14.1, 0.5, 0.55]]) {
      const c = new THREE.Group();
      const pl: Board[] = [];
      for (let k = 0; k < 4; k++) pl.push({ s: [s, s / 4 - 0.01, s], p: [0, s / 8 + k * (s / 4), 0] });
      c.add(boards(pl, WA));
      c.add(boards([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ s: [0.06, s + 0.02, 0.06] as [number, number, number], p: [a * s / 2, s / 2, b * s / 2] as [number, number, number] })), WB));
      c.position.set(x, 0.02 + (x === 14.1 ? 0.76 : 0), z);
      c.rotation.y = R();
      art.add(c);
    }
    art.add(G);
  }

  // torre de agua: patas con contravientos, tanque de duelas con aros, techo de lámina y escalera
  {
    const W = new THREE.Group();
    const legs: Board[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) legs.push({ s: [0.26, 7.1, 0.26], p: [sx * 1.45, 3.5, sz * 1.45], r: [sz * 0.04, 0, -sx * 0.04] });
    for (const y of [1.6, 4.4]) {
      for (const [ax, az, ry] of [[0, -1.5, 0], [0, 1.5, 0], [-1.5, 0, Math.PI / 2], [1.5, 0, Math.PI / 2]]) {
        legs.push({ s: [3.9, 0.14, 0.08], p: [ax, y + 1.2, az], r: [0, ry, 0.62] });
        legs.push({ s: [3.9, 0.14, 0.08], p: [ax, y + 1.2, az], r: [0, ry, -0.62] });
      }
    }
    legs.push({ s: [3.4, 0.22, 3.4], p: [0, 6.95, 0] });
    W.add(boards(legs, WB));
    const tankStave = (() => {
      const c = document.createElement("canvas");
      c.width = 1024; c.height = 512;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(woodA.map.image as HTMLCanvasElement, 0, 0, 512, 512);
      ctx.drawImage(woodA.map.image as HTMLCanvasElement, 512, 0, 512, 512);
      ctx.fillStyle = "rgba(25,15,8,0.8)";
      for (let i = 0; i < 24; i++) ctx.fillRect((i / 24) * 1024, 0, 3, 512);
      const t = tex(THREE, c, { srgb: true, aniso });
      t.repeat.set(2, 1);
      textures.push(t);
      return t;
    })();
    const tankMat = dissolve(new THREE.MeshStandardMaterial({ map: tankStave, normalMap: woodA.normalMap, roughness: 0.9 }), "art");
    W.add(mesh(new THREE.CylinderGeometry(2.4, 2.45, 3.4, 48, 1, false), tankMat).translateY(8.75));
    for (const y of [7.3, 8.2, 9.2, 10.1]) W.add(mesh(new THREE.TorusGeometry(2.46, 0.035, 6, 64).rotateX(Math.PI / 2), RUST).translateY(y));
    const cone = new THREE.ConeGeometry(2.75, 1.5, 48, 1, true);
    const cuv = cone.attributes.uv as T.BufferAttribute;
    for (let k = 0; k < cuv.count; k++) cuv.setXY(k, cuv.getX(k) * 6, cuv.getY(k) * 1.2);
    W.add(mesh(cone, RUST).translateY(11.2));
    const ladder: Board[] = [{ s: [0.06, 7.6, 0.06], p: [-0.25, 7.2, 2.5] }, { s: [0.06, 7.6, 0.06], p: [0.25, 7.2, 2.5] }];
    for (let k = 0; k < 18; k++) ladder.push({ s: [0.5, 0.04, 0.04], p: [0, 3.6 + k * 0.42, 2.5] });
    W.add(boards(ladder, WB));
    W.position.set(-13, 0, -8);
    art.add(W);
  }

  // cerca de postes rústicos con tabla arriba para las botellas
  {
    const f: Board[] = [];
    for (let i = -3; i <= 3; i++) f.push({ s: [0.26, 1.5 + jitter(0.06), 0.26], p: [i * 2.1 + jitter(0.05), 0.75, FENCE_Z + jitter(0.04)], r: [jitter(0.04), jitter(0.2), jitter(0.04)] });
    f.push({ s: [13.2, 0.08, 0.34], p: [0, 1.54, FENCE_Z], r: [0, 0, 0.004] });
    f.push({ s: [13, 0.17, 0.07], p: [0, 0.62, FENCE_Z + 0.17], r: [0, 0, -0.01] });
    f.push({ s: [13, 0.17, 0.07], p: [0, 1.12, FENCE_Z + 0.17], r: [0, 0, 0.008] });
    art.add(boards(f, WA));
  }

  // saguaros con costillas, aréolas y brazos
  {
    const cw = 256, ch = 512;
    const cn = makeNoise(21);
    const ribs = (u: number) => 0.5 + 0.5 * Math.cos(u * 12 * Math.PI * 2);
    const are = (u: number, v: number) => {
      const fu = (u * 12) % 1, fv = (v * 60) % 1;
      const d = Math.hypot(Math.min(fu, 1 - fu) * 2.2, (fv - 0.5) * 1.2);
      return Math.max(0, 1 - d * 6);
    };
    const cmap = colorCanvas(cw, ch, (u, v) => {
      const r = ribs(u), a = are(u, v), n = cn.fbm(u * 8, v * 16, 8, 3);
      const base: [number, number, number] = [0.17 + r * 0.12 + n * 0.05, 0.29 + r * 0.16 + n * 0.06, 0.15 + r * 0.06];
      const dry = Math.max(0, 0.25 - v) * 1.2; // la base está más seca y gris
      return [base[0] + a * 0.5 + dry * 0.25, base[1] + a * 0.45 + dry * 0.08, base[2] + a * 0.35 + dry * 0.12];
    });
    const cht = field(cw, ch, (u, v) => ribs(u) * 0.8 + are(u, v) * 0.4);
    const cactusTex = tex(THREE, cmap, { srgb: true, aniso });
    const cactusN = tex(THREE, normalCanvas(cht, 3), { aniso });
    textures.push(cactusTex, cactusN);
    const cactusMat = dissolve(new THREE.MeshStandardMaterial({ map: cactusTex, normalMap: cactusN, roughness: 0.75 }), "art");
    const column = (r: number, h: number) => {
      const pts: T.Vector2[] = [];
      for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(r * (1 - (i / 10) * 0.06), (i / 10) * h));
      for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(r * 0.94 * Math.cos(a), h + r * 0.94 * Math.sin(a))); }
      const g = new THREE.LatheGeometry(pts, 72);
      const p = g.attributes.position as T.BufferAttribute;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), z = p.getZ(k);
        const s = 1 + 0.085 * Math.cos(Math.atan2(x, z) * 12);
        p.setX(k, x * s);
        p.setZ(k, z * s);
      }
      g.computeVertexNormals();
      return g;
    };
    for (const [x, z, h] of CACTI) {
      const c = new THREE.Group();
      c.add(mesh(column(0.42, h), cactusMat));
      for (const side of [-1, 1]) {
        if (R() < 0.25) continue;
        const y = h * (0.35 + R() * 0.25);
        const elbow = mesh(column(0.28, 0.75), cactusMat);
        elbow.rotation.z = -side * Math.PI / 2;
        elbow.position.set(side * 0.25, y, 0);
        const up = mesh(column(0.28, 1.1 + R() * 1.2), cactusMat);
        up.position.set(side * 0.98, y - 0.05, 0);
        c.add(elbow, up);
      }
      c.position.set(x, -0.1, z);
      c.rotation.y = R() * Math.PI;
      art.add(c);
    }
  }

  // postes de telégrafo con cables
  {
    const poles = new THREE.Group();
    const tops: T.Vector3[] = [];
    for (const x of [-36, -22, -8, 8, 22, 36]) {
      const p = mesh(new THREE.CylinderGeometry(0.11, 0.15, 7.2, 12), WB);
      p.position.set(x, 3.6, 4.4);
      p.rotation.z = jitter(0.03);
      poles.add(p, boards([{ s: [2.3, 0.15, 0.15], p: [x, 6.6, 4.4] }], WB));
      tops.push(new THREE.Vector3(x, 6.72, 4.4));
    }
    const pts: T.Vector3[] = [];
    for (let i = 0; i < tops.length - 1; i++) {
      for (const dx of [-0.9, 0.9]) {
        for (let k = 0; k < 14; k++) {
          const a = tops[i].clone().lerp(tops[i + 1], k / 14), b = tops[i].clone().lerp(tops[i + 1], (k + 1) / 14);
          a.z += dx * 0.5; b.z += dx * 0.5;
          a.y -= Math.sin((k / 14) * Math.PI) * 0.9;
          b.y -= Math.sin(((k + 1) / 14) * Math.PI) * 0.9;
          pts.push(a, b);
        }
      }
    }
    poles.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#1d1416" })));
    scene.add(poles);
  }

  // ── Botellas de vidrio de verdad ───────────────────────────────
  const profile = [
    [0, 0], [0.19, 0], [0.205, 0.015], [0.21, 0.05], [0.21, 0.55], [0.2, 0.62], [0.15, 0.72], [0.09, 0.82], [0.078, 0.9],
    [0.076, 1.06], [0.088, 1.075], [0.09, 1.11], [0.08, 1.13], [0.07, 1.13], [0.066, 1.1], [0.066, 0.92], [0, 0.92],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bottleGeo = new THREE.LatheGeometry(profile, 40);
  const bottleCols = ["#2f8f4f", "#8a4b1f", "#3d7fb5", "#2f8f4f", "#a8662a", "#5aa58a"];
  const bottleArt = bottleCols.map((c) => new THREE.Color(c));
  const greyGlass = new THREE.Color("#8d8f91");
  const bottleMats = bottleCols.map((c) => small
    ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 1 })
    : new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transmission: 1, thickness: 0.35, ior: 1.5, attenuationColor: c, attenuationDistance: 0.35, clearcoat: 1, specularIntensity: 1 }));
  const labelTex = (text: string) => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e7dcc0";
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(90,60,30,${R() * 0.08})`; ctx.fillRect(R() * 512, R() * 256, 3, 3); }
    ctx.strokeStyle = "#5a2a1c"; ctx.lineWidth = 6; ctx.strokeRect(14, 14, 484, 228);
    ctx.fillStyle = "#3a1c12"; ctx.textAlign = "center";
    ctx.font = "800 70px 'Funnel Display Variable', serif"; ctx.fillText(text, 256, 135);
    ctx.font = "600 26px 'Funnel Sans Variable', sans-serif"; ctx.fillText("PUNK COWBOY · XXX", 256, 190);
    const t = tex(THREE, c, { srgb: true, aniso });
    textures.push(t);
    return t;
  };
  const labels = [labelTex("WHISKEY"), labelTex("MEZCAL")];
  const bottles = bottleMats.map((mat, i) => {
    const b = new THREE.Mesh(bottleGeo, mat);
    b.castShadow = shadows;
    b.position.set(-5.25 + i * 2.1, 1.58, FENCE_Z);
    if (i === 1 || i === 4) {
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.214, 0.214, 0.3, 32, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ map: labels[i === 1 ? 0 : 1], roughness: 0.85 }));
      lab.position.y = 0.32;
      b.add(lab);
    }
    scene.add(b);
    return b;
  });

  // esquirlas de vidrio
  const SHARDS = 160;
  const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.07), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.9, clearcoat: 1 }), SHARDS);
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;
  const shardState = Array.from({ length: SHARDS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }));
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < SHARDS; i++) shards.setMatrixAt(i, hidden);
  shards.setColorAt(0, new THREE.Color("#ffffff"));
  scene.add(shards);
  let shardNext = 0;
  const burst = (at: T.Vector3, color: T.Color) => {
    for (let k = 0; k < 26; k++) {
      const s = shardState[shardNext];
      s.p.copy(at).add(new THREE.Vector3((R() - 0.5) * 0.3, R() * 0.6, (R() - 0.5) * 0.3));
      s.v.set((R() - 0.5) * 5, 2 + R() * 4.5, (R() - 0.3) * 4);
      s.w.set(R() * 12, R() * 12, R() * 12);
      s.life = 2.6;
      shards.setColorAt(shardNext, color);
      shardNext = (shardNext + 1) % SHARDS;
    }
    if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
  };

  // rodadora y polvo en el aire
  const weed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 2), new THREE.MeshStandardMaterial({ color: "#8c6a3f", wireframe: true }));
  weed.position.set(-40, 0.75, 3);
  scene.add(weed);
  const dustN = small ? 300 : 700;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) dustPos.set([(R() - 0.5) * 60, R() * 9, (R() - 0.5) * 40], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: "#ffd2a1", size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ── Luces ──────────────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight("#d9dde3", "#6b5b4e", 1.2);
  const sunLight = new THREE.DirectionalLight("#ffffff", 3);
  sunLight.castShadow = shadows;
  sunLight.shadow.mapSize.set(4096, 4096);
  const sc = sunLight.shadow.camera;
  sc.left = sc.bottom = -32; sc.right = sc.top = 32; sc.near = 1; sc.far = 200;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.04;
  sunLight.shadow.radius = 3;
  const neonLight = new THREE.PointLight("#ff4fa3", 0, 18, 1.6);
  neonLight.position.set(0, 4.8, -0.8);
  const porch = new THREE.PointLight("#ffb05c", 0, 14, 1.8);
  porch.position.set(0, 2.6, -1);
  scene.add(hemi, sunLight, sunLight.target, neonLight, porch);

  // ── Postproceso ────────────────────────────────────────────────
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── Cámara ─────────────────────────────────────────────────────
  const camPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(30, 20, 36), new THREE.Vector3(-24, 11, 24), new THREE.Vector3(-8, 4, 17),
    new THREE.Vector3(9, 3.2, 15), new THREE.Vector3(2, 2.7, 20.5), new THREE.Vector3(0, 2.35, 17.6),
  ], false, "centripetal");
  const lookPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2, -3), new THREE.Vector3(0, 3, -3), new THREE.Vector3(0, 3.5, -2),
    new THREE.Vector3(0, 3.8, -3), new THREE.Vector3(0, 2.4, 4), new THREE.Vector3(0, 1.95, 7),
  ], false, "centripetal");

  let W = 1, H = 1;
  const resize = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.fov = W / H < 0.9 ? 58 : 42;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ── Disparos ───────────────────────────────────────────────────
  let active = false;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let shake = 0;
  let audio: AudioContext | null = null;
  const bang = () => {
    try {
      audio ??= new AudioContext();
      const ac = audio;
      const len = ac.sampleRate * 0.35;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      const gain = ac.createGain();
      gain.gain.value = 0.22;
      src.connect(lp).connect(gain).connect(ac.destination);
      src.start();
    } catch { /* sin audio, el disparo sigue */ }
  };
  const onDown = (e: PointerEvent) => {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    bang();
    shake = reduce ? 0 : 0.12;
    const hit = ray.intersectObjects(bottles.filter((b) => b.visible), false)[0];
    if (hit) {
      const b = hit.object as T.Mesh;
      b.visible = false;
      burst(b.position.clone().add(new THREE.Vector3(0, 0.6, 0)), (b.material as T.MeshPhysicalMaterial).color);
      onHit(e.clientX - r.left, e.clientY - r.top, bottles.filter((x) => x.visible).length);
    } else {
      onMiss(e.clientX - r.left, e.clientY - r.top);
    }
  };
  canvas.addEventListener("pointerdown", onDown);

  // ── Bucle ──────────────────────────────────────────────────────
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const fogGrey = new THREE.Color("#9a9b9c"), fogDay = new THREE.Color("#d6c2a6"), fogDusk = new THREE.Color("#b8705e");
  const sunDay = new THREE.Color("#fff1dc"), sunDusk = new THREE.Color("#ff8a52");
  const hemiGrey = new THREE.Color("#e0e2e5"), hemiDay = new THREE.Color("#b9d2ef"), hemiDusk = new THREE.Color("#8a5aa8");
  const tmpC = new THREE.Color();
  const dummy = new THREE.Object3D();
  let raf = 0, visible = true, last = performance.now(), t = 0, p = 0, castArt: boolean | null = null;

  const frame = (now: number) => {
    const raw = clamp((now - last) / 1000, 0, 0.5);
    const dt = Math.min(0.05, raw);
    last = now;
    t += dt;
    p += (clamp(progress()) - p) * (1 - Math.pow(0.003, raw));
    const artK = smooth(clamp((p - 0.15) / 0.25));
    const dusk = smooth(clamp((p - 0.44) / 0.22));
    reveal.value = artK;

    // prototipo → arte
    protoMat.opacity = 0.6 * (1 - artK);
    blockout.visible = artK < 0.999;
    art.visible = artK > 0.001;
    const nowArt = artK > 0.5;
    if (nowArt !== castArt) {
      castArt = nowArt;
      blockout.traverse((o) => { if ((o as T.Mesh).isMesh) o.castShadow = shadows && !nowArt; });
      art.traverse((o) => { if ((o as T.Mesh).isMesh) o.castShadow = shadows && nowArt; });
    }
    greyDome.material.opacity = 1 - artK;
    greyDome.visible = artK < 0.999;
    bottleMats.forEach((m, i) => {
      m.color.copy(greyGlass).lerp(bottleArt[i], artK);
      if (m.transmission > 0) m.attenuationColor.copy(m.color);
    });

    // sol: alto de día, casi en el horizonte al atardecer, detrás del pueblo
    const elev = THREE.MathUtils.degToRad(28 - dusk * 26.5);
    const az = THREE.MathUtils.degToRad(188);
    sunDir.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az));
    skyU.sunPosition.value.copy(sunDir);
    skyU.rayleigh.value = 1.4 + dusk * 1.6;
    skyU.turbidity.value = 3.5 + dusk * 4;
    skyU.time.value = reduce ? 0 : t;
    sunLight.position.copy(sunDir).multiplyScalar(90);
    sunLight.color.copy(sunDay).lerp(sunDusk, dusk);
    sunLight.intensity = 3.2 - dusk * 1.6;
    hemi.color.copy(hemiGrey).lerp(hemiDay, artK).lerp(hemiDusk, dusk);
    hemi.intensity = 1.3 - dusk * 0.55;
    (scene.fog as T.FogExp2).color.copy(fogGrey).lerp(fogDay, artK).lerp(fogDusk, dusk);
    renderer.toneMappingExposure = 0.72 + dusk * 0.12;

    // neón y ventanas: encienden con el atardecer; el neón parpadea como uno viejo
    const flick = reduce ? 1 : Math.sin(t * 31) > 0.96 || Math.sin(t * 7.3) > 0.985 ? 0.25 : 1;
    for (const g of glowMats) {
      const level = dusk * (g.flicker ? flick : 1);
      tmpC.copy(g.base).multiplyScalar(0.06 + level * (g.flicker ? 1.7 : 1.15));
      g.mat.color.copy(tmpC);
    }
    neonLight.intensity = dusk * flick * 22;
    porch.intensity = dusk * 10;
    dustMat.opacity = artK * (0.25 + dusk * 0.45);
    weed.visible = artK > 0.5;
    if (!reduce) {
      dust.rotation.y = Math.sin(t * 0.05) * 0.05;
      dust.position.x = Math.sin(t * 0.13) * 1.5;
      const cycle = (t * 6) % 140;
      weed.position.set(-60 + cycle, 0.75 + Math.abs(Math.sin(t * 5)) * 0.5, 3);
      weed.rotation.z = -t * 6;
    }

    // esquirlas con gravedad y rebote
    let anyShard = false;
    for (let i = 0; i < SHARDS; i++) {
      const s = shardState[i];
      if (s.life <= 0) continue;
      anyShard = true;
      s.life -= dt;
      s.v.y -= 14 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.05) { s.p.y = 0.05; s.v.y *= -0.3; s.v.x *= 0.6; s.v.z *= 0.6; s.w.multiplyScalar(0.6); }
      s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
      dummy.position.copy(s.p);
      dummy.rotation.copy(s.r);
      dummy.scale.setScalar(s.life > 0.4 ? 1 : s.life / 0.4);
      dummy.updateMatrix();
      shards.setMatrixAt(i, s.life > 0 ? dummy.matrix : hidden);
    }
    if (anyShard) shards.instanceMatrix.needsUpdate = true;

    // cámara
    const u = clamp(p);
    camPath.getPoint(u, camPos);
    lookPath.getPoint(u, camLook);
    const aspect = W / H;
    if (aspect < 1.25) camPos.sub(camLook).multiplyScalar(clamp(1.35 / aspect, 1, 2.3)).add(camLook);
    if (!reduce) {
      camPos.x += Math.sin(t * 0.3) * 0.25 * (1 - u);
      camPos.y += Math.sin(t * 0.4) * 0.12;
    }
    shake = Math.max(0, shake - dt * 0.6);
    camera.position.set(camPos.x + (R() - 0.5) * shake, camPos.y + (R() - 0.5) * shake, camPos.z);
    camera.lookAt(camLook);

    composer.render(dt);
    if (visible) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(host);
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    reset() { bottles.forEach((b) => (b.visible = true)); },
    setActive(on: boolean) { active = on; canvas.style.cursor = on ? "crosshair" : ""; },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      const mats = new Set<T.Material>();
      scene.traverse((o) => {
        const m = o as T.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as T.Material | T.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
        else if (mat) mats.add(mat);
      });
      mats.forEach((m) => m.dispose());
      textures.forEach((x) => x.dispose());
      audio?.close().catch(() => {});
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
