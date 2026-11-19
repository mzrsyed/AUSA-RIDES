import React from 'react';
import { AUSA_LANDMARKS, AusaLandmark } from '../data/ausaLandmarks';
import { Lang } from '../types';

interface AusaMapProps {
  pickup: AusaLandmark;
  dropoff: AusaLandmark;
  lang: Lang;
  onSelectLandmark?: (landmark: AusaLandmark) => void;
  distanceKm: number;
}

// Bounding box around Ausa (18.2500° N, 76.5000° E)
const MIN_LAT = 18.2385;
const MAX_LAT = 18.2625;
const MIN_LNG = 76.4875;
const MAX_LNG = 76.5160;

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 360 + 20;
  const y = (1 - (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 220 + 20;
  return { x, y };
}

export const AusaMap: React.FC<AusaMapProps> = ({
  pickup,
  dropoff,
  lang,
  onSelectLandmark,
  distanceKm,
}) => {
  const pCoord = project(pickup.lat, pickup.lng);
  const dCoord = project(dropoff.lat, dropoff.lng);
  const midX = (pCoord.x + dCoord.x) / 2;
  const midY = Math.min(pCoord.y, dCoord.y) - 24;

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 text-white">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-semibold text-yellow-400">
            {lang === 'mr' ? 'औसा शहर नकाशा मार्ग' : 'Ausa Local Route Schematic'}
          </p>
          <p className="text-[11px] font-mono text-zinc-400">18.2500° N, 76.5000° E</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">{lang === 'mr' ? 'अंतर' : 'Route'}</p>
          <p className="text-sm font-mono font-bold text-yellow-400 tabular-nums">
            {distanceKm.toFixed(1)} km
          </p>
        </div>
      </div>

      <svg
        viewBox="0 0 400 260"
        className="w-full h-52 sm:h-60 rounded-xl bg-zinc-900 border border-zinc-800"
        role="img"
        aria-label="Ausa Town Landmark Map"
      >
        {/* Subtle coordinate grid */}
        <g stroke="#27272a" strokeWidth="1">
          <line x1="0" y1="65" x2="400" y2="65" />
          <line x1="0" y1="130" x2="400" y2="130" />
          <line x1="0" y1="195" x2="400" y2="195" />
          <line x1="100" y1="0" x2="100" y2="260" />
          <line x1="200" y1="0" x2="200" y2="260" />
          <line x1="300" y1="0" x2="300" y2="260" />
        </g>

        {/* Major Ausa Arterial Roads */}
        <g stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" fill="none">
          {/* Latur Road - Subhash Chowk - Nilanga Road */}
          <path d="M 248 44 L 194 140 L 62 232" />
          {/* Budhoda Naka - Shivaji Chowk - Killari Road */}
          <path d="M 68 62 L 178 148 L 355 224" />
        </g>

        {/* Route Path Arc */}
        {pickup.id !== dropoff.id && (
          <path
            d={`M ${pCoord.x} ${pCoord.y} Q ${midX} ${midY} ${dCoord.x} ${dCoord.y}`}
            fill="none"
            stroke="#facc15"
            strokeWidth="3"
            strokeDasharray="6 4"
          />
        )}

        {/* Landmarks */}
        {AUSA_LANDMARKS.map((lm) => {
          const { x, y } = project(lm.lat, lm.lng);
          const isPickup = lm.id === pickup.id;
          const isDropoff = lm.id === dropoff.id;
          const label = lang === 'mr' ? lm.nameMr.split(' (')[0] : lm.nameEn.split(' (')[0];

          return (
            <g
              key={lm.id}
              onClick={() => onSelectLandmark?.(lm)}
              className={onSelectLandmark ? 'cursor-pointer' : ''}
            >
              <circle
                cx={x}
                cy={y}
                r={isPickup || isDropoff ? 7 : 4}
                fill={
                  isPickup
                    ? '#facc15'
                    : isDropoff
                    ? '#ffffff'
                    : lm.zone === 'outer'
                    ? '#71717a'
                    : '#a1a1aa'
                }
                stroke="#09090b"
                strokeWidth="2"
              />
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fontSize={isPickup || isDropoff ? '10' : '8.5'}
                fontWeight={isPickup || isDropoff ? '700' : '500'}
                fill={isPickup ? '#facc15' : isDropoff ? '#ffffff' : '#a1a1aa'}
              >
                {label.length > 18 ? `${label.slice(0, 16)}…` : label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          <strong className="text-yellow-400">●</strong>{' '}
          {lang === 'mr' ? 'पिकअप' : 'Pickup'}:{' '}
          {lang === 'mr' ? pickup.nameMr : pickup.nameEn}
        </span>
        <span>
          <strong className="text-white">●</strong>{' '}
          {lang === 'mr' ? 'ड्रॉप' : 'Drop'}:{' '}
          {lang === 'mr' ? dropoff.nameMr : dropoff.nameEn}
        </span>
      </div>
    </div>
  );
};
