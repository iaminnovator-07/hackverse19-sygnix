import { FileHeart, Upload } from "lucide-react";
import { SectionCard } from "@/components/cards/ModuleCard";
import { useToast } from "@/context/ToastContext";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";

export function RecordsPage() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const { showToast } = useToast();
  const records =
    isCaregiver && currentMember.id === viewedMember.id
      ? familyData.records
      : familyData.records.filter((record) => record.memberId === viewedMember.id);

  return (
    <div className="dashboard-stack">
      <SectionCard
        eyebrow="Records"
        title="Prescription vault"
        action={
          <button type="button" className="text-action" onClick={() => showToast("Upload flow is ready for prescription parsing")}>
            <Upload size={16} />
            Upload
          </button>
        }
      >
        <div className="record-list">
          {records.map((record) => (
            <article key={record.id} className="record-card">
              <div>
                <FileHeart size={18} />
              </div>
              <strong>{record.title}</strong>
              <span>
                {record.type} - {record.date}
              </span>
              <p>{record.summary}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
