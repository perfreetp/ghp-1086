import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { roomManager } from './RoomManager';
import { PUNISHMENT_CARDS } from '../shared/types';
import type { GameType } from '../shared/types';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager['rooms'].size });
});

app.get('/api/room/:code', (req, res) => {
  const room = roomManager.getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  res.json({
    id: room.id,
    code: room.code,
    status: room.status,
    playerCount: room.players.length,
  });
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

function emitToRoom(roomId: string, event: string, data: any) {
  io.to(roomId).emit(event, data);
}

function sendRoomState(roomId: string) {
  const room = roomManager.getRoomById(roomId);
  if (!room) return;
  emitToRoom(roomId, 'roomState', {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      isHost: p.isHost,
      isSpectator: p.isSpectator,
      score: p.score,
      isOnline: p.isOnline,
      eliminated: p.eliminated,
    })),
    status: room.status,
    currentGame: room.currentGame,
    gameConfig: room.gameConfig,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    scores: room.scores,
    isPaused: room.isPaused,
    soundEnabled: room.soundEnabled,
    settings: room.settings,
    gameState: room.gameState,
    punishmentAssignments: room.punishmentAssignments,
  });
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('createRoom', ({ nickname, avatar }: { nickname: string; avatar: string }) => {
    if (!nickname || !avatar) {
      socket.emit('error', { code: 'INVALID_DATA', message: '请填写昵称和选择头像' });
      return;
    }
    const { room, player } = roomManager.createRoom(nickname, avatar, socket.id);
    socket.join(room.id);
    socket.emit('roomCreated', {
      roomId: room.id,
      playerId: player.id,
      code: room.code,
      isHost: true,
    });
    setTimeout(() => sendRoomState(room.id), 100);
  });

  socket.on('joinRoom', ({ roomCode, nickname, avatar, isSpectator }: { roomCode: string; nickname: string; avatar: string; isSpectator: boolean }) => {
    if (!roomCode || !nickname || !avatar) {
      socket.emit('error', { code: 'INVALID_DATA', message: '请填写完整信息' });
      return;
    }
    const result = roomManager.joinRoom(roomCode.toUpperCase(), nickname, avatar, isSpectator, socket.id);
    if (!result) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在或游戏进行中' });
      return;
    }
    const { room, player } = result;
    socket.join(room.id);
    socket.emit('joinedRoom', {
      roomId: room.id,
      playerId: player.id,
      isHost: player.isHost,
    });
    setTimeout(() => sendRoomState(room.id), 100);
  });

  socket.on('reconnect', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const result = roomManager.reconnectPlayer(socket.id, roomId, playerId);
    if (!result) {
      socket.emit('error', { code: 'RECONNECT_FAILED', message: '重连失败' });
      return;
    }
    const { room, player } = result;
    socket.join(room.id);
    socket.emit('reconnected', {
      roomState: {
        id: room.id,
        code: room.code,
        status: room.status,
        currentGame: room.currentGame,
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
      },
      playerState: player,
    });
    setTimeout(() => sendRoomState(room.id), 100);
  });

  socket.on('updatePlayer', ({ nickname, avatar }: { nickname?: string; avatar?: string }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp) return;
    const updated = roomManager.updatePlayer(rp.room, rp.player.id, { nickname, avatar });
    if (updated) sendRoomState(rp.room.id);
  });

  socket.on('kickPlayer', ({ playerId }: { playerId: string }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    const targetSocket = rp.room.players.find(p => p.id === playerId)?.socketId;
    const ok = roomManager.kickPlayer(rp.room, playerId);
    if (ok) {
      if (targetSocket) {
        io.to(targetSocket).emit('kicked');
        io.sockets.sockets.get(targetSocket)?.leave(rp.room.id);
      }
      sendRoomState(rp.room.id);
    }
  });

  socket.on('transferHost', ({ newHostId }: { newHostId: string }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    const ok = roomManager.transferHost(rp.room, newHostId);
    if (ok) sendRoomState(rp.room.id);
  });

  socket.on('toggleSpectator', ({ playerId, isSpectator }: { playerId: string; isSpectator: boolean }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    const ok = roomManager.toggleSpectator(rp.room, playerId, isSpectator);
    if (ok) sendRoomState(rp.room.id);
  });

  socket.on('selectGame', ({ gameType, rounds, mode }: { gameType: GameType; rounds: number; mode: 'score' | 'elimination' }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    roomManager.selectGame(rp.room, gameType, rounds, mode);
    sendRoomState(rp.room.id);
  });

  socket.on('startGame', () => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost || !rp.room.gameConfig) return;

    runRound(rp.room.id);
  });

  socket.on('nextRound', () => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost || !rp.room.gameConfig) return;
    if (rp.room.currentRound >= rp.room.totalRounds) {
      const final = roomManager.getFinalResult(rp.room);
      rp.room.status = 'result';
      emitToRoom(rp.room.id, 'gameEnd', final);
      sendRoomState(rp.room.id);
      return;
    }
    runRound(rp.room.id);
  });

  socket.on('returnToRoom', () => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    roomManager.resetGame(rp.room);
    sendRoomState(rp.room.id);
  });

  socket.on('pauseGame', () => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    roomManager.pauseRoom(rp.room);
    emitToRoom(rp.room.id, 'gamePaused', {
      remainingTime: rp.room.gameState?.remainingTime,
    });
    sendRoomState(rp.room.id);
  });

  socket.on('resumeGame', () => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    roomManager.resumeRoom(rp.room);
    emitToRoom(rp.room.id, 'gameResumed', null);
    sendRoomState(rp.room.id);
  });

  socket.on('toggleSound', ({ enabled }: { enabled: boolean }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    rp.room.soundEnabled = enabled;
    sendRoomState(rp.room.id);
  });

  socket.on('updateSettings', (settings: any) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp || !rp.player.isHost) return;
    rp.room.settings = { ...rp.room.settings, ...settings };
    sendRoomState(rp.room.id);
  });

  socket.on('gameAction', ({ action, payload }: { action: string; payload: any }) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp) return;
    const { room, player } = rp;

    switch (action) {
      case 'buzz_press': {
        const result = roomManager.handleBuzzPress(room, player);
        socket.emit('gameActionResult', { action, result });
        if (result.active) {
          emitToRoom(room.id, 'gameStateUpdate', room.gameState);
        } else {
          sendRoomState(room.id);
        }
        break;
      }
      case 'buzz_answer': {
        roomManager.handleBuzzAnswer(room, player, payload.correct);
        emitToRoom(room.id, 'gameStateUpdate', room.gameState);
        sendRoomState(room.id);
        break;
      }
      case 'color_answer': {
        const result = roomManager.handleColorTrapAnswer(room, player, payload.answer);
        socket.emit('gameActionResult', { action, result });
        sendRoomState(room.id);
        break;
      }
      case 'tf_click': {
        const result = roomManager.handleTrueFalseClick(room, player, payload.buttonId);
        socket.emit('gameActionResult', { action, result });
        emitToRoom(room.id, 'gameStateUpdate', room.gameState);
        sendRoomState(room.id);
        break;
      }
      case 'rhythm_hit': {
        const result = roomManager.handleRhythmHit(room, player, payload.noteId);
        socket.emit('gameActionResult', { action, result });
        sendRoomState(room.id);
        break;
      }
      case 'host_next_question': {
        if (player.isHost && room.currentGame === 'buzz') {
          const ok = roomManager.nextBuzzQuestion(room);
          if (ok) {
            room.status = 'playing';
            room.isPaused = false;
            room.pauseStartedAt = undefined;
            room.pauseAccumulatedMs = 0;
            sendRoomState(room.id);
            setTimeout(() => beginCountdown(room.id), 150);
          }
        }
        break;
      }
    }
  });

  socket.on('drawPunishment', () => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp) return;
    const card = PUNISHMENT_CARDS[Math.floor(Math.random() * PUNISHMENT_CARDS.length)];
    const assignment = {
      playerId: rp.player.id,
      playerName: rp.player.nickname,
      card,
      drawnAt: Date.now(),
    };
    rp.room.punishmentAssignments.push(assignment);
    emitToRoom(rp.room.id, 'punishmentDrawn', assignment);
    sendRoomState(rp.room.id);
  });

  socket.on('getFinalResult', (callback: any) => {
    const rp = roomManager.getPlayerBySocketId(socket.id);
    if (!rp) return callback?.(null);
    const result = roomManager.getFinalResult(rp.room);
    result.punishments = rp.room.punishmentAssignments;
    callback?.(result);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    const result = roomManager.removePlayerBySocket(socket.id);
    if (result) {
      const { room } = result;
      sendRoomState(room.id);
    }
  });
});

