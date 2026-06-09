import { create } from 'zustand';
import type { Player, GameConfig, RoomSettings, RoundResult, FinalResult, PunishmentCard, GameType } from '../../shared/types';
import { AVATARS } from '../../shared/types';

export interface AppState {
  roomId: string | null;
  roomCode: string | null;
  playerId: string | null;
  isHost: boolean;
  players: Player[];
  status: 'waiting' | 'playing' | 'result';
  currentGame: GameType | null;
  gameConfig: GameConfig | null;
  gameState: any;
  totalRounds: number;
  currentRound: number;
  scores: Record<string, number>;
  roundScores: Record<string, number>[];
  isPaused: boolean;
  soundEnabled: boolean;
  settings: RoomSettings;
  lastRoundResult: RoundResult | null;
  finalResult: FinalResult | null;
  latestPunishment: { playerId: string; playerName: string; card: PunishmentCard } | null;
  error: string | null;

  setRoom: (data: any) => void;
  setPlayer: (playerId: string, roomId: string, roomCode: string, isHost: boolean) => void;
  setGameState: (state: any) => void;
  setRoundResult: (r: RoundResult) => void;
  setFinalResult: (r: FinalResult) => void;
  setPunishment: (p: { playerId: string; playerName: string; card: PunishmentCard }) => void;
  setError: (err: string | null) => void;
  clearAll: () => void;
}

const defaultSettings: RoomSettings = {
  misTouchSensitivity: 300,
  countdownDuration: 3,
  autoStart: false,
};

export const useAppStore = create<AppState>((set) => ({
  roomId: null,
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [],
  status: 'waiting',
  currentGame: null,
  gameConfig: null,
  gameState: null,
  totalRounds: 0,
  currentRound: 0,
  scores: {},
  roundScores: [],
  isPaused: false,
  soundEnabled: true,
  settings: defaultSettings,
  lastRoundResult: null,
  finalResult: null,
  latestPunishment: null,
  error: null,

  setRoom: (data: any) => set({
    roomId: data.id,
    roomCode: data.code,
    players: data.players || [],
    status: data.status || 'waiting',
    currentGame: data.currentGame,
    gameConfig: data.gameConfig,
    gameState: data.gameState,
    totalRounds: data.totalRounds || 0,
    currentRound: data.currentRound || 0,
    scores: data.scores || {},
    isPaused: data.isPaused || false,
    soundEnabled: data.soundEnabled ?? true,
    settings: data.settings || defaultSettings,
  }),

  setPlayer: (playerId: string, roomId: string, roomCode: string, isHost: boolean) => set({
    playerId, roomId, roomCode, isHost,
  }),

  setGameState: (state: any) => set({ gameState: state }),
  setRoundResult: (r: RoundResult) => set({ lastRoundResult: r }),
  setFinalResult: (r: FinalResult) => set({ finalResult: r }),
  setPunishment: (p) => set({ latestPunishment: p }),
  setError: (err) => set({ error: err }),
  clearAll: () => set({
    roomId: null, roomCode: null, playerId: null, isHost: false,
    players: [], status: 'waiting', currentGame: null, gameConfig: null,
    gameState: null, totalRounds: 0, currentRound: 0, scores: {}, roundScores: [],
    isPaused: false, lastRoundResult: null, finalResult: null, latestPunishment: null,
    error: null,
  }),
}));

export function getRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export function getMyPlayer(state: AppState): Player | undefined {
  return state.players.find(p => p.id === state.playerId);
}
