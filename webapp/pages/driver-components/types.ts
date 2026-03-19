export interface Order {
  id: string;
  status: string;
  driverId?: string;
  deliveryAddress: string;
  deliveryFee: number;
  customerName: string;
  customerPhone: string;
  createdAt?: string;
}

export interface Driver {
  id: string;
  firstName: string;
  rating?: number;
  isAvailable: boolean;
}
