import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Edit3,
  FileText,
  History,
  MapPin,
  Navigation,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AUSA_CENTER,
  AUSA_LANDMARKS,
  AusaLandmark,
  AusaPoint,
  calculateAusaDistanceKm,
  calculateAusaFare,
  computeOfflineDirections,
  DEFAULT_FARE_SETTINGS,
  findNearestAusaLandmark,
  isBustandModeRoute,
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

const QUICK_STOP_IDS = [
  'ausa_bustand',
  'ausa_mode',
  'ausa_fort',
  'tuljapur_mode',
  'new_bustand',
];

function matchLandmarks(queryText: string): AusaLandmark[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return AUSA_LANDMARKS;
  return AUSA_LANDMARKS.filter(
    (l) =>
      l.nameEn.toLowerCase().includes(q) ||
      l.nameMr.toLowerCase().includes(q) ||
      l.tagEn.toLowerCase().includes(q) ||
      l.tagMr.toLowerCase().includes(q)
  );
}

export const RiderDashboard: React.FC<RiderDashboardProps> = ({
  profile,
  lang,
  isAdminPreview = false,
}) => {
  const t = useT(lang);
  const [tab, setTab] = useState<RiderTab>('book');

  // Pickup state (either preset stop or custom location)
  const [pickupIsCustom, setPickupIsCustom] = useState<boolean>(false);
  const [pickupId, setPickupId] = useState<string>('ausa_bustand');
  const [customPickupName, setCustomPickupName] = useState<string>('');
  const [customPickupCoords, setCustomPickupCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [pickupCustomNote, setPickupCustomNote] = useState<string>('');
  const [pickupSearch, setPickupSearch] = useState<string>('');
  const [pickupOpen, setPickupOpen] = useState<boolean>(false);

  // Dropoff state (either preset stop or custom location)
  const [dropoffIsCustom, setDropoffIsCustom] = useState<boolean>(false);
  const [dropoffId, setDropoffId] = useState<string>('ausa_mode');
  const [customDropoffName, setCustomDropoffName] = useState<string>('');
  const [customDropoffCoords, setCustomDropoffCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dropoffCustomNote, setDropoffCustomNote] = useState<string>('');
  const [dropoffSearch, setDropoffSearch] = useState<string>('');
  const [dropoffOpen, setDropoffOpen] = useState<boolean>(false);

  const [activeSelector, setActiveSelector] = useState<'pickup' | 'dropoff'>('pickup');
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const pickupBoxRef = useRef<HTMLDivElement>(null);
  const dropoffBoxRef = useRef<HTMLDivElement>(null);

  const [fareSettings, setFareSettings] = useState(DEFAULT_FARE_SETTINGS);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const [activePin, setActivePin] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [receiptRide, setReceiptRide] = useState<Ride | null>(null);

  // Close suggestion lists when clicking outside
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (pickupBoxRef.current && !pickupBoxRef.current.contains(e.target as Node)) {
        setPickupOpen(false);
      }
      if (dropoffBoxRef.current && !dropoffBoxRef.current.contains(e.target as Node)) {
        setDropoffOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Listen to live fare settings
  useEffect(() => {
    const ref = doc(db, 'settings', 'fares');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<FareSettings>;
          setFareSettings({
            modeBustandPerPerson:
              typeof data.modeBustandPerPerson === 'number'
                ? data.modeBustandPerPerson
                : DEFAULT_FARE_SETTINGS.modeBustandPerPerson,
            standardFare:
              typeof data.standardFare === 'number'
                ? data.standardFare
                : DEFAULT_FARE_SETTINGS.standardFare,
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

  useEffect(() => {
    if (activeRide && tab === 'book') {
      setTab('active');
    }
  }, [activeRide?.rideId]);

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

  const pickupPoint: AusaPoint = useMemo(() => {
    if (pickupIsCustom) {
      const clean = sanitizeText(customPickupName, 100);
      const fallback = LANDMARK_BY_ID.get(pickupId) || AUSA_LANDMARKS[1];
      const coords = customPickupCoords || { lat: fallback.lat, lng: fallback.lng };
      return {
        id: 'custom_pickup',
        nameEn: clean || t.customTag,
        nameMr: clean || t.customTag,
        lat: coords.lat,
        lng: coords.lng,
        isCustom: true,
      };
    }
    const lm = LANDMARK_BY_ID.get(pickupId) || AUSA_LANDMARKS[1];
    return {
      id: lm.id,
      nameEn: lm.nameEn,
      nameMr: lm.nameMr,
      lat: lm.lat,
      lng: lm.lng,
    };
  }, [pickupIsCustom, customPickupName, customPickupCoords, pickupId, t.customTag]);

  const dropoffPoint: AusaPoint = useMemo(() => {
    if (dropoffIsCustom) {
      const clean = sanitizeText(customDropoffName, 100);
      const fallback = LANDMARK_BY_ID.get(dropoffId) || AUSA_LANDMARKS[0];
      const coords = customDropoffCoords || { lat: fallback.lat, lng: fallback.lng };
      return {
        id: 'custom_dropoff',
        nameEn: clean || t.customTag,
        nameMr: clean || t.customTag,
        lat: coords.lat,
        lng: coords.lng,
        isCustom: true,
      };
    }
    const lm = LANDMARK_BY_ID.get(dropoffId) || AUSA_LANDMARKS[0];
    return {
      id: lm.id,
      nameEn: lm.nameEn,
      nameMr: lm.nameMr,
      lat: lm.lat,
      lng: lm.lng,
    };
  }, [dropoffIsCustom, customDropoffName, customDropoffCoords, dropoffId, t.customTag]);

  const quickStops = useMemo(
    () =>
      QUICK_STOP_IDS.map((id) => LANDMARK_BY_ID.get(id)).filter(
        (lm): lm is AusaLandmark => Boolean(lm)
      ),
    []
  );

  const pickupSuggestions = useMemo(() => matchLandmarks(pickupSearch), [pickupSearch]);
  const dropoffSuggestions = useMemo(() => matchLandmarks(dropoffSearch), [dropoffSearch]);

  const offlineDirections = useMemo(
    () => computeOfflineDirections(pickupPoint, dropoffPoint, lang),
    [pickupPoint, dropoffPoint, lang]
  );

  const distanceKm = useMemo(() => {
    if (pickupIsCustom || dropoffIsCustom) {
      return offlineDirections.totalKm;
    }
    return calculateAusaDistanceKm(
      pickupPoint,
      dropoffPoint,
      pickupCustomNote.trim().length > 0,
      dropoffCustomNote.trim().length > 0
    );
  }, [
    pickupIsCustom,
    dropoffIsCustom,
    offlineDirections.totalKm,
    pickupPoint,
    dropoffPoint,
    pickupCustomNote,
    dropoffCustomNote,
  ]);

  const fareBreakdown = useMemo(
    () => calculateAusaFare(pickupPoint, dropoffPoint, passengerCount, fareSettings),
    [pickupPoint, dropoffPoint, passengerCount, fareSettings]
  );

  const isModeBustand = isBustandModeRoute(pickupPoint.id, dropoffPoint.id);

  const handleSwap = () => {
    setPickupIsCustom(dropoffIsCustom);
    setDropoffIsCustom(pickupIsCustom);
    setPickupId(dropoffId);
    setDropoffId(pickupId);
    setCustomPickupName(customDropoffName);
    setCustomDropoffName(customPickupName);
    setCustomPickupCoords(customDropoffCoords);
    setCustomDropoffCoords(customPickupCoords);
    setPickupCustomNote(dropoffCustomNote);
    setDropoffCustomNote(pickupCustomNote);
  };

  const selectPresetPickup = (lm: AusaLandmark) => {
    setPickupIsCustom(false);
    setPickupId(lm.id);
    setCustomPickupCoords(null);
    setPickupSearch('');
    setPickupOpen(false);
    setBookingError('');
  };

  const selectPresetDropoff = (lm: AusaLandmark) => {
    setDropoffIsCustom(false);
    setDropoffId(lm.id);
    setCustomDropoffCoords(null);
    setDropoffSearch('');
    setDropoffOpen(false);
    setBookingError('');
  };

  const activateCustomPickup = (initialName: string, coords?: { lat: number; lng: number }) => {
    setPickupIsCustom(true);
    setCustomPickupName(sanitizeText(initialName, 100));
    if (coords) setCustomPickupCoords(coords);
    setPickupSearch('');
    setPickupOpen(false);
    setBookingError('');
  };

  const activateCustomDropoff = (initialName: string, coords?: { lat: number; lng: number }) => {
    setDropoffIsCustom(true);
    setCustomDropoffName(sanitizeText(initialName, 100));
    if (coords) setCustomDropoffCoords(coords);
    setDropoffSearch('');
    setDropoffOpen(false);
    setBookingError('');
  };

  const isSuspended = !isAdminPreview && profile.accountStatus === 'suspended';

  const handleBookRide = async () => {
    setBookingError('');
    if (isSuspended) {
      setBookingError(t.riderSuspendedDesc);
      return;
    }

    const cleanPickupCustom = sanitizeText(pickupCustomNote, 140);
    const cleanDropoffCustom = sanitizeText(dropoffCustomNote, 140);

    const finalPickupName = pickupIsCustom
      ? sanitizeText(customPickupName, 100)
      : pickupPoint.nameEn;
    const finalDropoffName = dropoffIsCustom
      ? sanitizeText(customDropoffName, 100)
      : dropoffPoint.nameEn;

    if (finalPickupName.length < 2 || finalDropoffName.length < 2) {
      setBookingError(t.customNameMinError);
      return;
    }

    const samePreset =
      !pickupIsCustom &&
      !dropoffIsCustom &&
      pickupPoint.id === dropoffPoint.id &&
      !cleanPickupCustom &&
      !cleanDropoffCustom;
    const sameCustom =
      pickupIsCustom &&
      dropoffIsCustom &&
      finalPickupName.toLowerCase() === finalDropoffName.toLowerCase();

    if (samePreset || sameCustom) {
      setBookingError(t.sameLocationError);
      return;
    }

    const rideId = generateSafeId('ride');
    const pin = generateFourDigitPin();
    const safePassengers = Math.min(4, Math.max(1, Math.round(passengerCount)));
    const safeDistance = Math.min(30, Math.max(0.2, distanceKm));

    setBookingBusy(true);
    try {
      const batch = writeBatch(db);
      const rideRef = doc(db, 'rides', rideId);
      const otpRef = doc(db, 'rides', rideId, 'private', 'otp');
      const contactRef = doc(db, 'rides', rideId, 'contacts', 'rider');

      batch.set(rideRef, {
        rideId,
        riderId: profile.uid,
        riderName: sanitizeText(profile.fullName, 80) || 'Rider',
        driverId: '',
        driverName: '',
        driverVehicleNumber: '',
        pickupLandmarkId: pickupIsCustom ? 'custom_pickup' : pickupPoint.id,
        pickupLandmarkName: finalPickupName,
        pickupCustomAddress: cleanPickupCustom,
        dropoffLandmarkId: dropoffIsCustom ? 'custom_dropoff' : dropoffPoint.id,
        dropoffLandmarkName: finalDropoffName,
        dropoffCustomAddress: cleanDropoffCustom,
        passengerCount: safePassengers,
        distanceKm: safeDistance,
        fareInr: fareBreakdown.fareInr,
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
      setPickupCustomNote('');
      setDropoffCustomNote('');
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

  const handleMapSelectLandmark = (lm: AusaLandmark) => {
    if (activeSelector === 'pickup') {
      selectPresetPickup(lm);
    } else {
      selectPresetDropoff(lm);
    }
  };

  const handleMapSelectCustomPoint = (lat: number, lng: number, nearest: AusaLandmark) => {
    const label =
      lang === 'mr'
        ? `${nearest.nameMr.split(' (')[0]} जवळ`
        : `Near ${nearest.nameEn.split(' (')[0]}`;
    if (activeSelector === 'pickup') {
      activateCustomPickup(label, { lat, lng });
    } else {
      activateCustomDropoff(label, { lat, lng });
    }
  };

  const activeRidePoints = useMemo(() => {
    if (!activeRide) return null;
    const pLm = LANDMARK_BY_ID.get(activeRide.pickupLandmarkId);
    const dLm = LANDMARK_BY_ID.get(activeRide.dropoffLandmarkId);
    const pPt: AusaPoint = {
      id: activeRide.pickupLandmarkId,
      nameEn: activeRide.pickupLandmarkName,
      nameMr: pLm ? pLm.nameMr : activeRide.pickupLandmarkName,
      lat: pLm ? pLm.lat : AUSA_CENTER.lat - 0.001,
      lng: pLm ? pLm.lng : AUSA_CENTER.lng - 0.001,
    };
    const dPt: AusaPoint = {
      id: activeRide.dropoffLandmarkId,
      nameEn: activeRide.dropoffLandmarkName,
      nameMr: dLm ? dLm.nameMr : activeRide.dropoffLandmarkName,
      lat: dLm ? dLm.lat : AUSA_CENTER.lat + 0.002,
      lng: dLm ? dLm.lng : AUSA_CENTER.lng + 0.002,
    };
    return { pPt, dPt };
  }, [activeRide]);

  const steps: Array<{ key: Ride['status']; label: string }> = [
    { key: 'requested', label: t.status.requested },
    { key: 'accepted', label: t.status.accepted },
    { key: 'arrived', label: t.status.arrived },
    { key: 'in_progress', label: t.status.in_progress },
  ];

  const cleanTypedPickup = sanitizeText(pickupSearch, 100);
  const cleanTypedDropoff = sanitizeText(dropoffSearch, 100);

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
          {/* Left Column: Search-Suggested & Custom Pickup / Drop-off */}
          <div className="lg:col-span-7 space-y-4">
            {isAdminPreview && activeRide && (
              <div className="p-3.5 rounded-2xl bg-yellow-100 border border-yellow-300 text-xs text-zinc-950 font-medium">
                Active test booking ({activeRide.rideId.slice(-6)}). Track it in Active Trip or Driver View.
              </div>
            )}

            {/* Pickup Selector */}
            <div
              ref={pickupBoxRef}
              onClick={() => setActiveSelector('pickup')}
              className={`bg-white rounded-2xl border p-5 transition-colors ${
                activeSelector === 'pickup' ? 'border-zinc-950' : 'border-zinc-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-yellow-600 shrink-0" />
                  <h2 className="text-sm font-bold text-zinc-950">{t.pickupTitle}:</h2>
                  <span className="text-sm font-extrabold text-zinc-950 bg-yellow-300 px-2.5 py-0.5 rounded-lg truncate">
                    {lang === 'mr' ? pickupPoint.nameMr : pickupPoint.nameEn}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pickupIsCustom) {
                        setPickupIsCustom(false);
                      } else {
                        activateCustomPickup(customPickupName || pickupSearch);
                      }
                    }}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                      pickupIsCustom
                        ? 'bg-zinc-950 text-yellow-400 border-zinc-950'
                        : 'border-zinc-200 text-zinc-700 hover:bg-stone-100'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{pickupIsCustom ? t.stopModeBtn : t.customModeBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwap();
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-stone-100 flex items-center gap-1"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>{t.swapRoute}</span>
                  </button>
                </div>
              </div>

              {pickupIsCustom ? (
                <div className="space-y-2.5 mb-3">
                  <label className="block text-xs font-semibold text-zinc-700">
                    {t.customPickupLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={customPickupName}
                    onChange={(e) => setCustomPickupName(e.target.value)}
                    placeholder={t.customPickupPlaceholder}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-950 bg-yellow-50/40 text-sm font-medium text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                </div>
              ) : (
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={pickupSearch}
                    onFocus={() => setPickupOpen(true)}
                    onChange={(e) => {
                      setPickupSearch(e.target.value);
                      setPickupOpen(true);
                    }}
                    placeholder={t.searchPickupPlaceholder}
                    className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                  {pickupSearch && (
                    <button
                      type="button"
                      aria-label="Clear pickup search"
                      onClick={() => setPickupSearch('')}
                      className="absolute right-2.5 top-2.5 p-1 rounded-lg text-zinc-400 hover:text-zinc-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {pickupOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-zinc-300 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-zinc-100">
                      {cleanTypedPickup.length >= 2 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            activateCustomPickup(cleanTypedPickup);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm bg-yellow-50 hover:bg-yellow-100 text-zinc-950 font-bold flex items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <PlusCircle className="w-4 h-4 text-zinc-950 shrink-0" />
                            <span className="truncate">
                              {t.useCustomLocationPrefix}: “{cleanTypedPickup}”
                            </span>
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-600 shrink-0">
                            {t.customTag}
                          </span>
                        </button>
                      )}
                      {pickupSuggestions.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-zinc-500">
                          Type at least 2 characters to add a custom pickup location.
                        </p>
                      ) : (
                        pickupSuggestions.map((lm) => {
                          const selected = lm.id === pickupId;
                          return (
                            <button
                              key={lm.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectPresetPickup(lm);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors ${
                                selected
                                  ? 'bg-zinc-950 text-yellow-400 font-bold'
                                  : 'hover:bg-stone-100 text-zinc-950 font-medium'
                              }`}
                            >
                              <span>{lang === 'mr' ? lm.nameMr : lm.nameEn}</span>
                              <span
                                className={`text-xs ${
                                  selected ? 'text-zinc-300' : 'text-zinc-500'
                                }`}
                              >
                                {lang === 'mr' ? lm.tagMr : lm.tagEn}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Compact Quick Picks */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[11px] font-medium text-zinc-500 mr-1">
                  {t.popularStopsLabel}:
                </span>
                {quickStops.map((lm) => {
                  const selected = !pickupIsCustom && lm.id === pickupId;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => selectPresetPickup(lm)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
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

              <input
                type="text"
                maxLength={140}
                value={pickupCustomNote}
                onChange={(e) => setPickupCustomNote(e.target.value)}
                placeholder={`${t.customStreetLabel} (${t.customStreetPlaceholder})`}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-stone-50 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
              />
            </div>

            {/* Dropoff Selector */}
            <div
              ref={dropoffBoxRef}
              onClick={() => setActiveSelector('dropoff')}
              className={`bg-white rounded-2xl border p-5 transition-colors ${
                activeSelector === 'dropoff' ? 'border-zinc-950' : 'border-zinc-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Navigation className="w-4 h-4 text-emerald-700 shrink-0" />
                  <h2 className="text-sm font-bold text-zinc-950">{t.dropoffTitle}:</h2>
                  <span className="text-sm font-extrabold text-zinc-950 bg-emerald-100 px-2.5 py-0.5 rounded-lg truncate">
                    {lang === 'mr' ? dropoffPoint.nameMr : dropoffPoint.nameEn}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dropoffIsCustom) {
                      setDropoffIsCustom(false);
                    } else {
                      activateCustomDropoff(customDropoffName || dropoffSearch);
                    }
                  }}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                    dropoffIsCustom
                      ? 'bg-zinc-950 text-yellow-400 border-zinc-950'
                      : 'border-zinc-200 text-zinc-700 hover:bg-stone-100'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{dropoffIsCustom ? t.stopModeBtn : t.customModeBtn}</span>
                </button>
              </div>

              {dropoffIsCustom ? (
                <div className="space-y-2.5 mb-3">
                  <label className="block text-xs font-semibold text-zinc-700">
                    {t.customDropoffLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={customDropoffName}
                    onChange={(e) => setCustomDropoffName(e.target.value)}
                    placeholder={t.customDropoffPlaceholder}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-950 bg-emerald-50/40 text-sm font-medium text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                </div>
              ) : (
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={dropoffSearch}
                    onFocus={() => setDropoffOpen(true)}
                    onChange={(e) => {
                      setDropoffSearch(e.target.value);
                      setDropoffOpen(true);
                    }}
                    placeholder={t.searchDropoffPlaceholder}
                    className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                  {dropoffSearch && (
                    <button
                      type="button"
                      aria-label="Clear drop-off search"
                      onClick={() => setDropoffSearch('')}
                      className="absolute right-2.5 top-2.5 p-1 rounded-lg text-zinc-400 hover:text-zinc-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {dropoffOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-zinc-300 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-zinc-100">
                      {cleanTypedDropoff.length >= 2 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            activateCustomDropoff(cleanTypedDropoff);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm bg-emerald-50 hover:bg-emerald-100 text-zinc-950 font-bold flex items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <PlusCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="truncate">
                              {t.useCustomLocationPrefix}: “{cleanTypedDropoff}”
                            </span>
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-600 shrink-0">
                            {t.customTag}
                          </span>
                        </button>
                      )}
                      {dropoffSuggestions.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-zinc-500">
                          Type at least 2 characters to add a custom drop-off location.
                        </p>
                      ) : (
                        dropoffSuggestions.map((lm) => {
                          const selected = lm.id === dropoffId;
                          return (
                            <button
                              key={lm.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectPresetDropoff(lm);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors ${
                                selected
                                  ? 'bg-yellow-400 text-zinc-950 font-bold'
                                  : 'hover:bg-stone-100 text-zinc-950 font-medium'
                              }`}
                            >
                              <span>{lang === 'mr' ? lm.nameMr : lm.nameEn}</span>
                              <span className="text-xs text-zinc-600">
                                {lang === 'mr' ? lm.tagMr : lm.tagEn}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[11px] font-medium text-zinc-500 mr-1">
                  {t.popularStopsLabel}:
                </span>
                {quickStops.map((lm) => {
                  const selected = !dropoffIsCustom && lm.id === dropoffId;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => selectPresetDropoff(lm)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
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

              <input
                type="text"
                maxLength={140}
                value={dropoffCustomNote}
                onChange={(e) => setDropoffCustomNote(e.target.value)}
                placeholder={`${t.customStreetLabel} (${t.customStreetPlaceholder})`}
                className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-stone-50 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
              />
            </div>
          </div>

          {/* Right Column: Offline Ausa Map + Directions, Fare & Payment */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
            <AusaMap
              pickup={pickupPoint}
              dropoff={dropoffPoint}
              lang={lang}
              distanceKm={distanceKm}
              activeSelector={activeSelector}
              onSelectLandmark={handleMapSelectLandmark}
              onSelectCustomPoint={handleMapSelectCustomPoint}
            />

            <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
              <h3 className="text-base font-bold text-zinc-950">{t.fareSummaryTitle}</h3>

              {/* Passenger Selector (1-4) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{t.passengersLabel}</span>
                  </span>
                  {isModeBustand && (
                    <span className="text-xs font-mono font-bold text-zinc-950 bg-yellow-300 px-2 py-0.5 rounded-md tabular-nums">
                      {passengerCount} × ₹{fareSettings.modeBustandPerPerson}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPassengerCount(cnt)}
                      className={`min-h-[42px] rounded-xl font-mono text-sm font-bold border transition-colors ${
                        passengerCount === cnt
                          ? 'bg-zinc-950 text-yellow-400 border-zinc-950'
                          : 'bg-stone-50 text-zinc-800 border-zinc-200 hover:bg-stone-100'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-sm border-y border-zinc-200 py-3">
                <div className="flex justify-between">
                  <span className="text-zinc-600">{t.distanceLabel}</span>
                  <span className="font-mono font-semibold text-zinc-950 tabular-nums">
                    {distanceKm.toFixed(1)} km · ~{offlineDirections.etaMins} min
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-600">{t.fareRuleLabel}</span>
                  <span className="font-medium text-right text-zinc-950 text-xs">
                    {isModeBustand ? t.modeBustandRuleDesc : t.standardRuleDesc}
                  </span>
                </div>
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
                    {(activeRide.pickupCustomAddress || activeRide.dropoffCustomAddress) && (
                      <p className="text-xs text-zinc-300 mt-1">
                        {activeRide.pickupCustomAddress || '—'} →{' '}
                        {activeRide.dropoffCustomAddress || '—'}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 mt-1">
                      {activeRide.passengerCount || 1} pax · {activeRide.distanceKm.toFixed(1)} km · ₹
                      {activeRide.fareInr} · {activeRide.paymentMethod.toUpperCase()}
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

              {/* Offline Route & Directions for Active Trip */}
              {activeRidePoints && (
                <AusaMap
                  pickup={activeRidePoints.pPt}
                  dropoff={activeRidePoints.dPt}
                  lang={lang}
                  distanceKm={activeRide.distanceKm}
                  defaultShowDirections={true}
                />
              )}

              {/* Driver & Active-Ride-Only Contact Card */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-4">
                {bookingError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                    {bookingError}
                  </div>
                )}

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
                      {(ride.pickupCustomAddress || ride.dropoffCustomAddress) && (
                        <p className="text-xs text-zinc-500 truncate">
                          {ride.pickupCustomAddress || '—'} → {ride.dropoffCustomAddress || '—'}
                        </p>
                      )}
                      <p className="text-xs text-zinc-600">
                        {ride.driverName
                          ? `${ride.driverName} (${ride.driverVehicleNumber})`
                          : 'No driver assigned'}{' '}
                        · {ride.passengerCount || 1} pax · {ride.distanceKm.toFixed(1)} km
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
