import { useEffect, useState } from "react";
import { io } from "socket.io-client";
function useSocket(onAlert) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:5000", {
      path: "/socket.io",
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 4e3,
      transports: ["websocket", "polling"],

      autoConnect: true
    });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    for (const e of ["sos:created", "sos:update", "sos:acknowledged"]) socket.on(e, onAlert);
    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [onAlert]);
  return connected;
}
export {
  useSocket
};
