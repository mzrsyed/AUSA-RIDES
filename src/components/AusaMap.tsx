import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  LocateFixed,
  Navigation,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AUSA_BOUNDS,
  AUSA_LANDMARKS,
  AUSA_ROAD_CORRIDORS,
  AusaLandmark,
  AusaPoint,
  computeOfflineDirections,
  findNearestAusaLandmark,
  LANDMARK_BY_ID,
} from '../data/ausaLandmarks';
import { useT } from '../i18n/translations';
import { Lang } from '../types';

interface AusaMapProps {
  pickup: AusaPoint;
  dropoff: AusaPoint;
  lang: Lang;
  distanceKm: number;
  activeSelector?: 'pickup' | 'dropoff';
  onSelectLandmark?: (landmark: AusaLandmark) => void;
  onSelectCustomPoint?: (lat: number, lng: number, nearest: AusaLandmark) => void;
  defaultShowDirections?: boolean;
}

const SVG_W = 440;
const SVG_H = 280;
const PAD_X = 32;
const PAD_Y = 26;

function project(lat: number, lng: number): { x: number; y: number } {
  const x =
    ((lng - AUSA_BOUNDS.minLng) / (AUSA_BOUNDS.maxLng - AUSA_BOUNDS.minLng)) *
      (SVG_W - PAD_X * 2) +
    PAD_X;
  const y =
    (1 - (lat - AUSA_BOUNDS.minLat) / (AUSA_BOUNDS.maxLat - AUSA_BOUNDS.minLat)) *
      (SVG_H - PAD_Y * 2) +
    PAD_Y;
  return { x, y };
}

function unproject(x: number, y: number): { lat: number; lng: number } {
  const normX = Math.min(1, Math.max(0, (x - PAD_X) / (SVG_W - PAD_X * 2)));
  const normY = Math.min(1, Math.max(0, (y - PAD_Y) / (SVG_H - PAD_Y * 2)));
  const lng = AUSA_BOUNDS.minLng + normX * (AUSA_BOUNDS.maxLng - AUSA_BOUNDS.minLng);
  const lat = AUSA_BOUNDS.minLat + (1 - normY) * (AUSA_BOUNDS.maxLat - AUSA_BOUNDS.minLat);
  return {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
  };
}

