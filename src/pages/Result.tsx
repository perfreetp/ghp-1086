import { useAppStore } from '@/store';
import { emit } from '@/services/socket';
import { useState, useEffect } from 'react';
import { PUNISHMENT_CARDS, GAME_INFO } from '../../shared/types';
import type { PunishmentCard } from '../../shared/types';

export default function Result() {
  const { finalResult, lastRoundResult, roundScores, players, currentGame, isHost, totalRounds, currentRound } = useAppStore();
  const [selectedCard, setSelectedCard] = useState<PunishmentCard | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [drawAnimation, setDrawAnimation] = useState(false);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);

  const rankings = finalResult?.rankings || [];
  const roundRankings = lastRoundResult?.rankings || [];
  const punishments = finalResult?.punishments || [];
  const gameType = lastRoundResult?.gameType || currentGame;

  const shuffledCards = PUNISHMENT_CARDS.sort(() => Math.random() - 0.5);
  const displayCards = shuffledCards.slice(0, 6);

  useEffect(() => {
    if (drawAnimation && currentCardIdx < displayCards.length) {
      const timer = setTimeout(() => {
        setCurrentCardIdx(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [drawAnimation, currentCardIdx, displayCards.length]);

  const handleDrawCard = () => {
    setDrawAnimation(true);
    setCurrentCardIdx(0);
    const randomCard = PUNISHMENT_CARDS[Math.floor(Math.random() * PUNISHMENT_CARDS.length)];
    setTimeout(() => {
      setSelectedCard(randomCard);
      const idx = displayCards.findIndex(c => c.id === randomCard.id);
      if (idx !== -1) {
        setFlippedCards(new Set([idx]));
      }
    }, 800);
  };

  const handleNextRound = () => {
    emit('nextRound');
  };

  const handleBackToRoom = () => {
    emit('returnToRoom');
  };

  const handleShare = async () => {
    const text = rankings
      .slice(0, 3)
      .map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${r.nickname}: ${r.totalScore}分`)
      .join('\n');
    const shareText = `🎮 派对游戏战绩\n${text}\n快来一起玩！`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '派对游戏战绩',
          text: shareText,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        alert('战绩已复制到剪贴板！');
      } catch {
        alert('分享失败，请手动复制');
      }
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getMedalStyles = (rank: number) => {
    if (rank === 1) return 'from-yellow-500/30 to-amber-600/20 border-yellow-400/50 shadow-yellow-500/30';
    if (rank === 2) return 'from-gray-300/30 to-slate-500/20 border-gray-300/50 shadow-gray-400/30';
    if (rank === 3) return 'from-amber-700/30 to-orange-800/20 border-amber-600/50 shadow-amber-600/30';
    return 'from-white/10 to-white/5 border-white/10';
  };

  return (
    <div className="page-container mobile-safe">
      <div className="relative z-10 px-4 py-6 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 neon-text-glow font-display">
            🏆 结算
          </h1>
          {gameType && GAME_INFO[gameType] && (
            <p className="text-white/60">
              {GAME_INFO[gameType].icon} {GAME_INFO[gameType].name} · 第 {currentRound || totalRounds}/{totalRounds} 局
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
                <div
                  key={r.playerId}
                  className={`relative flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${getMedalStyles(idx + 1)} border-2 shadow-lg transition-all duration-500 ${
                    idx === 0 ? 'scale-105 animate-pulse-glow' : ''
                  }`}
                  style={{ animationDelay: `${idx * 100}ms` }}
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
                </div>
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
            <div className="text-center py-8 text-white/40">
              暂无排行数据
            </div>
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
          </h2>

          {selectedCard ? (
            <div className="flex flex-col items-center">
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
                  </div>
                </div>
              </div>
              <button
                onClick={handleDrawCard}
                className="neon-btn-secondary"
              >
                🎲 再抽一张
              </button>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {displayCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className={`aspect-[3/4] rounded-xl bg-gradient-to-br ${
                      idx < currentCardIdx && drawAnimation
                        ? 'from-neon-pink/50 to-neon-purple/50'
                        : 'from-neon-pink/30 to-neon-purple/30'
                    } border-2 border-white/10 flex items-center justify-center transition-all duration-500 ${
                      drawAnimation && idx < currentCardIdx ? 'scale-105 rotate-3' : ''
                    }`}
                    style={{
                      animationDelay: `${idx * 50}ms`,
                      transform: `rotate(${(idx - 2.5) * 3}deg)`,
                    }}
                  >
                    <span className="text-4xl opacity-70">?</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleDrawCard}
                  disabled={drawAnimation && currentCardIdx < displayCards.length}
                  className="neon-btn text-xl py-5 px-10"
                >
                  🎴 抽取惩罚卡
                </button>
              </div>
            </div>
          )}

          {punishments.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <h3 className="text-sm text-white/60 mb-3">已分配的惩罚</h3>
              <div className="space-y-2">
                {punishments.map((p, idx) => {
                  const player = players.find(pl => pl.id === p.playerId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-white/5">
                        {player?.avatar || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{player?.nickname || '未知'}</div>
                        <div className="text-sm text-white/60 truncate">
                          {p.card.icon} {p.card.title}
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
            <button
              onClick={handleNextRound}
              className="flex-1 neon-btn text-lg py-5"
            >
              ▶️ 下一局
            </button>
          )}
          <button
            onClick={handleBackToRoom}
            className="flex-1 neon-btn-secondary text-lg py-4"
          >
            🏠 返回房间
          </button>
          <button
            onClick={handleShare}
            className="flex-1 neon-btn-secondary text-lg py-4"
          >
            📤 分享战绩
          </button>
        </div>
      </div>
    </div>
  );
}
