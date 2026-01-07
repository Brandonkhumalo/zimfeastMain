import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface DriverLocation {
  lat: number;
  lng: number;
}

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  lat?: number;
  lng?: number;
}

interface OrderStatusUpdate {
  orderId: string;
  status: string;
  driverLocation?: DriverLocation;
  timestamp?: number;
}

interface OrderSocketState {
  connected: boolean;
  status: string | null;
  driver: DriverInfo | null;
  driverLocation: DriverLocation | null;
  eta: number | null;
}

export function useOrderSocket(orderId: string | null, orderMethod?: 'delivery' | 'collection') {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<OrderSocketState>({
    connected: false,
    status: null,
    driver: null,
    driverLocation: null,
    eta: null,
  });

  const connect = useCallback(() => {
    if (!orderId || socketRef.current?.connected) return;

    const realtimeUrl = import.meta.env.VITE_REALTIME_URL || 
      (window.location.protocol === 'https:' 
        ? `https://${window.location.hostname}:3001` 
        : 'http://localhost:3001');

    const socket = io(`${realtimeUrl}/customers`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Customer socket connected');
      setState(prev => ({ ...prev, connected: true }));
      socket.emit('customer:join', { orderId, orderMethod });
    });

    socket.on('disconnect', () => {
      console.log('Customer socket disconnected');
      setState(prev => ({ ...prev, connected: false }));
    });

    socket.on('order:status', (data: OrderStatusUpdate) => {
      if (data.orderId === orderId) {
        setState(prev => ({
          ...prev,
          status: data.status,
          driverLocation: data.driverLocation || prev.driverLocation,
        }));
      }
    });

    socket.on('order:driver_assigned', (data: any) => {
      if (data.orderId === orderId) {
        setState(prev => ({
          ...prev,
          status: 'assigned',
          driver: data.driver,
          driverLocation: data.driver?.lat && data.driver?.lng 
            ? { lat: data.driver.lat, lng: data.driver.lng }
            : prev.driverLocation,
        }));
      }
    });

    socket.on('driver:location', (data: any) => {
      if (data.orderId === orderId && data.location) {
        setState(prev => ({
          ...prev,
          driverLocation: data.location,
          eta: data.eta || prev.eta,
        }));
      }
    });

    socket.on('order:no_drivers', (data: any) => {
      if (data.orderId === orderId) {
        setState(prev => ({
          ...prev,
          status: 'finding_driver',
        }));
      }
    });

    socket.on('order:completed', (data: any) => {
      if (data.orderId === orderId) {
        setState(prev => ({
          ...prev,
          status: orderMethod === 'collection' ? 'collected' : 'delivered',
        }));
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

  }, [orderId, orderMethod]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    ...state,
    reconnect: connect,
    disconnect,
  };
}
