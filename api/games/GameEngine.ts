import type { GameType, RoundResult, Player, BuzzQuestion, ColorTrapQuestion, TrueFalseButton, RhythmNote } from '../../shared/types';

const BUZZ_QUESTIONS: BuzzQuestion[] = [
  { id: 1, text: '世界上最高的山峰是哪座？', category: '地理' },
  { id: 2, text: '一年有多少个月？', category: '常识' },
  { id: 3, text: '水的化学式是什么？', category: '科学' },
  { id: 4, text: '中国的首都是？', category: '地理' },
  { id: 5, text: '太阳系中最大的行星是？', category: '天文' },
  { id: 6, text: '《西游记》的作者是？', category: '文学' },
  { id: 7, text: '人体最大的器官是？', category: '生物' },
  { id: 8, text: '2024年奥运会在哪里举办？', category: '体育' },
  { id: 9, text: '光年是什么单位？', category: '天文' },
  { id: 10, text: 'RGB颜色模式中R代表什么颜色？', category: '常识' },
  { id: 11, text: '中国古代四大发明不包括？（印刷/造纸/指南针/丝绸）', category: '历史' },
  { id: 12, text: '世界上最长的河流是？', category: '地理' },
];

const COLOR_WORDS = ['红色', '蓝色', '绿色', '黄色', '紫色', '橙色'];
const COLOR_HEX: Record<string, string> = {
  '红色': '#FF3366',
  '蓝色': '#3399FF',
  '绿色': '#33FF99',
  '黄色': '#FFDD33',
  '紫色': '#CC66FF',
  '橙色': '#FF9933',
};

export function generateBuzzQuestion(usedIds: Set<number> = new Set()): BuzzQuestion {
  const available = BUZZ_QUESTIONS.filter(q => !usedIds.has(q.id));
  const pool = available.length > 0 ? available : BUZZ_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateColorTrapQuestion(): ColorTrapQuestion {
  const word = COLOR_WORDS[Math.floor(Math.random() * COLOR_WORDS.length)];
  let displayColor = COLOR_WORDS[Math.floor(Math.random() * COLOR_WORDS.length)];
  if (Math.random() < 0.5) {
    displayColor = word;
  }
  return {
    word,
    displayColor: COLOR_HEX[displayColor],
    correctAnswer: word === displayColor ? 'match' : 'mismatch',
  };
}

export function generateTrueFalseButtons(count: number = 12): TrueFalseButton[] {
  const buttons: TrueFalseButton[] = [];
  const realCount = Math.ceil(count * 0.4);
  for (let i = 0; i < count; i++) {
    const isReal = i < realCount;
    buttons.push({
      id: i,
      isReal,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 60 + Math.random() * 40,
      label: isReal ? '真' : '假',
    });
  }
  return buttons.sort(() => Math.random() - 0.5);
}

export function generateRhythmNotes(bpm: number = 120, duration: number = 15): RhythmNote[] {
  const notes: RhythmNote[] = [];
  const beatInterval = 60000 / bpm;
  const totalMs = duration * 1000;
  let id = 0;
  let time = 1000;
  while (time < totalMs - 1000) {
    const lane = Math.floor(Math.random() * 4);
    notes.push({
      id: id++,
      lane,
      startTime: time,
      hit: false,
    });
    const skip = Math.random() < 0.3 ? 2 : 1;
    time += beatInterval * skip;
  }
  return notes;
}

export function calculateRoundResult(
  gameType: GameType,
  players: Player[],
  roundScores: Record<string, number>,
  mode: 'score' | 'elimination'
): RoundResult {
  const activePlayers = players.filter(p => !p.isSpectator && !p.eliminated);
  const sorted = [...activePlayers].sort((a, b) => {
    const sa = roundScores[a.id] ?? 0;
    const sb = roundScores[b.id] ?? 0;
    return sb - sa;
  });

  const rankings = sorted.map((p, idx) => ({
    playerId: p.id,
    rank: idx + 1,
    score: roundScores[p.id] ?? 0,
  }));

  let eliminated: string[] = [];
  if (mode === 'elimination' && rankings.length > 2) {
    const lastCount = Math.max(1, Math.floor(rankings.length * 0.2));
    eliminated = rankings.slice(-lastCount).map(r => r.playerId);
  }

  return {
    round: 0,
    gameType,
    rankings,
    eliminated: eliminated.length > 0 ? eliminated : undefined,
  };
}

export function getColorHex(colorName: string): string {
  return COLOR_HEX[colorName] || '#FFFFFF';
}
