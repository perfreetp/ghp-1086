import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Lobby from "@/pages/Lobby";
import Room from "@/pages/Room";
import GameSelect from "@/pages/GameSelect";
import Game from "@/pages/Game";
import Result from "@/pages/Result";
import Players from "@/pages/Players";
import Settings from "@/pages/Settings";
import { on } from "@/services/socket";
import { useAppStore } from "@/store";
import { SFX } from "@/utils/audio";

function SocketListener() {
  const setRoom = useAppStore(s => s.setRoom);
  const setGameState = useAppStore(s => s.setGameState);
  const setRoundResult = useAppStore(s => s.setRoundResult);
  const setFinalResult = useAppStore(s => s.setFinalResult);
  const setPunishment = useAppStore(s => s.setPunishment);
  const setError = useAppStore(s => s.setError);
  const reset = useAppStore(s => s.reset);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const navigate = useNavigate();

  useEffect(() => {
    const u1 = on('roomState', (d: any) => setRoom(d));
    const u2 = on('gameStateUpdate', (d: any) => setGameState(d));
    const u3 = on('roundEnd', (d: any) => { SFX.pop(soundEnabled); setRoundResult(d); });
    const u4 = on('gameEnd', (d: any) => { SFX.victory(soundEnabled); setFinalResult(d); });
    const u5 = on('punishmentDrawn', (d: any) => { SFX.draw(soundEnabled); setPunishment(d); });
    const u6 = on('gamePaused', () => SFX.click(soundEnabled));
    const u7 = on('gameResumed', () => SFX.click(soundEnabled));
    const u8 = on('error', (d: any) => setError(d?.message || '发生错误'));
    const u9 = on('gameActionResult', (d: any) => {
      if (d?.result?.correct) SFX.correct(soundEnabled);
      else if (d?.result?.misTouch || (d?.result?.correct === false && d.action !== 'buzz_press')) SFX.wrong(soundEnabled);
      else if (d.action === 'buzz_press' && d?.result?.active) SFX.buzz(soundEnabled);
      else if (d?.result?.judgment === 'perfect') SFX.correct(soundEnabled);
      else if (d?.result?.judgment === 'good') SFX.pop(soundEnabled);
      else if (d?.result?.judgment === 'miss') SFX.miss(soundEnabled);
      else SFX.click(soundEnabled);
    });
    const u10 = on('kicked', () => {
      reset();
      navigate('/', { replace: true });
      setError('你已被移出房间');
    });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); };
  }, [setRoom, setGameState, setRoundResult, setFinalResult, setPunishment, setError, reset, soundEnabled, navigate]);

  return null;
}

function RequireRoom({ children }: { children: React.ReactNode }) {
  const roomId = useAppStore(s => s.roomId);
  if (!roomId) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireHost({ children }: { children: React.ReactNode }) {
  const isHost = useAppStore(s => s.isHost);
  const roomId = useAppStore(s => s.roomId);
  if (!roomId) return <Navigate to="/" replace />;
  if (!isHost) return <Navigate to="/room" replace />;
  return <>{children}</>;
}

function GameRedirect() {
  const status = useAppStore(s => s.status);
  const finalResult = useAppStore(s => s.finalResult);
  if (finalResult) return <Navigate to="/result" replace />;
  if (status !== 'playing') return <Navigate to="/room" replace />;
  return <Game />;
}

export default function App() {
  return (
    <Router>
      <SocketListener />
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room" element={<RequireRoom><Room /></RequireRoom>} />
        <Route path="/game-select" element={<RequireHost><GameSelect /></RequireHost>} />
        <Route path="/game" element={<GameRedirect />} />
        <Route path="/result" element={<RequireRoom><Result /></RequireRoom>} />
        <Route path="/players" element={<RequireHost><Players /></RequireHost>} />
        <Route path="/settings" element={<RequireHost><Settings /></RequireHost>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
