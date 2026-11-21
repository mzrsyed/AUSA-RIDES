import { FareSettings, Lang } from '../types';

export interface AusaLandmark {
  id: string;
  nameEn: string;
  nameMr: string;
  zone: 'hub' | 'town';
  lat: number;
  lng: number;
  tagEn: string;
  tagMr: string;
}

export interface AusaPoint {
  id: string;
  nameEn: string;
  nameMr: string;
  lat: number;
  lng: number;
  isCustom?: boolean;
}

export interface OfflineDirectionStep {
  stepNumber: number;
  instructionEn: string;
  instructionMr: string;
  distanceKm: number;
}

export interface OfflineDirectionsResult {
  pathPoints: Array<{ lat: number; lng: number; nameEn: string; nameMr: string }>;
  steps: OfflineDirectionStep[];
  totalKm: number;
  etaMins: number;
  compassEn: string;
  compassMr: string;
}

// Centered on Ausa, Latur District, Maharashtra (18.2500° N, 76.5000° E)
export const AUSA_CENTER = {
  lat: 18.2500,
  lng: 76.5000,
};

export const AUSA_BOUNDS = {
  minLat: 18.2400,
  maxLat: 18.2600,
  minLng: 76.4910,
  maxLng: 76.5115,
};

export const DEFAULT_FARE_SETTINGS: Omit<FareSettings, 'updatedAt' | 'updatedBy'> = {
  modeBustandPerPerson: 10,
  standardFare: 50,
};

export const AUSA_LANDMARKS: AusaLandmark[] = [
  {
    id: 'ausa_mode',
    nameEn: 'AUSA Mode',
    nameMr: 'औसा मोड',
    zone: 'hub',
    lat: 18.2568,
    lng: 76.5028,
    tagEn: 'Main Junction',
    tagMr: 'मुख्य जंक्शन',
  },
  {
    id: 'ausa_bustand',
    nameEn: 'AUSA Bustand',
    nameMr: 'औसा बस स्टँड',
    zone: 'hub',
    lat: 18.2486,
    lng: 76.5016,
    tagEn: 'Bus Stand',
    tagMr: 'बस स्थानक',
  },
  {
    id: 'ausa_fort',
    nameEn: 'AUSA Fort (Killa)',
    nameMr: 'औसा किल्ला',
    zone: 'town',
    lat: 18.2458,
    lng: 76.4974,
    tagEn: 'Killa',
    tagMr: 'किल्ला परिसर',
  },
  {
    id: 'tehsil',
    nameEn: 'Tehsil',
    nameMr: 'तहसील कार्यालय',
    zone: 'town',
    lat: 18.2520,
    lng: 76.4982,
    tagEn: 'Office',
    tagMr: 'सरकारी कार्यालय',
  },
  {
    id: 'court',
    nameEn: 'Court',
    nameMr: 'न्यायालय (कोर्ट)',
    zone: 'town',
    lat: 18.2529,
    lng: 76.4968,
    tagEn: 'Court',
    tagMr: 'न्यायालय',
  },
  {
    id: 'new_bustand',
    nameEn: 'New Bustand',
    nameMr: 'नवीन बस स्टँड',
    zone: 'town',
    lat: 18.2554,
    lng: 76.5056,
    tagEn: 'New Stand',
    tagMr: 'नवीन बस स्टँड',
  },
  {
    id: 'tuljapur_mode',
    nameEn: 'Tuljapur Mode (Patel Chowk)',
    nameMr: 'तुळजापूर मोड (पटेल चौक)',
    zone: 'town',
    lat: 18.2435,
    lng: 76.4932,
    tagEn: 'Patel Chowk',
    tagMr: 'पटेल चौक',
  },
  {
    id: 'akanksha_hospital',
    nameEn: 'Akanksha Hospital',
    nameMr: 'आकांक्षा हॉस्पिटल',
    zone: 'town',
    lat: 18.2542,
    lng: 76.5036,
    tagEn: 'Hospital',
    tagMr: 'रुग्णालय',
  },
  {
    id: 'holkar_nagar',
    nameEn: 'Holkar Nagar',
    nameMr: 'होळकर नगर',
    zone: 'town',
    lat: 18.2576,
    lng: 76.4945,
    tagEn: 'Colony',
    tagMr: 'नगर',
  },
  {
    id: 'bilal_nagar',
    nameEn: 'Bilal Nagar',
    nameMr: 'बिलाल नगर',
    zone: 'town',
    lat: 18.2442,
    lng: 76.5062,
    tagEn: 'Colony',
    tagMr: 'नगर',
  },
  {
    id: 'katghar_galli',
    nameEn: 'Katghar Galli',
    nameMr: 'कटघर गल्ली',
    zone: 'town',
    lat: 18.2494,
    lng: 76.4995,
    tagEn: 'Old Town',
    tagMr: 'गल्ली',
  },
  {
    id: 'kalan_galli',
    nameEn: 'Kalan Galli',
    nameMr: 'कलां गल्ली',
    zone: 'town',
    lat: 18.2478,
    lng: 76.4998,
    tagEn: 'Old Town',
    tagMr: 'गल्ली',
  },
  {
    id: 'azeem_college',
    nameEn: 'Azeem College',
    nameMr: 'अझीम कॉलेज',
    zone: 'town',
    lat: 18.2422,
    lng: 76.5092,
    tagEn: 'College',
    tagMr: 'महाविद्यालय',
  },
  {
    id: 'police_station',
    nameEn: 'Police Station',
    nameMr: 'पोलीस स्टेशन',
    zone: 'town',
    lat: 18.2508,
    lng: 76.4962,
    tagEn: 'Police Station',
    tagMr: 'पोलीस स्टेशन',
  },
];

