/**
 * Multiplayer Voxel Island Server — Flat Island
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import RAPIER from '@dimforge/rapier3d-compat';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(join(__dirname, 'public')));

const ISLAND_RADIUS = 20;
const CHUNK_SIZE = ISLAND_RADIUS * 2 + 1;
const heightMap = [];

function generateCircularIsland() {
  const center = ISLAND_RADIUS;
  for (let x = 0; x < CHUNK_SIZE; x++) {
    heightMap[x] = [];
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const dx = x - center;
      const dz = z - center;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Flat: 1 block if inside circle, 0 if outside
      heightMap[x][z] = dist <= ISLAND_RADIUS ? 1 : 0;
    }
  }
}

let world;
const characterControllers = new Map();
const players = new Map();
const GRAVITY = -20.0;

async function initPhysics() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0.0, y: GRAVITY, z: 0.0 });
  generateCircularIsland();

  const half = CHUNK_SIZE / 2;

  // Single flat slab collider for the island
  const islandCollider = RAPIER.ColliderDesc.cuboid(ISLAND_RADIUS + 0.5, 0.5, ISLAND_RADIUS + 0.5)
    .setTranslation(0, 0.5, 0);
  world.createCollider(islandCollider);

  // Pedestal collider (4x4, 3 tall, on top of island at y=1)
  const pedCollider = RAPIER.ColliderDesc.cuboid(2, 1.5, 2)
    .setTranslation(0, 1 + 1.5, 0);
  world.createCollider(pedCollider);

  // Portal pillar colliders at N/S/E/W
  const portalDist = ISLAND_RADIUS - 3;
  const pp = [
    { x: 0, z: -portalDist, ns: true },
    { x: portalDist, z: 0, ns: false },
    { x: 0, z: portalDist, ns: true },
    { x: -portalDist, z: 0, ns: false },
  ];
  for (const p of pp) {
    if (p.ns) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2.5, 0.5).setTranslation(p.x - 2, 3.5, p.z));
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2.5, 0.5).setTranslation(p.x + 2, p.z === 0 ? 3.5 : 3.5, p.z));
    } else {
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2.5, 0.5).setTranslation(p.x, 3.5, p.z - 2));
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2.5, 0.5).setTranslation(p.x, 3.5, p.z + 2));
    }
  }

  // Floor under water
  world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -1, 0));
}

const PLAYER_COLORS = [
  '#6b8e23','#8b4513','#556b2f','#b8860b',
  '#2e8b57','#8b0000','#4682b4','#6a5acd',
  '#cd853f','#2f4f4f','#a0522d','#708090',
];

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);
  const spawnX = 5 + (Math.random() - 0.5) * 4;
  const spawnZ = 5 + (Math.random() - 0.5) * 4;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawnX, 5, spawnZ)
  );
  world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.35), body);

  const controller = world.createCharacterController(0.1);
  controller.enableAutostep(0.5, 0.3, true);
  controller.enableSnapToGround(0.5);
  characterControllers.set(socket.id, controller);

  const pd = {
    id: socket.id, body,
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
    inputs: { w:false,a:false,s:false,d:false,shift:false },
    rotation: 0, velocity: { x:0,y:0,z:0 },
  };
  players.set(socket.id, pd);

  socket.emit('init', {
    selfId: socket.id, color: pd.color, heightMap, chunkSize: CHUNK_SIZE,
    islandRadius: ISLAND_RADIUS,
    players: Array.from(players.values()).map(p => {
      const t = p.body.translation();
      return { id:p.id, color:p.color, x:t.x, y:t.y, z:t.z, ry:p.rotation };
    })
  });
  socket.broadcast.emit('playerJoined', { id:socket.id, color:pd.color, x:spawnX, y:5, z:spawnZ, ry:0 });

  socket.on('input', (data) => { const p = players.get(socket.id); if(p){ p.inputs=data.keys; p.rotation=data.rotation; }});
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const p = players.get(socket.id);
    if(p){ world.removeRigidBody(p.body); players.delete(socket.id); }
    const c = characterControllers.get(socket.id);
    if(c){ world.removeCharacterController(c); characterControllers.delete(socket.id); }
    io.emit('playerLeft', socket.id);
  });
});

const DT = 1/60;
setInterval(() => {
  if(!world) return;
  players.forEach((p) => {
    const ctrl = characterControllers.get(p.id);
    if(!ctrl) return;
    const speed = p.inputs.shift ? 8 : 4.5;
    let mx=0,mz=0;
    const sin=Math.sin(p.rotation), cos=Math.cos(p.rotation);
    if(p.inputs.w){mx-=sin;mz-=cos;} if(p.inputs.s){mx+=sin;mz+=cos;}
    if(p.inputs.a){mx-=cos;mz+=sin;} if(p.inputs.d){mx+=cos;mz-=sin;}
    const len=Math.sqrt(mx*mx+mz*mz);
    if(len>0){mx=(mx/len)*speed*DT;mz=(mz/len)*speed*DT;}
    p.velocity.y+=GRAVITY*DT;
    if(p.velocity.y<-30)p.velocity.y=-30;
    if(ctrl.computedGrounded())p.velocity.y=0;
    const col=p.body.collider(0);
    if(col){
      ctrl.computeColliderMovement(col,{x:mx,y:p.velocity.y*DT,z:mz});
      const c=ctrl.computedMovement();
      const t=p.body.translation();
      p.body.setNextKinematicTranslation({x:t.x+c.x,y:t.y+c.y,z:t.z+c.z});
    }
  });
  world.step();
  const snap=Array.from(players.values()).map(p=>{const t=p.body.translation();return{id:p.id,x:t.x,y:t.y,z:t.z,ry:p.rotation};});
  if(snap.length>0)io.emit('tick',snap);
}, 1000/60);

const PORT = 3000;
initPhysics().then(() => {
  server.listen(PORT, () => { console.log(`\n  ⛏  VOXEL ISLAND LOBBY\n  ➜ http://localhost:${PORT}/\n`); });
});
