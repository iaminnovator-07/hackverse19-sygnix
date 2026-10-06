import { BadgeCheck, CalendarHeart, Droplets, UserRound } from "lucide-react";
import type { FamilyMember } from "@/data/types";
import { getAgeGroup } from "@/utils/roleResolver";

export function ProfileCard({ member }: { member: FamilyMember }) {
  return (
    <article className="profile-card">
      <div className="profile-avatar">{member.initials}</div>
      <div className="profile-details">
        <span>{getAgeGroup(member).replace("_", " ")}</span>
        <h2>{member.name}</h2>
        <p>{member.relationship}</p>
        <div className="profile-grid">
          <div>
            <Droplets size={16} />
            <strong>{member.bloodGroup}</strong>
            <small>Blood group</small>
          </div>
          <div>
            <CalendarHeart size={16} />
            <strong>{member.age}</strong>
            <small>Age</small>
          </div>
          <div>
            <BadgeCheck size={16} />
            <strong>{member.healthScore}</strong>
            <small>Score</small>
          </div>
          <div>
            <UserRound size={16} />
            <strong>{member.gender}</strong>
            <small>Gender</small>
          </div>
        </div>
      </div>
    </article>
  );
}
