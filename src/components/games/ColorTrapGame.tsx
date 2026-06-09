import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore, getMyPlayer } from '@/store';
import { emit, on } from '@/services/socket';
import type { Player, ColorTrapGameState, GamePhase } from '../../../shared/types';

interface ColorTrapGameProps {
  isMobile: boolean;
  isHost: boolean;
  player?: Player;
}

const COLOR_HEX_TO_NAME: Record<string, string> = {
  '#FF3366': '红色',
  '#3399FF': '蓝色',
  '#33FF99': '绿色',
  '#FFDD33': '黄色',
  '#CC66FF': '紫色',
  '#FF9933': '橙色',
};

export default function ColorTrapGame({ isMobile, isHost }: ColorTrapGameProps) {
  const { gameState, playerId, players, scores } = useAppStore();
  const me = getMyPlayer(useAppStore.getState());
  const colorState = gameState as (ColorTrapGameState & { remainingTime?: number }) | null;

  const [localRemaining, setLocalRemaining] = useState(0);
  const [myAnswer, setMyAnswer] = useState<'match' | 'mismatch' | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<{
    correct: boolean;
    score: number;
    timeBonus: number;
  } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [combo, setCombo] = useState(0);

  const activePlayers = useMemo(() => players.filter(p => !p.isSpectator), [players]);
  const roundTime = useAppStore.getState().gameConfig?.roundTime ?? 8000;
  const remainingMs = colorState?.remainingTime ?? 0;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const countdownPercent = roundTime > 0 ? (remainingMs / roundTime) * 100 : 0;

  const question = colorState?.question;
  const displayColor = question?.displayColor ?? '#FFFFFF';
  const wordMeaning = question?.word ?? '';
  const colorName = COLOR_HEX_TO_NAME[displayColor] ?? '未知色';

  useEffect(() => {
    if (colorState?.phase === 'playing' || colorState?.phase === 'countdown') {
      setLocalRemaining(remainingSec);
    }
  }, [remainingSec, colorState?.phase]);

  useEffect(() => {
    if (colorState?.phase === 'countdown') {
      setMyAnswer(null);
      setAnswerFeedback(null);
    }
  }, [colorState?.phase, question?.word, question?.displayColor]);

  useEffect(() => {
    const unsub = on('gameActionResult', ({ action, result }: any) => {
      if (action === 'color_answer' && playerId === me?.id) {
        setAnswerFeedback({
          correct: result.correct,
          score: result.correct ? 5 + result.timeBonus : -2,
          timeBonus: result.timeBonus ?? 0,
        });
        if (result.correct) {
          setCorrectCount(c => c + 1);
          setCombo(c => c + 1);
        } else {
          setWrongCount(w => w + 1);
          setCombo(0);
        }
      }
    });
    return () => { unsub(); };
  }, [playerId, me?.id]);

  const isPhase = (phase: GamePhase) => colorState?.phase === phase;
  const hasAnswered = !!(playerId && colorState?.answers?.[playerId]);

  const handleAnswer = (answer: 'match' | 'mismatch') => {
    if (!isPhase('playing') || hasAnswered || myAnswer) return;
    setMyAnswer(answer);
    emit('gameAction', { action: 'color_answer', payload: { answer } });
  };

  const getPlayerStatus = (p: Player) => {
    const ans = colorState?.answers?.[p.id];
    if (!ans) return 'waiting';
    return ans.correct ? 'correct' : 'wrong';
  };

  const answeredCount = Object.keys(colorState?.answers ?? {}).length;
  const totalActive = activePlayers.length;

  if (isMobile) {
    return (
      <div className="h-full flex flex-col items-center justify-between p-6">
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm text-white/60">正确</span>
            <span className="font-bold text-neon-cyan font-mono">{correctCount}</span>
          </div>
          {combo >= 2 && (
            <motion.div
              key={combo}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neon-yellow/20 border border-neon-yellow/40"
            >
              <span className="text-lg">🔥</span>
              <span className="font-bold text-neon-yellow font-mono">{combo}</span>
            </motion.div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm text-white/60">错误</span>
            <span className="font-bold text-neon-pink font-mono">{wrongCount}</span>
          </div>
        </div>

        <div className="w-full mb-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-2">
            <span>剩余时间</span>
            <span className="font-mono font-bold text-neon-cyan">{remainingSec}s</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full transition-colors',
                countdownPercent > 50 ? 'bg-neon-cyan' : countdownPercent > 25 ? 'bg-neon-yellow' : 'bg-neon-pink'
              )}
              initial={{ width: '100%' }}
              animate={{ width: `${countdownPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            {isPhase('countdown') ? (
              <motion.div
                key="countdown"
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-center"
              >
                <div className="text-sm text-white/50 mb-4">准备...</div>
                <motion.div
                  key={colorState?.countdown}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-[8rem] font-black font-display neon-text-glow"
                >
                  {colorState?.countdown ?? 3}
                </motion.div>
              </motion.div>
            ) : question ? (
              <motion.div
                key={question.word + question.displayColor}
                initial={{ scale: 0.8, opacity: 0, rotateX: -20 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                exit={{ scale: 1.2, opacity: 0, rotateX: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="flex flex-col items-center w-full"
              >
                <div className="text-sm text-white/50 mb-2">文字显示颜色：</div>
                <div className="text-xl font-bold mb-6" style={{ color: displayColor }}>
                  {colorName}
                </div>
                <motion.div
                  className="text-8xl md:text-9xl font-black font-display mb-6"
                  style={{
                    color: displayColor,
                    textShadow: `0 0 30px ${displayColor}80, 0 0 60px ${displayColor}40`,
                  }}
                >
                  {question.word.replace('色', '')}
                </motion.div>
                <div className="text-sm text-white/50">文字含义：{wordMeaning}</div>
                <div className="text-xs text-white/40 mt-2">判断：颜色和含义一致吗？</div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {answerFeedback && (
              <motion.div
                initial={{ scale: 0, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: -20 }}
                className="absolute top-1/3 z-20"
              >
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    'flex flex-col items-center gap-1 px-8 py-4 rounded-3xl font-black',
                    answerFeedback.correct
                      ? 'bg-neon-cyan/20 border-2 border-neon-cyan/50 text-neon-cyan'
                      : 'bg-neon-pink/20 border-2 border-neon-pink/50 text-neon-pink'
                  )}
                >
                  <span className="text-4xl">
                    {answerFeedback.correct ? '✓' : '✗'}
                  </span>
                  <span className="text-3xl font-mono">
                    {answerFeedback.score > 0 ? '+' : ''}{answerFeedback.score}
                  </span>
                  {answerFeedback.correct && answerFeedback.timeBonus > 0 && (
                    <span className="text-xs opacity-70">
                      时间奖励 +{answerFeedback.timeBonus}
                    </span>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-full space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer('match')}
              disabled={!isPhase('playing') || hasAnswered || !!myAnswer}
              className={cn(
                'relative py-10 rounded-2xl font-bold text-xl transition-all',
                'bg-neon-cyan/20 border-2 border-neon-cyan/40 text-neon-cyan',
                'active:bg-neon-cyan/30',
                myAnswer === 'match' && answerFeedback?.correct && 'ring-4 ring-neon-cyan/60 scale-95',
                myAnswer === 'match' && !answerFeedback?.correct && answerFeedback && 'ring-4 ring-neon-pink/60',
                (myAnswer || hasAnswered) && myAnswer !== 'match' && 'opacity-40',
                (!isPhase('playing') || hasAnswered) && !myAnswer && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-3xl block mb-2">✓</span>
              一致
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer('mismatch')}
              disabled={!isPhase('playing') || hasAnswered || !!myAnswer}
              className={cn(
                'relative py-10 rounded-2xl font-bold text-xl transition-all',
                'bg-neon-pink/20 border-2 border-neon-pink/40 text-neon-pink',
                'active:bg-neon-pink/30',
                myAnswer === 'mismatch' && answerFeedback?.correct && 'ring-4 ring-neon-pink/60 scale-95',
                myAnswer === 'mismatch' && !answerFeedback?.correct && answerFeedback && 'ring-4 ring-neon-pink/60',
                (myAnswer || hasAnswered) && myAnswer !== 'mismatch' && 'opacity-40',
                (!isPhase('playing') || hasAnswered) && !myAnswer && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-3xl block mb-2">✗</span>
              不一致
            </motion.button>
          </div>

          <div className="mt-2">
            <div className="text-xs text-white/40 mb-2">
              玩家状态 ({answeredCount}/{totalActive})
            </div>
            <div className="flex flex-wrap gap-2">
              {activePlayers.slice(0, 8).map(p => {
                const status = getPlayerStatus(p);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all',
                      status === 'correct' && 'bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan',
                      status === 'wrong' && 'bg-neon-pink/20 border border-neon-pink/40 text-neon-pink',
                      status === 'waiting' && 'bg-white/5 border border-white/10 text-white/50'
                    )}
                  >
                    <span className="text-base">{p.avatar}</span>
                    <span className="truncate max-w-[60px]">{p.nickname}</span>
                    {status === 'correct' && <span>✓</span>}
                    {status === 'wrong' && <span>✗</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 md:p-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30">
            <span className="text-lg">✓</span>
            <span className="text-sm text-white/60">正确</span>
            <span className="font-bold text-neon-cyan font-mono text-xl tabular-nums">{correctCount}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-neon-pink/10 border border-neon-pink/30">
            <span className="text-lg">✗</span>
            <span className="text-sm text-white/60">错误</span>
            <span className="font-bold text-neon-pink font-mono text-xl tabular-nums">{wrongCount}</span>
          </div>
          {combo >= 2 && (
            <motion.div
              key={combo}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-yellow/20 border border-neon-yellow/40"
            >
              <span className="text-xl">🔥</span>
              <span className="font-bold text-neon-yellow">连击 x{combo}</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-lg">👥</span>
          <span className="text-sm text-white/60">已答</span>
          <span className="font-bold text-neon-purple font-mono text-xl tabular-nums">
            {answeredCount}/{totalActive}
          </span>
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
              <div className="text-xl text-white/50 mb-6">准备好了吗？</div>
              <motion.div
                key={colorState?.countdown}
                initial={{ scale: 2, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                className="text-[12rem] font-black font-display neon-text-glow"
              >
                {colorState?.countdown ?? 3}
              </motion.div>
            </motion.div>
          ) : question ? (
            <motion.div
              key={question.word + question.displayColor}
              initial={{ y: 60, opacity: 0, rotateX: -20 }}
              animate={{ y: 0, opacity: 1, rotateX: 0 }}
              exit={{ y: -60, opacity: 0, rotateX: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center"
            >
              <div className="text-xl text-white/50 mb-8">
                这个文字的<span className="text-white/80 font-semibold"> 显示颜色 </span>
                和文字<span className="text-white/80 font-semibold"> 含义 </span>一致吗？
              </div>
              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="text-2xl">
                  <span className="text-white/50">显示颜色：</span>
                  <span className="font-bold" style={{ color: displayColor }}>{colorName}</span>
                </div>
                <div className="text-4xl text-white/30">VS</div>
                <div className="text-2xl">
                  <span className="text-white/50">文字含义：</span>
                  <span className="font-bold text-white/80">{wordMeaning}</span>
                </div>
              </div>
              <motion.div
                className="text-9xl md:text-[14rem] font-black font-display leading-none"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  color: displayColor,
                  textShadow: `0 0 60px ${displayColor}60, 0 0 120px ${displayColor}30`,
                }}
              >
                {question.word.replace('色', '')}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {answerFeedback && playerId === me?.id && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="mt-8 flex justify-center"
          >
            <div className={cn(
              'flex items-center gap-4 px-10 py-5 rounded-3xl font-black text-2xl',
              answerFeedback.correct
                ? 'bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan shadow-[0_0_40px_rgba(0,255,204,0.3)]'
                : 'bg-neon-pink/20 border border-neon-pink/40 text-neon-pink shadow-[0_0_40px_rgba(255,34,136,0.3)]'
            )}>
              <span className="text-4xl">{answerFeedback.correct ? '🎉' : '💔'}</span>
              <div>
                <div>{answerFeedback.correct ? '回答正确！' : '回答错误'}</div>
                <div className="text-lg font-mono">
                  {answerFeedback.score > 0 ? '+' : ''}{answerFeedback.score} 分
                  {answerFeedback.correct && answerFeedback.timeBonus > 0 && (
                    <span className="text-sm opacity-70 ml-2">
                      (含时间奖励 +{answerFeedback.timeBonus})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8">
        <div className="text-sm text-white/50 mb-3">答题进度</div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {activePlayers.map(p => {
            const status = getPlayerStatus(p);
            const pScore = scores[p.id] ?? 0;
            const ans = colorState?.answers?.[p.id];
            return (
              <motion.div
                key={p.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'flex flex-col items-center p-3 rounded-xl transition-all',
                  status === 'correct' && 'bg-neon-cyan/20 border-2 border-neon-cyan/50 shadow-lg shadow-neon-cyan/10',
                  status === 'wrong' && 'bg-neon-pink/20 border-2 border-neon-pink/40',
                  status === 'waiting' && 'bg-white/5 border border-white/10'
                )}
              >
                <span className="text-3xl mb-1">{p.avatar}</span>
                <span className={cn(
                  'text-xs font-semibold truncate w-full text-center',
                  status === 'correct' ? 'text-neon-cyan' : status === 'wrong' ? 'text-neon-pink' : 'text-white/80'
                )}>
                  {p.nickname}
                </span>
                <span className="text-[10px] font-mono text-white/50 mt-0.5">{pScore}分</span>
                <div className="mt-1.5 h-5 flex items-center gap-1">
                  {status === 'correct' && <span className="text-lg">✓</span>}
                  {status === 'wrong' && <span className="text-lg">✗</span>}
                  {status === 'waiting' && <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />}
                  {ans && (
                    <span className="text-[10px] font-mono text-white/40">
                      {ans.time < 2000 ? '⚡' : ans.time < 4000 ? '🚀' : ''}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
