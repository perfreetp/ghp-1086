export type GameType = 'buzz' | 'colorTrap' | 'trueFalse' | 'rhythm';

export type GameMode = 'score' | 'elimination';

export type RoomStatus = 'waiting' | 'playing' | 'result';

export type GamePhase = 'countdown' | 'playing' | 'ended';

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  isHost: boolean;
  isSpectator: boolean;
  score: number;
  isOnline: boolean;
  eliminated: boolean;
  socketId: string;
  lastActionTime?: number;
}

export interface GameConfig {
  type: GameType;
  rounds: number;
  mode: GameMode;
  roundTime: number;
}

export interface RoomSettings {
  misTouchSensitivity: number;
  countdownDuration: number;
  autoStart: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  currentGame: GameType | null;
  gameConfig: GameConfig | null;
  gameState: any;
  totalRounds: number;
  currentRound: number;
  scores: Record<string, number>;
  roundScores: Record<string, number>[];
  isPaused: boolean;
  pauseStartedAt?: number;
  pauseAccumulatedMs: number;
  soundEnabled: boolean;
  settings: RoomSettings;
  createdAt: number;
  replayData: ReplayEvent[];
  punishmentAssignments: PunishmentAssignment[];
}

export interface PunishmentAssignment {
  playerId: string;
  playerName: string;
  card: PunishmentCard;
  drawnAt: number;
}

export interface ReplayEvent {
  type: string;
  playerId: string;
  timestamp: number;
  data: any;
}

export interface PunishmentCard {
  id: number;
  title: string;
  content: string;
  icon: string;
}

// Buzz Game Types
export interface BuzzQuestion {
  id: number;
  text: string;
  image?: string;
  category: string;
  answerTime?: number;
}

export interface BuzzGameState {
  phase: GamePhase;
  question: BuzzQuestion | null;
  buzzerPressed: Record<string, number>;
  answered: string[];
  correctAnswer?: string;
  misTouchPlayers: string[];
  countdown: number;
  roundStartTime?: number;
  activeBuzzer?: string;
}

// Color Trap Game Types
export interface ColorTrapQuestion {
  word: string;
  displayColor: string;
  correctAnswer: 'match' | 'mismatch';
}

export interface ColorTrapGameState {
  phase: GamePhase;
  question: ColorTrapQuestion | null;
  answers: Record<string, { answer: 'match' | 'mismatch'; time: number; correct: boolean }>;
  countdown: number;
}

// True/False Button Game Types
export interface TrueFalseButton {
  id: number;
  isReal: boolean;
  x: number;
  y: number;
  size: number;
  label: string;
}

export interface TrueFalseGameState {
  phase: GamePhase;
  buttons: TrueFalseButton[];
  clicked: Record<string, { buttonId: number; time: number }[]>;
  scores: Record<string, number>;
  countdown: number;
}

// Rhythm Game Types
export interface RhythmNote {
  id: number;
  lane: number;
  startTime: number;
  hit: boolean;
}

export interface RhythmGameState {
  phase: GamePhase;
  notes: RhythmNote[];
  hits: Record<string, { noteId: number; judgment: 'perfect' | 'good' | 'miss'; time: number }[]>;
  bpm: number;
  countdown: number;
  startTime?: number;
}

export interface RoundResult {
  round: number;
  gameType: GameType;
  rankings: {
    playerId: string;
    rank: number;
    score: number;
    correct?: number;
    total?: number;
  }[];
  eliminated?: string[];
}

export interface FinalResult {
  totalRounds: number;
  rankings: {
    playerId: string;
    nickname: string;
    avatar: string;
    totalScore: number;
    roundsWon: number;
  }[];
  punishments: PunishmentAssignment[];
}

export const AVATARS = [
  '🦊', '🐼', '🦁', '🐯', '🐻', '🐨', '🐵', '🐸',
  '🦄', '🐲', '🦖', '🐙', '🦀', '🐠', '🦋', '🐝',
  '🌸', '🌺', '🌻', '🌹', '⭐', '🌙', '🔥', '💎',
  '🎮', '🎯', '🎨', '🎭', '🎪', '🎸', '🏆', '👑'
];

