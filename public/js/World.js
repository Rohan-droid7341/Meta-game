/**
 * World - Sky, clouds, statue, and portal zone checking
 * Minecraft-style natural aesthetic
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── SUNNY SKY ──────────────────────────────────────────
export function createSky(scene) {
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const sun = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - 50); // elevation 50°
  const theta = THREE.MathUtils.degToRad(200);     // azimuth
  sun.setFromSphericalCoords(1, phi, theta);

  sky.material.uniforms['sunPosition'].value.copy(sun);
  sky.material.uniforms['turbidity'].value = 4;
  sky.material.uniforms['rayleigh'].value = 1.5;
  sky.material.uniforms['mieCoefficient'].value = 0.003;
  sky.material.uniforms['mieDirectionalG'].value = 0.8;

  return sky;
}

// ─── VOXEL CLOUDS ───────────────────────────────────────
export function createClouds(scene) {
  const cloudGroup = new THREE.Group();
  cloudGroup.name = 'clouds';

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });

  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Group();
    const blockCount = 4 + Math.floor(Math.random() * 6);

    for (let j = 0; j < blockCount; j++) {
      const w = 3 + Math.random() * 5;
      const h = 1 + Math.random() * 1.5;
      const d = 3 + Math.random() * 5;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        cloudMat
      );
      box.position.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 6
      );
      cloud.add(box);
    }

    cloud.position.set(
      (Math.random() - 0.5) * 180,
      30 + Math.random() * 15,
      (Math.random() - 0.5) * 180
    );

    cloudGroup.add(cloud);
  }

  scene.add(cloudGroup);
  return cloudGroup;
}

// ─── STATUE LOADER ──────────────────────────────────────
export function loadStatue(scene, pedestalTopY) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const modelPath = '/model/dr_bhimrao_ambedkar/scene.gltf';

    loader.load(
      modelPath,
      (gltf) => {
        const statue = gltf.scene;

        // Compute bounding box to figure out scaling
        const box = new THREE.Box3().setFromObject(statue);
        const size = new THREE.Vector3();
        box.getSize(size);
        const currentHeight = size.y;

        // Target height: 3x player height (player ~1.8 units) = 5.4 units
        const targetHeight = 5.4;
        const scaleFactor = targetHeight / currentHeight;
        statue.scale.setScalar(scaleFactor);

        // Recompute after scaling
        const box2 = new THREE.Box3().setFromObject(statue);
        const size2 = new THREE.Vector3();
        box2.getSize(size2);
        const min2 = box2.min;

        // Center on pedestal
        statue.position.set(
          -(min2.x + size2.x / 2),
          pedestalTopY - min2.y,
          -(min2.z + size2.z / 2)
        );

        // Override material for matte stone finish
        statue.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Keep the existing material but ensure matte finish
            if (child.material) {
              child.material.metalness = 0.0;
              child.material.roughness = 0.7;
            }
          }
        });

        scene.add(statue);
        console.log('[World] Statue loaded successfully');
        resolve(statue);
      },
      undefined,
      (err) => {
        console.warn('[World] Could not load statue GLTF, using procedural fallback:', err);
        const fallback = createProceduralStatue(scene, pedestalTopY);
        resolve(fallback);
      }
    );
  });
}

/**
 * Procedural fallback: a dignified standing figure made of voxel-style boxes
 */
function createProceduralStatue(scene, pedestalTopY) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    roughness: 0.8,
    metalness: 0.1,
  });

  const make = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };

  // Scale: 3x player (player ~1.8 tall => statue ~5.4)
  const base = pedestalTopY;
  make(1.2, 2.4, 0.6, 0, base + 1.2, 0);    // Body/torso
  make(0.8, 0.8, 0.8, 0, base + 3.0, 0);    // Head
  make(0.4, 2.0, 0.4, -1.0, base + 1.4, 0); // Left arm
  make(0.4, 2.0, 0.4, 1.0, base + 1.4, 0);  // Right arm
  make(0.5, 1.6, 0.5, -0.35, base - 0.4, 0);// Left leg
  make(0.5, 1.6, 0.5, 0.35, base - 0.4, 0); // Right leg

  scene.add(group);
  return group;
}

// ─── PORTAL ZONE CHECKING ──────────────────────────────
let activePortal = null;
const PORTAL_TRIGGER_RADIUS = 2.5;

export function checkPortalZones(playerPos, portals) {
  let inside = null;

  for (const portal of portals) {
    const dx = playerPos.x - portal.cx;
    const dz = playerPos.z - portal.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < PORTAL_TRIGGER_RADIUS) {
      inside = portal;
      break;
    }
  }

  const msgEl = document.getElementById('portal-msg');

  if (inside && inside.name !== activePortal) {
    activePortal = inside.name;
    console.log(`🎮 Joining: ${inside.name} (${inside.dir} Portal)`);
    if (msgEl) {
      msgEl.textContent = `⛏ ${inside.name.toUpperCase()} ⛏`;
      msgEl.classList.add('show');
    }
  } else if (!inside && activePortal) {
    activePortal = null;
    if (msgEl) msgEl.classList.remove('show');
  }
}

// ─── GENTLE WORLD ANIMATION ────────────────────────────
export function animateWorld(clouds, time) {
  // Gentle cloud drift
  if (clouds) {
    clouds.children.forEach((cloud, i) => {
      cloud.position.x += Math.sin(time * 0.1 + i) * 0.003;
      cloud.position.z += Math.cos(time * 0.15 + i * 0.7) * 0.002;
    });
  }
}
