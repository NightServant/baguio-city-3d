"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { WEAVE } from "@/lib/palette";

// Base lines in warp (bone at night); the ridge pass in madder (lifted at night).
const lineColour = (dark: boolean) => (dark ? WEAVE.dark.warp : WEAVE.light.warp);
const ridgeColour = (dark: boolean) => (dark ? WEAVE.dark.madderLight : WEAVE.light.madder);

/**
 * Baguio's actual topography as a wireframe (homepage Problem section).
 *
 * public/baguio-heightmap.json is a 96x96 grid sampled from the same AWS
 * Terrarium DEM the map renders (153–2230 m across the app's bounds), so this
 * is the real landform rather than decorative geometry.
 *
 * It is drawn as a wireframe because a warp/weft grid stretched over relief is
 * the Cordillera Weave identity and the subject at the same time — the weave
 * and the terrain are one gesture.
 */

type HeightMap = { w: number; h: number; min: number; max: number; data: number[][] };

export function TerrainCanvas({
  className,
  style,
  riseOnScroll = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** Start as a flat grid and rise to full relief as the element scrolls into view. */
  riseOnScroll?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let disposed = false;

    // Mid-page WebGL shouldn't spend frames nobody can see.
    let onScreen = true;
    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { rootMargin: "100px" },
    );
    visibility.observe(host);

    // Flat as the element enters the viewport, full relief once its top has
    // travelled 80% of the viewport height. The flat grid is the flat map; the
    // rise is the ground it hides.
    const riseNow = () => {
      if (!riseOnScroll || reduced) return 1;
      const top = host.getBoundingClientRect().top;
      const vh = window.innerHeight;
      return Math.min(1, Math.max(0.02, (vh - top) / (vh * 0.8)));
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 7.6, 12.4);
    camera.lookAt(0, -0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // setSize(w, h, false) below only sets the drawing-buffer (w*DPR px); with
    // no CSS size the canvas lays out at that buffer's raw pixel count, i.e.
    // at DPR-times too large. Pin the CSS box to the host instead, so retina
    // devices render crisp without inflating layout size.
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = -0.32;
    scene.add(group);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    // Pointer parallax: the camera drifts, so the ridges shift against each
    // other the way real terrain does when you move your head.
    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    let mesh: THREE.LineSegments | null = null;
    let ridge: THREE.LineSegments | null = null;

    (async () => {
      let hm: HeightMap;
      try {
        const res = await fetch("/baguio-heightmap.json");
        if (!res.ok) return;
        hm = (await res.json()) as HeightMap;
      } catch {
        return;
      }
      if (disposed) return;

      const { w, h, min, max, data } = hm;
      const span = Math.max(1, max - min);
      const SIZE = 15;
      const RELIEF = 2.15;

      const geo = new THREE.PlaneGeometry(SIZE, SIZE, w - 1, h - 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      // Normalised height per-vertex, reused for the ridge pass.
      const norm = new Float32Array(pos.count);

      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const idx = j * w + i;
          const n = (data[j][i] - min) / span;
          norm[idx] = n;
          // Ease the low ground down so valleys read as valleys, not a slab.
          pos.setZ(idx, Math.pow(n, 1.35) * RELIEF);
        }
      }
      geo.computeVertexNormals();

      // Base weave: the full grid, quiet.
      // Warp lines vanish on the walnut night ground, so they flip to bone.
      const dark = document.documentElement.dataset.theme === "dark";
      const wire = new THREE.WireframeGeometry(geo);
      mesh = new THREE.LineSegments(
        wire,
        new THREE.LineBasicMaterial({ color: lineColour(dark), transparent: true, opacity: dark ? 0.2 : 0.16 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      group.add(mesh);

      // Ridge pass: only the highest ground, in madder. This is what makes the
      // Cordillera read as ridges rather than as a uniform mesh.
      const ridgeGeo = new THREE.BufferGeometry();
      const verts: number[] = [];
      const p = geo.attributes.position;
      for (let j = 0; j < h - 1; j++) {
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i;
          const b = j * w + i + 1;
          if (norm[a] > 0.62 && norm[b] > 0.62) {
            verts.push(p.getX(a), p.getY(a), p.getZ(a), p.getX(b), p.getY(b), p.getZ(b));
          }
        }
      }
      ridgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      ridge = new THREE.LineSegments(
        ridgeGeo,
        new THREE.LineBasicMaterial({ color: ridgeColour(dark), transparent: true, opacity: 0.85 }),
      );
      ridge.rotation.x = -Math.PI / 2;
      group.add(ridge);

      resize();
    })();

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    // The theme toggle flips data-theme on <html> without a reload; recolour the
    // lines in place so the wireframe never goes dark-on-dark.
    const recolour = () => {
      const d = document.documentElement.dataset.theme === "dark";
      if (mesh) {
        const m = mesh.material as THREE.LineBasicMaterial;
        m.color.set(lineColour(d));
        m.opacity = d ? 0.2 : 0.16;
      }
      if (ridge) (ridge.material as THREE.LineBasicMaterial).color.set(ridgeColour(d));
    };
    const themeObserver = new MutationObserver(recolour);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!onScreen) return;
      const rise = riseNow();
      if (mesh && ridge) {
        // Heights live on the plane's local z (it's rotated flat), so scaling
        // z lifts the relief without moving the grid.
        mesh.scale.z = rise;
        ridge.scale.z = rise;
        // The madder ridges surface last, arriving with the relief.
        (ridge.material as THREE.LineBasicMaterial).opacity = 0.85 * rise * rise;
      }
      if (!reduced) {
        camera.position.x += (target.x * 1.5 - camera.position.x) * 0.035;
        camera.position.y += (7.6 - target.y * 0.9 - camera.position.y) * 0.035;
        camera.lookAt(0, -0.6, 0);
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      visibility.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", onPointer);
      mesh?.geometry.dispose();
      (mesh?.material as THREE.Material | undefined)?.dispose();
      ridge?.geometry.dispose();
      (ridge?.material as THREE.Material | undefined)?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [riseOnScroll]);

  return <div ref={hostRef} className={className} style={style} aria-hidden="true" />;
}
