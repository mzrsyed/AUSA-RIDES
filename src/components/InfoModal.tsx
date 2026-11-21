import React from 'react';
import { BookOpen, MapPin, ShieldCheck, X } from 'lucide-react';
import { AUSA_LANDMARKS } from '../data/ausaLandmarks';
import { useT } from '../i18n/translations';
import { Lang } from '../types';

export type InfoSection = 'guide' | 'fares' | 'safety';

interface InfoModalProps {
  section: InfoSection | null;
  lang: Lang;
  onSelectSection: (section: InfoSection) => void;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  section,
  lang,
  onSelectSection,
  onClose,
}) => {
  const t = useT(lang);
  if (!section) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header + Tabs */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onSelectSection('guide')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                section === 'guide'
                  ? 'bg-zinc-950 text-yellow-400'
                  : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.navGuide}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('fares')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                section === 'fares'
                  ? 'bg-zinc-950 text-yellow-400'
                  : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t.navFares}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('safety')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                section === 'safety'
                  ? 'bg-zinc-950 text-yellow-400'
                  : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.navSafety}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-stone-100 text-zinc-700 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {section === 'guide' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-zinc-950">{t.guideTitle}</h2>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-zinc-200">
                  <p className="text-xs font-bold text-zinc-950 mb-1.5">{t.roleRider}</p>
                  <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed">
                    {t.guideRiderSteps}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-stone-50 border border-zinc-200">
                  <p className="text-xs font-bold text-zinc-950 mb-1.5">{t.roleDriver}</p>
                  <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed">
                    {t.guideDriverSteps}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-950 text-white">
                  <p className="text-xs font-bold text-yellow-400 mb-1">{t.adminLoginTab}</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{t.guideAdminSteps}</p>
                </div>
              </div>
            </div>
          )}

          {section === 'fares' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-zinc-950">{t.stopsFaresTitle}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-yellow-400 text-zinc-950">
                  <p className="text-xs font-bold">{t.modeBustandRuleDesc}</p>
                  <p className="text-2xl font-mono font-extrabold mt-1">₹10 / person</p>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-950 text-white">
                  <p className="text-xs font-bold text-yellow-400">{t.standardRuleDesc}</p>
                  <p className="text-2xl font-mono font-extrabold mt-1">₹50</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {AUSA_LANDMARKS.map((lm, i) => (
                  <div
                    key={lm.id}
                    className="px-3.5 py-2.5 rounded-xl bg-stone-50 border border-zinc-200 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-zinc-950">
                      {i + 1}. {lang === 'mr' ? lm.nameMr : lm.nameEn}
                    </span>
                    <span className="text-zinc-500">{lang === 'mr' ? lm.tagMr : lm.tagEn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'safety' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-zinc-950">{t.safetyTitle}</h2>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-zinc-200">
                  <p className="text-sm font-bold text-zinc-950">{t.safetyPoint1Title}</p>
                  <p className="text-xs text-zinc-600 mt-1">{t.safetyPoint1Desc}</p>
                </div>
                <div className="p-4 rounded-2xl bg-stone-50 border border-zinc-200">
                  <p className="text-sm font-bold text-zinc-950">{t.safetyPoint2Title}</p>
                  <p className="text-xs text-zinc-600 mt-1">{t.safetyPoint2Desc}</p>
                </div>
                <div className="p-4 rounded-2xl bg-stone-50 border border-zinc-200">
                  <p className="text-sm font-bold text-zinc-950">{t.safetyPoint3Title}</p>
                  <p className="text-xs text-zinc-600 mt-1">{t.safetyPoint3Desc}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
