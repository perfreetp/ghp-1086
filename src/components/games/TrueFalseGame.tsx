import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { emit } from '@/services/socket';
import type { TrueFalseButton, TrueFalseGameState, Player } from '../../../shared/types';

interface TrueFalseGameProps {
  isMobile: boolean;
  isHost: boolean;
  player?: Player;
}

interface ButtonState extends TrueFalseButton {
  clicked: boolean;
  clickedCorrect?: boolean;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  value: number;
  type: 'good' | 'bad';
}

function generateButtons(count: number, areaWidth: number, areaHeight: number): ButtonState[] {
  const buttons: ButtonState[] = [];
  const minSize = 60;
  const maxSize = 110;
  const usedPositions: { x: number; y: number; size: number }[] = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < 100) {
      const size = minSize + Math.random() * (maxSize - minSize);
      const isReal = Math.random() > 0.4;
      const x = size + Math.random() * (areaWidth - size * 2);
      const y = size + Math.random() * (areaHeight - size * 2);

      let overlap = false;
      for (const pos of usedPositions) {
        const dx = Math.abs(x - pos.x);
        const dy = Math.abs(y - pos.y);
        const minDist = (size + pos.size) / 2 + 10;
        if (dx < minDist && dy < minDist) {
          overlap = true;
          break;
        }
      }

      if (!overlap) {
        usedPositions.push({ x, y, size });
        buttons.push({
          id: i,
          isReal,
          x,
          y,
          size,
          label: isReal ? '真' : '假',
          clicked: false,
        });
        placed = true;
      }
      attempts++;
    }
  }

  return buttons;
}