export const LANDMARK_BY_ID = new Map<string, AusaLandmark>(
  AUSA_LANDMARKS.map((lm) => [lm.id, lm])
);

// Named road corridors rendered on the offline Ausa map
export interface AusaRoadCorridor {
  id: string;
  labelEn: string;
  labelMr: string;
  points: Array<[number, number]>; // [lat, lng]
  major?: boolean;
}

export const AUSA_ROAD_CORRIDORS: AusaRoadCorridor[] = [
  {
    id: 'latur_road',
    labelEn: 'NH-361A Latur Rd',
    labelMr: 'लातूर रोड',
    major: true,
    points: [
      [18.2592, 76.5042],
      [18.2568, 76.5028], // AUSA Mode
      [18.2542, 76.5036], // Akanksha Hospital
      [18.2486, 76.5016], // AUSA Bustand
    ],
  },
  {
    id: 'tuljapur_road',
    labelEn: 'Tuljapur Rd',
    labelMr: 'तुळजापूर रोड',
    major: true,
    points: [
      [18.2486, 76.5016], // AUSA Bustand
      [18.2478, 76.4998], // Kalan Galli
      [18.2458, 76.4974], // AUSA Fort
      [18.2435, 76.4932], // Tuljapur Mode
      [18.2410, 76.4914],
    ],
  },
  {
    id: 'nilanga_road',
    labelEn: 'Killari / Nilanga Rd',
    labelMr: 'किल्लारी / निलंगा रोड',
    major: true,
    points: [
      [18.2486, 76.5016], // AUSA Bustand
      [18.2442, 76.5062], // Bilal Nagar
      [18.2422, 76.5092], // Azeem College
      [18.2406, 76.5110],
    ],
  },
  {
    id: 'new_bustand_bypass',
    labelEn: 'New Bustand Rd',
    labelMr: 'नवीन बस स्टँड रोड',
    major: false,
    points: [
      [18.2568, 76.5028], // AUSA Mode
      [18.2554, 76.5056], // New Bustand
      [18.2542, 76.5036], // Akanksha Hospital
    ],
  },
  {
    id: 'town_spine',
    labelEn: 'Tehsil–Town Rd',
    labelMr: 'तहसील–बाजार रोड',
    major: false,
    points: [
      [18.2576, 76.4945], // Holkar Nagar
      [18.2529, 76.4968], // Court
      [18.2520, 76.4982], // Tehsil
      [18.2494, 76.4995], // Katghar Galli
      [18.2486, 76.5016], // AUSA Bustand
    ],
  },
  {
    id: 'west_town_link',
    labelEn: 'Police Station–Killa Rd',
    labelMr: 'पोलीस स्टेशन–किल्ला रोड',
    major: false,
    points: [
      [18.2529, 76.4968], // Court
      [18.2508, 76.4962], // Police Station
      [18.2458, 76.4974], // AUSA Fort
    ],
  },
  {
    id: 'north_town_link',
    labelEn: 'Mode–Holkar Rd',
    labelMr: 'मोड–होळकर रोड',
    major: false,
    points: [
      [18.2568, 76.5028], // AUSA Mode
      [18.2520, 76.4982], // Tehsil
    ],
  },
];

