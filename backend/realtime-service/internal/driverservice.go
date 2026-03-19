package internal

import (
	"context"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"zimfeast/shared/geo"
	"zimfeast/shared/redispub"
)

type DriverInfo struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Phone         string                 `json:"phone"`
	Vehicle       map[string]interface{} `json:"vehicle"`
	Lat           float64                `json:"lat"`
	Lng           float64                `json:"lng"`
	Status        string                 `json:"status"`
	SocketID      string                 `json:"socket_id"`
	OrderID       string                 `json:"current_order_id"`
	LastBroadcast time.Time              `json:"-"`
}

type DriverService struct {
	mu      sync.RWMutex
	drivers map[string]*DriverInfo
	sockets map[string]string
	pub     *redispub.Publisher
}

func NewDriverService(pub *redispub.Publisher) *DriverService {
	return &DriverService{
		drivers: make(map[string]*DriverInfo),
		sockets: make(map[string]string),
		pub:     pub,
	}
}

func (ds *DriverService) RegisterDriver(driverID, socketID, name, phone string, lat, lng float64, vehicle map[string]interface{}) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	ds.drivers[driverID] = &DriverInfo{
		ID:       driverID,
		Name:     name,
		Phone:    phone,
		Vehicle:  vehicle,
		Lat:      lat,
		Lng:      lng,
		Status:   "available",
		SocketID: socketID,
	}
	ds.sockets[socketID] = driverID

	ctx := context.Background()
	ds.pub.Client().GeoAdd(ctx, "drivers:locations", &redis.GeoLocation{
		Name:      driverID,
		Latitude:  lat,
		Longitude: lng,
	})
	ds.pub.Client().SAdd(ctx, "drivers:online", driverID)
	ds.pub.Client().HSet(ctx, "driver:"+driverID, map[string]interface{}{
		"name": name, "phone": phone, "status": "available",
		"lat": lat, "lng": lng, "socketId": socketID,
	})

	log.Printf("[driver] registered: %s (%s)", driverID, name)
}

func (ds *DriverService) UpdateLocation(driverID string, lat, lng float64) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	d, ok := ds.drivers[driverID]
	if !ok {
		return
	}
	d.Lat = lat
	d.Lng = lng

	ctx := context.Background()
	ds.pub.Client().GeoAdd(ctx, "drivers:locations", &redis.GeoLocation{
		Name:      driverID,
		Latitude:  lat,
		Longitude: lng,
	})
	ds.pub.Client().HSet(ctx, "driver:"+driverID, "lat", lat, "lng", lng)
}

func (ds *DriverService) ShouldBroadcastLocation(driverID string) bool {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	d, ok := ds.drivers[driverID]
	if !ok {
		return false
	}
	return time.Since(d.LastBroadcast) >= 3*time.Second
}

func (ds *DriverService) MarkBroadcast(driverID string) {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	if d, ok := ds.drivers[driverID]; ok {
		d.LastBroadcast = time.Now()
	}
}

func (ds *DriverService) SetDriverStatus(driverID, status string) {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	d, ok := ds.drivers[driverID]
	if !ok {
		return
	}
	d.Status = status
	ctx := context.Background()
	ds.pub.Client().HSet(ctx, "driver:"+driverID, "status", status)
	if status == "available" {
		ds.pub.Client().SAdd(ctx, "drivers:online", driverID)
	} else if status == "offline" {
		ds.pub.Client().SRem(ctx, "drivers:online", driverID)
	}
}

func (ds *DriverService) SetDriverOrder(driverID, orderID string) {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	if d, ok := ds.drivers[driverID]; ok {
		d.OrderID = orderID
		d.Status = "busy"
	}
}

func (ds *DriverService) ClearDriverOrder(driverID string) {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	if d, ok := ds.drivers[driverID]; ok {
		d.OrderID = ""
		d.Status = "available"
	}
}

func (ds *DriverService) GetDriver(driverID string) *DriverInfo {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	if d, ok := ds.drivers[driverID]; ok {
		cp := *d
		return &cp
	}
	return nil
}

func (ds *DriverService) GetDriverBySocket(socketID string) *DriverInfo {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	driverID, ok := ds.sockets[socketID]
	if !ok {
		return nil
	}
	if d, ok := ds.drivers[driverID]; ok {
		cp := *d
		return &cp
	}
	return nil
}

func (ds *DriverService) RemoveDriver(socketID string) {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	driverID, ok := ds.sockets[socketID]
	if !ok {
		return
	}
	delete(ds.sockets, socketID)
	delete(ds.drivers, driverID)
	ctx := context.Background()
	ds.pub.Client().SRem(ctx, "drivers:online", driverID)
	ds.pub.Client().ZRem(ctx, "drivers:locations", driverID)
	ds.pub.Client().Del(ctx, "driver:"+driverID)
	log.Printf("[driver] removed: %s", driverID)
}

func (ds *DriverService) GetOnlineDrivers() []*DriverInfo {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	var result []*DriverInfo
	for _, d := range ds.drivers {
		if d.Status == "available" {
			cp := *d
			result = append(result, &cp)
		}
	}
	return result
}

func (ds *DriverService) FindNearestAvailableDrivers(lat, lng float64, limit int) []*DriverInfo {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	type dd struct {
		driver *DriverInfo
		dist   float64
	}
	var candidates []dd
	for _, d := range ds.drivers {
		if d.Status != "available" {
			continue
		}
		dist := geo.HaversineDistance(lat, lng, d.Lat, d.Lng)
		candidates = append(candidates, dd{driver: d, dist: dist})
	}
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].dist < candidates[j].dist
	})
	var result []*DriverInfo
	for i, c := range candidates {
		if i >= limit {
			break
		}
		cp := *c.driver
		result = append(result, &cp)
	}
	return result
}
