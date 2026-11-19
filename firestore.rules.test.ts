/**
 * Verification specification for AusaAuto Firestore Security Rules.
 * Maps each of the 12 adversarial payloads in security_spec.md to the
 * exact rule gate that rejects it with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expected: 'PERMISSION_DENIED';
  enforcingGate: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Self-Promotion to Admin on Sign-Up',
    operation: 'create',
    path: '/users/attackerUid',
    expected: 'PERMISSION_DENIED',
    enforcingGate: "isAdmin() || (incoming().role in ['rider', 'driver'])",
  },
  {
    id: 'DD-02',
    name: 'Driver Self-Approval on Sign-Up',
    operation: 'create',
    path: '/users/driverUid',
    expected: 'PERMISSION_DENIED',
    enforcingGate: "incoming().role == 'driver' -> incoming().accountStatus == 'pending_verification' && incoming().isOnline == false",
  },
  {
    id: 'DD-03',
    name: 'Shadow Field Injection on User Profile',
    operation: 'create',
    path: '/users/riderUid',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'isValidUser(incoming()) keys().hasOnly(...)',
  },
  {
    id: 'DD-04',
    name: 'Unverified Email Spoofing Admin Access',
    operation: 'list',
    path: '/users',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'isAdmin() requires request.auth.token.email_verified == true',
  },
  {
    id: 'DD-05',
    name: 'Cross-User PII Scraping',
    operation: 'get',
    path: '/users/victimUid',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'isOwner(userId) || isAdmin()',
  },
  {
    id: 'DD-06',
    name: 'Premature Contact Snooping on Requested Ride',
    operation: 'get',
    path: '/rides/ride1/contacts/rider',
    expected: 'PERMISSION_DENIED',
    enforcingGate: "ride.status in ['accepted', 'arrived', 'in_progress']",
  },
  {
    id: 'DD-07',
    name: 'Post-Completion Contact Scraping',
    operation: 'get',
    path: '/rides/ride1/contacts/rider',
    expected: 'PERMISSION_DENIED',
    enforcingGate: "ride.status in ['accepted', 'arrived', 'in_progress']",
  },
  {
    id: 'DD-08',
    name: 'Driver Reading Ride Start OTP',
    operation: 'get',
    path: '/rides/ride1/private/otp',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'ride.riderId == request.auth.uid || isAdmin()',
  },
  {
    id: 'DD-09',
    name: 'Wrong OTP Trip Start',
    operation: 'update',
    path: '/rides/ride1',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'incoming().submittedPin == get(/databases/$(database)/documents/rides/$(rideId)/private/otp).data.pin',
  },
  {
    id: 'DD-10',
    name: 'Fare Tampering on Create or Update',
    operation: 'create',
    path: '/rides/ride1',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'isValidFareCalculation(incoming()) && immutable fareInr on update',
  },
  {
    id: 'DD-11',
    name: 'State Shortcutting requested -> completed',
    operation: 'update',
    path: '/rides/ride1',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'Strict status transition branches per action',
  },
  {
    id: 'DD-12',
    name: 'Pending Driver Accepting Ride',
    operation: 'update',
    path: '/rides/ride1',
    expected: 'PERMISSION_DENIED',
    enforcingGate: 'isApprovedDriver()',
  },
];
