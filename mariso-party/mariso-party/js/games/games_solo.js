// ==============================
// games_solo.js - バトロワ系ミニゲーム(7種)
// ==============================
function laneX(i, n) {
  const spread = 8;
  return (i - (n - 1) / 2) * (spread / Math.max(1, n - 1 || 1));
}

// ============================================================
// 1. 全力ダッシュ (Sprint Dash) - ハードルジャンプレース
// ============================================================
class SprintDashGame extends MiniGameBase {
  static meta = { id: 'sprint_dash', name: '全力ダッシュ', type: 'solo', color: 0xe5473a, desc: 'ハードルを飛び越えて一番にゴールを目指せ!' };

  setup() {
    createArenaLighting(this.scene);
    const groundGeo = new THREE.BoxGeometry(14, 1, 42);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x7bd67b, roughness: 0.9 }));
    ground.position.set(0, -0.5, -12);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.startZ = 8;
    this.finishZ = -28;
    this.hurdleZs = [-2, -9, -16, -23];

    // ゴールライン表示
    const goalGeo = new THREE.BoxGeometry(14, 0.1, 0.4);
    const goal = new THREE.Mesh(goalGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    goal.position.set(0, 0.05, this.finishZ);
    this.scene.add(goal);

    this.hurdles = [];
    this.players.forEach((p, i) => {
      const x = laneX(i, this.players.length);
      p.position.x = x; p.position.y = 0.5; p.position.z = this.startZ;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.lane = x;
      p.hitHurdles = new Set();
      p.finishedAt = null;
      this.scene.add(p.mesh);

      this.hurdleZs.forEach((hz, hi) => {
        const geo = new THREE.BoxGeometry(1.6, 0.55, 0.25);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf0c419 }));
        mesh.position.set(x, 0.27, hz);
        this.scene.add(mesh);
        this.hurdles.push({ x, z: hz, id: `${i}_${hi}` });
      });
    });

    this.camera = { offset: { x: 0, y: 12, z: 9 } };
    this.finishOrder = [];
    this.timeLimit = 40;
  }

  updateGame(dt) {
    for (const p of this.players) {
      if (p.finishedAt !== null) continue;
      let moveX = 0, moveZ = -1, wantJump = false, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector;
        moveX = mv.x; moveZ = -1 + mv.z * 0.15;
        wantJump = this.input.jumpPressed;
        dash = this.input.dashPressed;
      } else {
        const action = p.bot.update(dt, (bot) => {
          const nearHurdle = this.hurdleZs.find(hz => Math.abs(p.position.z - hz) < 2.2 && p.position.z > hz);
          const jumpChance = bot.accuracy;
          // ハードル間の直線区間ではダッシュで加速する(賢いCPU)
          const wantDash = !nearHurdle || Math.abs(p.position.z - nearHurdle) > 1.6;
          return {
            moveX: (p.lane - p.position.x) * 0.6,
            moveZ: -1,
            wantJump: nearHurdle !== undefined && Math.abs(p.position.z - nearHurdle) < 1.4 && Math.random() < jumpChance,
            dash: wantDash && Math.random() < (0.5 + bot.accuracy * 0.4),
          };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; wantJump = action.wantJump; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 1.15, dash);
      if (wantJump) this.jump(p);
      this.applyBasicPhysics(p, dt, { groundY: 0 });

      // ハードル衝突
      for (const h of this.hurdles) {
        if (h.x !== p.lane) continue;
        if (Math.abs(p.position.z - h.z) < 0.5 && p.position.y < 0.95 && !p.hitHurdles.has(h.id)) {
          p.hitHurdles.add(h.id);
          p.velocity.z += 3.5;
          p.velocity.x += (Math.random() - 0.5) * 2;
        }
      }

      if (p.position.z <= this.finishZ && p.finishedAt === null) {
        p.finishedAt = this.elapsed;
        this.finishOrder.push(p);
      }
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    const running = this.players.filter(p => p.finishedAt === null);
    for (let i = 0; i < running.length; i++) {
      for (let j = i + 1; j < running.length; j++) sphereSphereCollision(running[i], running[j]);
    }

    if (this.finishOrder.length === this.players.length || this.elapsed > this.timeLimit) {
      const remaining = this.players.filter(p => !this.finishOrder.includes(p))
        .sort((a, b) => a.position.z - b.position.z);
      this.finish([...this.finishOrder, ...remaining]);
    }
  }
}

// ============================================================
// 2. コインラッシュ (Coin Rush) - 落ちてくるコインを集める
// ============================================================
class CoinRushGame extends MiniGameBase {
  static meta = { id: 'coin_rush', name: 'コインラッシュ', type: 'solo', color: 0xf0c419, desc: '降ってくるコインを誰よりも集めろ!' };

  setup() {
    createArenaLighting(this.scene);
    createGroundCircle(this.scene, 9, 0x6cc06c);
    this.timeLimit = 40;
    this.spawnTimer = 0;
    this.coins = [];

    this.players.forEach((p, i) => {
      const a = (i / this.players.length) * Math.PI * 2;
      p.position.x = Math.cos(a) * 4; p.position.y = 0.5; p.position.z = Math.sin(a) * 4;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.score = 0;
      this.scene.add(p.mesh);
    });
  }

  spawnCoin() {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 7.5;
    const golden = Math.random() < 0.15;
    const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);
    const mat = new THREE.MeshStandardMaterial({ color: golden ? 0xffd700 : 0xffe066, metalness: 0.6, roughness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(Math.cos(angle) * r, 8, Math.sin(angle) * r);
    this.scene.add(mesh);
    this.coins.push({ mesh, vy: 0, grounded: false, value: golden ? 3 : 1, landedAt: 0 });
  }

  updateGame(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.elapsed < this.timeLimit - 2) {
      this.spawnTimer = 0.55;
      this.spawnCoin();
    }

    for (const c of this.coins) {
      if (!c.grounded) {
        c.vy += -22 * dt;
        c.mesh.position.y += c.vy * dt;
        if (c.mesh.position.y <= 0.3) { c.mesh.position.y = 0.3; c.grounded = true; c.landedAt = this.elapsed; }
      } else {
        c.mesh.rotation.z += dt * 2;
      }
    }

    for (const p of this.players) {
      let moveX = 0, moveZ = 0, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z;
        dash = this.input.dashPressed;
      } else {
        let nearest = null, nd = Infinity;
        for (const c of this.coins) {
          if (c.collected) continue;
          const dx = c.mesh.position.x - p.position.x, dz = c.mesh.position.z - p.position.z;
          const d = dx * dx + dz * dz;
          if (d < nd) { nd = d; nearest = c; }
        }
        const action = p.bot.update(dt, (bot) => {
          if (!nearest) return { moveX: 0, moveZ: 0, dash: false };
          let seek = botSeekVector(bot, p.position.x, p.position.z, nearest.mesh.position.x, nearest.mesh.position.z);
          seek = keepDirectionInBounds(seek.x, seek.z, p.position.x, p.position.z, 8.7);
          return { moveX: seek.x, moveZ: seek.z, dash: botWantsDash(bot, Math.sqrt(nd)) };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 1, dash);
      this.applyBasicPhysics(p, dt, { groundY: 0 });
      circleBoundsCheck(p, 8.7, true);

      for (const c of this.coins) {
        if (c.collected || !c.grounded) continue;
        const dx = c.mesh.position.x - p.position.x, dz = c.mesh.position.z - p.position.z;
        if (dx * dx + dz * dz < 0.7 * 0.7) {
          c.collected = true;
          c.mesh.visible = false;
          p.score += c.value;
        }
      }
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) sphereSphereCollision(this.players[i], this.players[j]);
    }

    if (this.elapsed > this.timeLimit) {
      const ranked = [...this.players].sort((a, b) => b.score - a.score);
      this.finish(ranked);
    }
  }
}

// ============================================================
// 3. バランス島 (Balance Island) - 傾く島から落ちるな
// ============================================================
class BalanceIslandGame extends MiniGameBase {
  static meta = { id: 'balance_island', name: 'バランス島', type: 'solo', color: 0x3a7ce5, desc: '傾く島の上でバランスを保ち、最後まで生き残れ!' };

  setup() {
    createArenaLighting(this.scene);
    this.radius = 7;
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, 0.6, 40);
    this.platformMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a7ce5, roughness: 0.6 }));
    this.platformMesh.position.y = 0;
    this.platformMesh.receiveShadow = true;
    this.scene.add(this.platformMesh);

    this.plane = { tiltX: 0, tiltZ: 0, centerY: 0.3 };
    this.timeLimit = 55;
    this._wobbleT = 0;

    this.players.forEach((p, i) => {
      const a = (i / this.players.length) * Math.PI * 2;
      p.position.x = Math.cos(a) * 3; p.position.y = 0.6; p.position.z = Math.sin(a) * 3;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.alive = true;
      this.scene.add(p.mesh);
    });
  }

  updateGame(dt) {
    const alive = this.players.filter(p => p.alive);

    // 島の傾きを平均位置から計算(不安定さを増すため、常に揺らぎを加える)
    this._wobbleT += dt;
    let sumX = 0, sumZ = 0;
    for (const p of alive) { sumX += p.position.x; sumZ += p.position.z; }
    const n = Math.max(1, alive.length);
    const wobbleX = Math.sin(this._wobbleT * 0.9) * 0.12;
    const wobbleZ = Math.cos(this._wobbleT * 0.7) * 0.12;
    const targetTiltX = THREE.MathUtils.clamp(sumZ / n / this.radius + wobbleX, -0.5, 0.5);
    const targetTiltZ = THREE.MathUtils.clamp(-sumX / n / this.radius + wobbleZ, -0.5, 0.5);
    this.plane.tiltX += (targetTiltX - this.plane.tiltX) * 0.05;
    this.plane.tiltZ += (targetTiltZ - this.plane.tiltZ) * 0.05;
    this.platformMesh.rotation.x = this.plane.tiltX;
    this.platformMesh.rotation.z = -this.plane.tiltZ;

    for (const p of this.players) {
      if (!p.alive) { p.velocity.y -= 22 * dt; p.position.y += p.velocity.y * dt; p.syncMesh(); continue; }

      let moveX = 0, moveZ = 0, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z;
        dash = this.input.dashPressed;
      } else {
        const action = p.bot.update(dt, (bot) => {
          const dist = Math.sqrt(p.position.x ** 2 + p.position.z ** 2);
          // 中心寄りに戻ろうとするが、性格でブレ幅が変わる
          const pull = 0.7 + bot.personality.caution * 0.3;
          let seek = botSeekVector(bot, p.position.x, p.position.z, -p.position.x * pull, -p.position.z * pull);
          // 端に近いときはふらつきを抑えて確実に中心へ戻る(場外へ走ってしまうのを防ぐ)
          if (dist > this.radius * 0.7) {
            const inX = -p.position.x / (dist || 1), inZ = -p.position.z / (dist || 1);
            const edgeT = Math.min(1, (dist - this.radius * 0.7) / (this.radius * 0.3));
            seek = { x: seek.x * (1 - edgeT) + inX * edgeT, z: seek.z * (1 - edgeT) + inZ * edgeT };
          }
          return { moveX: seek.x, moveZ: seek.z };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 0.85, dash);

      // 傾斜による滑り(前より滑りやすくバランスを崩しやすくする)
      p.velocity.x += this.plane.tiltZ * 13 * dt;
      p.velocity.z -= this.plane.tiltX * 13 * dt;

      applyGravity(p, dt);
      integrate(p, dt);
      const floorY = heightOnTiltedPlane(this.plane, p.position.x, p.position.z) + 0.6;
      if (p.position.y <= floorY) { p.position.y = floorY; p.velocity.y = 0; p.grounded = true; }
      else { p.grounded = false; }
      applyFriction(p, dt, 2.2);

      const dist = Math.sqrt(p.position.x ** 2 + p.position.z ** 2);
      if (dist > this.radius) {
        p.alive = false;
      }
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    const stillAlive = this.players.filter(p => p.alive);
    for (let i = 0; i < stillAlive.length; i++) {
      for (let j = i + 1; j < stillAlive.length; j++) sphereSphereCollision(stillAlive[i], stillAlive[j]);
    }

    if (stillAlive.length <= 1 || this.elapsed > this.timeLimit) {
      const dead = this.players.filter(p => !p.alive);
      const ranked = [...stillAlive, ...dead.reverse()];
      this.finish(ranked);
    }
  }
}

// ============================================================
// 4. 玉転がしレース (Ball Roll Race)
// ============================================================
class BallRollGame extends MiniGameBase {
  static meta = { id: 'ball_roll', name: '玉転がしレース', type: 'solo', color: 0x8a4fd1, desc: '自分のボールを押しながらゴールまで転がそう!' };

  setup() {
    createArenaLighting(this.scene);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 40),
      new THREE.MeshStandardMaterial({ color: 0xd8c88a, roughness: 0.9 }));
    ground.position.set(0, -0.5, -10);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.finishZ = -26;
    this.timeLimit = 45;
    this.finishOrder = [];

    // 障害物(避けながらボールを運ぶ必要がある)
    this.obstacles = [
      { x: -3.2, z: -3, r: 0.9 }, { x: 3.4, z: -3, r: 0.9 },
      { x: 0, z: -8.5, r: 1.0 },
      { x: -4.5, z: -13.5, r: 0.9 }, { x: 4.5, z: -13.5, r: 0.9 },
      { x: 1.6, z: -18.5, r: 0.9 }, { x: -2.4, z: -18.5, r: 0.9 },
      { x: 0, z: -23, r: 1.0 },
    ];
    const obsMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 });
    this.obstacles.forEach(ob => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(ob.r, ob.r * 1.1, 1.6, 14), obsMat);
      mesh.position.set(ob.x, 0.8, ob.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
    });

    this.players.forEach((p, i) => {
      const x = laneX(i, this.players.length) * 1.4;
      p.position.x = x; p.position.y = 0.5; p.position.z = 10;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.lane = x;
      p.finishedAt = null;
      this.scene.add(p.mesh);

      const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16),
        new THREE.MeshStandardMaterial({ color: p.charDef.color, roughness: 0.4, metalness: 0.2 }));
      ballMesh.castShadow = true;
      ballMesh.position.set(x, 0.55, 8.5);
      this.scene.add(ballMesh);
      p.ball = { mesh: ballMesh, position: ballMesh.position, velocity: { x: 0, y: 0, z: 0 }, radius: 0.55, grounded: true };
    });
  }

  // 進行方向手前にある障害物を避けるための横方向バイアスを計算
  obstacleAvoidX(ball) {
    let avoid = 0;
    for (const ob of this.obstacles) {
      if (ob.z < ball.position.z && ob.z > ball.position.z - 6) {
        const dx = ball.position.x - ob.x;
        if (Math.abs(dx) < ob.r + 1.4) {
          const sign = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
          avoid += sign * 1.3;
        }
      }
    }
    return avoid;
  }

  updateGame(dt) {
    for (const p of this.players) {
      if (p.finishedAt !== null) continue;
      let moveX = 0, moveZ = -1, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = -1 + mv.z * 0.2;
        dash = this.input.dashPressed;
      } else {
        const avoidX = this.obstacleAvoidX(p.ball);
        const action = p.bot.update(dt, (bot) => {
          const seek = botSeekVector(bot, p.position.x, p.position.z, p.ball.position.x - (p.lane - p.ball.position.x) * 0.2, p.ball.position.z + 1.4);
          return { moveX: (p.lane - p.ball.position.x) * 0.5 + seek.x * 0.3 + avoidX, moveZ: -1, dash: Math.random() < 0.4 };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 1.05, dash);
      this.applyBasicPhysics(p, dt, { groundY: 0 });

      // ボールを押す
      const dx = p.ball.position.x - p.position.x;
      const dz = p.ball.position.z - p.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.1) {
        const push = 12;
        p.ball.velocity.x += (dx / (dist || 1)) * push * dt;
        p.ball.velocity.z += (dz / (dist || 1)) * push * dt + (-6) * dt;
      }
      // ボール物理
      applyGravity(p.ball, dt);
      integrate(p.ball, dt);
      groundCollision(p.ball, 0.55 - 0.55);
      p.ball.position.y = Math.max(p.ball.position.y, 0.55);
      applyFriction(p.ball, dt, 2.2);

      // 障害物との衝突(避けながら運ぶ必要がある)
      for (const ob of this.obstacles) {
        staticCircleCollision(p.ball, ob);
        staticCircleCollision(p, ob);
      }

      p.ball.mesh.position.set(p.ball.position.x, p.ball.position.y, p.ball.position.z);
      p.ball.mesh.rotation.x += p.ball.velocity.z * dt * -1;
      p.ball.mesh.rotation.z += p.ball.velocity.x * dt;

      if (p.ball.position.z <= this.finishZ && p.finishedAt === null) {
        p.finishedAt = this.elapsed;
        this.finishOrder.push(p);
      }
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    const running = this.players.filter(p => p.finishedAt === null);
    for (let i = 0; i < running.length; i++) {
      for (let j = i + 1; j < running.length; j++) sphereSphereCollision(running[i], running[j]);
    }

    if (this.finishOrder.length === this.players.length || this.elapsed > this.timeLimit) {
      const remaining = this.players.filter(p => !this.finishOrder.includes(p))
        .sort((a, b) => a.ball.position.z - b.ball.position.z);
      this.finish([...this.finishOrder, ...remaining]);
    }
  }
}

