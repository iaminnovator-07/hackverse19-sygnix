import { PhoneCall, ShieldAlert, Siren } from "lucide-react";
import { SectionCard } from "@/components/cards/ModuleCard";
import { EmergencyQR } from "@/components/qr/EmergencyQR";
import { useToast } from "@/context/ToastContext";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";
import { useEmergencyPayload } from "@/hooks/useEmergencyPayload";

export function EmergencyPage() {
  const { familyData, viewedMember } = useDashboardExperience();
  const { showToast } = useToast();
  const payload = useEmergencyPayload(viewedMember, familyData.medicines);

  return (
    <div className="dashboard-stack">
      <section className="hero-card emergency-hero">
        <div>
          <span>Emergency infrastructure</span>
          <h1>{viewedMember.name}</h1>
          <p>Medical summary, allergies, blood group, medicines, doctor, and contact are encoded for emergency access.</p>
        </div>
        <button type="button" className="sos-button" onClick={() => showToast("SOS simulation sent to caregiver and emergency contact")}>
          <Siren size={22} />
          SOS Action
        </button>
      </section>

      <SectionCard eyebrow="Emergency QR" title="Medical summary">
        <EmergencyQR payload={payload} />
        <div className="emergency-grid">
          <div className="info-tile">
            <span>Blood Group</span>
            <strong>{viewedMember.bloodGroup}</strong>
          </div>
          <div className="info-tile">
            <span>Allergies</span>
            <strong>{viewedMember.allergies.join(", ") || "None"}</strong>
          </div>
          <div className="info-tile">
            <span>Conditions</span>
            <strong>{viewedMember.conditions.join(", ") || "None"}</strong>
          </div>
          <div className="info-tile">
            <span>Contact</span>
            <strong>{viewedMember.emergencyContact}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="SOS actions" title="Escalation paths">
        <div className="compact-list">
          <button type="button" className="info-row tone-rose" onClick={() => showToast("Calling emergency contact simulation")}>
            <div>
              <PhoneCall size={18} />
            </div>
            <div>
              <strong>Call emergency contact</strong>
              <p>{viewedMember.emergencyContact}</p>
            </div>
          </button>
          <button type="button" className="info-row tone-amber" onClick={() => showToast("Medical summary shared with doctor simulation")}>
            <div>
              <ShieldAlert size={18} />
            </div>
            <div>
              <strong>Share medical summary</strong>
              <p>{viewedMember.doctor}</p>
            </div>
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
