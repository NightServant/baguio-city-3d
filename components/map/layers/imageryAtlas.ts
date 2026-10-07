// The satellite photograph on the 3D models, as in Google Earth (owner 2026-10-07): the Esri World Imagery tiles
// around the view, drawn into one texture (8 x 8 tiles, 4 x 4 on phones) at the map's zoom, over a coarse texture of
// the whole city (z14, z13 on phones), projected straight down onto the massing's roofs, the landmarks' ground (lawns,
// paving, fields) and the districts' roofs.
// Unlit, toned like the map's own imagery layer (basemapTheme.ts), so a model's roof or lawn shows the same photograph
// as the ground around it. Outside the texture, or before a tile arrives, a surface keeps its own colour.
import type { CanvasTexture, Material, MeshStandardMaterial } from "three";
import { IMAGERY_SOURCE } from "@/lib/map/sources";

type ThreeKit = typeof import("@/lib/map/threeKit");

const EARTH_M = 40_075_016.686;
const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2;

// Shared by every patched material: the texture, then per scene (set before each scene renders, placeImagery) its
// origin in the texture (u, v), texture units per metre and whether a texture exists; its rotation (cos, sin); and the
// imagery tone (brightness, saturation).
export const imageryUniforms = {
  uImg: { value: null as CanvasTexture | null },
  uImgXf: { value: [0, 0, 0, 0] },
  uImg2: { value: null as CanvasTexture | null }, // the coarse, city-wide texture, and its placement
  uImgXf2: { value: [0, 0, 0, 0] },
  uImgRot: { value: [1, 0] },
  uImgTone: { value: [1, 0] },
};

interface Atlas { z: number; x0: number; y0: number; n: number; tex: CanvasTexture }
let maxAnisotropy = 1;
/** The renderer's anisotropic filtering limit (ModelLayer sets it when the renderer is made). */
export const setMaxAnisotropy = (n: number) => (maxAnisotropy = Math.min(8, n));
let atlas: Atlas | null = null;
let city: Atlas | null = null;
const CITY: [number, number] = [120.596, 16.4023]; // lib/constants BAGUIO_CENTER

/** Re-centre the texture on the view when the view has moved over a tile from its centre or changed zoom level. */
export function updateAtlas(kit: ThreeKit, lng: number, lat: number, zoom: number, repaint: () => void) {
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const n = small ? 4 : 8;
  city ??= build(kit, small ? 13 : 14, CITY[0], CITY[1], n, (t) => (imageryUniforms.uImg2.value = t), repaint);
  // one zoom finer than the view on desktop (sharper roofs), never past the photographs (sources.ts)
  const z = Math.max(12, Math.min(IMAGERY_SOURCE.maxzoom, Math.round(zoom) + (small ? 0 : 1)));
  const cx = Math.floor(mercX(lng) * 2 ** z), cy = Math.floor(mercY(lat) * 2 ** z);
  if (atlas && atlas.z === z && Math.abs(cx - atlas.x0 - n / 2) <= 1 && Math.abs(cy - atlas.y0 - n / 2) <= 1) return;
  atlas?.tex.dispose();
  atlas = build(kit, z, lng, lat, n, (t) => (imageryUniforms.uImg.value = t), repaint);
}

function build({ CanvasTexture, SRGBColorSpace }: ThreeKit, z: number, lng: number, lat: number, n: number,
  bind: (t: CanvasTexture) => void, repaint: () => void): Atlas | null {
  const cx = Math.floor(mercX(lng) * 2 ** z), cy = Math.floor(mercY(lat) * 2 ** z);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n * 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false; // v grows southward, as the canvas rows do
  tex.anisotropy = maxAnisotropy; // crisp at the map's oblique angles
  const a: Atlas = { z, x0: cx - n / 2, y0: cy - n / 2, n, tex };
  bind(tex);
  let queued = false;
  const flush = () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      tex.needsUpdate = true;
      repaint();
    }, 200);
  };
  const url = IMAGERY_SOURCE.tiles[0];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (atlas?.tex !== tex && city?.tex !== tex) return; // superseded
        ctx.drawImage(img, i * 256, j * 256);
        flush();
      };
      img.src = url.replace("{z}", String(z)).replace("{y}", String(a.y0 + j)).replace("{x}", String(a.x0 + i));
    }
  }
  return a;
}

