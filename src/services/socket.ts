import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
const listeners: Map<string, ((...args: any[]) => void)[]> = new Map();

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }
  return socket;
}

export function on(event: string, handler: (...args: any[]) => void) {
  const s = getSocket();
  s.on(event, handler);
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event)!.push(handler);
  return () => s.off(event, handler);
}

export function once(event: string, handler: (...args: any[]) => void) {
  getSocket().once(event, handler);
}

export function emit(event: string, data?: any, callback?: (response: any) => void) {
  if (callback) {
    getSocket().emit(event, data, callback);
  } else {
    getSocket().emit(event, data);
  }
}

export function disconnectSocket() {
  if (socket) {
    listeners.forEach((handlers, event) => {
      handlers.forEach(h => socket!.off(event, h));
    });
    listeners.clear();
    socket.disconnect();
    socket = null;
  }
}

export function getSocketId(): string | undefined {
  return socket?.id;
}