// Graph edges between landmark IDs with road labels for offline routing
interface GraphEdge {
  to: string;
  roadEn: string;
  roadMr: string;
}

const ROAD_GRAPH: Record<string, GraphEdge[]> = {
  ausa_mode: [
    { to: 'akanksha_hospital', roadEn: 'Latur–Ausa Main Rd', roadMr: 'लातूर–औसा मुख्य रोड' },
    { to: 'new_bustand', roadEn: 'New Bustand Link Rd', roadMr: 'नवीन बस स्टँड रोड' },
    { to: 'tehsil', roadEn: 'Tehsil Cross Rd', roadMr: 'तहसील क्रॉस रोड' },
    { to: 'holkar_nagar', roadEn: 'North Ring Rd', roadMr: 'उत्तर रिंग रोड' },
  ],
  new_bustand: [
    { to: 'ausa_mode', roadEn: 'New Bustand Link Rd', roadMr: 'नवीन बस स्टँड रोड' },
    { to: 'akanksha_hospital', roadEn: 'Hospital Bypass', roadMr: 'हॉस्पिटल बायपास' },
  ],
  akanksha_hospital: [
    { to: 'ausa_mode', roadEn: 'Latur–Ausa Main Rd', roadMr: 'लातूर–औसा मुख्य रोड' },
    { to: 'new_bustand', roadEn: 'Hospital Bypass', roadMr: 'हॉस्पिटल बायपास' },
    { to: 'ausa_bustand', roadEn: 'Bustand Main Rd', roadMr: 'बस स्टँड मुख्य रोड' },
    { to: 'tehsil', roadEn: 'Tehsil Rd', roadMr: 'तहसील रोड' },
  ],
  ausa_bustand: [
    { to: 'akanksha_hospital', roadEn: 'Bustand Main Rd', roadMr: 'बस स्टँड मुख्य रोड' },
    { to: 'katghar_galli', roadEn: 'Main Market Rd', roadMr: 'मुख्य बाजार रोड' },
    { to: 'kalan_galli', roadEn: 'Old Town Rd', roadMr: 'जुना बाजार रोड' },
    { to: 'bilal_nagar', roadEn: 'Killari / Nilanga Rd', roadMr: 'किल्लारी / निलंगा रोड' },
  ],
  tehsil: [
    { to: 'ausa_mode', roadEn: 'Tehsil Cross Rd', roadMr: 'तहसील क्रॉस रोड' },
    { to: 'akanksha_hospital', roadEn: 'Tehsil Rd', roadMr: 'तहसील रोड' },
    { to: 'court', roadEn: 'Court–Tehsil Rd', roadMr: 'कोर्ट–तहसील रोड' },
    { to: 'katghar_galli', roadEn: 'Town Spine Rd', roadMr: 'शहर मुख्य रस्ता' },
    { to: 'police_station', roadEn: 'Police Chowk Rd', roadMr: 'पोलीस चौकी रोड' },
  ],
  court: [
    { to: 'tehsil', roadEn: 'Court–Tehsil Rd', roadMr: 'कोर्ट–तहसील रोड' },
    { to: 'holkar_nagar', roadEn: 'Holkar Nagar Rd', roadMr: 'होळकर नगर रोड' },
    { to: 'police_station', roadEn: 'Station Rd', roadMr: 'स्टेशन रोड' },
  ],
  holkar_nagar: [
    { to: 'court', roadEn: 'Holkar Nagar Rd', roadMr: 'होळकर नगर रोड' },
    { to: 'ausa_mode', roadEn: 'North Ring Rd', roadMr: 'उत्तर रिंग रोड' },
  ],
  police_station: [
    { to: 'court', roadEn: 'Station Rd', roadMr: 'स्टेशन रोड' },
    { to: 'tehsil', roadEn: 'Police Chowk Rd', roadMr: 'पोलीस चौकी रोड' },
    { to: 'ausa_fort', roadEn: 'Killa Approach Rd', roadMr: 'किल्ला रोड' },
    { to: 'katghar_galli', roadEn: 'Town Cross Rd', roadMr: 'शहर क्रॉस रोड' },
  ],
  katghar_galli: [
    { to: 'tehsil', roadEn: 'Town Spine Rd', roadMr: 'शहर मुख्य रस्ता' },
    { to: 'ausa_bustand', roadEn: 'Main Market Rd', roadMr: 'मुख्य बाजार रोड' },
    { to: 'kalan_galli', roadEn: 'Galli Link Rd', roadMr: 'गल्ली जोड रस्ता' },
    { to: 'police_station', roadEn: 'Town Cross Rd', roadMr: 'शहर क्रॉस रोड' },
  ],
  kalan_galli: [
    { to: 'katghar_galli', roadEn: 'Galli Link Rd', roadMr: 'गल्ली जोड रस्ता' },
    { to: 'ausa_bustand', roadEn: 'Old Town Rd', roadMr: 'जुना बाजार रोड' },
    { to: 'ausa_fort', roadEn: 'Killa Gate Rd', roadMr: 'किल्ला गेट रोड' },
  ],
  ausa_fort: [
    { to: 'kalan_galli', roadEn: 'Killa Gate Rd', roadMr: 'किल्ला गेट रोड' },
    { to: 'police_station', roadEn: 'Killa Approach Rd', roadMr: 'किल्ला रोड' },
    { to: 'tuljapur_mode', roadEn: 'Tuljapur Rd', roadMr: 'तुळजापूर रोड' },
  ],
  tuljapur_mode: [
    { to: 'ausa_fort', roadEn: 'Tuljapur Rd', roadMr: 'तुळजापूर रोड' },
  ],
  bilal_nagar: [
    { to: 'ausa_bustand', roadEn: 'Killari / Nilanga Rd', roadMr: 'किल्लारी / निलंगा रोड' },
    { to: 'azeem_college', roadEn: 'College Rd', roadMr: 'कॉलेज रोड' },
  ],
  azeem_college: [
    { to: 'bilal_nagar', roadEn: 'College Rd', roadMr: 'कॉलेज रोड' },
  ],
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestAusaLandmark(lat: number, lng: number): AusaLandmark {
  let best = AUSA_LANDMARKS[0];
  let bestDist = Infinity;
  for (const lm of AUSA_LANDMARKS) {
    const d = haversineKm(lat, lng, lm.lat, lm.lng);
    if (d < bestDist) {
      bestDist = d;
      best = lm;
    }
  }
  return best;
}

function getCompassDirection(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): { en: string; mr: string } {
  const dLat = toLat - fromLat;
  const dLng = (toLng - fromLng) * Math.cos(toRad(fromLat));
  if (Math.abs(dLat) < 0.0001 && Math.abs(dLng) < 0.0001) {
    return { en: 'Nearby', mr: 'जवळच' };
  }
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI; // 0 = North, 90 = East
  const norm = (angle + 360) % 360;
  const dirs = [
    { en: 'North', mr: 'उत्तर' },
    { en: 'North-East', mr: 'ईशान्य' },
    { en: 'East', mr: 'पूर्व' },
    { en: 'South-East', mr: 'आग्नेय' },
    { en: 'South', mr: 'दक्षिण' },
    { en: 'South-West', mr: 'नैऋत्य' },
    { en: 'West', mr: 'पश्चिम' },
    { en: 'North-West', mr: 'वायव्य' },
  ];
  const idx = Math.round(norm / 45) % 8;
  return dirs[idx];
}

function findShortestNodePath(startId: string, endId: string): string[] {
  if (startId === endId) return [startId];
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>(AUSA_LANDMARKS.map((l) => l.id));

  for (const l of AUSA_LANDMARKS) {
    dist[l.id] = Infinity;
    prev[l.id] = null;
  }
  dist[startId] = 0;

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minD = Infinity;
    for (const id of unvisited) {
      if (dist[id] < minD) {
        minD = dist[id];
        curr = id;
      }
    }
    if (!curr || minD === Infinity || curr === endId) break;
    unvisited.delete(curr);

    const currLm = LANDMARK_BY_ID.get(curr);
    if (!currLm) continue;

    for (const edge of ROAD_GRAPH[curr] || []) {
      if (!unvisited.has(edge.to)) continue;
      const nextLm = LANDMARK_BY_ID.get(edge.to);
      if (!nextLm) continue;
      const alt = dist[curr] + haversineKm(currLm.lat, currLm.lng, nextLm.lat, nextLm.lng) * 1.28;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = curr;
      }
    }
  }

  const path: string[] = [];
  let trace: string | null = endId;
  while (trace) {
    path.unshift(trace);
    trace = prev[trace] || null;
  }
  if (path[0] !== startId) {
    return [startId, endId];
  }
  return path;
}