export const AusaMap: React.FC<AusaMapProps> = ({
  pickup,
  dropoff,
  lang,
  distanceKm,
  activeSelector,
  onSelectLandmark,
  onSelectCustomPoint,
  defaultShowDirections = true,
}) => {
  const t = useT(lang);
  const svgRef = useRef<SVGSVGElement>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [showDirections, setShowDirections] = useState(defaultShowDirections);
  const [zoomed, setZoomed] = useState(false);

  const directions = useMemo(
    () => computeOfflineDirections(pickup, dropoff, lang),
    [pickup, dropoff, lang]
  );

  const pCoord = project(pickup.lat, pickup.lng);
  const dCoord = project(dropoff.lat, dropoff.lng);
  const fortCoord = project(18.2458, 76.4974);

  // Compute zoom viewBox centered on route midpoint when zoomed
  const viewBox = useMemo(() => {
    if (!zoomed) return `0 0 ${SVG_W} ${SVG_H}`;
    const midX = (pCoord.x + dCoord.x) / 2;
    const midY = (pCoord.y + dCoord.y) / 2;
    const zw = SVG_W * 0.62;
    const zh = SVG_H * 0.62;
    const vx = Math.min(SVG_W - zw, Math.max(0, midX - zw / 2));
    const vy = Math.min(SVG_H - zh, Math.max(0, midY - zh / 2));
    return `${vx.toFixed(1)} ${vy.toFixed(1)} ${zw.toFixed(1)} ${zh.toFixed(1)}`;
  }, [zoomed, pCoord.x, pCoord.y, dCoord.x, dCoord.y]);

  const routeSvgPath = useMemo(() => {
    if (directions.pathPoints.length < 2) return '';
    return directions.pathPoints
      .map((pt, idx) => {
        const { x, y } = project(pt.lat, pt.lng);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [directions.pathPoints]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelectCustomPoint || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const parts = viewBox.split(' ').map(Number);
    const [vx, vy, vw, vh] = parts.length === 4 ? parts : [0, 0, SVG_W, SVG_H];
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const svgX = vx + relX * vw;
    const svgY = vy + relY * vh;

    const { lat, lng } = unproject(svgX, svgY);
    const nearest = findNearestAusaLandmark(lat, lng);
    onSelectCustomPoint(lat, lng, nearest);
  };

  const pickupIsCustom = !LANDMARK_BY_ID.has(pickup.id);
  const dropoffIsCustom = !LANDMARK_BY_ID.has(dropoff.id);

  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>{t.offlineMapTitle}</span>
          </p>
          <p className="text-[11px] font-mono text-zinc-400">
            18.2500° N, 76.5000° E · {lang === 'mr' ? directions.compassMr : directions.compassEn}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-zinc-400">
            {t.distanceLabel} · {t.etaLabel}
          </p>
          <p className="text-sm font-mono font-bold text-yellow-400 tabular-nums">
            {distanceKm.toFixed(1)} km · ~{directions.etaMins} min
          </p>
        </div>
      </div>

      {/* Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-yellow-400 text-[11px] font-semibold text-zinc-200 flex items-center gap-1"
          >
            {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span>{zoomed ? '1×' : 'Zoom'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAllLabels((s) => !s)}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
              showAllLabels
                ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-yellow-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.allStopsToggle}</span>
          </button>
        </div>

        {onSelectCustomPoint && activeSelector && (
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <LocateFixed className="w-3 h-3 text-yellow-400 shrink-0" />
            <span>
              {activeSelector === 'pickup' ? t.pickupTitle : t.dropoffTitle}
            </span>
          </span>
        )}
      </div>

      {/* Interactive Offline SVG Town Map */}
      <svg
        ref={svgRef}
        viewBox={viewBox}
        onClick={handleSvgClick}
        className={`w-full h-60 sm:h-64 rounded-xl bg-zinc-900 border border-zinc-800 select-none ${
          onSelectCustomPoint ? 'cursor-crosshair' : ''
        }`}
        role="img"
        aria-label="Ausa Offline Town Road and Landmark Map"
      >
        <defs>
          <marker
            id="ausaRouteArrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#facc15" />
          </marker>
        </defs>

        {/* Town Grid */}
        <g stroke="#27272a" strokeWidth="0.8">
          <line x1="0" y1="70" x2={SVG_W} y2="70" />
          <line x1="0" y1="140" x2={SVG_W} y2="140" />
          <line x1="0" y1="210" x2={SVG_W} y2="210" />
          <line x1="110" y1="0" x2="110" y2={SVG_H} />
          <line x1="220" y1="0" x2="220" y2={SVG_H} />
          <line x1="330" y1="0" x2="330" y2={SVG_H} />
        </g>

        {/* Bhuikot Killa (Ausa Fort) Footprint */}
        <polygon
          points={`${fortCoord.x - 16},${fortCoord.y - 10} ${fortCoord.x},${fortCoord.y - 17} ${fortCoord.x + 16},${fortCoord.y - 10} ${fortCoord.x + 16},${fortCoord.y + 10} ${fortCoord.x},${fortCoord.y + 17} ${fortCoord.x - 16},${fortCoord.y + 10}`}
          fill="#27272a"
          stroke="#52525b"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />

        {/* Ausa Road Corridors */}
        {AUSA_ROAD_CORRIDORS.map((road) => {
          const d = road.points
            .map(([lat, lng], idx) => {
              const { x, y } = project(lat, lng);
              return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ');
          const midPt = road.points[Math.floor(road.points.length / 2)];
          const labelPos = project(midPt[0], midPt[1]);

          return (
            <g key={road.id}>
              <path
                d={d}
                fill="none"
                stroke={road.major ? '#52525b' : '#3f3f46'}
                strokeWidth={road.major ? 4.5 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {road.major && (
                <text
                  x={labelPos.x + 6}
                  y={labelPos.y + 11}
                  fontSize="7.5"
                  fill="#71717a"
                  fontWeight="600"
                >
                  {lang === 'mr' ? road.labelMr : road.labelEn}
                </text>
              )}
            </g>
          );
        })}

        {/* Active Computed Offline Road Route with Direction Arrowhead */}
        {routeSvgPath && (pickup.lat !== dropoff.lat || pickup.lng !== dropoff.lng) && (
          <>
            <path
              d={routeSvgPath}
              fill="none"
              stroke="#facc15"
              strokeOpacity="0.22"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={routeSvgPath}
              fill="none"
              stroke="#facc15"
              strokeWidth="3.2"
              strokeDasharray="7 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#ausaRouteArrow)"
            />
          </>
        )}

        {/* Preset Ausa Landmarks */}
        {AUSA_LANDMARKS.map((lm) => {
          const { x, y } = project(lm.lat, lm.lng);
          const isPickup = lm.id === pickup.id;
          const isDropoff = lm.id === dropoff.id;
          const label = lang === 'mr' ? lm.nameMr.split(' (')[0] : lm.nameEn.split(' (')[0];
          const showLabel = showAllLabels || isPickup || isDropoff || lm.zone === 'hub';

          return (
            <g
              key={lm.id}
              onClick={(e) => {
                if (onSelectLandmark) {
                  e.stopPropagation();
                  onSelectLandmark(lm);
                }
              }}
              className={onSelectLandmark ? 'cursor-pointer' : ''}
            >
              <circle
                cx={x}
                cy={y}
                r={isPickup || isDropoff ? 7 : 4.2}
                fill={
                  isPickup
                    ? '#facc15'
                    : isDropoff
                    ? '#34d399'
                    : lm.zone === 'hub'
                    ? '#fbbf24'
                    : '#a1a1aa'
                }
                stroke="#09090b"
                strokeWidth="2"
              />
              {showLabel && (
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize={isPickup || isDropoff ? '9.5' : '7.5'}
                  fontWeight={isPickup || isDropoff ? '700' : '500'}
                  fill={isPickup ? '#facc15' : isDropoff ? '#6ee7b7' : '#d4d4d8'}
                >
                  {label.length > 17 ? `${label.slice(0, 15)}…` : label}
                </text>
              )}
            </g>
          );
        })}

        {/* Custom Pickup Pin */}
        {pickupIsCustom && (
          <g>
            <circle cx={pCoord.x} cy={pCoord.y} r="8" fill="#facc15" stroke="#09090b" strokeWidth="2.5" />
            <text
              x={pCoord.x}
              y={pCoord.y + 3}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="800"
              fill="#09090b"
            >
              P
            </text>
            <text
              x={pCoord.x}
              y={pCoord.y - 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#facc15"
            >
              {(lang === 'mr' ? pickup.nameMr : pickup.nameEn).slice(0, 18)}
            </text>
          </g>
        )}

        {/* Custom Drop-off Pin */}
        {dropoffIsCustom && (
          <g>
            <circle cx={dCoord.x} cy={dCoord.y} r="8" fill="#34d399" stroke="#09090b" strokeWidth="2.5" />
            <text
              x={dCoord.x}
              y={dCoord.y + 3}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="800"
              fill="#09090b"
            >
              D
            </text>
            <text
              x={dCoord.x}
              y={dCoord.y - 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#6ee7b7"
            >
              {(lang === 'mr' ? dropoff.nameMr : dropoff.nameEn).slice(0, 18)}
            </text>
          </g>
        )}

        {/* Compass Rose (Top-Right) */}
        <g transform={`translate(${SVG_W - 24}, 22)`}>
          <circle cx="0" cy="0" r="12" fill="#09090b" fillOpacity="0.85" stroke="#3f3f46" strokeWidth="1" />
          <path d="M 0 -8 L 3 2 L 0 0 L -3 2 Z" fill="#facc15" />
          <text x="0" y="9" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#a1a1aa">
            N
          </text>
        </g>
      </svg>

      {onSelectCustomPoint && (
        <p className="mt-2 text-[11px] text-zinc-400">{t.pinOnMapHint}</p>
      )}

      {/* Selected Endpoints Legend */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-zinc-300">
        <span className="truncate">
          <strong className="text-yellow-400">●</strong>{' '}
          {lang === 'mr' ? pickup.nameMr : pickup.nameEn}
        </span>
        <span className="truncate">
          <strong className="text-emerald-400">●</strong>{' '}
          {lang === 'mr' ? dropoff.nameMr : dropoff.nameEn}
        </span>
      </div>

      {/* Offline Turn-by-Turn Directions Panel */}
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={() => setShowDirections((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-bold text-yellow-400 hover:text-yellow-300 py-1"
        >
          <span className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" />
            <span>{t.offlineDirectionsTitle}</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-300">
            <span>{showDirections ? t.hideDirections : t.showDirections}</span>
            {showDirections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showDirections && (
          <ol className="mt-2.5 space-y-2">
            {directions.steps.map((step) => (
              <li
                key={step.stepNumber}
                className="flex items-start justify-between gap-2 text-xs bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-yellow-400 text-zinc-950 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step.stepNumber}
                  </span>
                  <span className="text-zinc-200 leading-snug">
                    {lang === 'mr' ? step.instructionMr : step.instructionEn}
                  </span>
                </div>
                {step.distanceKm > 0 && (
                  <span className="font-mono text-[11px] text-yellow-400 shrink-0 tabular-nums mt-0.5">
                    {step.distanceKm.toFixed(1)} km
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
