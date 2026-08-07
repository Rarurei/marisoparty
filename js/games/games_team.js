// ==============================
// games_team.js - チーム戦ミニゲーム(3種) 常に2vs2(計4人)
// ==============================
function assignTeams(players) {
  players.forEach((p, i) => { p.team = i % 2 === 0 ? 'A' : 'B'; addTeamMarker(p); });
}

// ============================================================
// 1. 綱引き対決 (Tug of War)
// ============================================================
class TugOfWarGame extends MiniGameBase {
  static meta = { id: 'tug_of_war', name: '綱引き対決', type: 'team', color: 0x8a5a2b, desc: 'タイミングよくタップして綱を引き寄せろ!' };

  setup() {
    createArenaLighting(this.scene);
    assignTeams(this.players);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 24), new THREE.MeshStandardMaterial({ color: 0x9ad6a0, roughness: 0.9 }));
    ground.position.set(0, -0.5, 0);
    this.scene.add(ground);

    const ropeGeo = new THREE.CylinderGeometry(0.08, 0.08, 20, 8);
    const rope = new THREE.Mesh(ropeGeo, new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    rope.rotation.x = Math.PI / 2;
    this.scene.add(rope);
    this.rope = rope;

    const markerGeo = new THREE.ConeGeometry(0.4, 0.8, 8);
    this.marker = new THREE.Mesh(markerGeo, new THREE.MeshStandardMaterial({ color: 0xe5473a }));
    this.marker.position.set(0, 0.4, 0);
    this.scene.add(this.marker);

    ['A', 'B'].forEach(team => {
      const lineGeo = new THREE.BoxGeometry(6, 0.06, 0.08);
      const line = new THREE.Mesh(lineGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
      line.position.set(0, 0.03, team === 'A' ? 5 : -5);
      this.scene.add(line);
    });

    let ai = 0, bi = 0;
    this.players.forEach((p) => {
      const idx = p.team === 'A' ? ai++ : bi++;
      p.position.x = (idx - 0.5) * 1.6;
      p.position.z = p.team === 'A' ? 2.5 : -2.5;
      p.position.y = 0.5;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.mesh.rotation.y = p.team === 'A' ? Math.PI : 0;
      this.scene.add(p.mesh);

      // タイミングゲージ(タップするタイミングを示すバー)を頭上に表示
      const gaugeGroup = new THREE.Group();
      gaugeGroup.position.set(0, 2.05, 0);
      gaugeGroup.rotation.x = -0.9;
      const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      const sweetZone = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.06), new THREE.MeshStandardMaterial({ color: 0x3ad65a, emissive: 0x1a5c2a, emissiveIntensity: 0.4 }));
      sweetZone.position.z = 0.01;
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.08), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
      marker.position.z = 0.02;
      gaugeGroup.add(barBg, sweetZone, marker);
      p.mesh.add(gaugeGroup);

      p._tug = {
        phase: Math.random() * Math.PI * 2,
        speed: 1.7 + Math.random() * 0.5,
        marker, wasPressed: false, flashT: 0,
      };
    });

    this.marker.position.z = 0;
    this.markerZ = 0;
    this.limit = 5.5;
    this.timeLimit = 25;
  }

  updateGame(dt) {
    let deltaZ = 0;
    for (const p of this.players) {
      const t = p._tug;
      const val = Math.sin(this.elapsed * t.speed + t.phase); // -1..1、0付近がジャストタイミング
      t.marker.position.x = val * 0.5;

      let pullPower = 0;
      let pulling = false;
      if (p.isHuman) {
        const held = this.input.actionPressed;
        if (held && !t.wasPressed) {
          const closeness = Math.abs(val);
          if (closeness < 0.15) pullPower = 2.2;
          else if (closeness < 0.4) pullPower = 1.1;
          else pullPower = 0.3;
          t.flashT = 0.18;
          pulling = true;
        }
        t.wasPressed = held;
      } else {
        const action = p.bot.update(dt, (bot) => {
          const closeness = Math.abs(val);
          const window = 0.12 + (1 - bot.accuracy) * 0.35; // 難易度が高いほど正確なタイミングで叩ける
          const willTap = closeness < window && Math.random() < (0.5 + bot.accuracy * 0.4);
          return { tap: willTap, closeness };
        });
        if (action && action.tap) {
          pullPower = action.closeness < 0.15 ? 2.0 : 1.0;
          t.flashT = 0.18;
          pulling = true;
        }
      }

      if (t.flashT > 0) { t.flashT -= dt; t.marker.material.color.set(0xffffff); }
      else { t.marker.material.color.set(0xffe066); }

      if (pullPower > 0) deltaZ += (p.team === 'A' ? 1 : -1) * pullPower;
      p.animState.moving = pulling;
      p.syncMesh();
    }

    this.markerZ = THREE.MathUtils.clamp(this.markerZ + deltaZ * 0.3, -this.limit - 1, this.limit + 1);
    this.marker.position.z = this.markerZ;
    this.rope.position.z = this.markerZ * 0.3;

    if (Math.abs(this.markerZ) >= this.limit || this.elapsed > this.timeLimit) {
      const winner = this.markerZ >= 0 ? 'A' : 'B';
      const ranked = [...this.players].sort((a, b) => (a.team === winner ? -1 : 1) - (b.team === winner ? -1 : 1));
      this.finish(ranked);
    }
  }
}

