/**
 * TypingRing - Adds the interactive transition ring to the lobby
 */
import * as THREE from 'three';

export class TypingRing {
    constructor(scene, localPlayer, socket) {
        this.scene = scene;
        this.localPlayer = localPlayer;
        this.socket = socket;
        
        // Location: North Portal (0, ground, -17)
        this.position = new THREE.Vector3(0, 1.05, -17);
        this.radius = 2.5;
        this.isActive = false;

        this._createVisuals();
    }

    _createVisuals() {
        // Glowing ring on ground
        const geo = new THREE.RingGeometry(this.radius - 0.2, this.radius, 64);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xffd700, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Add a subtle Cylinder for volume
        const cylGeo = new THREE.CylinderGeometry(this.radius, this.radius, 0.1, 32);
        const cylMat = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.1
        });
        this.volume = new THREE.Mesh(cylGeo, cylMat);
        this.volume.position.copy(this.position);
        this.scene.add(this.volume);

        // Add a point light to make it look important
        this.light = new THREE.PointLight(0xffd700, 5, 5);
        this.light.position.set(0, 2, -17);
        this.scene.add(this.light);
    }

    update(dt) {
        if (!this.localPlayer || !this.localPlayer.mesh) return;

        const dist = this.localPlayer.mesh.position.distanceTo(this.position);
        const inRing = dist < this.radius;

        if (inRing) {
            this.mesh.material.opacity = 1.0;
            this.light.intensity = 10;
            
            // Show prompt
            if (!this.isActive) {
                this._showPrompt("Waiting for opponent inside the circle...");
                this.isActive = true;
            }

            // In a real scenario, we'd wait for a socket event saying another player is here.
            // For now, let's allow "solo practice" or a quick delay to simulate "joining".
            // Implementation detail: we could emit 'standInRing' and wait for server to say 'matchFound'.
            // For this demo, we'll prompt the user to press a key or just wait 3 seconds.
            
            this.checkTimer = (this.checkTimer || 0) + dt;
            if (this.checkTimer > 3) {
                this._redirectToBattle();
            }
        } else {
            this.mesh.material.opacity = 0.5;
            this.light.intensity = 5;
            if (this.isActive) {
                this._hidePrompt();
                this.isActive = false;
                this.checkTimer = 0;
            }
        }

        // Animated pulse
        const scale = 1 + Math.sin(Date.now() * 0.005) * 0.05;
        this.mesh.scale.set(scale, scale, 1);
    }

    _showPrompt(text) {
        let el = document.getElementById('ring-prompt');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ring-prompt';
            el.style.position = 'fixed';
            el.style.bottom = '150px';
            el.style.left = '50%';
            el.style.transform = 'translateX(-50%)';
            el.style.padding = '15px 30px';
            el.style.background = 'rgba(0,0,0,0.8)';
            el.style.color = '#ffd700';
            el.style.borderRadius = '10px';
            el.style.fontFamily = "'Press Start 2P', monospace";
            el.style.fontSize = '0.7rem';
            el.style.zIndex = '1000';
            el.style.border = '2px solid #ffd700';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.style.display = 'block';
    }

    _hidePrompt() {
        const el = document.getElementById('ring-prompt');
        if (el) el.style.display = 'none';
    }

    _redirectToBattle() {
        const name = `Player-${Math.floor(Math.random() * 999)}`;
        window.location.href = `/typing-battle/index.html?room=north-portal-battle&name=${name}`;
    }
}
