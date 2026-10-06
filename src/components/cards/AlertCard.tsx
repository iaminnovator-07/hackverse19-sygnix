import { AlertTriangle, Bell, CheckCircle2, Info, Siren } from "lucide-react";
import type { AlertItem, FamilyMember } from "@/data/types";
import { getMemberName } from "@/context/useMediRouteStore";
import { cx } from "@/utils/formatters";

const iconMap = {
  critical: Siren,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2
};

export function AlertCard({ alert, members }: { alert: AlertItem; members: FamilyMember[] }) {
  const Icon = iconMap[alert.severity] ?? Bell;

  return (
    <article className={cx("alert-card", `severity-${alert.severity}`)}>
      <div className="alert-icon">
        <Icon size={20} />
      </div>
      <div>
        <strong>{alert.title}</strong>
        <p>{alert.body}</p>
        <span>{getMemberName(members, alert.memberId)}</span>
      </div>
    </article>
  );
}
