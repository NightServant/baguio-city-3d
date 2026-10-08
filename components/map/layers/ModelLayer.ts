"use client";

// Landmark meshes, the city's building massing tiles, its roads and its trees, drawn with three.js inside MapLibre's GL
// context (contract C5). Nothing 3D loads before the map's first idle; a landmark loads when its sheet
// opens or when it is in view at zoom >= 15 (contract C3); massing tiles load by view, near detail at
// zoom >= 15 and far detail below (M5); road and flora tiles load at zoom >= 15. Each model is drawn with its own projection matrix, multiplied
// in JS doubles, because a float32 GPU matrix can't hold a Mercator offset to the metre.
import { useEffect } from "react";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import type { BufferGeometry, Camera, Mesh, MeshStandardMaterial, Object3D, Scene, WebGLRenderer } from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { modelMatrix } from "@/lib/map/modelTransform";
import { useMapStore } from "@/stores/useMapStore";
import { IMAGERY_APPLY, IMAGERY_PARS, imageryGround, isGroundMaterial, placeImagery, setMaxAnisotropy, updateAtlas, VPOS_VERTEX, withImageryUniforms } from "./imageryAtlas";
import { isTornDown } from "./teardown";

const LAYER_ID = "model-3d";
const INDEX_URL = "/models/landmarks/index.json";
const TILE_INDEX_URL = "/models/buildings/index.json";
const ROAD_INDEX_URL = "/models/roads/index.json"; // the city's roads (build_roads.py), near zoom only
// Road tiles within this of the map centre (ESTIMATE; session bytes, C6): a pitched view reaches the horizon, and past it
// a sidewalk is under a pixel while the basemap's own road lines carry on.
const ROAD_REACH_M = 900;
const FLORA_INDEX_URL = "/models/flora/index.json"; // trees, shrubs and rocks (build_flora.py), near zoom only
// Flora detail by distance from the camera's ground point: full archetypes within FLORA_NEAR_M, far versions (no shrubs
// or rocks) to FLORA_THIN_M, half of them beyond; nothing past FLORA_REACH_M from the map centre (triangle budget, C6).
const FLORA_NEAR_M = 450;
const FLORA_THIN_M = 900;
const FLORA_REACH_M = 1_400;
const NEAR_ZOOM = 15;
const LANDMARK_PAD_DEG = 0.004; // about 450 m
const FAR_REACH_M = 1_700;
// The basemap's own extruded buildings: hidden once the massing tiles draw, so no building is drawn twice.
const BASEMAP_BUILDINGS = "building-3d";

interface LandmarkEntry { slug: string; lng: number; lat: number; url: string; rotationDeg: number; altitudeM: number }
interface TileEntry { id: string; anchor: [number, number]; bbox: [number, number, number, number]; url: string }
interface TileIndex { near: TileEntry[]; far: TileEntry[] }
// build_flora.py: tiles are [x, y, count, lowest ground, file] at zoom z; species are [archetype, r, g, b] (sRGB)
interface FloraIndex {
  z: number;
  archetypes: string;
  meshes: string[];
  ref: number[];
  species: [number, number, number, number][];
  tiles: [number, number, number, number, string][];
  far: number; // archetypes before this index have far versions; the rest (people, shrubs, rocks) draw near only
}
// onGround: a landmark, set on the terrain under its anchor. Otherwise a massing tile, whose Y is already metres
// above sea level on the stretched ground (build_massing.py), so its anchor sits at altitude 0.
interface Shown { lng: number; lat: number; altitudeM: number; rotationDeg: number; onGround: boolean; scene: Scene }

type Kit = { THREE: typeof import("@/lib/map/threeKit"); loader: GLTFLoader };
let kit: Promise<Kit> | null = null;
const loadKit = () =>
  (kit ??= import("@/lib/map/threeKit").then((THREE) => {
    const loader = new THREE.GLTFLoader();
    loader.setMeshoptDecoder(THREE.MeshoptDecoder);
    return { THREE, loader };
  }));

// Session caches survive style swaps (the layer itself is re-added on every styleGeneration).
const models = new Map<string, Promise<Object3D>>();
let index: Promise<LandmarkEntry[]> | null = null;
const loadIndex = () =>
  (index ??= fetch(INDEX_URL)
    .then((r) => (r.ok ? r.json() : { landmarks: [] }))
    .then((j: { landmarks: LandmarkEntry[] }) => j.landmarks)
    .catch(() => []));
