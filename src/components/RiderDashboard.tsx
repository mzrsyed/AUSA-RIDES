import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowUpDown,
  Banknote,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  History,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';
import {
  AUSA_LANDMARKS,
  AusaLandmark,
  calculateAusaDistanceKm,
  calculateAusaFare,
  DEFAULT_FARE_SETTINGS,
  LANDMARK_BY_ID,
} from '../data/ausaLandmarks';
import { useT } from '../i18n/translations';
import { db, handleFirestoreError, OperationType, reportFirestoreError } from '../lib/firebase';
import { FareSettings, Lang, PaymentMethod, Ride, UserProfile } from '../types';
import { generateFourDigitPin, generateSafeId, sanitizeText } from '../utils/sanitize';
import { AusaMap } from './AusaMap';
import { downloadRideReceipt, ReceiptModal, UpiQrPanel } from './ReceiptModal';

interface RiderDashboardProps {
  profile: UserProfile;
  lang: Lang;
  isAdminPreview?: boolean;
}

type RiderTab = 'book' | 'active' | 'history';

export const RiderDashboard: React.FC<RiderDashboardProps> = ({
  profile,
  lang,
  isAdminPreview = false,
}) => {
  const t = useT(lang);
  const [tab, setTab] = useState<RiderTab>('book');

  const [pickupId, setPickupId] = useState<string>('st_bus_stand');
  const [dropoffId, setDropoffId] = useState<string>('ausa_fort');
  const [pickupCustom, setPickupCustom] = useState<string>('');
  const [dropoffCustom, setDropoffCustom] = useState<string>('');
  const [pickupSearch, setPickupSearch] = useState<string>('');
  const [dropoffSearch, setDropoffSearch] = useState<string>('');
  const [activeSelector, setActiveSelector] = useState<'pickup' | 'dropoff'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [fareSettings, setFareSettings] = useState(DEFAULT_FARE_SETTINGS);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const [activePin, setActivePin] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [receiptRide, setReceiptRide] = useState<Ride | null>(null);

  // Listen to live fare settings
  useEffect(() => {
    const ref = doc(db, 'settings', 'fares');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as FareSettings;
          setFareSettings({
            baseFare: data.baseFare ?? DEFAULT_FARE_SETTINGS.baseFare,
            perKmRate: data.perKmRate ?? DEFAULT_FARE_SETTINGS.perKmRate,
            minFare: data.minFare ?? DEFAULT_FARE_SETTINGS.minFare,
            outerAreaSurcharge:
              data.outerAreaSurcharge ?? DEFAULT_FARE_SETTINGS.outerAreaSurcharge,
          });
        }
      },
      (err) => {
        reportFirestoreError(err, OperationType.GET, 'settings/fares');
      }
    );
    return unsub;
  }, []);

  // Listen to Rider's rides
  useEffect(() => {
    const q = query(collection(db, 'rides'), where('riderId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Ride);
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setRides(list);
        setLoadingRides(false);
      },
      (err) => {
        setLoadingRides(false);
        handleFirestoreError(err, OperationType.LIST, 'rides');
      }
    );
    return unsub;
  }, [profile.uid]);

  const activeRide = useMemo(
    () =>
      rides.find((r) =>
        ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
      ) || null,
    [rides]
  );

  const pastRides = useMemo(
    () => rides.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
    [rides]
  );

  // Auto-switch to Active Trip tab if an active ride exists on initial load
  useEffect(() => {
    if (activeRide && tab === 'book') {
      setTab('active');
    }
  }, [activeRide?.rideId]);

  // Fetch confidential 4-digit PIN and ephemeral active-ride Driver phone
  useEffect(() => {
    let cancelled = false;

    async function loadSecrets() {
      if (!activeRide) {
        setActivePin('');
        setDriverPhone('');
        return;
      }

      try {
        const otpSnap = await getDoc(doc(db, 'rides', activeRide.rideId, 'private', 'otp'));
        if (!cancelled && otpSnap.exists()) {
          setActivePin(String(otpSnap.data().pin || ''));
        }
      } catch (err) {
        reportFirestoreError(err, OperationType.GET, `rides/${activeRide.rideId}/private/otp`);
      }

      if (['accepted', 'arrived', 'in_progress'].includes(activeRide.status)) {
        try {
          const phoneSnap = await getDoc(
            doc(db, 'rides', activeRide.rideId, 'contacts', 'driver')
          );
          if (!cancelled && phoneSnap.exists()) {
            setDriverPhone(String(phoneSnap.data().phone || ''));
          }
        } catch (err) {
          reportFirestoreError(
            err,
            OperationType.GET,
            `rides/${activeRide.rideId}/contacts/driver`
          );
        }
      } else {
        setDriverPhone('');
      }
    }

    void loadSecrets();
    return () => {
      cancelled = true;
    };
  }, [activeRide?.rideId, activeRide?.status]);

  const pickupLandmark = useMemo(
    () => LANDMARK_BY_ID.get(pickupId) || AUSA_LANDMARKS[0],
    [pickupId]
  );
  const dropoffLandmark = useMemo(
    () => LANDMARK_BY_ID.get(dropoffId) || AUSA_LANDMARKS[1],
    [dropoffId]
  );

  const filteredPickupLandmarks = useMemo(() => {
    const q = pickupSearch.trim().toLowerCase();
    if (!q) return AUSA_LANDMARKS;
    return AUSA_LANDMARKS.filter(
      (l) => l.nameEn.toLowerCase().includes(q) || l.nameMr.toLowerCase().includes(q)
    );
  }, [pickupSearch]);

  const filteredDropoffLandmarks = useMemo(() => {
    const q = dropoffSearch.trim().toLowerCase();
    if (!q) return AUSA_LANDMARKS;
    return AUSA_LANDMARKS.filter(
      (l) => l.nameEn.toLowerCase().includes(q) || l.nameMr.toLowerCase().includes(q)
    );
  }, [dropoffSearch]);

  const distanceKm = useMemo(
    () =>
      calculateAusaDistanceKm(
        pickupLandmark,
        dropoffLandmark,
        pickupCustom.trim().length > 0,
        dropoffCustom.trim().length > 0
      ),
    [pickupLandmark, dropoffLandmark, pickupCustom, dropoffCustom]
  );

  const fareBreakdown = useMemo(
    () => calculateAusaFare(pickupLandmark, dropoffLandmark, distanceKm, fareSettings),
    [pickupLandmark, dropoffLandmark, distanceKm, fareSettings]
  );

  const handleSwap = () => {
    setPickupId(dropoffId);
    setDropoffId(pickupId);
    setPickupCustom(dropoffCustom);
    setDropoffCustom(pickupCustom);
  };

  const isSuspended = !isAdminPreview && profile.accountStatus === 'suspended';

  const handleBookRide = async () => {
    setBookingError('');
    if (isSuspended) {
      setBookingError(t.riderSuspendedDesc);
      return;
    }
    const cleanPickupCustom = sanitizeText(pickupCustom, 140);
    const cleanDropoffCustom = sanitizeText(dropoffCustom, 140);

    if (
      pickupLandmark.id === dropoffLandmark.id &&
      !cleanPickupCustom &&
      !cleanDropoffCustom
    ) {
      setBookingError(t.sameLocationError);
      return;
    }

    const rideId = generateSafeId('ride');
    const pin = generateFourDigitPin();

    setBookingBusy(true);
    try {
      const batch = writeBatch(db);
      const rideRef = doc(db, 'rides', rideId);
      const otpRef = doc(db, 'rides', rideId, 'private', 'otp');
      const contactRef = doc(db, 'rides', rideId, 'contacts', 'rider');

      batch.set(rideRef, {
        rideId,
        riderId: profile.uid,
        riderName: sanitizeText(profile.fullName, 80),
        driverId: '',
        driverName: '',
        driverVehicleNumber: '',
        pickupLandmarkId: pickupLandmark.id,
        pickupLandmarkName: pickupLandmark.nameEn,
        pickupCustomAddress: cleanPickupCustom,
        dropoffLandmarkId: dropoffLandmark.id,
        dropoffLandmarkName: dropoffLandmark.nameEn,
        dropoffCustomAddress: cleanDropoffCustom,
        distanceKm,
        fareInr: fareBreakdown.fareInr,
        baseFareUsed: fareBreakdown.baseFareUsed,
        perKmUsed: fareBreakdown.perKmUsed,
        locationSurchargeUsed: fareBreakdown.locationSurchargeUsed,
        paymentMethod,
        paymentStatus: 'pending',
        status: 'requested',
        submittedPin: '',
        cancelledBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(otpRef, {
        pin,
        riderId: profile.uid,
        createdAt: serverTimestamp(),
      });

      batch.set(contactRef, {
        phone: profile.phone,
        ownerId: profile.uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setActivePin(pin);
      setPickupCustom('');
      setDropoffCustom('');
      setTab('active');
    } catch (err) {
      reportFirestoreError(err, OperationType.WRITE, `rides/${rideId}`);
      setBookingError(t.rideActionError);
    } finally {
      setBookingBusy(false);
    }
  };

  const handleCancelRide = async (ride: Ride) => {
    setBookingError('');
    try {
      await updateDoc(doc(db, 'rides', ride.rideId), {
        status: 'cancelled',
        cancelledBy: 'rider',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      reportFirestoreError(err, OperationType.UPDATE, `rides/${ride.rideId}`);
      setBookingError(t.rideActionError);
    }
  };

  const handleMapSelect = (lm: AusaLandmark) => {
    if (activeSelector === 'pickup') {
      setPickupId(lm.id);
    } else {
      setDropoffId(lm.id);
    }
  };

  const steps: Array<{ key: Ride['status']; label: string }> = [
    { key: 'requested', label: t.status.requested },
    { key: 'accepted', label: t.status.accepted },
    { key: 'arrived', label: t.status.arrived },
    { key: 'in_progress', label: t.status.in_progress },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10">
      {/* Desktop/Tablet Navigation Tabs */}
      <div className="hidden sm:flex items-center gap-2 mb-6 p-1 bg-zinc-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('book')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'book'
              ? 'bg-zinc-950 text-yellow-400'
              : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>{t.tabBook}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'active'
              ? 'bg-zinc-950 text-yellow-400'
              : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>
            {t.tabActiveTrip}
            {activeRide ? ' (1)' : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
            tab === 'history'
              ? 'bg-zinc-950 text-yellow-400'
              : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t.tabHistory}</span>
        </button>
      </div>

      {/* Suspended Account Notice */}
      {isSuspended && (
        <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900">
          <p className="text-sm font-bold">{t.riderSuspendedTitle}</p>
          <p className="text-xs mt-1">{t.riderSuspendedDesc}</p>
        </div>
      )}

      {/* BOOK TAB */}
      {tab === 'book' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Landmark Selectors */}
          <div className="lg:col-span-7 space-y-5">
            {isAdminPreview && activeRide && (
              <div className="p-3.5 rounded-2xl bg-yellow-100 border border-yellow-300 text-xs text-zinc-950 font-medium">
                Active test booking in progress ({activeRide.rideId.slice(-6)}). You can track or complete it in Active Trip or Driver View.
              </div>
            )}

            {/* Pickup Selector */}
            <div
              onClick={() => setActiveSelector('pickup')}
              className={`bg-white rounded-2xl border p-5 transition-colors ${
                activeSelector === 'pickup' ? 'border-zinc-950' : 'border-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-yellow-600" />
                  <span>{t.pickupTitle}</span>
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwap();
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-stone-100 flex items-center gap-1.5"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{t.swapRoute}</span>
                </button>
              </div>

              <div className="relative mb-3">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={pickupSearch}
                  onChange={(e) => setPickupSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                />
              </div>

              {/* Quick-tap Ausa landmark buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {filteredPickupLandmarks.map((lm) => {
                  const selected = lm.id === pickupId;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => setPickupId(lm.id)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                        selected
                          ? 'bg-zinc-950 text-yellow-400'
                          : 'bg-stone-100 text-zinc-800 hover:bg-stone-200'
                      }`}
                    >
                      {lang === 'mr' ? lm.nameMr : lm.nameEn}
                    </button>
                  );
                })}
              </div>

              {/* Accessible dropdown */}
              <select
                aria-label={t.pickupTitle}
                value={pickupId}
                onChange={(e) => setPickupId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-950 mb-3"
              >
                {AUSA_LANDMARKS.map((lm) => (
                  <option key={lm.id} value={lm.id}>
                    {lang === 'mr' ? lm.nameMr : lm.nameEn} · {lang === 'mr' ? lm.tagMr : lm.tagEn}
                  </option>
                ))}
              </select>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  {t.customStreetLabel}
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={pickupCustom}
                  onChange={(e) => setPickupCustom(e.target.value)}
                  placeholder={t.customStreetPlaceholder}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                />
              </div>
            </div>

            {/* Dropoff Selector */}
            <div
              onClick={() => setActiveSelector('dropoff')}
              className={`bg-white rounded-2xl border p-5 transition-colors ${
                activeSelector === 'dropoff' ? 'border-zinc-950' : 'border-zinc-200'
              }`}
            >
              <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2 mb-3">
                <Navigation className="w-4 h-4 text-zinc-950" />
                <span>{t.dropoffTitle}</span>
              </h2>

              <div className="relative mb-3">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={dropoffSearch}
                  onChange={(e) => setDropoffSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {filteredDropoffLandmarks.map((lm) => {
                  const selected = lm.id === dropoffId;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => setDropoffId(lm.id)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                        selected
                          ? 'bg-yellow-400 text-zinc-950'
                          : 'bg-stone-100 text-zinc-800 hover:bg-stone-200'
                      }`}
                    >
                      {lang === 'mr' ? lm.nameMr : lm.nameEn}
                    </button>
                  );
                })}
              </div>

              <select
                aria-label={t.dropoffTitle}
                value={dropoffId}
                onChange={(e) => setDropoffId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-950 mb-3"
              >
                {AUSA_LANDMARKS.map((lm) => (
                  <option key={lm.id} value={lm.id}>
                    {lang === 'mr' ? lm.nameMr : lm.nameEn} · {lang === 'mr' ? lm.tagMr : lm.tagEn}
                  </option>
                ))}
              </select>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  {t.customStreetLabel}
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={dropoffCustom}
                  onChange={(e) => setDropoffCustom(e.target.value)}
                  placeholder={t.customStreetPlaceholder}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Ausa Map + Fare Estimate & Payment */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
            <AusaMap
              pickup={pickupLandmark}
              dropoff={dropoffLandmark}
              lang={lang}
              distanceKm={distanceKm}
              onSelectLandmark={handleMapSelect}
            />

            <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
              <h3 className="text-base font-bold text-zinc-950">{t.fareSummaryTitle}</h3>

              <div className="space-y-2 text-sm border-b border-zinc-200 pb-3">
                <div className="flex justify-between">
                  <span className="text-zinc-600">{t.distanceLabel}</span>
                  <span className="font-mono font-semibold text-zinc-950 tabular-nums">
                    {distanceKm.toFixed(1)} km
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">{t.baseFareLabel}</span>
                  <span className="font-mono text-zinc-950 tabular-nums">
                    ₹{fareBreakdown.baseFareUsed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">
                    {t.distanceChargeLabel} (₹{fareBreakdown.perKmUsed}/km)
                  </span>
                  <span className="font-mono text-zinc-950 tabular-nums">
                    ₹{Math.round(distanceKm * fareBreakdown.perKmUsed)}
                  </span>
                </div>
                {fareBreakdown.locationSurchargeUsed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">{t.outerSurchargeLabel}</span>
                    <span className="font-mono text-zinc-950 tabular-nums">
                      ₹{fareBreakdown.locationSurchargeUsed}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-zinc-950">{t.totalFareLabel}</span>
                <span className="text-2xl font-mono font-bold text-zinc-950 tabular-nums">
                  ₹{fareBreakdown.fareInr}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-zinc-700 mb-2">{t.paymentMethodLabel}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`min-h-[46px] px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                      paymentMethod === 'cash'
                        ? 'bg-zinc-950 text-yellow-400 border-zinc-950'
                        : 'bg-stone-50 text-zinc-800 border-zinc-200 hover:bg-stone-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>{t.payCash}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`min-h-[46px] px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                      paymentMethod === 'upi'
                        ? 'bg-zinc-950 text-yellow-400 border-zinc-950'
                        : 'bg-stone-50 text-zinc-800 border-zinc-200 hover:bg-stone-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>{t.payUpi}</span>
                  </button>
                </div>
              </div>

              {bookingError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {bookingError}
                </div>
              )}

              <button
                type="button"
                disabled={bookingBusy || Boolean(activeRide) || isSuspended}
                onClick={handleBookRide}
                className="w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Car className="w-5 h-5" />
                <span>{bookingBusy ? t.bookingInProgress : t.btnBookAuto}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE TRIP TAB */}
      {tab === 'active' && (
        <div className="max-w-3xl mx-auto">
          {!activeRide ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-8 text-center">
              <Car className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-zinc-950">{t.noActiveTripTitle}</h2>
              <p className="text-sm text-zinc-600 mt-1 mb-5">{t.noActiveTripDesc}</p>
              <button
                type="button"
                onClick={() => setTab('book')}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-zinc-950 text-yellow-400 font-bold text-sm hover:bg-zinc-800 transition-colors"
              >
                {t.goToBook}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status Stepper */}
              <div className="bg-zinc-950 text-white rounded-3xl p-6 border border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <p className="text-xs text-yellow-400 font-semibold">
                      {t.status[activeRide.status]}
                    </p>
                    <h2 className="text-xl font-bold mt-0.5">
                      {activeRide.pickupLandmarkName} → {activeRide.dropoffLandmarkName}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      {activeRide.distanceKm.toFixed(1)} km · ₹{activeRide.fareInr} ·{' '}
                      {activeRide.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-zinc-400">
                      {activeRide.rideId.slice(-8).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="grid grid-cols-4 gap-2">
                  {steps.map((s, idx) => {
                    const currentIdx = steps.findIndex((st) => st.key === activeRide.status);
                    const done = idx <= currentIdx;
                    return (
                      <div key={s.key} className="space-y-1.5">
                        <div
                          className={`h-2 rounded-full ${
                            done ? 'bg-yellow-400' : 'bg-zinc-800'
                          }`}
                        />
                        <p
                          className={`text-[11px] font-medium truncate ${
                            done ? 'text-yellow-400' : 'text-zinc-500'
                          }`}
                        >
                          {s.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4-Digit Ride Start PIN */}
              <div className="bg-yellow-400 text-zinc-950 rounded-3xl p-6 border border-yellow-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5" />
                    <span>{t.ridePinLabel}</span>
                  </div>
                  <p className="text-xs text-zinc-900 mt-1">{t.ridePinHint}</p>
                </div>
                <div className="bg-zinc-950 text-yellow-400 px-6 py-3 rounded-2xl text-center shrink-0">
                  <span className="font-mono text-3xl font-bold tracking-[0.25em] tabular-nums">
                    {activePin || '••••'}
                  </span>
                </div>
              </div>

              {/* Driver & Active-Ride-Only Contact Card */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-4">
                {activeRide.status === 'requested' ? (
                  <div className="flex items-center gap-3 text-zinc-700">
                    <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
                    <p className="text-sm font-medium">{t.searchingDriver}</p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">{t.assignedDriverLabel}</p>
                      <p className="text-lg font-bold text-zinc-950 mt-0.5">
                        {activeRide.driverName}
                      </p>
                      <p className="font-mono text-sm font-bold text-zinc-950 bg-yellow-300 inline-block px-2.5 py-0.5 rounded-md mt-1.5">
                        {activeRide.driverVehicleNumber}
                      </p>
                    </div>

                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone}`}
                        className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-950 text-yellow-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shrink-0"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{t.callDriver}</span>
                      </a>
                    )}
                  </div>
                )}

                {activeRide.status !== 'requested' && (
                  <p className="text-xs text-zinc-500">{t.privacyNoticeActive}</p>
                )}

                {activeRide.paymentMethod === 'upi' && (
                  <UpiQrPanel
                    amount={activeRide.fareInr}
                    rideId={activeRide.rideId}
                    driverName={activeRide.driverName}
                    lang={lang}
                  />
                )}

                {['requested', 'accepted', 'arrived'].includes(activeRide.status) && (
                  <div className="pt-2 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => handleCancelRide(activeRide)}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-red-300 text-red-700 font-semibold text-xs hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t.cancelRide}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-zinc-950 mb-4">{t.historyTitle}</h2>
          {loadingRides ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-sm text-zinc-600">
              Loading Ausa ride history...
            </div>
          ) : pastRides.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-sm text-zinc-600">
              {t.noHistory}
            </div>
          ) : (
            <div className="space-y-3">
              {pastRides.map((ride) => {
                const dateLabel = ride.updatedAt?.toDate
                  ? ride.updatedAt.toDate().toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—';

                return (
                  <div
                    key={ride.rideId}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-900">
                          {t.status[ride.status]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{dateLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{ride.paymentMethod}</span>
                      </div>
                      <p className="text-base font-bold text-zinc-950 truncate">
                        {ride.pickupLandmarkName} → {ride.dropoffLandmarkName}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {ride.driverName
                          ? `${ride.driverName} (${ride.driverVehicleNumber})`
                          : 'No driver assigned'}{' '}
                        · {ride.distanceKm.toFixed(1)} km
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-lg font-mono font-bold text-zinc-950 tabular-nums">
                        ₹{ride.fareInr}
                      </span>
                      {ride.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptRide(ride)}
                            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-900 hover:bg-stone-100 flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{t.viewReceipt}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadRideReceipt(ride)}
                            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-950 text-yellow-400 text-xs font-semibold hover:bg-zinc-800 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t.downloadReceipt}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Rider navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 grid grid-cols-3 h-16 pb-safe"
      >
        <button
          type="button"
          onClick={() => setTab('book')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'book' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Car className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">{t.tabBook}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'active' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Navigation className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">
            {t.tabActiveTrip}
            {activeRide ? ' (1)' : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'history' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">{t.tabHistory}</span>
        </button>
      </nav>

      <ReceiptModal ride={receiptRide} lang={lang} onClose={() => setReceiptRide(null)} />
    </div>
  );
};
