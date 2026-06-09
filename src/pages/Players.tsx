import { useAppStore } from '@/store';
import { emit } from '@/services/socket';
import { useState } from 'react';
import type { Player } from '../../shared/types';

export default function Players() {
  const { players, isHost, playerId } = useAppStore();
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const handleKick = (p: Player) => {
    emit('kickPlayer', { playerId: p.id });
    setShowMenu(null);
  };

  const handleTransferHost = (p: Player) => {
    emit('transferHost', { newHostId: p.id });
    setShowMenu(null);
  };

  const handleToggleSpectator = (p: Player) => {
    emit('toggleSpectator', { playerId: p.id, isSpectator: !p.isSpectator });
    setShowMenu(null);
  };

  return (
    <div className="page-container mobile-safe">
      <div className="relative z-10 px-4 py-6 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 neon-text-glow font-display">
            玩家管理
          </h1>
          <p className="text-white/50">
            共 {players.length} 位玩家在线
          </p>
        </div>

        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.id}
              className={`glass-card p-4 transition-all duration-300 ${
                player.id === playerId ? 'ring-2 ring-neon-pink/50 shadow-lg shadow-neon-pink/20' : ''
              } ${!player.isOnline ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl
                      bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 border-2 border-white/10
                      ${player.isOnline ? '' : 'grayscale'}
                      ${player.isHost ? 'shadow-lg shadow-neon-yellow/40 ring-2 ring-neon-yellow/60' : ''}`}
                  >
                    {player.avatar}
                  </div>
                  {player.isHost && (
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-neon-yellow flex items-center justify-center text-lg shadow-lg shadow-neon-yellow/50 animate-float">
                      👑
                    </div>
                  )}
                  {!player.isOnline && (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
                      <span className="text-white/80 text-xs">离线</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xl font-bold truncate">
                      {player.nickname}
                    </span>
                    {player.id === playerId && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/30">
                        我
                      </span>
                    )}
                    {player.isSpectator ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
                        👁 观众
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                        🎮 玩家
                      </span>
                    )}
                    {player.eliminated && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        💀 淘汰
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/50">
                    <span>积分: <span className="text-neon-cyan font-semibold">{player.score}</span></span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${player.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                      {player.isOnline ? '在线' : '离线'}
                    </span>
                  </div>
                </div>

                {isHost && player.id !== playerId && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(showMenu === player.id ? null : player.id)}
                      className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all duration-200 active:scale-95"
                    >
                      <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    {showMenu === player.id && (
                      <div className="absolute right-0 top-12 z-50 w-48 py-2 rounded-xl bg-neon-darker border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                        <button
                          onClick={() => handleTransferHost(player)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-neon-yellow/10 transition-colors flex items-center gap-3"
                        >
                          <span className="text-lg">👑</span>
                          <span className="text-neon-yellow">转让主持人</span>
                        </button>
                        <button
                          onClick={() => handleToggleSpectator(player)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-neon-cyan/10 transition-colors flex items-center gap-3"
                        >
                          <span className="text-lg">{player.isSpectator ? '🎮' : '👁'}</span>
                          <span className="text-neon-cyan">
                            {player.isSpectator ? '转为玩家' : '设为观众'}
                          </span>
                        </button>
                        <div className="h-px bg-white/5 my-1"></div>
                        <button
                          onClick={() => handleKick(player)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-red-500/10 transition-colors flex items-center gap-3"
                        >
                          <span className="text-lg">🚪</span>
                          <span className="text-red-400">踢出房间</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {showMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(null)}
          />
        )}

        {isHost && (
          <div className="mt-6 p-4 rounded-xl bg-neon-gradient-soft border border-neon-pink/20">
            <p className="text-sm text-white/70 text-center">
              💡 提示：点击玩家卡片右侧的 <span className="inline-block w-6 h-6 rounded-md bg-white/10 align-middle text-center leading-6">⋮</span> 菜单可管理玩家
            </p>
          </div>
        )}

        {!isHost && (
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-white/50 text-center">
              🔒 仅主持人可以管理玩家
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
