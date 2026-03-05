const { v4: uuidv4 } = require('uuid');

class DriverService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.drivers = new Map();
    this.driverSockets = new Map();
    // Rate limiting: track last location update per driver
    this._lastLocationEmit = new Map();
    this.LOCATION_RATE_LIMIT_MS = 3000; // Min 3s between location broadcasts
  }

  async registerDriver(driverId, socketId, driverData) {
    const driver = {
      id: driverId,
      socketId,
      name: driverData.name || 'Driver',
      phone: driverData.phone || '',
      vehicle: driverData.vehicle || 'Car',
      lat: driverData.lat || 0,
      lng: driverData.lng || 0,
      status: 'available',
      currentOrderId: null,
      lastLocationUpdate: Date.now(),
      rating: driverData.rating || 5.0,
      totalDeliveries: driverData.totalDeliveries || 0
    };

    this.drivers.set(driverId, driver);
    this.driverSockets.set(socketId, driverId);

    if (this.redis && this.redis.isOpen) {
      try {
        await this.redis.hSet(`driver:${driverId}`, {
          ...driver,
          lastLocationUpdate: driver.lastLocationUpdate.toString()
        });
        await this.redis.sAdd('drivers:online', driverId);
        // Store in Redis GEO index for spatial queries
        if (driver.lat && driver.lng) {
          await this.redis.geoAdd('drivers:locations', {
            longitude: driver.lng,
            latitude: driver.lat,
            member: driverId
          });
        }
      } catch (err) {
        console.error(`Redis error registering driver ${driverId}:`, err.message);
      }
    }

    console.log(`Driver ${driverId} registered and online`);
    return driver;
  }

  async updateLocation(driverId, lat, lng) {
    const driver = this.drivers.get(driverId);
    if (driver) {
      driver.lat = lat;
      driver.lng = lng;
      driver.lastLocationUpdate = Date.now();
      this.drivers.set(driverId, driver);

      if (this.redis && this.redis.isOpen) {
        try {
          await this.redis.hSet(`driver:${driverId}`, {
            lat: lat.toString(),
            lng: lng.toString(),
            lastLocationUpdate: driver.lastLocationUpdate.toString()
          });
          // Update Redis GEO index
          await this.redis.geoAdd('drivers:locations', {
            longitude: lng,
            latitude: lat,
            member: driverId
          });
        } catch (err) {
          console.error(`Redis error updating driver ${driverId} location:`, err.message);
        }
      }
    }
    return driver;
  }

  /**
   * Rate-limits location broadcasts to customers.
   * Returns true if the broadcast should proceed.
   */
  shouldBroadcastLocation(driverId) {
    const now = Date.now();
    const last = this._lastLocationEmit.get(driverId) || 0;
    if (now - last < this.LOCATION_RATE_LIMIT_MS) {
      return false;
    }
    this._lastLocationEmit.set(driverId, now);
    return true;
  }

  async setDriverStatus(driverId, status, orderId = null) {
    const driver = this.drivers.get(driverId);
    if (driver) {
      driver.status = status;
      driver.currentOrderId = orderId;
      this.drivers.set(driverId, driver);

      if (this.redis && this.redis.isOpen) {
        try {
          await this.redis.hSet(`driver:${driverId}`, {
            status,
            currentOrderId: orderId || ''
          });
        } catch (err) {
          console.error(`Redis error setting driver ${driverId} status:`, err.message);
        }
      }
    }
    return driver;
  }

  async removeDriver(socketId) {
    const driverId = this.driverSockets.get(socketId);
    if (driverId) {
      this.drivers.delete(driverId);
      this.driverSockets.delete(socketId);
      this._lastLocationEmit.delete(driverId);

      if (this.redis && this.redis.isOpen) {
        try {
          await this.redis.sRem('drivers:online', driverId);
          await this.redis.del(`driver:${driverId}`);
          await this.redis.zRem('drivers:locations', driverId);
        } catch (err) {
          console.error(`Redis error removing driver ${driverId}:`, err.message);
        }
      }

      console.log(`Driver ${driverId} went offline`);
    }
    return driverId;
  }

  async getOnlineDrivers() {
    return Array.from(this.drivers.values()).filter(d => d.status === 'available');
  }

  /**
   * Find nearest available drivers using Redis GEO (O(log(N)) vs O(N) full scan).
   * Falls back to in-memory Haversine if Redis is unavailable.
   */
  async findNearestAvailableDrivers(lat, lng, excludeDriverIds = [], limit = 5) {
    // Try Redis GEO first (much faster for large driver counts)
    if (this.redis && this.redis.isOpen) {
      try {
        const nearbyMembers = await this.redis.geoSearchWith(
          'drivers:locations',
          { longitude: lng, latitude: lat },
          { radius: 50, unit: 'km' },
          ['WITHDIST', 'WITHCOORD'],
          { SORT: 'ASC', COUNT: limit + excludeDriverIds.length }
        );

        const results = [];
        for (const member of nearbyMembers) {
          const driverId = member.member;
          if (excludeDriverIds.includes(driverId)) continue;

          const driver = this.drivers.get(driverId);
          if (driver && driver.status === 'available') {
            results.push({
              ...driver,
              distance: parseFloat(member.distance)
            });
            if (results.length >= limit) break;
          }
        }

        if (results.length > 0) return results;
      } catch (err) {
        console.error('Redis GEO search error, falling back to in-memory:', err.message);
      }
    }

    // Fallback: in-memory Haversine
    const availableDrivers = Array.from(this.drivers.values())
      .filter(d => d.status === 'available' && !excludeDriverIds.includes(d.id));

    const driversWithDistance = availableDrivers.map(driver => ({
      ...driver,
      distance: this.calculateDistance(lat, lng, driver.lat, driver.lng)
    }));

    driversWithDistance.sort((a, b) => a.distance - b.distance);

    return driversWithDistance.slice(0, limit);
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

  getDriverBySocketId(socketId) {
    const driverId = this.driverSockets.get(socketId);
    return driverId ? this.drivers.get(driverId) : null;
  }

  getDriverById(driverId) {
    return this.drivers.get(driverId);
  }

  getDriverSocketId(driverId) {
    const driver = this.drivers.get(driverId);
    return driver ? driver.socketId : null;
  }
}

module.exports = DriverService;
