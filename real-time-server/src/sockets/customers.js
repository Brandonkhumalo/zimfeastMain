function setupCustomerSocket(namespace, orderService, redisClient) {
  namespace.on('connection', (socket) => {
    console.log('Customer connected:', socket.id);
    
    socket.on('order:subscribe', async (data) => {
      const { orderId, customerId } = data;
      
      socket.customerId = customerId;
      socket.join(`order:${orderId}`);
      socket.join(`customer:${customerId}`);
      
      console.log(`Customer ${customerId} subscribed to order ${orderId}`);
      
      const order = orderService.getOrder(orderId);
      if (order) {
        socket.emit('order:status', {
          orderId,
          status: order.status,
          driver: order.driverId ? {
            id: order.driverId,
            name: order.driverName,
            phone: order.driverPhone,
            vehicle: order.driverVehicle
          } : null
        });
      }
      
      socket.emit('order:subscribed', { orderId });
    });
    
    socket.on('order:unsubscribe', (data) => {
      const { orderId } = data;
      socket.leave(`order:${orderId}`);
      console.log(`Customer unsubscribed from order ${orderId}`);
    });
    
    socket.on('order:get_eta', async (data) => {
      const { orderId } = data;
      const eta = await orderService.calculateETA(orderId);
      socket.emit('order:eta', { orderId, ...eta });
    });
    
    socket.on('driver:rate', async (data) => {
      const { orderId, driverId, rating, comment } = data;
      
      console.log(`Rating for driver ${driverId}: ${rating} stars`);
      
      try {
        const axios = require('axios');
        const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000';
        await axios.post(`${djangoUrl}/api/drivers/driver/${driverId}/rate/`, {
          order_id: orderId,
          rating,
          comment
        });
        
        socket.emit('driver:rated', { 
          success: true, 
          message: 'Thank you for your rating!' 
        });
      } catch (err) {
        console.error('Failed to submit rating:', err.message);
        socket.emit('driver:rated', { 
          success: false, 
          message: 'Failed to submit rating' 
        });
      }
    });
    
    socket.on('disconnect', () => {
      if (socket.customerId) {
        console.log(`Customer ${socket.customerId} disconnected`);
      }
    });
  });
}

module.exports = setupCustomerSocket;