// ============================================================
// 2. 玉入れ対決 (Basket Toss)
// ============================================================
class BasketTossGame extends MiniGameBase {
  static meta = { id: 'basket_toss', name: '玉入れ対決', type: 'team', color: 0x2bd4d4, desc: '玉を拾って自分のチームのカゴに投げ入れろ!' };

  setup() {
    createArenaLighting(this.scene);
    assignTeams(this.players);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1, 40), new THREE.MeshStandardMaterial({ color: 0x9ad0f0, roughness: 0.9 }));
    ground.position.y = -0.5;
    this.scene.add(ground);

    this.baskets = {
      A: { x: 0, z: -8, score: 0 },
      B: { x: 0, z: 8, score: 0 },
    };
    for (const key of ['A', 'B']) {
      const b = this.baskets[key];
      const basketMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.8, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: key === 'A' ? 0xe5473a : 0x3a7ce5, side: THREE.DoubleSide }));
      basketMesh.position.set(b.x, 0.4, b.z);
      this.scene.add(basketMesh);
      b.mesh = basketMesh;
    }

    this.balls = [];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshStandardMaterial({ color: 0xf0c419 }));
      mesh.position.set(Math.cos(a) * r, 0.28, Math.sin(a) * r);
      this.scene.add(mesh);
      this.balls.push({ mesh, position: mesh.position, velocity: { x: 0, y: 0, z: 0 }, radius: 0.28, held: null, cooldown: 0 });
    }

    let ai = 0, bi = 0;
    this.players.forEach((p) => {
      const idx = p.team === 'A' ? ai++ : bi++;
      p.position.x = (idx - 0.5) * 2;
      p.position.z = p.team === 'A' ? -3 : 3;
      p.position.y = 0.5;
      p.velocity = { x: 0, y: 0, z: 0 };
      p.holding = null;
      this.scene.add(p.mesh);
    });

    this.timeLimit = 35;
  }

  updateGame(dt) {
    for (const p of this.players) {
      const basket = this.baskets[p.team];
      let moveX = 0, moveZ = 0, wantAction = false, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z;
        wantAction = this.input.actionPressed;
        dash = this.input.dashPressed;
      } else {
        const action = p.bot.update(dt, (bot) => {
          if (p.holding) {
            const seek = botSeekVector(bot, p.position.x, p.position.z, basket.x, basket.z);
            const dist = Math.hypot(basket.x - p.position.x, basket.z - p.position.z);
            return { moveX: seek.x, moveZ: seek.z, wantAction: dist < 3.5, dash: dist > 3 };
          }
          const freeBalls = this.balls.filter(b => !b.held);
          let nearest = null, nd = Infinity;
          for (const b of freeBalls) {
            const d = (b.position.x - p.position.x) ** 2 + (b.position.z - p.position.z) ** 2;
            if (d < nd) { nd = d; nearest = b; }
          }
          if (!nearest) return { moveX: 0, moveZ: 0, dash: false };
          const seek = botSeekVector(bot, p.position.x, p.position.z, nearest.position.x, nearest.position.z);
          return { moveX: seek.x, moveZ: seek.z, dash: botWantsDash(bot, Math.sqrt(nd)) };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; wantAction = action.wantAction; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 0.95, dash);
      this.applyBasicPhysics(p, dt, { groundY: 0 });
      circleBoundsCheck(p, 9.4, true);

      if (!p.holding) {
        for (const b of this.balls) {
          if (b.held || b.cooldown > 0) continue;
          const d = Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z);
          if (d < 0.7) { b.held = p; p.holding = b; break; }
        }
      } else if (wantAction) {
        const b = p.holding;
        const dist = Math.hypot(basket.x - p.position.x, basket.z - p.position.z);
        const speed = 7;
        const t = Math.max(0.35, dist / speed);
        const startY = p.position.y + 0.9;
        const targetY = 0.5;
        b.velocity.x = (basket.x - p.position.x) / t;
        b.velocity.z = (basket.z - p.position.z) / t;
        // 重力を考慮した正しい放物線になるよう縦速度を計算(以前は的から外れやすかった)
        b.velocity.y = ((targetY - startY) + 0.5 * 22 * t * t) / t;
        b.held = null;
        b.thrownBy = p.team;
        b.cooldown = 2;
        p.holding = null;
      }

      if (p.holding) {
        p.holding.position.x = p.position.x;
        p.holding.position.y = p.position.y + 0.9;
        p.holding.position.z = p.position.z;
      }
    }

    for (const b of this.balls) {
      if (b.cooldown > 0) b.cooldown -= dt;
      if (!b.held) {
        applyGravity(b, dt);
        integrate(b, dt);
        if (b.position.y <= 0.28) {
          // 着地したら止める(以前は摩擦が効かず転がり続けて的を外していた)
          b.position.y = 0.28; b.velocity.x = 0; b.velocity.y = 0; b.velocity.z = 0;
          if (!b.scored && b.thrownBy) {
            for (const key of ['A', 'B']) {
              const bas = this.baskets[key];
              const d = Math.hypot(bas.x - b.position.x, bas.z - b.position.z);
              if (d < 1.1 && b.thrownBy === key) {
                bas.score += 1;
                b.scored = true;
                b.mesh.visible = false;
              }
            }
          }
        }
      }
      b.mesh.position.set(b.position.x, b.position.y, b.position.z);
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) sphereSphereCollision(this.players[i], this.players[j]);
    }

    // HUDにスコアを表示するため、チームスコアを各プレイヤーへ反映
    for (const p of this.players) p.score = this.baskets[p.team].score;

    if (this.elapsed > this.timeLimit) {
      const winner = this.baskets.A.score >= this.baskets.B.score ? 'A' : 'B';
      const ranked = [...this.players].sort((a, b2) => (a.team === winner ? -1 : 1) - (b2.team === winner ? -1 : 1));
      this.finish(ranked);
    }
  }
}

