import { io, type Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!_socket) {
    _socket = io(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001', {
      autoConnect: true,
      reconnectionAttempts: 5,
    });
  }
  return _socket;
}
