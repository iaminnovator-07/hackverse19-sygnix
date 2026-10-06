export const percent = (value: number) => `${Math.round(value)}%`;

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function byDateLabel(label: string) {
  return label;
}

export function fullEmergencySummary(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}
