export type Gender = "female" | "male" | "other";

export type UserRole = "caregiver" | "member";

export type ExperienceType = "caregiver" | "women" | "elder" | "young" | "child" | "adult";

export type Permission =
  | "view_family"
  | "manage_family"
  | "manage_medicines"
  | "view_records"
  | "manage_appointments"
  | "receive_sos"
  | "view_emergency_qr";

export type ThemeName = "caregiver" | "women" | "elder" | "young" | "child" | "adult";

export interface HealthStat {
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "green" | "amber" | "rose" | "purple" | "cyan";
}

export interface Medicine {
  id: string;
  memberId: string;
  name: string;
  dosage: string;
  schedule: string;
  adherence: number;
  refillInDays: number;
  status: "due" | "taken" | "refill" | "stable";
}

export interface Appointment {
  id: string;
  memberId: string;
  doctor: string;
  specialty: string;
  date: string;
  location: string;
}

export interface HealthRecord {
  id: string;
  memberId: string;
  title: string;
  type: "prescription" | "lab" | "scan" | "vaccination" | "note";
  date: string;
  summary: string;
}

export interface AlertItem {
  id: string;
  memberId: string;
  title: string;
  body: string;
  severity: "critical" | "warning" | "info" | "success";
}

export interface Device {
  id: string;
  memberId: string;
  name: string;
  kind: "pillbox" | "watch" | "voice" | "glucometer" | "bp";
  status: "connected" | "syncing" | "offline";
  battery: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  relationship: string;
  gender: Gender;
  age: number;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
  emergencyContact: string;
  doctor: string;
  healthScore: number;
  permissions: Permission[];
  stats: HealthStat[];
}

export interface FamilyAccount {
  id: string;
  name: string;
  plan: string;
  abhaLinked: boolean;
  location: string;
}

export interface WomenHealthData {
  cycleDay: number;
  nextPeriod: string;
  fertileWindow: string;
  pregnancyWeek: number | null;
  mood: string;
  water: string;
  nutrition: string[];
  lifestyle: string[];
}

export interface YoungHealthData {
  level: number;
  xp: number;
  xpGoal: number;
  streak: number;
  stress: number;
  sleepHours: number;
  waterGlasses: number;
  activityMinutes: number;
  insights: string[];
}

export interface ChildHealthData {
  height: string;
  weight: string;
  nextVaccine: string;
  growthPercentile: string;
  milestones: string[];
}

export interface ElderHealthData {
  wellnessStatus: string;
  voiceReminder: string;
  lastCheckin: string;
  fallRisk: string;
}

export interface MockFamilyData {
  family: FamilyAccount;
  currentUserId: string;
  members: FamilyMember[];
  medicines: Medicine[];
  appointments: Appointment[];
  records: HealthRecord[];
  alerts: AlertItem[];
  devices: Device[];
  womenHealth: Record<string, WomenHealthData>;
  youngHealth: Record<string, YoungHealthData>;
  childHealth: Record<string, ChildHealthData>;
  elderHealth: Record<string, ElderHealthData>;
}

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  icon: string;
  highlight?: boolean;
}

export interface DashboardConfig {
  experience: ExperienceType;
  theme: ThemeName;
  title: string;
  subtitle: string;
  modules: string[];
  nav: NavItemConfig[];
}
