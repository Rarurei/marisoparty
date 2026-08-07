// ==============================
// engine.js - 全ミニゲーム共通の土台
// ==============================
// ---------- 入力管理 ----------
class InputManager {
  constructor() {
    this.keys = new Set();
    this._down = (e) => this.keys.add(e.code);
    this._up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
  }
  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
  }
  get moveVector() {
    let x = 0, z = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    return { x, z };
  }
  get jumpPressed() { return this.keys.has('Space'); }
  get actionPressed() { return this.keys.has('KeyE') || this.keys.has('Space'); }
  get dashPressed() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  consumeJump() { this.keys.delete('Space'); }
}

// ---------- プレイヤー実体(人間/BOT共通) ----------
class GamePlayer {
  constructor({ charDef, isHuman, name, difficulty, team }) {
    this.charDef = charDef;
    this.isHuman = isHuman;
    this.name = name;
    this.team = team || null;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.radius = 0.42;
    this.grounded = true;
    this.alive = true;
    this.score = 0;
    this.rank = null;
    this.mesh = buildCharacterModel(charDef);
    this.animState = { t: Math.random() * 10, baseY: 0 };
    this.bot = isHuman ? null : new Bot(difficulty || '普通');
    this.baseSpeed = 5.4;
    this.baseAccel = 30;
    this.jumpPower = 9;
  }

  syncMesh() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.animState.baseY = this.position.y;
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    this.animState.moving = speed > 0.4;
    if (speed > 0.15) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, targetAngle, 0.25);
    }
  }

  tickAnim(dt) {
    animateCharacter(this.mesh, dt, this.animState);
  }
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ---------- 共通シーン構築 ----------
function createArenaLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.15);
  sun.position.set(12, 20, 8);
  sun.castShadow = true;
  // 影の解像度は軽量化のため程よいサイズに抑える(動作を軽くする対応)
  sun.shadow.mapSize.set(768, 768);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.far = 60;
  scene.add(sun);
  scene.background = new THREE.Color(0x8fd3f4);
  scene.fog = new THREE.Fog(0x8fd3f4, 25, 55);
  return { hemi, sun };
}

function createGroundCircle(scene, radius = 10, color = 0x6cc06c) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 48);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.5;
  mesh.receiveShadow = true;
  scene.add(mesh);
  // 縁取りリング
  const ringGeo = new THREE.TorusGeometry(radius, 0.18, 8, 48);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
  return mesh;
}

/**
 * チーム戦のプレイヤーにチームカラーの目印(足元リング+頭上バッジ)を付与する。
 * どちらのチームか一目でわかるようにするための表示。
 */
function addTeamMarker(p) {
  if (!p.team) return;
  const color = p.team === 'A' ? 0xe5473a : 0x3a7ce5;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.64, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  p.mesh.add(ring);

  const badge = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
  );
  badge.position.y = 2.0;
  p.mesh.add(badge);
}

/**
 * プレイヤーが「脱落済み/リタイア済み」で、これ以上操作対象にならないかどうかを判定する。
 * 落下したり早々にゴールしたりしたプレイヤーは、まだ続けている他プレイヤーを観戦する。
 */
function isPlayerDone(p) {
  return p.alive === false || p.finishedAt != null || p.rank != null;
}

/**
 * Mario Party風の斜め上から見下ろすカメラをセットアップ
 */
class OverheadCamera {
  constructor(camera, target = { x: 0, y: 0, z: 0 }, opts = {}) {
    this.camera = camera;
    this.offset = opts.offset || { x: 0, y: 13, z: 11 };
    this.target = target;
    this.lookOffset = opts.lookOffset || { x: 0, y: 0, z: 0 };
    this.smooth = opts.smooth ?? 0.08;
  }
  update(focusPoint) {
    const tx = focusPoint.x + this.offset.x;
    const ty = focusPoint.y + this.offset.y;
    const tz = focusPoint.z + this.offset.z;
    this.camera.position.x += (tx - this.camera.position.x) * this.smooth;
    this.camera.position.y += (ty - this.camera.position.y) * this.smooth;
    this.camera.position.z += (tz - this.camera.position.z) * this.smooth;
    this.camera.lookAt(focusPoint.x, focusPoint.y + 0.5, focusPoint.z);
  }
}

// ---------- 基底ミニゲームクラス ----------
class MiniGameBase {
  constructor(scene, players, input, opts = {}) {
    this.scene = scene;
    this.players = players; // GamePlayer[]
    this.input = input;
    this.opts = opts;
    this.elapsed = 0;
    this.finished = false;
    this.results = null;
    this.arenaRadius = 10;
    this.countdown = 3.2;
    this.started = false;
    this.hudText = '';
  }
  setup() { /* override */ }
  updateGame(dt) { /* override: ゲーム固有ロジック */ }

  update(dt) {
    if (this.countdown > 0) {
      this.countdown -= dt;
      // カウントダウン中も見た目は待機アニメーションさせる
      for (const p of this.players) { p.syncMesh(); p.tickAnim(dt); }
      if (this.countdown <= 0) this.started = true;
      return;
    }
    if (this.finished) return;
    this.elapsed += dt;
    this.updateGame(dt);
    for (const p of this.players) { p.syncMesh(); p.tickAnim(dt); }
  }

  finish(rankedPlayers) {
    this.finished = true;
    rankedPlayers.forEach((p, i) => { p.rank = i + 1; });
    this.results = rankedPlayers;
  }

  applyBasicPhysics(p, dt, opts = {}) {
    applyGravity(p, dt, opts.gravity);
    integrate(p, dt);
    groundCollision(p, opts.groundY ?? 0);
    applyFriction(p, dt, opts.friction ?? 6);
  }

  moveTowards(p, dirX, dirZ, dt, speedScale = 1, dash = false) {
    const mul = p.bot ? p.bot.speedMultiplier : 1;
    const dashMul = dash ? 1.55 : 1;
    p.dashing = !!dash;
    accelerateTowards(p, dirX, dirZ, p.baseAccel * dashMul, p.baseSpeed * speedScale * mul * dashMul, dt);
  }

  jump(p) { return tryJump(p, p.jumpPower); }
}
