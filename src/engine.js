import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { $ } from './util.js';
import { settings } from './state.js';

export let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  const l = $('loader');
  l.classList.add('error');
  l.textContent = 'This chamber needs WebGL, which your browser could not start.';
  throw e;
}

// Which GPU did the browser give us? A dedicated card unlocks shadows, MSAA and denser effects.
export const GPU = (() => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const dedicated = /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d/i.test(name);
  // e.g. "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti Laptop GPU (0x000024A0) Direct3D11 ...)" → "NVIDIA GeForce RTX 3070 Ti Laptop GPU"
  const inner = (name.match(/^ANGLE \([^,]*,\s*(.*?)(?:\s*\(0x[0-9a-f]+\))?(?:\s+Direct3D.*|\s+OpenGL.*|\s+Metal.*|,.*)?\)?$/i) || [])[1];
  return { name, pretty: (inner || name).trim(), dedicated };
})();
export const HIGH = settings.quality === 'high' || (settings.quality === 'auto' && GPU.dedicated);
console.info(`[oracle] GPU: ${GPU.name} → ${HIGH ? 'high' : 'standard'} quality`);

renderer.setPixelRatio(Math.min(devicePixelRatio, HIGH ? 2 : 1.5));
renderer.setSize(innerWidth, innerHeight);
if (HIGH) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
$('stage').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06030b);
scene.fog = new THREE.FogExp2(0x06030b, 0.075);

export const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 60);
export const camBase = new THREE.Vector3(0, 2.1, 3.3);
export const camTarget = new THREE.Vector3(0, 1.45, -0.6);
export const camStart = new THREE.Vector3(0, 3.4, 8.5);
export const camAnchor = camStart.clone();   // where the camera wants to be; parallax is added on top
camera.position.copy(camAnchor);

export function layoutCamera() {
  const asp = innerWidth / innerHeight;
  camera.aspect = asp;
  camera.fov = asp < 0.9 ? 62 : 45;
  const k = asp < 1.3 ? 1 + (1.3 - asp) * 0.45 : 1;
  camBase.set(0, 2.1, 3.3 * k);
  camera.updateProjectionMatrix();
}
layoutCamera();

const pmrem = new THREE.PMREMGenerator(renderer);
export const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

// Post-processing bypasses the canvas's built-in antialiasing, so give the composer an MSAA target on capable GPUs.
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType, samples: HIGH ? 4 : 0,
}));
composer.setPixelRatio(renderer.getPixelRatio());
export const renderPass = new RenderPass(scene, camera); // its .scene is swapped between the chamber and the camp
composer.addPass(renderPass);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.65, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Final film grade: soft vignette, a whisper of chromatic fringing at the edges, and grain.
export const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uFocus: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uFocus; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      float d = length(c * vec2(uRes.x / uRes.y, 1.0)) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5);
      vec2 off = c * 0.004 * d;
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, base.g, texture2D(tDiffuse, vUv - off).b);
      float vig = smoothstep(1.15, 0.35 - uFocus * 0.1, d);
      col *= mix(0.42, 1.0, vig);
      col = mix(col, col * vec3(1.03, 0.98, 1.06), 0.6);          // a faint violet cast
      float n = fract(sin(dot(vUv * uRes + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.03;
      gl_FragColor = vec4(col, base.a);
    }`,
});
composer.addPass(grade);

export function resizeEngine() {
  if (!innerWidth || !innerHeight) return false;
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  grade.uniforms.uRes.value.set(innerWidth, innerHeight);
  layoutCamera();
  return true;
}

export const Y_AXIS = new THREE.Vector3(0, 1, 0);
export const Z_AXIS = new THREE.Vector3(0, 0, 1);
