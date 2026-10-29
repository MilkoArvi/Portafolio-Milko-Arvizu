import type * as T from "three";
import { brushed, bracketTexture, contactShadow, meshAlpha, PCB, pcbTexture, rng, sleeve, textTexture } from "./textures";
import { brushedSet, field, normalCanvas, powderNormal, smudges, tex } from "@/lib/procedural";

// Mi PC modelada con código. Todo sale de primitivas, extrusiones y texturas de canvas.
// Render: MSAA en el búfer de la escena, piso con reflejo real, bloom para el RGB,
// mapa de entorno con softboxes de estudio y una pasada final de viñeta y grano.

export type PcSceneOptions = {
  host: HTMLElement;
  progress: () => number; // scroll 0..1
  stages: number;
  wide: () => boolean; // hay columna de texto a la izquierda
};

const FLOOR_Y = -2.5;
const MINT = "#8fcfa5";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

// Cámara por etapa: posición y punto al que mira.
const CAM: [number, number, number][][] = [
  [[7.4, 3.5, 12.6], [0, 0, 0]], // gabinete
  [[3.0, 1.9, 8.8], [-0.6, 0.6, -0.9]], // tarjeta madre
  [[0.6, 1.8, 4.0], [-0.82, 1.42, -0.88]], // procesador
  [[2.4, 3.0, 5.4], [-0.82, 1.45, -0.6]], // disipador
  [[2.5, 2.3, 4.6], [-0.15, 1.5, -0.75]], // memoria
  [[3.6, -1.0, 6.4], [-0.85, -0.05, -0.35]], // tarjeta gráfica, desde abajo para ver los ventiladores
  [[3.0, -1.5, 7.0], [-1.1, -1.8, 0.0]], // fuente
  [[8.8, 1.3, 8.0], [0.8, 0.2, 0.0]], // ventiladores y vidrio
  [[5.8, 2.6, 12.0], [0, 0.15, 0]], // encendido
];

