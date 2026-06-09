import type { Room, Player, RoomSettings, GameConfig, GameType, PUNISHMENT_CARDS, AVATARS } from '../shared/types';
import { calculateRoundResult, generateBuzzQuestion, generateColorTrapQuestion, generateTrueFalseButtons, generateRhythmNotes } from './games/GameEngine';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function getDefaultSettings(): RoomSettings {
  return {
    misTouchSensitivity: 300,
    countdownDuration: 3,
    autoStart: false,
  };
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private codeToRoomId: Map<string, string> = new Map();
  private playerToRoomId: Map<string, string> = new Map();
  private socketToPlayerId: Map<string, string> = new Map();

  createRoom(nickname: string, avatar: string, socketId: string): { room: Room; player: Player } {
    let code = generateRoomCode();
    while (this.codeToRoomId.has(code)) {
      code = generateRoomCode();
    }

    const roomId = generateId();
    const hostId = generateId();

    const player: Player = {
      id: hostId,
      nickname,
      avatar,
      isHost: true,
      isSpectator: false,
      score: 0,
      isOnline: true,
      eliminated: false,
      socketId,
    };

    const room: Room = {
      id: roomId,
      code,
      hostId,
      players: [player],
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
      settings: getDefaultSettings(),
      createdAt: Date.now(),
      replayData: [],
    };

    room.scores[hostId] = 0;

    this.rooms.set(roomId, room);
    this.codeToRoomId.set(code, roomId);
    this.playerToRoomId.set(hostId, roomId);
    this.socketToPlayerId.set(socketId, hostId);

    return { room, player };
  }

  joinRoom(code: string, nickname: string, avatar: string, isSpectator: boolean, socketId: string): { room: Room; player: Player } | null {
    const roomId = this.codeToRoomId.get(code);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status === 'playing') return null;

    const playerId = generateId();
    const player: Player = {
      id: playerId,
      nickname,
      avatar,
      isHost: false,
      isSpectator,
      score: 0,
      isOnline: true,
      eliminated: false,
      socketId,
    };

    room.players.push(player);
    room.scores[playerId] = 0;

    this.playerToRoomId.set(playerId, roomId);
    this.socketToPlayerId.set(socketId, playerId);

    return { room, player };
  }

  getRoomById(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code: string): Room | undefined {
    const roomId = this.codeToRoomId.get(code);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getRoomByPlayerId(playerId: string): Room | undefined {
    const roomId = this.playerToRoomId.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getPlayerBySocketId(socketId: string): { room: Room; player: Player } | null {
    const playerId = this.socketToPlayerId.get(socketId);
    if (!playerId) return null;
    const room = this.getRoomByPlayerId(playerId);
    if (!room) return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;
    return { room, player };
  }

  reconnectPlayer(socketId: string, roomId: string, playerId: string): { room: Room; player: Player } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    player.socketId = socketId;
    player.isOnline = true;

    this.socketToPlayerId.set(socketId, playerId);
    this.playerToRoomId.set(playerId, roomId);

    return { room, player };
  }

  updateSocketId(oldSocketId: string, newSocketId: string): void {
    const playerId = this.socketToPlayerId.get(oldSocketId);
    if (!playerId) return;
    this.socketToPlayerId.delete(oldSocketId);
    this.socketToPlayerId.set(newSocketId, playerId);
    const room = this.getRoomByPlayerId(playerId);
    if (room) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.socketId = newSocketId;
        player.isOnline = true;
      }
    }
  }

  removePlayerBySocket(socketId: string): { room: Room; player: Player } | null {
    const playerId = this.socketToPlayerId.get(socketId);
    if (!playerId) return null;

    const room = this.getRoomByPlayerId(playerId);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    player.isOnline = false;

    if (room.status === 'waiting') {
      room.players = room.players.filter(p => p.id !== playerId);
      delete room.scores[playerId];
      this.playerToRoomId.delete(playerId);
      this.socketToPlayerId.delete(socketId);

      if (player.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].id;
      }

      if (room.players.length === 0) {
        this.rooms.delete(room.id);
        this.codeToRoomId.delete(room.code);
      }
    }

    return { room, player };
  }

  kickPlayer(room: Room, playerId: string): boolean {
    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;
    if (player.isHost) return false;

    room.players = room.players.filter(p => p.id !== playerId);
    delete room.scores[playerId];
    this.playerToRoomId.delete(playerId);
    if (player.socketId) {
      this.socketToPlayerId.delete(player.socketId);
    }
    return true;
  }

  transferHost(room: Room, newHostId: string): boolean {
    const oldHost = room.players.find(p => p.id === room.hostId);
    const newHost = room.players.find(p => p.id === newHostId);
    if (!oldHost || !newHost || newHost.isSpectator) return false;

    oldHost.isHost = false;
    newHost.isHost = true;
    room.hostId = newHostId;
    return true;
  }

  toggleSpectator(room: Room, playerId: string, isSpectator: boolean): boolean {
    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;
    if (player.isHost && isSpectator) return false;

    player.isSpectator = isSpectator;
    return true;
  }

  updatePlayer(room: Room, playerId: string, updates: { nickname?: string; avatar?: string }): Player | null {
    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    if (updates.nickname) player.nickname = updates.nickname;
    if (updates.avatar) player.avatar = updates.avatar;
    return player;
  }

  selectGame(room: Room, gameType: GameType, rounds: number, mode: 'score' | 'elimination'): void {
    room.currentGame = gameType;
    room.totalRounds = rounds;
    room.gameConfig = {
      type: gameType,
      rounds,
      mode,
      roundTime: this.getGameRoundTime(gameType),
    };
  }

  private getGameRoundTime(type: GameType): number {
    switch (type) {
      case 'buzz': return 15000;
      case 'colorTrap': return 8000;
      case 'trueFalse': return 10000;
      case 'rhythm': return 15000;
    }
  }

  startRound(room: Room): void {
    if (!room.gameConfig) return;

    room.currentRound++;
    room.status = 'playing';
    room.isPaused = false;
    const roundScores: Record<string, number> = {};
    room.players.forEach(p => { roundScores[p.id] = 0; });
    room.roundScores.push(roundScores);

    const config = room.gameConfig;
    switch (config.type) {
      case 'buzz':
        room.gameState = {
          phase: 'countdown',
          question: generateBuzzQuestion(),
          buzzerPressed: {},
          answered: [],
          misTouchPlayers: [],
          countdown: 3,
          activeBuzzer: undefined,
        };
        break;
      case 'colorTrap':
        room.gameState = {
          phase: 'countdown',
          question: generateColorTrapQuestion(),
          answers: {},
          countdown: 3,
        };
        break;
      case 'trueFalse':
        room.gameState = {
          phase: 'countdown',
          buttons: generateTrueFalseButtons(14),
          clicked: {},
          scores: {},
          countdown: 3,
        };
        break;
      case 'rhythm':
        room.gameState = {
          phase: 'countdown',
          notes: generateRhythmNotes(110, 18),
          hits: {},
          bpm: 110,
          countdown: 3,
          startTime: undefined,
        };
        break;
    }
  }

  setGamePhase(room: Room, phase: 'countdown' | 'playing' | 'ended'): void {
    if (room.gameState) {
      room.gameState.phase = phase;
      if (phase === 'playing' && room.gameState.startTime === undefined && room.currentGame === 'rhythm') {
        room.gameState.startTime = Date.now();
      }
    }
  }

  handleBuzzPress(room: Room, player: Player): { success: boolean; misTouch: boolean; active?: boolean } {
    const state = room.gameState;
    if (!state || state.phase !== 'playing') return { success: false, misTouch: false };
    if (player.isSpectator || player.eliminated) return { success: false, misTouch: false };

    const now = Date.now();
    const isMisTouch = !state.roundStartTime || (now - state.roundStartTime) < room.settings.misTouchSensitivity;

    if (state.activeBuzzer) {
      return { success: false, misTouch: false, active: false };
    }

    if (isMisTouch && !state.misTouchPlayers.includes(player.id)) {
      state.misTouchPlayers.push(player.id);
      this.addRoundScore(room, player.id, -5);
      room.replayData.push({ type: 'mistouch', playerId: player.id, timestamp: now, data: {} });
      return { success: true, misTouch: true };
    }

    if (!state.buzzerPressed[player.id]) {
      state.buzzerPressed[player.id] = now;
      state.activeBuzzer = player.id;
      room.replayData.push({ type: 'buzz', playerId: player.id, timestamp: now, data: {} });
      return { success: true, misTouch: false, active: true };
    }

    return { success: false, misTouch: false };
  }

  handleBuzzAnswer(room: Room, player: Player, correct: boolean): void {
    const state = room.gameState;
    if (!state) return;

    const now = Date.now();
    if (correct) {
      this.addRoundScore(room, player.id, 10);
      state.answered.push(player.id);
      state.activeBuzzer = undefined;
      room.replayData.push({ type: 'answer', playerId: player.id, timestamp: now, data: { correct: true } });
    } else {
      this.addRoundScore(room, player.id, -3);
      state.answered.push(player.id);
      state.activeBuzzer = undefined;
      room.replayData.push({ type: 'answer', playerId: player.id, timestamp: now, data: { correct: false } });
    }
  }

  handleColorTrapAnswer(room: Room, player: Player, answer: 'match' | 'mismatch'): { correct: boolean; timeBonus: number } {
    const state = room.gameState;
    if (!state || state.phase !== 'playing') return { correct: false, timeBonus: 0 };
    if (player.isSpectator || player.eliminated) return { correct: false, timeBonus: 0 };
    if (state.answers[player.id]) return { correct: false, timeBonus: 0 };

    const now = Date.now();
    const elapsed = now - (state.roundStartTime || now);
    const totalTime = room.gameConfig?.roundTime || 8000;
    const correct = answer === state.question.correctAnswer;
    const timeRatio = Math.max(0, 1 - elapsed / totalTime);
    const timeBonus = correct ? Math.floor(timeRatio * 5) : 0;

    state.answers[player.id] = { answer, time: elapsed, correct };
    const score = correct ? (5 + timeBonus) : -2;
    this.addRoundScore(room, player.id, score);
    room.replayData.push({ type: 'colorAnswer', playerId: player.id, timestamp: now, data: { correct, answer, timeBonus } });

    return { correct, timeBonus };
  }

  handleTrueFalseClick(room: Room, player: Player, buttonId: number): { correct: boolean; points: number } {
    const state = room.gameState;
    if (!state || state.phase !== 'playing') return { correct: false, points: 0 };
    if (player.isSpectator || player.eliminated) return { correct: false, points: 0 };

    const button = state.buttons.find((b: any) => b.id === buttonId);
    if (!button) return { correct: false, points: 0 };

    if (!state.clicked[player.id]) state.clicked[player.id] = [];
    const clicked = state.clicked[player.id];
    if (clicked.some((c: any) => c.buttonId === buttonId)) return { correct: false, points: 0 };

    const now = Date.now();
    clicked.push({ buttonId, time: now });

    const points = button.isReal ? 2 : -3;
    this.addRoundScore(room, player.id, points);
    room.replayData.push({ type: 'tfClick', playerId: player.id, timestamp: now, data: { correct: button.isReal, buttonId, points } });

    return { correct: button.isReal, points };
  }

  handleRhythmHit(room: Room, player: Player, noteId: number): { judgment: 'perfect' | 'good' | 'miss' | 'none'; points: number } {
    const state = room.gameState;
    if (!state || state.phase !== 'playing') return { judgment: 'none', points: 0 };
    if (player.isSpectator || player.eliminated) return { judgment: 'none', points: 0 };
    if (!state.startTime) return { judgment: 'none', points: 0 };

    const note = state.notes.find((n: any) => n.id === noteId);
    if (!note || note.hit) return { judgment: 'none', points: 0 };

    const elapsed = Date.now() - state.startTime;
    const diff = Math.abs(elapsed - note.startTime);

    let judgment: 'perfect' | 'good' | 'miss' = 'miss';
    let points = 0;

    if (diff < 100) {
      judgment = 'perfect';
      points = 10;
      note.hit = true;
    } else if (diff < 250) {
      judgment = 'good';
      points = 5;
      note.hit = true;
    } else if (diff < 400) {
      judgment = 'miss';
      points = 0;
      note.hit = true;
    } else {
      return { judgment: 'none', points: 0 };
    }

    if (!state.hits[player.id]) state.hits[player.id] = [];
    state.hits[player.id].push({ noteId, judgment, time: elapsed });
    this.addRoundScore(room, player.id, points);
    room.replayData.push({ type: 'rhythmHit', playerId: player.id, timestamp: Date.now(), data: { noteId, judgment, points } });

    return { judgment, points };
  }

  addRoundScore(room: Room, playerId: string, score: number): void {
    const idx = room.roundScores.length - 1;
    if (idx >= 0) {
      room.roundScores[idx][playerId] = (room.roundScores[idx][playerId] || 0) + score;
    }
    room.scores[playerId] = (room.scores[playerId] || 0) + score;
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.score = room.scores[playerId];
    }
  }

  setRoundStartTime(room: Room): void {
    if (room.gameState) {
      room.gameState.roundStartTime = Date.now();
    }
  }

  endRound(room: Room): any {
    const roundScores = room.roundScores[room.roundScores.length - 1] || {};
    const mode = room.gameConfig?.mode || 'score';
    const gameType = room.gameConfig?.type!;

    const result = calculateRoundResult(gameType, room.players, roundScores, mode);
    result.round = room.currentRound;

    if (result.eliminated) {
      result.eliminated.forEach(pid => {
        const p = room.players.find(pl => pl.id === pid);
        if (p) p.eliminated = true;
      });
    }

    if (room.currentRound >= room.totalRounds) {
      room.status = 'result';
    }

    return result;
  }

  getFinalResult(room: Room): any {
    const activePlayers = room.players.filter(p => !p.isSpectator);
    const rankings = [...activePlayers]
      .sort((a, b) => (room.scores[b.id] || 0) - (room.scores[a.id] || 0))
      .map((p, idx) => ({
        playerId: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        totalScore: room.scores[p.id] || 0,
        roundsWon: room.roundScores.filter(rs => {
          const sorted = Object.entries(rs).sort((a, b) => b[1] - a[1]);
          return sorted[0] && sorted[0][0] === p.id && sorted[0][1] > 0;
        }).length,
      }));

    return {
      totalRounds: room.totalRounds,
      rankings,
      punishments: [],
    };
  }

  resetGame(room: Room): void {
    room.status = 'waiting';
    room.currentRound = 0;
    room.scores = {};
    room.roundScores = [];
    room.gameState = null;
    room.replayData = [];
    room.players.forEach(p => {
      p.score = 0;
      p.eliminated = false;
      room.scores[p.id] = 0;
    });
  }

  cleanOldRooms(): void {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      const allOffline = room.players.every(p => !p.isOnline);
      if (allOffline && now - room.createdAt > 3600000) {
        this.rooms.delete(id);
        this.codeToRoomId.delete(room.code);
        room.players.forEach(p => {
          this.playerToRoomId.delete(p.id);
        });
      }
    }
  }
}

export const roomManager = new RoomManager();

setInterval(() => roomManager.cleanOldRooms(), 300000);
