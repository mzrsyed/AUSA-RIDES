import React from 'react';
import { Download, X, QrCode } from 'lucide-react';
import { Lang, Ride } from '../types';
import { useT } from '../i18n/translations';

interface ReceiptModalProps {
  ride: Ride | null;
  lang: Lang;
  onClose: () => void;
}

export function downloadRideReceipt(ride: Ride) {
  const dateStr = ride.updatedAt?.toDate
    ? ride.updatedAt.toDate().toLocaleString('en-IN')
    : new Date().toLocaleString('en-IN');

  const receiptHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AusaRides Receipt - ${ride.rideId}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 32px auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; color: #09090b; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #52525b; margin-bottom: 20px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; }
  .total { font-weight: 700; font-size: 18px; border-top: 2px solid #09090b; border-bottom: none; padding-top: 12px; margin-top: 8px; }
  .mono { font-family: monospace; }
</style>
</head>
<body>
  <h1>AusaRides Trip Receipt</h1>
  <div class="sub">Ausa, Dist. Latur, Maharashtra (18.2500° N, 76.5000° E)</div>
  <div class="row"><span>Receipt ID</span><span class="mono">${ride.rideId}</span></div>
  <div class="row"><span>Date & Time</span><span>${dateStr}</span></div>
  <div class="row"><span>Rider</span><span>${ride.riderName}</span></div>
  <div class="row"><span>Auto Driver</span><span>${ride.driverName || '—'}</span></div>
  <div class="row"><span>Vehicle Plate</span><span class="mono">${ride.driverVehicleNumber || '—'}</span></div>
  <div class="row"><span>Pickup</span><span>${ride.pickupLandmarkName}${ride.pickupCustomAddress ? ' (' + ride.pickupCustomAddress + ')' : ''}</span></div>
  <div class="row"><span>Drop-off</span><span>${ride.dropoffLandmarkName}${ride.dropoffCustomAddress ? ' (' + ride.dropoffCustomAddress + ')' : ''}</span></div>
  <div class="row"><span>Distance</span><span class="mono">${ride.distanceKm.toFixed(1)} km</span></div>
  <div class="row"><span>Base Fare</span><span class="mono">₹${ride.baseFareUsed}</span></div>
  <div class="row"><span>Distance Charge (${ride.distanceKm.toFixed(1)} × ₹${ride.perKmUsed})</span><span class="mono">₹${Math.round(ride.distanceKm * ride.perKmUsed)}</span></div>
  <div class="row"><span>Outer Naka Surcharge</span><span class="mono">₹${ride.locationSurchargeUsed}</span></div>
  <div class="row"><span>Payment Mode</span><span>${ride.paymentMethod.toUpperCase()} (${ride.paymentStatus.toUpperCase()})</span></div>
  <div class="row total"><span>Total Paid</span><span class="mono">₹${ride.fareInr}</span></div>
</body>
</html>`;

  const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AusaRides-Receipt-${ride.rideId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ ride, lang, onClose }) => {
  const t = useT(lang);
  if (!ride) return null;

  const dateStr = ride.updatedAt?.toDate
    ? ride.updatedAt.toDate().toLocaleString('en-IN')
    : '—';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">{t.receiptTitle}</h3>
            <p className="text-xs font-mono text-zinc-500 mt-0.5">{ride.rideId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-stone-100 text-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 text-sm border-y border-zinc-200 py-4">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Date</span>
            <span className="font-medium text-zinc-950 text-right">{dateStr}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Pickup</span>
            <span className="font-medium text-zinc-950 text-right">{ride.pickupLandmarkName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Drop-off</span>
            <span className="font-medium text-zinc-950 text-right">{ride.dropoffLandmarkName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Driver & Auto</span>
            <span className="font-mono font-semibold text-zinc-950 text-right">
              {ride.driverName || '—'} · {ride.driverVehicleNumber || '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.distanceLabel}</span>
            <span className="font-mono text-zinc-950">{ride.distanceKm.toFixed(1)} km</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.paymentMethodLabel}</span>
            <span className="font-semibold text-zinc-950 uppercase">
              {ride.paymentMethod} · {ride.paymentStatus}
            </span>
          </div>
          <div className="flex justify-between gap-4 pt-2 border-t border-zinc-100 text-base font-bold">
            <span className="text-zinc-950">{t.totalFareLabel}</span>
            <span className="font-mono text-zinc-950">₹{ride.fareInr}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => downloadRideReceipt(ride)}
            className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-zinc-950 text-yellow-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t.downloadReceipt}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 py-3 rounded-xl border border-zinc-300 text-zinc-900 font-semibold text-sm hover:bg-stone-100 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export const UpiQrPanel: React.FC<{
  amount: number;
  rideId: string;
  driverName: string;
  lang: Lang;
}> = ({ amount, rideId, driverName, lang }) => {
  const t = useT(lang);
  return (
    <div className="bg-stone-100 border border-zinc-200 rounded-2xl p-4 flex items-center gap-4">
      <div className="w-20 h-20 bg-white border border-zinc-300 rounded-xl flex flex-col items-center justify-center shrink-0">
        <QrCode className="w-12 h-12 text-zinc-950" />
        <span className="text-[9px] font-mono text-zinc-600 mt-0.5">UPI QR</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-zinc-950">{t.upiPayCardTitle}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{t.upiPayCardHint}</p>
        <p className="text-xs font-mono font-semibold text-zinc-950 mt-1.5">
          ₹{amount} · {driverName || 'Driver'} · {rideId.slice(-6).toUpperCase()}
        </p>
      </div>
    </div>
  );
};