// ============================================================
// 5. イス取り合戦 (Chair Race) - 消えていく足場
// ============================================================
class ChairRaceGame extends MiniGameBase {
  static meta = { id: 'chair_race', name: 'イス取り合戦', type: 'solo', color: 0xf07ec0, desc: '踏むと1秒で崩れる床!最後まで残れるのは誰だ?' };

  setup() {
    createArenaLighting(this.scene);
    const cols = 10, rows = 10;
    const tileSize = 1.3, gap = 0.18;
    const step = tileSize + gap;
    this.tiles = [];

    // 100枚のタイルはInstancedMeshでまとめて描画し、負荷を軽く保つ
    const geo = new THREE.BoxGeometry(tileSize, 0.5, tileSize);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffb6d9, roughness: 0.7 });
    this.tileMesh = new THREE.InstancedMesh(geo, mat, cols * rows);
    this.tileMesh.receiveShadow = true;
    this.tileMesh.castShadow = false;
    this.scene.add(this.tileMesh);

    this.dummy = new THREE.Object3D();
    this.warnColor = new THREE.Color(0xffe066);
    this.goneColor = new THREE.Color(0x555555);
    this.idleColor = new THREE.Color(0xffb6d9);

    const originX = -((cols - 1) * step) / 2;
    const originZ = -((rows - 1) * step) / 2;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = originX + c * step;
        const z = originZ + r * step;
        this.dummy.position.set(x, 0.75, z);
        this.dummy.updateMatrix();
        this.tileMesh.setMatrixAt(idx, this.dummy.matrix);
        if (this.tileMesh.setColorAt) this.tileMesh.setColorAt(idx, this.idleColor);
        this.tiles.push({ idx, x, z, half: tileSize / 2, y: 0.75, state: 'idle', timer: 0 });
        idx++;
      }
    }
    this.tileMesh.instanceMatrix.needsUpdate = true;
    if (this.tileMesh.instanceColor) this.tileMesh.instanceColor.needsUpdate = true;

    this.timeLimit = 90;
    this.camera = { offset: { x: 0, y: 17, z: 13 } };

    // 4隅に離して配置(重ならないスタート地点)
    const cornerIdx = [11, 18, 81, 88];
    this.players.forEach((p, i) => {
      const t = this.tiles[cornerIdx[i % cornerIdx.length]];
      p.position.x = t.x; p.position.y = t.y + 0.25 + 0.5; p.position.z = t.z;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.alive = true;
      p.currentTile = t;
      this.scene.add(p.mesh);
    });
  }

  tileAt(x, z) {
    for (const t of this.tiles) {
      if (t.state === 'gone') continue;
      if (Math.abs(x - t.x) <= t.half && Math.abs(z - t.z) <= t.half) return t;
    }
    return null;
  }

  updateGame(dt) {
    // タイルの崩落タイマー更新(踏むと1秒で崩れ、沈みながら消える)
    let matrixDirty = false, colorDirty = false;
    for (const t of this.tiles) {
      if (t.state !== 'triggered') continue;
      t.timer -= dt;
      const sinkT = THREE.MathUtils.clamp(1 - Math.max(0, t.timer), 0, 1);
      const shakeAmt = Math.sin(this.elapsed * 45) * 0.035 * sinkT;
      this.dummy.position.set(t.x + shakeAmt, t.y - sinkT * 0.2, t.z);
      this.dummy.updateMatrix();
      this.tileMesh.setMatrixAt(t.idx, this.dummy.matrix);
      if (this.tileMesh.setColorAt) this.tileMesh.setColorAt(t.idx, this.warnColor);
      matrixDirty = true; colorDirty = true;
      if (t.timer <= 0) {
        t.state = 'gone';
        this.dummy.position.set(t.x, -6, t.z);
        this.dummy.updateMatrix();
        this.tileMesh.setMatrixAt(t.idx, this.dummy.matrix);
        if (this.tileMesh.setColorAt) this.tileMesh.setColorAt(t.idx, this.goneColor);
        matrixDirty = true; colorDirty = true;
      }
    }
    if (matrixDirty) this.tileMesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && this.tileMesh.instanceColor) this.tileMesh.instanceColor.needsUpdate = true;

    for (const p of this.players) {
      if (!p.alive) { p.velocity.y -= 22 * dt; p.position.y += p.velocity.y * dt; p.syncMesh(); continue; }
      let moveX = 0, moveZ = 0, wantJump = false, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z;
        wantJump = this.input.jumpPressed; dash = this.input.dashPressed;
      } else {
        const action = p.bot.update(dt, (bot) => {
          let target = p.currentTile;
          const dangerous = !target || target.state !== 'idle' || Math.random() < 0.02;
          if (dangerous) {
            const options = this.tiles.filter(t => t.state === 'idle')
              .sort((a, b) => {
                const da = (a.x - p.position.x) ** 2 + (a.z - p.position.z) ** 2;
                const db = (b.x - p.position.x) ** 2 + (b.z - p.position.z) ** 2;
                return da - db;
              });
            target = options[Math.floor(Math.random() * Math.min(4, options.length))] || target;
            p.currentTile = target;
          }
          if (!target) return { moveX: 0, moveZ: 0, wantJump: false, dash: false };
          const seek = botSeekVector(bot, p.position.x, p.position.z, target.x, target.z);
          return { moveX: seek.x, moveZ: seek.z, wantJump: Math.random() < 0.01, dash: true };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; wantJump = action.wantJump; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 0.95, dash);
      if (wantJump) this.jump(p);
      applyGravity(p, dt);
      integrate(p, dt);

      // 床判定(タイル1枚単位でしっかり判定する)
      const under = this.tileAt(p.position.x, p.position.z);
      const floorY = under ? under.y + 0.25 + 0.5 : -100;
      if (p.position.y <= floorY) {
        p.position.y = floorY; p.velocity.y = 0; p.grounded = true;
        if (under && under.state === 'idle') { under.state = 'triggered'; under.timer = 1.0; }
      } else {
        p.grounded = false;
      }
      applyFriction(p, dt, 5);

      if (p.position.y < -6) p.alive = false;
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    const stillAlive = this.players.filter(p => p.alive);
    for (let i = 0; i < stillAlive.length; i++) {
      for (let j = i + 1; j < stillAlive.length; j++) sphereSphereCollision(stillAlive[i], stillAlive[j]);
    }

    if (stillAlive.length <= 1 || this.elapsed > this.timeLimit) {
      const dead = this.players.filter(p => !p.alive);
      this.finish([...stillAlive, ...dead.reverse()]);
    }
  }
}