const FLOOR_SHADER = {
  name: "PisoBrillante",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTexel: { value: [1 / 1024, 1 / 1024] },
    uRadius: { value: 11 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv4;
    varying vec2 vPos;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv4 = textureMatrix * vec4(position, 1.0);
      vPos = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uRadius;
    varying vec4 vUv4;
    varying vec2 vPos;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv4.xy / vUv4.w;
      // reflejo un poco borroso, como un piso de resina pulida y no un espejo
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
          float w = exp(-float(i * i + j * j) * 0.4);
          acc += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * uTexel * 1.8).rgb * w;
          wsum += w;
        }
      }
      acc /= wsum;
      float d = length(vPos);
      float fade = 1.0 - smoothstep(uRadius * 0.2, uRadius, d);
      float pool = 1.0 - smoothstep(0.0, uRadius * 0.7, d);
      vec3 bg = vec3(0.0018, 0.0024, 0.0021);
      gl_FragColor = vec4(mix(bg, vec3(0.016, 0.019, 0.017), pool) + acc * color * fade, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: [1, 1] } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float d = dot(c, c);
      vec2 off = c * d * 0.01;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - smoothstep(0.16, 0.7, d) * 0.6;
      float n = fract(sin(dot(vUv * uRes + fract(uTime) * 71.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.016;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export async function createPcScene({ host, progress, stages: N, wide }: PcSceneOptions) {
  const THREE = await import("three");
  const [{ RoundedBoxGeometry }, { mergeGeometries }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }, { Reflector }, { GTAOPass }] =
    await Promise.all([
      import("three/examples/jsm/geometries/RoundedBoxGeometry.js"),
      import("three/examples/jsm/utils/BufferGeometryUtils.js"),
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("three/examples/jsm/postprocessing/OutputPass.js"),
      import("three/examples/jsm/postprocessing/ShaderPass.js"),
      import("three/examples/jsm/objects/Reflector.js"),
      import("three/examples/jsm/postprocessing/GTAOPass.js"),
    ]);
  await Promise.all([
    document.fonts.load("700 40px 'Funnel Display Variable'"),
    document.fonts.load("600 26px 'Funnel Sans Variable'"),
  ]).catch(() => {});

  const small = window.matchMedia("(max-width: 768px)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shadows = !small;

  // ── Render ──────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.className = "absolute inset-0 block h-full w-full";
  canvas.style.touchAction = "pan-y";
  host.appendChild(canvas);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const samples = Math.min(small ? 4 : 8, renderer.capabilities.maxSamples);

  const scene = new THREE.Scene();
  const bgOff = new THREE.Color("#060807");
  const bgOn = new THREE.Color("#08100c");
  scene.background = bgOff.clone();
  scene.fog = new THREE.Fog("#060807", 18, 36);

  // Entorno de estudio: un cuarto oscuro con softboxes. Es lo que se refleja en metal y vidrio.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color("#060807");
  const lightPanel = (w: number, h: number, color: [number, number, number], pos: [number, number, number], look: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    envScene.add(m);
  };
  lightPanel(14, 4, [5, 5, 5], [0, 9, 2]);
  lightPanel(3, 10, [3.2, 3.2, 3.4], [-10, 2, 6]);
  lightPanel(2, 9, [0.8, 2.6, 1.6], [10, 1, 4]);
  lightPanel(9, 1.4, [1.4, 1.8, 3.6], [0, 3, -10]);
  lightPanel(6, 0.8, [2, 2, 2], [6, -1, 9]);
  // paredes tenues a los lados (no al frente: el vidrio se vería empañado)
  lightPanel(20, 8, [0.12, 0.13, 0.13], [-12, 2, 0]);
  lightPanel(30, 30, [0.05, 0.05, 0.05], [0, -8, 0]);
  const env = pmrem.fromScene(envScene, 0.035).texture;
  envScene.traverse((o) => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as T.Material).dispose(); } });
  scene.environment = env;
  scene.environmentIntensity = 1.15;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  // Luces: principal cálida con sombras, contraluz frío, relleno muy bajo y luces internas que nacen al encender.
  // la principal entra por el lado del vidrio: desde arriba el techo del gabinete dejaba todo en sombra
  const key = new THREE.DirectionalLight("#fff3e6", 2.8);
  key.position.set(3.5, 6.5, 11);
  key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  const rim = new THREE.SpotLight("#86b8ff", 30, 0, 0.55, 0.8, 1.4);
  rim.position.set(-8, 6.5, -7);
  const fill = new THREE.HemisphereLight("#33443b", "#040505", 1.0);
  const glowA = new THREE.PointLight(MINT, 0, 7, 1.6);
  glowA.position.set(1.5, 0.3, -0.3);
  const glowB = new THREE.PointLight("#c7f0da", 0, 6, 1.8);
  glowB.position.set(-0.5, 2.0, 0.4);
  const glowC = new THREE.PointLight(MINT, 0, 4, 2);
  glowC.position.set(-0.7, -0.75, -0.1);
  scene.add(key, key.target, rim, rim.target, fill, glowA, glowB, glowC);

  // ── Materiales ──────────────────────────────────────────────────
  const textures: T.Texture[] = [];
  const keep = <X extends T.Texture>(t: X) => { textures.push(t); return t; };
  const brush = keep(brushed(THREE, aniso));
  const meshTex = keep(meshAlpha(THREE, aniso));
  // microtextura: pintura electrostática, aluminio cepillado, huellas en el vidrio y cabezas de tornillo
  const powder = keep(powderNormal(THREE));
  powder.repeat.set(6, 6);
  const brushedN = brushedSet(THREE);
  keep(brushedN.normalMap).repeat.set(2, 2);
  keep(brushedN.roughnessMap).repeat.set(2, 2);
  const glassSmudge = keep(smudges(THREE));
  const screwHead = keep(tex(THREE, normalCanvas(field(64, 64, (u, v) => {
    const x = u - 0.5, y = v - 0.5, r = Math.hypot(x, y);
    const slot = (Math.abs(x) < 0.06 && Math.abs(y) < 0.28) || (Math.abs(y) < 0.06 && Math.abs(x) < 0.28) ? -0.5 : 0;
    return Math.max(0, 1 - r * 2) * 0.45 + slot;
  }), 4)));
  const phys = (p: T.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);
  const std = (p: T.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const M = {
    shell: phys({ color: "#15191a", metalness: 0.75, roughness: 0.46, normalMap: powder, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    inner: phys({ color: "#0c0f0e", metalness: 0.5, roughness: 0.62, normalMap: powder, normalScale: new THREE.Vector2(0.3, 0.3) }),
    glass: phys({ color: "#a9c4b7", metalness: 0, roughness: 1, roughnessMap: glassSmudge, transparent: true, opacity: 0.07, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5, ior: 1.52, depthWrite: false }),
    print: std({ color: "#030404", roughness: 0.25, metalness: 0.2 }),
    pcbEdge: std({ color: "#0c100e", roughness: 0.7 }),
    sink: phys({ color: "#2a2f2d", metalness: 0.92, roughness: 0.85, roughnessMap: brushedN.roughnessMap, normalMap: brushedN.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), clearcoat: 0.2 }),
    alu: phys({ color: "#c9ced0", metalness: 1, roughness: 0.8, roughnessMap: brushedN.roughnessMap, normalMap: brushedN.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) }),
    screw: phys({ color: "#b4b9bc", metalness: 1, roughness: 0.32, normalMap: screwHead, normalScale: new THREE.Vector2(1, 1) }),
    choke: std({ color: "#3d4245", metalness: 0.6, roughness: 0.5, normalMap: powder, normalScale: new THREE.Vector2(0.6, 0.6) }),
    copper: phys({ color: "#c97b47", metalness: 1, roughness: 0.24 }),
    nickel: phys({ color: "#d6d9db", metalness: 1, roughness: 0.17, clearcoat: 0.4, clearcoatRoughness: 0.1 }),
    black: std({ color: "#101312", metalness: 0.05, roughness: 0.55, normalMap: powder, normalScale: new THREE.Vector2(0.15, 0.15) }),
    slotA: std({ color: "#2b302e", metalness: 0.1, roughness: 0.45 }),
    slotB: std({ color: "#4a524e", metalness: 0.1, roughness: 0.45 }),
    latch: std({ color: "#8e9693", metalness: 0.1, roughness: 0.5 }),
    gold: std({ color: "#d9ad55", metalness: 1, roughness: 0.28 }),
    rubber: std({ color: "#060707", roughness: 0.95 }),
    substrate: std({ color: "#173726", roughness: 0.5, metalness: 0.2 }),
    bladeDark: std({ color: "#0c0e0d", roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }),
    sleeveBlack: std({ map: keep(sleeve(THREE, aniso, "#0f1211", "#262b29")), roughness: 0.75 }),
    sleeveMint: std({ map: keep(sleeve(THREE, aniso, "#3f7d57", "#8fcfa5")), roughness: 0.7 }),
  };
  // Malla perforada: cada panel lleva su propia repetición para que los hexágonos midan lo mismo.
  const grille = (w: number, h: number) => {
    const map = keep(meshTex.clone());
    map.repeat.set(w * 5.5, h * 5.5);
    return phys({ color: "#0d100f", metalness: 0.75, roughness: 0.45, alphaMap: map, alphaTest: 0.5, side: THREE.DoubleSide, alphaToCoverage: samples > 0 });
  };

  // Materiales que brillan al encender. delay ordena el barrido de luz.
  type Glow = { mat: T.MeshStandardMaterial; delay: number; peak: number; hue: number; white?: boolean };
  const glows: Glow[] = [];
  const glow = (delay: number, peak = 1.8, opts: { white?: boolean; base?: string; map?: T.Texture; frosted?: boolean } = {}) => {
    const mat = opts.frosted
      ? std({ color: "#d9e3dd", roughness: 0.42, metalness: 0, transparent: true, opacity: 0.88, emissive: MINT, emissiveIntensity: 0, side: THREE.DoubleSide })
      : std({ color: opts.base ?? "#050605", roughness: 0.4, metalness: 0, emissive: opts.white ? "#ffffff" : MINT, emissiveIntensity: 0, emissiveMap: opts.map ?? null });
    glows.push({ mat, delay, peak, hue: Math.random() * 6, white: opts.white });
    return mat;
  };

  // ── Ayudantes de geometría ──────────────────────────────────────
  const mesh = (g: T.BufferGeometry, m: T.Material) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = o.receiveShadow = shadows;
    return o;
  };
  const rbox = (w: number, h: number, d: number, r: number, m: T.Material, seg = 3) =>
    mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)), m);
  const box = (w: number, h: number, d: number, m: T.Material) => mesh(new THREE.BoxGeometry(w, h, d), m);
  const cylZ = (r: number, h: number, m: T.Material, seg = 32) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    g.rotateX(Math.PI / 2);
    return mesh(g, m);
  };
  const at = <O extends T.Object3D>(o: O, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };
  const noGhost = (o: T.Object3D) => { o.userData.noGhost = true; return o; };

  const rotors: { obj: T.Object3D; speed: number; blur: T.MeshBasicMaterial }[] = [];

  // Ventilador con eje en +z. frame: marco cuadrado de 120 mm; ring: aro ARGB.
  function fan(size: number, o: { frame: boolean; ring?: number; blades?: number; bladeMat: T.Material; speed: number }) {
    const g = new THREE.Group();
    const R = size * 0.46;
    const depth = size * 0.2;
    if (o.frame) {
      const s = new THREE.Shape();
      const h = size / 2, cr = size * 0.09;
      s.moveTo(-h + cr, -h);
      s.lineTo(h - cr, -h); s.quadraticCurveTo(h, -h, h, -h + cr);
      s.lineTo(h, h - cr); s.quadraticCurveTo(h, h, h - cr, h);
      s.lineTo(-h + cr, h); s.quadraticCurveTo(-h, h, -h, h - cr);
      s.lineTo(-h, -h + cr); s.quadraticCurveTo(-h, -h, -h + cr, -h);
      const hole = new THREE.Path();
      hole.absarc(0, 0, R * 1.05, 0, Math.PI * 2, true);
      s.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: size * 0.008, bevelThickness: size * 0.008, bevelSegments: 2, curveSegments: 40 });
      geo.translate(0, 0, -depth / 2);
      g.add(mesh(geo, M.black));
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        g.add(noGhost(at(cylZ(size * 0.03, depth * 1.06, M.rubber, 12), sx * (h - size * 0.08), sy * (h - size * 0.08), 0)));
        // soporte del motor: va del centro a cada esquina por la cara de atrás
        const len = Math.hypot(h, h) - R * 0.32;
        const strut = noGhost(box(len, size * 0.028, depth * 0.16, M.black));
        strut.position.set(sx * (R * 0.32 + len / 2) * Math.SQRT1_2, sy * (R * 0.32 + len / 2) * Math.SQRT1_2, -depth * 0.42);
        strut.rotation.z = Math.atan2(sy, sx);
        g.add(strut);
      }
      g.add(noGhost(at(cylZ(R * 0.34, depth * 0.18, M.black, 40), 0, 0, -depth * 0.42)));
    }
    // aspas: una forma curva extruida, inclinada y repetida alrededor del eje
    const n = o.blades ?? 9;
    const r0 = R * 0.3, r1 = R * 0.97;
    const bs = new THREE.Shape();
    bs.moveTo(r0, -0.1 * R);
    bs.quadraticCurveTo((r0 + r1) / 2, -0.32 * R, r1, -0.17 * R);
    bs.quadraticCurveTo(r1 * 1.03, 0.04 * R, r1 * 0.95, 0.24 * R);
    bs.quadraticCurveTo((r0 + r1) / 2, 0.22 * R, r0, 0.13 * R);
    bs.lineTo(r0, -0.1 * R);
    const blade = new THREE.ExtrudeGeometry(bs, { depth: size * 0.01, bevelEnabled: true, bevelSize: size * 0.004, bevelThickness: size * 0.003, bevelSegments: 1, curveSegments: 8 });
    blade.rotateX(0.5);
    const copies = Array.from({ length: n }, (_, i) => blade.clone().rotateZ((i / n) * Math.PI * 2));
    const bladesGeo = mergeGeometries(copies)!;
    copies.forEach((c) => c.dispose());
    blade.dispose();
    const rotor = new THREE.Group();
    rotor.add(noGhost(mesh(bladesGeo, o.bladeMat)));
    rotor.add(noGhost(cylZ(r0 * 1.02, depth * 0.7, M.black, 40)));
    rotor.add(noGhost(at(cylZ(r0 * 0.7, depth * 0.72, M.shell, 40), 0, 0, 0.002)));
    g.add(rotor);
    const blurMat = new THREE.MeshBasicMaterial({ color: "#2a332f", transparent: true, opacity: 0, depthWrite: false });
    const blur = noGhost(new THREE.Mesh(new THREE.RingGeometry(r0, R * 0.98, 64), blurMat));
    blur.position.z = depth * 0.12;
    g.add(blur);
    if (o.ring !== undefined) {
      const ring = noGhost(new THREE.Mesh(new THREE.TorusGeometry(R * 1.05, size * 0.012, 10, 96), glow(o.ring)));
      ring.position.z = depth * 0.5;
      g.add(ring);
      const ringBack = ring.clone();
      ringBack.position.z = -depth * 0.5;
      g.add(ringBack);
    }
    rotors.push({ obj: rotor, speed: o.speed, blur: blurMat });
    return g;
  }

  const tube = (pts: [number, number, number][], r: number, m: T.Material, seg = 48) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    const geo = new THREE.TubeGeometry(curve, seg, r, 10, false);
    return mesh(geo, m);
  };

  // ── Piezas ──────────────────────────────────────────────────────
  const pc = new THREE.Group();
  scene.add(pc);
  type Part = { obj: T.Object3D; stage: number; from: T.Vector3; home: T.Vector3; ghost?: T.LineSegments; flash: number; seated: boolean };
  const parts: Part[] = [];
  const ghostMat = new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });

  // Silueta de la pieza en su lugar final: aparece mientras la pieza viaja y destella al encajar.
  const makeGhost = (obj: T.Object3D) => {
    obj.updateMatrixWorld(true);
    const inv = obj.matrixWorld.clone().invert();
    const geos: T.BufferGeometry[] = [];
    obj.traverse((c) => {
      const m = c as T.Mesh;
      if (!m.isMesh || (m as unknown as T.InstancedMesh).isInstancedMesh) return;
      let skip = false;
      for (let p: T.Object3D | null = c; p && p !== obj; p = p.parent) if (p.userData.noGhost) skip = true;
      if (skip) return;
      const e = new THREE.EdgesGeometry(m.geometry, 28);
      e.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      geos.push(e);
    });
    if (!geos.length) return undefined;
    const merged = mergeGeometries(geos)!;
    geos.forEach((g) => g.dispose());
    const lines = new THREE.LineSegments(merged, ghostMat.clone());
    lines.renderOrder = 10;
    return lines;
  };

  const add = (obj: T.Object3D, stage: number, from: [number, number, number], ghost = true) => {
    pc.add(obj);
    const part: Part = { obj, stage, from: new THREE.Vector3(...from), home: obj.position.clone(), flash: 0, seated: false };
    if (ghost) {
      const g = makeGhost(obj);
      if (g) {
        g.position.copy(obj.position);
        g.quaternion.copy(obj.quaternion);
        pc.add(g);
        part.ghost = g;
      }
    }
    parts.push(part);
    obj.visible = false;
  };

  // 0 · Gabinete
  {
    const g = new THREE.Group();
    g.add(at(rbox(4.44, 4.74, 0.05, 0.02, M.shell), 0, 0, -1.12));
    g.add(at(rbox(4.34, 4.62, 0.04, 0.015, M.inner), 0, 0, -1.07));
    g.add(at(rbox(4.44, 0.1, 2.26, 0.045, M.shell), 0, 2.33, 0));
    g.add(at(rbox(4.44, 0.1, 2.26, 0.045, M.shell), 0, -2.33, 0));
    g.add(at(rbox(0.06, 4.6, 2.2, 0.02, M.inner), -2.19, 0, 0));
    // filtro superior
    const top = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.7), grille(3.6, 1.7)));
    top.rotation.x = -Math.PI / 2;
    g.add(at(top, -0.1, 2.385, 0));
    // frente: malla hexagonal con marco
    const front = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(1.96, 4.5), grille(1.96, 4.5)));
    front.rotation.y = Math.PI / 2;
    g.add(at(front, 2.2, 0, 0));
    g.add(at(rbox(0.1, 4.74, 0.14, 0.03, M.shell), 2.19, 0, 1.06));
    g.add(at(rbox(0.1, 4.74, 0.14, 0.03, M.shell), 2.19, 0, -1.06));
    // ranuras PCIe traseras
    for (let i = 0; i < 7; i++) g.add(at(box(0.02, 0.1, 0.9, M.inner), -2.15, 0.3 - i * 0.2, -0.45));
    // cubierta de la fuente con ventana
    g.add(at(rbox(3.7, 0.05, 2.08, 0.015, M.shell), -0.3, -1.42, 0));
    g.add(at(box(0.2, 0.86, 0.04, M.shell), -2.05, -1.86, 1.04));
    g.add(at(box(2.3, 0.86, 0.04, M.shell), 0.4, -1.86, 1.04));
    g.add(at(box(1.2, 0.18, 0.04, M.shell), -1.35, -1.51, 1.04));
    g.add(at(box(1.2, 0.16, 0.04, M.shell), -1.35, -2.2, 1.04));
    g.add(at(box(0.05, 0.86, 2.08, M.shell), 1.55, -1.86, 0));
    const vent = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), grille(0.8, 1.6)));
    vent.rotation.x = -Math.PI / 2;
    g.add(at(vent, 1.05, -1.39, 0));
    // patas de goma
    for (const [x, z] of [[1.85, 0.8], [1.85, -0.8], [-1.85, 0.8], [-1.85, -0.8]]) {
      const foot = mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.1, 24), M.rubber);
      g.add(at(foot, x, -2.43, z));
    }
    // botón de encendido con su LED
    g.add(at(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 32), M.alu), 1.75, 2.395, 0.7));
    const led = noGhost(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 8, 40), glow(0, 4, { white: true })));
    led.rotation.x = Math.PI / 2;
    g.add(at(led, 1.75, 2.41, 0.7));
    // tira LED interna, arriba del lado del vidrio
    g.add(at(noGhost(box(3.8, 0.025, 0.03, glow(0.02, 1.6))), 0, 2.255, 0.95));
    add(g, 0, [0, -1.4, 0]);
  }

  // 1 · Tarjeta madre (el origen del grupo es la cara frontal del PCB)
  const MB = new THREE.Vector3(-0.62, 0.62, -0.93);
  const SOCKET = new THREE.Vector3(-0.2, 0.92, 0);
  {
    const g = new THREE.Group();
    const pcbTex = keep(pcbTexture(THREE, aniso));
    g.add(at(box(PCB.w, PCB.h, 0.035, M.pcbEdge), 0, 0, -0.0175));
    // el relieve sale de la misma textura: pistas y componentes quedan un poco levantados
    const src = pcbTex.image as HTMLCanvasElement;
    const sw = src.width >> 1, sh = src.height >> 1;
    const sc = document.createElement("canvas");
    sc.width = sw; sc.height = sh;
    const sctx = sc.getContext("2d")!;
    sctx.drawImage(src, 0, 0, sw, sh);
    const lum = sctx.getImageData(0, 0, sw, sh).data;
    const pcbBump = keep(tex(THREE, normalCanvas(field(sw, sh, (_u, _v, x, y) => { const i = (y * sw + x) * 4; return (lum[i] + lum[i + 1] + lum[i + 2]) / 765; }), 2.5)));
    g.add(noGhost(at(mesh(new THREE.PlaneGeometry(PCB.w, PCB.h), std({ map: pcbTex, normalMap: pcbBump, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, metalness: 0.15 })), 0, 0, 0.0008)));
    // tornillos
    for (const [x, y] of [[-1.18, 1.48], [0.2, 1.48], [1.18, 1.48], [-1.18, 0.05], [0.2, 0.05], [1.18, 0.05], [-1.18, -1.45], [0.2, -1.45], [1.18, -1.45]]) {
      g.add(noGhost(at(cylZ(0.04, 0.02, M.screw, 24), x, y, 0.01)));
    }
    // socket AM5 con marco de retención y palanca
    g.add(at(rbox(0.64, 0.64, 0.05, 0.012, M.alu), SOCKET.x, SOCKET.y, 0.025));
    g.add(at(box(0.5, 0.5, 0.03, M.black), SOCKET.x, SOCKET.y, 0.036));
    const lever = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 12), M.alu);
    g.add(at(lever, SOCKET.x + 0.36, SOCKET.y, 0.03));
    // disipadores de VRM con acento de luz
    // disipadores de VRM: base maciza y aletas, con un acento de luz
    g.add(at(rbox(1.0, 0.3, 0.07, 0.02, M.sink), -0.38, 1.52, 0.035));
    g.add(at(rbox(0.26, 0.98, 0.07, 0.02, M.sink), -0.84, 0.82, 0.035));
    {
      const finsTop = new THREE.InstancedMesh(new RoundedBoxGeometry(0.035, 0.28, 0.12, 2, 0.008), M.sink, 18);
      const finsLeft = new THREE.InstancedMesh(new RoundedBoxGeometry(0.24, 0.035, 0.12, 2, 0.008), M.sink, 16);
      const tmp = new THREE.Object3D();
      for (let i = 0; i < 18; i++) { tmp.position.set(-0.86 + i * 0.0565, 1.52, 0.13); tmp.updateMatrix(); finsTop.setMatrixAt(i, tmp.matrix); }
      for (let i = 0; i < 16; i++) { tmp.position.set(-0.84, 0.37 + i * 0.06, 0.13); tmp.updateMatrix(); finsLeft.setMatrixAt(i, tmp.matrix); }
      for (const im of [finsTop, finsLeft]) { im.castShadow = im.receiveShadow = shadows; g.add(im); }
      // bobinas de la alimentación, entre el socket y los disipadores
      const chokes = new THREE.InstancedMesh(new RoundedBoxGeometry(0.075, 0.075, 0.06, 2, 0.01), M.choke, 18);
      for (let i = 0; i < 10; i++) { tmp.position.set(-0.78 + i * 0.09, 1.305, 0.03); tmp.updateMatrix(); chokes.setMatrixAt(i, tmp.matrix); }
      for (let i = 0; i < 8; i++) { tmp.position.set(-0.625, 0.47 + i * 0.09, 0.03); tmp.updateMatrix(); chokes.setMatrixAt(10 + i, tmp.matrix); }
      chokes.castShadow = chokes.receiveShadow = shadows;
      g.add(chokes);
    }
    g.add(noGhost(at(box(0.9, 0.012, 0.01, glow(0.5, 2)), -0.38, 1.385, 0.075)));
    // cubierta del panel trasero con tira de luz
    g.add(at(rbox(0.36, 1.3, 0.32, 0.045, M.shell), -1.1, 0.78, 0.16));
    g.add(noGhost(at(box(0.02, 1.1, 0.02, glow(0.48, 2.4)), -0.915, 0.78, 0.3)));
    // EPS de 8 pines
    g.add(at(box(0.26, 0.1, 0.12, M.black), -1.08, 1.5, 0.06));
    // ranuras DDR5 con seguros
    for (let i = 0; i < 4; i++) {
      const x = 0.42 + i * 0.1;
      // la ranura es un canal: dos paredes y un piso, la barra entra de verdad
      const m = i % 2 ? M.slotB : M.slotA;
      g.add(at(box(0.05, 1.42, 0.02, m), x, 0.92, 0.01));
      g.add(at(box(0.013, 1.42, 0.075, m), x - 0.0185, 0.92, 0.0375));
      g.add(at(box(0.013, 1.42, 0.075, m), x + 0.0185, 0.92, 0.0375));
      g.add(at(box(0.05, 0.06, 0.09, M.latch), x, 0.92 + 0.73, 0.045));
      g.add(at(box(0.05, 0.06, 0.09, M.latch), x, 0.92 - 0.73, 0.045));
    }
    // ATX de 24 pines
    g.add(at(box(0.12, 0.62, 0.13, M.black), 1.16, 0.45, 0.065));
    // PCIe x16 reforzado y x1
    g.add(at(box(1.5, 0.068, 0.095, M.alu), -0.35, -0.38, 0.0475));
    g.add(noGhost(at(box(1.44, 0.022, 0.004, M.black), -0.35, -0.38, 0.096)));
    g.add(at(box(0.48, 0.05, 0.07, M.slotA), -0.62, -0.98, 0.035));
    // M.2 y chipset
    g.add(at(rbox(0.95, 0.2, 0.05, 0.018, M.sink), -0.4, 0.05, 0.025));
    g.add(at(rbox(0.6, 0.55, 0.08, 0.03, M.sink), 0.72, -0.72, 0.04));
    g.add(noGhost(at(box(0.5, 0.012, 0.01, glow(0.52, 2)), 0.72, -0.5, 0.082)));
    // pila del BIOS y cabezales
    g.add(at(cylZ(0.085, 0.03, M.alu, 32), 0.3, -1.2, 0.015));
    for (let i = 0; i < 5; i++) g.add(noGhost(at(box(0.16, 0.06, 0.07, M.black), -0.9 + i * 0.42, -1.52, 0.035)));
    // capacitores: instanciados, alrededor del socket y en el audio
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 16).rotateX(Math.PI / 2), M.black, 22);
    const tops = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.027, 0.027, 0.004, 16).rotateX(Math.PI / 2), M.alu, 22);
    const audio = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 16).rotateX(Math.PI / 2), M.gold, 6);
    const tmp = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < 8; i++) { tmp.position.set(-0.55 + i * 0.1, 0.5, 0.04); tmp.updateMatrix(); caps.setMatrixAt(k, tmp.matrix); tmp.position.z = 0.082; tmp.updateMatrix(); tops.setMatrixAt(k++, tmp.matrix); }
    for (let i = 0; i < 6; i++) { tmp.position.set(0.21, 0.66 + i * 0.1, 0.04); tmp.updateMatrix(); caps.setMatrixAt(k, tmp.matrix); tmp.position.z = 0.082; tmp.updateMatrix(); tops.setMatrixAt(k++, tmp.matrix); }
    for (let i = 0; i < 8; i++) { tmp.position.set(-0.6 + (i % 4) * 0.09, -0.62 - Math.floor(i / 4) * 0.1, 0.04); tmp.updateMatrix(); caps.setMatrixAt(k, tmp.matrix); tmp.position.z = 0.082; tmp.updateMatrix(); tops.setMatrixAt(k++, tmp.matrix); }
    for (let i = 0; i < 6; i++) { tmp.position.set(-1.12 + (i % 3) * 0.1, -1.2 - Math.floor(i / 3) * 0.11, 0.045); tmp.updateMatrix(); audio.setMatrixAt(i, tmp.matrix); }
    for (const im of [caps, tops, audio]) { im.castShadow = im.receiveShadow = shadows; g.add(im); }
    g.position.copy(MB);
    add(g, 1, [-3.2, 0, 0]);
  }
  const socketWorld = MB.clone().add(SOCKET);

  // 2 · Procesador: sustrato, IHS de AM5 con sus muescas y el grabado
  {
    const g = new THREE.Group();
    g.add(at(box(0.48, 0.48, 0.02, M.substrate), 0, 0, 0.05));
    const a = 0.22, n = 0.055;
    const s = new THREE.Shape();
    s.moveTo(-a, -a); s.lineTo(a, -a);
    s.lineTo(a, -0.13); s.lineTo(a - n, -0.13); s.lineTo(a - n, -0.05); s.lineTo(a, -0.05);
    s.lineTo(a, 0.05); s.lineTo(a - n, 0.05); s.lineTo(a - n, 0.13); s.lineTo(a, 0.13);
    s.lineTo(a, a); s.lineTo(-a, a);
    s.lineTo(-a, 0.13); s.lineTo(-a + n, 0.13); s.lineTo(-a + n, 0.05); s.lineTo(-a, 0.05);
    s.lineTo(-a, -0.05); s.lineTo(-a + n, -0.05); s.lineTo(-a + n, -0.13); s.lineTo(-a, -0.13);
    s.lineTo(-a, -a);
    const ihs = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3 });
    g.add(at(mesh(ihs, M.nickel), 0, 0, 0.06));
    // capacitores visibles en las muescas
    for (const [x, y] of [[0.19, 0.09], [0.19, -0.09], [-0.19, 0.09], [-0.19, -0.09]]) g.add(noGhost(at(box(0.03, 0.05, 0.012, M.gold), x, y, 0.066)));
    const etch = keep(textTexture(THREE, [
      { text: "AMD", size: 120, color: "rgba(60,64,66,0.9)", weight: 800 },
      { text: "RYZEN 5 7600", size: 58, color: "rgba(60,64,66,0.85)", weight: 700, track: 4 },
      { text: "6 núcleos · 12 hilos", size: 34, color: "rgba(60,64,66,0.6)", weight: 600, font: "'Funnel Sans Variable', sans-serif" },
    ], 512, 512, aniso));
    const decal = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), std({ map: etch, transparent: true, metalness: 0.9, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 })));
    g.add(at(decal, 0, 0, 0.0975));
    g.position.copy(socketWorld);
    add(g, 2, [0, 2.4, 1.6]);
  }

  // 3 · Disipador de perfil bajo: aletas radiales, núcleo de cobre y ventilador con aro
  {
    const g = new THREE.Group();
    g.add(at(cylZ(0.2, 0.05, M.copper, 48), 0, 0, 0.125));
    g.add(at(cylZ(0.16, 0.32, M.copper, 48), 0, 0, 0.31));
    const finCount = small ? 32 : 52;
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.012, 0.3), M.alu, finCount);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < finCount; i++) {
      const th = (i / finCount) * Math.PI * 2;
      tmp.position.set(Math.cos(th) * 0.31, Math.sin(th) * 0.31, 0.31);
      tmp.rotation.set(0, 0, th);
      tmp.updateMatrix();
      fins.setMatrixAt(i, tmp.matrix);
    }
    fins.castShadow = fins.receiveShadow = shadows;
    g.add(fins);
    const shroud = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 64, 1, true).rotateX(Math.PI / 2), std({ color: "#0f1211", roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }));
    g.add(at(shroud, 0, 0, 0.52));
    g.add(at(mesh(new THREE.RingGeometry(0.43, 0.5, 64), M.shell), 0, 0, 0.6));
    const f = fan(0.92, { frame: false, bladeMat: M.bladeDark, speed: 1.2, blades: 7 });
    g.add(at(f, 0, 0, 0.52));
    const ring = noGhost(new THREE.Mesh(new THREE.TorusGeometry(0.465, 0.012, 10, 96), glow(0.3, 3)));
    g.add(at(ring, 0, 0, 0.605));
    g.position.copy(socketWorld);
    add(g, 3, [0, 0.2, 3.2]);
  }

  // 4 · Memoria: una barra DDR5 de 8 GB en la ranura A2, con barra de luz difusa
  {
    const g = new THREE.Group();
    g.add(at(box(0.02, 1.33, 0.3, M.substrate), 0, 0, 0.15));
    g.add(at(rbox(0.022, 1.36, 0.28, 0.008, M.shell), 0.021, 0, 0.16));
    g.add(at(rbox(0.022, 1.36, 0.28, 0.008, M.shell), -0.021, 0, 0.16));
    g.add(noGhost(at(box(0.026, 1.18, 0.018, M.alu), 0.023, 0, 0.23)));
    g.add(noGhost(at(box(0.026, 1.18, 0.018, M.alu), -0.023, 0, 0.23)));
    g.add(at(rbox(0.05, 1.32, 0.05, 0.016, glow(0.36, 1.4, { frosted: true })), 0, 0, 0.31));
    const label = keep(textTexture(THREE, [{ text: "DDR5 · 8 GB", size: 64, color: "#d9dedb", weight: 700 }], 512, 96, aniso));
    const side = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), std({ map: label, transparent: true, roughness: 0.5 })));
    side.rotation.y = Math.PI / 2;
    g.add(at(side, 0.0335, 0, 0.13));
    g.position.set(MB.x + 0.52, MB.y + 0.92, MB.z + 0.075);
    add(g, 4, [0, 0, 1.9]);
  }

  // 5 · RTX 3060: backplate, PCB, aletas, placa de ventiladores, logo iluminado y bracket
  const GPU = new THREE.Vector3(-0.89, 0.05, -0.36);
  {
    const g = new THREE.Group();
    g.add(at(rbox(2.42, 0.03, 1.12, 0.012, M.sink), 0, 0.205, 0));
    const bpText = keep(textTexture(THREE, [{ text: "GEFORCE RTX 3060", size: 70, color: "rgba(150,158,154,0.85)", weight: 800, track: 6 }], 1024, 128, aniso));
    const bp = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.19), std({ map: bpText, transparent: true, metalness: 0.6, roughness: 0.4 })));
    bp.rotation.x = -Math.PI / 2;
    g.add(at(bp, 0.2, 0.2215, 0.05));
    g.add(at(box(2.4, 0.02, 1.1, std({ color: "#0d1913", roughness: 0.6 })), 0, 0.18, 0));
    // cubierta angular, con una muesca para la pieza central de aluminio
    {
      const sp = new THREE.Shape();
      sp.moveTo(-1.18, 0.05); sp.lineTo(1.18, 0.05); sp.lineTo(1.18, 0.13); sp.lineTo(1.1, 0.17);
      sp.lineTo(0.3, 0.17); sp.lineTo(0.22, 0.13); sp.lineTo(-0.22, 0.13); sp.lineTo(-0.3, 0.17);
      sp.lineTo(-1.1, 0.17); sp.lineTo(-1.18, 0.13); sp.lineTo(-1.18, 0.05);
      const shroudGeo = new THREE.ExtrudeGeometry(sp, { depth: 1.08, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.01, bevelSegments: 2 });
      shroudGeo.translate(0, 0, -0.54);
      g.add(mesh(shroudGeo, M.shell));
      for (const x of [-0.95, 0.95]) {
        const cut = noGhost(box(0.4, 0.008, 0.004, M.black));
        cut.rotation.z = x < 0 ? 0.18 : -0.18;
        g.add(at(cut, x * 0.85, 0.095, 0.551));
      }
    }
    g.add(at(rbox(0.26, 0.125, 1.11, 0.03, M.alu), 0, 0.11, 0));
    // aletas visibles por los costados
    const finN = small ? 36 : 64;
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.17, 1.02), M.alu, finN);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < finN; i++) { tmp.position.set(-1.12 + (i / (finN - 1)) * 2.24, -0.04, 0); tmp.updateMatrix(); fins.setMatrixAt(i, tmp.matrix); }
    fins.castShadow = fins.receiveShadow = shadows;
    g.add(fins);
    // placa inferior con dos huecos redondos para los ventiladores
    const ps = new THREE.Shape();
    ps.moveTo(-1.18, -0.55); ps.lineTo(1.18, -0.55); ps.lineTo(1.18, 0.55); ps.lineTo(-1.18, 0.55); ps.lineTo(-1.18, -0.55);
    for (const cx of [-0.55, 0.55]) { const h = new THREE.Path(); h.absarc(cx, 0, 0.48, 0, Math.PI * 2, true); ps.holes.push(h); }
    const plateGeo = new THREE.ExtrudeGeometry(ps, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 48 });
    plateGeo.rotateX(Math.PI / 2);
    g.add(at(mesh(plateGeo, M.shell), 0, -0.13, 0));
    for (const cx of [-0.55, 0.55]) {
      const f = fan(1.0, { frame: false, bladeMat: M.bladeDark, speed: 0.8, blades: 11 });
      f.rotation.x = Math.PI / 2;
      g.add(at(f, cx, -0.2, 0));
      const bezel = noGhost(new THREE.Mesh(new THREE.TorusGeometry(0.485, 0.016, 10, 80), M.alu));
      bezel.rotation.x = Math.PI / 2;
      g.add(at(bezel, cx, -0.205, 0));
    }
    // logo del lado del vidrio, que se ilumina al encender
    const logoTex = keep(textTexture(THREE, [{ text: "GEFORCE RTX", size: 92, color: "#ffffff", weight: 800, track: 10 }], 1024, 128, aniso, "#000000"));
    // el logo va a la izquierda de la pieza central de aluminio, que sobresale y lo tapaba
    const logo = noGhost(new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.118), glow(0.42, 2.4, { white: true, base: "#0c0e0d", map: logoTex })));
    g.add(at(logo, -0.63, 0.11, 0.553));
    g.add(noGhost(at(box(2.2, 0.012, 0.012, glow(0.44, 2.6)), 0, 0.172, 0.552)));
    // conector de 8 pines
    g.add(at(box(0.22, 0.08, 0.1, M.black), 0.98, 0.12, 0.6));
    // bracket con puertos
    const brk = keep(bracketTexture(THREE, aniso));
    const bracket = box(0.03, 0.62, 1.2, [M.alu, std({ map: brk, metalness: 0.8, roughness: 0.4 }), M.alu, M.alu, M.alu, M.alu] as unknown as T.Material);
    g.add(at(bracket, -1.225, 0.08, 0));
    g.position.copy(GPU);
    add(g, 5, [2.8, 0, 2.0]);
  }

  // 6 · Fuente de poder y cables trenzados
  {
    const g = new THREE.Group();
    g.add(rbox(1.5, 0.82, 1.45, 0.035, M.shell));
    const lab = keep(textTexture(THREE, [
      { text: "⚡", size: 120, color: "#8fcfa5", weight: 700 },
      { text: "AC 100–240 V ~", size: 54, color: "#d8ddda", weight: 700 },
      { text: "ATX", size: 40, color: "#8c948f", weight: 600 },
    ], 512, 320, aniso, "#111413"));
    g.add(noGhost(at(mesh(new THREE.PlaneGeometry(0.9, 0.56), std({ map: lab, roughness: 0.6 })), -0.05, 0, 0.727)));
    g.position.set(-1.32, -1.88, -0.22);
    add(g, 6, [-2.6, 0, 0]);

    const cables = new THREE.Group();
    // 24 pines: seis hilos desde el pasacables hasta el conector
    for (let i = 0; i < 6; i++) {
      const dy = -0.25 + i * 0.1;
      cables.add(tube([[0.92, 1.05 + dy, -1.02], [0.95, 1.07 + dy, -0.8], [0.75, 1.07 + dy, -0.74], [0.6, 1.07 + dy, -0.8]], 0.022, i % 2 ? M.sleeveMint : M.sleeveBlack, 24));
    }
    // EPS de 8 pines arriba a la izquierda
    for (let i = 0; i < 3; i++) {
      const dx = -0.08 + i * 0.08;
      cables.add(tube([[-1.7 + dx, 2.3, -1.02], [-1.7 + dx, 2.3, -0.82], [-1.7 + dx, 2.18, -0.72], [-1.7 + dx, 2.14, -0.81]], 0.02, M.sleeveBlack, 24));
    }
    // PCIe a la tarjeta gráfica, baja hacia la cubierta de la fuente
    for (let i = 0; i < 3; i++) {
      const dx = -0.07 + i * 0.07;
      cables.add(tube([[GPU.x + 0.98 + dx, GPU.y + 0.12, GPU.z + 0.66], [GPU.x + 1.02 + dx, GPU.y - 0.3, GPU.z + 0.85], [GPU.x + 1.12 + dx, -1.1, 0.75], [GPU.x + 1.2 + dx, -1.45, 0.55]], 0.022, i === 1 ? M.sleeveMint : M.sleeveBlack, 32));
    }
    add(cables, 6.25, [0, 0, 0.8], false);
  }

  // 7 · Ventiladores frontales, trasero y panel de vidrio templado
  {
    const fansG = new THREE.Group();
    const frosted = glow(0.12, 0.35, { frosted: true });
    [1.45, 0.22, -0.98].forEach((y, i) => {
      const f = fan(1.2, { frame: true, ring: 0.05 + i * 0.07, bladeMat: frosted, speed: 1 });
      f.rotation.y = -Math.PI / 2;
      fansG.add(at(f, 1.95, y, 0));
    });
    add(fansG, 7, [1.6, 0, 0]);
    const rear = fan(1.1, { frame: true, ring: 0.28, bladeMat: frosted, speed: 1 });
    rear.rotation.y = -Math.PI / 2;
    rear.position.set(-2.04, 1.55, -0.02);
    add(rear, 7.15, [-1.4, 0, 0]);

    const glassG = new THREE.Group();
    const pane = noGhost(rbox(4.36, 4.62, 0.025, 0.012, M.glass));
    pane.castShadow = false;
    pane.userData.noAO = true;
    glassG.add(pane);
    // serigrafía negra del borde del vidrio, como en los paneles reales
    for (const [w, h, x, y] of [[4.36, 0.16, 0, 2.23], [4.36, 0.16, 0, -2.23], [0.16, 4.3, 2.1, 0], [0.16, 4.3, -2.1, 0]]) {
      glassG.add(at(box(w, h, 0.004, M.print), x, y, -0.014));
    }
    for (const [x, y] of [[2.05, 2.16], [-2.05, 2.16], [2.05, -2.16], [-2.05, -2.16]]) glassG.add(at(cylZ(0.065, 0.05, M.nickel, 32), x, y, 0.035));
    glassG.position.set(0, 0, 1.135);
    add(glassG, 7.45, [0, 0.2, 2.6]);
  }

  // ── Piso ───────────────────────────────────────────────────────
  let reflector: InstanceType<typeof Reflector> | null = null;
  if (!small) {
    reflector = new Reflector(new THREE.PlaneGeometry(44, 44), {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x5f6663,
      clipBias: 0.003,
      multisample: 4,
      shader: FLOOR_SHADER,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = FLOOR_Y;
    reflector.userData.noAO = true;
    scene.add(reflector);
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), std({ color: "#0a0c0b", roughness: 0.32, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    scene.add(floor);
  }
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.ShadowMaterial({ opacity: 0.55 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = FLOOR_Y + 0.002;
  catcher.receiveShadow = true;
  catcher.userData.noAO = true;
  scene.add(catcher);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.6), new THREE.MeshBasicMaterial({ map: keep(contactShadow(THREE)), color: "#000000", transparent: true, depthWrite: false, opacity: 0.9 }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = FLOOR_Y + 0.004;
  contact.userData.noAO = true;
  scene.add(contact);

  // ── Postproceso ────────────────────────────────────────────────
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  // GTAO: oscurece rendijas, uniones y contactos como en una foto
  let gtao: InstanceType<typeof GTAOPass> | null = null;
  if (!small) {
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 1;
    gtao.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    // GTAO solo oculta líneas y puntos; el vidrio y el piso reflejante también deben salir de su pasada
    const hook = gtao as unknown as { _overrideVisibility: () => void; _visibilityCache: T.Object3D[] };
    const base = hook._overrideVisibility.bind(gtao);
    hook._overrideVisibility = () => {
      base();
      scene.traverse((o) => { if (o.userData.noAO && o.visible) { o.visible = false; hook._visibilityCache.push(o); } });
    };
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE_SHADER);
  composer.addPass(grade);

  // ── Interacción ────────────────────────────────────────────────
  let yaw = 0, yawVel = 0, down = false, lastX = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onDown = (e: PointerEvent) => { down = true; lastX = e.clientX; };
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    if (!down) return;
    yawVel = (e.clientX - lastX) * 0.007;
    lastX = e.clientX;
    yaw += yawVel;
  };
  const onUp = () => { down = false; };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp);

  let W = 1, H = 1;
  const resize = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(W, H);
    camera.aspect = W / H;
    // en escritorio corremos el encuadre a la derecha para dejar aire a la lista de piezas
    if (wide()) camera.setViewOffset(W, H, -W * 0.11, 0, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (reflector) {
      const rtw = Math.round(Math.min(2048, W * pixelRatio * 0.6)), rth = Math.round(Math.min(2048, H * pixelRatio * 0.6));
      reflector.getRenderTarget().setSize(rtw, rth);
      (reflector.material as T.ShaderMaterial).uniforms.uTexel.value = [1 / rtw, 1 / rth];
    }
    grade.uniforms.uRes.value = [W, H];
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ── Bucle ──────────────────────────────────────────────────────
  const camPath = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c[0])), false, "centripetal");
  const lookPath = new THREE.CatmullRomCurve3(CAM.map((c) => new THREE.Vector3(...c[1])), false, "centripetal");
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), shakeV = new THREE.Vector3();
  const hsl = new THREE.Color();
  const r = rng(5);
  let raf = 0, visible = true, last = performance.now(), t = 0, q = 0, shake = 0, avg = 16, downgraded = 0;

  const frame = (now: number) => {
    // performance.now() y el sello de requestAnimationFrame pueden desfasarse:
    // un delta negativo volvía q negativo y rompía la cámara. Lo acotamos.
    const raw = clamp((now - last) / 1000, 0, 0.5);
    const dt = Math.min(0.05, raw);
    last = now;
    t += dt;
    if (raw > 0 && raw < 0.2) avg = avg * 0.95 + raw * 1000 * 0.05;
    if (avg > 26 && downgraded < 2 && t > 3) {
      downgraded++;
      avg = 16;
      pixelRatio = Math.max(1, pixelRatio * 0.75);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }

    const target = clamp(progress() * N, 0, N);
    q = clamp(q + (target - q) * (1 - Math.pow(0.0025, raw)), 0, N);
    const intro = reduce ? 1 : smooth(clamp((t - 0.15) / 1.3));

    for (const p of parts) {
      let f = clamp((q - p.stage) * 1.3);
      if (p.stage === 0) f = Math.max(f, intro);
      p.obj.visible = f > 0.001;
      const e = reduce ? f : easeOutBack(f);
      p.obj.position.copy(p.home).addScaledVector(p.from, 1 - e);
      if (f >= 1 && !p.seated) { p.seated = true; p.flash = 1; if (p.stage > 0 && !reduce) shake = 0.045; }
      if (f < 0.9) p.seated = false;
      p.flash = Math.max(0, p.flash - dt * 2.2);
      if (p.ghost) {
        const m = p.ghost.material as T.LineBasicMaterial;
        m.opacity = Math.max(f > 0 && f < 1 ? Math.sin(Math.PI * f) * 0.55 : 0, p.flash * 0.9);
        p.ghost.visible = m.opacity > 0.01;
      }
    }

    // Encendido: barrido de luz, ventiladores que aceleran y luces internas
    const power = clamp((q - (N - 1)) * 1.4);
    for (const g of glows) {
      const on = smooth(clamp((power - g.delay) / 0.3));
      if (g.white) hsl.setRGB(1, 1, 1);
      else hsl.setHSL(0.395 + 0.035 * Math.sin(t * 0.7 + g.hue), 0.55, 0.62);
      g.mat.emissive.copy(hsl);
      g.mat.emissiveIntensity = on * g.peak * (reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 2.1 + g.hue));
    }
    glowA.intensity = power * 3.5;
    glowB.intensity = power * 2.2;
    glowC.intensity = power * 2.2;
    (scene.background as T.Color).lerpColors(bgOff, bgOn, power);
    for (const rt of rotors) {
      const speed = (reduce ? 0 : 0.6 + power * 15) * rt.speed;
      rt.obj.rotation.z += dt * speed;
      rt.blur.opacity = clamp((speed - 6) / 14) * 0.55;
    }

    // Cámara por la ruta de etapas, con paralaje del puntero y un golpe al encajar cada pieza
    const ct = clamp(q - 0.4, 0, N - 1) / (N - 1);
    camPath.getPoint(ct, camPos);
    lookPath.getPoint(ct, camLook);
    if (W / H < 0.9) camPos.sub(camLook).multiplyScalar(1.5).add(camLook);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    shake = Math.max(0, shake - dt * 0.25);
    shakeV.set((r() - 0.5) * shake, (r() - 0.5) * shake, 0);
    camera.position.set(camPos.x + pointer.x * 0.35, camPos.y - pointer.y * 0.22, camPos.z).add(shakeV);
    camera.lookAt(camLook);

    if (!down) {
      yawVel *= Math.pow(0.04, dt);
      yaw += yawVel;
      yaw *= Math.pow(0.55, dt);
    }
    pc.rotation.y = yaw;

    grade.uniforms.uTime.value = t;
    renderer.shadowMap.needsUpdate = shadows;
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
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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
      env.dispose();
      pmrem.dispose();
      reflector?.dispose();
      bloom.dispose();
      gtao?.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
