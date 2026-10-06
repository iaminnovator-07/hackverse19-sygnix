import type { HealthStat } from "@/data/types";
import { cx } from "@/utils/formatters";

export function MetricCard({ stat }: { stat: HealthStat }) {
  return (
    <article className={cx("metric-card", `tone-${stat.tone}`)}>
      <span>{stat.label}</span>
      <strong>{stat.value}</strong>
      <small>{stat.hint}</small>
    </article>
  );
}
