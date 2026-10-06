import { dashboardConfigs } from "@/data/dashboardConfigs";
import { resolveExperience } from "@/utils/roleResolver";
import { selectCurrentMember, useMediRouteStore } from "@/context/useMediRouteStore";

export function useDashboardExperience() {
  const familyData = useMediRouteStore((state) => state.familyData);
  const selectedMemberId = useMediRouteStore((state) => state.selectedMemberId);
  const currentMember = useMediRouteStore(selectCurrentMember);
  const viewedMember = selectedMemberId
    ? familyData.members.find((member) => member.id === selectedMemberId) ?? currentMember
    : currentMember;
  const experience = resolveExperience(viewedMember);

  return {
    familyData,
    currentMember,
    viewedMember,
    experience,
    config: dashboardConfigs[experience],
    isCaregiver: currentMember.role === "caregiver"
  };
}
