/**
 * RemotePlayer - Minecraft-style avatar for other connected players
 * Uses lerp for smooth position/rotation interpolation
 */
import * as THREE from 'three';

const LERP_SPEED = 0.12;

export class RemotePlayer {
  constructor(scene, id, color, x, y, z, ry) {
    this.scene = scene;
    this.id = id;

    // Target state (from server)
    this.targetPos = new THREE.Vector3(x, y, z);
    this.targetRy = ry;
    this.isMoving = false;
    this.prevPos = new THREE.Vector3(x, y, z);

    // Build avatar
    this.mesh = this._createVoxelAvatar(color);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = ry;
    scene.add(this.mesh);

    // Name tag
    this._addNameTag(id.substring(0, 6));
  }

  /**
   * Build a Minecraft-style blocky character (matches local player)
   */
  _createVoxelAvatar(color) {
    const group = new THREE.Group();

    const skinColor = 0xc4956a;
    const shirtColor = new THREE.Color(color);
    const pantsColor = 0x3b5998;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), shirtMat);
    body.position.y = 1.22;
    body.castShadow = true;
    group.add(body);

    // Left arm
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), shirtMat);
    leftArm.position.set(-0.375, 1.2, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), shirtMat);
    rightArm.position.set(0.375, 1.2, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Left leg
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), pantsMat);
    leftLeg.position.set(-0.15, 0.5, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), pantsMat);
    rightLeg.position.set(0.15, 0.5, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Store refs for walk animation
    group.userData.leftArm = leftArm;
    group.userData.rightArm = rightArm;
    group.userData.leftLeg = leftLeg;
    group.userData.rightLeg = rightLeg;

    return group;
  }

  _addNameTag(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(28, 8, 200, 32, 8);
    ctx.fill();

    ctx.font = '500 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 30);

    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false
    }));
    sprite.position.y = 2.5;
    sprite.scale.set(2.2, 0.45, 1);
    this.mesh.add(sprite);
  }

  /**
   * Set the target state (from network update)
   */
  setTarget(x, y, z, ry) {
    this.prevPos.copy(this.targetPos);
    this.targetPos.set(x, y, z);
    this.targetRy = ry;
  }

  /**
   * Smoothly interpolate toward target each frame
   */
  update() {
    // Lerp position (including Y)
    this.mesh.position.x += (this.targetPos.x - this.mesh.position.x) * LERP_SPEED;
    this.mesh.position.y += (this.targetPos.y - this.mesh.position.y) * LERP_SPEED;
    this.mesh.position.z += (this.targetPos.z - this.mesh.position.z) * LERP_SPEED;

    // Lerp rotation (handle wraparound)
    let angleDiff = this.targetRy - this.mesh.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    this.mesh.rotation.y += angleDiff * LERP_SPEED;

    // Walk animation based on movement
    const dx = this.targetPos.x - this.prevPos.x;
    const dz = this.targetPos.z - this.prevPos.z;
    this.isMoving = Math.abs(dx) + Math.abs(dz) > 0.01;

    if (this.isMoving) {
      const walkTime = performance.now() * 0.006;
      const swing = Math.sin(walkTime) * 0.5;
      this.mesh.userData.leftArm.rotation.x = swing;
      this.mesh.userData.rightArm.rotation.x = -swing;
      this.mesh.userData.leftLeg.rotation.x = -swing;
      this.mesh.userData.rightLeg.rotation.x = swing;
    } else {
      this.mesh.userData.leftArm.rotation.x = 0;
      this.mesh.userData.rightArm.rotation.x = 0;
      this.mesh.userData.leftLeg.rotation.x = 0;
      this.mesh.userData.rightLeg.rotation.x = 0;
    }
  }

  /**
   * Remove from scene
   */
  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
