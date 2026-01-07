const OrderService = require('../services/OrderService');

function setupDriverSocket(namespace, driverService, orderService, redisClient) {
  namespace.on('connection', (socket) => {
    console.log('Driver connected:', socket.id);
    
    socket.on('driver:register', async (data) => {
      const { driverId, name, phone, vehicle, lat, lng } = data;
      
      socket.driverId = driverId;
      socket.driverName = name;
      socket.driverPhone = phone;
      socket.driverVehicle = vehicle;
      socket.driverLat = lat;
      socket.driverLng = lng;
      socket.driverStatus = 'available';
      
      socket.join(`driver:${driverId}`);
      
      console.log(`Driver ${driverId} (${name}) registered at ${lat}, ${lng}`);
      
      socket.emit('driver:registered', {
        success: true,
        message: 'You are now online and available for deliveries'
      });
    });
    
    socket.on('driver:location_update', async (data) => {
      const { lat, lng } = data;
      
      if (socket.driverId) {
        socket.driverLat = lat;
        socket.driverLng = lng;
        
        if (socket.currentOrderId) {
          namespace.server.of('/customers')
            .to(`order:${socket.currentOrderId}`)
            .emit('driver:location', {
              orderId: socket.currentOrderId,
              driverId: socket.driverId,
              lat,
              lng,
              timestamp: Date.now()
            });
        }
        
        if (redisClient && redisClient.isOpen) {
          await redisClient.hSet(`driver:${socket.driverId}:location`, {
            lat: lat.toString(),
            lng: lng.toString(),
            timestamp: Date.now().toString()
          });
        }
      }
    });
    
    socket.on('delivery:accept', async (data) => {
      const { orderId } = data;
      
      if (!socket.driverId) {
        socket.emit('error', { message: 'Not registered' });
        return;
      }
      
      const result = await orderService.handleDriverAccept(
        namespace.server,
        socket.driverId,
        orderId,
        {
          name: socket.driverName,
          phone: socket.driverPhone,
          vehicle: socket.driverVehicle,
          lat: socket.driverLat,
          lng: socket.driverLng
        }
      );
      
      if (result.success) {
        socket.driverStatus = 'busy';
        socket.currentOrderId = orderId;
        socket.join(`order:${orderId}`);
        
        socket.emit('delivery:accepted', {
          orderId,
          message: 'Delivery assigned to you!'
        });
      } else {
        socket.emit('delivery:accept_failed', {
          orderId,
          message: result.message
        });
      }
    });
    
    socket.on('delivery:reject', async (data) => {
      const { orderId, reason } = data;
      
      if (!socket.driverId) {
        socket.emit('error', { message: 'Not registered' });
        return;
      }
      
      console.log(`Driver ${socket.driverId} rejected order ${orderId}: ${reason || 'No reason'}`);
      
      await orderService.handleDriverReject(
        namespace.server,
        socket.driverId,
        orderId
      );
      
      socket.emit('delivery:rejected', {
        orderId,
        message: 'Delivery declined'
      });
    });
    
    socket.on('delivery:status', async (data) => {
      const { orderId, status } = data;
      
      if (!socket.driverId || socket.currentOrderId !== orderId) {
        socket.emit('error', { message: 'Not authorized for this order' });
        return;
      }
      
      const validStatuses = ['arrived_restaurant', 'picked_up', 'out_for_delivery', 'arrived_destination', 'delivered'];
      if (!validStatuses.includes(status)) {
        socket.emit('error', { message: 'Invalid status' });
        return;
      }
      
      await orderService.updateOrderStatus(
        namespace.server,
        orderId,
        status,
        { lat: socket.driverLat, lng: socket.driverLng }
      );
      
      socket.emit('delivery:status_updated', { orderId, status });
      
      if (status === 'delivered') {
        socket.driverStatus = 'available';
        socket.currentOrderId = null;
        socket.leave(`order:${orderId}`);
      }
    });
    
    socket.on('driver:go_offline', () => {
      if (socket.driverId) {
        socket.driverStatus = 'offline';
        console.log(`Driver ${socket.driverId} went offline`);
        socket.emit('driver:offline', { message: 'You are now offline' });
      }
    });
    
    socket.on('driver:go_online', () => {
      if (socket.driverId && !socket.currentOrderId) {
        socket.driverStatus = 'available';
        console.log(`Driver ${socket.driverId} is now online`);
        socket.emit('driver:online', { message: 'You are now available for deliveries' });
      }
    });
    
    socket.on('disconnect', () => {
      if (socket.driverId) {
        console.log(`Driver ${socket.driverId} disconnected`);
      }
    });
  });
}

module.exports = setupDriverSocket;
