import { Timestamp } from 'firebase/firestore';

export type UserRole = 'rider' | 'driver' | 'admin';
export type AccountStatus = 'approved' | 'pending_verification' | 'suspended';
export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type PaymentMethod = 'cash' | 'upi';
export type PaymentStatus = 'pending' | 'paid';
export type ViewMode = 'rider' | 'driver' | 'admin';
export type Lang = 'en' | 'mr';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  accountStatus: AccountStatus;
  vehicleNumber: string;
  licenseNumber: string;
  isOnline: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FareSettings {
  baseFare: number;
  perKmRate: number;
  minFare: number;
  outerAreaSurcharge: number;
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface Ride {
  rideId: string;
  riderId: string;
  riderName: string;
  driverId: string;
  driverName: string;
  driverVehicleNumber: string;
  pickupLandmarkId: string;
  pickupLandmarkName: string;
  pickupCustomAddress: string;
  dropoffLandmarkId: string;
  dropoffLandmarkName: string;
  dropoffCustomAddress: string;
  distanceKm: number;
  fareInr: number;
  baseFareUsed: number;
  perKmUsed: number;
  locationSurchargeUsed: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: RideStatus;
  submittedPin: string;
  cancelledBy: '' | 'rider' | 'driver' | 'admin';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RideOtp {
  pin: string;
  riderId: string;
  createdAt: Timestamp;
}

export interface RideContact {
  phone: string;
  ownerId: string;
  createdAt: Timestamp;
}
