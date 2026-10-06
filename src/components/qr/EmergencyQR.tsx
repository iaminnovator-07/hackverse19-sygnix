import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { fullEmergencySummary } from "@/utils/formatters";

export function EmergencyQR({ payload }: { payload: Record<string, unknown> }) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    let mounted = true;
    void QRCode.toDataURL(fullEmergencySummary(payload), {
      width: 220,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" }
    }).then((dataUrl) => {
      if (mounted) setQr(dataUrl);
    });
    return () => {
      mounted = false;
    };
  }, [payload]);

  return (
    <div className="qr-panel">
      {qr ? <img src={qr} alt="Emergency QR code" /> : <QrCode size={72} />}
      <div>
        <strong>Emergency QR</strong>
        <span>Medical summary ready</span>
      </div>
    </div>
  );
}
