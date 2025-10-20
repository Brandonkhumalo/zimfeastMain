import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export function useWebSocket(url: string, onMessage: (data: any) => void) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Fix WebSocket URL construction to handle undefined port
    let host = window.location.host;
    
    // Handle cases where port is undefined or malformed
    if (host.includes(':undefined') || host.endsWith(':undefined')) {
      host = window.location.hostname;
    }
    
    // Ensure we have a port for WebSocket connection
    if (!host.includes(':')) {
      if (window.location.hostname === 'localhost') {
        host = `${window.location.hostname}:5000`;
      } else {
        // For production/replit environment, use current port or default to 443/80
        const port = window.location.port || (protocol === "wss:" ? "443" : "80");
        host = `${window.location.hostname}:${port}`;
      }
    }
    
    const wsUrl = `${protocol}//${host}${url}`;
    
    console.log('Connecting to WebSocket:', wsUrl); // Debug log
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Register user for real-time updates
      ws.send(JSON.stringify({
        type: 'REGISTER',
        userId: user.id
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, url, onMessage]);

  return wsRef.current;
}