export default function TrueFalseGame({ isMobile, isHost, player }: TrueFalseGameProps) {
  const gameStateFromStore = useAppStore((s) => s.gameState as TrueFalseGameState | null);
  const playerId = useAppStore((s) => s.playerId);
  const players = useAppStore((s) => s.players);
  const scores = useAppStore((s) => s.scores);

  const storeGameState = gameStateFromStore ?? {
    phase: 'countdown' as const,
    buttons: [],
    clicked: {},
    scores: {},
    countdown: 20,
  };

  const [buttons, setButtons] = useState<ButtonState[]>([]);
  const [localCountdown, setLocalCountdown] = useState(storeGameState.countdown || 20);
  const [localScore, setLocalScore] = useState(0);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const scoreIdRef = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const myClickedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const storeButtons = storeGameState.buttons;
    if (storeButtons && storeButtons.length > 0 && buttons.length === 0) {
      setButtons(storeButtons.map((b) => ({ ...b, clicked: false })));
    }
  }, [storeGameState.buttons]);

  const startRound = useCallback(() => {
    setButtons([]);
    myClickedRef.current.clear();
    setTimeout(() => {
      const width = isMobile ? 340 : 900;
      const height = isMobile ? 380 : 500;
      const count = isMobile ? 8 : 16;
      const newButtons = generateButtons(count, width, height);
      setButtons(newButtons);
      setLocalCountdown(20);
      setTotalCorrect(0);
      setTotalWrong(0);
      setLocalScore(0);
    }, 300);
  }, [isMobile]);

  useEffect(() => {
    const timer = setTimeout(startRound, 500);
    return () => clearTimeout(timer);
  }, [startRound]);

  useEffect(() => {
    if (storeGameState.phase === 'playing' && localCountdown > 0) {
      const timer = setInterval(() => {
        setLocalCountdown((c) => c - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [localCountdown, storeGameState.phase]);

  const handleButtonClick = useCallback(
    (buttonId: number, clientX: number, clientY: number) => {
      if (myClickedRef.current.has(buttonId)) return;

      setButtons((prev) => {
        const btn = prev.find((b) => b.id === buttonId);
        if (!btn || btn.clicked) return prev;

        myClickedRef.current.add(buttonId);
        const isCorrect = btn.isReal;
        const delta = isCorrect ? 2 : -3;
        setLocalScore((s) => s + delta);

        if (isCorrect) {
          setTotalCorrect((c) => c + 1);
        } else {
          setTotalWrong((w) => w + 1);
        }

        emit('gameAction', {
          action: 'tf_click',
          payload: {
            buttonId,
            isCorrect,
            delta,
            timestamp: Date.now(),
          },
        });

        const id = ++scoreIdRef.current;
        const rect = areaRef.current?.getBoundingClientRect();
        const x = rect ? clientX - rect.left : btn.x;
        const y = rect ? clientY - rect.top : btn.y;
        setFloatingScores((fs) => [...fs, { id, x, y, value: delta, type: isCorrect ? 'good' : 'bad' }]);
        setTimeout(() => {
          setFloatingScores((fs) => fs.filter((f) => f.id !== id));
        }, 1000);

        return prev.map((b) =>
          b.id === buttonId ? { ...b, clicked: true, clickedCorrect: isCorrect } : b
        );
      });
    },
    [playerId]
  );

  const handleNextRound = () => {
    startRound();
  };

  const accuracy = totalCorrect + totalWrong > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  const countdownPercent = (localCountdown / 20) * 100;

  const playerStats = useMemo(() => {
    return players
      .filter((p) => !p.isSpectator)
      .map((p) => {
        const playerScore = scores[p.id] ?? 0;
        const playerClicks = storeGameState.clicked?.[p.id] ?? [];
        const correct = playerClicks.filter((c: any) => c.isCorrect).length;
        const total = playerClicks.length;
        const pAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        return {
          player: p,
          score: playerScore,
          correct,
          total,
          accuracy: pAccuracy,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [players, scores, storeGameState.clicked]);

  if (isMobile) {
    return (
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm">🎯</span>
            <span className="font-bold text-neon-cyan font-mono text-xl tabular-nums">
              {scores[playerId ?? ''] ?? localScore}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm">⏱️</span>
            <span
              className={cn(
                'font-mono text-xl font-bold tabular-nums',
                localCountdown > 10
                  ? 'text-neon-cyan'
                  : localCountdown > 5
                  ? 'text-neon-yellow'
                  : 'text-neon-pink animate-pulse'
              )}
            >
              {localCountdown}
            </span>
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full transition-colors',
              countdownPercent > 50
                ? 'bg-neon-cyan'
                : countdownPercent > 25
                ? 'bg-neon-yellow'
                : 'bg-neon-pink'
            )}
            animate={{ width: `${countdownPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-neon-cyan">✓ {totalCorrect}</span>
          <span className="text-white/60">准确率 {accuracy}%</span>
          <span className="text-neon-pink">✗ {totalWrong}</span>
        </div>

        <div
          ref={areaRef}
          className="flex-1 relative rounded-2xl bg-white/3 border border-white/10 overflow-hidden touch-none select-none"
          style={{ minHeight: 380 }}
        >
          <AnimatePresence>
            {buttons.map((btn) => (
              <motion.button
                key={btn.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: btn.clicked ? 0 : 1,
                  opacity: btn.clicked ? 0 : 1,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25, delay: btn.id * 0.03 }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  handleButtonClick(btn.id, touch.clientX, touch.clientY);
                }}
                onClick={(e) => {
                  handleButtonClick(btn.id, e.clientX, e.clientY);
                }}
                disabled={btn.clicked || storeGameState.phase !== 'playing'}
                style={{
                  position: 'absolute',
                  left: btn.x - btn.size / 2,
                  top: btn.y - btn.size / 2,
                  width: btn.size,
                  height: btn.size,
                }}
                className={cn(
                  'rounded-2xl font-black text-2xl flex items-center justify-center transition-all border-2',
                  btn.isReal
                    ? 'bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/30 active:scale-90 shadow-[0_0_30px_rgba(0,255,204,0.3)]'
                    : 'bg-neon-pink/20 border-neon-pink/60 text-neon-pink hover:bg-neon-pink/30 active:scale-90 shadow-[0_0_30px_rgba(255,34,136,0.3)]'
                )}
              >
                {btn.label}
              </motion.button>
            ))}
          </AnimatePresence>

          {floatingScores.map((fs) => (
            <motion.div
              key={fs.id}
              initial={{ y: 0, opacity: 1, scale: 1 }}
              animate={{ y: -60, opacity: 0, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={cn(
                'absolute pointer-events-none font-black text-xl font-mono',
                fs.type === 'good' ? 'text-neon-cyan' : 'text-neon-pink'
              )}
              style={{
                left: fs.x,
                top: fs.y,
                transform: 'translate(-50%, -50%)',
                textShadow: fs.type === 'good'
                  ? '0 0 10px rgba(0,255,204,0.8)'
                  : '0 0 10px rgba(255,34,136,0.8)',
              }}
            >
              {fs.value > 0 ? '+' : ''}
              {fs.value}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {storeGameState.phase === 'ended' && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center py-4"
            >
              <div className="text-2xl font-bold mb-4">
                回合结束！
                <span className="neon-text ml-2">
                  {scores[playerId ?? ''] ?? localScore}分
                </span>
              </div>
              {isHost && (
                <button onClick={handleNextRound} className="neon-btn">
                  下一轮
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 md:p-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-lg">🎯</span>
          <span className="text-sm text-white/60">第</span>
          <span className="font-bold text-neon-purple font-mono text-xl">
            {useAppStore.getState().currentRound || 1}
          </span>
          <span className="text-sm text-white/60">轮</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30">
            <span className="text-lg">✓</span>
            <span className="text-sm text-white/60">正确</span>
            <span className="font-bold text-neon-cyan font-mono text-xl tabular-nums">
              {totalCorrect}
            </span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-neon-pink/10 border border-neon-pink/30">
            <span className="text-lg">✗</span>
            <span className="text-sm text-white/60">错误</span>
            <span className="font-bold text-neon-pink font-mono text-xl tabular-nums">
              {totalWrong}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-lg">⏱️</span>
          <span
            className={cn(
              'font-mono text-2xl font-bold tabular-nums',
              localCountdown > 10
                ? 'text-neon-cyan'
                : localCountdown > 5
                ? 'text-neon-yellow'
                : 'text-neon-pink animate-pulse'
            )}
          >
            {localCountdown}
          </span>
          <span className="text-sm text-white/60">秒</span>
        </div>
      </div>

      <div className="w-full h-2 mb-8 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-300',
            countdownPercent > 50
              ? 'bg-neon-cyan'
              : countdownPercent > 25
              ? 'bg-neon-yellow'
              : 'bg-neon-pink'
          )}
          animate={{ width: `${countdownPercent}%` }}
        />
      </div>

      <div className="flex-1 flex items-start justify-center gap-12">
        <div className="flex-1 max-w-5xl">
          <div
            ref={areaRef}
            className="relative w-full rounded-3xl bg-white/3 border border-white/10 overflow-hidden"
            style={{ height: 500 }}
          >
            <AnimatePresence>
              {buttons.map((btn) => (
                <motion.button
                  key={btn.id}
                  initial={{ scale: 0, opacity: 0, rotate: -15 }}
                  animate={{
                    scale: btn.clicked ? 0 : 1,
                    opacity: btn.clicked ? 0 : 1,
                    rotate: btn.clicked ? 15 : 0,
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22, delay: btn.id * 0.025 }}
                  onClick={(e) => handleButtonClick(btn.id, e.clientX, e.clientY)}
                  disabled={btn.clicked || storeGameState.phase !== 'playing'}
                  style={{
                    position: 'absolute',
                    left: btn.x - btn.size / 2,
                    top: btn.y - btn.size / 2,
                    width: btn.size,
                    height: btn.size,
                  }}
                  className={cn(
                    'rounded-2xl font-black flex items-center justify-center transition-all border-2 cursor-pointer',
                    btn.isReal
                      ? 'bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/30 hover:scale-105 active:scale-90 shadow-[0_0_40px_rgba(0,255,204,0.3)]'
                      : 'bg-neon-pink/20 border-neon-pink/60 text-neon-pink hover:bg-neon-pink/30 hover:scale-105 active:scale-90 shadow-[0_0_40px_rgba(255,34,136,0.3)]'
                  )}
                >
                  <span className="text-3xl md:text-4xl">{btn.label}</span>
                </motion.button>
              ))}
            </AnimatePresence>

            {floatingScores.map((fs) => (
              <motion.div
                key={fs.id}
                initial={{ y: 0, opacity: 1, scale: 1 }}
                animate={{ y: -80, opacity: 0, scale: 1.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={cn(
                  'absolute pointer-events-none font-black text-2xl font-mono z-20',
                  fs.type === 'good' ? 'text-neon-cyan' : 'text-neon-pink'
                )}
                style={{
                  left: fs.x,
                  top: fs.y,
                  transform: 'translate(-50%, -50%)',
                  textShadow: fs.type === 'good'
                    ? '0 0 20px rgba(0,255,204,0.9), 0 0 40px rgba(0,255,204,0.5)'
                    : '0 0 20px rgba(255,34,136,0.9), 0 0 40px rgba(255,34,136,0.5)',
                }}
              >
                {fs.value > 0 ? '+' : ''}
                {fs.value}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="w-64 shrink-0 space-y-6">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-2">当前得分</div>
            <div className="text-5xl font-black font-mono neon-text-glow tabular-nums">
              {scores[playerId ?? ''] ?? localScore}
            </div>
            <div className="text-sm text-white/40 mt-2">分</div>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
            <div className="text-sm text-white/60 mb-4">命中率</div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
                    animate={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-neon-purple tabular-nums">
                {accuracy}%
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3 max-h-80 overflow-y-auto">
            <div className="text-sm text-white/60 mb-3 font-semibold">实时排行</div>
            {playerStats.map((stat, idx) => (
              <div
                key={stat.player.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-xl',
                  stat.player.id === playerId && 'bg-neon-purple/10 border border-neon-purple/30'
                )}
              >
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black',
                    idx === 0 && 'bg-neon-yellow/30 text-neon-yellow',
                    idx === 1 && 'bg-white/20 text-white/80',
                    idx === 2 && 'bg-orange-400/30 text-orange-300',
                    idx > 2 && 'bg-white/5 text-white/40'
                  )}
                >
                  {idx + 1}
                </span>
                <span className="text-xl">{stat.player.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{stat.player.nickname}</div>
                  <div className="text-xs text-white/40">
                    {stat.correct}/{stat.total} · {stat.accuracy}%
                  </div>
                </div>
                <div className="font-mono font-bold text-neon-cyan tabular-nums">
                  {stat.score}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-3xl bg-neon-gradient-soft border border-white/10">
            <div className="text-sm text-white/70 mb-3 text-center">游戏提示</div>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-neon-cyan">●</span>
                点击 <span className="text-neon-cyan font-bold mx-1">真</span> 按钮 +2 分
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-pink">●</span>
                误点 <span className="text-neon-pink font-bold mx-1">假</span> 按钮 -3 分
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-yellow">●</span>
                时间结束前尽量多点！
              </li>
            </ul>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {storeGameState.phase === 'ended' && isHost && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-8 flex justify-center"
          >
            <button onClick={handleNextRound} className="neon-btn flex items-center gap-2 text-lg">
              <span>🎯</span>
              开始下一轮
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