// ============================================================
// 6. 的当てバトル (Target Blitz)
// ============================================================
class TargetBlitzGame extends MiniGameBase {
  static meta = { id: 'target_blitz', name: '的当てバトル', type: 'solo', color: 0x2bd4d4, desc: '回転する的を狙って高得点を叩き出せ!' };

  setup() {
    createArenaLighting(this.scene);
    createGroundCircle(this.scene, 9, 0x9ad0f0);
    this.timeLimit = 40;
    this.targets = [];
    const positions = [{ x: 0, z: -8 }, { x: -7, z: 4 }, { x: 7, z: 4 }];
    positions.forEach(pos => {
      const group = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
      post.position.y = 1;
      group.add(post);
      const board = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      board.position.y = 2.3;
      const ring2 = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshStandardMaterial({ color: 0xe5473a, side: THREE.DoubleSide }));
      ring2.position.set(0, 2.3, 0.01);
      const bullseye = new THREE.Mesh(new THREE.CircleGeometry(0.35, 24), new THREE.MeshStandardMaterial({ color: 0xf0c419, side: THREE.DoubleSide }));
      bullseye.position.set(0, 2.3, 0.02);
      group.add(board, ring2, bullseye);
      group.position.set(pos.x, 0, pos.z);
      group.lookAt(0, 2.3, 0);
      this.scene.add(group);
      this.targets.push({ group, pos, center: new THREE.Vector3(pos.x, 2.3, pos.z) });
    });

