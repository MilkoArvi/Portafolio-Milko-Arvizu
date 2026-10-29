# Portafolio Milko Arvizu

Portafolio de front-end creativo: UI/UX, diseño web, front-end, motion, 3D y WebGL, videojuegos e IA aplicada.
En español (`/`) y en inglés (`/en`), con modo claro y oscuro.
Ocho proyectos presentados como una hoja de contactos fotográfica. Se recorren con scroll: al llegar al final de uno, el siguiente entra solo.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Motion y Three.js.

## Arrancar

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # verifica que todo compile
```

## Qué cambiar primero

| Qué | Dónde |
|---|---|
| Correo, LinkedIn, GitHub, Instagram y dominio | `src/data/profile.ts` (los campos vacíos se ocultan) |
| Experiencia y formación | `src/data/profile.ts` |
| Textos y orden de los proyectos | `src/data/projects.ts` |
| Disciplinas: qué hago, especialidades y práctica | `src/data/skills.ts` |
| Miniaturas de la hoja de contactos | `public/proof/<slug>.webp` (960 × 660), o el campo `thumb` del proyecto |
| Pista que aparece si alguien se queda quieto | campo `hint` de cada proyecto en `src/data/projects.ts` |
| Lo que Mike sabe contestar | `src/experiences/mike/brain.ts` (un guion en español y otro en inglés) |
| Colores del modo oscuro | `src/app/globals.css`, bloque `:root[data-theme="dark"]` |

## Los 8 proyectos

| Proyecto | Ruta (en inglés: `/en/projects/<slug>`) | Técnica |
|---|---|---|
| Mike, horizonte de sucesos | `/proyectos/mike` | Agujero negro trazado por píxel en GLSL (lente gravitacional, Doppler), voz con Web Speech API |
| Autorretrato compilado | `/proyectos/rostro` | Canvas 2D con atlas de glifos: el código se acomoda hasta formar mi cara |
| Siete años, seis viñetas | `/proyectos/agave` | Shaders GLSL, un solo canvas para todas las viñetas, scroll |
| Manos a la tinta | `/proyectos/tinta` | Simulación de tinta en GPU con texturas ping-pong |
| Punk Cowboy, forajido en desarrollo | `/proyectos/punk-cowboy` | Three.js: de prototipo en gris a atardecer con neón, duelo jugable con raycasting |
| A fuego lento | `/proyectos/barro` | Shader con iluminación por píxel, mantener para revelar |
| Calma, a 360° | `/proyectos/bebida` | Three.js, lata generada con torno, tinta metálica bajo barniz, condensación en shader (neblina, gotas que se deslizan y caen), scroll 3D |
| Bajo el vidrio templado | `/proyectos/pc` | Three.js con MSAA, piso con reflejo real, bloom y materiales físicos; ensamblado por etapas y encendido |

## Idiomas y modo oscuro

- **Español** vive en `/` y `/proyectos/<slug>`; **inglés** en `/en` y `/en/projects/<slug>`. El botón ES/EN de la barra lleva a la misma página en el otro idioma.
- Cada texto tiene su versión en los dos idiomas junto al original: los datos en `src/data/*.ts` y cada componente en su objeto `COPY`.
- Las rutas se arman con `src/lib/i18n.ts`; los componentes saben su idioma por la URL con `useLocale()`.
- La lata de Calma sigue impresa en español en las dos versiones: es una marca mexicana.
- El modo oscuro sigue al sistema hasta que alguien elige uno con el botón; la elección se guarda en el navegador. Un script en `<head>` lo aplica antes de pintar, así no hay destello.
- Solo cambian los tonos del papel; la portada, el contacto y las experiencias tienen su propia dirección de arte.

## Mike y el micrófono

Mike pide permiso del micrófono cuando tocas su botón y escucha en el idioma de la página. El reconocimiento de voz lo hace el navegador
(Chrome, Edge y Safari lo traen; Opera, Brave y Firefox no). Si no hay reconocimiento, se le puede escribir
y contesta en voz alta igual. Sus respuestas son un guion local: si le preguntan algo muy grande,
contesta que su objetivo es mostrar una pequeña parte de su enorme mundo.

El micrófono solo funciona en `localhost` o con HTTPS (Vercel ya lo da).

## Mi cara en el sitio

La cara del inicio (puntos) y la del proyecto 02 (caracteres de código) salen de `src/data/face.ts`,
una cuadrícula de brillo y bordes generada a partir de una foto. La foto no se publica en el sitio.

Para cambiar la foto:

```bash
pip install pillow numpy
python3 scripts/face-to-points.py ruta/a/tu-foto.jpg
```

Funciona mejor con un retrato de frente, con fondo oscuro y luz lateral.

## Rendimiento

- Three.js solo se descarga en las páginas de la bebida, Punk Cowboy y la PC, y después de pintar la página.
- Cada experiencia WebGL crea su propio canvas al montarse y libera el contexto al salir; así Chrome y Opera nunca reciben un contexto perdido.
- El agujero negro de Mike ajusta su resolución solo si el equipo no llega a 50 cuadros por segundo.
- Densidad de píxeles limitada (1.5 a 1.75) y menos detalle en celulares: la mitad de puntos en la cara, menos partículas y sin sombras en 3D.
- Toda animación con canvas o WebGL se pausa cuando sale de pantalla o la pestaña está oculta.
- La cara del inicio solo se redibuja mientras algo se mueve.
- Con `prefers-reduced-motion` las escenas no se animan solas; todo sigue siendo navegable.
- Si no hay WebGL, cada experiencia muestra un aviso en lugar de romperse.

## Estructura

```
src/
  app/                     página principal y rutas de proyectos
  components/              hero, hoja de contactos, habilidades, "Un perfil con profundidad", trayectoria,
                           contacto (pared de bloques que se abre), transición entre proyectos,
                           índice flotante y pistas
  data/                    perfil, proyectos, habilidades y la cara en datos
  experiences/             un folder por proyecto
  lib/                     WebGL compartido y lectura de la cara
scripts/face-to-points.py  convierte una foto en datos para la cara
```

## Publicar

En Vercel: importa el repositorio, no requiere configuración. Después pon tu dominio en `profile.url`.
