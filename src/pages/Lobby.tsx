import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, LogIn, User, Gamepad2, AlertCircle, X } from 'lucide-react';
import { AVATARS } from '../../shared/types';
import { useAppStore, getRandomAvatar } from '../store';
import { emit, on } from '../services/socket';
import { cn } from '../lib/utils';

type TabMode = 'create' | 'join';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

export default function Lobby() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TabMode>('create');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(getRandomAvatar());
  const [roomCode, setRoomCode] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setPlayer = useAppStore(s => s.setPlayer);
  const setRoom = useAppStore(s => s.setRoom);
  const setError = useAppStore(s => s.setError);

  const particles = useMemo<Particle[]>(() => {
    const colors = ['#FF2288', '#8822FF', '#00FFCC', '#FFDD00'];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 5,
    }));
  }, []);

  useEffect(() => {
    const unsub1 = on('roomCreated', (data: { roomId: string; playerId: string; code: string; isHost: boolean }) => {
      setPlayer(data.playerId, data.roomId, data.code, data.isHost);
      setLoading(false);
      navigate('/room');
    });

    const unsub2 = on('joinedRoom', (data: { roomId: string; playerId: string; isHost: boolean }) => {
      setPlayer(data.playerId, data.roomId, roomCode.toUpperCase(), data.isHost);
      setLoading(false);
      navigate('/room');
    });

    const unsub3 = on('roomState', (data: any) => {
      setRoom(data);
    });

    const unsub4 = on('error', (data: { code: string; message: string }) => {
      setErrorMsg(data.message);
      setError(data.message);
      setLoading(false);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [navigate, roomCode, setPlayer, setRoom, setError]);

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!nickname.trim()) {
      setErrorMsg('请输入昵称');
      return;
    }
    if (nickname.trim().length > 12) {
      setErrorMsg('昵称最多12个字符');
      return;
    }
    if (mode === 'join' && !roomCode.trim()) {
      setErrorMsg('请输入房间码');
      return;
    }
    setLoading(true);
    if (mode === 'create') {
      emit('createRoom', { nickname: nickname.trim(), avatar });
    } else {
      emit('joinRoom', { roomCode: roomCode.toUpperCase(), nickname: nickname.trim(), avatar, isSpectator });
    }
  };

  const canSubmit = nickname.trim().length > 0 && (mode === 'create' || roomCode.trim().length === 6);

  return (
    <div className="page-container mobile-safe flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="particle-bg">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Gamepad2 className="w-10 h-10 text-neon-pink animate-pulse-glow rounded-xl p-2 bg-neon-gradient" />
            <h1 className="text-4xl sm:text-5xl font-bold font-display">
              <span className="neon-text">Party</span>
              <span className="neon-text-glow">Arena</span>
            </h1>
          </div>
          <p className="text-white/50 text-sm sm:text-base">多人互动游戏派对大厅</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card p-6 sm:p-8"
        >
          <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
            <button
              onClick={() => setMode('create')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-300',
                mode === 'create'
                  ? 'bg-neon-gradient text-white shadow-lg shadow-neon-pink/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <Plus className="w-5 h-5" />
              创建房间
            </button>
            <button
              onClick={() => setMode('join')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all duration-300',
                mode === 'join'
                  ? 'bg-neon-gradient text-white shadow-lg shadow-neon-pink/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <LogIn className="w-5 h-5" />
              加入房间
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'join' && (
              <motion.div
                key="join"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-5"
              >
                <label className="block text-white/70 text-sm font-medium mb-2">房间码</label>
                <div className="relative">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="输入6位房间码"
                    className="neon-input tracking-[0.3em] text-center font-mono text-xl uppercase"
                    maxLength={6}
                  />
                  {roomCode && (
                    <button
                      onClick={() => setRoomCode('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-3 mt-4 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSpectator}
                      onChange={e => setIsSpectator(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 rounded-full bg-white/10 peer-checked:bg-neon-gradient transition-colors duration-300" />
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 peer-checked:translate-x-5" />
                  </div>
                  <span className="text-white/70 group-hover:text-white transition-colors text-sm">以观众身份加入（不参与游戏）</span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-5">
            <label className="block text-white/70 text-sm font-medium mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="输入你的昵称（最多12字）"
              className="neon-input"
              maxLength={12}
            />
          </div>

          <div className="mb-6">
            <label className="block text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              选择头像
            </label>
            <div className="grid grid-cols-8 gap-2 max-h-44 overflow-y-auto scrollbar-thin p-2 bg-white/5 rounded-xl">
              {AVATARS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setAvatar(emoji)}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center text-2xl rounded-xl transition-all duration-200',
                    avatar === emoji
                      ? 'bg-neon-gradient scale-110 shadow-lg shadow-neon-pink/40 ring-2 ring-neon-pink/50'
                      : 'bg-white/5 hover:bg-white/10 hover:scale-105'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{errorMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="neon-btn w-full text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                连接中...
              </>
            ) : mode === 'create' ? (
              <>
                <Plus className="w-5 h-5" />
                创建房间并开始
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                加入房间
              </>
            )}
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-white/30 text-xs mt-6"
        >
          创建房间后可分享房间码给朋友一起游玩
        </motion.p>
      </div>
    </div>
  );
}
