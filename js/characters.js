// ==============================
// characters.js - オリジナルキャラクター定義(10種)
// マリソパーティー独自デザイン。既存キャラクターとは無関係のオリジナル設定です。
// ==============================
const CHARACTERS = [
  { id: 'redko',   name: '紅葉あかり', color: 0xe5473a, sub: 0xffe9a8, accessory: 'star',      desc: '元気いっぱいのムードメーカー' },
  { id: 'aota',    name: '蒼田そうた', color: 0x3a7ce5, sub: 0xffffff, accessory: 'headband',   desc: '負けず嫌いなスポーツ少年' },
  { id: 'midorimi',name: '緑川みどり', color: 0x3aa855, sub: 0xffe9a8, accessory: 'leaf',       desc: '森育ちの物知り屋さん' },
  { id: 'kimaru',  name: '黄堂まると', color: 0xf0c419, sub: 0x8a5a2b, accessory: 'propeller',  desc: '発明好きなおっちょこちょい' },
  { id: 'pinkurin',name: '桃山りんね', color: 0xf07ec0, sub: 0xffffff, accessory: 'ribbon',     desc: 'おしゃれ大好きアイドル気質' },
  { id: 'purpleou',name: '紫苑けんと', color: 0x8a4fd1, sub: 0xffe9a8, accessory: 'wizardhat',  desc: '謎めいた魔法使い見習い' },
  { id: 'orenjo',  name: '橙川たすく', color: 0xf07d2b, sub: 0x5a3820, accessory: 'bandana',    desc: '力自慢の頑張り屋' },
  { id: 'cyanhime',name: '碧海ひめな', color: 0x2bd4d4, sub: 0xffe066, accessory: 'tiara',      desc: '涼しげな水の国のお姫様' },
  { id: 'yukishi', name: '雪村ゆきは', color: 0xf5f5f5, sub: 0x88c8ff, accessory: 'fluffhat',   desc: 'ふわふわマイペース屋さん' },
  { id: 'kagekuro',name: '黒羽かげと', color: 0x2b2b33, sub: 0xe5473a, accessory: 'mask',       desc: 'クールで俊敏な忍者気取り' },
];

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

/**
 * キャラクターの3Dモデル(簡易ローポリ)を生成
 * body: カプセル状(球+円柱), head: 球, accessory: キャラごとに変化
 */
