import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Activity,
  Ban,
  Car,
  CheckCircle2,
  IndianRupee,
  Save,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { DEFAULT_FARE_SETTINGS } from '../data/ausaLandmarks';
import { useT } from '../i18n/translations';
import { db, handleFirestoreError, OperationType, reportFirestoreError } from '../lib/firebase';
import { AccountStatus, FareSettings, Lang, Ride, UserProfile } from '../types';

interface AdminDashboardProps {
  profile: UserProfile;
  lang: Lang;
}

type AdminTab = 'drivers' | 'users' | 'rides' | 'fares';
type RideFilter = 'all' | 'active' | 'completed' | 'cancelled';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ profile, lang }) => {
  const t = useT(lang);
  const [tab, setTab] = useState<AdminTab>('drivers');
  const [rideFilter, setRideFilter] = useState<RideFilter>('all');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);

  const [modeBustandPerPerson, setModeBustandPerPerson] = useState<number>(
    DEFAULT_FARE_SETTINGS.modeBustandPerPerson
  );
  const [standardFare, setStandardFare] = useState<number>(DEFAULT_FARE_SETTINGS.standardFare);
  const [savingFares, setSavingFares] = useState(false);
  const [faresNotice, setFaresNotice] = useState('');
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'rides'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Ride);
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setRides(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rides');
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'fares'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<FareSettings>;
          if (typeof data.modeBustandPerPerson === 'number') {
            setModeBustandPerPerson(data.modeBustandPerPerson);
          }
          if (typeof data.standardFare === 'number') {
            setStandardFare(data.standardFare);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/fares');
      }
    );
    return unsub;
  }, []);

  const drivers = useMemo(
    () =>
      users
        .filter((u) => u.role === 'driver')
        .sort((a, b) => {
          if (
            a.accountStatus === 'pending_verification' &&
            b.accountStatus !== 'pending_verification'
          )
            return -1;
          if (
            b.accountStatus === 'pending_verification' &&
            a.accountStatus !== 'pending_verification'
          )
            return 1;
          return a.fullName.localeCompare(b.fullName);
        }),
    [users]
  );

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [users]
  );

  const filteredRides = useMemo(() => {
    if (rideFilter === 'active') {
      return rides.filter((r) =>
        ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
      );
    }
    if (rideFilter === 'completed') {
      return rides.filter((r) => r.status === 'completed');
    }
    if (rideFilter === 'cancelled') {
      return rides.filter((r) => r.status === 'cancelled');
    }
    return rides;
  }, [rides, rideFilter]);

  const pendingDriversCount = drivers.filter(
    (d) => d.accountStatus === 'pending_verification'
  ).length;
  const activeRidesCount = rides.filter((r) =>
    ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
  ).length;

  const handleAccountStatus = async (user: UserProfile, nextStatus: AccountStatus) => {
    setAdminError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        accountStatus: nextStatus,
        isOnline: nextStatus === 'approved' ? user.isOnline : false,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      reportFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setAdminError(`Failed to update account status for ${user.fullName}.`);
    }
  };

  const handleAdminCancelRide = async (ride: Ride) => {
    setAdminError('');
    try {
      await updateDoc(doc(db, 'rides', ride.rideId), {
        status: 'cancelled',
        cancelledBy: 'admin',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      reportFirestoreError(err, OperationType.UPDATE, `rides/${ride.rideId}`);
      setAdminError(`Failed to cancel ride ${ride.rideId.slice(-6)}.`);
    }
  };

  const handleSaveFares = async (e: React.FormEvent) => {
    e.preventDefault();
    setFaresNotice('');
    setAdminError('');
    const safePerPerson = Math.min(100, Math.max(5, Number(modeBustandPerPerson) || 10));
    const safeStandard = Math.min(500, Math.max(10, Number(standardFare) || 50));

    setSavingFares(true);
    try {
      await setDoc(doc(db, 'settings', 'fares'), {
        modeBustandPerPerson: safePerPerson,
        standardFare: safeStandard,
        updatedBy: profile.uid,
        updatedAt: serverTimestamp(),
      });
      setFaresNotice(t.faresSaved);
    } catch (err) {
      reportFirestoreError(err, OperationType.WRITE, 'settings/fares');
      setAdminError('Could not save fare rates. Please verify admin permissions.');
    } finally {
      setSavingFares(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10 space-y-6">
      {adminError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800">
          {adminError}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 text-white rounded-2xl p-4">
          <p className="text-xs text-zinc-400">Pending Verification</p>
          <p className="text-2xl font-mono font-bold text-yellow-400 mt-1 tabular-nums">
            {pendingDriversCount}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4">
          <p className="text-xs text-zinc-500">Registered Accounts</p>
          <p className="text-2xl font-mono font-bold text-zinc-950 mt-1 tabular-nums">
            {users.length}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4">
          <p className="text-xs text-zinc-500">Active Ausa Rides</p>
          <p className="text-2xl font-mono font-bold text-zinc-950 mt-1 tabular-nums">
            {activeRidesCount}
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4">
          <p className="text-xs text-zinc-500">Total Logged Rides</p>
          <p className="text-2xl font-mono font-bold text-zinc-950 mt-1 tabular-nums">
            {rides.length}
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 p-1 bg-zinc-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('drivers')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'drivers' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>
            {t.adminTabDrivers} ({drivers.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'users' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>
            {t.adminTabUsers} ({users.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('rides')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'rides' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>
            {t.adminTabRides} ({rides.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('fares')}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
            tab === 'fares' ? 'bg-zinc-950 text-yellow-400' : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          <span>{t.adminTabFares}</span>
        </button>
      </div>

      {tab === 'drivers' && (
        <div>
          <h2 className="text-lg font-bold text-zinc-950 mb-4">{t.adminDriversTitle}</h2>
          {drivers.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-sm text-zinc-600">
              {t.noDriversYet}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drivers.map((drv) => (
                <div
                  key={drv.uid}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="font-mono">{drv.vehicleNumber}</span>
                      <span
                        className={`font-semibold ${
                          drv.accountStatus === 'approved'
                            ? 'text-emerald-700'
                            : drv.accountStatus === 'pending_verification'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {drv.accountStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-base font-bold text-zinc-950 mt-1">{drv.fullName}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {drv.phone} · License: <span className="font-mono">{drv.licenseNumber}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {drv.accountStatus !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleAccountStatus(drv, 'approved')}
                        className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-zinc-950 text-yellow-400 text-xs font-bold hover:bg-zinc-800 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {drv.accountStatus === 'suspended' ? t.reinstateDriver : t.approveDriver}
                        </span>
                      </button>
                    )}
                    {drv.accountStatus !== 'suspended' && (
                      <button
                        type="button"
                        onClick={() => handleAccountStatus(drv, 'suspended')}
                        className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-1.5"
                      >
                        <Ban className="w-4 h-4" />
                        <span>{t.suspendDriver}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <h2 className="text-lg font-bold text-zinc-950 mb-4">{t.adminUsersTitle}</h2>
          {sortedUsers.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-sm text-zinc-600">
              {t.noUsersYet}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedUsers.map((u) => (
                <div
                  key={u.uid}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold uppercase text-zinc-950">{u.role}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          u.accountStatus === 'approved'
                            ? 'text-emerald-700'
                            : u.accountStatus === 'pending_verification'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {u.accountStatus.replace('_', ' ')}
                      </span>
                      {u.vehicleNumber && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{u.vehicleNumber}</span>
                        </>
                      )}
                    </div>
                    <p className="text-base font-bold text-zinc-950 truncate">{u.fullName}</p>
                    <p className="text-xs text-zinc-600 truncate">
                      {u.email} · <span className="font-mono">{u.phone}</span>
                    </p>
                  </div>

                  {u.role !== 'admin' && (
                    <div className="flex items-center gap-2 shrink-0">
                      {u.accountStatus !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleAccountStatus(u, 'approved')}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-950 text-yellow-400 text-xs font-bold hover:bg-zinc-800"
                        >
                          {u.accountStatus === 'suspended' ? t.reinstateDriver : t.approveDriver}
                        </button>
                      )}
                      {u.accountStatus !== 'suspended' && (
                        <button
                          type="button"
                          onClick={() => handleAccountStatus(u, 'suspended')}
                          className="min-h-[42px] px-4 py-2 rounded-xl border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50"
                        >
                          {t.suspendDriver}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'rides' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-zinc-950">{t.adminRidesTitle}</h2>
            <div className="flex items-center gap-1 p-1 bg-zinc-200/70 rounded-xl">
              {(['all', 'active', 'completed', 'cancelled'] as RideFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRideFilter(f)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    rideFilter === f
                      ? 'bg-zinc-950 text-yellow-400'
                      : 'text-zinc-700 hover:text-zinc-950'
                  }`}
                >
                  {f === 'all'
                    ? t.filterAll
                    : f === 'active'
                    ? t.filterActive
                    : f === 'completed'
                    ? t.filterCompleted
                    : t.filterCancelled}
                </button>
              ))}
            </div>
          </div>

          {filteredRides.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-sm text-zinc-600">
              {t.noAdminRides}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((r) => (
                <div
                  key={r.rideId}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-950">{t.status[r.status]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{r.rideId.slice(-8)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="uppercase">{r.paymentMethod}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.passengerCount || 1} pax</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-950">
                      {r.pickupLandmarkName} → {r.dropoffLandmarkName}
                    </p>
                    {(r.pickupCustomAddress || r.dropoffCustomAddress) && (
                      <p className="text-xs text-zinc-500">
                        {r.pickupCustomAddress || '—'} → {r.dropoffCustomAddress || '—'}
                      </p>
                    )}
                    <p className="text-xs text-zinc-600">
                      Rider: {r.riderName} · Driver: {r.driverName || 'Unassigned'}{' '}
                      {r.driverVehicleNumber ? `(${r.driverVehicleNumber})` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-lg font-bold text-zinc-950 tabular-nums">
                      ₹{r.fareInr}
                    </span>
                    {!['completed', 'cancelled'].includes(r.status) && (
                      <button
                        type="button"
                        onClick={() => handleAdminCancelRide(r)}
                        className="min-h-[40px] px-3 py-2 rounded-xl border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{t.adminCancelRide}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'fares' && (
        <div className="max-w-2xl bg-white border border-zinc-200 rounded-3xl p-6">
          <h2 className="text-lg font-bold text-zinc-950 mb-1">{t.fareConfigTitle}</h2>
          <p className="text-xs text-zinc-500 mb-5">
            Synced live to settings/fares and enforced by Firestore Security Rules.
          </p>

          <form onSubmit={handleSaveFares} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  {t.modeBustandRateLabel}
                </label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={modeBustandPerPerson}
                  onChange={(e) => setModeBustandPerPerson(Number(e.target.value))}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 font-mono text-sm text-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  {t.standardFareRateLabel}
                </label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={standardFare}
                  onChange={(e) => setStandardFare(Number(e.target.value))}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 font-mono text-sm text-zinc-950"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-100 text-xs text-zinc-700 space-y-1">
              <p className="font-semibold text-zinc-950">Active AusaRides Fare Preview:</p>
              <p className="font-mono">
                AUSA Bustand ↔ AUSA Mode: ₹{modeBustandPerPerson} × passengers
              </p>
              <p className="font-mono">
                Any other location from AUSA Mode / Bustand: ₹{standardFare} fixed
              </p>
            </div>

            {faresNotice && (
              <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-xs font-medium text-zinc-950">
                {faresNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={savingFares}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-zinc-950 text-yellow-400 font-bold text-sm hover:bg-zinc-800 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{t.saveFareRates}</span>
            </button>
          </form>
        </div>
      )}

      <nav
        aria-label="Admin navigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 grid grid-cols-4 h-16 pb-safe"
      >
        <button
          type="button"
          onClick={() => setTab('drivers')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'drivers' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Car className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">{t.adminTabDrivers}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'users' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">{t.adminTabUsers}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('rides')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'rides' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">{t.adminTabRides}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('fares')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            tab === 'fares' ? 'text-yellow-400' : 'text-zinc-400'
          }`}
        >
          <IndianRupee className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">{t.adminTabFares}</span>
        </button>
      </nav>
    </div>
  );
};
