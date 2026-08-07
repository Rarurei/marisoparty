// ==============================
// main.js - マリソパーティー本体
// 画面遷移(タイトル→BOT設定→キャラ選択→ミニゲーム選択→プレイ→結果)を管理
// ==============================
// ---------- グローバル状態 ----------
const state = {
  humanCharId: null,
  botCount: 2,
  botDifficulties: ['普通', '普通', '普通'],
  selectedMinigameId: null,
};

const screens = {};
document.querySelectorAll('.screen').forEach(el => { screens[el.dataset.screen] = el; });
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---------- タイトル画面 ----------
document.getElementById('btn-start').addEventListener('click', () => {
  showScreen('bot-setup');
});
document.getElementById('btn-howto').addEventListener('click', () => {
  document.getElementById('howto-modal').classList.add('open');
});
document.getElementById('howto-close').addEventListener('click', () => {
  document.getElementById('howto-modal').classList.remove('open');
});

// ---------- BOT設定画面 ----------
const botCountEl = document.getElementById('bot-count');
const botDiffContainer = document.getElementById('bot-diff-container');

function renderBotDiffUI() {
  botDiffContainer.innerHTML = '';
  const count = parseInt(botCountEl.value, 10);
  state.botCount = count;
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'bot-diff-row';
    const label = document.createElement('span');
    label.textContent = `BOT ${i + 1}`;
    row.appendChild(label);
    const group = document.createElement('div');
    group.className = 'diff-btn-group';
    DIFFICULTIES.forEach(diff => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diff-btn' + (state.botDifficulties[i] === diff ? ' active' : '');
      btn.textContent = diff;
      btn.addEventListener('click', () => {
        state.botDifficulties[i] = diff;
        [...group.children].forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
      });
      group.appendChild(btn);
    });
    row.appendChild(group);
    botDiffContainer.appendChild(row);
  }
}
botCountEl.addEventListener('input', renderBotDiffUI);
renderBotDiffUI();

document.getElementById('btn-to-charselect').addEventListener('click', () => {
  buildCharacterSelect();
  showScreen('char-select');
});
document.getElementById('btn-back-title-1').addEventListener('click', () => showScreen('title'));

// ---------- キャラクター選択画面 ----------
const charGrid = document.getElementById('char-grid');
let thumbRenderer, thumbScene, thumbCamera;

function initThumbRenderer() {
  const canvas = document.createElement('canvas');
  thumbRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  thumbRenderer.setSize(220, 220);
  thumbScene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x999999, 1.1);
  thumbScene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 6, 5);
  thumbScene.add(dir);
  thumbCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  thumbCamera.position.set(0, 1.35, 3.4);
  thumbCamera.lookAt(0, 0.9, 0);
}

function renderCharThumbnail(charDef) {
  const model = buildCharacterModel(charDef);
  thumbScene.add(model);
  thumbRenderer.render(thumbScene, thumbCamera);
  const dataUrl = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(model);
  return dataUrl;
}

function buildCharacterSelect() {
  if (!thumbRenderer) initThumbRenderer();
  charGrid.innerHTML = '';
  CHARACTERS.forEach(charDef => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.style.setProperty('--char-color', colorHexCss(charDef.color));

    const thumb = document.createElement('div');
    thumb.className = 'char-thumb';
    const img = document.createElement('img');
    img.src = renderCharThumbnail(charDef);
    thumb.appendChild(img);

    const name = document.createElement('div');
    name.className = 'char-name';
    name.textContent = charDef.name;

    const desc = document.createElement('div');
    desc.className = 'char-desc';
    desc.textContent = charDef.desc;

    card.appendChild(thumb);
    card.appendChild(name);
    card.appendChild(desc);
    card.addEventListener('click', () => {
      [...charGrid.children].forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.humanCharId = charDef.id;
      document.getElementById('btn-to-minigame').disabled = false;
    });
    charGrid.appendChild(card);
  });
}

document.getElementById('btn-back-bot-setup').addEventListener('click', () => showScreen('bot-setup'));
document.getElementById('btn-to-minigame').addEventListener('click', () => {
  buildMinigameSelect();
  showScreen('minigame-select');
});

// ---------- ミニゲーム選択画面 ----------
const soloGrid = document.getElementById('solo-grid');
const teamGrid = document.getElementById('team-grid');