    this.projectiles = [];
    this.targets.forEach(t => {
      t.baseX = t.pos.x; t.baseZ = t.pos.z;
      t.phase = Math.random() * Math.PI * 2;
      t.speed = 0.9 + Math.random() * 0.5;
      t.amp = 1.7;
      t.boostTimer = 0;
      // 中心(原点)方向に垂直な向きへスライドさせる
      const len = Math.hypot(t.baseX, t.baseZ) || 1;
      t.tangentX = -t.baseZ / len;
      t.tangentZ = t.baseX / len;
    });
    this.players.forEach((p, i) => {
      const a = (i / this.players.length) * Math.PI * 2;
      p.position.x = Math.cos(a) * 5.5; p.position.y = 0.5; p.position.z = Math.sin(a) * 5.5 + 6;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.score = 0;
      p._throwCooldown = 0;
      this.scene.add(p.mesh);
    });
  }

  nearestTarget(p) {
    let best = null, bd = Infinity;
    for (const t of this.targets) {
      const dx = t.pos.x - p.position.x, dz = t.pos.z - p.position.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  throwAt(p, target, accuracy) {
    const noise = (1 - accuracy) * 1.1;
    const aimX = target.center.x + (Math.random() - 0.5) * noise;
    const aimY = target.center.y + (Math.random() - 0.5) * noise;
    const aimZ = target.center.z + (Math.random() - 0.5) * noise * 0.3;
    const dx = aimX - p.position.x, dy = aimY - (p.position.y + 1.1), dz = aimZ - p.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    const speed = 9;
    const t = horizDist / speed;
    const vy = t > 0 ? (dy + 0.5 * 22 * t * t) / t : 4;
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    mesh.position.set(p.position.x, p.position.y + 1.1, p.position.z);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh, owner: p, target,
      velocity: { x: (dx / horizDist) * speed || 0, y: vy, z: (dz / horizDist) * speed || 0 },
      life: 3,
    });
  }

  updateGame(dt) {
    // 的を左右に動かす(当てると一時的に動きが速くなる)
    for (const t of this.targets) {
      if (t.boostTimer > 0) t.boostTimer -= dt;
      const amp = t.boostTimer > 0 ? t.amp * 1.8 : t.amp;
      const offset = Math.sin(this.elapsed * t.speed + t.phase) * amp;
      const nx = t.baseX + t.tangentX * offset;
      const nz = t.baseZ + t.tangentZ * offset;
      t.pos.x = nx; t.pos.z = nz;
      t.group.position.set(nx, 0, nz);
      t.group.lookAt(0, 2.3, 0);
      t.center.set(nx, 2.3, nz);
    }

    for (const p of this.players) {
      let moveX = 0, moveZ = 0, wantThrow = false;
      p._throwCooldown -= dt;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z;
        wantThrow = this.input.actionPressed && p._throwCooldown <= 0;
      } else {
        const action = p.bot.update(dt, (bot) => ({ moveX: Math.sin(this.elapsed + p.mesh.id) * 0.3, moveZ: Math.cos(this.elapsed * 0.7 + p.mesh.id) * 0.3, wantThrow: p._throwCooldown <= 0 && Math.random() < 0.5 }));
        if (action) { moveX = action.moveX; moveZ = action.moveZ; wantThrow = action.wantThrow; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 0.6);
      this.applyBasicPhysics(p, dt, { groundY: 0 });
      circleBoundsCheck(p, 8.5, true);

      if (wantThrow && p._throwCooldown <= 0) {
        const target = this.nearestTarget(p);
        const acc = p.isHuman ? 0.8 : p.bot.accuracy;
        this.throwAt(p, target, acc);
        p._throwCooldown = 0.9;
      }
    }

    for (const proj of this.projectiles) {
      proj.velocity.y -= 22 * dt;
      proj.mesh.position.x += proj.velocity.x * dt;
      proj.mesh.position.y += proj.velocity.y * dt;
      proj.mesh.position.z += proj.velocity.z * dt;
      proj.life -= dt;
      const dz = proj.mesh.position.z - proj.target.pos.z;
      if (Math.abs(dz) < 0.3 && !proj.scored) {
        proj.scored = true;
        const dist = proj.mesh.position.distanceTo(proj.target.center);
        let pts = 0;
        if (dist < 0.4) pts = 10; else if (dist < 0.9) pts = 5; else if (dist < 1.4) pts = 1;
        proj.owner.score += pts;
        if (pts > 0) proj.target.boostTimer = 1.5;
        proj.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter(pr => {
      if (pr.life <= 0 || pr.mesh.position.y < -2) { this.scene.remove(pr.mesh); return false; }
      return true;
    });

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) sphereSphereCollision(this.players[i], this.players[j]);
    }

    if (this.elapsed > this.timeLimit) {
      const ranked = [...this.players].sort((a, b) => b.score - a.score);
      this.finish(ranked);
    }
  }
}