const placement = (a: Atlas | null, lng: number, lat: number) => {
  if (!a) return [0, 0, 0, 0];
  const side = a.n / 2 ** a.z; // the texture's side in Mercator units
  return [(mercX(lng) - a.x0 / 2 ** a.z) / side, (mercY(lat) - a.y0 / 2 ** a.z) / side,
    1 / (EARTH_M * Math.cos((lat * Math.PI) / 180) * side), 1];
};

/** Point the shared uniforms at one scene: its anchor and rotation (clockwise from north), before it renders. */
export function placeImagery(lng: number, lat: number, rotationDeg: number) {
  const dark = document.documentElement.dataset.theme === "dark";
  imageryUniforms.uImgTone.value = dark ? [0.48, -0.3] : [1, 0.08]; // basemapTheme.ts DAY / NIGHT
  imageryUniforms.uImgXf.value = placement(atlas, lng, lat);
  imageryUniforms.uImgXf2.value = placement(city, lng, lat);
  const t = (rotationDeg * Math.PI) / 180;
  imageryUniforms.uImgRot.value = [Math.cos(t), Math.sin(t)];
}

// Fragment helpers. vPosM is the fragment in the scene's metres (x east, y up, z south before the scene's rotation).
export const IMAGERY_PARS = `
uniform sampler2D uImg;
uniform vec4 uImgXf;
uniform sampler2D uImg2;
uniform vec4 uImgXf2;
uniform vec2 uImgRot;
uniform vec2 uImgTone;
vec4 imagerySample(sampler2D t, vec4 xf, vec2 es) {
  vec2 uv = xf.xy + es * xf.z;
  if (xf.w < 0.5 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(t, uv);
}
vec4 imageryAt(vec3 p) {
  vec2 es = vec2(uImgRot.x * p.x - uImgRot.y * p.z, uImgRot.y * p.x + uImgRot.x * p.z);
  vec4 c = imagerySample(uImg, uImgXf, es);
  if (c.a < 0.99) c = imagerySample(uImg2, uImgXf2, es);
  vec3 l = vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114)));
  return vec4(mix(l, c.rgb, 1.0 + uImgTone.y) * uImgTone.x, c.a);
}
`;
// Unlit: the photograph replaces the surface's colour and is added as emission, as the map's imagery layer is drawn.
export const IMAGERY_APPLY = (mask: string) => `{
  vec4 img = imageryAt(vPosM);
  float k = img.a * (${mask});
  diffuseColor.rgb *= 1.0 - k;
  totalEmissiveRadiance += img.rgb * k;
}`;

export function withImageryUniforms(sh: { uniforms: Record<string, unknown> }) {
  Object.assign(sh.uniforms, imageryUniforms);
}

export const VPOS_VERTEX = (vs: string) =>
  vs
    .replace("#include <common>", "#include <common>\nvarying vec3 vPosM;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPosM = (modelMatrix * vec4(transformed, 1.0)).xyz;");

/** A landmark's ground material (lawn, paving, a field): the photograph wherever the texture covers it. */
export function imageryGround(m: Material) {
  const s = m as MeshStandardMaterial;
  s.onBeforeCompile = (sh) => {
    withImageryUniforms(sh);
    sh.vertexShader = VPOS_VERTEX(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPosM;\n${IMAGERY_PARS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${IMAGERY_APPLY("1.0")}`);
  };
  s.customProgramCacheKey = () => "imagery-ground";
  s.needsUpdate = true;
}

// Landmark materials that are flat ground (lm_common PARK_COLOURS classes and the landmarks' own lawns and paving) or a
// district's roofs (*_roof_photo, model/blender/landmarks/district.py), not
// SM's roof garden (modelled after the owner's photos).
const GROUND_MATERIAL = /^MAT_.*_(lawn|garden|paved|plaza|playground|grass|pave|field|pitch|track|roof_photo)$|^MAT_(burnham|baguio_athletic_bowl|burnham_park_\w+)_wood$/;
export const isGroundMaterial = (name: string) => GROUND_MATERIAL.test(name) && !name.startsWith("MAT_sm_");
