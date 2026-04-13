/**
 * Player - Minecraft-style voxel avatar with 3rd person camera
 * WASD movement with player rotating to face direction of travel
 * Mouse controls camera orbit around the player
 */
import * as THREE from 'three';

const CAMERA_DISTANCE = 10;
const CAMERA_HEIGHT = 6;
const CAMERA_SMOOTH = 0.08;
const LERP_SPEED = 0.15;

// ─── Earthy color palette for player shirts ────────────
const SHIRT_COLORS = [
  0x6b8e23, // olive
  0x8b4513, // saddle brown
  0x556b2f, // dark olive green
  0xb8860b, // dark goldenrod
  0x2e8b57, // sea green
  0x8b0000, // dark red
  0x4682b4, // steel blue
  0x6a5acd, // slate blue
];

export class Player {
  constructor(scene, camera, color = '#5d9948') {
    this.scene = scene;
    this.camera = camera;

    // Visual state
    this.mesh = this._createVoxelAvatar(color);
    this.scene.add(this.mesh);

    // Server-authoritative position
    this.serverPos = new THREE.Vector3(0, 5, 0);

    // Input state
    this.keys = { w: false, a: false, s: false, d: false, shift: false };

    // Camera orbit angle (mouse-controlled)
    this.cameraAngle = 0;

    // Player facing direction (derived from movement)
    this.playerRotation = 0;

    this.cameraLookTarget = new THREE.Vector3();
    this.isMoving = false;

    this._setupInput();
  }

  /**
   * Build a Minecraft-style blocky character
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

  _setupInput() {
    window.addEventListener('keydown', (e) => this._handleKey(e.key, true));
    window.addEventListener('keyup', (e) => this._handleKey(e.key, false));

    // Mouse controls camera orbit
    window.addEventListener('mousemove', (e) => {
      this.cameraAngle -= e.movementX * 0.003;
    });

    // Pointer lock on click
    window.addEventListener('click', () => {
      document.body.requestPointerLock();
    });
  }

  _handleKey(key, isDown) {
    const k = key.toLowerCase();
    if (k in this.keys) this.keys[k] = isDown;
    if (key === 'Shift') this.keys.shift = isDown;
  }

  setServerState(x, y, z) {
    this.serverPos.set(x, y, z);
  }

  getInputState() {
    return {
      keys: this.keys,
      rotation: this.cameraAngle,
    };
  }

  update(dt) {
    // ─── Smooth lerp to server position ────────────────
    this.mesh.position.lerp(this.serverPos, LERP_SPEED);

    // ─── Determine movement direction and rotate player ─
    const moveDir = new THREE.Vector2(0, 0);
    if (this.keys.w) moveDir.y -= 1;
    if (this.keys.s) moveDir.y += 1;
    if (this.keys.a) moveDir.x -= 1;
    if (this.keys.d) moveDir.x += 1;

    this.isMoving = moveDir.length() > 0.01;

    if (this.isMoving) {
      // Calculate world-space movement direction based on camera angle
      const angle = Math.atan2(moveDir.x, moveDir.y) + this.cameraAngle;
      // Smoothly rotate player to face movement direction
      let angleDiff = angle - this.playerRotation;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      this.playerRotation += angleDiff * 0.15;
    }

    this.mesh.rotation.y = this.playerRotation;

    // ─── Walk animation ────────────────────────────────
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

    // ─── Camera 3rd person orbit follow ────────────────
    const idealOffset = new THREE.Vector3(
      Math.sin(this.cameraAngle) * CAMERA_DISTANCE,
      CAMERA_HEIGHT,
      Math.cos(this.cameraAngle) * CAMERA_DISTANCE
    );
    idealOffset.add(this.mesh.position);

    const idealLookAt = this.mesh.position.clone();
    idealLookAt.y += 1.5;

    this.camera.position.lerp(idealOffset, CAMERA_SMOOTH);
    this.cameraLookTarget.lerp(idealLookAt, CAMERA_SMOOTH);
    this.camera.lookAt(this.cameraLookTarget);
  }
}