function buildCharacterModel(charDef) {
  const group = new THREE.Group();
  group.name = 'char_' + charDef.id;

  const bodyMat = new THREE.MeshStandardMaterial({ color: charDef.color, roughness: 0.55, metalness: 0.05 });
  const subMat = new THREE.MeshStandardMaterial({ color: charDef.sub, roughness: 0.5, metalness: 0.05 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 });

  // 胴体
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 4, 10), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  // 首(頭と胴体の間の隙間を埋める)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 10), skinMat);
  neck.position.y = 1.03;
  group.add(neck);

  // 頭
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), skinMat);
  head.position.y = 1.28;
  head.castShadow = true;
  group.add(head);

  // 髪(キャラの色に合わせたベースヘア。アクセサリーの下から見えるように)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), subMat);
  hair.position.y = 1.34;
  hair.castShadow = true;
  group.add(hair);

  // 目・眉(表情)
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.12, 1.32, 0.29);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.12;
  group.add(eyeL, eyeR);
  const browGeo = new THREE.BoxGeometry(0.11, 0.025, 0.02);
  const browMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const browL = new THREE.Mesh(browGeo, browMat);
  browL.position.set(-0.12, 1.4, 0.3);
  const browR = browL.clone();
  browR.position.x = 0.12;
  group.add(browL, browR);

  // ほっぺ(かわいさ用のブラッシュ)
  const cheekGeo = new THREE.CircleGeometry(0.055, 10);
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xff9aa8, transparent: true, opacity: 0.55 });
  const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
  cheekL.position.set(-0.22, 1.22, 0.24);
  cheekL.rotation.y = -0.5;
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.22;
  cheekR.rotation.y = 0.5;
  group.add(cheekL, cheekR);

  // 手足(腕・脚をグループ化し、手/靴を先端に追従させる)
  const limbGeo = new THREE.CapsuleGeometry(0.09, 0.35, 4, 8);
  const handGeo = new THREE.SphereGeometry(0.1, 10, 10);
  const armL = new THREE.Group();
  armL.position.set(-0.42, 0.68, 0);
  armL.rotation.z = 0.35;
  const armLimbL = new THREE.Mesh(limbGeo, bodyMat);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.y = -0.28;
  armL.add(armLimbL, handL);
  const armR = new THREE.Group();
  armR.position.set(0.42, 0.68, 0);
  armR.rotation.z = -0.35;
  const armLimbR = new THREE.Mesh(limbGeo, bodyMat);
  const handR = handL.clone();
  armR.add(armLimbR, handR);
  group.add(armL, armR);

  const legGeo = new THREE.CapsuleGeometry(0.11, 0.32, 4, 8);
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.11, 0.24);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2f2f38, roughness: 0.6 });
  const legL = new THREE.Group();
  legL.position.set(-0.16, 0.2, 0);
  const legLimbL = new THREE.Mesh(legGeo, subMat);
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
  shoeL.position.set(0, -0.24, 0.05);
  legL.add(legLimbL, shoeL);
  const legR = new THREE.Group();
  legR.position.set(0.16, 0.2, 0);
  const legLimbR = new THREE.Mesh(legGeo, subMat);
  const shoeR = shoeL.clone();
  legR.add(legLimbR, shoeR);
  group.add(legL, legR);

  // アクセサリー(キャラ固有)
  const accGroup = new THREE.Group();
  accGroup.name = 'accessory';
  switch (charDef.accessory) {
    case 'star': {
      const star = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 5), subMat);
      star.position.set(0, 1.66, 0);
      accGroup.add(star);
      break;
    }
    case 'headband': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 16), subMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.4;
      accGroup.add(band);
      break;
    }
    case 'leaf': {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), subMat);
      leaf.position.set(0.1, 1.6, 0);
      leaf.rotation.z = 0.4;
      accGroup.add(leaf);
      break;
    }
    case 'propeller': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), subMat);
      cap.position.y = 1.35;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), subMat);
      stick.position.y = 1.7;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.06), subMat);
      blade.position.y = 1.8;
      blade.name = 'propellerBlade';
      accGroup.add(cap, stick, blade);
      break;
    }
    case 'ribbon': {
      const rL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 4), subMat);
      rL.position.set(-0.12, 1.55, 0);
      rL.rotation.z = 0.9;
      const rR = rL.clone();
      rR.position.x = 0.12;
      rR.rotation.z = -0.9;
      accGroup.add(rL, rR);
      break;
    }
    case 'wizardhat': {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 12), subMat);
      hat.position.y = 1.75;
      accGroup.add(hat);
      break;
    }
    case 'bandana': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16), subMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.32;
      accGroup.add(band);
      break;
    }
    case 'tiara': {
      const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 16, Math.PI), subMat);
      tiara.rotation.x = -Math.PI / 2;
      tiara.position.y = 1.5;
      accGroup.add(tiara);
      break;
    }
    case 'fluffhat': {
      const fluff = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), subMat);
      fluff.position.y = 1.42;
      fluff.scale.set(1, 0.6, 1);
      accGroup.add(fluff);
      break;
    }
    case 'mask': {
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), subMat);
      mask.position.set(0, 1.3, 0.28);
      accGroup.add(mask);
      break;
    }
  }
  group.add(accGroup);

  // アニメーション用の参照を保持
  group.userData.parts = { body, head, armL, armR, legL, legR, accGroup };
  // 影は主要パーツのみに限定して描画負荷を軽くする(動作を軽くする対応)
  group.traverse(o => { if (o.isMesh) o.castShadow = false; });
  [body, head, hair, armLimbL, armLimbR, legLimbL, legLimbR].forEach(m => { m.castShadow = true; });
  return group;
}

/**
 * 簡易な歩行/待機アニメーション(人間らしい揺れを加える)
 */
function animateCharacter(group, dt, state) {
  const p = group.userData.parts;
  if (!p) return;
  state.t = (state.t || 0) + dt;
  const moving = state.moving || false;
  const speedFactor = moving ? 8 : 2.2;
  const amp = moving ? 0.55 : 0.08;

  const swing = Math.sin(state.t * speedFactor) * amp;
  p.armL.rotation.x = swing;
  p.armR.rotation.x = -swing;
  p.legL.rotation.x = -swing * 0.9;
  p.legR.rotation.x = swing * 0.9;

  // 待機時の呼吸っぽい上下動
  const bob = moving ? Math.abs(Math.sin(state.t * speedFactor)) * 0.06 : Math.sin(state.t * 1.6) * 0.02;
  group.position.y = (state.baseY || 0) + bob;

  // プロペラなど回転パーツ
  const blade = p.accGroup && p.accGroup.getObjectByName && p.accGroup.getObjectByName('propellerBlade');
  if (blade) blade.rotation.y += dt * 10;
}
