// Client-side location tracking for drivers
export class DriverLocationTracker {
  private websocket: WebSocket | null = null;
  private locationTimer: NodeJS.Timeout | null = null;
  private isTracking = false;
  private watchId: number | null = null;
  private lastLocation: { lat: number; lng: number } | null = null;

  constructor(private userId: string) {}

  private async connectWebSocket(): Promise<void> {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      return;
    }

    // Use the current protocol and host for WebSocket connection (consistent with useWebSocket)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;
    
    // Handle cases where port is undefined or malformed (consistent with useWebSocket)
    if (host.includes(':undefined') || host.endsWith(':undefined')) {
      host = window.location.hostname;
    }
    
    // Ensure we have a port for WebSocket connection
    if (!host.includes(':')) {
      if (window.location.hostname === 'localhost') {
        host = `${window.location.hostname}:5000`;
      } else {
        const port = window.location.port || (protocol === "wss:" ? "443" : "80");
        host = `${window.location.hostname}:${port}`;
      }
    }
    
    const wsUrl = `${protocol}//${host}/ws`;
    
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('Driver WebSocket connected');
        // Register the driver for real-time updates (consistent with useWebSocket)
        this.websocket!.send(JSON.stringify({
          type: 'REGISTER',
          userId: this.userId
        }));
        resolve();
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('Driver WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (this.isTracking) {
            this.connectWebSocket();
          }
        }, 3000);
      };
    });
  }

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'DRIVER_STATUS_UPDATED':
        console.log('Driver status updated:', data.status);
        break;
      case 'ORDER_ASSIGNED':
        console.log('New order assigned:', data.order);
        // You can emit custom events or call callbacks here
        this.onOrderAssigned?.(data.order);
        break;
      case 'ORDER_DECLINED':
        console.log('Order decline confirmed:', data.message);
        break;
      default:
        console.log('Received WebSocket message:', data);
    }
  }

  private getCurrentLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000 // 30 seconds
        }
      );
    });
  }

  private async updateLocation() {
    try {
      const location = await this.getCurrentLocation();
      this.lastLocation = location;

      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'DRIVER_LOCATION_UPDATE',
          userId: this.userId,
          coordinates: location,
          latitude: location.lat,
          longitude: location.lng
        }));
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;
    
    try {
      await this.connectWebSocket();
      
      // Set driver as available
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'DRIVER_AVAILABILITY_TOGGLE',
          userId: this.userId,
          isAvailable: true
        }));
      }

      // Update location immediately
      await this.updateLocation();

      // Set up timer to update location every minute
      this.locationTimer = setInterval(() => {
        this.updateLocation();
      }, 60000); // 60 seconds

      console.log('Driver location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      this.isTracking = false;
      throw error;
    }
  }

  async stopTracking(): Promise<void> {
    this.isTracking = false;

    // Clear location timer
    if (this.locationTimer) {
      clearInterval(this.locationTimer);
      this.locationTimer = null;
    }

    // Stop watching position
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Set driver as unavailable
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'DRIVER_AVAILABILITY_TOGGLE',
        userId: this.userId,
        isAvailable: false
      }));
    }

    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    console.log('Driver location tracking stopped');
  }

  async declineOrder(orderId: string): Promise<void> {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'DRIVER_DECLINE_ORDER',
        userId: this.userId,
        orderId
      }));
    }
  }

  getLastLocation(): { lat: number; lng: number } | null {
    return this.lastLocation;
  }

  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  // Callback functions that can be set by the implementing app
  onOrderAssigned?: (order: any) => void;
  onStatusUpdated?: (status: string) => void;
}