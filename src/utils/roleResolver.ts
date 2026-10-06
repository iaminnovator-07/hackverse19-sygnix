import type { ExperienceType, FamilyMember } from "@/data/types";

export function resolveExperience(profile: FamilyMember | null | undefined): ExperienceType {
  if (!profile) return "adult";
  if (profile.role === "caregiver") return "caregiver";
  if (profile.age < 18) return "child";
  if (profile.age > 60) return "elder";
  if (profile.gender === "female") return "women";
  if (profile.age >= 18 && profile.age <= 30) return "young";
  return "adult";
}

export function getAgeGroup(profile: FamilyMember): "child" | "young_adult" | "adult" | "elder" {
  if (profile.age < 18) return "child";
  if (profile.age <= 30) return "young_adult";
  if (profile.age > 60) return "elder";
  return "adult";
}

export function can(profile: FamilyMember | null | undefined, permission: string) {
  return Boolean(profile?.permissions.includes(permission as never));
}

export function getVisibleMemberIds(activeProfile: FamilyMember, selectedMemberId: string | null) {
  if (activeProfile.role === "caregiver") {
    return selectedMemberId ? [selectedMemberId] : null;
  }
  return [activeProfile.id];
}
