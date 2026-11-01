import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AlertNotification } from "../types";
import { useAuth } from "./AuthContext";

interface AlertsContextType {
  alerts: AlertNotification[];
  activeAlert: AlertNotification | null;
  dismissAlert: (timestamp?: string) => void;
  clearAlerts: () => void;
  isConnected: boolean;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export const AlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [activeAlert, setActiveAlert] = useState<AlertNotification | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connectWebSocket = () => {
      try {
        const loc = window.location;
        const proto = loc.protocol === "https:" ? "wss:" : "ws:";
        // In local development on Vite dev server (port 3000), connect to port 8000
        const host = loc.port === "3000" ? `${loc.hostname}:8000` : loc.host;
        const wsUrl = `${proto}//${host}/ws/alerts?token=${encodeURIComponent(token)}`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data: AlertNotification = JSON.parse(event.data);
            if (data.type === "CONSUMPTION_LIMIT_EXCEEDED") {
              setAlerts((prev) => [data, ...prev]);
              setActiveAlert(data);
            }
          } catch (err) {
            console.error("Failed to parse alert WebSocket message:", err);
          }
        };

        socket.onclose = (event) => {
          setIsConnected(false);
          // Only attempt reconnect if still authenticated and not cleanly closed
          if (token && event.code !== 1000) {
            reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, 3000);
          }
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch (e) {
        console.error("WebSocket setup error:", e);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [token, user]);

  const dismissAlert = (timestamp?: string) => {
    if (!timestamp) {
      setActiveAlert(null);
    } else {
      setActiveAlert((prev) => (prev?.timestamp === timestamp ? null : prev));
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
    setActiveAlert(null);
  };

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        activeAlert,
        dismissAlert,
        clearAlerts,
        isConnected,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error("useAlerts must be used within an AlertsProvider");
  }
  return context;
};
