import { useAppStore, getMyPlayer } from '@/store';
import { emit } from '@/services/socket';
import { useState, useEffect, useRef, useMemo } from 'react';
import { GAME_INFO, PUNISHMENT_CARDS } from '../../shared/types';
import type { PunishmentCard } from '../../shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Result() {
  const state = useAppStore();
  const {
    finalResult, lastRoundResult, roundScores, players, currentGame, isHost,
    totalRounds, currentRound, roomCode, latestPunishment, punishmentAssignments,
  } = state;
  const me = getMyPlayer(state);
  const roomCodeStr = roomCode || '------';

  const [selectedCard, setSelectedCard] = useState<PunishmentCard | null>(null);
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);
  const [drawStep, setDrawStep] = useState<0 | 1 | 2>(0);
  const [sharing, setSharing] = useState(false);
  const [showPoster, setShowPoster] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);

  const rankings = finalResult?.rankings || [];
  const roundRankings = lastRoundResult?.rankings || [];
  const gameType = lastRoundResult?.gameType || currentGame;

  const displayCards = useMemo(() => {
    return [...PUNISHMENT_CARDS].sort(() => Math.random() - 0.5).slice(0, 6);
  }, []);

  useEffect(() => {
    if (latestPunishment?.card) {
      setSelectedCard(latestPunishment.card);
      const matchIdx = displayCards.findIndex(c => c.id === latestPunishment.card.id);
      if (matchIdx !== -1) {
        setDrawStep(1);
        setTimeout(() => {
          setFlippedIdx(matchIdx);
          setDrawStep(2);
        }, 350);
      } else {
        setFlippedIdx(0);
        setDrawStep(2);
      }
    }
  }, [latestPunishment, displayCards]);

  const handleDrawCard = () => {
    setSelectedCard(null);
    setFlippedIdx(null);
    setDrawStep(0);
    emit('drawPunishment');
  };

  const handleNextRound = () => {
    emit('nextRound');
  };

  const handleBackToRoom = () => {
    emit('returnToRoom');
  };

  const handleShareText = async () => {
    const text = rankings
      .slice(0, 3)
      .map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${r.nickname}: ${r.totalScore}分`)
      .join('\n');
    const shareText = `🎮 派对反应小游戏 战绩榜\n房间码：${roomCodeStr}\n${text}\n快来一起玩！`;

    if (navigator.share) {
      try {
        await navigator.share({ title: '派对游戏战绩', text: shareText });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareText);
      alert('战绩文字已复制到剪贴板！');
    } catch {
      alert('分享失败，请手动复制');
    }
  };

  const handleShareImage = async () => {
    setShowPoster(true);
    setSharing(true);
    try {
      await new Promise(r => setTimeout(r, 200));
      const html2canvas = (await import('html2canvas')).default;
      if (!posterRef.current) throw new Error('海报未渲染');
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: '#0a0320',
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `派对战绩_${roomCodeStr}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      if (navigator.share) {
        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const file = new File([blob], '战绩海报.png', { type: 'image/png' });
          await navigator.share({
            title: '派对游戏战绩海报',
            files: [file],
          });
        } catch {}
      }
    } catch (e) {
      console.error('生成海报失败', e);
      alert('生成海报失败，请重试');
    } finally {
      setSharing(false);
      setTimeout(() => setShowPoster(false), 300);
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getMedalStyles = (rank: number) => {
    if (rank === 1) return 'from-yellow-500/40 to-amber-600/30 border-yellow-400/60';
    if (rank === 2) return 'from-gray-300/40 to-slate-500/30 border-gray-300/60';
    if (rank === 3) return 'from-amber-700/40 to-orange-800/30 border-amber-600/60';
    return 'from-white/10 to-white/5 border-white/10';
  };

  const top3 = rankings.slice(0, 3);
  const gameName = gameType && GAME_INFO[gameType] ? `${GAME_INFO[gameType].icon} ${GAME_INFO[gameType].name}` : '派对小游戏';

  return (
    <div className="page-container mobile-safe relative">
      <AnimatePresence>
        {showPoster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full">
              <div className="text-center text-white/60 mb-3">
                {sharing ? '正在生成海报...' : '海报预览'}
              </div>
              <div
                ref={posterRef}
                className="w-full rounded-2xl overflow-hidden p-8 shadow-2xl"
                style={{
                  background: 'radial-gradient(ellipse at top, #2a0a4a 0%, #140528 50%, #0a0320 100%)',
                  border: '1px solid rgba(255, 34, 136, 0.3)',
                }}
              >
                <div className="text-center mb-6">
                  <div
                    className="inline-block text-5xl font-black mb-2 bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #FF2288 0%, #8822FF 100%)',
                      fontFamily: '"Space Grotesk", system-ui, sans-serif',
                    }}
                  >
                    🏆 战绩排行
                  </div>
                  <div className="text-white/60 text-sm">
                    {gameName} · 共 {totalRounds || 1} 局
                  </div>
                  <div className="mt-1 text-xs text-white/40 font-mono tracking-widest">
                    房间 {roomCodeStr}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {top3.map((r, idx) => (
                    <div
                      key={r.playerId}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 bg-gradient-to-r',
                        getMedalStyles(idx + 1)
                      )}
                    >
                      <div className="text-3xl w-10 text-center">{getMedalEmoji(idx + 1)}</div>
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl bg-black/30">
                        {r.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate text-white">{r.nickname}</div>
                        <div className="text-xs text-white/50">胜出 {r.roundsWon} 局</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black font-mono" style={{
                          color: idx === 0 ? '#FFDD00' : idx === 1 ? '#E5E7EB' : idx === 2 ? '#FB923C' : '#fff',
                        }}>
                          {r.totalScore}
                        </div>
                        <div className="text-xs text-white/40">分</div>
                      </div>
                    </div>
                  ))}
                  {top3.length === 0 && (
                    <div className="text-center py-6 text-white/40">暂无数据</div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10 text-center">
                  <div className="text-white/30 text-xs">
                    🎮 派对反应小游戏合集 · {new Date().toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setShowPoster(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 transition-all"
                >
                  关闭
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 px-4 py-6 max-w-2xl mx-auto pb-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 neon-text-glow font-display">
            🏆 结算
          </h1>
          {gameType && GAME_INFO[gameType] && (
            <p className="text-white/60">
              {GAME_INFO[gameType].icon} {GAME_INFO[gameType].name} · 第 {currentRound || totalRounds}/{totalRounds} 局
              {roomCode && <span className="ml-3 font-mono tracking-widest text-white/40 text-sm">房间 {roomCode}</span>}
            </p>
          )}
        </div>

        <div className="glass-card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <span className="neon-text">总分排行榜</span>
          </h2>

          {rankings.length > 0 ? (
            <div className="space-y-3">
              {rankings.slice(0, 3).map((r, idx) => (
                <motion.div
                  key={r.playerId}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.15, type: 'spring', stiffness: 200 }}
                  className={`relative flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${getMedalStyles(idx + 1)} border-2 shadow-lg transition-all duration-500 ${
                    idx === 0 ? 'scale-105 animate-pulse-glow' : ''
                  }`}
                >
                  <div className="text-4xl w-12 text-center animate-float" style={{ animationDelay: `${idx * 200}ms` }}>
                    {getMedalEmoji(idx + 1)}
                  </div>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-white/10 border border-white/10">
                    {r.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg truncate">{r.nickname}</div>
                    <div className="text-sm text-white/60">
                      胜 {r.roundsWon} 局
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black neon-text">{r.totalScore}</div>
                    <div className="text-xs text-white/50">总积分</div>
                  </div>
                </motion.div>
              ))}

              {rankings.length > 3 && (
                <div className="mt-4 space-y-2 pt-2 border-t border-white/5">
                  {rankings.slice(3).map((r, idx) => (
                    <div
                      key={r.playerId}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="text-xl w-8 text-center text-white/50 font-bold">
                        #{idx + 4}
                      </div>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-white/5">
                        {r.avatar}
                      </div>
                      <div className="flex-1 min-w-0 truncate">{r.nickname}</div>
                      <div className="text-lg font-bold text-white/80">{r.totalScore}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-white/40">暂无排行数据</div>
          )}
        </div>

        {roundRankings.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <span className="text-white/90">本局得分明细</span>
            </h2>
            <div className="space-y-2">
              {roundRankings.map((r, idx) => {
                const player = players.find(p => p.id === r.playerId);
                return (
                  <div
                    key={r.playerId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className={`text-xl w-8 text-center font-bold ${
                      idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-white/40'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-white/5">
                      {player?.avatar || '👤'}
                    </div>
                    <div className="flex-1 min-w-0 truncate">
                      {player?.nickname || '未知玩家'}
                    </div>
                    {r.correct !== undefined && r.total !== undefined && (
                      <div className="text-sm text-white/50 mr-3">
                        {r.correct}/{r.total}
                      </div>
                    )}
                    <div className={`text-xl font-bold ${r.score >= 0 ? 'text-neon-cyan' : 'text-red-400'}`}>
                      {r.score >= 0 ? '+' : ''}{r.score}
                    </div>
                  </div>
                );
              })}
            </div>

            {roundScores.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <h3 className="text-sm text-white/60 mb-3">各局得分趋势</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {roundScores.map((round, roundIdx) => (
                    <div key={roundIdx} className="flex items-center gap-2 text-sm">
                      <span className="w-12 text-white/50 shrink-0">第{roundIdx + 1}局</span>
                      <div className="flex-1 flex gap-1 flex-wrap">
                        {Object.entries(round).map(([pid, score]) => {
                          const p = players.find(pl => pl.id === pid);
                          return (
                            <span
                              key={pid}
                              className={`px-2 py-0.5 rounded-md text-xs ${
                                score >= 0 ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {p?.avatar || '👤'} {score >= 0 ? '+' : ''}{score}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="glass-card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🎴</span>
            <span className="text-white/90">惩罚卡抽取</span>
            {me && <span className="ml-auto text-sm text-white/40">{me.nickname} 可抽取</span>}
          </h2>

          {selectedCard && drawStep === 2 ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="card-flip w-64 h-80 mb-6 flipped">
                <div className="card-flip-inner">
                  <div className="card-front bg-neon-gradient flex items-center justify-center shadow-2xl shadow-neon-pink/30">
                    <div className="text-center">
                      <div className="text-7xl mb-2 animate-float">🎴</div>
                      <div className="text-white/80 font-bold text-lg">点击抽取</div>
                    </div>
                  </div>
                  <div className="card-back bg-gradient-to-br from-neon-purple/40 to-neon-pink/40 border-2 border-white/20 p-6 flex flex-col items-center justify-center shadow-2xl shadow-neon-purple/30">
                    <div className="text-7xl mb-4 animate-bounce-slow">{selectedCard.icon}</div>
                    <div className="text-2xl font-black mb-3 neon-text">{selectedCard.title}</div>
                    <p className="text-center text-white/90 leading-relaxed">
                      {selectedCard.content}
                    </p>
                    {latestPunishment?.playerName && (
                      <div className="mt-4 text-xs text-white/50">
                        —— {latestPunishment.playerName}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={handleDrawCard} className="neon-btn-secondary">
                🎲 再抽一张
              </button>
            </motion.div>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-6 perspective-1000">
                {displayCards.map((card, idx) => (
                  <motion.div
                    key={card.id}
                    animate={{
                      rotateY: flippedIdx === idx ? 180 : 0,
                      scale: drawStep >= 1 && flippedIdx === idx ? [1, 1.08, 1] : 1,
                    }}
                    transition={{ duration: 0.6 }}
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: `rotate(${(idx - 2.5) * 3}deg)`,
                    }}
                    className={cn(
                      'aspect-[3/4] rounded-xl border-2 border-white/10 flex items-center justify-center',
                      drawStep === 1 && flippedIdx === idx ? 'animate-shake' : '',
                      flippedIdx === idx
                        ? 'bg-gradient-to-br from-neon-purple/50 to-neon-pink/50'
                        : 'bg-gradient-to-br from-neon-pink/30 to-neon-purple/30 hover:from-neon-pink/50 hover:to-neon-purple/50 cursor-pointer'
                    )}
                  >
                    {flippedIdx === idx ? (
                      <div className="flex flex-col items-center text-center p-2" style={{ transform: 'rotateY(180deg)' }}>
                        <span className="text-3xl mb-1">{selectedCard?.icon || card.icon}</span>
                        <span className="text-xs text-white/90 font-bold">{selectedCard?.title || card.title}</span>
                      </div>
                    ) : (
                      <span className="text-4xl opacity-80">?</span>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleDrawCard}
                  disabled={drawStep === 1}
                  className="neon-btn text-xl py-5 px-10 disabled:opacity-50"
                >
                  🎴 抽取惩罚卡
                </button>
              </div>
            </div>
          )}

          {punishmentAssignments.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <h3 className="text-sm text-white/60 mb-3">🎴 已分配惩罚（全房间同步）</h3>
              <div className="space-y-2">
                {[...punishmentAssignments].reverse().map((p, idx) => {
                  const player = players.find(pl => pl.id === p.playerId);
                  return (
                    <div
                      key={`${p.playerId}-${p.drawnAt}-${idx}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-white/5">
                        {player?.avatar || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.playerName || player?.nickname || '未知'}</div>
                        <div className="text-sm text-white/60 truncate">
                          {p.card.icon} <span className="font-bold">{p.card.title}</span>
                          <span className="text-white/40">：{p.card.content}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {isHost && currentRound < totalRounds && (
            <button onClick={handleNextRound} className="flex-1 neon-btn text-lg py-5">
              ▶️ 下一局
            </button>
          )}
          <button onClick={handleBackToRoom} className="flex-1 neon-btn-secondary text-lg py-4">
            🏠 返回房间
          </button>
          <button onClick={handleShareText} className="flex-1 neon-btn-secondary text-lg py-4">
            📋 复制战绩
          </button>
          <button onClick={handleShareImage} disabled={sharing} className="flex-1 neon-btn text-lg py-4">
            �️ {sharing ? '生成中...' : '海报分享'}
          </button>
        </div>
      </div>
    </div>
  );
}
