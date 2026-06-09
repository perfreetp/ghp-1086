import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { emit } from '@/services/socket';
import type { RhythmGameState, RhythmNote, Player } from '../../../shared/types';

interface RhythmGameProps {
  isMobile: boolean;
  isHost: boolean;
  player?: Player;
}

interface NoteState extends RhythmNote {
  y: number;
  missed: boolean;
}

interface HitEffect {
  id: number;
  lane: number;
  type: 'perfect' | 'good' | 'miss';
}

const LANE_COLORS = ['#FF2288', '#8822FF', '#00FFCC', '#FFDD00'];
const LANE_ICONS = ['♡', '★', '♪', '✦'];
const NOTE_SPEED = 4;
const HIT_LINE_OFFSET = 80;
const PERFECT_RANGE = 25;
const GOOD_RANGE = 55;

function generateNotes(duration: number, bpm: number): { id: number; lane: number; time: number }[] {
  const notes: { id: number; lane: number; time: number }[] = [];
  const interval = (60 / bpm) * 1000;
  let id = 0;

  for (let t = 1000; t < duration; t += interval / 2) {
    if (Math.random() > 0.3) {
      const laneCount = Math.random() > 0.85 ? 2 : 1;
      const usedLanes: number[] = [];
      for (let i = 0; i < laneCount; i++) {
        let lane: number;
        do {
          lane = Math.floor(Math.random() * 4);
        } while (usedLanes.includes(lane));
        usedLanes.push(lane);
        notes.push({ id: id++, lane, time: t });
      }
    }
  }

  return notes;
}

