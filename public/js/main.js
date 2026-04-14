/**
 * Voxel Island Lobby - Main Entry
 * Minecraft-style 3D multiplayer lobby
 */
import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';
import { VoxelBuilder } from './VoxelBuilder.js';
import { TypingRing } from './TypingRing.js';
import { createSky, createClouds, loadStatue, checkPortalZones, animateWorld } from './World.js';

// ─── RENDERER ────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// ─── SCENE ───────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// Light blue distance fog for atmosphere
scene.fog = new THREE.Fog(0xc8ddf0, 60, 180);

// ─── CAMERA ──────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 15, 25);

// ─── LIGHTING (Bright sunny day) ─────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

// Warm sunlight
const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.3);
sunLight.position.set(40, 80, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40;
sunLight.shadow.camera.bottom = -40;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 200;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

// Hemisphere light for natural sky/ground color bounce
const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x5d9948, 0.4);
scene.add(hemiLight);

// ─── ENVIRONMENT ─────────────────────────────────────────
createSky(scene);
const clouds = createClouds(scene);

// ─── NETWORK & PLAYER ────────────────────────────────────
const network = new NetworkManager(scene);
const voxelBuilder = new VoxelBuilder(scene);
let localPlayer = null;
let portalInfos = [];
let typingRing = null;

async function init() {
  const selfData = await network.connect();

  // Build circular island from server heightmap
  voxelBuilder.build(selfData.heightMap, selfData.chunkSize);

  // Build sea surrounding the island
  voxelBuilder.buildSea();

  // Build the stone pedestal at center
  const { topY: pedestalTopY } = voxelBuilder.buildPedestal(3);

  // Load the Ambedkar statue on top of pedestal
  await loadStatue(scene, pedestalTopY);

  // Build 4 portal arches at N/S/E/W
  const islandRadius = selfData.islandRadius || 20;
  portalInfos = voxelBuilder.buildPortals(islandRadius);

  // Local Player
  localPlayer = new Player(scene, camera, selfData.color);

  // Typing Battle Ring
  typingRing = new TypingRing(scene, localPlayer, network.socket);

  // Sync server snapshots
  network.onSnapshots = (snapshots) => {
    const s = snapshots.find(snap => snap.id === network.selfId);
    if (s && localPlayer) {
      localPlayer.setServerState(s.x, s.y, s.z);
    }
  };

  // Hide loading screen
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('done');
}

// ─── GAME LOOP ───────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  if (localPlayer) {
    localPlayer.update(dt);
    network.sendInput(localPlayer.getInputState());

    // Check portal zones
    checkPortalZones(localPlayer.mesh.position, portalInfos);

    if (typingRing) typingRing.update(dt);
  }

  network.update();

  // Gentle world animations
  animateWorld(clouds, elapsed);

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init().catch(console.error);
animate();
