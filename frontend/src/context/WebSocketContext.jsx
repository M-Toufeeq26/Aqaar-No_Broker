import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      let ws;
      let reconnectTimeout;
      let reconnectDelay = 1000;

      const connect = () => {
        const wsUrl = `ws://localhost:8000/ws/${user.id}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket Connected');
          reconnectDelay = 1000; // reset on successful connect
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket Message Received:', data);
            setLastMessage({ ...data, _ts: Date.now() });
          } catch (err) {
            console.error('Failed to parse WebSocket message', err);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket Disconnected, reconnecting...');
          setSocket(null);
          reconnectTimeout = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            connect();
          }, reconnectDelay);
        };

        ws.onerror = (error) => {
          console.error('WebSocket Error:', error);
        };

        wsRef.current = ws;
        setSocket(ws);
      };

      connect();

      return () => {
        clearTimeout(reconnectTimeout);
        ws?.close();
      };
    }
  }, [isAuthenticated, user]);

  return (
    <WebSocketContext.Provider value={{ socket, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  return useContext(WebSocketContext);
};
