import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Play, Settings, Users, Copy, Check, Crown, Eye,
  Volume2, VolumeX, LogOut, UserMinus, ArrowRight,
  X, GripVertical, ChevronDown, AlertTriangle, Gamepad2, Trophy
} from 'lucide-react';
import type { Player, GameType, RoomSettings, GameMode } from '../../shared/types';
import { GAME_INFO } from '../../shared/types';
import { useAppStore, getMyPlayer } from '../store';
import { emit, on, disconnectSocket } from '../services/socket';
import { cn } from '../lib/utils';

type TabType = 'players' | 'settings';
type GameTypeKey = GameType;

export default function Room() {
  const navigate = useNavigate();
  const {
    roomCode, players, isHost, playerId,
    status, currentGame, totalRounds, gameConfig,
    soundEnabled, settings, setRoom, clearAll, setError,
  } = useAppStore();

  const me = getMyPlayer(useAppStore.getState());

  const [activeTab, setActiveTab] = useState<TabType>('players');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [managePlayerId, setManagePlayerId] = useState<string | null>(null);
  const [showGameSelect, setShowGameSelect] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameTypeKey>('buzz');
  const [selectedRounds, setSelectedRounds] = useState(5);
  const [selectedMode, setSelectedMode] = useState<GameMode>('score');
  const [tempSettings, setTempSettings] = useState<RoomSettings>(settings);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!roomCode || !playerId) {
      navigate('/');
      return;
    }

    const unsub1 = on('roomState', (data: any) => {
      setRoom(data);
    });

    const unsub2 = on('kicked', () => {
      disconnectSocket();
      clearAll();
      navigate('/');
    });

    const unsub3 = on('error', (data: { code: string; message: string }) => {
      setError(data.message);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [roomCode, playerId, navigate, setRoom, clearAll, setError]);

  useEffect(() => {
    if (status === 'playing') {
      navigate('/game');
    } else if (status === 'result') {
      navigate('/result');
    }
  }, [status, navigate]);

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleLeave = () => {
    disconnectSocket();
    clearAll();
    navigate('/');
  };

  const handleKick = (pid: string) => {
    emit('kickPlayer', { playerId: pid });
    setShowManage(false);
    setManagePlayerId(null);
  };

  const handleTransferHost = (pid: string) => {
    emit('transferHost', { newHostId: pid });
    setShowManage(false);
    setManagePlayerId(null);
  };

  const handleToggleSpectator = (pid: string, isSpectator: boolean) => {
    emit('toggleSpectator', { playerId: pid, isSpectator });
    setShowManage(false);
    setManagePlayerId(null);
  };

  const handleSelectGame = () => {
    emit('selectGame', { gameType: selectedGame, rounds: selectedRounds, mode: selectedMode });
    setShowGameSelect(false);
  };

  const handleStartGame = () => {
    if (!gameConfig) {
      setShowGameSelect(true);
    } else {
      emit('startGame');
    }
  };

  const handleSaveSettings = () => {
    emit('updateSettings', tempSettings);
    emit('toggleSound', { enabled: soundEnabled });
    setShowSettings(false);
  };

  const gameTypes = Object.entries(GAME_INFO) as [GameTypeKey, typeof GAME_INFO[GameTypeKey]][];

  return (
    <div className="page-container mobile-safe min-h-screen flex flex-col p-4 sm:p-6">
      <header className="relative z-10 flex items-center justify-between mb-6">
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          退出房间
        </button>

        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-neon-pink" />
          <span className="font-bold font-display text-lg neon-text">PartyArena</span>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="relative z-10 flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <QRCodeSVG
                  value={roomCode || ''}
                  size={96}
                  level="M"
                  bgColor="transparent"
                  fgColor="#FF2288"
                />
              </div>
              <div>
                <p className="text-white/50 text-sm mb-1">房间码</p>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {(roomCode || '').split('').map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className="w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center rounded-xl bg-neon-gradient font-mono text-2xl sm:text-3xl font-bold text-white shadow-lg shadow-neon-pink/30"
                      >
                        {c}
                      </motion.div>
                    ))}
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className={cn(
                      'p-2.5 rounded-xl transition-all duration-300',
                      copied
                        ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                    )}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-white/40 text-xs mt-2">扫描二维码或输入房间码加入</p>
              </div>
            </div>

            <div className="flex flex-col items-center sm:items-end gap-3">
              {currentGame && gameConfig && (
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-neon-gradient-soft border border-neon-pink/30">
                  <span className="text-2xl">{GAME_INFO[currentGame].icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{GAME_INFO[currentGame].name}</p>
                    <p className="text-white/50 text-xs">
                      共 {totalRounds} 局 · {gameConfig.mode === 'score' ? '积分赛' : '淘汰赛'}
                    </p>
                  </div>
                </div>
              )}

              {isHost && (
                <div className="flex items-center gap-2">
                  {!currentGame ? (
                    <button
                      onClick={() => setShowGameSelect(true)}
                      className="neon-btn py-3 px-5 text-base flex items-center gap-2"
                    >
                      <Trophy className="w-5 h-5" />
                      选择游戏
                    </button>
                  ) : (
                    <button
                      onClick={handleStartGame}
                      disabled={status !== 'waiting' || players.filter(p => !p.isSpectator && p.isOnline).length < 1}
                      className="neon-btn py-3 px-5 text-base flex items-center gap-2"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      开始游戏
                    </button>
                  )}
                  <button
                    onClick={() => setShowManage(true)}
                    className="neon-btn-secondary py-3 px-4 flex items-center gap-2"
                  >
                    <Users className="w-5 h-5" />
                    管理
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('players')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
              activeTab === 'players'
                ? 'bg-neon-gradient text-white shadow-lg shadow-neon-pink/20'
                : 'text-white/50 hover:text-white bg-white/5 hover:bg-white/10'
            )}
          >
            <Users className="w-4 h-4" />
            玩家列表
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">{players.length}</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'players' && (
            <motion.div
              key="players"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 sm:p-6"
            >
              {players.length === 0 ? (
                <div className="text-center py-16 text-white/40">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-40" />
                  <p>暂无玩家</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {players.map((player, idx) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isMe={player.id === playerId}
                      index={idx}
                      isHost={isHost}
                      onManage={isHost && !player.isHost ? () => {
                        setManagePlayerId(player.id);
                        setShowManage(true);
                      } : undefined}
                    />
                  ))}

                  {Array.from({ length: Math.max(0, 8 - players.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="aspect-square rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20"
                    >
                      <Users className="w-8 h-8" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showSettings && (
          <Modal title="房间设置" onClose={() => setShowSettings(false)}>
            <div className="space-y-5">
              <SettingItem label="声音效果" icon={soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}>
                <ToggleSwitch
                  checked={soundEnabled}
                  onChange={v => emit('toggleSound', { enabled: v })}
                />
              </SettingItem>

              <SettingItem label="误触灵敏度 (ms)" hint="越小越严格">
                <div className="flex items-center gap-4 flex-1">
                  <input
                    type="range"
                    min={100}
                    max={800}
                    step={50}
                    value={tempSettings.misTouchSensitivity}
                    onChange={e => setTempSettings(s => ({ ...s, misTouchSensitivity: Number(e.target.value) }))}
                    className="flex-1 accent-neon-pink"
                  />
                  <span className="font-mono text-sm w-14 text-right text-neon-pink">{tempSettings.misTouchSensitivity}</span>
                </div>
              </SettingItem>

              <SettingItem label="倒计时时长 (秒)" hint="游戏开始前的准备时间">
                <div className="flex items-center gap-4 flex-1">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={tempSettings.countdownDuration}
                    onChange={e => setTempSettings(s => ({ ...s, countdownDuration: Number(e.target.value) }))}
                    className="flex-1 accent-neon-pink"
                  />
                  <span className="font-mono text-sm w-14 text-right text-neon-pink">{tempSettings.countdownDuration}</span>
                </div>
              </SettingItem>

              <SettingItem label="自动开始" hint="准备就绪后自动开始游戏">
                <ToggleSwitch
                  checked={tempSettings.autoStart}
                  onChange={v => setTempSettings(s => ({ ...s, autoStart: v }))}
                />
              </SettingItem>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowSettings(false)}
                className="neon-btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                className="neon-btn flex-1"
              >
                保存设置
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManage && (
          <Modal title="玩家管理" onClose={() => { setShowManage(false); setManagePlayerId(null); }}>
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-2">
              {players.map(player => (
                <ManagePlayerItem
                  key={player.id}
                  player={player}
                  isMe={player.id === playerId}
                  expanded={managePlayerId === player.id}
                  isHostView={isHost}
                  onExpand={() => setManagePlayerId(managePlayerId === player.id ? null : player.id)}
                  onKick={() => handleKick(player.id)}
                  onTransferHost={() => handleTransferHost(player.id)}
                  onToggleSpectator={(v) => handleToggleSpectator(player.id, v)}
                />
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGameSelect && (
          <Modal title="选择游戏" onClose={() => setShowGameSelect(false)}>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {gameTypes.map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedGame(key)}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-left transition-all duration-300',
                      selectedGame === key
                        ? 'border-neon-pink/50 bg-neon-gradient-soft shadow-lg shadow-neon-pink/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="text-3xl mb-2">{info.icon}</div>
                    <div className="font-bold text-sm mb-1">{info.name}</div>
                    <div className="text-white/40 text-xs line-clamp-2">{info.desc}</div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/70 text-sm mb-3 font-medium">游戏规则</p>
                <ul className="space-y-1.5">
                  {GAME_INFO[selectedGame].rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/60 text-xs">
                      <span className="text-neon-pink mt-0.5">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-white/70 text-sm mb-3 font-medium">局数：{selectedRounds} 局</p>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={selectedRounds}
                  onChange={e => setSelectedRounds(Number(e.target.value))}
                  className="w-full accent-neon-pink"
                />
              </div>

              <div>
                <p className="text-white/70 text-sm mb-3 font-medium">模式</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedMode('score')}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all text-sm font-semibold',
                      selectedMode === 'score'
                        ? 'border-neon-pink/50 bg-neon-gradient-soft'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <Trophy className="w-5 h-5 mx-auto mb-1" />
                    积分赛
                    <p className="text-white/40 text-xs font-normal mt-1">累计积分排名</p>
                  </button>
                  <button
                    onClick={() => setSelectedMode('elimination')}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all text-sm font-semibold',
                      selectedMode === 'elimination'
                        ? 'border-neon-pink/50 bg-neon-gradient-soft'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                    淘汰赛
                    <p className="text-white/40 text-xs font-normal mt-1">末位淘汰制</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowGameSelect(false)}
                className="neon-btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={handleSelectGame}
                className="neon-btn flex-1 flex items-center justify-center gap-2"
              >
                确认选择
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerCard({
  player, isMe, index, isHost, onManage,
}: {
  player: Player; isMe: boolean; index: number; isHost: boolean; onManage?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'player-card relative aspect-square cursor-pointer group',
        !player.isOnline && 'opacity-50',
        isMe && 'ring-2 ring-neon-pink/50 shadow-lg shadow-neon-pink/20',
      )}
      onClick={onManage}
    >
      {player.isHost && (
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-neon-gradient flex items-center justify-center shadow-lg shadow-neon-pink/40">
          <Crown className="w-4 h-4 text-white" />
        </div>
      )}

      {player.isSpectator && (
        <div className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center">
          <Eye className="w-3.5 h-3.5 text-neon-cyan" />
        </div>
      )}

      {isHost && !player.isHost && onManage && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-white/40" />
        </div>
      )}

      <div className="text-4xl sm:text-5xl mb-2 animate-float" style={{ animationDelay: `${index * 0.2}s` }}>
        {player.avatar}
      </div>
      <div className={cn(
        'text-sm font-medium text-center truncate w-full px-1',
        isMe && 'text-neon-pink',
      )}>
        {player.nickname}
        {isMe && <span className="text-xs opacity-70"> (我)</span>}
      </div>

      <div className={cn(
        'mt-1.5 w-2 h-2 rounded-full',
        player.isOnline ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-gray-500',
      )} />
    </motion.div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative"
    >
      <div className={cn(
        'w-12 h-7 rounded-full transition-colors duration-300',
        checked ? 'bg-neon-gradient' : 'bg-white/10'
      )} />
      <div className={cn(
        'absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300',
        checked && 'translate-x-5'
      )} />
    </button>
  );
}

function SettingItem({
  label, hint, icon, children,
}: { label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
      {icon && <div className="text-neon-pink">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {hint && <p className="text-white/40 text-xs mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Modal({
  title, children, onClose,
}: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg glass-card p-6 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto scrollbar-thin"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-display neon-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ManagePlayerItem({
  player, isMe, expanded, onExpand, onKick, onTransferHost, onToggleSpectator, isHostView,
}: {
  player: Player;
  isMe: boolean;
  expanded: boolean;
  isHostView: boolean;
  onExpand: () => void;
  onKick: () => void;
  onTransferHost: () => void;
  onToggleSpectator: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={onExpand}
        className={cn(
          'w-full flex items-center gap-3 p-3 transition-colors',
          isHostView && !player.isHost ? 'hover:bg-white/5' : ''
        )}
      >
        <span className="text-3xl">{player.avatar}</span>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium">{player.nickname}</span>
            {isMe && <span className="text-xs text-neon-pink">(我)</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              player.isOnline ? 'bg-green-400' : 'bg-gray-500',
            )} />
            {player.isOnline ? '在线' : '离线'}
            {player.isHost && ' · 房主'}
            {player.isSpectator && ' · 观众'}
          </div>
        </div>
        {player.isHost || !isHostView ? null : (
          <ChevronDown className={cn(
            'w-5 h-5 text-white/40 transition-transform',
            expanded && 'rotate-180'
          )} />
        )}
      </button>

      <AnimatePresence>
        {expanded && !player.isHost && isHostView && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-3 space-y-2 bg-white/5">
              <button
                onClick={onTransferHost}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left text-sm transition-colors"
              >
                <Crown className="w-4 h-4 text-yellow-400" />
                转让房主
              </button>
              <button
                onClick={() => onToggleSpectator(!player.isSpectator)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left text-sm transition-colors"
              >
                <Eye className="w-4 h-4 text-neon-cyan" />
                {player.isSpectator ? '转为玩家' : '设为观众'}
              </button>
              {!isMe && (
                <button
                  onClick={onKick}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-left text-sm text-red-300 transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                  移出房间
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