let tileIndex: Promise<TileIndex> | null = null;
const loadTileIndex = () =>
  (tileIndex ??= fetch(TILE_INDEX_URL)
    .then((r) => (r.ok ? r.json() : { near: [], far: [] }))
    .catch(() => ({ near: [], far: [] })));
let roadIndex: Promise<TileEntry[]> | null = null;
const loadRoadIndex = () =>
  (roadIndex ??= fetch(ROAD_INDEX_URL)
    .then((r) => (r.ok ? r.json() : { tiles: [] }))
    .then((j: { tiles: TileEntry[] }) => j.tiles)
    .catch(() => []));

let floraIndex: Promise<FloraIndex | null> | null = null;
const loadFloraIndex = () =>
  (floraIndex ??= fetch(FLORA_INDEX_URL)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null));
const floraTiles = new Map<string, Promise<Uint8Array | null>>();
const loadFloraTile = (url: string) => {
  let p = floraTiles.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? new Uint8Array(b) : null))
      .catch(() => null);
    floraTiles.set(url, p);
  }
  return p;
};
let floraKit: Promise<{ geo: Map<string, BufferGeometry>; mat: MeshStandardMaterial } | null> | null = null;

// One material for every plant and rock: vertex colours whose alpha marks the parts the instance's species colour tints
// (foliage, or a flowering tree's blossom); bark and a flowering tree's leaves keep their own (model/blender/flora.py).
function floraMaterial({ THREE }: Kit) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      "#include <color_vertex>",
      `#include <color_vertex>
#if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR_ALPHA )
      vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, step(0.5, color.a));
#endif`,
    );
    sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a = 1.0;");
  };
  m.customProgramCacheKey = () => "flora";
  return m;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2;
const EARTH_M = 40_075_016.686;
const HEMI = 2.2, SUN = 1.6; // the models' daylight

// Road surfaces (owner 2026-10-07: "restore the asphalt texture ... with proper markings"; 2026-10-08: sidewalks with
// "richer textures"): CC0 photo scans from Poly Haven (model/scripts/fetch_road_textures.py), tiled in world space at
// their real size, divided by their mean so each surface keeps its own colour and gains the scan's grain; a slow second
// sample breaks up the repeat.
type SurfaceName = "asphalt" | "pavers" | "hex" | "brick" | "concrete";
const SURFACES: SurfaceName[] = ["asphalt", "pavers", "hex", "brick", "concrete"];
const surfaceUniforms = Object.fromEntries(SURFACES.flatMap((n) => [
  [`uTex_${n}`, { value: null as unknown }],
  [`uTexMean_${n}`, { value: [1, 1, 1] }],
  [`uTexM_${n}`, { value: 1 }],
])) as Record<string, { value: unknown }>;
const surfacesOn = { value: 0 };
// World-anchored texture coordinates (owner 2026-10-07, upper Session Road): each tile's local metres scaled to one
// common metre (at the city's latitude) and offset from the city centre, so neighbouring tiles lay the scans seamlessly.
// The offset wraps every 816 m, a whole number of every texture's tile (3, 2 and 1.6 m).
const surfaceWorld = { value: [0, 0, 1] };
const WORLD_WRAP_M = 816;
const CITY_LNG = 120.596, CITY_LAT = 16.4023; // lib/constants BAGUIO_CENTER
function placeSurfaces(lng: number, lat: number) {
  const k0 = EARTH_M * Math.cos((CITY_LAT * Math.PI) / 180);
  const wrap = (v: number) => ((v % WORLD_WRAP_M) + WORLD_WRAP_M) % WORLD_WRAP_M;
  surfaceWorld.value = [
    wrap((mercX(lng) - mercX(CITY_LNG)) * k0),
    wrap((mercY(lat) - mercY(CITY_LAT)) * k0),
    Math.cos((CITY_LAT * Math.PI) / 180) / Math.cos((lat * Math.PI) / 180),
  ];
}
let surfaceLoad: Promise<void> | null = null;
function loadSurfaces({ THREE }: Kit, repaint: () => void) {
  surfaceLoad ??= fetch("/models/textures/index.json")
    .then((r) => (r.ok ? r.json() : null))
    .then(async (idx: Record<SurfaceName, { url: string; metres: number; mean: number[] }> | null) => {
      if (!idx) return;
      await Promise.all(SURFACES.map(async (n) => {
        const img = new Image();
        img.src = idx[n].url;
        await img.decode();
        const t = new THREE.CanvasTexture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        t.needsUpdate = true;
        surfaceUniforms[`uTex_${n}`].value = t;
        surfaceUniforms[`uTexMean_${n}`].value = idx[n].mean;
        surfaceUniforms[`uTexM_${n}`].value = idx[n].metres;
      }));
      surfacesOn.value = 1;
      repaint();
    })
    .catch(() => {});
  return surfaceLoad;
}
const SURFACE_PARS = `
uniform float uSurfOn;
uniform vec3 uSurfWorld;
${SURFACES.map((n) => `uniform sampler2D uTex_${n};\nuniform vec3 uTexMean_${n};\nuniform float uTexM_${n};`).join("\n")}
vec3 surf(sampler2D t, vec3 mean, float m, vec2 p) {
  if (uSurfOn < 0.5) return vec3(1.0);
  vec3 a = texture2D(t, p / m).rgb / mean;
  float slow = dot(texture2D(t, p / (m * 13.7) + 0.37).rgb / mean, vec3(0.3333));
  return a * mix(0.88, 1.12, clamp(slow * 0.5, 0.0, 1.0));
}
`;
const SURF = (n: SurfaceName, p: string) => `surf(uTex_${n}, uTexMean_${n}, uTexM_${n}, ${p})`;
const linear = (r: number, g: number, b: number) => [r, g, b].map((c) => srgbToLinear(c / 255).toFixed(4)).join(", ");
const isColour = (rgb: [number, number, number]) => `step(distance(vColor.rgb, vec3(${linear(...rgb)})), 0.02)`;
function withSurfaces(sh: { uniforms: Record<string, unknown> }) {
  Object.assign(sh.uniforms, surfaceUniforms, { uSurfOn: surfacesOn, uSurfWorld: surfaceWorld });
}
const WORLD_XZ = "(vPosM.xz * uSurfWorld.z + uSurfWorld.xy)";

