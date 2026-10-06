"use client";

// Landmark meshes and the city's building massing tiles, drawn with three.js inside MapLibre's GL
// context (contract C5). Nothing 3D loads before the map's first idle; a landmark loads when its sheet
// opens or when it is in view at zoom >= 15 (contract C3); massing tiles load by view, near detail at
// zoom >= 15 and far detail below (M5). Each model is drawn with its own projection matrix, multiplied
// in JS doubles, because a float32 GPU matrix can't hold a Mercator offset to the metre.
import { useEffect } from "react";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import type { Camera, Mesh, MeshStandardMaterial, Object3D, Scene, WebGLRenderer } from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { modelMatrix } from "@/lib/map/modelTransform";
import { useMapStore } from "@/stores/useMapStore";
import { isTornDown } from "./teardown";

const LAYER_ID = "model-3d";
const INDEX_URL = "/models/landmarks/index.json";
const TILE_INDEX_URL = "/models/buildings/index.json";
const NEAR_ZOOM = 15;
const FAR_REACH_M = 1_700;
// The basemap's own extruded buildings: hidden once the massing tiles draw, so no building is drawn twice.
const BASEMAP_BUILDINGS = "building-3d";

interface LandmarkEntry { slug: string; lng: number; lat: number; url: string; rotationDeg: number; altitudeM: number }
interface TileEntry { id: string; anchor: [number, number]; bbox: [number, number, number, number]; url: string }
interface TileIndex { near: TileEntry[]; far: TileEntry[] }
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
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosM;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPosM = (modelMatrix * vec4(transformed, 1.0)).xyz; // metres: gltfpack quantizes positions under a node scale");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosM;\nuniform vec3 uWalls[4];")
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
          vec2 t = normalize(vec2(-nM.z, nM.x) + 1e-6);
          float u = dot(vPosM.xz, t);
          if (abs(nM.y) < 0.5) {
            vec2 c = vec2(u / 3.0, (vPosM.y - floorOff) / 3.2);
            vec2 f = fract(c);
            float win = step(abs(f.x - 0.5), 0.217) * step(0.297, f.y) * step(f.y, 0.734);
            float frame = win * (1.0 - step(abs(f.x - 0.5), 0.19) * step(0.33, f.y) * step(f.y, 0.70));
            vec3 glass = vec3(0.30, 0.34, 0.40) * wall;
            vec3 detail = mix(mix(wall, glass, win), wall * 1.06, frame);
            float fade = clamp(2.0 - 4.0 * max(fwidth(c.x), fwidth(c.y)), 0.0, 1.0);
            diffuseColor.rgb = mix(mix(wall, glass, 0.18), detail, fade);
          } else if (abs(nM.y) < 0.99) {
            float r = u / 0.25;
            float fade = clamp(2.0 - 4.0 * fwidth(r), 0.0, 1.0);
            diffuseColor.rgb = vColor.rgb * mix(0.95, 0.9 + 0.1 * step(0.5, fract(r)), fade);
          } else {
            diffuseColor.rgb = vColor.rgb;
          }
          diffuseColor.a = 1.0;
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
      for (const s of shown.values()) {
        const ground = s.onGround ? map.queryTerrainElevation([s.lng, s.lat]) : 0;
        if (ground == null) continue; // terrain tiles not in yet; try again next frame
        const anchor = MercatorCoordinate.fromLngLat([s.lng, s.lat], ground + s.altitudeM);
        const local = new THREE.Matrix4().fromArray(modelMatrix(anchor, anchor.meterInMercatorCoordinateUnits(), s.rotationDeg));
        camera.projectionMatrix.copy(mvp).multiply(local);
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

    async function show(key: string, url: string, place: Omit<Shown, "scene">, k: Kit, prepare?: (o: Object3D) => Promise<void>) {
      let model = models.get(url);
      if (!model) {
        model = k.loader.loadAsync(url).then(async (g) => {
          await prepare?.(g.scene);
          return g.scene;
        });
        models.set(url, model);
      }
      const obj = await model.catch(() => null);
      if (!obj || cancelled || isTornDown(map)) return false;
      kitLoaded = k;
      const scene = new k.THREE.Scene();
      scene.add(new k.THREE.HemisphereLight(0xffffff, 0x6b6156, 2.2));
      const sun = new k.THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(-0.5, 1, 0.3);
      scene.add(sun, obj.clone());
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
      await show(e.slug, e.url, { lng: e.lng, lat: e.lat, altitudeM: e.altitudeM, rotationDeg: e.rotationDeg, onGround: true }, k);
    }

    async function wantTile(t: TileEntry) {
      const key = `tile:${t.id}@${t.url}`;
      if (shown.has(key)) return;
      const k = await loadKit();
      if (cancelled || isTornDown(map)) return;
      const ok = await show(key, t.url, { lng: t.anchor[0], lat: t.anchor[1], altitudeM: 0, rotationDeg: 0, onGround: false }, k, async (o) => {
        o.traverse((m) => {
          if ((m as Mesh).isMesh) massingMaterial(k, (m as Mesh).material as MeshStandardMaterial);
        });
      });
      if (!ok) return;
      if (map.getLayer(BASEMAP_BUILDINGS)) map.setLayoutProperty(BASEMAP_BUILDINGS, "visibility", "none");
    }

    async function update() {
      const entries = await loadIndex();
      if (cancelled || isTornDown(map)) return;
      const selected = useMapStore.getState().ui.selectedSlug;
      const near = map.getZoom() >= NEAR_ZOOM ? map.getBounds() : null;
      for (const e of entries) {
        if (e.slug === selected || near?.contains([e.lng, e.lat])) void want(e);
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