// ============================================================
// 7. ジャンプ台合戦 (Bounce Battle) - トランポリン相撲
// ============================================================
class BounceBattleGame extends MiniGameBase {
  static meta = { id: 'bounce_battle', name: 'ジャンプ台合戦', type: 'solo', color: 0xf0c419, desc: 'トランポリンで跳ねながら相手を弾き飛ばせ!' };

  setup() {
    createArenaLighting(this.scene);
    this.radius = 6.2;
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, 0.6, 40);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.5 }));
    mesh.position.y = 0.7;
    this.scene.add(mesh);
    this.platformY = 1.0;
    this.timeLimit = 55;

    this.players.forEach((p, i) => {
      const a = (i / this.players.length) * Math.PI * 2;
      p.position.x = Math.cos(a) * 3; p.position.y = this.platformY + 0.5; p.position.z = Math.sin(a) * 3;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.alive = true;
      p.eliminatedAt = null;
      this.scene.add(p.mesh);
    });
  }

  updateGame(dt) {
    for (const p of this.players) {
      if (!p.alive) { p.velocity.y -= 22 * dt; p.position.y += p.velocity.y * dt; p.syncMesh(); continue; }
      let moveX = 0, moveZ = 0, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z; dash = this.input.dashPressed;
      } else {
        const others = this.players.filter(o => o !== p && o.alive);
        const target = others[0];
        const aggressive = p.bot.personality.aggression > 0.5;
        const action = p.bot.update(dt, (bot) => {
          if (target && aggressive) {
            const seek = botSeekVector(bot, p.position.x, p.position.z, target.position.x, target.position.z);
            return { moveX: seek.x, moveZ: seek.z, dash: true };
          }
          const seek = botSeekVector(bot, p.position.x, p.position.z, p.position.x * 0.3, p.position.z * 0.3);
          return { moveX: seek.x, moveZ: seek.z, dash: false };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, dash ? 1.6 : 1.0);

      const dist = Math.sqrt(p.position.x ** 2 + p.position.z ** 2);
      if (dist <= this.radius) {
        applyGravity(p, dt);
        integrate(p, dt);
        if (p.position.y <= this.platformY + 0.5) {
          p.position.y = this.platformY + 0.5;
          p.velocity.y = 7.5; // 自動トランポリン
          p.grounded = false;
        }
      } else {
        applyGravity(p, dt);
        integrate(p, dt);
        if (p.position.y < -6) p.alive = false;
      }
    }

    // プレイヤー同士の衝突(弾き飛ばし)
    const alive = this.players.filter(p => p.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        sphereSphereCollision(alive[i], alive[j], 0.9);
      }
    }

    const stillAlive = this.players.filter(p => p.alive);
    if (stillAlive.length <= 1 || this.elapsed > this.timeLimit) {
      const dead = this.players.filter(p => !p.alive);
      this.finish([...stillAlive, ...dead.reverse()]);
    }
  }
}

const SOLO_GAMES = [
  SprintDashGame, CoinRushGame, BalanceIslandGame, BallRollGame,
  ChairRaceGame, TargetBlitzGame, BounceBattleGame,
];
