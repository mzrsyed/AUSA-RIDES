import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  ArrowRight,
  Car,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AUSA_LANDMARKS } from '../data/ausaLandmarks';
import { useT } from '../i18n/translations';
import { auth, googleProvider } from '../lib/firebase';
import { Lang } from '../types';
import { ADMIN_EMAIL, isAdminEmail } from '../utils/sanitize';

interface AuthScreenProps {
  lang: Lang;
  unverifiedUser: User | null;
  onVerificationRefresh: () => Promise<void>;
}

function formatAuthError(err: unknown, emailDisabledMsg: string): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/operation-not-allowed') {
    return emailDisabledMsg;
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect email or password. Please check and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Switch to Sign In.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return err instanceof Error ? err.message : 'Authentication failed.';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  lang,
  unverifiedUser,
  onVerificationRefresh,
}) => {
  const t = useT(lang);
  const [portal, setPortal] = useState<'user' | 'admin'>('user');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState(ADMIN_EMAIL);
  const [adminPassword, setAdminPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const handlePortalSwitch = (nextPortal: 'user' | 'admin') => {
    setPortal(nextPortal);
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = formatAuthError(err, t.adminEmailDisabledNote);
      if (msg) setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setErrorMsg('Enter a valid email and a password of at least 6 characters.');
      setBusy(false);
      return;
    }

    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await sendEmailVerification(cred.user);
        setInfoMsg(t.verifyEmailDesc);
      }
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err, t.adminEmailDisabledNote));
    } finally {
      setBusy(false);
    }
  };

  const handleAdminEmailAuth = async (action: 'signin' | 'register') => {
    setBusy(true);
    setErrorMsg('');
    setInfoMsg('');

    const trimmedEmail = adminEmail.trim().toLowerCase();
    if (!isAdminEmail(trimmedEmail)) {
      setErrorMsg(`Admin login is restricted strictly to ${ADMIN_EMAIL}.`);
      setBusy(false);
      return;
    }
    if (adminPassword.length < 6) {
      setErrorMsg('Enter your admin password (at least 6 characters).');
      setBusy(false);
      return;
    }

    try {
      if (action === 'signin') {
        await signInWithEmailAndPassword(auth, trimmedEmail, adminPassword);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, adminPassword);
        await sendEmailVerification(cred.user);
        setInfoMsg(t.verifyEmailDesc);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setErrorMsg(
          'Admin email/password account not found or password incorrect. If first time using Email/Password, click "First-Time: Register Admin Email/Password" or use "Sign in with Google".'
        );
      } else {
        setErrorMsg(formatAuthError(err, t.adminEmailDisabledNote));
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (targetEmail: string) => {
    const trimmedEmail = targetEmail.trim();
    if (!trimmedEmail) {
      setErrorMsg('Enter your email address above first.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setInfoMsg(t.resetSent);
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err, t.adminEmailDisabledNote));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await sendEmailVerification(unverifiedUser);
      setInfoMsg(t.verifyResent);
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err, t.adminEmailDisabledNote));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!unverifiedUser) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await reload(unverifiedUser);
      await onVerificationRefresh();
      if (!auth.currentUser?.emailVerified) {
        setErrorMsg('Email is still unverified. Click the link sent to your inbox first.');
      }
    } catch (err: unknown) {
      setErrorMsg(formatAuthError(err, t.adminEmailDisabledNote));
    } finally {
      setBusy(false);
    }
  };

  if (unverifiedUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-zinc-950 mb-2">{t.verifyEmailTitle}</h1>
          <p className="text-sm text-zinc-600 mb-4 leading-relaxed">{t.verifyEmailDesc}</p>
          <p className="text-xs font-mono text-zinc-700 bg-stone-100 rounded-lg px-3 py-2 mb-5">
            {unverifiedUser.email}
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-xs text-zinc-900">
              {infoMsg}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleCheckVerified}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-zinc-950 text-yellow-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.btnCheckVerified}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleResendVerification}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-300 text-zinc-900 font-medium text-sm hover:bg-stone-100 transition-colors disabled:opacity-50"
            >
              {t.btnResendVerify}
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full min-h-[44px] px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-950"
            >
              {t.signOut}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-14">
      {/* Top Split: Hero Showcase + Dual-Portal Auth Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between bg-zinc-950 text-white rounded-3xl overflow-hidden border border-zinc-800">
          <div className="relative h-56 sm:h-72 lg:h-80 w-full bg-zinc-900 overflow-hidden">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/ausa_auto_hero_1795116124865.jpg"
                alt="Black and yellow auto-rickshaw near Bhuikot Fort in Ausa, Maharashtra"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-yellow-950 flex items-center justify-center">
                <MapPin className="w-12 h-12 text-yellow-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <p className="text-xs font-medium text-yellow-400 mb-1">{t.heroKicker}</p>
              <h1
                className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {t.heroTitle}
              </h1>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col justify-between flex-1 gap-6">
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl">
              {t.heroSubtitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
              <div>
                <p className="text-xs text-zinc-400">Coverage</p>
                <p className="text-sm font-semibold text-white mt-0.5">11 Ausa Landmarks</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Trip Security</p>
                <p className="text-sm font-semibold text-yellow-400 mt-0.5">4-Digit Pickup PIN</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Fleet Verification</p>
                <p className="text-sm font-semibold text-white mt-0.5">MH-24 RTO Checked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Auth Card */}
        <div
          id="auth-panel"
          className="lg:col-span-5 bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-center shadow-sm"
        >
          <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-950 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handlePortalSwitch('user')}
              className={`min-h-[42px] px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                portal === 'user'
                  ? 'bg-yellow-400 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.riderDriverTab}</span>
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch('admin')}
              className={`min-h-[42px] px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                portal === 'admin'
                  ? 'bg-yellow-400 text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t.adminLoginTab}</span>
            </button>
          </div>

          {portal === 'user' ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-950">
                    {mode === 'signin' ? t.tabSignIn : t.tabSignUp}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.cityTag}</p>
                </div>
                <ShieldCheck className="w-6 h-6 text-zinc-950" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] text-zinc-950 font-bold text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.38-1.46 4.05-5.27 4.05-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.8 3.92 14.7 3 12.18 3 7.11 3 3 7.11 3 12.18s4.11 9.18 9.18 9.18c5.3 0 8.81-3.72 8.81-8.97 0-.6-.07-1.06-.16-1.29z"
                  />
                </svg>
                <span>{t.signInGoogle}</span>
              </button>

              <div className="relative my-5 flex items-center">
                <div className="flex-grow border-t border-zinc-200" />
                <span className="px-3 text-xs text-zinc-500">{t.orEmail}</span>
                <div className="flex-grow border-t border-zinc-200" />
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className={`min-h-[40px] text-xs font-semibold rounded-lg transition-colors ${
                    mode === 'signin'
                      ? 'bg-zinc-950 text-yellow-400'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {t.tabSignIn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className={`min-h-[40px] text-xs font-semibold rounded-lg transition-colors ${
                    mode === 'signup'
                      ? 'bg-zinc-950 text-yellow-400'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {t.tabSignUp}
                </button>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {errorMsg}
                </div>
              )}
              {infoMsg && (
                <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-xs text-zinc-900">
                  {infoMsg}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    {t.emailLabel}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      {t.passwordLabel}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => handlePasswordReset(email)}
                        className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline"
                      >
                        {t.forgotPassword}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                    />
                    <KeyRound className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <span>{mode === 'signin' ? t.btnSignIn : t.btnSignUp}</span>
                  <ArrowRight className="w-4 h-4 text-yellow-400" />
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-zinc-950">{t.adminLoginTitle}</h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{t.adminLoginDesc}</p>
                </div>
                <Lock className="w-6 h-6 text-zinc-950 shrink-0" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] text-zinc-950 font-bold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                <span>{t.adminGoogleBtn}</span>
              </button>

              <div className="relative my-2 flex items-center">
                <div className="flex-grow border-t border-zinc-200" />
                <span className="px-3 text-xs text-zinc-500">{t.orEmail}</span>
                <div className="flex-grow border-t border-zinc-200" />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                  {errorMsg}
                </div>
              )}
              {infoMsg && (
                <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-300 text-xs text-zinc-900 leading-relaxed">
                  {infoMsg}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAdminEmailAuth('signin');
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Admin {t.emailLabel}
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 font-mono text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      {t.passwordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePasswordReset(adminEmail)}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline"
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-stone-50 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-yellow-400 font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <span>{t.adminEmailBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAdminEmailAuth('register')}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-zinc-300 text-zinc-800 hover:bg-stone-100 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {t.adminRegisterEmailBtn}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Ausa Stops & Local Landmarks Directory */}
      <section id="landmarks" aria-labelledby="landmarks-heading" className="pt-8 border-t border-zinc-200">
        <div className="max-w-3xl mb-6">
          <h2
            id="landmarks-heading"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950"
            style={{ textWrap: 'balance' }}
          >
            {t.landmarksSectionHeading}
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 mt-2 leading-relaxed">
            {t.landmarksSectionSub}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AUSA_LANDMARKS.map((lm) => (
            <div
              key={lm.id}
              className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-sm font-bold text-zinc-950">
                  {lang === 'mr' ? lm.nameMr : lm.nameEn}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {lang === 'mr' ? lm.tagMr : lm.tagEn}
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono">
                    {lm.lat.toFixed(4)}° N, {lm.lng.toFixed(4)}° E
                  </span>
                </p>
              </div>
              <MapPin className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Platform Features Explained by Role & Section */}
      <section id="features" aria-labelledby="features-heading" className="pt-8 border-t border-zinc-200">
        <div className="max-w-3xl mb-8">
          <h2
            id="features-heading"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950"
            style={{ textWrap: 'balance' }}
          >
            {t.featuresSectionHeading}
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 mt-2 leading-relaxed">
            {t.featuresSectionSub}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-2.5">
            <div className="flex items-center gap-2.5 text-zinc-950">
              <MapPin className="w-5 h-5 text-yellow-600 shrink-0" />
              <h3 className="text-base font-bold">{t.featRiderTitle}</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">{t.featRiderBody}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-2.5">
            <div className="flex items-center gap-2.5 text-zinc-950">
              <Car className="w-5 h-5 text-yellow-600 shrink-0" />
              <h3 className="text-base font-bold">{t.featDriverTitle}</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">{t.featDriverBody}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-2.5">
            <div className="flex items-center gap-2.5 text-zinc-950">
              <Shield className="w-5 h-5 text-yellow-600 shrink-0" />
              <h3 className="text-base font-bold">{t.featAdminTitle}</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">{t.featAdminBody}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-2.5">
            <div className="flex items-center gap-2.5 text-zinc-950">
              <ShieldCheck className="w-5 h-5 text-yellow-600 shrink-0" />
              <h3 className="text-base font-bold">{t.featSecurityTitle}</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">{t.featSecurityBody}</p>
          </div>
        </div>
      </section>

      {/* Section 3: Security & Trust Guarantees */}
      <section
        id="safety"
        aria-labelledby="safety-heading"
        className="bg-zinc-950 text-white rounded-3xl p-6 sm:p-8 border border-zinc-800"
      >
        <h2 id="safety-heading" className="text-xl sm:text-2xl font-extrabold mb-6">
          {t.safetySectionHeading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-yellow-400">{t.safetyPoint1Title}</p>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {t.safetyPoint1Desc}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-yellow-400">{t.safetyPoint2Title}</p>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {t.safetyPoint2Desc}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-yellow-400">{t.safetyPoint3Title}</p>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {t.safetyPoint3Desc}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