export default function RhythmGame({ isMobile, isHost, player }: RhythmGameProps) {
  const gameStateFromStore = useAppStore((s) => s.gameState as RhythmGameState | null);
  const playerId = useAppStore((s) => s.playerId);
  const players = useAppStore((s) => s.players);
  const scores = useAppStore((s) => s.scores);

  const storeGameState = gameStateFromStore ?? {
    phase: 'countdown' as const,
    notes: [],
    hits: {},
    bpm: 120,
    countdown: 30,
    startTime: undefined,
  };

  const [localScore, setLocalScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [notes, setNotes] = useState<NoteState[]>([]);
  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [judgment, setJudgment] = useState<{ text: string; type: 'perfect' | 'good' | 'miss' } | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [localCountdown, setLocalCountdown] = useState(storeGameState.countdown || 30);
  const animationRef = useRef<number>();
  const noteScheduleRef = useRef<{ id: number; lane: number; time: number }[]>([]);
  const nextNoteIdRef = useRef(0);
  const hitIdRef = useRef(0);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const hitNoteIdsRef = useRef<Set<number>>(new Set());

  const storeNotes = storeGameState.notes ?? [];

  const startGame = useCallback(() => {
    const schedule = generateNotes(30000, 120);
    noteScheduleRef.current = schedule;
    nextNoteIdRef.current = 0;
    hitNoteIdsRef.current.clear();
    setNotes([]);
    setLocalScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setHitEffects([]);
    setLocalCountdown(30);
    const now = performance.now();
    setStartTime(now);
  }, []);

  useEffect(() => {
    if (storeNotes.length > 0 && storeGameState.startTime) {
      noteScheduleRef.current = storeNotes.map((n) => ({
        id: n.id,
        lane: n.lane,
        time: n.startTime,
      }));
      nextNoteIdRef.current = 0;
      hitNoteIdsRef.current.clear();
      setNotes([]);
      setStartTime(performance.now());
    }
  }, [storeNotes]);

  useEffect(() => {
    const timer = setTimeout(startGame, 500);
    return () => clearTimeout(timer);
  }, [startGame]);

  useEffect(() => {
    if (storeGameState.phase !== 'playing' || startTime === null) return;

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;

      const height = trackAreaRef.current?.clientHeight ?? 600;
      const hitY = height - HIT_LINE_OFFSET;

      while (
        nextNoteIdRef.current < noteScheduleRef.current.length &&
        noteScheduleRef.current[nextNoteIdRef.current].time <=
          elapsed + (hitY / NOTE_SPEED) * 16.67
      ) {
        const scheduled = noteScheduleRef.current[nextNoteIdRef.current];
        const spawnTime = scheduled.time - (hitY / NOTE_SPEED) * 16.67;
        const spawnY = ((elapsed - spawnTime) / 16.67) * NOTE_SPEED;

        if (!hitNoteIdsRef.current.has(scheduled.id)) {
          setNotes((prev) => [
            ...prev,
            {
              id: scheduled.id,
              lane: scheduled.lane,
              startTime: scheduled.time,
              y: spawnY,
              hit: false,
              missed: false,
            },
          ]);
        }
        nextNoteIdRef.current++;
      }

      setNotes((prev) => {
        let updated = false;
        const newNotes = prev.map((note) => {
          if (note.hit || note.missed) return note;
          const newY = note.y + NOTE_SPEED;

          if (newY > hitY + GOOD_RANGE && !note.missed) {
            updated = true;
            setCombo(0);
            setMissCount((m) => m + 1);
            showJudgment('miss', note.lane);
            return { ...note, y: newY, missed: true };
          }

          if (newY !== note.y) updated = true;
          return { ...note, y: newY };
        }).filter((n) => n.y < height + 100);

        return updated ? newNotes : prev;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [storeGameState.phase, startTime]);

  useEffect(() => {
    if (storeGameState.phase === 'playing' && localCountdown > 0) {
      const timer = setTimeout(() => {
        setLocalCountdown((c) => c - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [localCountdown, storeGameState.phase]);

  const showJudgment = (type: 'perfect' | 'good' | 'miss', lane: number) => {
    const text = type === 'perfect' ? 'PERFECT!' : type === 'good' ? 'GOOD!' : 'MISS';
    setJudgment({ text, type });
    setTimeout(() => setJudgment(null), 600);

    const id = ++hitIdRef.current;
    setHitEffects((prev) => [...prev, { id, lane, type }]);
    setTimeout(() => {
      setHitEffects((prev) => prev.filter((e) => e.id !== id));
    }, 500);
  };

  const handleLaneHit = useCallback(
    (lane: number) => {
      setActiveLanes((prev) => {
        const next = [...prev];
        next[lane] = true;
        return next;
      });
      setTimeout(() => {
        setActiveLanes((prev) => {
          const next = [...prev];
          next[lane] = false;
          return next;
        });
      }, 100);

      if (storeGameState.phase !== 'playing') return;

      const height = trackAreaRef.current?.clientHeight ?? 600;
      const hitY = height - HIT_LINE_OFFSET;

      let targetNote: NoteState | null = null;
      let minDistance = Infinity;

      setNotes((prev) => {
        prev.forEach((note) => {
          if (note.lane === lane && !note.hit && !note.missed) {
            const distance = Math.abs(note.y - hitY);
            if (distance < GOOD_RANGE && distance < minDistance) {
              minDistance = distance;
              targetNote = note;
            }
          }
        });

        if (!targetNote) return prev;

        const note = targetNote as NoteState;
        if (hitNoteIdsRef.current.has(note.id)) return prev;

        const distance = Math.abs(note.y - hitY);
        let type: 'perfect' | 'good' = 'good';
        let points = 5;

        if (distance <= PERFECT_RANGE) {
          type = 'perfect';
          points = 10;
          setPerfectCount((c) => c + 1);
        } else {
          setGoodCount((c) => c + 1);
        }

        hitNoteIdsRef.current.add(note.id);

        setCombo((c) => {
          const nc = c + 1;
          setMaxCombo((mc) => Math.max(mc, nc));
          const comboBonus = Math.floor(nc / 10) * 2;
          setLocalScore((s) => s + points + comboBonus);
          return nc;
        });

        showJudgment(type, lane);

        emit('gameAction', {
          action: 'rhythm_hit',
          payload: {
            noteId: note.id,
            lane,
            judgment: type,
            points,
            timestamp: Date.now(),
          },
        });

        return prev.map((n) => (n.id === note.id ? { ...n, hit: true } : n));
      });
    },
    [storeGameState.phase, playerId]
  );

  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = { d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3 };
      const lane = keyMap[e.key];
      if (lane !== undefined) {
        e.preventDefault();
        handleLaneHit(lane);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLaneHit, isMobile]);

  const accuracy = perfectCount + goodCount + missCount > 0
    ? Math.round(((perfectCount * 100 + goodCount * 50) / ((perfectCount + goodCount + missCount) * 100)) * 100)
    : 0;

  const countdownPercent = (localCountdown / 30) * 100;

  const playerStats = useMemo(() => {
    return players
      .filter((p) => !p.isSpectator)
      .map((p) => {
        const playerScore = scores[p.id] ?? 0;
        const playerHits = storeGameState.hits?.[p.id] ?? [];
        const pPerfect = playerHits.filter((h: any) => h.judgment === 'perfect').length;
        const pGood = playerHits.filter((h: any) => h.judgment === 'good').length;
        const pMiss = playerHits.filter((h: any) => h.judgment === 'miss').length;
        const pTotal = pPerfect + pGood + pMiss;
        const pAcc = pTotal > 0 ? Math.round(((pPerfect * 100 + pGood * 50) / (pTotal * 100)) * 100) : 0;
        return {
          player: p,
          score: playerScore,
          perfect: pPerfect,
          good: pGood,
          miss: pMiss,
          accuracy: pAcc,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [players, scores, storeGameState.hits]);

  if (isMobile) {
    return (
      <div className="h-full flex flex-col p-3 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-start gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xs text-white/60">得分</span>
            <span className="font-black font-mono text-xl tabular-nums neon-text-glow">
              {scores[playerId ?? ''] ?? localScore}
            </span>
          </div>
          {combo >= 3 && (
            <motion.div
              key={combo}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center px-4 py-2 rounded-xl bg-neon-gradient-soft border border-white/10"
            >
              <span className="text-xs text-white/60">COMBO</span>
              <span className="font-black font-mono text-xl text-neon-yellow tabular-nums">{combo}</span>
            </motion.div>
          )}
          <div className="flex flex-col items-end gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xs text-white/60">时间</span>
            <span
              className={cn(
                'font-black font-mono text-xl tabular-nums',
                localCountdown > 15
                  ? 'text-neon-cyan'
                  : localCountdown > 5
                  ? 'text-neon-yellow'
                  : 'text-neon-pink animate-pulse'
              )}
            >
              {localCountdown}s
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

        <div
          ref={trackAreaRef}
          className="flex-1 relative rounded-2xl bg-black/40 border border-white/10 overflow-hidden"
          style={{ minHeight: 300 }}
        >
          <div className="absolute inset-0 flex">
            {[0, 1, 2, 3].map((lane) => (
              <div
                key={lane}
                className={cn(
                  'flex-1 border-x border-white/5 transition-colors duration-100',
                  activeLanes[lane] && 'bg-white/10'
                )}
                style={{
                  background: activeLanes[lane]
                    ? `linear-gradient(180deg, transparent 0%, ${LANE_COLORS[lane]}20 50%, transparent 100%)`
                    : 'transparent',
                }}
              />
            ))}
          </div>

          <div
            className="absolute left-0 right-0 h-16 flex items-center justify-center pointer-events-none"
            style={{ bottom: HIT_LINE_OFFSET - 32 }}
          >
            <div className="w-full h-1 bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan opacity-60" />
            <div className="absolute inset-0 flex">
              {[0, 1, 2, 3].map((lane) => (
                <div key={lane} className="flex-1 flex items-center justify-center">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-100 border-2',
                      activeLanes[lane] ? 'scale-110 border-white/50 shadow-lg' : 'border-white/20'
                    )}
                    style={{
                      backgroundColor: activeLanes[lane] ? `${LANE_COLORS[lane]}40` : 'transparent',
                      boxShadow: activeLanes[lane] ? `0 0 30px ${LANE_COLORS[lane]}60` : 'none',
                    }}
                  >
                    <span className="text-2xl" style={{ color: LANE_COLORS[lane] }}>
                      {LANE_ICONS[lane]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={false}
              animate={{
                y: note.hit ? note.y - 50 : note.y,
                opacity: note.hit || note.missed ? 0 : 1,
                scale: note.hit ? 1.5 : 1,
              }}
              transition={{ duration: 0.2 }}
              className="absolute w-1/4 flex items-center justify-center"
              style={{
                left: `${note.lane * 25}%`,
                top: 0,
                transform: `translateY(${note.y}px)`,
              }}
            >
              <div
                className={cn(
                  'w-14 h-10 rounded-lg flex items-center justify-center text-xl font-black',
                  'border-2 shadow-lg'
                )}
                style={{
                  backgroundColor: `${LANE_COLORS[note.lane]}30`,
                  borderColor: LANE_COLORS[note.lane],
                  boxShadow: `0 0 20px ${LANE_COLORS[note.lane]}50`,
                  color: LANE_COLORS[note.lane],
                }}
              >
                {LANE_ICONS[note.lane]}
              </div>
            </motion.div>
          ))}

          {hitEffects.map((effect) => (
            <motion.div
              key={effect.id}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute w-1/4 flex items-center justify-center pointer-events-none"
              style={{
                left: `${effect.lane * 25}%`,
                bottom: HIT_LINE_OFFSET - 16,
              }}
            >
              <div
                className="w-16 h-16 rounded-full"
                style={{
                  backgroundColor:
                    effect.type === 'perfect' ? '#00FFCC' : effect.type === 'good' ? '#FFDD00' : '#FF2288',
                  opacity: 0.5,
                }}
              />
            </motion.div>
          ))}

          <AnimatePresence>
            {judgment && (
              <motion.div
                initial={{ y: 0, opacity: 1, scale: 0.8 }}
                animate={{ y: -40, opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 pointer-events-none"
              >
                <span
                  className={cn(
                    'text-2xl font-black font-display',
                    judgment.type === 'perfect' && 'text-neon-cyan',
                    judgment.type === 'good' && 'text-neon-yellow',
                    judgment.type === 'miss' && 'text-neon-pink'
                  )}
                  style={{
                    textShadow: `0 0 20px ${
                      judgment.type === 'perfect' ? '#00FFCC' : judgment.type === 'good' ? '#FFDD00' : '#FF2288'
                    }80`,
                  }}
                >
                  {judgment.text}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((lane) => (
            <motion.button
              key={lane}
              whileTap={{ scale: 0.92 }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleLaneHit(lane);
              }}
              onMouseDown={() => handleLaneHit(lane)}
              disabled={storeGameState.phase !== 'playing'}
              className={cn(
                'aspect-square rounded-2xl flex items-center justify-center text-4xl font-black transition-all border-2',
                activeLanes[lane] ? 'scale-95' : ''
              )}
              style={{
                backgroundColor: activeLanes[lane] ? `${LANE_COLORS[lane]}40` : `${LANE_COLORS[lane]}15`,
                borderColor: LANE_COLORS[lane],
                boxShadow: activeLanes[lane]
                  ? `0 0 30px ${LANE_COLORS[lane]}60, inset 0 0 30px ${LANE_COLORS[lane]}30`
                  : `0 0 15px ${LANE_COLORS[lane]}20`,
                color: LANE_COLORS[lane],
              }}
            >
              {LANE_ICONS[lane]}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {storeGameState.phase === 'ended' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center gap-4 p-6 z-30"
            >
              <div className="text-3xl font-bold neon-text-glow">🎵 回合结束!</div>
              <div className="text-6xl font-black font-mono neon-text">
                {scores[playerId ?? ''] ?? localScore}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="text-neon-cyan">
                  <div className="text-2xl font-black">{perfectCount}</div>
                  <div className="text-xs">PERFECT</div>
                </div>
                <div className="text-neon-yellow">
                  <div className="text-2xl font-black">{goodCount}</div>
                  <div className="text-xs">GOOD</div>
                </div>
                <div className="text-neon-pink">
                  <div className="text-2xl font-black">{missCount}</div>
                  <div className="text-xs">MISS</div>
                </div>
              </div>
              <div className="text-white/60 text-sm">
                最大连击 {maxCombo} · 准确率 {accuracy}%
              </div>
              {isHost && (
                <button onClick={startGame} className="neon-btn mt-4">
                  再来一局
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
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-lg">🎵</span>
            <div className="flex flex-col">
              <span className="text-xs text-white/60">得分</span>
              <span className="font-black font-mono text-2xl tabular-nums neon-text-glow">
                {scores[playerId ?? ''] ?? localScore}
              </span>
            </div>
          </div>
          {combo >= 5 && (
            <motion.div
              key={combo}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-yellow/20 border border-neon-yellow/40"
            >
              <span className="text-xl">🔥</span>
              <div className="flex flex-col">
                <span className="text-xs text-white/60">COMBO</span>
                <span className="font-black font-mono text-2xl text-neon-yellow tabular-nums">
                  {combo}
                </span>
              </div>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <span className="text-neon-cyan font-bold">✓{perfectCount}</span>
            <span className="text-neon-yellow font-bold">●{goodCount}</span>
            <span className="text-neon-pink font-bold">✗{missCount}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-lg">⏱️</span>
            <span
              className={cn(
                'font-mono text-2xl font-bold tabular-nums',
                localCountdown > 15
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

      <div className="flex-1 flex gap-12 items-start">
        <div
          ref={trackAreaRef}
          className="flex-1 max-w-3xl mx-auto relative rounded-3xl bg-black/50 border border-white/10 overflow-hidden shadow-[0_0_60px_rgba(136,34,255,0.2)]"
          style={{ height: '100%', minHeight: 500 }}
        >
          <div className="absolute inset-0 flex">
            {[0, 1, 2, 3].map((lane) => (
              <div
                key={lane}
                className={cn(
                  'flex-1 border-x transition-colors duration-150',
                  activeLanes[lane] ? 'bg-white/10 border-white/20' : 'border-white/5'
                )}
                style={{
                  background: activeLanes[lane]
                    ? `linear-gradient(180deg, transparent 0%, ${LANE_COLORS[lane]}30 70%, ${LANE_COLORS[lane]}10 100%)`
                    : `linear-gradient(180deg, transparent 0%, ${LANE_COLORS[lane]}08 100%)`,
                }}
              />
            ))}
          </div>

          <div
            className="absolute left-0 right-0 h-20 pointer-events-none z-10"
            style={{ bottom: HIT_LINE_OFFSET - 40 }}
          >
            <div className="absolute left-4 right-4 top-1/2 h-1.5 bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan rounded-full shadow-[0_0_20px_rgba(255,34,136,0.5)]" />
            <div className="absolute inset-0 flex px-4">
              {[0, 1, 2, 3].map((lane) => (
                <div key={lane} className="flex-1 flex items-center justify-center">
                  <div
                    className={cn(
                      'w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-150 border-2',
                      activeLanes[lane] ? 'scale-110' : ''
                    )}
                    style={{
                      backgroundColor: activeLanes[lane]
                        ? `${LANE_COLORS[lane]}50`
                        : 'rgba(255,255,255,0.03)',
                      borderColor: LANE_COLORS[lane],
                      boxShadow: activeLanes[lane]
                        ? `0 0 50px ${LANE_COLORS[lane]}80, inset 0 0 30px ${LANE_COLORS[lane]}40`
                        : `0 0 20px ${LANE_COLORS[lane]}20`,
                    }}
                  >
                    <span
                      className="text-4xl font-black transition-all duration-150"
                      style={{
                        color: LANE_COLORS[lane],
                        filter: activeLanes[lane]
                          ? `drop-shadow(0 0 10px ${LANE_COLORS[lane]})`
                          : 'none',
                      }}
                    >
                      {LANE_ICONS[lane]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {notes.map((note) => (
            <motion.div
              key={note.id}
              animate={{
                opacity: note.hit || note.missed ? 0 : 1,
                scale: note.hit ? 1.8 : 1,
              }}
              transition={{ duration: 0.25 }}
              className="absolute w-1/4 flex items-center justify-center"
              style={{
                left: `${note.lane * 25}%`,
                top: 0,
                transform: `translateY(${note.y}px)`,
                paddingLeft: '1rem',
                paddingRight: '1rem',
              }}
            >
              <div
                className={cn(
                  'w-full h-12 rounded-xl flex items-center justify-center text-2xl font-black border-2',
                  note.missed && 'grayscale'
                )}
                style={{
                  backgroundColor: note.missed
                    ? 'rgba(255,34,136,0.2)'
                    : `${LANE_COLORS[note.lane]}25`,
                  borderColor: LANE_COLORS[note.lane],
                  boxShadow: `0 0 30px ${LANE_COLORS[note.lane]}50, inset 0 0 20px ${LANE_COLORS[note.lane]}20`,
                  color: LANE_COLORS[note.lane],
                }}
              >
                {LANE_ICONS[note.lane]}
              </div>
            </motion.div>
          ))}

          {hitEffects.map((effect) => (
            <motion.div
              key={effect.id}
              initial={{ scale: 0.5, opacity: 0.8 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute w-1/4 flex items-center justify-center pointer-events-none px-4"
              style={{
                left: `${effect.lane * 25}%`,
                bottom: HIT_LINE_OFFSET - 40,
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl"
                style={{
                  backgroundColor:
                    effect.type === 'perfect' ? '#00FFCC' : effect.type === 'good' ? '#FFDD00' : '#FF2288',
                  opacity: 0.4,
                }}
              />
            </motion.div>
          ))}

          <AnimatePresence>
            {judgment && (
              <motion.div
                initial={{ y: 0, opacity: 1, scale: 0.7 }}
                animate={{ y: -60, opacity: 1, scale: 1.3 }}
                exit={{ opacity: 0, y: -100 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 pointer-events-none z-20"
              >
                <span
                  className={cn(
                    'text-4xl font-black font-display tracking-wider',
                    judgment.type === 'perfect' && 'text-neon-cyan',
                    judgment.type === 'good' && 'text-neon-yellow',
                    judgment.type === 'miss' && 'text-neon-pink'
                  )}
                  style={{
                    textShadow: `0 0 30px ${
                      judgment.type === 'perfect' ? '#00FFCC' : judgment.type === 'good' ? '#FFDD00' : '#FF2288'
                    }90, 0 0 60px ${
                      judgment.type === 'perfect' ? '#00FFCC' : judgment.type === 'good' ? '#FFDD00' : '#FF2288'
                    }50`,
                  }}
                >
                  {judgment.text}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-72 shrink-0 space-y-6">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-center">
            <div className="text-sm text-white/60 mb-2">总分</div>
            <div className="text-5xl font-black font-mono neon-text-glow tabular-nums">
              {scores[playerId ?? ''] ?? localScore}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">最大连击</span>
                <span className="font-mono text-neon-yellow font-bold">{maxCombo}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-neon-yellow"
                  animate={{ width: `${Math.min(maxCombo * 5, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">准确率</span>
                <span className="font-mono text-neon-purple font-bold">{accuracy}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-pink"
                  animate={{ width: `${accuracy}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3 max-h-52 overflow-y-auto">
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
                    P{stat.perfect} G{stat.good} M{stat.miss}
                  </div>
                </div>
                <div className="font-mono font-bold text-neon-cyan tabular-nums">
                  {stat.score}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-cyan shadow-[0_0_10px_#00FFCC]" />
                <span className="text-sm text-white/70">PERFECT</span>
              </div>
              <span className="font-mono text-neon-cyan font-bold tabular-nums">{perfectCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-yellow shadow-[0_0_10px_#FFDD00]" />
                <span className="text-sm text-white/70">GOOD</span>
              </div>
              <span className="font-mono text-neon-yellow font-bold tabular-nums">{goodCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-pink shadow-[0_0_10px_#FF2288]" />
                <span className="text-sm text-white/70">MISS</span>
              </div>
              <span className="font-mono text-neon-pink font-bold tabular-nums">{missCount}</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-neon-gradient-soft border border-white/10 space-y-3">
            <div className="text-sm text-white/70 font-semibold text-center mb-4">键盘操作</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {['D', 'F', 'J', 'K'].map((key, i) => (
                <div key={key} className="space-y-1">
                  <div
                    className="w-full h-10 rounded-lg flex items-center justify-center font-black border"
                    style={{
                      backgroundColor: `${LANE_COLORS[i]}30`,
                      borderColor: LANE_COLORS[i],
                      color: LANE_COLORS[i],
                    }}
                  >
                    {key}
                  </div>
                  <div className="text-lg">{LANE_ICONS[i]}</div>
                </div>
              ))}
            </div>
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
            <button onClick={startGame} className="neon-btn flex items-center gap-2 text-lg">
              <span>🎵</span>
              开始下一轮
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
