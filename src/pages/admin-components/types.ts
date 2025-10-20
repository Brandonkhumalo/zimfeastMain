export interface RestaurantApplication {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  cuisineType: string;
  address: string;
  city: string;
  phone: string;
  deliveryFee: number;
  description?: string;
  menuImages?: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalComments?: string;
  createdAt?: string;
}

export interface DriverApplication {
  id: string;
  userName: string;
  userEmail: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalComments?: string;
  createdAt?: string;
}
