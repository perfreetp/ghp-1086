import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, Clock, Users, Trophy, Volume2, VolumeX, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, getMyPlayer } from '@/store';
import { GAME_INFO } from '../../shared/types';
import { emit } from '@/services/socket';
import BuzzGame from '@/components/games/BuzzGame';
import ColorTrapGame from '@/components/games/ColorTrapGame';
import TrueFalseGame from '@/components/games/TrueFalseGame';
import RhythmGame from '@/components/games/RhythmGame';

export default function Game() {
  const navigate = useNavigate();
  const {
    currentGame,
    totalRounds,
    currentRound,
    players,
    scores,
    isPaused,
    gameConfig,
    isHost,
    soundEnabled,
    gameState,
    status,
  } = useAppStore();

  const me = getMyPlayer(useAppStore.getState());
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [localPaused, setLocalPaused] = useState(isPaused);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setLocalPaused(isPaused);
  }, [isPaused]);

  useEffect(() => {
    if (status !== 'playing') {
      navigate('/result');
    }
  }, [status, navigate]);

  const gameInfo = currentGame ? GAME_INFO[currentGame] : null;

  const countdown = gameState?.countdown ?? 3;
  const remainingTime = gameState?.remainingTime ?? 0;
  const phase = gameState?.phase ?? 'countdown';
  const displayTime = Math.ceil(remainingTime / 1000);
  const roundDuration = gameConfig?.roundTime ?? 10000;
  const timeProgress = Math.max(0, 100 - (remainingTime / roundDuration) * 100);

  const handlePause = () => {
    if (!isHost) return;
    emit(localPaused ? 'resumeGame' : 'pauseGame');
  };
  const handleEnd = () => {
    if (!isHost) return;
    emit('returnToRoom');
  };

  const renderGame = () => {
    switch (currentGame) {
      case 'buzz':
        return <BuzzGame isMobile={isMobile} isHost={isHost} player={me} />;
      case 'colorTrap':
        return <ColorTrapGame isMobile={isMobile} isHost={isHost} player={me} />;
      case 'trueFalse':
        return <TrueFalseGame isMobile={isMobile} isHost={isHost} player={me} />;
      case 'rhythm':
        return <RhythmGame isMobile={isMobile} isHost={isHost} player={me} />;
      default:
        return null;
    }
  };

  const roundProgress = totalRounds > 0 ? (currentRound / totalRounds) * 100 : 0;

  const timeColor = phase === 'playing' ? (displayTime < 3 ? 'text-neon-pink' : displayTime < 6 ? 'text-neon-yellow' : 'text-neon-cyan') : 'text-white/60';
  const showCountdown = phase === 'countdown' && countdown >= 0;

  return (
    <div className="page-container flex flex-col h-screen overflow-hidden">
      <AnimatePresence>
        {showCountdown && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-9xl font-bold neon-text-glow font-display"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
        {showCountdown && countdown === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="text-8xl font-bold neon-text-glow font-display"
            >
              GO!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative z-10 flex-shrink-0 px-4 py-3 md:px-8 md:py-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <Clock className={`w-5 h-5 ${timeColor}`} />
              <span className={`font-mono text-xl font-bold tabular-nums ${timeColor}`}>
                {phase === 'playing' ? displayTime + 's' : countdown + 's'}
              </span>
            </div>

            {gameInfo && (
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-gradient-soft border border-white/10">
                <span className="text-2xl">{gameInfo.icon}</span>
                <span className="font-semibold">{gameInfo.name}</span>
              </div>
            )}
          </div>

          <div className="flex-1 max-w-md hidden md:block px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white/60 flex items-center gap-1">
                <Trophy className="w-4 h-4 text-neon-yellow" />
                回合 {currentRound}/{totalRounds}
              </span>
              <span className="text-xs font-mono text-white/40 tabular-nums">
                {phase === 'playing' ? `${Math.round(timeProgress)}%` : phase === 'countdown' ? '准备中...' : '结束'}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-neon-gradient rounded-full"
                initial={{ width: 0 }}
                animate={{ width: phase === 'playing' ? `${timeProgress}%` : `${roundProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isHost && (
              <button
                onClick={() => setShowControls(!showControls)}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                {localPaused ? (
                  <Play className="w-5 h-5 text-neon-cyan" />
                ) : (
                  <Pause className="w-5 h-5 text-neon-pink" />
                )}
              </button>
            )}
            {isHost && (
              <button
                onClick={() => emit('toggleSound', { enabled: !soundEnabled })}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-white/80" />
                ) : (
                  <VolumeX className="w-5 h-5 text-white/40" />
                )}
              </button>
            )}
            <button
              onClick={handleEnd}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                isHost
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                  : 'bg-white/5 border border-white/10'
              )}
            >
              <Home className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showControls && isHost && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="relative z-10 flex-shrink-0 px-4 py-3 bg-white/5 border-b border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center justify-center gap-3 max-w-7xl mx-auto">
              <button
                onClick={handlePause}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all',
                  localPaused
                    ? 'bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/30'
                    : 'bg-neon-yellow/20 border border-neon-yellow/40 text-neon-yellow hover:bg-neon-yellow/30'
                )}
              >
                {localPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                {localPaused ? '继续游戏' : '暂停游戏'}
              </button>
              <button
                onClick={handleEnd}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-neon-pink/20 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink/30 transition-all"
              >
                <Square className="w-5 h-5" />
                结束本局
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <div className="relative z-10 flex-shrink-0 px-4 py-3 md:px-8 border-b border-white/5">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin max-w-7xl mx-auto pb-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-sm text-white/60 flex-shrink-0">
              <Users className="w-4 h-4" />
              <span className="font-semibold">{players.length}</span>
            </div>
            {players.filter(p => !p.isSpectator).map((player, idx) => (
              <motion.div
                key={player.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2 rounded-xl flex-shrink-0 transition-all',
                  player.id === me?.id
                    ? 'bg-neon-gradient-soft border border-neon-pink/30 shadow-lg shadow-neon-pink/10'
                    : 'bg-white/5 border border-white/10',
                  player.eliminated && 'opacity-50 grayscale'
                )}
              >
                <span className="text-2xl">{player.avatar}</span>
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    'text-sm font-semibold truncate max-w-[100px]',
                    player.id === me?.id && 'neon-text'
                  )}>
                    {player.nickname}
                    {player.isHost && <span className="ml-1">👑</span>}
                  </span>
                  <span className="text-xs font-mono tabular-nums">
                    <span className="text-neon-cyan">{scores[player.id] ?? 0}</span>
                    <span className="text-white/40"> 分</span>
                  </span>
                </div>
                {player.id === me?.id && (
                  <div className="w-2 h-2 rounded-full bg-neon-pink animate-pulse shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 relative z-10 overflow-hidden">
        {renderGame()}
      </main>

      {isMobile && me && (
        <div className="relative z-10 flex-shrink-0 px-4 py-3 border-t border-white/10 backdrop-blur-xl bg-black/30 mobile-safe">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin pb-1">
            {players.filter(p => !p.isSpectator).slice(0, 6).map((player) => (
              <div
                key={player.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0',
                  player.id === me.id
                    ? 'bg-neon-gradient-soft border border-neon-pink/30'
                    : 'bg-white/5 border border-white/10',
                  player.eliminated && 'opacity-50 grayscale'
                )}
              >
                <span className="text-lg">{player.avatar}</span>
                <span className="text-xs font-mono font-bold text-neon-cyan tabular-nums">
                  {scores[player.id] ?? 0}
                </span>
              </div>
            ))}
            <div className="flex-1 flex justify-end">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/60">
                <Trophy className="w-3.5 h-3.5 text-neon-yellow" />
                <span className="font-mono tabular-nums">{currentRound}/{totalRounds}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {localPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl glass-card"
            >
              <Pause className="w-16 h-16 text-neon-yellow" />
              <h2 className="text-3xl font-bold font-display neon-text-glow">游戏暂停</h2>
              {isHost && (
                <button
                  onClick={handlePause}
                  className="neon-btn flex items-center gap-2 mt-2"
                >
                  <Play className="w-5 h-5" />
                  继续游戏
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
