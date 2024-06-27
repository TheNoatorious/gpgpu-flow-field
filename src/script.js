import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import GUI from "lil-gui";
import particlesVertexShader from "./shaders/particles/vertex.glsl";
import particlesFragmentShader from "./shaders/particles/fragment.glsl";
import gpgpuParticlesShader from "./shaders/gpgpu/particles.glsl";

import Stats from "stats.js";

/**
 * Stats FPS
 */

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

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

debugObject.clearColor = "#121212";
renderer.setClearColor(debugObject.clearColor);

/**
 * Load model
 */

const gltf = await gltfLoader.loadAsync("./model.glb");

/**
 * Base geometry
 */
const baseGeometry = {};
baseGeometry.instance = gltf.scene.children[0].geometry;
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

// Base particles for the GPU-CR
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
    particlesChannel[i4 + 3] = Math.random(); // Randomised value for the particle life cycle
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

// Uniforms
gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0);
gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0);
gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(
    baseParticlesTexture
);
gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence =
    new THREE.Uniform(0.5);
gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength =
    new THREE.Uniform(2);
gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency =
    new THREE.Uniform(0.5);

// Init
gpgpu.computation.init();

console.log(baseParticlesTexture); // Returns a data texture
console.log(baseParticlesTexture.image.data); // Contains a float32Array with the pixels

const fboTexture = gpgpu.computation.getCurrentRenderTarget(
    gpgpu.particlesVariable
).texture; // Provide the last saved FBO texture

// Debug plane
// Visualise the FBO texture
gpgpu.debug = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({
        map: fboTexture,
    })
);

gpgpu.debug.position.x = 3;
gpgpu.debug.visible = false;
scene.add(gpgpu.debug);

/**
 * Particles
 */
const particles = {};

// Geometry
const particlesUvArray = new Float32Array(baseGeometry.count * 2);
const sizesArray = new Float32Array(baseGeometry.count); // 1 variable needed per vertex

// Create random UV coordinates to pick pixels from the FBO texture
// Loop rows: Y-coordinate
for (let y = 0; y < gpgpu.size; y++) {
    // Loop columns: X-coordinate
    for (let x = 0; x < gpgpu.size; x++) {
        // Output of two values: X and Y
        const i = y * gpgpu.size + x; // Fill the array
        const i2 = i * 2; // y-coordinate

        // Normalized texture coordinates (0 to 1)
        const uvX = (x + 0.5) / gpgpu.size;
        const uvY = (y + 0.5) / gpgpu.size;

        // Fill the particlesUvArray with UV coordinates
        particlesUvArray[i2 + 0] = uvX;
        particlesUvArray[i2 + 1] = uvY;

        sizesArray[i] = Math.random(); // Randomise particle sizes
    }
}

// Final geometry
particles.geometry = new THREE.BufferGeometry();
particles.geometry.setDrawRange(0, baseGeometry.count); // Draw this amount of vertices
particles.geometry.setAttribute(
    "aParticlesUv",
    new THREE.BufferAttribute(particlesUvArray, 2)
);
particles.geometry.setAttribute(
    "aColor",
    baseGeometry.instance.attributes.color
);
particles.geometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(sizesArray, 1)
);

// Material
particles.material = new THREE.ShaderMaterial({
    vertexShader: particlesVertexShader,
    fragmentShader: particlesFragmentShader,
    uniforms: {
        uSize: new THREE.Uniform(0.07),
        uResolution: new THREE.Uniform(
            new THREE.Vector2(
                sizes.width * sizes.pixelRatio,
                sizes.height * sizes.pixelRatio
            )
        ),
        uParticlesTexture: new THREE.Uniform(),
    },
});

// Points
particles.points = new THREE.Points(particles.geometry, particles.material);
scene.add(particles.points);

/**
 * Tweaks
 */
gui.addColor(debugObject, "clearColor")
    .onChange(() => {
        renderer.setClearColor(debugObject.clearColor);
    })
    .name("Background colour");
gui.add(particles.material.uniforms.uSize, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("Particles size");

gui.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("FlowField Influence");
gui.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength, "value")
    .min(0)
    .max(10)
    .step(0.001)
    .name("FlowField Strength");

gui.add(gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("FlowField Frequency");

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    stats.begin();

    // Update controls
    controls.update();

    // GPGPU Update
    gpgpu.computation.compute();
    particles.material.uniforms.uParticlesTexture.value = fboTexture;

    // Render normal scene
    renderer.render(scene, camera);

    gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime;
    gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime;
    gpgpu.computation.compute(); // Update particles variable on each frame

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);

    stats.end();
};

tick();
