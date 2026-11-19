# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **User Identity & Role Integrity**: A user document at `/users/{userId}` can only be created by `request.auth.uid == userId` with `email_verified == true`. Non-admin users cannot self-assign `role: "admin"` or `accountStatus: "approved"` when `role == "driver"`. Drivers must start as `accountStatus: "pending_verification"` and `isOnline: false`.
2. **PII Isolation**: `/users/{userId}` is readable only by its owner (`userId == request.auth.uid`) or Super Admin (`mzrsyed@gmail.com`). Phone numbers are never stored on `/rides/{rideId}`.
3. **Ephemeral Active-Ride Contact Access**: `/rides/{rideId}/contacts/{contactRole}` is readable ONLY when the parent ride status is `accepted`, `arrived`, or `in_progress`, and ONLY by the assigned `riderId`, assigned `driverId`, or Admin. Once `completed` or `cancelled`, phone visibility is revoked by Firestore Rules.
4. **Ride OTP Confidentiality**: `/rides/{rideId}/private/otp` is readable only by the ride's `riderId` or Admin. Drivers cannot read the OTP and must enter the exact matching 4-digit `submittedPin` during the `arrived -> in_progress` transition.
5. **Fare & Distance Immutability**: Ride fare (`fareInr`) on creation must match the live `/settings/fares` formula (or baseline defaults if `/settings/fares` is not yet initialized) and cannot be altered after creation.
6. **Strict State Machine & Terminal Locking**: Ride transitions are strictly restricted (`requested -> accepted -> arrived -> in_progress -> completed`, or `requested/accepted/arrived -> cancelled`). Once `completed` or `cancelled`, non-admin updates are permanently rejected.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Promotion to Admin on Sign-Up**: Standard user creates `/users/u1` with `role: "admin"`. -> `PERMISSION_DENIED`.
2. **Driver Self-Approval on Sign-Up**: Driver creates `/users/d1` with `role: "driver", accountStatus: "approved"`. -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: Rider creates `/users/r1` with an extra ghost key `isSuperUser: true`. -> `PERMISSION_DENIED`.
4. **Email Spoofing Admin Access**: User with `email: "mzrsyed@gmail.com"` and `email_verified: false` tries to read `/users` or update `/settings/fares`. -> `PERMISSION_DENIED`.
5. **Cross-User PII Scraping**: Authenticated Rider `r1` tries `get(/users/r2)` or `list(/users)`. -> `PERMISSION_DENIED`.
6. **Premature Contact Snooping**: Unassigned Driver `d1` tries `get(/rides/ride1/contacts/rider)` while ride is `requested`. -> `PERMISSION_DENIED`.
7. **Post-Completion Contact Scraping**: Driver `d1` tries `get(/rides/ride1/contacts/rider)` after ride becomes `completed` or `cancelled`. -> `PERMISSION_DENIED`.
8. **Driver Reading Ride OTP**: Assigned Driver `d1` tries `get(/rides/ride1/private/otp)`. -> `PERMISSION_DENIED`.
9. **Wrong OTP Trip Start**: Assigned Driver `d1` updates ride `arrived -> in_progress` with wrong `submittedPin: "0000"`. -> `PERMISSION_DENIED`.
10. **Price Tampering on Create or Update**: Rider creates ride with `fareInr: 1` for 5km trip, or Driver tries to inflate `fareInr` during trip. -> `PERMISSION_DENIED`.
11. **State Shortcutting**: Driver tries to jump `requested -> completed` without `accepted -> arrived -> in_progress`. -> `PERMISSION_DENIED`.
12. **Pending Driver Accepting Ride**: Driver with `accountStatus: "pending_verification"` attempts to accept a `requested` ride. -> `PERMISSION_DENIED`.