export function computeOfflineDirections(
  pickup: AusaPoint,
  dropoff: AusaPoint,
  _lang?: Lang
): OfflineDirectionsResult {
  const startNode =
    LANDMARK_BY_ID.get(pickup.id) || findNearestAusaLandmark(pickup.lat, pickup.lng);
  const endNode =
    LANDMARK_BY_ID.get(dropoff.id) || findNearestAusaLandmark(dropoff.lat, dropoff.lng);

  const nodeIds = findShortestNodePath(startNode.id, endNode.id);
  const pathPoints: OfflineDirectionsResult['pathPoints'] = [];
  const steps: OfflineDirectionStep[] = [];

  const isStartCustom = !LANDMARK_BY_ID.has(pickup.id);
  const isEndCustom = !LANDMARK_BY_ID.has(dropoff.id);

  if (isStartCustom) {
    pathPoints.push({
      lat: pickup.lat,
      lng: pickup.lng,
      nameEn: pickup.nameEn,
      nameMr: pickup.nameMr,
    });
    const approachKm = Math.max(
      0.2,
      Math.round(haversineKm(pickup.lat, pickup.lng, startNode.lat, startNode.lng) * 1.3 * 10) / 10
    );
    const dir = getCompassDirection(pickup.lat, pickup.lng, startNode.lat, startNode.lng);
    steps.push({
      stepNumber: steps.length + 1,
      instructionEn: `Start at ${pickup.nameEn} and head ${dir.en} toward ${startNode.nameEn}.`,
      instructionMr: `${pickup.nameMr} येथून ${dir.mr} दिशेने ${startNode.nameMr} कडे निघा.`,
      distanceKm: approachKm,
    });
  } else {
    steps.push({
      stepNumber: 1,
      instructionEn: `Board auto at ${pickup.nameEn}.`,
      instructionMr: `${pickup.nameMr} येथून ऑटोत बसा.`,
      distanceKm: 0,
    });
  }

  for (let i = 0; i < nodeIds.length; i++) {
    const lm = LANDMARK_BY_ID.get(nodeIds[i]);
    if (!lm) continue;
    pathPoints.push({
      lat: lm.lat,
      lng: lm.lng,
      nameEn: lm.nameEn,
      nameMr: lm.nameMr,
    });

    if (i > 0) {
      const prevLm = LANDMARK_BY_ID.get(nodeIds[i - 1]);
      if (prevLm) {
        const edge = (ROAD_GRAPH[prevLm.id] || []).find((e) => e.to === lm.id);
        const segKm = Math.max(
          0.2,
          Math.round(haversineKm(prevLm.lat, prevLm.lng, lm.lat, lm.lng) * 1.32 * 10) / 10
        );
        const dir = getCompassDirection(prevLm.lat, prevLm.lng, lm.lat, lm.lng);
        const roadEn = edge ? edge.roadEn : 'Ausa Local Rd';
        const roadMr = edge ? edge.roadMr : 'औसा शहर रस्ता';
        steps.push({
          stepNumber: steps.length + 1,
          instructionEn: `Head ${dir.en} via ${roadEn} to ${lm.nameEn}.`,
          instructionMr: `${roadMr} मार्गे ${dir.mr} दिशेने ${lm.nameMr} कडे जा.`,
          distanceKm: segKm,
        });
      }
    }
  }

  if (isEndCustom) {
    pathPoints.push({
      lat: dropoff.lat,
      lng: dropoff.lng,
      nameEn: dropoff.nameEn,
      nameMr: dropoff.nameMr,
    });
    const lastKm = Math.max(
      0.2,
      Math.round(haversineKm(endNode.lat, endNode.lng, dropoff.lat, dropoff.lng) * 1.3 * 10) / 10
    );
    const dir = getCompassDirection(endNode.lat, endNode.lng, dropoff.lat, dropoff.lng);
    steps.push({
      stepNumber: steps.length + 1,
      instructionEn: `Continue ${dir.en} from ${endNode.nameEn} to reach ${dropoff.nameEn}.`,
      instructionMr: `${endNode.nameMr} पासून ${dir.mr} दिशेने ${dropoff.nameMr} येथे पोहोचा.`,
      distanceKm: lastKm,
    });
  } else if (startNode.id === endNode.id && !isStartCustom) {
    steps.push({
      stepNumber: steps.length + 1,
      instructionEn: `Short local drop around ${dropoff.nameEn}.`,
      instructionMr: `${dropoff.nameMr} परिसरात जवळचा प्रवास.`,
      distanceKm: 0.5,
    });
  }

  const rawKm = steps.reduce((acc, s) => acc + s.distanceKm, 0);
  const totalKm = Math.min(25, Math.max(0.5, Math.round(rawKm * 10) / 10));
  const etaMins = Math.max(2, Math.round(totalKm * 3.5 + 1));
  const compass = getCompassDirection(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);

  return {
    pathPoints,
    steps,
    totalKm,
    etaMins,
    compassEn: compass.en,
    compassMr: compass.mr,
  };
}

