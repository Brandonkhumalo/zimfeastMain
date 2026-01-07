const axios = require('axios');

class OrderService {
  constructor(redisClient, driverService) {
    this.redis = redisClient;
    this.driverService = driverService;
    this.activeOrders = new Map();
    this.orderRejections = new Map();
    this.pendingOffers = new Map();
  }

  static async handleNewDeliveryOrder(io, redisClient, orderData) {
    const orderService = new OrderService(redisClient, null);
    
    const order = {
      id: orderData.orderId,
      customerId: orderData.customerId,
      customerName: orderData.customerName,
      restaurantId: orderData.restaurantId,
      restaurantName: orderData.restaurantName,
      restaurantLat: orderData.restaurantLat,
      restaurantLng: orderData.restaurantLng,
      dropoffLat: orderData.dropoffLat,
      dropoffLng: orderData.dropoffLng,
      dropoffAddress: orderData.dropoffAddress,
      items: orderData.items || [],
      total: orderData.total || 0,
      tip: orderData.tip || 0,
      status: 'finding_driver',
      driverId: null,
      createdAt: Date.now()
    };
    
    orderService.activeOrders.set(order.id, order);
    
    if (redisClient && redisClient.isOpen) {
      await redisClient.hSet(`order:${order.id}`, {
        ...order,
        items: JSON.stringify(order.items),
        createdAt: order.createdAt.toString()
      });
    }
    
    await orderService.findAndOfferToDriver(io, order, []);
  }

  async findAndOfferToDriver(io, order, excludeDriverIds = []) {
    const driverNamespace = io.of('/drivers');
    
    const onlineDrivers = [];
    for (const [socketId, socket] of driverNamespace.sockets) {
      if (socket.driverId && socket.driverStatus === 'available') {
        const driver = {
          id: socket.driverId,
          socketId,
          lat: socket.driverLat || 0,
          lng: socket.driverLng || 0,
          name: socket.driverName || 'Driver',
          phone: socket.driverPhone || '',
          vehicle: socket.driverVehicle || 'Car'
        };
        
        if (!excludeDriverIds.includes(driver.id)) {
          driver.distance = this.calculateDistance(
            order.restaurantLat, order.restaurantLng,
            driver.lat, driver.lng
          );
          onlineDrivers.push(driver);
        }
      }
    }
    
    onlineDrivers.sort((a, b) => a.distance - b.distance);
    
    if (onlineDrivers.length === 0) {
      console.log(`No available drivers for order ${order.id}`);
      io.of('/customers').to(`order:${order.id}`).emit('order:no_drivers', {
        orderId: order.id,
        message: 'No drivers available. We will keep trying.'
      });
      
      setTimeout(() => {
        this.findAndOfferToDriver(io, order, excludeDriverIds);
      }, 30000);
      return;
    }
    
    const nearestDriver = onlineDrivers[0];
    console.log(`Offering order ${order.id} to driver ${nearestDriver.id}`);
    
    this.pendingOffers.set(order.id, {
      driverId: nearestDriver.id,
      offeredAt: Date.now()
    });
    
    const offerData = {
      orderId: order.id,
      restaurantName: order.restaurantName,
      restaurantLat: order.restaurantLat,
      restaurantLng: order.restaurantLng,
      dropoffAddress: order.dropoffAddress,
      dropoffLat: order.dropoffLat,
      dropoffLng: order.dropoffLng,
      distance: nearestDriver.distance.toFixed(2),
      total: order.total,
      tip: order.tip,
      items: order.items,
      expiresIn: 30
    };
    
    driverNamespace.to(nearestDriver.socketId).emit('delivery:offer', offerData);
    
    setTimeout(async () => {
      const pending = this.pendingOffers.get(order.id);
      if (pending && pending.driverId === nearestDriver.id) {
        console.log(`Offer expired for driver ${nearestDriver.id}`);
        this.pendingOffers.delete(order.id);
        excludeDriverIds.push(nearestDriver.id);
        await this.findAndOfferToDriver(io, order, excludeDriverIds);
      }
    }, 30000);
  }

