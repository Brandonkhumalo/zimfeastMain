require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('redis');
const DriverService = require('./services/DriverService');
const OrderService = require('./services/OrderService');
const setupDriverSocket = require('./sockets/drivers');
const setupCustomerSocket = require('./sockets/customers');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const redisSub = redisClient.duplicate();

async function initializeRedis() {
  try {
    await redisClient.connect();
    await redisSub.connect();
    console.log('Connected to Redis');
    
    await redisSub.subscribe('orders.delivery.created', async (message) => {
      const orderData = JSON.parse(message);
      console.log('New delivery order received:', orderData.orderId);
      await OrderService.handleNewDeliveryOrder(io, redisClient, orderData);
    });
    
    await redisSub.subscribe('orders.status.changed', async (message) => {
      const data = JSON.parse(message);
      console.log('Order status changed:', data);
      io.to(`order:${data.orderId}`).emit('order:status', data);
    });
    
  } catch (err) {
    console.error('Redis connection error:', err);
    console.log('Running without Redis - using in-memory storage');
  }
}

const driverService = new DriverService(redisClient);
const orderService = new OrderService(redisClient, driverService);

const driverNamespace = io.of('/drivers');
const customerNamespace = io.of('/customers');

setupDriverSocket(driverNamespace, driverService, orderService, redisClient);
setupCustomerSocket(customerNamespace, orderService, redisClient);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/drivers/online', async (req, res) => {
  try {
    const drivers = await driverService.getOnlineDrivers();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:orderId/eta', async (req, res) => {
  try {
    const eta = await orderService.calculateETA(req.params.orderId);
    res.json(eta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/new-delivery', async (req, res) => {
  try {
    const orderData = req.body;
    console.log('New delivery order via REST:', orderData.orderId);
    await OrderService.handleNewDeliveryOrder(io, redisClient, orderData);
    res.json({ status: 'processing', orderId: orderData.orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers/:driverId/location', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { lat, lng } = req.body;
    await driverService.updateLocation(driverId, lat, lng);
    res.json({ status: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.REALTIME_PORT || 3001;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Real-time server running on port ${PORT}`);
  await initializeRedis();
});

module.exports = { io, app };
