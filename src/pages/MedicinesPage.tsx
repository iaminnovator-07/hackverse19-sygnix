import { MedicineCard } from "@/components/cards/MedicineCard";
import { SectionCard } from "@/components/cards/ModuleCard";
import { useToast } from "@/context/ToastContext";
import { useMediRouteStore } from "@/context/useMediRouteStore";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";

export function MedicinesPage() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const markMedicineTaken = useMediRouteStore((state) => state.markMedicineTaken);
  const { showToast } = useToast();
  const medicines =
    isCaregiver && currentMember.id === viewedMember.id
      ? familyData.medicines
      : familyData.medicines.filter((medicine) => medicine.memberId === viewedMember.id);

  return (
    <div className="dashboard-stack">
      <SectionCard eyebrow="Medicines" title={isCaregiver ? "Family active medicines" : "My schedule"}>
        <div className="medicine-list">
          {medicines.map((medicine) => (
            <MedicineCard
              key={medicine.id}
              medicine={medicine}
              members={familyData.members}
              onTaken={(medicineId) => {
                markMedicineTaken(medicineId);
                showToast("Medicine marked as taken");
              }}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
