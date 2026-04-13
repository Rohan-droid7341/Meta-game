/**
 * VoxelBuilder - Flat circular island + Minecraft Nether-style portals
 */
import * as THREE from 'three';

const PALETTE = {
  grass:     0x5d9948,
  dirt:      0x866043,
  stone:     0x7a7a7a,
  water:     0x4577de,
  obsidian:  0x1a0a2e, // dark purple-black obsidian
  pedestal:  0x7a7a7a,
};

export class VoxelBuilder {
  constructor(scene) {
    this.scene = scene;
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.materials = {};
    for (const [name, color] of Object.entries(PALETTE)) {
      if (name === 'water') {
        this.materials[name] = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8, roughness: 0.3 });
      } else if (name === 'obsidian') {
        this.materials[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
      } else {
        this.materials[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      }
    }
  }

  /** Build flat circular island — every land cell is height 1 */
  build(heightMap, chunkSize) {
    let grassCount = 0, dirtCount = 0;
    for (let x = 0; x < chunkSize; x++)
      for (let z = 0; z < chunkSize; z++)
        if (heightMap[x][z] > 0) { grassCount++; dirtCount++; }

    const grassMesh = new THREE.InstancedMesh(this.boxGeo, this.materials.grass, grassCount);
    grassMesh.castShadow = true; grassMesh.receiveShadow = true;

    const dirtMesh = new THREE.InstancedMesh(this.boxGeo, this.materials.dirt, dirtCount);
    dirtMesh.receiveShadow = true;

    const mat = new THREE.Matrix4();
    const half = chunkSize / 2;
    let gi = 0, di = 0;

    for (let x = 0; x < chunkSize; x++) {
      for (let z = 0; z < chunkSize; z++) {
        if (heightMap[x][z] <= 0) continue;
        const px = x - half, pz = z - half;
        mat.setPosition(px, 0.5, pz); // grass top at y=0.5
        grassMesh.setMatrixAt(gi++, mat);
        mat.setPosition(px, -0.5, pz); // dirt bottom at y=-0.5
        dirtMesh.setMatrixAt(di++, mat);
      }
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    dirtMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(grassMesh);
    this.scene.add(dirtMesh);
  }

  /** Stone pedestal at center */
  buildPedestal(pedestalHeight = 3) {
    const size = 4;
    const count = size * size * pedestalHeight;
    const mesh = new THREE.InstancedMesh(this.boxGeo, this.materials.pedestal, count);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const mat = new THREE.Matrix4();
    let idx = 0;
    for (let x = 0; x < size; x++)
      for (let z = 0; z < size; z++)
        for (let y = 0; y < pedestalHeight; y++) {
          mat.setPosition(x - size/2 + 0.5, 1 + y + 0.5, z - size/2 + 0.5);
          mesh.setMatrixAt(idx++, mat);
        }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    return { topY: 1 + pedestalHeight };
  }

  /** Build 4 Nether-style portals: obsidian frame + purple swirl inside */
  buildPortals(islandRadius) {
    const dist = islandRadius - 3;
    const portalDefs = [
      { name: 'RPG / Open World',  dir: 'N', cx: 0,     cz: -dist },
      { name: 'Shooter',           dir: 'E', cx: dist,   cz: 0 },
      { name: 'Mini-games',        dir: 'S', cx: 0,     cz: dist },
      { name: 'Special Events',    dir: 'W', cx: -dist, cz: 0 },
    ];

    // Collect all obsidian block positions
    const allBlocks = [];
    const portals = [];

    for (const def of portalDefs) {
      const blocks = this._netherPortalFrame(def.cx, def.cz, def.dir);
      allBlocks.push(...blocks);

      // Add purple swirl plane inside the frame
      this._addPortalSwirl(def.cx, def.cz, def.dir);

      portals.push({ name: def.name, cx: def.cx, cz: def.cz, dir: def.dir });
    }

    // Single InstancedMesh for all obsidian blocks
    const mesh = new THREE.InstancedMesh(this.boxGeo, this.materials.obsidian, allBlocks.length);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const mat = new THREE.Matrix4();
    allBlocks.forEach((b, i) => { mat.setPosition(b.x, b.y, b.z); mesh.setMatrixAt(i, mat); });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);

    return portals;
  }

  /** Generate obsidian frame (like Minecraft Nether portal: 4 wide x 5 tall, hollow inside) */
  _netherPortalFrame(cx, cz, dir) {
    const blocks = [];
    const isNS = dir === 'N' || dir === 'S';
    // Frame: 4 wide, 5 tall. Inner opening: 2 wide, 3 tall
    // Bottom row (4 blocks)
    for (let i = -2; i <= 1; i++) {
      const bx = isNS ? cx + i + 0.5 : cx;
      const bz = isNS ? cz : cz + i + 0.5;
      blocks.push({ x: bx, y: 1.5, z: bz }); // bottom
      blocks.push({ x: bx, y: 5.5, z: bz }); // top
    }
    // Left & right pillars (3 inner blocks each side)
    for (let y = 0; y < 3; y++) {
      const lx = isNS ? cx - 2 + 0.5 : cx;
      const lz = isNS ? cz : cz - 2 + 0.5;
      const rx = isNS ? cx + 1 + 0.5 : cx;
      const rz = isNS ? cz : cz + 1 + 0.5;
      blocks.push({ x: lx, y: 2.5 + y, z: lz });
      blocks.push({ x: rx, y: 2.5 + y, z: rz });
    }
    return blocks;
  }

  /** Glowing purple swirl inside the portal frame */
  _addPortalSwirl(cx, cz, dir) {
    const isNS = dir === 'N' || dir === 'S';

    // Create animated portal texture
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Purple swirl pattern
    for (let py = 0; py < 96; py++) {
      for (let px = 0; px < 64; px++) {
        const nx = px / 64, ny = py / 96;
        const v = Math.sin(nx * 8 + ny * 4) * Math.cos(ny * 6 - nx * 3);
        const r = Math.floor(100 + v * 55);
        const g = Math.floor(30 + v * 20);
        const b = Math.floor(180 + v * 75);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px, py, 1, 1);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;

    const portalMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });

    // Inner opening is 2 wide x 3 tall, centered in frame
    const geo = new THREE.PlaneGeometry(2, 3);
    const plane = new THREE.Mesh(geo, portalMat);

    if (isNS) {
      plane.position.set(cx, 3.5, cz);
      // Faces along Z axis already (default plane faces Z)
    } else {
      plane.position.set(cx, 3.5, cz);
      plane.rotation.y = Math.PI / 2;
    }

    // Add purple glow light
    const light = new THREE.PointLight(0x8844cc, 2, 8);
    light.position.set(cx, 3.5, cz);
    this.scene.add(light);

    plane.userData.portalMaterial = portalMat;
    plane.userData.portalTexture = tex;
    this.scene.add(plane);
  }

  /** Sea plane */
  buildSea() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      this.materials.water
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0.4;
    sea.receiveShadow = true;
    this.scene.add(sea);
  }
}