export const PUNISHMENT_CARDS: PunishmentCard[] = [
  { id: 1, title: '真心话', content: '在场所有人都可以问你一个问题，必须如实回答！', icon: '💬' },
  { id: 2, title: '大冒险', content: '完成一个其他人指定的大胆挑战！', icon: '🎲' },
  { id: 3, title: '才艺表演', content: '唱一首歌、跳一支舞或表演一个才艺！', icon: '🎤' },
  { id: 4, title: '模仿秀', content: '模仿一位在场的朋友，让大家猜是谁！', icon: '🎭' },
  { id: 5, title: '表情包', content: '做五个最丑的鬼脸，拍照留念！', icon: '😜' },
  { id: 6, title: '罚酒一杯', content: '干杯！喝完这杯！（非酒精饮料也可以）', icon: '🍺' },
  { id: 7, title: '下局加持', content: '下一局游戏开始时得分为负10分！', icon: '📉' },
  { id: 8, title: '夸夸团', content: '用三句话夸在场的每一个人！', icon: '👏' },
  { id: 9, title: '发红包', content: '在群里发一个红包！', icon: '🧧' },
  { id: 10, title: '请客', content: '承诺下一次聚会请客！', icon: '🍔' },
  { id: 11, title: '下局buff', content: '下一局游戏得分翻倍一次！', icon: '✨' },
  { id: 12, title: '讲笑话', content: '讲一个笑话，没人笑就再讲一个！', icon: '😂' },
  { id: 13, title: '捏捏惩罚', content: '让左右两边的人各捏你脸一下！', icon: '🤏' },
  { id: 14, title: '神秘任务', content: '抽一个人，悄悄完成他说的一个任务！', icon: '🕵️' },
  { id: 15, title: '免罚金牌', content: '什么都不用做！你太幸运了！', icon: '🏅' },
  { id: 16, title: '俯卧撑', content: '做10个俯卧撑！（或蹲起）', icon: '💪' }
];

export const GAME_INFO: Record<GameType, { name: string; icon: string; desc: string; rules: string[] }> = {
  buzz: {
    name: '抢答拍手',
    icon: '👏',
    desc: '手速比拼！最快按下拍手按钮获得答题权',
    rules: [
      '题目出现后等待主持人开启抢答',
      '所有人可以看到题目内容',
      '听到"开始"后立即点击手机上的拍手按钮',
      '最快按下者获得答题权，答对+10分',
      '抢太早（误触）扣5分！',
      '答错则其他人可以继续抢答'
    ]
  },
  colorTrap: {
    name: '颜色陷阱',
    icon: '🎨',
    desc: '斯特鲁普效应！判断文字颜色和文字是否一致',
    rules: [
      '屏幕会显示一个颜色词，如"红"',
      '但文字的显示颜色可能与文字不同',
      '你需要判断：文字颜色和文字含义是否一致',
      '选择"一致"或"不一致"',
      '答对+5分，答错-2分',
      '答得越快，额外加成分数越高！'
    ]
  },
  trueFalse: {
    name: '真假按钮',
    icon: '🎯',
    desc: '在限时内只点击标有"真"的按钮！',
    rules: [
      '屏幕会出现很多按钮，随机分布',
      '只有标有"真"的按钮是正确目标',
      '标有"假"的按钮是干扰项！',
      '每点中一个真按钮+2分',
      '点中假按钮-3分！',
      '在限定时间内尽可能多点击正确按钮！'
    ]
  },
  rhythm: {
    name: '节奏跟点',
    icon: '🎵',
    desc: '跟着节拍在正确时机按下按钮！',
    rules: [
      '屏幕上的节拍会从上往下落',
      '当节拍到达底部判定线时点击',
      'Perfect完美判定+10分',
      'Good不错判定+5分',
      'Miss错过0分',
      '连续命中还有Combo加分！'
    ]
  }
};
