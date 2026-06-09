import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Trophy, Users, Zap, Check } from 'lucide-react';
import { GAME_INFO, type GameType, type GameMode } from '../../shared/types';
import { useAppStore } from '@/store';
import { emit } from '@/services/socket';

const ROUND_OPTIONS = [3, 5, 10];

export default function GameSelect() {
  const navigate = useNavigate();
  const { currentGame, isHost, roomCode } = useAppStore();
  const [selectedGame, setSelectedGame] = useState<GameType | null>(currentGame);
  const [rounds, setRounds] = useState<number>(5);
  const [mode, setMode] = useState<GameMode>('score');

  const gameTypes = Object.keys(GAME_INFO) as GameType[];

  const handleStartGame = () => {
    if (!selectedGame || !isHost) return;
    emit('selectGame', { gameType: selectedGame, rounds, mode });
    setTimeout(() => {
      emit('startGame');
    }, 200);
  };

  return (
    <div className="page-container min-h-screen mobile-safe">
      <div className="particle-bg">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              width: `${Math.random() * 6 + 2}px`,
              height: `${Math.random() * 6 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: i % 2 === 0 ? '#FF2288' : '#00FFCC',
              animationDuration: `${Math.random() * 4 + 3}s`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="neon-btn-secondary !px-4 !py-2 flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            返回
          </button>
          <h1 className="text-2xl md:text-3xl font-bold neon-text-glow">游戏选择</h1>
          <div className="w-[88px]" />
        </div>

        <div className="glass-card p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-neon-cyan" />
            <span className="text-white/70 text-sm">房间号</span>
            <span className="font-mono text-lg font-bold text-neon-yellow">{roomCode}</span>
          </div>
          {isHost && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neon-pink/20 border border-neon-pink/30">
              <Zap size={14} className="text-neon-pink" />
              <span className="text-xs font-semibold text-neon-pink">主持人</span>
            </div>
          )}
        </div>

        <h2 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
          <span className="w-1 h-6 bg-neon-gradient rounded-full" />
          选择游戏
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {gameTypes.map((type, idx) => {
            const info = GAME_INFO[type];
            const isSelected = selectedGame === type;
            const borderColors = [
              'border-neon-pink/50 shadow-neon-pink/20',
              'border-neon-cyan/50 shadow-neon-cyan/20',
              'border-neon-yellow/50 shadow-neon-yellow/20',
              'border-neon-purple/50 shadow-neon-purple/20',
            ];
            const glowColors = [
              'from-neon-pink/30 to-transparent',
              'from-neon-cyan/30 to-transparent',
              'from-neon-yellow/30 to-transparent',
              'from-neon-purple/30 to-transparent',
            ];

            return (
              <motion.button
                key={type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => isHost && setSelectedGame(type)}
                disabled={!isHost}
                className={`relative p-4 rounded-2xl border-2 transition-all duration-300 text-left
                  ${isSelected
                    ? `${borderColors[idx]} shadow-lg bg-white/10 scale-[1.02]`
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  } ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-neon-gradient flex items-center justify-center"
                  >
                    <Check size={14} className="text-white" />
                  </motion.div>
                )}
                {isSelected && (
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${glowColors[idx]} pointer-events-none`} />
                )}
                <div className="relative z-10">
                  <div className="text-4xl md:text-5xl mb-3">{info.icon}</div>
                  <div className="font-bold text-white text-base md:text-lg mb-1">{info.name}</div>
                  <div className="text-xs text-white/50 line-clamp-2">{info.desc}</div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {selectedGame && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-card p-5 mb-6 overflow-hidden"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">{GAME_INFO[selectedGame].icon}</span>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{GAME_INFO[selectedGame].name}</h3>
                <p className="text-sm text-white/60">{GAME_INFO[selectedGame].desc}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-neon-cyan mb-2">游戏规则：</div>
              {GAME_INFO[selectedGame].rules.map((rule, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-neon-pink font-bold mt-0.5">{i + 1}.</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <h2 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
          <span className="w-1 h-6 bg-neon-gradient rounded-full" />
          回合设置
        </h2>

        <div className="glass-card p-5 mb-6">
          <div className="mb-5">
            <div className="text-sm text-white/70 mb-3">选择回合数</div>
            <div className="grid grid-cols-3 gap-3">
              {ROUND_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => isHost && setRounds(r)}
                  disabled={!isHost}
                  className={`py-4 rounded-xl font-bold text-lg transition-all duration-300
                    ${rounds === r
                      ? 'bg-neon-gradient text-white shadow-lg shadow-neon-pink/30 scale-105'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                    } ${!isHost ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {r} 局
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-white/70 mb-3">游戏模式</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => isHost && setMode('score')}
                disabled={!isHost}
                className={`py-4 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2
                  ${mode === 'score'
                    ? 'bg-neon-gradient text-white shadow-lg shadow-neon-pink/30 scale-[1.02]'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  } ${!isHost ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <Trophy size={18} />
                <div className="text-left">
                  <div>积分制</div>
                  <div className="text-xs opacity-70 font-normal">累计积分排名</div>
                </div>
              </button>
              <button
                onClick={() => isHost && setMode('elimination')}
                disabled={!isHost}
                className={`py-4 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2
                  ${mode === 'elimination'
                    ? 'bg-neon-gradient text-white shadow-lg shadow-neon-pink/30 scale-[1.02]'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  } ${!isHost ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <Users size={18} />
                <div className="text-left">
                  <div>淘汰制</div>
                  <div className="text-xs opacity-70 font-normal">每局淘汰末位</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 pb-6">
          <button
            onClick={handleStartGame}
            disabled={!selectedGame || !isHost}
            className="neon-btn w-full text-xl flex items-center justify-center gap-2"
          >
            {!isHost ? (
              <>等待主持人开始...</>
            ) : !selectedGame ? (
              '请先选择游戏'
            ) : (
              <>
                <Zap size={22} />
                开始游戏 · {rounds}局{mode === 'score' ? '积分制' : '淘汰制'}
              </>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="neon-btn-secondary w-full"
          >
            游戏设置
          </button>
        </div>
      </div>
    </div>
  );
}