function beginCountdown(roomId: string) {
  const room = roomManager.getRoomById(roomId);
  if (!room || !room.gameState) return;

  let count = room.settings.countdownDuration || 3;
  const tick = () => {
    if (!room.gameState) return;
    if (room.isPaused) {
      setTimeout(tick, 500);
      return;
    }
    room.gameState.countdown = count;
    emitToRoom(roomId, 'gameStateUpdate', room.gameState);
    count--;
    if (count < 0) {
      roomManager.setGamePhase(room, 'playing');
      roomManager.setRoundStartTime(room);
      emitToRoom(roomId, 'gameStateUpdate', room.gameState);
      startRoundTimer(roomId);
    } else {
      setTimeout(tick, 1000);
    }
  };
  tick();
}

function startRoundTimer(roomId: string) {
  const room = roomManager.getRoomById(roomId);
  if (!room || !room.gameConfig || !room.gameState) return;

  const roundTime = room.gameConfig.roundTime;
  const startAt = room.gameState.roundStartTime || Date.now();

  const tick = () => {
    if (!room.gameState || !room.gameConfig) return;
    if (room.status !== 'playing') return;

    const effectiveElapsed = roomManager.getEffectiveElapsed(room, startAt);
    const remaining = Math.max(0, roundTime - effectiveElapsed);
    room.gameState.remainingTime = remaining;

    if (!room.isPaused) {
      if (room.currentGame === 'rhythm' && room.gameState.startTime) {
        emitToRoom(roomId, 'gameStateUpdate', room.gameState);
      }
    }

    if (remaining <= 0 && !room.isPaused) {
      endRound(roomId);
      return;
    }

    if (room.currentGame === 'rhythm' || room.currentGame === 'trueFalse') {
      setTimeout(tick, 100);
    } else if (remaining < 1000) {
      setTimeout(tick, 50);
    } else {
      setTimeout(tick, 200);
    }
  };
  tick();
}

function runRound(roomId: string) {
  const room = roomManager.getRoomById(roomId);
  if (!room || !room.gameConfig) return;
  roomManager.startRound(room);
  sendRoomState(roomId);
  setTimeout(() => beginCountdown(roomId), 300);
}

function endRound(roomId: string) {
  const room = roomManager.getRoomById(roomId);
  if (!room || !room.gameConfig) return;
  roomManager.setGamePhase(room, 'ended');
  emitToRoom(roomId, 'gameStateUpdate', room.gameState);

  setTimeout(() => {
    const result = roomManager.endRound(room);
    emitToRoom(roomId, 'roundEnd', result);
    sendRoomState(roomId);

    if (room.currentRound >= room.totalRounds) {
      setTimeout(() => {
        const final = roomManager.getFinalResult(room);
        room.status = 'result';
        emitToRoom(roomId, 'gameEnd', final);
        sendRoomState(roomId);
      }, 1500);
    }
  }, 1000);
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