// Road tiles (build_roads.py) take the scans by vertex colour: every carriageway, asphalt or OSM's concrete, in Session
// Road's asphalt colour (owner 2026-10-07: "use texture of session to City-Wide Roads"), the walkways in its pavers, and
// the sidewalks (owner 2026-10-08) in hexagonal pavers, red brick or concrete, kerbs in concrete, each in its own colour.
// Markings, poles, lamps, signs, trails, walls and the islands' planting keep their colours. Each triangle is one colour,
// so a 2x2 pixel quad never splits between branches and the samples' derivatives stay sound.
const ROAD_RGB: [number, number, number] = [62, 62, 64];
const PAVER_RGB: [number, number, number] = [168, 163, 153];
const OWN_COLOUR = "vColor.rgb";
const ROAD_SURFACES: [SurfaceName, [number, number, number][], string][] = [
  ["asphalt", [[66, 66, 68], [150, 150, 146]], `vec3(${linear(...ROAD_RGB)})`], // ASPHALT, CONCRETE
  ["pavers", [[188, 184, 174], [176, 160, 144], [170, 166, 156]], `vec3(${linear(...PAVER_RGB)})`], // PAVING, SETTS, STEP_STONE
  ["hex", [[178, 170, 156]], OWN_COLOUR], // HEX
  ["brick", [[156, 92, 72]], OWN_COLOUR], // BRICK
  ["concrete", [[176, 174, 166], [204, 202, 196]], OWN_COLOUR], // CONC, KERB
];
// Pavements are lit as level ground (the scene's up, not each draped triangle's tilt): flat-shaded 10 m triangles on a
// slope each caught the sun differently and the road looked shattered (owner 2026-10-07).
const UP_VERTEX = (vs: string) =>
  VPOS_VERTEX(vs)
    .replace("#include <common>", "#include <common>\nvarying vec3 vUpV;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUpV = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));");
