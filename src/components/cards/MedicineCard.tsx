import { CheckCircle2, Clock3, Pill, RefreshCw } from "lucide-react";
import type { Medicine } from "@/data/types";
import { getMemberName } from "@/context/useMediRouteStore";
import type { FamilyMember } from "@/data/types";
import { cx } from "@/utils/formatters";

export function MedicineCard({
  medicine,
  members,
  onTaken
}: {
  medicine: Medicine;
  members: FamilyMember[];
  onTaken?: (medicineId: string) => void;
}) {
  const refillSoon = medicine.refillInDays <= 7;

  return (
    <article className={cx("medicine-card", medicine.status === "taken" && "taken", refillSoon && "refill")}>
      <div className="medicine-icon">
        <Pill size={20} />
      </div>
      <div className="medicine-content">
        <div>
          <strong>{medicine.name}</strong>
          <span>{getMemberName(members, medicine.memberId)}</span>
        </div>
        <p>{medicine.dosage}</p>
        <div className="medicine-meta">
          <span>
            <Clock3 size={14} />
            {medicine.schedule}
          </span>
          <span>
            <RefreshCw size={14} />
            Refill {medicine.refillInDays}d
          </span>
        </div>
        <div className="mini-progress">
          <span style={{ width: `${medicine.adherence}%` }} />
        </div>
      </div>
      <button type="button" className="icon-action" onClick={() => onTaken?.(medicine.id)} aria-label="Mark medicine taken">
        <CheckCircle2 size={19} />
      </button>
    </article>
  );
}
