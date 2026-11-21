import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Car, Shield, UserCheck } from 'lucide-react';
import { db, OperationType, reportFirestoreError } from '../lib/firebase';
import {
  isAdminEmail,
  normalizeIndianPhone,
  normalizeLicenseNumber,
  normalizeVehiclePlate,
  sanitizeText,
} from '../utils/sanitize';
import { Lang, UserRole } from '../types';
import { useT } from '../i18n/translations';

interface OnboardingProfileProps {
  firebaseUser: User;
  lang: Lang;
}

export const OnboardingProfile: React.FC<OnboardingProfileProps> = ({ firebaseUser, lang }) => {
  const t = useT(lang);
  const adminAccount = isAdminEmail(firebaseUser.email);

  const [role, setRole] = useState<UserRole>(adminAccount ? 'admin' : 'rider');
  const [fullName, setFullName] = useState(
    sanitizeText(firebaseUser.displayName || (adminAccount ? 'AusaRides Admin' : ''), 80)
  );
  const [phoneInput, setPhoneInput] = useState('');
  const [vehicleInput, setVehicleInput] = useState(adminAccount ? 'MH-24-AU-0001' : '');
  const [licenseInput, setLicenseInput] = useState(adminAccount ? 'MH24-ADMIN-0001' : '');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = sanitizeText(fullName, 80);
    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    const normalizedPhone = normalizeIndianPhone(phoneInput);
    if (!normalizedPhone) {
      setErrorMsg('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    let vehicleNumber = '';
    let licenseNumber = '';

    if (role === 'driver') {
      const normalizedPlate = normalizeVehiclePlate(vehicleInput);
      if (!normalizedPlate) {
        setErrorMsg('Auto plate must be a valid Latur/Ausa RTO number (e.g. MH-24-AB-1234).');
        return;
      }
      const normalizedLic = normalizeLicenseNumber(licenseInput);
      if (!normalizedLic) {
        setErrorMsg('Enter a valid Driving License number (min 8 alphanumeric characters).');
        return;
      }
      vehicleNumber = normalizedPlate;
      licenseNumber = normalizedLic;
    } else if (adminAccount) {
      vehicleNumber = normalizeVehiclePlate(vehicleInput) || 'MH-24-AU-0001';
      licenseNumber = normalizeLicenseNumber(licenseInput) || 'MH24-ADMIN-0001';
    }

    const assignedRole: UserRole = adminAccount ? 'admin' : role === 'driver' ? 'driver' : 'rider';
    const accountStatus =
      assignedRole === 'driver' ? 'pending_verification' : 'approved';

    const cleanEmail = sanitizeText(firebaseUser.email || '', 120);
    const userPath = `users/${firebaseUser.uid}`;

    setSaving(true);
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        fullName: cleanName,
        email: cleanEmail,
        phone: normalizedPhone,
        role: assignedRole,
        accountStatus,
        vehicleNumber,
        licenseNumber,
        isOnline: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      reportFirestoreError(err, OperationType.CREATE, userPath);
      setErrorMsg('Could not save your profile. Please verify your details and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-950">{t.setupTitle}</h1>
          <p className="text-sm text-zinc-600 mt-1">{t.setupSubtitle}</p>
        </div>

        {adminAccount ? (
          <div className="mb-6 p-4 rounded-2xl bg-zinc-950 text-white flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-400">Super Admin Account Detected</p>
              <p className="text-xs text-zinc-300 mt-0.5">
                {firebaseUser.email} is verified for full AusaRides Admin privileges plus Rider & Driver preview modes.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('rider')}
              className={`text-left p-4 rounded-2xl border-2 transition-all min-h-[88px] ${
                role === 'rider'
                  ? 'border-zinc-950 bg-yellow-50'
                  : 'border-zinc-200 bg-white hover:border-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-950">
                <UserCheck className="w-4 h-4" />
                <span>{t.roleRider}</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{t.roleRiderDesc}</p>
            </button>

            <button
              type="button"
              onClick={() => setRole('driver')}
              className={`text-left p-4 rounded-2xl border-2 transition-all min-h-[88px] ${
                role === 'driver'
                  ? 'border-zinc-950 bg-yellow-50'
                  : 'border-zinc-200 bg-white hover:border-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-950">
                <Car className="w-4 h-4" />
                <span>{t.roleDriver}</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{t.roleDriverDesc}</p>
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              {t.fullNameLabel}
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Deshmukh"
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              {t.phoneLabel}
            </label>
            <div className="flex items-center">
              <span className="min-h-[46px] px-3.5 flex items-center bg-zinc-950 text-yellow-400 font-mono text-sm font-semibold rounded-l-xl border border-zinc-950">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                required
                maxLength={14}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="9876543210"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-r-xl border border-l-0 border-zinc-300 bg-stone-50 font-mono text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
              />
            </div>
          </div>

          {role === 'driver' && !adminAccount && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  {t.vehicleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={vehicleInput}
                  onChange={(e) => setVehicleInput(e.target.value.toUpperCase())}
                  placeholder="MH-24-AB-1234"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 font-mono text-sm uppercase text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                />
                <p className="text-[11px] text-zinc-500 mt-1">{t.vehicleHint}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  {t.licenseLabel}
                </label>
                <input
                  type="text"
                  required
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                  placeholder="MH24-20190012345"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 font-mono text-sm uppercase text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                />
                <p className="text-[11px] text-zinc-500 mt-1">{t.licenseHint}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[48px] mt-2 px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-yellow-400 font-bold text-sm transition-colors disabled:opacity-50"
          >
            {saving ? '...' : t.btnSaveProfile}
          </button>
        </form>
      </div>
    </div>
  );
};