// ============================================================
// 3. フィールドサッカー (Field Soccer) 2vs2
// ============================================================
class FieldSoccerGame extends MiniGameBase {
  static meta = { id: 'field_soccer', name: 'フィールドサッカー', type: 'team', color: 0x3aa855, desc: '2対2でボールを追いかけ、ゴールを決めろ!' };

  setup() {
    createArenaLighting(this.scene);
    assignTeams(this.players);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 26), new THREE.MeshStandardMaterial({ color: 0x4fbf6b, roughness: 0.9 }));
    ground.position.y = -0.5;
    this.scene.add(ground);
    this.bounds = { x: 6.7, zMin: -12.7, zMax: 12.7 };
    this.goalWidth = 3;

    ['A', 'B'].forEach(team => {
      const z = team === 'A' ? this.bounds.zMax : this.bounds.zMin;
      const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const g = new THREE.Group();
      const barGeo = new THREE.BoxGeometry(this.goalWidth * 2, 0.15, 0.15);
      const bar = new THREE.Mesh(barGeo, postMat);
      bar.position.set(0, 1.8, 0);
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 0.15), postMat);
      postL.position.set(-this.goalWidth, 0.9, 0);
      const postR = postL.clone(); postR.position.x = this.goalWidth;
      g.add(bar, postL, postR);
      g.position.set(0, 0, z);
      this.scene.add(g);
    });

    this.ball = {
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 14), new THREE.MeshStandardMaterial({ color: 0xffffff })),
      position: { x: 0, y: 0.4, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, radius: 0.4,
    };
    this.scene.add(this.ball.mesh);
    this.score = { A: 0, B: 0 };
    this.timeLimit = 60;

    let ai = 0, bi = 0;
    this.players.forEach(p => {
      const idx = p.team === 'A' ? ai++ : bi++;
      p.position.x = (idx - 0.5) * 3;
      p.position.z = p.team === 'A' ? 6 : -6;
      p.position.y = 0.5;
      p.velocity = { x: 0, y: 0, z: 0 };
      this.scene.add(p.mesh);
    });
  }

  resetBall() {
    this.ball.position = { x: 0, y: 0.4, z: 0 };
    this.ball.velocity = { x: 0, y: 0, z: 0 };
  }

  updateGame(dt) {
    for (const p of this.players) {
      const opponentGoalZ = p.team === 'A' ? this.bounds.zMin : this.bounds.zMax;
      let moveX = 0, moveZ = 0, dash = false;
      if (p.isHuman) {
        const mv = this.input.moveVector; moveX = mv.x; moveZ = mv.z;
        dash = this.input.dashPressed;
      } else {
        const dBall = Math.hypot(this.ball.position.x - p.position.x, this.ball.position.z - p.position.z);
        const action = p.bot.update(dt, (bot) => {
          let tx, tz;
          if (dBall < 5 || bot.personality.aggression > 0.6) {
            tx = this.ball.position.x; tz = this.ball.position.z;
          } else {
            tx = this.ball.position.x * 0.4; tz = p.team === 'A' ? p.position.z : p.position.z; // 守備寄り待機
          }
          const seek = botSeekVector(bot, p.position.x, p.position.z, tx, tz);
          return { moveX: seek.x, moveZ: seek.z, dash: botWantsDash(bot, dBall, 1.2) };
        });
        if (action) { moveX = action.moveX; moveZ = action.moveZ; dash = action.dash; }
      }
      this.moveTowards(p, moveX, moveZ, dt, 1.05, dash);
      this.applyBasicPhysics(p, dt, { groundY: 0 });
      p.position.x = THREE.MathUtils.clamp(p.position.x, -this.bounds.x, this.bounds.x);
      p.position.z = THREE.MathUtils.clamp(p.position.z, this.bounds.zMin, this.bounds.zMax);

      // ボールを蹴る
      const dx = this.ball.position.x - p.position.x, dz = this.ball.position.z - p.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.9) {
        const kickDirX = dx / (d || 1), kickDirZ = (opponentGoalZ - p.position.z) > 0 ? Math.abs(dz / (d || 1)) : -Math.abs(dz / (d || 1));
        const power = 8.5;
        this.ball.velocity.x += (kickDirX * 0.5 + Math.sign(opponentGoalZ) * 0.5) * power * dt * 12;
        this.ball.velocity.z += Math.sign(opponentGoalZ - p.position.z) * power * dt * 12;
      }
    }

    // プレイヤー同士がぶつかると吹き飛ぶ(速いほど吹き飛びが大きい)
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) sphereSphereCollision(this.players[i], this.players[j]);
    }

    // ボール物理
    applyGravity(this.ball, dt, -22);
    integrate(this.ball, dt);
    if (this.ball.position.y <= 0.4) { this.ball.position.y = 0.4; this.ball.velocity.y = Math.abs(this.ball.velocity.y) * 0.3; }
    applyFriction(this.ball, dt, 1.4);
    if (Math.abs(this.ball.position.x) > this.bounds.x) {
      this.ball.position.x = Math.sign(this.ball.position.x) * this.bounds.x;
      this.ball.velocity.x *= -0.5;
    }
    this.ball.mesh.position.set(this.ball.position.x, this.ball.position.y, this.ball.position.z);

    // ゴール判定(zMaxはチームAの自陣ゴール、zMinはチームBの自陣ゴール→相手が決めたら加点)
    if (this.ball.position.z > this.bounds.zMax - 0.3 && Math.abs(this.ball.position.x) < this.goalWidth) {
      this.score.B += 1; this.resetBall();
    } else if (this.ball.position.z < this.bounds.zMin + 0.3 && Math.abs(this.ball.position.x) < this.goalWidth) {
      this.score.A += 1; this.resetBall();
    } else if (this.ball.position.z > this.bounds.zMax || this.ball.position.z < this.bounds.zMin) {
      this.ball.velocity.z *= -0.5;
      this.ball.position.z = THREE.MathUtils.clamp(this.ball.position.z, this.bounds.zMin, this.bounds.zMax);
    }

    // HUDにスコアを表示するため、チームスコアを各プレイヤーへ反映
    for (const p of this.players) p.score = this.score[p.team];

    if (this.elapsed > this.timeLimit) {
      const winner = this.score.A >= this.score.B ? 'A' : 'B';
      const ranked = [...this.players].sort((a, b) => (a.team === winner ? -1 : 1) - (b.team === winner ? -1 : 1));
      this.finish(ranked);
    }
  }
}

const TEAM_GAMES = [TugOfWarGame, BasketTossGame, FieldSoccerGame];
