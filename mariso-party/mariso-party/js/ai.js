// ==============================
// ai.js - BOTの思考ルーチン
// 「弱い/普通/強い/たつじん」の4段階。単調にならないよう個性(パーソナリティ)を
// 個体ごとにランダム付与し、反応遅延・判断ノイズ・ミス率を変化させる。
// ==============================

const DIFFICULTIES = ['弱い', '普通', '強い', 'たつじん'];

const DIFFICULTY_PARAMS = {
  '弱い':     { reactMin: 0.55, reactMax: 1.05, accuracy: 0.42, mistakeRate: 0.35, speedMul: 0.80, decisionHz: 1.2, wander: 0.55 },
  '普通':     { reactMin: 0.30, reactMax: 0.55, accuracy: 0.65, mistakeRate: 0.20, speedMul: 0.95, decisionHz: 2.0, wander: 0.30 },
  '強い':     { reactMin: 0.15, reactMax: 0.30, accuracy: 0.85, mistakeRate: 0.08, speedMul: 1.05, decisionHz: 3.2, wander: 0.15 },
  'たつじん': { reactMin: 0.04, reactMax: 0.14, accuracy: 0.97, mistakeRate: 0.02, speedMul: 1.15, decisionHz: 5.0, wander: 0.06 },
};

let idCounter = 0;

class Bot {
  constructor(difficulty = '普通') {
    this.id = idCounter++;
    this.difficulty = difficulty;
    const p = DIFFICULTY_PARAMS[difficulty] || DIFFICULTY_PARAMS['普通'];
    this.params = p;

    // 個体差(パーソナリティ) - 同じ強さでも動きが単調にならないようにする
    this.personality = {
      aggression: rand(0.2, 1.0),      // 積極性
      caution: rand(0.1, 0.9),         // 慎重さ
      wanderPhase: rand(0, Math.PI * 2),
      wanderSeed: rand(1, 5),
      reactionOffset: rand(-0.05, 0.05),
    };

    this._decisionTimer = 0;
    this._currentTarget = { x: 0, z: 0 };
    this._nextActionAt = rand(p.reactMin, p.reactMax);
    this._timeSinceAction = 0;
    this._t = 0;
    this._pendingAction = null;
  }

  /**
   * 毎フレーム呼び出し、必要なら新しい行動を決定する。
   * decideFn(bot, dt) => { moveX, moveZ, wantJump, wantAction } を返すゲーム側のロジックを渡す
   */
  update(dt, decideFn) {
    this._t += dt;
    this._decisionTimer -= dt;
    if (this._decisionTimer <= 0) {
      // 反応遅延+個体差を加味して次の判断間隔を決める
      const p = this.params;
      this._decisionTimer = 1 / p.decisionHz + this.personality.reactionOffset + rand(-0.05, 0.05);
      this._pendingAction = decideFn(this, dt);

      // ミスをわざと発生させる(強さが低いほど方向がブレる)
      if (this._pendingAction && Math.random() < this.params.mistakeRate) {
        const noise = (1 - this.params.accuracy) * 2.5;
        this._pendingAction.moveX += rand(-noise, noise);
        this._pendingAction.moveZ += rand(-noise, noise);
      }
    }
    return this._pendingAction;
  }

  /**
   * ランダムなふらつき(自然な人間らしい揺れ)をベクトルに加える
   */
  addWander(dirX, dirZ) {
    const w = this.params.wander;
    const wx = Math.sin(this._t * this.personality.wanderSeed + this.personality.wanderPhase) * w;
    const wz = Math.cos(this._t * this.personality.wanderSeed * 0.8 + this.personality.wanderPhase) * w;
    return { x: dirX + wx, z: dirZ + wz };
  }

  get speedMultiplier() { return this.params.speedMul; }
  get accuracy() { return this.params.accuracy; }
}

function rand(min, max) { return min + Math.random() * (max - min); }

/**
 * 目標地点へ向かう基本移動ベクトルを計算するヘルパー(揺らぎ込み)
 */
function botSeekVector(bot, fromX, fromZ, toX, toZ) {
  let dx = toX - fromX;
  let dz = toZ - fromZ;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  dx /= len; dz /= len;
  const wandered = bot.addWander(dx, dz);
  const wlen = Math.sqrt(wandered.x ** 2 + wandered.z ** 2) || 1;
  return { x: wandered.x / wlen, z: wandered.z / wlen, distance: len };
}

/**
 * 円形ステージの縁に近いとき、移動ベクトルへ中心方向への引き戻しをブレンドする。
 * ふらつき(wander)が原因でBOTが場外へ向かって走ってしまう問題を防ぐための補正。
 */
function keepDirectionInBounds(dirX, dirZ, fromX, fromZ, arenaRadius, margin = 2.0) {
  const dist = Math.sqrt(fromX * fromX + fromZ * fromZ);
  const safeR = arenaRadius - margin;
  if (dist > safeR) {
    const t = Math.min(1, (dist - safeR) / margin);
    const inX = -fromX / (dist || 1);
    const inZ = -fromZ / (dist || 1);
    return { x: dirX * (1 - t) + inX * t, z: dirZ * (1 - t) + inZ * t };
  }
  return { x: dirX, z: dirZ };
}

/**
 * ダッシュ判断ヘルパー。難易度が高いほど的確なタイミングでダッシュを使う。
 */
function botWantsDash(bot, distanceToTarget, nearThreshold = 2.0) {
  if (distanceToTarget <= nearThreshold) return false; // 近距離では無駄遣いしない
  return Math.random() < (0.35 + bot.accuracy * 0.55);
}