  async handleDriverAccept(io, driverId, orderId, driverData) {
    const pending = this.pendingOffers.get(orderId);
    if (!pending || pending.driverId !== driverId) {
      return { success: false, message: 'Offer expired or already taken' };
    }
    
    this.pendingOffers.delete(orderId);
    
    const order = this.activeOrders.get(orderId);
    if (order) {
      order.driverId = driverId;
      order.status = 'driver_assigned';
      order.driverName = driverData.name;
      order.driverPhone = driverData.phone;
      order.driverVehicle = driverData.vehicle;
      this.activeOrders.set(orderId, order);
    }
    
    io.of('/customers').to(`order:${orderId}`).emit('order:driver_assigned', {
      orderId,
      driver: {
        id: driverId,
        name: driverData.name,
        phone: driverData.phone,
        vehicle: driverData.vehicle,
        lat: driverData.lat,
        lng: driverData.lng
      }
    });
    
    try {
      const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000';
      await axios.post(`${djangoUrl}/api/orders/order/${orderId}/assign-driver/`, {
        driver_id: driverId
      });
    } catch (err) {
      console.error('Failed to notify Django:', err.message);
    }
    
    return { success: true };
  }

  async handleDriverReject(io, driverId, orderId) {
    const pending = this.pendingOffers.get(orderId);
    if (pending && pending.driverId === driverId) {
      this.pendingOffers.delete(orderId);
      
      let rejections = this.orderRejections.get(orderId) || [];
      rejections.push(driverId);
      this.orderRejections.set(orderId, rejections);
      
      const order = this.activeOrders.get(orderId);
      if (order) {
        await this.findAndOfferToDriver(io, order, rejections);
      }
    }
    
    return { success: true };
  }

  async updateOrderStatus(io, orderId, status, driverLocation = null) {
    const order = this.activeOrders.get(orderId);
    if (order) {
      order.status = status;
      this.activeOrders.set(orderId, order);
    }
    
    io.of('/customers').to(`order:${orderId}`).emit('order:status', {
      orderId,
      status,
      driverLocation,
      timestamp: Date.now()
    });
    
    try {
      const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000';
      await axios.patch(`${djangoUrl}/api/orders/order/${orderId}/status/`, {
        status
      });
    } catch (err) {
      console.error('Failed to update Django order status:', err.message);
    }
    
    if (status === 'delivered') {
      io.of('/customers').to(`order:${orderId}`).emit('order:completed', {
        orderId,
        requestRating: true
      });
      
      setTimeout(() => {
        this.activeOrders.delete(orderId);
        this.orderRejections.delete(orderId);
      }, 300000);
    }
  }

  async calculateETA(orderId) {
    const order = this.activeOrders.get(orderId);
    if (!order || !order.driverId) {
      return { eta: null, message: 'No driver assigned' };
    }
    
    const avgSpeedKmH = 30;
    
    let distance;
    if (order.status === 'picked_up' || order.status === 'out_for_delivery') {
      distance = this.calculateDistance(
        order.driverLat || order.restaurantLat,
        order.driverLng || order.restaurantLng,
        order.dropoffLat,
        order.dropoffLng
      );
    } else {
      const toRestaurant = this.calculateDistance(
        order.driverLat || 0,
        order.driverLng || 0,
        order.restaurantLat,
        order.restaurantLng
      );
      const toDropoff = this.calculateDistance(
        order.restaurantLat,
        order.restaurantLng,
        order.dropoffLat,
        order.dropoffLng
      );
      distance = toRestaurant + toDropoff;
    }
    
    const etaMinutes = Math.ceil((distance / avgSpeedKmH) * 60) + 5;
    
    return {
      eta: etaMinutes,
      distance: distance.toFixed(2),
      unit: 'minutes'
    };
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  getOrder(orderId) {
    return this.activeOrders.get(orderId);
  }
}

module.exports = OrderService;
