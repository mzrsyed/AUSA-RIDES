import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { BookOpen, Languages, LogOut, Mail, Shield } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { DriverDashboard } from './components/DriverDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InfoModal, InfoSection } from './components/InfoModal';
import { OnboardingProfile } from './components/OnboardingProfile';
import { RiderDashboard } from './components/RiderDashboard';
import { useT } from './i18n/translations';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { Lang, UserProfile, ViewMode } from './types';
import { isAdminEmail } from './utils/sanitize';

function AusaRidesApp() {
  const [lang, setLang] = useState<Lang>('en');
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authTick, setAuthTick] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [devViewMode, setDevViewMode] = useState<ViewMode>('admin');
  const [infoSection, setInfoSection] = useState<InfoSection | null>(null);

  const t = useT(lang);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
      }
    });
    return unsub;
  }, []);

  const refreshVerification = useCallback(async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      setFirebaseUser(auth.currentUser);
      setAuthTick((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const userPath = `users/${firebaseUser.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    );
    return unsub;
  }, [firebaseUser?.uid, firebaseUser?.emailVerified, authTick]);

  const isSuperAdmin = Boolean(
    firebaseUser?.emailVerified && isAdminEmail(firebaseUser.email)
  );

  const activeView: ViewMode = isSuperAdmin
    ? devViewMode
    : profile?.role === 'driver'
    ? 'driver'
    : 'rider';

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-950 flex flex-col">
      {/* Compact High-Contrast Top Bar */}
      <header className="sticky top-0 z-40 h-14 bg-zinc-950 text-white border-b border-zinc-800">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0"
          >
            {lang === 'mr' ? (
              <>
                औसा <span className="text-yellow-400">राइड्स</span>
              </>
            ) : (
              <>
                Ausa<span className="text-yellow-400">Rides</span>
              </>
            )}
          </a>

          {/* Zone 2: Separate Info / Instructions Buttons */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-300">
            <button
              type="button"
              onClick={() => setInfoSection('guide')}
              className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navGuide}
            </button>
            <button
              type="button"
              onClick={() => setInfoSection('fares')}
              className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navFares}
            </button>
            <button
              type="button"
              onClick={() => setInfoSection('safety')}
              className="hover:text-yellow-400 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navSafety}
            </button>
            {firebaseUser && profile && (
              <span className="text-zinc-400 pl-2 border-l border-zinc-800 whitespace-nowrap">
                {profile.fullName}
              </span>
            )}
          </nav>

          {/* Zone 3: Mobile Info Button + Language Switcher + Primary Account Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setInfoSection('guide')}
              aria-label={t.navGuide}
              className="md:hidden min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-yellow-400 flex items-center justify-center transition-colors shrink-0"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'mr' : 'en'))}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-yellow-400 text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{t.langSwitch}</span>
            </button>

            {firebaseUser && (
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-yellow-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 hover:bg-yellow-300 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.signOut}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Secure Admin-Only Dev/Test Mode Switcher (mzrsyed@gmail.com only) */}
      {isSuperAdmin && profile && (
        <div className="bg-zinc-900 text-white border-b border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-yellow-400">
              <Shield className="w-4 h-4" />
              <span>{t.devModeLabel}</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl">
              {(['admin', 'rider', 'driver'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDevViewMode(mode)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    devViewMode === mode
                      ? 'bg-yellow-400 text-zinc-950'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {mode === 'admin'
                    ? t.modeAdmin
                    : mode === 'rider'
                    ? t.modeRider
                    : t.modeDriver}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="top" className="flex-1">
        {!authReady || profileLoading ? (
          <div className="max-w-md mx-auto px-4 py-20 text-center">
            <div className="w-10 h-10 border-4 border-zinc-950 border-t-yellow-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-600">Connecting to AusaRides...</p>
          </div>
        ) : !firebaseUser ? (
          <AuthScreen
            lang={lang}
            unverifiedUser={null}
            onVerificationRefresh={refreshVerification}
            onOpenInfo={setInfoSection}
          />
        ) : !firebaseUser.emailVerified ? (
          <AuthScreen
            lang={lang}
            unverifiedUser={firebaseUser}
            onVerificationRefresh={refreshVerification}
            onOpenInfo={setInfoSection}
          />
        ) : !profile ? (
          <OnboardingProfile firebaseUser={firebaseUser} lang={lang} />
        ) : activeView === 'admin' && isSuperAdmin ? (
          <AdminDashboard profile={profile} lang={lang} />
        ) : activeView === 'driver' ? (
          <DriverDashboard
            profile={profile}
            lang={lang}
            isAdminPreview={isSuperAdmin}
          />
        ) : (
          <RiderDashboard
            profile={profile}
            lang={lang}
            isAdminPreview={isSuperAdmin}
          />
        )}
      </main>

      {/* Clean Website Footer with Developer Credits & Contact */}
      <footer className="bg-zinc-950 text-zinc-400 border-t border-zinc-800 pb-20 sm:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div>
            <p className="text-sm font-bold text-white">
              {lang === 'mr' ? 'औसा राइड्स' : 'AusaRides'}
            </p>
            <p className="mt-0.5 text-zinc-400">{t.footerTagline}</p>
          </div>

          <div className="sm:text-right space-y-1">
            <p className="font-semibold text-zinc-200">{t.developedBy}</p>
            <p className="flex sm:justify-end items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span>{t.contactLabel}:</span>
              <a
                href={`mailto:${t.developerEmail}`}
                className="font-mono text-yellow-400 hover:underline"
              >
                {t.developerEmail}
              </a>
            </p>
          </div>
        </div>
      </footer>

      <InfoModal
        section={infoSection}
        lang={lang}
        onSelectSection={setInfoSection}
        onClose={() => setInfoSection(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AusaRidesApp />
    </ErrorBoundary>
  );
}
