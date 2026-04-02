import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "";

let socket: Socket | null = null;
let joinedUserId: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(userId: string): Socket {
  const s = getSocket();
  joinedUserId = userId;

  const joinRoom = () => {
    if (joinedUserId) {
      s.emit("join:user", joinedUserId);
    }
  };

  s.off("connect", joinRoom);
  s.on("connect", joinRoom);

  if (!s.connected) {
    s.connect();
  } else {
    joinRoom();
  }

  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  joinedUserId = null;
}
