import { FareSettings } from '../types';

export interface AusaLandmark {
  id: string;
  nameEn: string;
  nameMr: string;
  zone: 'inner' | 'outer';
  lat: number;
  lng: number;
  tagEn: string;
  tagMr: string;
}

// Centered on Ausa, Latur District, Maharashtra (18.2500° N, 76.5000° E)
export const AUSA_CENTER = {
  lat: 18.2500,
  lng: 76.5000,
};

export const DEFAULT_FARE_SETTINGS: Omit<FareSettings, 'updatedAt' | 'updatedBy'> = {
  baseFare: 20,
  perKmRate: 15,
  minFare: 20,
  outerAreaSurcharge: 10,
};

export const AUSA_LANDMARKS: AusaLandmark[] = [
  {
    id: 'st_bus_stand',
    nameEn: 'Ausa ST Bus Stand',
    nameMr: 'औसा एस.टी. बस स्थानक',
    zone: 'inner',
    lat: 18.2485,
    lng: 76.5015,
    tagEn: 'Transit Hub',
    tagMr: 'बस स्थानक',
  },
  {
    id: 'ausa_fort',
    nameEn: 'Ausa Fort (Bhuikot Killa)',
    nameMr: 'औसा किल्ला (भुईकोट किल्ला)',
    zone: 'inner',
    lat: 18.2462,
    lng: 76.4978,
    tagEn: 'Heritage',
    tagMr: 'ऐतिहासिक किल्ला',
  },
  {
    id: 'main_market',
    nameEn: 'Main Market (Subhash Chowk)',
    nameMr: 'मुख्य बाजार (सुभाष चौक)',
    zone: 'inner',
    lat: 18.2504,
    lng: 76.5002,
    tagEn: 'Market Center',
    tagMr: 'बाजारपेठ',
  },
  {
    id: 'shivaji_chowk',
    nameEn: 'Shivaji Chowk',
    nameMr: 'शिवाजी चौक',
    zone: 'inner',
    lat: 18.2496,
    lng: 76.4990,
    tagEn: 'Central Square',
    tagMr: 'मुख्य चौक',
  },
  {
    id: 'tehsil_office',
    nameEn: 'Tehsil Office',
    nameMr: 'तहसील कार्यालय',
    zone: 'inner',
    lat: 18.2520,
    lng: 76.4982,
    tagEn: 'Government',
    tagMr: 'सरकारी कार्यालय',
  },
  {
    id: 'rural_hospital',
    nameEn: 'Rural Hospital Ausa',
    nameMr: 'ग्रामीण रुग्णालय औसा',
    zone: 'inner',
    lat: 18.2535,
    lng: 76.5038,
    tagEn: 'Medical',
    tagMr: 'रुग्णालय',
  },
  {
    id: 'siddheshwar_temple',
    nameEn: 'Siddheshwar Temple',
    nameMr: 'सिद्धेश्वर मंदिर',
    zone: 'inner',
    lat: 18.2450,
    lng: 76.5055,
    tagEn: 'Temple',
    tagMr: 'मंदिर परिसर',
  },
  {
    id: 'latur_road_naka',
    nameEn: 'Latur Road Naka',
    nameMr: 'लातूर रोड नाका',
    zone: 'outer',
    lat: 18.2598,
    lng: 76.5042,
    tagEn: 'Outer Naka',
    tagMr: 'लातूर महामार्ग',
  },
  {
    id: 'killari_road',
    nameEn: 'Killari Road',
    nameMr: 'किल्लारी रोड',
    zone: 'outer',
    lat: 18.2420,
    lng: 76.5128,
    tagEn: 'Outer Road',
    tagMr: 'बाह्य रस्ता',
  },
  {
    id: 'nilanga_road',
    nameEn: 'Nilanga Road',
    nameMr: 'निलंगा रोड',
    zone: 'outer',
    lat: 18.2412,
    lng: 76.4905,
    tagEn: 'Outer Road',
    tagMr: 'बाह्य रस्ता',
  },
  {
    id: 'budhoda_naka',
    nameEn: 'Budhoda Naka',
    nameMr: 'बुधोडा नाका',
    zone: 'outer',
    lat: 18.2582,
    lng: 76.4910,
    tagEn: 'Outer Naka',
    tagMr: 'नाका परिसर',
  },
];

export const LANDMARK_BY_ID = new Map<string, AusaLandmark>(
  AUSA_LANDMARKS.map((lm) => [lm.id, lm])
);

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calculateAusaDistanceKm(
  pickup: AusaLandmark,
  dropoff: AusaLandmark,
  hasCustomPickup: boolean,
  hasCustomDropoff: boolean
): number {
  if (pickup.id === dropoff.id) {
    // Same zone local colony short hop
    return hasCustomPickup || hasCustomDropoff ? 0.8 : 0.5;
  }

  const R = 6371;
  const dLat = toRad(dropoff.lat - pickup.lat);
  const dLng = toRad(dropoff.lng - pickup.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(pickup.lat)) *
      Math.cos(toRad(dropoff.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  // Road winding factor for Ausa local streets + small colony offset
  const colonyOffset = (hasCustomPickup ? 0.2 : 0) + (hasCustomDropoff ? 0.2 : 0);
  const roadKm = straightKm * 1.32 + colonyOffset;
  return Math.min(25, Math.max(0.5, Math.round(roadKm * 10) / 10));
}

export function calculateAusaFare(
  pickup: AusaLandmark,
  dropoff: AusaLandmark,
  distanceKm: number,
  settings: Pick<FareSettings, 'baseFare' | 'perKmRate' | 'minFare' | 'outerAreaSurcharge'>
): {
  fareInr: number;
  baseFareUsed: number;
  perKmUsed: number;
  locationSurchargeUsed: number;
} {
  const isOuter = pickup.zone === 'outer' || dropoff.zone === 'outer';
  const locationSurchargeUsed = isOuter ? settings.outerAreaSurcharge : 0;
  const raw = settings.baseFare + distanceKm * settings.perKmRate + locationSurchargeUsed;
  const fareInr = Math.max(settings.minFare, Math.round(raw));

  return {
    fareInr,
    baseFareUsed: settings.baseFare,
    perKmUsed: settings.perKmRate,
    locationSurchargeUsed,
  };
}
