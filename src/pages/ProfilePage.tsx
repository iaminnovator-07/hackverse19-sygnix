import { Database, HeartHandshake, PlugZap } from "lucide-react";
import { ProfileCard } from "@/components/cards/ProfileCard";
import { SectionCard } from "@/components/cards/ModuleCard";
import { backendReadiness } from "@/services/healthRepository";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";

export function ProfilePage() {
  const { familyData, currentMember, viewedMember, experience } = useDashboardExperience();

  return (
    <div className="dashboard-stack">
      <ProfileCard member={viewedMember} />
      <SectionCard eyebrow="Dynamic identity" title="Resolved experience">
        <div className="split-metrics">
          <div className="info-tile">
            <span>Role</span>
            <strong>{viewedMember.role}</strong>
          </div>
          <div className="info-tile">
            <span>Experience</span>
            <strong>{experience}</strong>
          </div>
          <div className="info-tile">
            <span>Family</span>
            <strong>{familyData.family.name}</strong>
          </div>
          <div className="info-tile">
            <span>Signed in as</span>
            <strong>{currentMember.name}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Database ready design" title="Integration boundaries">
        <div className="future-grid">
          <article className="future-card">
            <Database size={18} />
            <strong>Supabase and PostgreSQL</strong>
            <span>{backendReadiness.supabase.status}</span>
            <p>{backendReadiness.postgresql.notes}</p>
          </article>
          <article className="future-card">
            <HeartHandshake size={18} />
            <strong>ABHA integration</strong>
            <span>{backendReadiness.abha.status}</span>
            <p>{backendReadiness.abha.notes}</p>
          </article>
          <article className="future-card">
            <PlugZap size={18} />
            <strong>AI and IoT modules</strong>
            <span>{backendReadiness.aiAssistant.status}</span>
            <p>{backendReadiness.iotDevices.modules.join(", ")}</p>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
