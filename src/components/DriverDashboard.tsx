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
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  IndianRupee,
  KeyRound,
  Navigation,
  Phone,
  Power,
  Radio,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useT } from '../i18n/translations';
import { db, handleFirestoreError, OperationType, reportFirestoreError } from '../lib/firebase';
import { Lang, Ride, UserProfile } from '../types';
import { sanitizeText } from '../utils/sanitize';
import { UpiQrPanel } from './ReceiptModal';

interface DriverDashboardProps {
  profile: UserProfile;
  lang: Lang;
  isAdminPreview?: boolean;
}

type DriverTab = 'dispatch' | 'active' | 'earnings';

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  profile,
  lang,
  isAdminPreview = false,
}) => {
  const t = useT(lang);
  const [tab, setTab] = useState<DriverTab>('dispatch');

  const [requestedRides, setRequestedRides] = useState<Ride[]>([]);
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [riderPhone, setRiderPhone] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [busyAction, setBusyAction] = useState<boolean>(false);

  const isVerifiedDriver =
    isAdminPreview || (profile.role === 'driver' && profile.accountStatus === 'approved');
  const isSuspended = !isAdminPreview && profile.accountStatus === 'suspended';
  const canReceiveDispatch = isVerifiedDriver && (profile.isOnline || isAdminPreview);

  // Listen to requested rides in Ausa when online & verified
  useEffect(() => {
    if (!canReceiveDispatch) {
      setRequestedRides([]);
      return;
    }

    const q = query(collection(db, 'rides'), where('status', '==', 'requested'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Ride);
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setRequestedRides(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rides');
      }
    );
    return unsub;
  }, [canReceiveDispatch]);

  // Listen to this Driver's assigned / completed rides
  useEffect(() => {
    const q = query(collection(db, 'rides'), where('driverId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Ride);
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setDriverRides(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rides');
      }
    );
    return unsub;
  }, [profile.uid]);

  const activeTrip = useMemo(
    () =>
      driverRides.find((r) => ['accepted', 'arrived', 'in_progress'].includes(r.status)) || null,
    [driverRides]
  );

  useEffect(() => {
    if (activeTrip && tab === 'dispatch') {
      setTab('active');
    }
  }, [activeTrip?.rideId]);

  // Ephemeral Rider phone number (accessible only during accepted/arrived/in_progress)
  useEffect(() => {
    let cancelled = false;
    async function loadRiderContact() {
      if (!activeTrip || !['accepted', 'arrived', 'in_progress'].includes(activeTrip.status)) {
        setRiderPhone('');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'rides', activeTrip.rideId, 'contacts', 'rider'));
        if (!cancelled && snap.exists()) {
          setRiderPhone(String(snap.data().phone || ''));
        }
      } catch (err) {
        reportFirestoreError(err, OperationType.GET, `rides/${activeTrip.rideId}/contacts/rider`);
      }
    }
    void loadRiderContact();
    return () => {
      cancelled = true;
    };
  }, [activeTrip?.rideId, activeTrip?.status]);

  const todayLedger = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const completedToday = driverRides.filter((r) => {
      if (r.status !== 'completed') return false;
      const d = r.updatedAt?.toDate ? r.updatedAt.toDate() : null;
      if (!d) return true;
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
    });

    let cashTotal = 0;
    let upiTotal = 0;
    for (const r of completedToday) {
      if (r.paymentMethod === 'cash') cashTotal += r.fareInr;
      else upiTotal += r.fareInr;
    }
    return {
      rides: completedToday,
      count: completedToday.length,
      cashTotal,
      upiTotal,
      netTotal: cashTotal + upiTotal,
    };
  }, [driverRides]);

  const handleToggleOnline = async () => {
    if (!isVerifiedDriver) return;
    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: !profile.isOnline,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleAcceptRide = async (ride: Ride) => {
    if (!isVerifiedDriver || activeTrip) return;
    setActionError('');
    setBusyAction(true);
    try {
      const batch = writeBatch(db);
      const rideRef = doc(db, 'rides', ride.rideId);
      const contactRef = doc(db, 'rides', ride.rideId, 'contacts', 'driver');

      batch.update(rideRef, {
        driverId: profile.uid,
        driverName: sanitizeText(profile.fullName, 80),
        driverVehicleNumber: profile.vehicleNumber || 'MH-24-AU-0001',
        status: 'accepted',
        updatedAt: serverTimestamp(),
      });

      batch.set(contactRef, {
        phone: profile.phone,
        ownerId: profile.uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setTab('active');
    } catch (err) {
      reportFirestoreError(err, OperationType.WRITE, `rides/${ride.rideId}`);
      setActionError(t.rideAlreadyTaken);
    } finally {
      setBusyAction(false);
    }
  };

  const handleMarkArrived = async (ride: Ride) => {
    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'rides', ride.rideId), {
        status: 'arrived',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rides/${ride.rideId}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleVerifyPinAndStart = async (e: React.FormEvent, ride: Ride) => {
    e.preventDefault();
    setPinError('');
    const cleaned = pinInput.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length !== 4) {
      setPinError('Enter the 4-digit PIN shown on the Rider’s screen.');
      return;
    }

    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'rides', ride.rideId), {
        status: 'in_progress',
        submittedPin: cleaned,
        updatedAt: serverTimestamp(),
      });
      setPinInput('');
    } catch (err) {
      // Firestore Rules reject mismatched PIN with permission-denied
      reportFirestoreError(err, OperationType.UPDATE, `rides/${ride.rideId}`);
      setPinError(t.wrongPinError);
    } finally {
      setBusyAction(false);
    }
  };

  const handleCompleteTrip = async (ride: Ride) => {
    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'rides', ride.rideId), {
        status: 'completed',
        paymentStatus: 'paid',
        updatedAt: serverTimestamp(),
      });
      setRiderPhone('');
      setTab('earnings');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rides/${ride.rideId}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleDriverCancel = async (ride: Ride) => {
    setActionError('');
    setBusyAction(true);
    try {
      await updateDoc(doc(db, 'rides', ride.rideId), {
        status: 'cancelled',
        cancelledBy: 'driver',
        updatedAt: serverTimestamp(),
      });
      setRiderPhone('');
    } catch (err) {
      reportFirestoreError(err, OperationType.UPDATE, `rides/${ride.rideId}`);
      setActionError(t.rideActionError);
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10 space-y-5">
      {/* Verification / Online Availability Bar */}
      {!isVerifiedDriver ? (
        <div className="bg-zinc-950 text-white rounded-2xl p-5 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-yellow-400">
                {isSuspended ? t.accountSuspendedTitle : t.verificationPendingTitle}
              </h2>
              <p className="text-xs text-zinc-300 mt-1 max-w-2xl">
                {isSuspended ? t.accountSuspendedDesc : t.verificationPendingDesc}
              </p>
              <p className="text-xs font-mono text-zinc-400 mt-2">
                {profile.vehicleNumber} · {profile.licenseNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-500 text-xs font-bold cursor-not-allowed shrink-0"
          >
            {t.goOnline}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                profile.isOnline || isAdminPreview
                  ? 'bg-yellow-400 text-zinc-950'
                  : 'bg-stone-200 text-zinc-700'
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-950">
                {profile.isOnline || isAdminPreview ? t.onlineStatus : t.offlineStatus}
              </p>
              <p className="text-xs font-mono text-zinc-600 mt-0.5">
                {profile.fullName} · {profile.vehicleNumber || 'MH-24-AU-0001'}
              </p>
            </div>
          </div>

          {!isAdminPreview && (
            <button
              type="button"
              disabled={busyAction}
              onClick={handleToggleOnline}
              className={`min-h-[46px] px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shrink-0 ${
                profile.isOnline
                  ? 'bg-zinc-950 text-yellow-400 hover:bg-zinc-800'
                  : 'bg-yellow-400 text-zinc-950 hover:bg-yellow-300'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{profile.isOnline ? t.goOffline : t.goOnline}</span>
            </button>
          )}
        </div>
      )}

      {/* Desktop Navigation Tabs */}
      <div className="hidden sm:flex items-center gap-2 p-1 bg-zinc-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('dispatch')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'dispatch' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>
            {t.driverTabDispatch} ({requestedRides.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'active' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>
            {t.driverTabActive}
            {activeTrip ? ' (1)' : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('earnings')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'earnings' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>{t.driverTabEarnings}</span>
        </button>
      </div>

      {/* DISPATCH TAB */}
      {tab === 'dispatch' && (
        <div>
          <h2 className="text-lg font-bold text-zinc-950 mb-4">{t.dispatchTitle}</h2>
          {actionError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {actionError}
            </div>
          )}
          {!canReceiveDispatch ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-sm text-zinc-600">
              {isVerifiedDriver
                ? t.offlineStatus
                : t.verificationPendingTitle}
            </div>
          ) : requestedRides.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-sm text-zinc-600">
              {t.noRequests}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requestedRides.map((ride) => (
                <div
                  key={ride.rideId}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-900">{ride.riderName}</span>
                      <span className="font-mono uppercase">{ride.paymentMethod}</span>
                    </div>
                    <p className="text-base font-bold text-zinc-950">
                      {ride.pickupLandmarkName} → {ride.dropoffLandmarkName}
                    </p>
                    {(ride.pickupCustomAddress || ride.dropoffCustomAddress) && (
                      <p className="text-xs text-zinc-600">
                        {ride.pickupCustomAddress ? `Pickup: ${ride.pickupCustomAddress}` : ''}{' '}
                        {ride.dropoffCustomAddress ? `· Drop: ${ride.dropoffCustomAddress}` : ''}
                      </p>
                    )}
                    <div className="flex items-center gap-4 pt-1 text-sm">
                      <span className="font-mono font-bold text-zinc-950 tabular-nums">
                        {ride.distanceKm.toFixed(1)} km
                      </span>
                      <span className="text-zinc-400">·</span>
                      <span className="font-mono text-lg font-bold text-zinc-950 tabular-nums">
                        ₹{ride.fareInr}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busyAction || Boolean(activeTrip)}
                    onClick={() => handleAcceptRide(ride)}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    {activeTrip ? 'Complete current trip first' : t.acceptRide}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE TRIP EXECUTION TAB */}
      {tab === 'active' && (
        <div className="max-w-3xl mx-auto">
          {!activeTrip ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
              <Clock className="w-9 h-9 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm text-zinc-600">No active ride assigned right now.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-zinc-950 text-white rounded-3xl p-6 border border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-yellow-400">
                      {t.status[activeTrip.status]}
                    </p>
                    <h2 className="text-xl font-bold mt-1">
                      {activeTrip.pickupLandmarkName} → {activeTrip.dropoffLandmarkName}
                    </h2>
                    {(activeTrip.pickupCustomAddress || activeTrip.dropoffCustomAddress) && (
                      <p className="text-xs text-zinc-300 mt-1">
                        {activeTrip.pickupCustomAddress}
                        {activeTrip.pickupCustomAddress && activeTrip.dropoffCustomAddress
                          ? ' → '
                          : ''}
                        {activeTrip.dropoffCustomAddress}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 mt-2">
                      Rider: {activeTrip.riderName} · {activeTrip.distanceKm.toFixed(1)} km ·{' '}
                      {activeTrip.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Fare</p>
                    <p className="text-2xl font-mono font-bold text-yellow-400 tabular-nums">
                      ₹{activeTrip.fareInr}
                    </p>
                  </div>
                </div>

                {riderPhone && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-zinc-400">{t.privacyNoticeActive}</span>
                    <a
                      href={`tel:${riderPhone}`}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-yellow-400 text-zinc-950 font-bold text-xs flex items-center gap-2 hover:bg-yellow-300"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{t.callRider}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Step Action Card */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-4">
                {activeTrip.status === 'accepted' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleMarkArrived(activeTrip)}
                      className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      {t.markArrived}
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleDriverCancel(activeTrip)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-red-300 text-red-700 font-semibold text-xs hover:bg-red-50 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t.driverCancelTrip}</span>
                    </button>
                  </div>
                )}

                {activeTrip.status === 'arrived' && (
                  <form
                    onSubmit={(e) => handleVerifyPinAndStart(e, activeTrip)}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-bold text-zinc-950 mb-1.5 flex items-center gap-2">
                        <KeyRound className="w-4 h-4" />
                        <span>{t.enterPinTitle}</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="0000"
                        className="w-full min-h-[54px] px-4 py-3 rounded-xl border-2 border-zinc-950 bg-stone-50 font-mono text-2xl font-bold tracking-[0.4em] text-center text-zinc-950 focus:outline-none focus:bg-white"
                      />
                    </div>

                    {pinError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                        {pinError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busyAction}
                      className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-yellow-400 font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      {t.verifyStartTrip}
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleDriverCancel(activeTrip)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-red-300 text-red-700 font-semibold text-xs hover:bg-red-50 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t.driverCancelTrip}</span>
                    </button>
                  </form>
                )}

                {activeTrip.status === 'in_progress' && (
                  <div className="space-y-4">
                    {activeTrip.paymentMethod === 'upi' && (
                      <UpiQrPanel
                        amount={activeTrip.fareInr}
                        rideId={activeTrip.rideId}
                        driverName={activeTrip.driverName}
                        lang={lang}
                      />
                    )}
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleCompleteTrip(activeTrip)}
                      className="w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-yellow-400 font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {t.completeTripBtn} (₹{activeTrip.fareInr})
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EARNINGS LEDGER TAB */}
      {tab === 'earnings' && (
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-zinc-950">{t.earningsTodayTitle}</h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-4">
              <p className="text-xs text-zinc-500">{t.completedRidesCount}</p>
              <p className="text-2xl font-mono font-bold text-zinc-950 mt-1 tabular-nums">
                {todayLedger.count}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5" />
                <span>{t.cashCollected}</span>
              </p>
              <p className="text-2xl font-mono font-bold text-zinc-950 mt-1 tabular-nums">
                ₹{todayLedger.cashTotal}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span>{t.upiCollected}</span>
              </p>
              <p className="text-2xl font-mono font-bold text-zinc-950 mt-1 tabular-nums">
                ₹{todayLedger.upiTotal}
              </p>
            </div>
            <div className="bg-zinc-950 text-white rounded-2xl p-4">
              <p className="text-xs text-yellow-400 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5" />
                <span>{t.totalNetIncome}</span>
              </p>
              <p className="text-2xl font-mono font-bold text-yellow-400 mt-1 tabular-nums">
                ₹{todayLedger.netTotal}
              </p>
            </div>
          </div>

          {todayLedger.rides.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
              {todayLedger.rides.map((r) => (
                <div key={r.rideId} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-zinc-950">
                      {r.pickupLandmarkName} → {r.dropoffLandmarkName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.riderName} · {r.distanceKm.toFixed(1)} km · {r.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-zinc-950 tabular-nums">
                    +₹{r.fareInr}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Driver navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 grid grid-cols-3 h-16 pb-safe"
      >
        <button
          type="button"
          onClick={() => setTab('dispatch')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'dispatch' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Radio className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">
            {t.driverTabDispatch} ({requestedRides.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'active' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Navigation className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">{t.driverTabActive}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('earnings')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'earnings' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-1">{t.driverTabEarnings}</span>
        </button>
      </nav>
    </div>
  );
};
