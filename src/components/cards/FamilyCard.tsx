import { Activity, ChevronRight, HeartPulse, Shield } from "lucide-react";
import type { FamilyMember } from "@/data/types";

export function FamilyCard({
  member,
  active,
  onSelect
}: {
  member: FamilyMember;
  active?: boolean;
  onSelect?: (memberId: string) => void;
}) {
  return (
    <button className={active ? "family-card active" : "family-card"} type="button" onClick={() => onSelect?.(member.id)}>
      <div className="member-avatar">{member.initials}</div>
      <div className="family-card-main">
        <strong>{member.name}</strong>
        <span>
          {member.relationship} - {member.age} yrs
        </span>
        <div className="tag-row">
          {member.conditions.slice(0, 2).map((condition) => (
            <em key={condition}>{condition}</em>
          ))}
          {member.conditions.length === 0 && <em>Preventive care</em>}
        </div>
      </div>
      <div className="family-card-meta">
        <span>
          <HeartPulse size={14} />
          {member.healthScore}
        </span>
        <span>
          <Shield size={14} />
          {member.bloodGroup}
        </span>
        <span>
          <Activity size={14} />
          QR
        </span>
      </div>
      <ChevronRight className="chevron" size={18} />
    </button>
  );
}
