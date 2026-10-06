// The 3D runtime, imported once after the map's first idle (ModelLayer loadKit). Named exports, not the whole three
// namespace, so the bundler drops the parts of three the layer never uses (contract C6: 3D runtime <= 180 KiB gzip;
// the namespace import measured about 205 KiB, M7 2026-10-06).
export { Camera, Color, DirectionalLight, HemisphereLight, Matrix4, Scene, WebGLRenderer } from "three";
export { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
export { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