export function calculateAusaDistanceKm(
  pickup: Pick<AusaPoint, 'id' | 'lat' | 'lng'>,
  dropoff: Pick<AusaPoint, 'id' | 'lat' | 'lng'>,
  hasCustomPickup: boolean,
  hasCustomDropoff: boolean
): number {
  if (pickup.id === dropoff.id && !hasCustomPickup && !hasCustomDropoff) {
    return 0.5;
  }

  const straightKm = haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const colonyOffset = (hasCustomPickup ? 0.2 : 0) + (hasCustomDropoff ? 0.2 : 0);
  const roadKm = straightKm * 1.32 + colonyOffset;
  return Math.min(25, Math.max(0.5, Math.round(roadKm * 10) / 10));
}

export function isBustandModeRoute(pickupId: string, dropoffId: string): boolean {
  return (
    (pickupId === 'ausa_bustand' && dropoffId === 'ausa_mode') ||
    (pickupId === 'ausa_mode' && dropoffId === 'ausa_bustand')
  );
}

export function calculateAusaFare(
  pickup: Pick<AusaPoint, 'id'>,
  dropoff: Pick<AusaPoint, 'id'>,
  passengerCount: number,
  settings: Pick<FareSettings, 'modeBustandPerPerson' | 'standardFare'>
): {
  fareInr: number;
  isPerPersonRoute: boolean;
  rateLabel: string;
} {
  const isPerPersonRoute = isBustandModeRoute(pickup.id, dropoff.id);
  const safeCount = Math.min(4, Math.max(1, Math.round(passengerCount)));

  if (isPerPersonRoute) {
    return {
      fareInr: safeCount * settings.modeBustandPerPerson,
      isPerPersonRoute: true,
      rateLabel: `₹${settings.modeBustandPerPerson} / person`,
    };
  }

  return {
    fareInr: settings.standardFare,
    isPerPersonRoute: false,
    rateLabel: `₹${settings.standardFare} fixed local`,
  };
}
