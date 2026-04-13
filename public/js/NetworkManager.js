/**
 * NetworkManager - Handles authoritative server sync via Socket.io
 */
import { RemotePlayer } from './RemotePlayer.js';

export class NetworkManager {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.remotePlayers = new Map();
    this.selfId = null;
    this.onSnapshots = null;
  }

  connect() {
    return new Promise((resolve) => {
      this.socket = io();

      this.socket.on('init', (data) => {
        this.selfId = data.selfId;

        data.players.forEach(p => {
          if (p.id !== this.selfId) {
            this._addRemotePlayer(p);
          }
        });

        this._updateCount();
        resolve(data);
      });

      this.socket.on('playerJoined', (p) => {
        this._addRemotePlayer(p);
        this._updateCount();
      });

      this.socket.on('playerLeft', (id) => {
        const p = this.remotePlayers.get(id);
        if (p) {
          p.destroy();
          this.remotePlayers.delete(id);
        }
        this._updateCount();
      });

      // Authoritative tick from server
      this.socket.on('tick', (snapshots) => {
        if (this.onSnapshots) {
          this.onSnapshots(snapshots);
        }

        snapshots.forEach(s => {
          if (s.id !== this.selfId) {
            const p = this.remotePlayers.get(s.id);
            if (p) p.setTarget(s.x, s.y, s.z, s.ry);
          }
        });
      });
    });
  }

  _addRemotePlayer(p) {
    if (this.remotePlayers.has(p.id)) return;
    const remote = new RemotePlayer(this.scene, p.id, p.color, p.x, p.y, p.z, p.ry);
    this.remotePlayers.set(p.id, remote);
  }

  _updateCount() {
    const el = document.getElementById('count-text');
    if (el) el.textContent = `${this.remotePlayers.size + 1} Online`;
  }

  sendInput(data) {
    if (this.socket) {
      this.socket.emit('input', data);
    }
  }

  update() {
    this.remotePlayers.forEach(p => p.update());
  }
}
