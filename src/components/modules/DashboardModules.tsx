import {
  Activity,
  Baby,
  Brain,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Dumbbell,
  HeartHandshake,
  HeartPulse,
  LineChart,
  Mic,
  Moon,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Syringe,
  Utensils,
  Watch
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { AlertCard } from "@/components/cards/AlertCard";
import { FamilyCard } from "@/components/cards/FamilyCard";
import { HealthScoreCard } from "@/components/cards/HealthScoreCard";
import { MedicineCard } from "@/components/cards/MedicineCard";
import { MetricCard } from "@/components/cards/MetricCard";
import { SectionCard } from "@/components/cards/ModuleCard";
import { EmergencyQR } from "@/components/qr/EmergencyQR";
import { useToast } from "@/context/ToastContext";
import { useMediRouteStore } from "@/context/useMediRouteStore";
import type { Appointment, FamilyMember, HealthRecord, Medicine } from "@/data/types";
import { futureModules } from "@/services/moduleCatalog";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";
import { useEmergencyPayload } from "@/hooks/useEmergencyPayload";
import { cx, percent } from "@/utils/formatters";

function visibleMemberIds(activeMember: FamilyMember, viewedMember: FamilyMember, isCaregiver: boolean) {
  if (isCaregiver && activeMember.id === viewedMember.id) return null;
  return [viewedMember.id];
}

function filterByMembers<T extends { memberId: string }>(items: T[], ids: string[] | null) {
  return ids ? items.filter((item) => ids.includes(item.memberId)) : items;
}

function ownerName(members: FamilyMember[], memberId: string) {
  return members.find((member) => member.id === memberId)?.name ?? "Family member";
}

function DashboardModule({ moduleId }: { moduleId: string }) {
  const registry: Record<string, () => ReactElement> = {
    caregiverHero: CaregiverHero,
    womenHero: WomenHero,
    elderHero: ElderHero,
    youngHero: YoungHero,
    childHero: ChildHero,
    adultHero: AdultHero,
    familyOverview: FamilyOverview,
    familyHealthScore: FamilyHealthScore,
    activeMedicines: ActiveMedicines,
    refillAlerts: RefillAlerts,
    upcomingAppointments: UpcomingAppointments,
    emergencyNotifications: EmergencyNotifications,
    familyRecords: FamilyRecords,
    emergencyQR: EmergencyQRModule,
    periodTracking: PeriodTracking,
    wellnessMonitoring: WellnessMonitoring,
    nutritionSuggestions: NutritionSuggestions,
    lifestyleGuidance: LifestyleGuidance,
    pregnancyTracking: PregnancyTracking,
    pregnancySOS: PregnancySOS,
    medicineSchedule: MedicineSchedule,
    voiceReminders: VoiceReminders,
    healthMonitoring: HealthMonitoring,
    elderAppointments: ElderAppointments,
    emergencyAssistance: EmergencyAssistance,
    caregiverSupport: CaregiverSupport,
    stressMonitoring: StressMonitoring,
    sleepTracking: SleepTracking,
    waterIntake: WaterIntake,
    dailyInsights: DailyInsights,
    activityTracking: ActivityTracking,
    vaccinationTracking: VaccinationTracking,
    growthMonitoring: GrowthMonitoring,
    pediatricRecords: PediatricRecords,
    childTimeline: ChildTimeline,
    futureInfrastructure: FutureInfrastructure
  };

  const Component = registry[moduleId] ?? FutureInfrastructure;
  return <Component />;
}

export function DashboardModules() {
  const { config } = useDashboardExperience();

  return (
    <div className="dashboard-stack">
      {config.modules.map((moduleId) => (
        <DashboardModule key={moduleId} moduleId={moduleId} />
      ))}
    </div>
  );
}

function CaregiverHero() {
  const { familyData, viewedMember } = useDashboardExperience();

  return (
    <section className="hero-card caregiver-hero">
      <div>
        <span>Adaptive family account</span>
        <h1>{familyData.family.name}</h1>
        <p>{familyData.family.plan} keeps every profile connected through one care graph.</p>
      </div>
      <div className="hero-score-row">
        <HealthScoreCard score={viewedMember.healthScore} label="Family health score" />
      </div>
      <div className="metric-grid">
        {viewedMember.stats.map((stat) => (
          <MetricCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function WomenHero() {
  const { familyData, viewedMember } = useDashboardExperience();
  const health = familyData.womenHealth[viewedMember.id] ?? familyData.womenHealth["member-women"];

  return (
    <section className="hero-card women-hero">
      <div className="ai-avatar">
        <Sparkles size={30} />
      </div>
      <div>
        <span>Emora health layer</span>
        <h1>{viewedMember.name}</h1>
        <p>Cycle, wellness, pregnancy, nutrition, and emergency support in one connected profile.</p>
      </div>
      <div className="quick-strip">
        <div>
          <strong>Day {health.cycleDay}</strong>
          <span>Cycle</span>
        </div>
        <div>
          <strong>{health.nextPeriod}</strong>
          <span>Next period</span>
        </div>
        <div>
          <strong>{health.mood}</strong>
          <span>Mood</span>
        </div>
      </div>
    </section>
  );
}

function ElderHero() {
  const { familyData, viewedMember } = useDashboardExperience();
  const elder = familyData.elderHealth[viewedMember.id] ?? familyData.elderHealth["member-elder"];

  return (
    <section className="hero-card elder-hero">
      <div>
        <span>{elder.lastCheckin}</span>
        <h1>{viewedMember.name}</h1>
        <p>{elder.voiceReminder}. Wellness is {elder.wellnessStatus.toLowerCase()} and fall risk is {elder.fallRisk.toLowerCase()}.</p>
      </div>
      <HealthScoreCard score={viewedMember.healthScore} label="Care score" />
      <div className="large-action-row">
        <button type="button" className="large-action ok">
          I'm Okay
        </button>
        <button type="button" className="large-action help">
          Need Help
        </button>
      </div>
    </section>
  );
}

function YoungHero() {
  const { familyData, viewedMember } = useDashboardExperience();
  const young = familyData.youngHealth[viewedMember.id] ?? familyData.youngHealth["member-young"];
  const xpPct = (young.xp / young.xpGoal) * 100;

  return (
    <section className="hero-card young-hero">
      <div>
        <span>Good morning</span>
        <h1>{viewedMember.name}</h1>
        <p>Stress, sleep, hydration, activity, and daily wellness insights become XP.</p>
      </div>
      <div className="xp-card">
        <strong>Level {young.level}</strong>
        <div>
          <span>
            {young.xp} / {young.xpGoal} XP
          </span>
          <div className="mini-progress">
            <span style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        <em>{young.streak} day streak</em>
      </div>
    </section>
  );
}

function ChildHero() {
  const { familyData, viewedMember } = useDashboardExperience();
  const child = familyData.childHealth[viewedMember.id] ?? familyData.childHealth["member-child"];

  return (
    <section className="hero-card child-hero">
      <div>
        <span>Pediatric profile</span>
        <h1>{viewedMember.name}</h1>
        <p>Vaccines, growth, pediatric records, and emergency allergy flags stay connected to the family OS.</p>
      </div>
      <div className="quick-strip">
        <div>
          <strong>{child.nextVaccine}</strong>
          <span>Next vaccine</span>
        </div>
        <div>
          <strong>{child.growthPercentile}</strong>
          <span>Growth</span>
        </div>
      </div>
    </section>
  );
}

function AdultHero() {
  const { viewedMember } = useDashboardExperience();

  return (
    <section className="hero-card adult-hero">
      <div>
        <span>Personal health workspace</span>
        <h1>{viewedMember.name}</h1>
        <p>Daily vitals, medicines, appointments, records, and emergency profile in one account.</p>
      </div>
      <div className="metric-grid">
        {viewedMember.stats.map((stat) => (
          <MetricCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function FamilyOverview() {
  const { familyData, viewedMember, isCaregiver } = useDashboardExperience();
  const selectMember = useMediRouteStore((state) => state.selectMember);
  const { showToast } = useToast();

  return (
    <SectionCard
      eyebrow="Family overview"
      title="Connected profiles"
      action={
        isCaregiver && (
          <button type="button" className="text-action" onClick={() => showToast("Add member flow is ready for backend storage")}>
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
  );
}

function FamilyHealthScore() {
  const { viewedMember } = useDashboardExperience();

  return (
    <SectionCard eyebrow="Health score" title="Personalized risk snapshot">
      <HealthScoreCard score={viewedMember.healthScore} />
      <div className="metric-grid">
        {viewedMember.stats.map((stat) => (
          <MetricCard key={stat.label} stat={stat} />
        ))}
      </div>
    </SectionCard>
  );
}

function ActiveMedicines() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const markMedicineTaken = useMediRouteStore((state) => state.markMedicineTaken);
  const { showToast } = useToast();
  const ids = visibleMemberIds(currentMember, viewedMember, isCaregiver);
  const medicines = filterByMembers(familyData.medicines, ids);

  return (
    <SectionCard eyebrow="Active medicines" title="Medicine schedule">
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
  );
}

function RefillAlerts() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const ids = visibleMemberIds(currentMember, viewedMember, isCaregiver);
  const medicines = filterByMembers(familyData.medicines, ids).filter((medicine) => medicine.refillInDays <= 7);

  return (
    <SectionCard eyebrow="Refill alerts" title="Stock needs attention">
      <div className="compact-list">
        {medicines.map((medicine) => (
          <InfoRow
            key={medicine.id}
            icon={<Pill size={18} />}
            title={medicine.name}
            body={`${ownerName(familyData.members, medicine.memberId)} needs refill in ${medicine.refillInDays} days`}
            tone="amber"
          />
        ))}
      </div>
    </SectionCard>
  );
}

function UpcomingAppointments() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const ids = visibleMemberIds(currentMember, viewedMember, isCaregiver);
  const appointments = filterByMembers(familyData.appointments, ids);

  return <AppointmentList appointments={appointments} members={familyData.members} title="Upcoming appointments" />;
}

function EmergencyNotifications() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const ids = visibleMemberIds(currentMember, viewedMember, isCaregiver);
  const alerts = filterByMembers(familyData.alerts, ids);

  return (
    <SectionCard eyebrow="Emergency notifications" title="Alerts and escalation">
      <div className="alert-list">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} members={familyData.members} />
        ))}
      </div>
    </SectionCard>
  );
}

function FamilyRecords() {
  const { familyData, currentMember, viewedMember, isCaregiver } = useDashboardExperience();
  const ids = visibleMemberIds(currentMember, viewedMember, isCaregiver);
  const records = filterByMembers(familyData.records, ids);

  return <RecordsList records={records} members={familyData.members} title="Family records" />;
}

function EmergencyQRModule() {
  const { familyData, viewedMember } = useDashboardExperience();
  const payload = useEmergencyPayload(viewedMember, familyData.medicines);

  return (
    <SectionCard eyebrow="Emergency infrastructure" title="QR medical summary">
      <EmergencyQR payload={payload} />
      <div className="emergency-grid">
        <InfoTile label="Blood Group" value={viewedMember.bloodGroup} />
        <InfoTile label="Allergies" value={viewedMember.allergies.join(", ") || "None"}/>
        <InfoTile label="Emergency Contact" value={viewedMember.emergencyContact} />
        <InfoTile label="Doctor" value={viewedMember.doctor} />
      </div>
    </SectionCard>
  );
}

function PeriodTracking() {
  const { familyData, viewedMember } = useDashboardExperience();
  const health = familyData.womenHealth[viewedMember.id] ?? familyData.womenHealth["member-women"];

  return (
    <SectionCard eyebrow="Period tracking" title="Cycle intelligence">
      <div className="cycle-card">
        <InfoTile label="Current day" value={`Day ${health.cycleDay}`} />
        <InfoTile label="Next period" value={health.nextPeriod} />
        <InfoTile label="Fertile window" value={health.fertileWindow} />
        <InfoTile label="Mood" value={health.mood} />
      </div>
      <div className="calendar-mini">
        {Array.from({ length: 28 }, (_, index) => (
          <span key={index} className={cx(index + 1 === health.cycleDay && "active", index > 10 && index < 16 && "fertile")}>
            {index + 1}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

function WellnessMonitoring() {
  const { viewedMember } = useDashboardExperience();

  return (
    <SectionCard eyebrow="Wellness monitoring" title="Today's signals">
      <div className="wellness-grid">
        {viewedMember.stats.map((stat) => (
          <MetricCard key={stat.label} stat={stat} />
        ))}
      </div>
    </SectionCard>
  );
}

function NutritionSuggestions() {
  const { familyData, viewedMember } = useDashboardExperience();
  const health = familyData.womenHealth[viewedMember.id] ?? familyData.womenHealth["member-women"];

  return (
    <SectionCard eyebrow="Nutrition" title="Smart suggestions">
      <Checklist items={health.nutrition} icon={<Utensils size={18} />} />
    </SectionCard>
  );
}

function LifestyleGuidance() {
  const { familyData, viewedMember } = useDashboardExperience();
  const health = familyData.womenHealth[viewedMember.id] ?? familyData.womenHealth["member-women"];

  return (
    <SectionCard eyebrow="Lifestyle" title="Daily guidance">
      <Checklist items={health.lifestyle} icon={<Sparkles size={18} />} />
    </SectionCard>
  );
}

function PregnancyTracking() {
  const { familyData, viewedMember } = useDashboardExperience();
  const health = familyData.womenHealth[viewedMember.id] ?? familyData.womenHealth["member-women"];
  const week = health.pregnancyWeek;

  return (
    <SectionCard eyebrow="Pregnancy tracking" title={week ? `Week ${week} care plan` : "Pregnancy care"}>
      <div className="split-metrics">
        <InfoTile label="Appointment" value="OB-GYN review" />
        <InfoTile label="Nutrition" value="Iron and folate" />
        <InfoTile label="Movement" value="Light walk" />
        <InfoTile label="Emergency" value="SOS ready" />
      </div>
    </SectionCard>
  );
}

function PregnancySOS() {
  const { showToast } = useToast();

  return (
    <SectionCard eyebrow="Emergency pregnancy SOS" title="Rapid escalation">
      <button type="button" className="sos-button" onClick={() => showToast("Pregnancy SOS simulation sent to caregiver")}>
        <Siren size={22} />
        Trigger pregnancy SOS
      </button>
    </SectionCard>
  );
}

function MedicineSchedule() {
  return <ActiveMedicines />;
}

function VoiceReminders() {
  const { familyData, viewedMember } = useDashboardExperience();
  const devices = familyData.devices.filter((device) => device.memberId === viewedMember.id || device.kind === "voice");

  return (
    <SectionCard eyebrow="Voice reminder support" title="Family voice reminders">
      <div className="device-grid">
        {devices.map((device) => (
          <InfoRow
            key={device.id}
            icon={device.kind === "voice" ? <Mic size={18} /> : <Watch size={18} />}
            title={device.name}
            body={`${device.status} - battery ${device.battery}`}
            tone={device.status === "connected" ? "green" : "amber"}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function HealthMonitoring() {
  const { viewedMember } = useDashboardExperience();

  return (
    <SectionCard eyebrow="Health monitoring" title="Accessible vitals">
      <div className="split-metrics">
        <InfoTile label="BP" value="120/78" />
        <InfoTile label="Sugar" value="110 mg/dL" />
        <InfoTile label="Adherence" value="92%" />
        <InfoTile label="Fall risk" value="Low" />
      </div>
      <HealthScoreCard score={viewedMember.healthScore} label="Monitoring score" />
    </SectionCard>
  );
}

function ElderAppointments() {
  const { familyData, viewedMember } = useDashboardExperience();
  const appointments = familyData.appointments.filter((appointment) => appointment.memberId === viewedMember.id);
  return <AppointmentList appointments={appointments} members={familyData.members} title="Doctor appointments" />;
}

function EmergencyAssistance() {
  const { showToast } = useToast();

  return (
    <SectionCard eyebrow="Emergency assistance" title="One-tap help">
      <div className="large-action-row">
        <button type="button" className="large-action ok" onClick={() => showToast("Caregiver notified: I'm okay")}>
          I'm Okay
        </button>
        <button type="button" className="large-action help" onClick={() => showToast("Emergency assistance simulation triggered")}>
          Need Help
        </button>
      </div>
    </SectionCard>
  );
}

function CaregiverSupport() {
  const { familyData } = useDashboardExperience();
  const caregivers = familyData.members.filter((member) => member.role === "caregiver");

  return (
    <SectionCard eyebrow="Caregiver permissions" title="Support network">
      <div className="family-list">
        {caregivers.map((member) => (
          <FamilyCard key={member.id} member={member} />
        ))}
      </div>
    </SectionCard>
  );
}

function StressMonitoring() {
  const { familyData, viewedMember } = useDashboardExperience();
  const young = familyData.youngHealth[viewedMember.id] ?? familyData.youngHealth["member-young"];

  return (
    <SectionCard eyebrow="Stress monitoring" title="Mental load">
      <Dial value={young.stress} label="Stress" icon={<Brain size={20} />} />
    </SectionCard>
  );
}

function SleepTracking() {
  const { familyData, viewedMember } = useDashboardExperience();
  const young = familyData.youngHealth[viewedMember.id] ?? familyData.youngHealth["member-young"];

  return (
    <SectionCard eyebrow="Sleep tracking" title="Recovery score">
      <InfoRow icon={<Moon size={18} />} title={`${young.sleepHours} hours`} body="Good recovery window, keep bedtime consistent." tone="blue" />
    </SectionCard>
  );
}

function WaterIntake() {
  const { familyData, viewedMember } = useDashboardExperience();
  const addWaterGlass = useMediRouteStore((state) => state.addWaterGlass);
  const young = familyData.youngHealth[viewedMember.id] ?? familyData.youngHealth["member-young"];

  return (
    <SectionCard
      eyebrow="Water intake"
      title={`${young.waterGlasses} / 8 glasses`}
      action={
        <button type="button" className="text-action" onClick={() => addWaterGlass(viewedMember.id)}>
          <Plus size={16} />
          Glass
        </button>
      }
    >
      <div className="water-row">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className={index < young.waterGlasses ? "filled" : ""}>
            <Droplets size={18} />
          </span>
        ))}
      </div>
    </SectionCard>
  );
}

function DailyInsights() {
  const { familyData, viewedMember } = useDashboardExperience();
  const young = familyData.youngHealth[viewedMember.id] ?? familyData.youngHealth["member-young"];

  return (
    <SectionCard eyebrow="Daily wellness insights" title="Coach notes">
      <Checklist items={young.insights} icon={<Sparkles size={18} />} />
    </SectionCard>
  );
}

function ActivityTracking() {
  const { familyData, viewedMember } = useDashboardExperience();
  const young = familyData.youngHealth[viewedMember.id] ?? familyData.youngHealth["member-young"];

  return (
    <SectionCard eyebrow="Activity tracking" title="Movement today">
      <InfoRow icon={<Dumbbell size={18} />} title={`${young.activityMinutes} active minutes`} body="Goal: 60 minutes" tone="green" />
      <div className="mini-progress">
        <span style={{ width: `${Math.min(100, (young.activityMinutes / 60) * 100)}%` }} />
      </div>
    </SectionCard>
  );
}

function VaccinationTracking() {
  const { familyData, viewedMember } = useDashboardExperience();
  const child = familyData.childHealth[viewedMember.id] ?? familyData.childHealth["member-child"];

  return (
    <SectionCard eyebrow="Vaccination tracking" title="Immunization plan">
      <InfoRow icon={<Syringe size={18} />} title={child.nextVaccine} body="Scheduled in the pediatric timeline" tone="amber" />
    </SectionCard>
  );
}

function GrowthMonitoring() {
  const { familyData, viewedMember } = useDashboardExperience();
  const child = familyData.childHealth[viewedMember.id] ?? familyData.childHealth["member-child"];

  return (
    <SectionCard eyebrow="Growth monitoring" title="Growth snapshot">
      <div className="split-metrics">
        <InfoTile label="Height" value={child.height} />
        <InfoTile label="Weight" value={child.weight} />
        <InfoTile label="Percentile" value={child.growthPercentile} />
        <InfoTile label="Score" value={String(viewedMember.healthScore)} />
      </div>
    </SectionCard>
  );
}

function PediatricRecords() {
  const { familyData, viewedMember } = useDashboardExperience();
  const records = familyData.records.filter((record) => record.memberId === viewedMember.id);
  return <RecordsList records={records} members={familyData.members} title="Pediatric records" />;
}

function ChildTimeline() {
  const { familyData, viewedMember } = useDashboardExperience();
  const child = familyData.childHealth[viewedMember.id] ?? familyData.childHealth["member-child"];

  return (
    <SectionCard eyebrow="Child health timeline" title="Milestones">
      <Checklist items={child.milestones} icon={<Baby size={18} />} />
    </SectionCard>
  );
}

function FutureInfrastructure() {
  return (
    <SectionCard eyebrow="Future modules" title="Scale-ready infrastructure">
      <div className="future-grid">
        {futureModules.map((module) => (
          <article key={module.title} className="future-card">
            <strong>{module.title}</strong>
            <span>{module.status}</span>
            <p>{module.body}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function AppointmentList({ appointments, members, title }: { appointments: Appointment[]; members: FamilyMember[]; title: string }) {
  return (
    <SectionCard eyebrow="Appointments" title={title}>
      <div className="compact-list">
        {appointments.map((appointment) => (
          <InfoRow
            key={appointment.id}
            icon={<CalendarDays size={18} />}
            title={appointment.specialty}
            body={`${appointment.doctor} - ${appointment.date} - ${ownerName(members, appointment.memberId)}`}
            tone="blue"
          />
        ))}
      </div>
    </SectionCard>
  );
}

function RecordsList({ records, members, title }: { records: HealthRecord[]; members: FamilyMember[]; title: string }) {
  return (
    <SectionCard eyebrow="Records" title={title}>
      <div className="record-list">
        {records.map((record) => (
          <article key={record.id} className="record-card">
            <div>
              <Stethoscope size={18} />
            </div>
            <strong>{record.title}</strong>
            <span>
              {record.type} - {record.date} - {ownerName(members, record.memberId)}
            </span>
            <p>{record.summary}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function Checklist({ items, icon }: { items: string[]; icon: ReactNode }) {
  return (
    <div className="check-list">
      {items.map((item) => (
        <div key={item}>
          <span>{icon}</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}

function InfoRow({
  icon,
  title,
  body,
  tone
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone: "blue" | "green" | "amber" | "rose" | "purple" | "cyan";
}) {
  return (
    <article className={cx("info-row", `tone-${tone}`)}>
      <div>{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Dial({ value, label, icon }: { value: number; label: string; icon: ReactNode }) {
  return (
    <div className="dial-card">
      <div className="dial" style={{ background: `conic-gradient(var(--primary) ${percent(value)}, rgba(255,255,255,0.14) 0)` }}>
        <span>
          {icon}
          {value}%
        </span>
      </div>
      <div>
        <strong>{label}</strong>
        <p>Lower is better. Personalized recommendations adapt through profile signals.</p>
      </div>
    </div>
  );
}
