// ==============================
// physics.js - 軽量物理演算エンジン
// 重力・摩擦・衝突・反発を担当するユーティリティ群
// ==============================

const GRAVITY = -22;

/**
 * 重力を速度に適用
 */
function applyGravity(entity, dt, g = GRAVITY) {
  if (!entity.grounded) {
    entity.velocity.y += g * dt;
  }
}

/**
 * 速度を積分して位置を更新
 */
function integrate(entity, dt) {
  entity.position.x += entity.velocity.x * dt;
  entity.position.y += entity.velocity.y * dt;
  entity.position.z += entity.velocity.z * dt;
}

/**
 * 地面(y=groundY平面)との衝突判定。地面がある場合はtrue
 */
function groundCollision(entity, groundY = 0) {
  const r = entity.radius || 0.5;
  if (entity.position.y - r <= groundY) {
    entity.position.y = groundY + r;
    if (entity.velocity.y < 0) entity.velocity.y = 0;
    entity.grounded = true;
    return true;
  }
  entity.grounded = false;
  return false;
}

/**
 * 円形(XZ平面)ステージ外に出たか判定し、出ていたら押し戻す/落下フラグを立てる
 * fenced=true なら壁で押し返す。falseなら範囲外で自由落下(=場外)扱いにできるよう戻り値で知らせる
 */
function circleBoundsCheck(entity, radius, fenced = true) {
  const dx = entity.position.x;
  const dz = entity.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > radius) {
    if (fenced) {
      const nx = dx / dist;
      const nz = dz / dist;
      entity.position.x = nx * radius;
      entity.position.z = nz * radius;
      const vDotN = entity.velocity.x * nx + entity.velocity.z * nz;
      entity.velocity.x -= vDotN * nx * 1.5;
      entity.velocity.z -= vDotN * nz * 1.5;
      return false;
    }
    return true; // 場外
  }
  return false;
}

/**
 * 摩擦(地上のみ)を適用して自然に減速させる
 */
function applyFriction(entity, dt, coef = 6) {
  if (entity.grounded) {
    const decay = Math.max(0, 1 - coef * dt);
    entity.velocity.x *= decay;
    entity.velocity.z *= decay;
  }
}

/**
 * 2つの球体(半径あり)の衝突を検出し、押し出し+速度交換(簡易反発)を行う
 */
function sphereSphereCollision(a, b, restitution = 0.6) {
  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  const dy = (b.position.y - a.position.y) * 0.3; // 縦方向は緩め
  const distSq = dx * dx + dz * dz + dy * dy;
  const minDist = (a.radius || 0.5) + (b.radius || 0.5);
  if (distSq < minDist * minDist && distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const overlap = minDist - dist;
    const nx = dx / dist;
    const nz = dz / dist;

    // 押し出し(質量均等)
    a.position.x -= nx * overlap * 0.5;
    a.position.z -= nz * overlap * 0.5;
    b.position.x += nx * overlap * 0.5;
    b.position.z += nz * overlap * 0.5;

    // 速度反発(簡易インパルス)。ぶつかる速度が速いほど、より大きく吹き飛ぶようにブーストする
    const relVX = b.velocity.x - a.velocity.x;
    const relVZ = b.velocity.z - a.velocity.z;
    const relDotN = relVX * nx + relVZ * nz;
    if (relDotN < 0) {
      const speedBoost = 1 + Math.min(1.4, Math.abs(relDotN) * 0.14);
      const impulse = -(1 + restitution) * relDotN * 0.5 * speedBoost;
      a.velocity.x -= impulse * nx;
      a.velocity.z -= impulse * nz;
      b.velocity.x += impulse * nx;
      b.velocity.z += impulse * nz;
    }
    return true;
  }
  return false;
}

/**
 * 静的な円柱障害物との衝突(玉転がしレースの障害物などに使用)
 * obstacle: { x, z, r }
 */
function staticCircleCollision(entity, obstacle, restitution = 1.3) {
  const dx = entity.position.x - obstacle.x;
  const dz = entity.position.z - obstacle.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const minDist = (entity.radius || 0.5) + obstacle.r;
  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const nz = dz / dist;
    const overlap = minDist - dist;
    entity.position.x += nx * overlap;
    entity.position.z += nz * overlap;
    const vDotN = entity.velocity.x * nx + entity.velocity.z * nz;
    if (vDotN < 0) {
      entity.velocity.x -= vDotN * nx * restitution;
      entity.velocity.z -= vDotN * nz * restitution;
    }
    return true;
  }
  return false;
}

/**
 * ジャンプ処理(接地時のみ有効)
 */
function tryJump(entity, power = 9) {
  if (entity.grounded) {
    entity.velocity.y = power;
    entity.grounded = false;
    return true;
  }
  return false;
}

/**
 * 目標方向に向けて加速(操作/AI共通で使用)
 */
function accelerateTowards(entity, dirX, dirZ, accel, maxSpeed, dt) {
  const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
  if (len > 0.0001) {
    dirX /= len;
    dirZ /= len;
    entity.velocity.x += dirX * accel * dt;
    entity.velocity.z += dirZ * accel * dt;
  }
  const speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.z ** 2);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    entity.velocity.x *= scale;
    entity.velocity.z *= scale;
  }
}

/**
 * 平面(傾斜つき)上の高さを求める - バランス系ミニゲーム用
 * plane: {tiltX, tiltZ, centerY}
 */
function heightOnTiltedPlane(plane, x, z) {
  return plane.centerY + x * plane.tiltX + z * plane.tiltZ;
}
