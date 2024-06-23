import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import GUI from "lil-gui";
import particlesVertexShader from "./shaders/particles/vertex.glsl";
import particlesFragmentShader from "./shaders/particles/fragment.glsl";
import gpgpuParticlesShader from "./shaders/gpgpu/particles.glsl";

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 });
const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
};

window.addEventListener("resize", () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

    // Materials
    particles.material.uniforms.uResolution.value.set(
        sizes.width * sizes.pixelRatio,
        sizes.height * sizes.pixelRatio
    );

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(sizes.pixelRatio);
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
    35,
    sizes.width / sizes.height,
    0.1,
    100
);
camera.position.set(4.5, 4, 11);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);

debugObject.clearColor = "#29191f";
renderer.setClearColor(debugObject.clearColor);

/**
 * Base geometry
 */
const baseGeometry = {};
baseGeometry.instance = new THREE.SphereGeometry(3);
baseGeometry.count = baseGeometry.instance.attributes.position.count;

/**
 * GPU Computer
 */

// Setup
const gpgpu = {};
const squaredFBO = Math.sqrt(baseGeometry.count); // FBO textures in square sizes
gpgpu.size = Math.ceil(squaredFBO); // Round up so each particle fits

console.log(gpgpu.size); // Particles texture size check

gpgpu.computation = new GPUComputationRenderer(
    gpgpu.size,
    gpgpu.size,
    renderer
);

// Base particles
const baseParticlesTexture = gpgpu.computation.createTexture();

for (let i = 0; i < baseGeometry.count; i++) {
    const i3 = i * 3;
    const i4 = i * 4;

    const particlesPosition = baseGeometry.instance.attributes.position.array;
    const particlesChannel = baseParticlesTexture.image.data;

    // Positions based on geometry
    particlesChannel[i4 + 0] = particlesPosition[i3 + 0]; // r -> x
    particlesChannel[i4 + 1] = particlesPosition[i3 + 1]; // g -> y
    particlesChannel[i4 + 2] = particlesPosition[i3 + 2]; // b -> z
    particlesChannel[i4 + 3] = 0; // a -> 0
}

// Particles Variable
gpgpu.particlesVariable = gpgpu.computation.addVariable(
    "uParticles", // FBO texture
    gpgpuParticlesShader, // Saving logic
    baseParticlesTexture // The base texture
);

gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [
    gpgpu.particlesVariable,
]); // Loop variable computation

// Init
gpgpu.computation.init();

console.log(baseParticlesTexture); // Returns a data texture
console.log(baseParticlesTexture.image.data); // Contains a float32Array with the pixels

const fboTexture = gpgpu.computation.getCurrentRenderTarget(
    gpgpu.particlesVariable
).texture;

// Debug plane
// Visualise the FBO texture
gpgpu.debug = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({
        map: fboTexture,
    })
);

gpgpu.debug.position.x = 3;
scene.add(gpgpu.debug);

/**
 * Particles
 */
const particles = {};

// Material
particles.material = new THREE.ShaderMaterial({
    vertexShader: particlesVertexShader,
    fragmentShader: particlesFragmentShader,
    uniforms: {
        uSize: new THREE.Uniform(0.4),
        uResolution: new THREE.Uniform(
            new THREE.Vector2(
                sizes.width * sizes.pixelRatio,
                sizes.height * sizes.pixelRatio
            )
        ),
    },
});

// Points
particles.points = new THREE.Points(baseGeometry.instance, particles.material);
scene.add(particles.points);

particles.geometry = new THREE.BufferGeometry();

/**
 * Tweaks
 */
gui.addColor(debugObject, "clearColor").onChange(() => {
    renderer.setClearColor(debugObject.clearColor);
});
gui.add(particles.material.uniforms.uSize, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("uSize");

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    // Update controls
    controls.update();

    // Render normal scene
    renderer.render(scene, camera);

    gpgpu.computation.compute(); // Update particles variable on each frame

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
};

tick();