const UP_NORMAL = (weight: string) => `#include <normal_fragment_begin>\n  normal = normalize(mix(normal, normalize(vUpV), ${weight}));`;
function roadMaterial(m: MeshStandardMaterial) {
  m.flatShading = true;
  m.onBeforeCompile = (sh) => {
    withSurfaces(sh);
    // paint wins its few centimetres over the asphalt at any distance: a small depth bias toward the camera
    sh.vertexShader = UP_VERTEX(sh.vertexShader).replace(
      "#include <project_vertex>",
      `#include <project_vertex>
#ifdef USE_COLOR_ALPHA
      gl_Position.z -= max(step(distance(color.rgb, vec3(${linear(232, 232, 226)})), 0.02),
                           step(distance(color.rgb, vec3(${linear(242, 186, 32)})), 0.02)) * 4e-5 * gl_Position.w;
#endif`,
    );
    const branches = ROAD_SURFACES.map(([n, keys, rgb]) =>
      `if (${keys.map((k) => `${isColour(k)} > 0.5`).join(" || ")}) diffuseColor.rgb = ${rgb} * ${SURF(n, "p")};`).join("\n          else ");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPosM;\nvarying vec3 vUpV;\n${SURFACE_PARS}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float pave = 1.0;
#ifdef USE_COLOR_ALPHA
        {
          vec2 p = ${WORLD_XZ};
          ${branches}
          else pave = max(${isColour([232, 232, 226])}, max(${isColour([242, 186, 32])}, max(${isColour([84, 104, 60])}, ${isColour([214, 170, 48])})));
        }
#endif`,
      )
      .replace("#include <normal_fragment_begin>", UP_NORMAL("pave"));
  };
  m.customProgramCacheKey = () => "road-surfaces";
  m.needsUpdate = true;
}

// Massing detail drawn per pixel (model/scripts/build_massing.py): a vertex's RGB is its building's roof colour, and
// its alpha packs the wall colour (index x 64) and the floor's height modulo a storey (6 bits). Walls get a window per
// 3 m bay and 3.2 m storey, rows level from the floor; pitched roofs get corrugation ribs; both fade to their average
// colour where a bay or rib is smaller than a pixel. Flat shading comes from the position's screen derivatives.
const WALLS = ["#d6ccb6", "#c4c4be", "#e0d6aa", "#e8e4dc"]; // build_massing.WALLS (sRGB)
function massingMaterial({ THREE }: Kit, m: MeshStandardMaterial) {
  const walls = WALLS.map((c) => new THREE.Color(c));
  m.flatShading = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWalls = { value: walls };
    withImageryUniforms(sh);
    // vPosM in metres: gltfpack quantizes positions under a node scale
    sh.vertexShader = VPOS_VERTEX(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPosM;\nuniform vec3 uWalls[4];\n${IMAGERY_PARS}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
#ifdef USE_COLOR_ALPHA
        {
          vec3 nM = normalize(cross(dFdx(vPosM), dFdy(vPosM)));
          float a = floor(vColor.a * 255.0 + 0.5);
          float floorOff = mod(a, 64.0) / 64.0 * 3.2;
          int wi = int(a / 64.0);
          vec3 wall = wi == 0 ? uWalls[0] : wi == 1 ? uWalls[1] : wi == 2 ? uWalls[2] : uWalls[3];
          // Baguio's houses come in every pastel: a per-building tint, hashed from its roof colour and floor offset
          vec3 hv = fract(sin(vec3(dot(vColor.rgb, vec3(12.99, 78.23, 45.16)), dot(vColor.rgb, vec3(93.99, 67.35, 12.12)),
                                   dot(vColor.rgb, vec3(43.33, 93.53, 43.10))) + floorOff * 7.13) * 43758.5453);
          wall = mix(wall, wall * (0.8 + 0.4 * hv), 0.75);
          vec2 t = normalize(vec2(-nM.z, nM.x) + 1e-6);
          float u = dot(vPosM.xz, t);
          if (abs(nM.y) < 0.5) {
            vec2 c = vec2(u / 3.0, (vPosM.y - floorOff) / 3.2);
            vec2 f = fract(c);
            float win = step(abs(f.x - 0.5), 0.217) * step(0.297, f.y) * step(f.y, 0.734);
            float frame = win * (1.0 - step(abs(f.x - 0.5), 0.19) * step(0.33, f.y) * step(f.y, 0.70));
            // each window its own: glass tone, and some with drawn curtains
            float hw = fract(sin(dot(floor(c), vec2(127.1, 311.7)) + dot(vColor.rgb, vec3(17.0, 31.0, 7.0))) * 43758.5453);
            vec3 glass = vec3(0.30, 0.34, 0.40) * wall * (0.7 + 0.6 * hw);
            glass = mix(glass, vec3(0.78, 0.72, 0.62) * wall, step(0.82, hw) * 0.55);
            vec3 detail = mix(mix(wall, glass, win), wall * 1.06, frame);
            float fade = clamp(2.0 - 4.0 * max(fwidth(c.x), fwidth(c.y)), 0.0, 1.0);
            diffuseColor.rgb = mix(mix(wall, vec3(0.30, 0.34, 0.40) * wall, 0.18), detail, fade); // far: the average, steady
          } else if (abs(nM.y) < 0.99) {
            float r = u / 0.25;
            float fade = clamp(2.0 - 4.0 * fwidth(r), 0.0, 1.0);
            diffuseColor.rgb = vColor.rgb * mix(0.95, 0.9 + 0.1 * step(0.5, fract(r)), fade);
          } else {
            diffuseColor.rgb = vColor.rgb;
          }
          diffuseColor.a = 1.0;
          // roofs show the satellite photograph (imageryAtlas.ts), as in Google Earth
          ${IMAGERY_APPLY("step(0.5, abs(nM.y))")}
        }
#endif`,
      );
  };
  m.customProgramCacheKey = () => "massing";
  m.needsUpdate = true;
}

