import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { supabase } from "../services/supabase";

function useSocket(onAlert) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const alertIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const syncAuth = async () => {
      let token = null;
      try {
        const { data } = (await supabase?.auth?.getSession?.()) || {};
        token = data?.session?.access_token || null;
      } catch {
        return;
      }
      if (!cancelled && socketRef.current) {
        socketRef.current.auth = token ? { token } : {};
      }
    };

    const connect = async () => {
      let token = null;
      try {
        const { data } = (await supabase?.auth?.getSession?.()) || {};
        token = data?.session?.access_token || null;
      } catch {
        token = null;
      }
      if (cancelled) return;

      const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
        path: "/socket.io",
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 4e3,
        transports: ["websocket", "polling"],
        autoConnect: true,
        auth: token ? { token } : {},
      });

      socketRef.current = socket;
      socket.io.on("reconnect_attempt", () => {
        syncAuth();
      });
      socket.on("connect", () => {
        setConnected(true);
        if (alertIdRef.current) socket.emit("sos:subscribe", alertIdRef.current);
      });
      socket.on("disconnect", () => {
        setConnected(false);
        syncAuth();
      });
      socket.on("connect_error", () => {
        setConnected(false);
        syncAuth();
      });

      for (const event of ["sos:created", "sos:update", "sos:acknowledged"]) {
        socket.on(event, (nextAlert) => {
          onAlert(nextAlert);
          if (nextAlert?.id) {
            socket.emit("sos:delivery-ack", nextAlert.id);
          }
        });
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [onAlert]);

  const subscribe = useCallback((alertId, accessToken = null) => {
    alertIdRef.current = alertId ? { id: alertId, token: accessToken } : null;
    if (alertId && socketRef.current?.connected) {
      socketRef.current.emit("sos:subscribe", {
        id: alertId,
        token: accessToken,
      });
    }
  }, []);

  return { connected, subscribe };
}

export { useSocket };
