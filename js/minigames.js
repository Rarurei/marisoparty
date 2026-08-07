// ==============================
// minigames.js - 全10種ミニゲームのレジストリ(選択画面のサムネ情報を含む)
// ==============================
const ICONS = {
  sprint_dash: '🏃',
  coin_rush: '🪙',
  balance_island: '🌀',
  ball_roll: '⚪',
  chair_race: '🪑',
  target_blitz: '🎯',
  bounce_battle: '🤾',
  tug_of_war: '🪢',
  basket_toss: '🧺',
  field_soccer: '⚽',
};

function toRegistryEntry(GameClass) {
  const meta = GameClass.meta;
  return {
    ...meta,
    icon: ICONS[meta.id] || '🎮',
    GameClass,
  };
}

const ALL_MINIGAMES = [...SOLO_GAMES, ...TEAM_GAMES].map(toRegistryEntry);
const SOLO_MINIGAMES = ALL_MINIGAMES.filter(g => g.type === 'solo');
const TEAM_MINIGAMES = ALL_MINIGAMES.filter(g => g.type === 'team');

function getMinigame(id) {
  return ALL_MINIGAMES.find(g => g.id === id);
}

function hexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

function colorHexCss(colorInt) {
  return hexToCss(colorInt);
}