// The first idle, or IDLE_FALLBACK_MS after the layer first mounts, whichever comes first. On a slow
// link idle can keep slipping while tiles stream in (55 s measured at 6 KB/s, 2026-10-02), and a
// visitor who keeps panning might otherwise never see a model; 10 s keeps the first render clear.
const IDLE_FALLBACK_MS = 10_000;
const firstIdle = new WeakMap<MapLibreMap, Promise<void>>();
function whenFirstIdle(map: MapLibreMap) {
  let p = firstIdle.get(map);
  if (!p) {
    // MapView marks the container on the map's first idle; a layer remounted after a style swap finds it set.
    p = map.getContainer().getAttribute("data-map-idle") === "true"
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          map.once("idle", () => resolve());
          setTimeout(resolve, IDLE_FALLBACK_MS);
        });
    firstIdle.set(map, p);
  }
  return p;
}

function createLayer(map: MapLibreMap, { THREE }: Kit, shown: Map<string, Shown>): CustomLayerInterface {
  let renderer: WebGLRenderer | null = null;
  const camera: Camera = new THREE.Camera();
  return {
    id: LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
    },
    render(_gl, options) {
      if (!renderer || shown.size === 0) return;
      // Mercator [0..1] -> clip, float64. Not options.modelViewProjectionMatrix: in MapLibre 5 that one
      // works in world pixels (maplibre-gl-dev.js getProjectionDataForCustomLayer, 5.24).
      const mvp = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix as unknown as number[]);
      renderer.resetState();
      // night: the models' lights dim with the imagery (basemapTheme NIGHT); the photograph on them is toned in its shader
      const light = document.documentElement.dataset.theme === "dark" ? 0.45 : 1;
      for (const s of shown.values()) {
        const [hemi, sun] = s.scene.children as unknown as { intensity: number }[];
        hemi.intensity = HEMI * light;
        sun.intensity = SUN * light;
        const ground = s.onGround ? map.queryTerrainElevation([s.lng, s.lat]) : 0;
        if (ground == null) continue; // terrain tiles not in yet; try again next frame
        const anchor = MercatorCoordinate.fromLngLat([s.lng, s.lat], ground + s.altitudeM);
        const local = new THREE.Matrix4().fromArray(modelMatrix(anchor, anchor.meterInMercatorCoordinateUnits(), s.rotationDeg));
        camera.projectionMatrix.copy(mvp).multiply(local);
        placeImagery(s.lng, s.lat, s.rotationDeg);
        placeSurfaces(s.lng, s.lat);
        renderer.render(s.scene, camera);
      }
      renderer.resetState(); // hand the shared context back clean, as MapLibre's three.js-on-terrain example does
    },
  };
}


