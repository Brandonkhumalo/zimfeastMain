const axios = require('axios');

// Delivery rate: $0.35 per km
const DELIVERY_RATE_PER_KM = 0.35;
const MIN_DELIVERY_FEE = 1.50;
const OFFER_EXPIRY_SECONDS = 30;

class OrderService {
  constructor(redisClient, driverService) {
    this.redis = redisClient;
    this.driverService = driverService;
    this.activeOrders = new Map();
    this.orderRejections = new Map();
    // pendingOffers now backed by Redis for crash resilience
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

    remaining.forEach(r => {
      r._driverDist = calculateDistance(driverLat, driverLng, r.lat, r.lng);
    });
    remaining.sort((a, b) => a._driverDist - b._driverDist);

    const firstRestaurant = remaining[0];
    const middle = remaining.slice(1);

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
      try {
        await redisClient.hSet(`order:${order.id}`, {
          ...order,
          items: JSON.stringify(order.items),
          createdAt: order.createdAt.toString()
        });
      } catch (err) {
        console.error(`Redis error storing order ${order.id}:`, err.message);
      }
    }

    await orderService.findAndOfferToDriver(io, order, []);
  }

  /**
   * Atomically lock an offer in Redis using SETNX.
   * Returns true if the lock was acquired (no other driver has a pending offer).
   */
  async _lockOffer(orderId, driverId) {
    if (this.redis && this.redis.isOpen) {
      try {
        // SET NX with expiry - only succeeds if key doesn't exist
        const result = await this.redis.set(
          `offer:lock:${orderId}`,
          driverId,
          { NX: true, EX: OFFER_EXPIRY_SECONDS }
        );
        return result === 'OK';
      } catch (err) {
        console.error('Redis offer lock error:', err.message);
      }
    }
    // Fallback to in-memory
    if (this.pendingOffers.has(orderId)) return false;
    this.pendingOffers.set(orderId, { driverId, offeredAt: Date.now() });
    return true;
  }

  /**
   * Check and claim an offer atomically using a Lua script.
   * Returns true only if the offer belongs to this driver and was successfully claimed.
   */
  async _claimOffer(orderId, driverId) {
    if (this.redis && this.redis.isOpen) {
      try {
        // Lua script: check if the offer belongs to this driver, then delete it
        const luaScript = `
          local current = redis.call('GET', KEYS[1])
          if current == ARGV[1] then
            redis.call('DEL', KEYS[1])
            return 1
          end
          return 0
        `;
        const result = await this.redis.eval(luaScript, {
          keys: [`offer:lock:${orderId}`],
          arguments: [driverId]
        });
        return result === 1;
      } catch (err) {
        console.error('Redis offer claim error:', err.message);
      }
    }
    // Fallback to in-memory
    const pending = this.pendingOffers.get(orderId);
    if (pending && pending.driverId === driverId) {
      this.pendingOffers.delete(orderId);
      return true;
    }
    return false;
  }

  /**
   * Release an offer lock (on rejection or expiry).
   */
  async _releaseOffer(orderId) {
    if (this.redis && this.redis.isOpen) {
      try {
        await this.redis.del(`offer:lock:${orderId}`);
      } catch (err) {
        console.error('Redis offer release error:', err.message);
      }
    }
    this.pendingOffers.delete(orderId);
  }

  /**
   * Store pending offer expiry data in Redis so it survives server restarts.
   */
  async _persistOfferExpiry(orderId, driverId, excludeDriverIds) {
    if (this.redis && this.redis.isOpen) {
      try {
        await this.redis.set(
          `offer:expiry:${orderId}`,
          JSON.stringify({ driverId, excludeDriverIds }),
          { EX: OFFER_EXPIRY_SECONDS + 5 } // slightly longer than offer TTL
        );
      } catch (err) {
        console.error('Redis persist offer expiry error:', err.message);
      }
    }
  }

  async findAndOfferToDriver(io, order, excludeDriverIds = []) {
    const driverNamespace = io.of('/drivers');

    // Use Redis GEO via driverService if available, otherwise fall back to socket iteration
    let onlineDrivers = [];

    if (this.driverService) {
      onlineDrivers = await this.driverService.findNearestAvailableDrivers(
        order.restaurantLat, order.restaurantLng,
        excludeDriverIds, 5
      );
    } else {
      // Fallback: iterate sockets (original behavior)
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
    }

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

    // Atomically lock the offer in Redis (prevents double assignment)
    const locked = await this._lockOffer(order.id, nearestDriver.id);
    if (!locked) {
      console.log(`Order ${order.id} already has a pending offer, skipping`);
      return;
    }

    // Persist expiry data in Redis for crash resilience
    await this._persistOfferExpiry(order.id, nearestDriver.id, excludeDriverIds);

    // Calculate distances for the offer
    const driverToRestaurant = nearestDriver.distance;
    const restaurantToCustomer = this.calculateDistance(
      order.restaurantLat, order.restaurantLng,
      order.dropoffLat, order.dropoffLng
    );
    const totalDistance = driverToRestaurant + restaurantToCustomer;
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
      expiresIn: OFFER_EXPIRY_SECONDS
    };

    // Send offer to the driver's socket
    const driverSocketId = nearestDriver.socketId ||
      (this.driverService ? this.driverService.getDriverSocketId(nearestDriver.id) : null);

    if (driverSocketId) {
      driverNamespace.to(driverSocketId).emit('delivery:offer', offerData);
    }

    // Set timeout for offer expiry (Redis TTL handles crash resilience,
    // setTimeout handles the re-offer logic in this process)
    setTimeout(async () => {
      // Check if offer is still pending in Redis (hasn't been claimed)
      let stillPending = false;
      if (this.redis && this.redis.isOpen) {
        try {
          const current = await this.redis.get(`offer:lock:${order.id}`);
          stillPending = current === nearestDriver.id;
        } catch (err) {
          // Fallback
          const pending = this.pendingOffers.get(order.id);
          stillPending = pending && pending.driverId === nearestDriver.id;
        }
      } else {
        const pending = this.pendingOffers.get(order.id);
        stillPending = pending && pending.driverId === nearestDriver.id;
      }

      if (stillPending) {
        console.log(`Offer expired for driver ${nearestDriver.id}`);
        await this._releaseOffer(order.id);
        excludeDriverIds.push(nearestDriver.id);
        await this.findAndOfferToDriver(io, order, excludeDriverIds);
      }
    }, OFFER_EXPIRY_SECONDS * 1000);
  }

  async handleDriverAccept(io, driverId, orderId, driverData) {
    // Atomically claim the offer (Redis Lua script ensures only one driver succeeds)
    const claimed = await this._claimOffer(orderId, driverId);
    if (!claimed) {
      return { success: false, message: 'Offer expired or already taken' };
    }

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

    // Notify Django backend with retry
    const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await axios.post(`${djangoUrl}/api/orders/order/${orderId}/assign-driver/`, {
          driver_id: driverId,
          driver_name: driverData.name,
          driver_phone: driverData.phone,
          driver_vehicle: driverData.vehicle
        });
        break;
      } catch (err) {
        console.error(`Failed to notify Django (attempt ${attempt + 1}):`, err.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    return { success: true };
  }

  async handleDriverReject(io, driverId, orderId) {
    await this._releaseOffer(orderId);

    let rejections = this.orderRejections.get(orderId) || [];
    rejections.push(driverId);
    this.orderRejections.set(orderId, rejections);

    const order = this.activeOrders.get(orderId);
    if (order) {
      await this.findAndOfferToDriver(io, order, rejections);
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

    // Notify Django with retry
    const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await axios.patch(`${djangoUrl}/api/orders/order/${orderId}/status/`, {
          status
        });
        break;
      } catch (err) {
        console.error(`Failed to update Django order status (attempt ${attempt + 1}):`, err.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
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
