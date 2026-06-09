import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore, getMyPlayer } from '@/store';
import { emit, on } from '@/services/socket';
import type { Player, BuzzGameState, GamePhase } from '../../../shared/types';

interface BuzzGameProps {
  isMobile: boolean;
  isHost: boolean;
  player?: Player;
}

export default function BuzzGame({ isMobile, isHost }: BuzzGameProps) {
  const { gameState, playerId, players, scores } = useAppStore();
  const me = getMyPlayer(useAppStore.getState());
  const buzzState = gameState as (BuzzGameState & { remainingTime?: number }) | null;

  const [localRemaining, setLocalRemaining] = useState(0);
  const [buzzResult, setBuzzResult] = useState<'success' | 'mistouch' | 'locked' | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null);

  const activePlayers = useMemo(() => players.filter(p => !p.isSpectator), [players]);
  const roundTime = useAppStore.getState().gameConfig?.roundTime ?? 15000;
  const remainingMs = buzzState?.remainingTime ?? 0;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const countdownPercent = roundTime > 0 ? (remainingMs / roundTime) * 100 : 0;

  useEffect(() => {
    if (buzzState?.phase === 'playing') {
      setLocalRemaining(remainingSec);
    }
  }, [remainingSec, buzzState?.phase]);

  useEffect(() => {
    const unsub1 = on('gameActionResult', ({ action, result }: any) => {
      if (action === 'buzz_press' && playerId === me?.id) {
        if (result.misTouch) {
          setBuzzResult('mistouch');
          setTimeout(() => setBuzzResult(null), 1500);
        } else if (result.active) {
          setBuzzResult('success');
        } else {
          setBuzzResult('locked');
          setTimeout(() => setBuzzResult(null), 1000);
        }
      }
    });
    return () => {
      unsub1?.();
    };
  }, [playerId, me?.id]);

  const isPhase = (phase: GamePhase) => buzzState?.phase === phase;
  const hasActiveBuzzer = !!buzzState?.activeBuzzer;
  const iAmActiveBuzzer = buzzState?.activeBuzzer === playerId;
  const amBuzzed = !!(playerId && buzzState?.buzzerPressed?.[playerId]);
  const amMisTouch = !!(playerId && buzzState?.misTouchPlayers?.includes(playerId));

  const handleBuzzPress = () => {
    if (!isPhase('playing') || amBuzzed || hasActiveBuzzer) return;
    emit('gameAction', { action: 'buzz_press', payload: {} });
  };

  const handleBuzzAnswer = (correct: boolean) => {
    if (!iAmActiveBuzzer && !isHost) return;
    setAnswerResult(correct ? 'correct' : 'wrong');
    emit('gameAction', { action: 'buzz_answer', payload: { correct } });
    setTimeout(() => {
      setAnswerResult(null);
      setBuzzResult(null);
    }, 1500);
  };

  const handleHostNextQuestion = () => {
    if (!isHost) return;
    emit('gameAction', { action: 'host_next_question', payload: {} });
  };

  const getPlayerStatus = (p: Player) => {
    if (buzzState?.activeBuzzer === p.id) return 'active';
    if (buzzState?.misTouchPlayers?.includes(p.id)) return 'mistouch';
    if (buzzState?.buzzerPressed?.[p.id]) return 'pressed';
    if (buzzState?.answered?.includes(p.id)) return 'answered';
    return 'idle';
  };

  const activePlayer = players.find(p => p.id === buzzState?.activeBuzzer);

  if (isMobile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
        <AnimatePresence>
          {buzzResult === 'mistouch' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-xl z-20 bg-neon-pink/20 border border-neon-pink/50 text-neon-pink shadow-lg shadow-neon-pink/30"
            >
              ✗ 抢答犯规！-5分
            </motion.div>
          )}
          {buzzResult === 'locked' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-xl z-20 bg-white/10 border border-white/30 text-white/70"
            >
              已被抢答
            </motion.div>
          )}
          {answerResult && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={cn(
                'absolute top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-xl z-20',
                answerResult === 'correct'
                  ? 'bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan shadow-lg shadow-neon-cyan/30'
                  : 'bg-neon-pink/20 border border-neon-pink/50 text-neon-pink shadow-lg shadow-neon-pink/30'
              )}
            >
              {answerResult === 'correct' ? '✓ 回答正确！+10分' : '✗ 回答错误！-3分'}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full text-center">
          <div className="text-sm text-white/60 mb-2">
            {isPhase('countdown') && `⏳ 倒计时 ${buzzState?.countdown ?? 0}`}
            {isPhase('playing') && !hasActiveBuzzer && '🎯 准备抢答！'}
            {isPhase('playing') && iAmActiveBuzzer && '🏃 你抢到了！'}
            {isPhase('playing') && hasActiveBuzzer && !iAmActiveBuzzer && '⌛ 等待他人作答...'}
            {isPhase('ended') && '本轮结束'}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleBuzzPress}
          disabled={!isPhase('playing') || amBuzzed || hasActiveBuzzer || amMisTouch}
          className={cn(
            'relative w-56 h-56 rounded-full flex items-center justify-center transition-all duration-200',
            'bg-gradient-to-br from-neon-pink via-neon-purple to-neon-pink',
            'shadow-[0_0_60px_rgba(255,34,136,0.5),0_0_120px_rgba(136,34,255,0.3)]',
            'border-4 border-white/20',
            buzzResult === 'success' && 'ring-8 ring-neon-cyan/60 scale-95',
            amMisTouch && 'saturate-50 opacity-60',
            (!isPhase('playing') || amBuzzed || hasActiveBuzzer) && !buzzResult && 'opacity-50 cursor-not-allowed',
            isPhase('playing') && !amBuzzed && !hasActiveBuzzer && 'animate-pulse-glow'
          )}
        >
          <div className="absolute inset-4 rounded-full bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center">
            <span className="text-7xl mb-1">👏</span>
            <span className="text-2xl font-bold font-display neon-text-glow">抢答</span>
          </div>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white/40"
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        </motion.button>

        <AnimatePresence>
          {iAmActiveBuzzer && !answerResult && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-full flex gap-4"
            >
              <button
                onClick={() => handleBuzzAnswer(true)}
                className="flex-1 py-6 rounded-2xl font-bold text-xl bg-neon-cyan/20 border-2 border-neon-cyan/50 text-neon-cyan active:scale-95 transition-all shadow-lg shadow-neon-cyan/20"
              >
                ✓ 正确
              </button>
              <button
                onClick={() => handleBuzzAnswer(false)}
                className="flex-1 py-6 rounded-2xl font-bold text-xl bg-neon-pink/20 border-2 border-neon-pink/50 text-neon-pink active:scale-95 transition-all shadow-lg shadow-neon-pink/20"
              >
                ✗ 错误
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full mt-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-2">
            <span>剩余时间</span>
            <span className="font-mono font-bold text-neon-cyan">{remainingSec}s</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full transition-colors duration-300',
                countdownPercent > 50 ? 'bg-neon-cyan' : countdownPercent > 25 ? 'bg-neon-yellow' : 'bg-neon-pink'
              )}
              animate={{ width: `${countdownPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>

        <div className="w-full mt-2">
          <div className="text-xs text-white/40 mb-2">玩家状态</div>
          <div className="flex flex-wrap gap-2">
            {activePlayers.slice(0, 8).map(p => {
              const status = getPlayerStatus(p);
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all',
                    status === 'active' && 'bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan ring-2 ring-neon-cyan/30 animate-pulse',
                    status === 'mistouch' && 'bg-neon-pink/20 border border-neon-pink/40 text-neon-pink',
                    status === 'pressed' && 'bg-neon-purple/20 border border-neon-purple/40 text-neon-purple',
                    status === 'answered' && 'bg-white/10 border border-white/20 text-white/60',
                    status === 'idle' && 'bg-white/5 border border-white/10 text-white/50'
                  )}
                >
                  <span className="text-base">{p.avatar}</span>
                  <span className="truncate max-w-[60px]">{p.nickname}</span>
                  {status === 'active' && <span>🏃</span>}
                  {status === 'mistouch' && <span>❌</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 md:p-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-lg">📚</span>
          <span className="text-sm text-white/60">分类：</span>
          <span className="font-semibold text-neon-purple">{buzzState?.question?.category ?? '-'}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-lg">👥</span>
            <span className="text-sm text-white/60">误触</span>
            <span className="font-bold text-neon-pink font-mono">{buzzState?.misTouchPlayers?.length ?? 0}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-lg">⏱️</span>
            <span className={cn(
              'font-mono text-2xl font-bold tabular-nums',
              countdownPercent > 50 ? 'text-neon-cyan' : countdownPercent > 25 ? 'text-neon-yellow' : 'text-neon-pink'
            )}>
              {localRemaining}
            </span>
            <span className="text-sm text-white/60">秒</span>
          </div>
        </div>
      </div>

      <div className="w-full h-2 mb-10 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-300',
            countdownPercent > 50 ? 'bg-neon-cyan' : countdownPercent > 25 ? 'bg-neon-yellow' : 'bg-neon-pink'
          )}
          animate={{ width: `${countdownPercent}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isPhase('countdown') ? (
            <motion.div
              key="countdown"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-center"
            >
              <div className="text-sm text-white/50 mb-4">准备抢答</div>
              <motion.div
                key={buzzState?.countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[10rem] font-black font-display neon-text-glow"
              >
                {buzzState?.countdown ?? 3}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key={buzzState?.question?.id ?? 'q'}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              className="max-w-4xl w-full"
            >
              <div className="text-center mb-8">
                <span className="inline-block px-6 py-2 rounded-full bg-neon-gradient-soft border border-white/10 text-sm mb-6">
                  第 {buzzState?.question?.id ?? 1} 题
                </span>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold text-center font-display leading-relaxed">
                {buzzState?.question?.text ?? '准备中...'}
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activePlayer && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            className="mt-6 flex justify-center"
          >
            <div className="flex items-center gap-6 px-10 py-5 rounded-3xl bg-neon-gradient shadow-[0_0_60px_rgba(255,34,136,0.6)] animate-pulse-glow">
              <span className="text-6xl">{activePlayer.avatar}</span>
              <div>
                <div className="text-sm text-white/80">抢答成功</div>
                <div className="text-3xl font-bold">{activePlayer.nickname}</div>
              </div>
              {isHost && !answerResult && (
                <div className="flex gap-3 ml-4">
                  <button
                    onClick={() => handleBuzzAnswer(true)}
                    className="px-6 py-3 rounded-xl font-bold bg-neon-cyan/30 border-2 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/40 active:scale-95 transition-all"
                  >
                    ✓ 正确 +10
                  </button>
                  <button
                    onClick={() => handleBuzzAnswer(false)}
                    className="px-6 py-3 rounded-xl font-bold bg-neon-pink/30 border-2 border-neon-pink/60 text-neon-pink hover:bg-neon-pink/40 active:scale-95 transition-all"
                  >
                    ✗ 错误 -3
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8">
        <div className="text-sm text-white/50 mb-3">玩家状态</div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {activePlayers.map(p => {
            const status = getPlayerStatus(p);
            const pScore = scores[p.id] ?? 0;
            return (
              <motion.div
                key={p.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'flex flex-col items-center p-3 rounded-xl transition-all',
                  status === 'active' && 'bg-neon-cyan/20 border-2 border-neon-cyan/60 shadow-lg shadow-neon-cyan/20',
                  status === 'mistouch' && 'bg-neon-pink/20 border-2 border-neon-pink/50',
                  status === 'pressed' && 'bg-neon-purple/20 border border-neon-purple/40',
                  status === 'answered' && 'bg-white/10 border border-white/20',
                  status === 'idle' && 'bg-white/5 border border-white/10'
                )}
              >
                <span className="text-3xl mb-1">{p.avatar}</span>
                <span className={cn(
                  'text-xs font-semibold truncate w-full text-center',
                  status === 'active' ? 'text-neon-cyan' : status === 'mistouch' ? 'text-neon-pink' : 'text-white/80'
                )}>
                  {p.nickname}
                </span>
                <span className="text-[10px] font-mono text-white/50 mt-0.5">{pScore}分</span>
                <div className="mt-1.5 h-5 flex items-center">
                  {status === 'active' && <span className="text-lg">🏃</span>}
                  {status === 'mistouch' && <span className="text-lg">❌</span>}
                  {status === 'pressed' && <span className="text-xs text-neon-purple">已按</span>}
                  {status === 'answered' && <span className="text-xs text-white/50">已答</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isPhase('ended') && isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-8 flex justify-center gap-4"
          >
            <button
              onClick={handleHostNextQuestion}
              className="neon-btn flex items-center gap-2 text-lg"
            >
              <span>🎯</span>
              下一题
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
