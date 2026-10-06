import { Plus } from "lucide-react";
import { FamilyCard } from "@/components/cards/FamilyCard";
import { SectionCard } from "@/components/cards/ModuleCard";
import { useToast } from "@/context/ToastContext";
import { useMediRouteStore } from "@/context/useMediRouteStore";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";

export function FamilyPage() {
  const { familyData, viewedMember, isCaregiver } = useDashboardExperience();
  const selectMember = useMediRouteStore((state) => state.selectMember);
  const { showToast } = useToast();

  return (
    <div className="dashboard-stack">
      <SectionCard
        eyebrow="Family account"
        title={isCaregiver ? "Manage family members" : "Family support"}
        action={
          isCaregiver && (
            <button type="button" className="text-action" onClick={() => showToast("Add member form is backend-ready")}>
              <Plus size={16} />
              Add
            </button>
          )
        }
      >
        <div className="family-list">
          {familyData.members.map((member) => (
            <FamilyCard key={member.id} member={member} active={member.id === viewedMember.id} onSelect={isCaregiver ? selectMember : undefined} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
