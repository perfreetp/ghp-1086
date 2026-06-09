import { create } from 'zustand';
import type { Player, GameConfig, RoomSettings, RoundResult, FinalResult, PunishmentCard, GameType, PunishmentAssignment } from '../../shared/types';
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
  latestPunishment: PunishmentAssignment | null;
  punishmentAssignments: PunishmentAssignment[];
  error: string | null;

  setRoom: (data: any) => void;
  setPlayer: (playerId: string, roomId: string, roomCode: string, isHost: boolean) => void;
  setGameState: (state: any) => void;
  setRoundResult: (r: RoundResult) => void;
  setFinalResult: (r: FinalResult) => void;
  setPunishment: (p: PunishmentAssignment) => void;
  setError: (err: string | null) => void;
  setIsHost: (v: boolean) => void;
  clearAll: () => void;
  reset: () => void;
}

const defaultSettings: RoomSettings = {
  misTouchSensitivity: 300,
  countdownDuration: 3,
  autoStart: false,
};

const createInitialState = () => ({
  roomId: null as string | null,
  roomCode: null as string | null,
  playerId: null as string | null,
  isHost: false,
  players: [] as Player[],
  status: 'waiting' as const,
  currentGame: null as GameType | null,
  gameConfig: null as GameConfig | null,
  gameState: null as any,
  totalRounds: 0,
  currentRound: 0,
  scores: {} as Record<string, number>,
  roundScores: [] as Record<string, number>[],
  isPaused: false,
  soundEnabled: true,
  settings: defaultSettings,
  lastRoundResult: null as RoundResult | null,
  finalResult: null as FinalResult | null,
  latestPunishment: null as PunishmentAssignment | null,
  punishmentAssignments: [] as PunishmentAssignment[],
  error: null as string | null,
});

export const useAppStore = create<AppState>((set, get) => ({
  ...createInitialState(),

  setRoom: (data: any) => {
    const currentPlayerId = get().playerId;
    const meInList = data.players?.find((p: Player) => p.id === currentPlayerId);
    const calculatedIsHost = meInList?.isHost ?? data.hostId === currentPlayerId ?? false;
    set({
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
      punishmentAssignments: data.punishmentAssignments || [],
      isHost: calculatedIsHost,
    });
  },

  setIsHost: (v: boolean) => set({ isHost: v }),

  setPlayer: (playerId: string, roomId: string, roomCode: string, isHost: boolean) => set({
    playerId, roomId, roomCode, isHost,
  }),

  setGameState: (state: any) => set({ gameState: state }),
  setRoundResult: (r: RoundResult) => set({ lastRoundResult: r }),
  setFinalResult: (r: FinalResult) => set({
    finalResult: r,
    punishmentAssignments: r.punishments ? [...r.punishments] : get().punishmentAssignments,
  }),
  setPunishment: (p) => set(s => ({
    latestPunishment: p,
    punishmentAssignments: [...s.punishmentAssignments, p],
  })),
  setError: (err) => set({ error: err }),
  clearAll: () => set(createInitialState()),
  reset: () => set(createInitialState()),
}));

export function getRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export function getMyPlayer(state: AppState): Player | undefined {
  return state.players.find(p => p.id === state.playerId);
}