function buildMinigameCard(meta) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.style.setProperty('--game-color', colorHexCss(meta.color));
  card.innerHTML = `
    <div class="game-thumb">
      <span class="game-icon">${meta.icon}</span>
    </div>
    <div class="game-body">
      <div class="game-name">${meta.name}</div>
      <div class="game-desc">${meta.desc}</div>
      <div class="game-tag">${meta.type === 'team' ? '👥 チーム戦' : '🔥 バトロワ'}</div>
    </div>
  `;
  card.addEventListener('click', () => startMinigame(meta.id));
  return card;
}

function buildMinigameSelect() {
  soloGrid.innerHTML = '';
  teamGrid.innerHTML = '';
  SOLO_MINIGAMES.forEach(m => soloGrid.appendChild(buildMinigameCard(m)));
  TEAM_MINIGAMES.forEach(m => teamGrid.appendChild(buildMinigameCard(m)));
}

document.getElementById('btn-back-charselect').addEventListener('click', () => showScreen('char-select'));

// ---------- ゲームプレイ ----------
const canvas = document.getElementById('game-canvas');
let renderer, scene, camera, overheadCam, input;
let currentGame = null;
let usedCharIds = [];
let players = [];

function initRendererOnce() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  // 動作を軽くするため、ピクセル比の上限を抑える
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 200);
  window.addEventListener('resize', onResize);
  onResize();
}
function onResize() {
  if (!renderer) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function pickRandomCharExcluding(excludeIds) {
  const pool = CHARACTERS.filter(c => !excludeIds.includes(c.id));
  const list = pool.length ? pool : CHARACTERS;
  return list[Math.floor(Math.random() * list.length)];
}

function buildPlayers(needTeam) {
  usedCharIds = [state.humanCharId];
  const humanChar = getCharacter(state.humanCharId);
  const list = [new GamePlayer({ charDef: humanChar, isHuman: true, name: humanChar.name })];

  let botTotal = state.botCount;
  const botDiffs = [...state.botDifficulties];
  if (needTeam) {
    // チーム戦は必ず4人。不足分はBOT(普通)で自動補充
    while (1 + botTotal < 4) { botDiffs[botTotal] = botDiffs[botTotal] || '普通'; botTotal++; }
    botTotal = Math.min(botTotal, 3);
  }

  for (let i = 0; i < botTotal; i++) {
    const cd = pickRandomCharExcluding(usedCharIds);
    usedCharIds.push(cd.id);
    list.push(new GamePlayer({ charDef: cd, isHuman: false, name: cd.name, difficulty: botDiffs[i] || '普通' }));
  }
  return list;
}

let loopToken = 0;
let isSpectating = false;

function startMinigame(id) {
  const meta = ALL_MINIGAMES.find(m => m.id === id);
  state.selectedMinigameId = id;
  initRendererOnce();
  const myToken = ++loopToken;

  scene = new THREE.Scene();
  input = new InputManager();
  players = buildPlayers(meta.type === 'team');

  currentGame = new meta.GameClass(scene, players, input);
  currentGame.setup();

  camera.position.set(0, 14, 12);
  const camOpts = currentGame.camera || {};
  overheadCam = new OverheadCamera(camera, { x: 0, y: 0, z: 0 }, camOpts);

  document.getElementById('hud-title').textContent = meta.name;
  document.getElementById('hud-controls').textContent = meta.type === 'team'
    ? '移動:WASD/矢印キー  アクション/タップ:スペース  ダッシュ:Shift'
    : '移動:WASD/矢印キー  ジャンプ/アクション:スペース  ダッシュ:Shift';

  showScreen('play');
  onResize();

  const clock = new THREE.Clock();
  clock.getDelta();
  function loop() {
    if (myToken !== loopToken || !currentGame) return; // 古いループは停止
    const dt = Math.min(clock.getDelta(), 0.05);
    currentGame.update(dt);
    const human = players[0];
    // 自分が脱落/ゴール済みでも他プレイヤーがまだ続けている場合は、その様子を観戦する
    let focus = human;
    isSpectating = false;
    if (!currentGame.finished && isPlayerDone(human)) {
      const alt = players.find(p => !isPlayerDone(p));
      if (alt) { focus = alt; isSpectating = true; }
    }
    overheadCam.update(focus.position);
    renderer.render(scene, camera);
    updateHUD();
    if (currentGame.finished && !currentGame._resultsShown) {
      currentGame._resultsShown = true;
      setTimeout(() => { if (myToken === loopToken) showResults(meta); }, 900);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function teamScoreValue(game, team) {
  if (!game) return null;
  if (game.baskets && game.baskets[team]) return game.baskets[team].score;
  if (game.score && typeof game.score[team] === 'number') return game.score[team];
  return null;
}

function updateHUD() {
  const hudTimer = document.getElementById('hud-timer');
  const hudCountdown = document.getElementById('hud-countdown');
  const hudTitle = document.getElementById('hud-title');
  if (currentGame.countdown > 0) {
    hudCountdown.style.display = 'flex';
    hudCountdown.textContent = currentGame.countdown > 1 ? Math.ceil(currentGame.countdown) : 'GO!';
  } else {
    hudCountdown.style.display = 'none';
  }
  if (currentGame.timeLimit) {
    const remain = Math.max(0, currentGame.timeLimit - currentGame.elapsed);
    hudTimer.textContent = `⏱ ${remain.toFixed(1)}s`;
  } else {
    hudTimer.textContent = '';
  }

  const meta = getMinigame(state.selectedMinigameId);
  hudTitle.textContent = (meta ? meta.name : '') + (isSpectating ? '(観戦中 👀)' : '');

  const scoreBoard = document.getElementById('hud-scoreboard');
  if (players[0] && players[0].team) {
    // チーム戦: どちらのチームかひと目でわかるように色分けして表示する
    const teamLabel = { A: 'チームA', B: 'チームB' };
    scoreBoard.innerHTML = ['A', 'B'].map(t => {
      const sc = teamScoreValue(currentGame, t);
      const members = players.filter(p => p.team === t).map(p => {
        const alive = p.alive === false ? ' style="opacity:0.4"' : '';
        return `<div class="hud-team-member"${alive}><span class="dot" style="background:${colorHexCss(p.charDef.color)}"></span>${p.name}</div>`;
      }).join('');
      return `<div class="hud-team-block team-${t.toLowerCase()}">
        <div class="hud-team-header">${teamLabel[t]}${sc !== null ? ` <b>${sc}</b>` : ''}</div>
        ${members}
      </div>`;
    }).join('');
  } else {
    scoreBoard.innerHTML = players
      .map(p => {
        const alive = p.alive === false ? ' style="opacity:0.4"' : '';
        const scoreTxt = (p.score !== undefined && p.score !== null) ? ` <b>${p.score}</b>` : '';
        return `<div class="hud-player"${alive}><span class="dot" style="background:${colorHexCss(p.charDef.color)}"></span>${p.name}${scoreTxt}</div>`;
      })
      .join('');
  }
}

document.getElementById('btn-quit-game').addEventListener('click', () => {
  quitToMinigameSelect();
});

function quitToMinigameSelect() {
  loopToken++;
  currentGame = null;
  if (input) input.dispose();
  showScreen('minigame-select');
}

// ---------- 結果画面 ----------
function showResults(meta) {
  const resultsList = document.getElementById('results-list');
  resultsList.innerHTML = '';
  const ranked = currentGame.results || players;
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  ranked.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    const teamTxt = p.team ? ` <span class="team-badge team-${p.team.toLowerCase()}">チーム${p.team}</span>` : '';
    const scoreTxt = (p.score !== undefined && p.score !== null && meta.type !== 'team') ? ` - スコア ${p.score}` : '';
    row.innerHTML = `<span class="medal">${medals[i] || (i + 1) + '位'}</span>
      <span class="dot" style="background:${colorHexCss(p.charDef.color)}"></span>
      <span class="result-name">${p.name}${teamTxt}${p.isHuman ? '(あなた)' : ''}</span>
      <span class="result-score">${scoreTxt}</span>`;
    resultsList.appendChild(row);
  });
  document.getElementById('results-title').textContent = `${meta.name} - けっか発表!`;
  showScreen('results');
  if (input) input.dispose();
}

document.getElementById('btn-retry').addEventListener('click', () => {
  startMinigame(state.selectedMinigameId);
});
document.getElementById('btn-back-minigame').addEventListener('click', () => {
  loopToken++;
  currentGame = null;
  buildMinigameSelect();
  showScreen('minigame-select');
});
document.getElementById('btn-back-title-2').addEventListener('click', () => {
  loopToken++;
  currentGame = null;
  showScreen('title');
});

showScreen('title');
