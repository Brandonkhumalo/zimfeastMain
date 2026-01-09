const axios = require('axios');

// Delivery rate: $0.35 per km
const DELIVERY_RATE_PER_KM = 0.35;
const MIN_DELIVERY_FEE = 1.50;

class OrderService {
  constructor(redisClient, driverService) {
    this.redis = redisClient;
    this.driverService = driverService;
    this.activeOrders = new Map();
    this.orderRejections = new Map();
    this.pendingOffers = new Map();
  }

  static optimizePickupOrder(restaurants, driverLat, driverLng, deliveryLat, deliveryLng) {
    if (!restaurants || restaurants.length <= 1) {
      return restaurants;
    }

    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Find restaurant closest to delivery (pickup last)
    const withDeliveryDist = restaurants.map(r => ({
      ...r,
      _deliveryDist: calculateDistance(r.lat, r.lng, deliveryLat, deliveryLng)
    }));
    withDeliveryDist.sort((a, b) => a._deliveryDist - b._deliveryDist);
    
    const lastRestaurant = withDeliveryDist[0];
    const remaining = withDeliveryDist.slice(1);

    if (remaining.length === 0) {
      delete lastRestaurant._deliveryDist;
      return [lastRestaurant];
    }

    // Find restaurant closest to driver (pickup first)
    remaining.forEach(r => {
      r._driverDist = calculateDistance(driverLat, driverLng, r.lat, r.lng);
    });
    remaining.sort((a, b) => a._driverDist - b._driverDist);
    
    const firstRestaurant = remaining[0];
    const middle = remaining.slice(1);

    // Nearest-neighbor for middle restaurants
    const ordered = [firstRestaurant];
    let current = firstRestaurant;
    
    while (middle.length > 0) {
      middle.forEach(r => {
        r._currentDist = calculateDistance(current.lat, current.lng, r.lat, r.lng);
      });
      middle.sort((a, b) => a._currentDist - b._currentDist);
      const next = middle.shift();
      ordered.push(next);
      current = next;
    }

    ordered.push(lastRestaurant);

    // Clean up temp properties
    ordered.forEach(r => {
      delete r._deliveryDist;
      delete r._driverDist;
      delete r._currentDist;
    });

    return ordered;
  }

  static calculateMultiRestaurantFee(restaurants, deliveryLat, deliveryLng) {
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    if (!restaurants || restaurants.length === 0) {
      return { totalFee: 0, totalDistance: 0 };
    }

    if (restaurants.length === 1) {
      const distance = calculateDistance(
        restaurants[0].lat, restaurants[0].lng,
        deliveryLat, deliveryLng
      );
      return {
        totalFee: Math.max(MIN_DELIVERY_FEE, distance * DELIVERY_RATE_PER_KM),
        totalDistance: distance
      };
    }

    let totalDistance = 0;
    for (let i = 0; i < restaurants.length - 1; i++) {
      totalDistance += calculateDistance(
        restaurants[i].lat, restaurants[i].lng,
        restaurants[i + 1].lat, restaurants[i + 1].lng
      );
    }

    const lastRestaurant = restaurants[restaurants.length - 1];
    totalDistance += calculateDistance(
      lastRestaurant.lat, lastRestaurant.lng,
      deliveryLat, deliveryLng
    );

    return {
      totalFee: Math.max(MIN_DELIVERY_FEE, totalDistance * DELIVERY_RATE_PER_KM),
      totalDistance
    };
  }

  static async handleNewDeliveryOrder(io, redisClient, orderData) {
    const orderService = new OrderService(redisClient, null);
    
    const order = {
      id: orderData.orderId,
      customerId: orderData.customerId,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone || '',
      restaurantId: orderData.restaurantId,
      restaurantName: orderData.restaurantName,
      restaurantAddress: orderData.restaurantAddress || '',
      restaurantLat: orderData.restaurantLat,
      restaurantLng: orderData.restaurantLng,
      dropoffLat: orderData.dropoffLat,
      dropoffLng: orderData.dropoffLng,
      dropoffAddress: orderData.dropoffAddress,
      items: orderData.items || [],
      total: orderData.total || 0,
      tip: orderData.tip || 0,
      distanceKm: orderData.distanceKm || 0,
      deliveryPrice: orderData.deliveryPrice || 0,
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
    
    // Calculate total delivery distance (driver to restaurant + restaurant to customer)
    const driverToRestaurant = nearestDriver.distance;
    const restaurantToCustomer = this.calculateDistance(
      order.restaurantLat, order.restaurantLng,
      order.dropoffLat, order.dropoffLng
    );
    const totalDistance = driverToRestaurant + restaurantToCustomer;
    
    // Calculate delivery price: $0.35 per km
    const deliveryPrice = order.deliveryPrice || (totalDistance * 0.35);
    
    const offerData = {
      orderId: order.id,
      restaurantName: order.restaurantName,
      restaurantAddress: order.restaurantAddress || '',
      restaurantLat: order.restaurantLat,
      restaurantLng: order.restaurantLng,
      customerName: order.customerName || 'Customer',
      customerPhone: order.customerPhone || '',
      dropoffAddress: order.dropoffAddress,
      dropoffLat: order.dropoffLat,
      dropoffLng: order.dropoffLng,
      distanceToRestaurant: driverToRestaurant.toFixed(2),
      distanceToCustomer: restaurantToCustomer.toFixed(2),
      totalDistance: totalDistance.toFixed(2),
      deliveryPrice: deliveryPrice.toFixed(2),
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
        driver_id: driverId,
        driver_name: driverData.name,
        driver_phone: driverData.phone,
        driver_vehicle: driverData.vehicle
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