export function useModelLayer(map: MapLibreMap) {
  useEffect(() => {
    let cancelled = false;
    let layerAdded = false;
    let kitLoaded: Kit | null = null;
    const shown = new Map<string, Shown>();
    if (process.env.NODE_ENV !== "production") (window as unknown as { __shown?: unknown }).__shown = shown; // dev inspection

    async function show(key: string, url: string, place: Omit<Shown, "scene">, k: Kit, prepare?: (o: Object3D) => Promise<void>) {
      let model = models.get(url);
      if (!model) {
        model = k.loader.loadAsync(url).then(async (g) => {
          g.scene.traverse((o) => {
            const mat = (o as Mesh).isMesh ? ((o as Mesh).material as MeshStandardMaterial) : null;
            if (mat?.map) mat.map.anisotropy = 8; // three clamps it to the GPU's limit; crisp facades at an angle
          });
          await prepare?.(g.scene);
          return g.scene;
        });
        models.set(url, model);
      }
      const obj = await model.catch(() => null);
      if (!obj || cancelled || isTornDown(map)) return false;
      return present(key, obj.clone(), place, k);
    }

    function present(key: string, obj: Object3D, place: Omit<Shown, "scene">, k: Kit) {
      kitLoaded = k;
      const scene = new k.THREE.Scene();
      scene.add(new k.THREE.HemisphereLight(0xffffff, 0x6b6156, HEMI)); // children[0] and [1]: render() dims them at night
      const sun = new k.THREE.DirectionalLight(0xffffff, SUN);
      sun.position.set(-0.5, 1, 0.3);
      scene.add(sun, obj);
      shown.set(key, { ...place, scene });
      if (!layerAdded) {
        try {
          map.addLayer(createLayer(map, k, shown));
          layerAdded = true;
        } catch {
          return false; // style mid-swap; the remount on the next styleGeneration re-adds it
        }
      }
      map.triggerRepaint();
      return true;
    }

    async function want(e: LandmarkEntry) {
      if (shown.has(e.slug)) return;
      const k = await loadKit();
      if (cancelled || isTornDown(map)) return;
      await show(e.slug, e.url, { lng: e.lng, lat: e.lat, altitudeM: e.altitudeM, rotationDeg: e.rotationDeg, onGround: true }, k, async (o) => {
        const done = new Set<unknown>();
        o.traverse((m) => {
          const mat = (m as Mesh).isMesh ? ((m as Mesh).material as MeshStandardMaterial) : null;
          if (!mat || done.has(mat)) return;
          done.add(mat);
          if (isGroundMaterial(mat.name)) imageryGround(mat);
        });
      });
    }

    // Massing tiles take the window shader; road tiles are plain vertex colours (flat shaded, no normals shipped).
    async function wantTile(t: TileEntry, road = false) {
      const key = `tile:${road ? "road:" : ""}${t.id}@${t.url}`;
      if (shown.has(key)) return;
      const k = await loadKit();
      if (cancelled || isTornDown(map)) return;
      const ok = await show(key, t.url, { lng: t.anchor[0], lat: t.anchor[1], altitudeM: 0, rotationDeg: 0, onGround: false }, k, async (o) => {
        o.traverse((m) => {
          if (!(m as Mesh).isMesh) return;
          const mat = (m as Mesh).material as MeshStandardMaterial;
          if (road) roadMaterial(mat);
          else massingMaterial(k, mat);
        });
      });
      if (road) return;
      if (!ok) return;
      if (map.getLayer(BASEMAP_BUILDINGS)) map.setLayoutProperty(BASEMAP_BUILDINGS, "visibility", "none");
    }

    // The flora within reach, merged into one InstancedMesh per archetype and detail level (about 14 draw calls in all),
    // in metres around the map centre at the time of the rebuild. A rebuild superseded by a newer one is dropped.
    let floraGen = 0;
    async function refreshFlora(k: Kit) {
      const gen = ++floraGen;
      const drop = () => {
        const old = shown.get("flora");
        old?.scene.traverse((o) => (o as Mesh).isMesh && (o as unknown as { dispose(): void }).dispose());
        shown.delete("flora");
      };
      if (map.getZoom() < NEAR_ZOOM) return drop();
      const idx = await loadFloraIndex();
      if (!idx || cancelled || isTornDown(map) || gen !== floraGen) return;
      floraKit ??= k.loader.loadAsync(idx.archetypes).then((g) => {
        const geo = new Map<string, BufferGeometry>();
        g.scene.traverse((o) => { if ((o as Mesh).isMesh) geo.set(o.name, (o as Mesh).geometry); });
        return { geo, mat: floraMaterial(k) };
      }).catch(() => null);
      const fk = await floraKit;
      if (!fk) return;
      const c = map.getCenter();
      const b = map.getBounds();
      const n = 2 ** idx.z;
      const kA = EARTH_M * Math.cos((c.lat * Math.PI) / 180);
      const ax = mercX(c.lng), ay = mercY(c.lat);
      // the camera's ground point: 1.5 viewport heights from the centre (MapLibre's camera distance), tilted by the pitch
      const back = (1.5 * map.getCanvas().clientHeight * kA) / (512 * 2 ** map.getZoom()) * Math.sin((map.getPitch() * Math.PI) / 180);
      const br = (map.getBearing() * Math.PI) / 180;
      const cam = { x: ax - (back * Math.sin(br)) / kA, y: ay + (back * Math.cos(br)) / kA };
      const want: { t: FloraIndex["tiles"][number]; d: number; ox: number; oz: number; s: number }[] = [];
      for (const t of idx.tiles) {
        const [x, y] = t;
        const w = (x / n) * 360 - 180, e = ((x + 1) / n) * 360 - 180;
        const lat = (yy: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
        const no = lat(y), so = lat(y + 1);
        if (e < b.getWest() || w > b.getEast() || no < b.getSouth() || so > b.getNorth()) continue;
        const tx = (x + 0.5) / n, ty = (y + 0.5) / n;
        if (Math.hypot(tx - ax, ty - ay) * kA > FLORA_REACH_M) continue;
        const tlat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ty))) * 180) / Math.PI;
        const d = Math.hypot(tx - cam.x, ty - cam.y) * kA;
        want.push({ t, d, ox: (tx - ax) * kA, oz: (ty - ay) * kA, s: Math.cos((c.lat * Math.PI) / 180) / Math.cos((tlat * Math.PI) / 180) });
      }
      const data = await Promise.all(want.map((w) => loadFloraTile(`/models/flora/${w.t[4]}`)));
      if (cancelled || isTornDown(map) || gen !== floraGen) return;
      const A = idx.ref.length;
      const lists: number[][] = Array.from({ length: 2 * A }, () => []); // [archetype][near|far] -> record refs (tile, offset)
      want.forEach((w, i) => {
        const buf = data[i];
        if (!buf) return;
        const near = w.d < FLORA_NEAR_M;
        const count = buf.length / 8;
        const take = w.d >= FLORA_THIN_M ? count >> 1 : count;
        for (let r = 0; r < take; r++) {
          const a = idx.species[buf[r * 8 + 6]][0];
          if (!near && a >= idx.far) continue; // people, shrubs and rocks: near only
          lists[near ? a : A + a].push(i, r);
        }
      });
      const group = new k.THREE.Group();
      const tint = idx.species.map(([, r, g, bl]: FloraIndex["species"][number]) => [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(bl / 255)]);
      lists.forEach((refs, li) => {
        const a = li % A;
        const geo = fk.geo.get(li < A ? idx.meshes[a] : `${idx.meshes[a]}_lod`);
        if (!refs.length || !geo) return;
        const m = new k.THREE.InstancedMesh(geo, fk.mat, refs.length / 2);
        const mat = m.instanceMatrix.array as Float32Array;
        const col = new Float32Array((refs.length / 2) * 3);
        for (let q = 0; q < refs.length; q += 2) {
          const w = want[refs[q]], buf = data[refs[q]]!, o = refs[q + 1] * 8;
          const dv = new DataView(buf.buffer, buf.byteOffset + o, 8);
          const ex = dv.getUint16(0, true) / 80 - 400, ny = dv.getUint16(2, true) / 80 - 400;
          const up = w.t[3] + dv.getUint16(4, true) / 20;
          const sp = buf[o + 6], h = buf[o + 7] / 8;
          const sc = h / idx.ref[a];
          const hash = (dv.getUint16(0, true) * 73_856_093) ^ (dv.getUint16(2, true) * 19_349_663);
          const yaw = ((hash >>> 0) % 628) / 100, cs = Math.cos(yaw) * sc, sn = Math.sin(yaw) * sc;
          const j = (q / 2) * 16;
          mat.set([cs, 0, -sn, 0, 0, sc, 0, 0, sn, 0, cs, 0, w.ox + ex * w.s, up, w.oz - ny * w.s, 1], j);
          const v = 0.9 + (((hash >>> 8) % 21) / 100);
          col.set([tint[sp][0] * v, tint[sp][1] * v, tint[sp][2] * v], (q / 2) * 3);
        }
        m.instanceColor = new k.THREE.InstancedBufferAttribute(col, 3);
        m.frustumCulled = false; // one mesh spans the whole reach; the tiles out of view were skipped above
        group.add(m);
      });
      drop();
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __floraInfo?: unknown }).__floraInfo = {
          tiles: want.length,
          meshes: group.children.length,
          instances: lists.reduce((s2, l) => s2 + l.length / 2, 0),
          triangles: lists.reduce((s2, l, li) => s2 + (l.length / 2) * ((fk.geo.get(li < A ? idx.meshes[li % A] : `${idx.meshes[li % A]}_lod`)?.index?.count ?? 0) / 3), 0),
        };
      }
      if (!group.children.length) return;
      present("flora", group, { lng: c.lng, lat: c.lat, altitudeM: 0, rotationDeg: 0, onGround: false }, k);
      map.triggerRepaint();
    }

    async function update() {
      const entries = await loadIndex();
      if (cancelled || isTornDown(map)) return;
      const selected = useMapStore.getState().ui.selectedSlug;
      const near = map.getZoom() >= NEAR_ZOOM ? map.getBounds() : null;
      for (const e of entries) {
        // a landmark spans up to a few hundred metres from its anchor (Session Road: 440 m of street), so it loads when the
        // anchor is within LANDMARK_PAD_DEG of the view, not only on screen (its far end vanished at close zoom)
        const inView = near && e.lng >= near.getWest() - LANDMARK_PAD_DEG && e.lng <= near.getEast() + LANDMARK_PAD_DEG
          && e.lat >= near.getSouth() - LANDMARK_PAD_DEG && e.lat <= near.getNorth() + LANDMARK_PAD_DEG;
        if (e.slug === selected || inView) void want(e);
      }
      const tiles = await loadTileIndex();
      if (cancelled || isTornDown(map)) return;
      const b = map.getBounds();
      const visible = new Set<string>();
      // Far tiles stop at a radius that halves per zoom level (2.4 km at the default 13.5): toward a pitched view's
      // horizon a pixel spans tens of metres, and the tiles there would only cost bytes (contract C6, 1 MiB).
      const c = map.getCenter();
      const reach = near ? Infinity : FAR_REACH_M * 2 ** (14 - map.getZoom());
      const kx = 111_320 * Math.cos((c.lat * Math.PI) / 180);
      for (const t of near ? tiles.near : tiles.far) {
        const [w, s, e, n] = t.bbox;
        if (e < b.getWest() || w > b.getEast() || n < b.getSouth() || s > b.getNorth()) continue;
        const dx = (Math.max(w, Math.min(c.lng, e)) - c.lng) * kx;
        const dy = (Math.max(s, Math.min(c.lat, n)) - c.lat) * 110_574;
        if (Math.hypot(dx, dy) > reach) continue;
        visible.add(`tile:${t.id}@${t.url}`);
        void wantTile(t);
      }
      void loadKit().then((k) => {
        if (cancelled) return;
        updateAtlas(k.THREE, c.lng, c.lat, map.getZoom(), () => map.triggerRepaint());
        if (near) void loadSurfaces(k, () => map.triggerRepaint());
        void refreshFlora(k);
      });
      if (near) {
        for (const t of await loadRoadIndex()) {
          const [w, s, e, n] = t.bbox;
          if (e < b.getWest() || w > b.getEast() || n < b.getSouth() || s > b.getNorth()) continue;
          const dx = (Math.max(w, Math.min(c.lng, e)) - c.lng) * kx;
          const dy = (Math.max(s, Math.min(c.lat, n)) - c.lat) * 110_574;
          if (Math.hypot(dx, dy) > ROAD_REACH_M) continue;
          visible.add(`tile:road:${t.id}@${t.url}`);
          void wantTile(t, true);
        }
      }
      if (cancelled || isTornDown(map)) return;
      // ponytail: tiles out of view are dropped from the draw list; their parsed meshes stay cached in `models`
      // (add an LRU if M7's device test shows memory pressure)
      for (const key of [...shown.keys()]) if (key.startsWith("tile:") && !visible.has(key)) shown.delete(key); // out of view, or the other LOD
      map.triggerRepaint();
    }

    // MapLibre rebuilds its own GL state on restore; ours belongs to a dead context. Re-adding the
    // layer runs onAdd again with the new context, and three re-uploads the cached geometry.
    // Deferred a frame: inside the restore event MapLibre hasn't rebuilt its painter yet (re-adding there threw
    // "reading 'shaderPreludeCode'", e2e model-context-loss).
    const onRestored = () =>
      requestAnimationFrame(() => {
        if (!kitLoaded || cancelled || isTornDown(map)) return;
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        try {
          map.addLayer(createLayer(map, kitLoaded, shown));
        } catch {
          layerAdded = false; // style mid-swap; the next show() re-adds it
        }
        map.triggerRepaint();
      });
    map.on("webglcontextrestored", onRestored);

    whenFirstIdle(map).then(() => {
      if (cancelled) return;
      void update();
      map.on("moveend", update);
    });
    const unsubscribe = useMapStore.subscribe((s, prev) => {
      if (s.ui.selectedSlug !== prev.ui.selectedSlug) void whenFirstIdle(map).then(update);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (isTornDown(map)) return;
      map.off("moveend", update);
      map.off("webglcontextrestored", onRestored);
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    };
  }, [map]);
}
