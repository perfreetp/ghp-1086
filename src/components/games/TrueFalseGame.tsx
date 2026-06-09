import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { emit } from '@/services/socket';
import type { TrueFalseGameState, Player } from '../../../shared/types';

interface TrueFalseGameProps {
  isMobile: boolean;
  isHost: boolean;
  player?: Player;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  value: number;
  type: 'good' | 'bad';
}

export default function TrueFalseGame({ isMobile, isHost }: TrueFalseGameProps) {
  const gameStateFromStore = useAppStore((s) => s.gameState as TrueFalseGameState | null);
  const playerId = useAppStore((s) => s.playerId);
  const players = useAppStore((s) => s.players);
  const scores = useAppStore((s) => s.scores);

  const storeButtons = gameStateFromStore?.buttons ?? [];
  const storeClicked = gameStateFromStore?.clicked ?? {};
  const phase = gameStateFromStore?.phase ?? 'countdown';
  const remainingMs = (gameStateFromStore as any)?.remainingTime ?? 0;

  const roundTime = useAppStore.getState().gameConfig?.roundTime ?? 10000;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const countdownPercent = roundTime > 0 ? (remainingMs / roundTime) * 100 : 0;

  const myClickedSet = useMemo(() => {
    const set = new Set<number>();
    const my = storeClicked[playerId ?? ''];
    if (my) my.forEach((c: any) => set.add(c.buttonId));
    return set;
  }, [storeClicked, playerId]);

  const [localFeedback, setLocalFeedback] = useState<Record<number, { correct: boolean }>>({});
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [myCorrect, setMyCorrect] = useState(0);
  const [myWrong, setMyWrong] = useState(0);
  const scoreIdRef = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === 'countdown') {
      setLocalFeedback({});
      setFloatingScores([]);
      setMyCorrect(0);
      setMyWrong(0);
    }
  }, [phase, storeButtons.length]);

  const playerStats = useMemo(() => {
    return players
      .filter((p) => !p.isSpectator)
      .map((p) => {
        const playerScore = scores[p.id] ?? 0;
        const playerClicks = storeClicked[p.id] ?? [];
        const total = playerClicks.length;
        return {
          player: p,
          score: playerScore,
          total,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [players, scores, storeClicked]);

  const accuracy = myCorrect + myWrong > 0
    ? Math.round((myCorrect / (myCorrect + myWrong)) * 100)
    : 0;

  const handleButtonClick = (buttonId: number, clientX: number, clientY: number) => {
    if (phase !== 'playing') return;
    if (myClickedSet.has(buttonId)) return;
    if (localFeedback[buttonId]) return;

    const btn = storeButtons.find((b: any) => b.id === buttonId);
    if (!btn) return;

    const isCorrect = !!btn.isReal;
    const delta = isCorrect ? 2 : -3;

    setLocalFeedback((prev) => ({ ...prev, [buttonId]: { correct: isCorrect } }));
    if (isCorrect) setMyCorrect((c) => c + 1);
    else setMyWrong((w) => w + 1);

    emit('gameAction', {
      action: 'tf_click',
      payload: { buttonId },
    });

    const id = ++scoreIdRef.current;
    const rect = areaRef.current?.getBoundingClientRect();
    const x = rect ? clientX - rect.left : btn.x;
    const y = rect ? clientY - rect.top : btn.y;
    setFloatingScores((fs) => [...fs, { id, x, y, value: delta, type: isCorrect ? 'good' : 'bad' }]);
    setTimeout(() => {
      setFloatingScores((fs) => fs.filter((f) => f.id !== id));
    }, 1000);
  };

  const btnClicked = (id: number) => {
    if (myClickedSet.has(id)) return true;
    if (localFeedback[id]) return true;
    return false;
  };

  const renderButtons = () => {
    if (storeButtons.length === 0) return null;

    const areaStyle = isMobile
      ? { width: 340, height: 380, margin: '0 auto' }
      : { width: '100%', height: 500 };

    return (
      <div
        ref={areaRef}
        className={cn(
          'relative rounded-2xl bg-white/3 border border-white/10 overflow-hidden touch-none select-none'
        )}
        style={areaStyle}
      >
        <AnimatePresence>
          {storeButtons.map((btn: any) => {
            const isClicked = btnClicked(btn.id);
            const fb = localFeedback[btn.id];
            return (
              <motion.button
                key={btn.id}
                initial={{ scale: 0, opacity: 0, rotate: -15 }}
                animate={{
                  scale: isClicked ? 0 : 1,
                  opacity: isClicked ? 0 : 1,
                  rotate: isClicked ? 15 : 0,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 22, delay: btn.id * 0.025 }}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  handleButtonClick(btn.id, touch.clientX, touch.clientY);
                }}
                onClick={(e) => {
                  handleButtonClick(btn.id, e.clientX, e.clientY);
                }}
                disabled={isClicked || phase !== 'playing'}
                style={{
                  position: 'absolute',
                  left: (btn.x as number) - (btn.size as number) / 2,
                  top: (btn.y as number) - (btn.size as number) / 2,
                  width: btn.size,
                  height: btn.size,
                }}
                className={cn(
                  'rounded-2xl font-black flex items-center justify-center transition-all border-2',
                  isMobile ? 'text-2xl' : 'text-3xl md:text-4xl',
                  !isClicked && !isMobile && 'cursor-pointer hover:scale-105',
                  !isClicked && 'active:scale-90',
                  btn.isReal
                    ? 'bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan hover:bg-neon-cyan/30 shadow-[0_0_30px_rgba(0,255,204,0.3)]'
                    : 'bg-neon-pink/20 border-neon-pink/60 text-neon-pink hover:bg-neon-pink/30 shadow-[0_0_30px_rgba(255,34,136,0.3)]'
                )}
              >
                {btn.label}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {floatingScores.map((fs) => (
          <motion.div
            key={fs.id}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: isMobile ? -60 : -80, opacity: 0, scale: isMobile ? 1.5 : 1.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={cn(
              'absolute pointer-events-none font-black font-mono z-20',
              isMobile ? 'text-xl' : 'text-2xl',
              fs.type === 'good' ? 'text-neon-cyan' : 'text-neon-pink'
            )}
            style={{
              left: fs.x,
              top: fs.y,
              transform: 'translate(-50%, -50%)',
              textShadow: fs.type === 'good'
                ? '0 0 15px rgba(0,255,204,0.9), 0 0 30px rgba(0,255,204,0.5)'
                : '0 0 15px rgba(255,34,136,0.9), 0 0 30px rgba(255,34,136,0.5)',
            }}
          >
            {fs.value > 0 ? '+' : ''}
            {fs.value}
          </motion.div>
        ))}
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm">🎯</span>
            <span className="font-bold text-neon-cyan font-mono text-xl tabular-nums">
              {scores[playerId ?? ''] ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm">⏱️</span>
            <span
              className={cn(
                'font-mono text-xl font-bold tabular-nums',
                remainingSec > 5
                  ? 'text-neon-cyan'
                  : remainingSec > 3
                  ? 'text-neon-yellow'
                  : 'text-neon-pink animate-pulse'
              )}
            >
              {remainingSec}
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
          <span className="text-neon-cyan">✓ {myCorrect}</span>
          <span className="text-white/60">准确率 {accuracy}%</span>
          <span className="text-neon-pink">✗ {myWrong}</span>
        </div>

        {renderButtons()}

        <AnimatePresence>
          {phase === 'ended' && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center py-4"
            >
              <div className="text-2xl font-bold mb-4">
                回合结束！
                <span className="neon-text ml-2">
                  {scores[playerId ?? ''] ?? 0}分
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 md:p-10 overflow-y-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-lg">🎯</span>
          <span className="text-sm text-white/60">第</span>
          <span className="font-bold text-neon-purple font-mono text-xl">
            {useAppStore.getState().currentRound || 1}
          </span>
          <span className="text-sm text-white/60">轮</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30">
            <span className="text-lg">✓</span>
            <span className="text-sm text-white/60">正确</span>
            <span className="font-bold text-neon-cyan font-mono text-xl tabular-nums">
              {myCorrect}
            </span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-neon-pink/10 border border-neon-pink/30">
            <span className="text-lg">✗</span>
            <span className="text-sm text-white/60">错误</span>
            <span className="font-bold text-neon-pink font-mono text-xl tabular-nums">
              {myWrong}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-lg">⏱️</span>
          <span
            className={cn(
              'font-mono text-2xl font-bold tabular-nums',
              remainingSec > 5
                ? 'text-neon-cyan'
                : remainingSec > 3
                ? 'text-neon-yellow'
                : 'text-neon-pink animate-pulse'
            )}
          >
            {remainingSec}
          </span>
          <span className="text-sm text-white/60">秒</span>
        </div>
      </div>

      <div className="w-full h-2 mb-6 rounded-full bg-white/10 overflow-hidden">
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

      <div className="flex-1 flex items-start justify-center gap-6 md:gap-12 min-h-0">
        <div className="flex-1 max-w-5xl min-w-0">
          {renderButtons()}
        </div>

        <div className="w-64 shrink-0 space-y-5">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-2">我的得分</div>
            <div className="text-5xl font-black font-mono neon-text-glow tabular-nums">
              {scores[playerId ?? ''] ?? 0}
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

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3 max-h-72 overflow-y-auto">
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
                  <div className="text-xs text-white/40">点击 {stat.total} 次</div>
                </div>
                <div className="font-mono font-bold text-neon-cyan tabular-nums">
                  {stat.score}
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-3xl bg-neon-gradient-soft border border-white/10">
            <div className="text-sm text-white/70 mb-3 text-center">游戏规则</div>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-start gap-2">
                <span className="text-neon-cyan">●</span>
                点 <span className="text-neon-cyan font-bold mx-1">真</span> +2 分
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-pink">●</span>
                点 <span className="text-neon-pink font-bold mx-1">假</span> -3 分
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-yellow">●</span>
                按钮一致，抓紧时间多抢分！
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
