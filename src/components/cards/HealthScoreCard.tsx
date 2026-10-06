import { ShieldCheck } from "lucide-react";

export function HealthScoreCard({ score, label = "Health score" }: { score: number; label?: string }) {
  const circumference = 339.292;
  const offset = circumference - (circumference * score) / 100;

  return (
    <article className="score-card">
      <div className="score-copy">
        <span>{label}</span>
        <strong>{score}</strong>
        <small>{score >= 85 ? "Stable and improving" : score >= 70 ? "Needs routine attention" : "Care review needed"}</small>
      </div>
      <div className="progress-ring" aria-label={`${label}: ${score}%`}>
        <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
          <circle className="progress-bg" cx="60" cy="60" r="54" />
          <circle className="progress-fg" cx="60" cy="60" r="54" style={{ strokeDashoffset: offset }} />
        </svg>
        <div>
          <ShieldCheck size={18} />
          {score}%
        </div>
      </div>
    </article>
  );
}
