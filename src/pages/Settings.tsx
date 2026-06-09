import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Volume2, VolumeX, Timer, Zap, Home, Save } from 'lucide-react';
import { useAppStore } from '@/store';
import { emit } from '@/services/socket';

const COUNTDOWN_OPTIONS = [1, 2, 3, 4, 5];

export default function Settings() {
  const navigate = useNavigate();
  const { soundEnabled, settings, isHost, roomCode } = useAppStore();
  const [localSoundEnabled, setLocalSoundEnabled] = useState(soundEnabled);
  const [misTouchSensitivity, setMisTouchSensitivity] = useState(settings.misTouchSensitivity);
  const [countdownDuration, setCountdownDuration] = useState(settings.countdownDuration);

  const handleSave = () => {
    emit('toggleSound', { enabled: localSoundEnabled });
    emit('updateSettings', {
      misTouchSensitivity,
      countdownDuration,
    });
    navigate(-1);
  };

  const sensitivityLabel = misTouchSensitivity < 200
    ? '高（容易判定误触）'
    : misTouchSensitivity > 500
      ? '低（不易判定误触）'
      : '中（平衡）';

  return (
    <div className="page-container min-h-screen mobile-safe">
      <div className="particle-bg">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              width: `${Math.random() * 6 + 2}px`,
              height: `${Math.random() * 6 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: i % 3 === 0 ? '#8822FF' : i % 3 === 1 ? '#00FFCC' : '#FF2288',
              animationDuration: `${Math.random() * 4 + 3}s`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="neon-btn-secondary !px-4 !py-2 flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            返回
          </button>
          <h1 className="text-2xl md:text-3xl font-bold neon-text-glow">游戏设置</h1>
          <div className="w-[88px]" />
        </div>

        <div className="glass-card p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-neon-yellow" />
            <span className="text-white/70 text-sm">房间号</span>
            <span className="font-mono text-lg font-bold text-neon-yellow">{roomCode}</span>
          </div>
          {isHost ? (
            <div className="px-3 py-1 rounded-full bg-neon-cyan/20 border border-neon-cyan/30">
              <span className="text-xs font-semibold text-neon-cyan">可编辑</span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
              <span className="text-xs font-semibold text-white/60">仅查看</span>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${localSoundEnabled
                    ? 'bg-neon-gradient shadow-lg shadow-neon-pink/30'
                    : 'bg-white/10'
                  }`}
                >
                  {localSoundEnabled ? (
                    <Volume2 size={26} className="text-white" />
                  ) : (
                    <VolumeX size={26} className="text-white/50" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-white text-lg">音效开关</div>
                  <div className="text-sm text-white/50">
                    {localSoundEnabled ? '游戏音效已开启' : '游戏音效已静音'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => isHost && setLocalSoundEnabled(!localSoundEnabled)}
                disabled={!isHost}
                className={`relative w-16 h-9 rounded-full transition-all duration-300
                  ${localSoundEnabled ? 'bg-neon-gradient' : 'bg-white/10'}
                  ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <motion.div
                  animate={{ x: localSoundEnabled ? 30 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-7 h-7 rounded-full bg-white shadow-lg"
                />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                <Zap size={26} className="text-neon-yellow" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-white text-lg">误触灵敏度</div>
                <div className="text-sm text-white/50">抢答游戏中提前按键的判定时间窗口</div>
              </div>
              <div className="px-3 py-1 rounded-full bg-neon-yellow/20 border border-neon-yellow/30">
                <span className="text-sm font-bold text-neon-yellow">{misTouchSensitivity}ms</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="range"
                  min={100}
                  max={800}
                  step={50}
                  value={misTouchSensitivity}
                  onChange={(e) => isHost && setMisTouchSensitivity(Number(e.target.value))}
                  disabled={!isHost}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer
                    bg-white/10 accent-neon-yellow
                    disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: `linear-gradient(to right, #FFDD00 0%, #FFDD00 ${((misTouchSensitivity - 100) / 700) * 100}%, rgba(255,255,255,0.1) ${((misTouchSensitivity - 100) / 700) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>100ms</span>
                <span className={`font-semibold ${
                  misTouchSensitivity < 200 ? 'text-neon-pink' :
                  misTouchSensitivity > 500 ? 'text-neon-cyan' : 'text-neon-yellow'
                }`}>
                  {sensitivityLabel}
                </span>
                <span>800ms</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                <Timer size={26} className="text-neon-cyan" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-white text-lg">倒计时时长</div>
                <div className="text-sm text-white/50">每轮游戏开始前的倒计时秒数</div>
              </div>
              <div className="px-3 py-1 rounded-full bg-neon-cyan/20 border border-neon-cyan/30">
                <span className="text-sm font-bold text-neon-cyan">{countdownDuration}秒</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {COUNTDOWN_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => isHost && setCountdownDuration(sec)}
                  disabled={!isHost}
                  className={`relative py-4 rounded-xl font-bold text-lg transition-all duration-300 overflow-hidden
                    ${countdownDuration === sec
                      ? 'text-white shadow-lg scale-105'
                      : 'text-white/50 border border-white/10 hover:bg-white/10 hover:text-white'
                    } ${!isHost ? 'cursor-not-allowed opacity-60' : ''}`}
                  style={countdownDuration === sec ? {
                    background: 'linear-gradient(135deg, rgba(0,255,204,0.9) 0%, rgba(136,34,255,0.9) 100%)',
                    boxShadow: '0 0 20px rgba(0,255,204,0.4)',
                  } : {}}
                >
                  {countdownDuration === sec && (
                    <motion.div
                      layoutId="countdownActive"
                      className="absolute inset-0 bg-neon-gradient opacity-90"
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <span className="relative z-10">{sec}s</span>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-5 border border-white/10"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-neon-gradient-soft border border-neon-purple/30 flex items-center justify-center">
                <Zap size={26} className="text-neon-purple" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-white text-lg">当前配置预览</div>
                <div className="text-sm text-white/50">即将应用到游戏房间的设置</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-white/40 mb-1">音效</div>
                <div className={`font-bold ${localSoundEnabled ? 'text-neon-pink' : 'text-white/40'}`}>
                  {localSoundEnabled ? '开启' : '关闭'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-white/40 mb-1">灵敏度</div>
                <div className="font-bold text-neon-yellow">{misTouchSensitivity}ms</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-white/40 mb-1">倒计时</div>
                <div className="font-bold text-neon-cyan">{countdownDuration}秒</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-3 mt-8 pb-6">
          {isHost && (
            <button
              onClick={handleSave}
              className="neon-btn w-full text-lg flex items-center justify-center gap-2"
            >
              <Save size={22} />
              保存设置
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="neon-btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Home size={20} />
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}
