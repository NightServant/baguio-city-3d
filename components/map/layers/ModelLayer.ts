"use client";

// Landmark meshes drawn with three.js inside MapLibre's GL context (contract C5). Nothing 3D
// loads before the map's first idle; a landmark loads when its sheet opens or when it is in view
// at zoom >= 15 (contract C3). Each model is drawn with its own projection matrix, multiplied in
// JS doubles, because a float32 GPU matrix can't hold a Mercator offset to the metre.
import { useEffect } from "react";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import type { Camera, Object3D, Scene, WebGLRenderer } from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { modelMatrix } from "@/lib/map/modelTransform";
import { useMapStore } from "@/stores/useMapStore";
import { isTornDown } from "./teardown";

const LAYER_ID = "model-3d";
const INDEX_URL = "/models/landmarks/index.json";
const NEAR_ZOOM = 15;

interface LandmarkEntry { slug: string; lng: number; lat: number; url: string; rotationDeg: number; altitudeM: number }
interface Shown { entry: LandmarkEntry; scene: Scene }

type Kit = { THREE: typeof import("three"); loader: GLTFLoader };
let kit: Promise<Kit> | null = null;
const loadKit = () =>
  (kit ??= Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]).then(([THREE, { GLTFLoader }, { MeshoptDecoder }]) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
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

// The first idle, or IDLE_FALLBACK_MS after the layer first mounts, whichever comes first. On a slow
// link idle can keep slipping while tiles stream in (55 s measured at 6 KB/s, 2026-10-02), and a
// visitor who keeps panning might otherwise never see a model; 10 s keeps the first render clear.
const IDLE_FALLBACK_MS = 10_000;
const firstIdle = new WeakMap<MapLibreMap, Promise<void>>();
function whenFirstIdle(map: MapLibreMap) {
  let p = firstIdle.get(map);
  if (!p) {
    p = map.loaded()
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
      const exaggeration = map.getTerrain()?.exaggeration ?? 1;
      // Mercator [0..1] -> clip, float64. Not options.modelViewProjectionMatrix: in MapLibre 5 that one
      // works in world pixels (maplibre-gl-dev.js getProjectionDataForCustomLayer, 5.24).
      const mvp = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix as unknown as number[]);
      renderer.resetState();
      for (const { entry, scene } of shown.values()) {
        const ground = map.queryTerrainElevation([entry.lng, entry.lat]);
        if (ground == null) continue; // terrain tiles not in yet; try again next frame
        const anchor = MercatorCoordinate.fromLngLat([entry.lng, entry.lat], ground + entry.altitudeM * exaggeration);
        const local = new THREE.Matrix4().fromArray(
          modelMatrix(anchor, anchor.meterInMercatorCoordinateUnits(), exaggeration, entry.rotationDeg),
        );
        camera.projectionMatrix.copy(mvp).multiply(local);
        renderer.render(scene, camera);
      }
    },
  };
}

export function useModelLayer(map: MapLibreMap) {
  useEffect(() => {
    let cancelled = false;
    let layerAdded = false;
    const shown = new Map<string, Shown>();

    async function want(entry: LandmarkEntry) {
      if (shown.has(entry.slug)) return;
      const k = await loadKit();
      if (cancelled || isTornDown(map)) return;
      let model = models.get(entry.url);
      if (!model) {
        model = k.loader.loadAsync(entry.url).then((g) => g.scene);
        models.set(entry.url, model);
      }
      const obj = await model.catch(() => null);
      if (!obj || cancelled || isTornDown(map)) return;
      const scene = new k.THREE.Scene();
      scene.add(new k.THREE.HemisphereLight(0xffffff, 0x6b6156, 2.2));
      const sun = new k.THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(-0.5, 1, 0.3);
      scene.add(sun, obj.clone());
      shown.set(entry.slug, { entry, scene });
      if (!layerAdded) {
        try {
          map.addLayer(createLayer(map, k, shown));
          layerAdded = true;
        } catch {
          return; // style mid-swap; the remount on the next styleGeneration re-adds it
        }
      }
      map.triggerRepaint();
    }

    async function update() {
      const entries = await loadIndex();
      if (cancelled || isTornDown(map)) return;
      const selected = useMapStore.getState().ui.selectedSlug;
      const near = map.getZoom() >= NEAR_ZOOM ? map.getBounds() : null;
      for (const e of entries) {
        if (e.slug === selected || near?.contains([e.lng, e.lat])) void want(e);
      }
    }

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
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    };
  }, [map]);
}
