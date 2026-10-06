import type { DashboardConfig, ExperienceType } from "./types";

const baseNav = {
  dashboard: { id: "dashboard", label: "Home", path: "/dashboard", icon: "Home" },
  family: { id: "family", label: "Family", path: "/family", icon: "Users" },
  medicines: { id: "medicines", label: "Meds", path: "/medicines", icon: "Pill" },
  records: { id: "records", label: "Records", path: "/records", icon: "FolderHeart" },
  emergency: { id: "emergency", label: "SOS", path: "/emergency", icon: "Siren", highlight: true },
  profile: { id: "profile", label: "Profile", path: "/profile", icon: "UserRound" },
  wellness: { id: "wellness", label: "Wellness", path: "/dashboard", icon: "Activity" },
  growth: { id: "growth", label: "Growth", path: "/dashboard", icon: "LineChart" }
};

export const dashboardConfigs: Record<ExperienceType, DashboardConfig> = {
  caregiver: {
    experience: "caregiver",
    theme: "caregiver",
    title: "Family Health OS",
    subtitle: "Caregiver command center",
    modules: [
      "caregiverHero",
      "familyOverview",
      "familyHealthScore",
      "activeMedicines",
      "refillAlerts",
      "upcomingAppointments",
      "emergencyNotifications",
      "familyRecords",
      "emergencyQR",
      "futureInfrastructure"
    ],
    nav: [baseNav.dashboard, baseNav.family, baseNav.medicines, baseNav.emergency, baseNav.records, baseNav.profile]
  },
  women: {
    experience: "women",
    theme: "women",
    title: "Women's Health Hub",
    subtitle: "Personalized care layer",
    modules: [
      "womenHero",
      "periodTracking",
      "wellnessMonitoring",
      "nutritionSuggestions",
      "lifestyleGuidance",
      "pregnancyTracking",
      "pregnancySOS",
      "activeMedicines",
      "futureInfrastructure"
    ],
    nav: [baseNav.dashboard, baseNav.wellness, baseNav.medicines, baseNav.emergency, baseNav.records, baseNav.profile]
  },
  elder: {
    experience: "elder",
    theme: "elder",
    title: "Elder Care Dashboard",
    subtitle: "Accessible daily care",
    modules: [
      "elderHero",
      "medicineSchedule",
      "voiceReminders",
      "healthMonitoring",
      "elderAppointments",
      "emergencyAssistance",
      "caregiverSupport",
      "emergencyQR"
    ],
    nav: [baseNav.dashboard, baseNav.medicines, baseNav.wellness, baseNav.emergency, baseNav.family, baseNav.profile]
  },
  young: {
    experience: "young",
    theme: "young",
    title: "TeenPulse",
    subtitle: "Daily health XP tracker",
    modules: [
      "youngHero",
      "stressMonitoring",
      "sleepTracking",
      "waterIntake",
      "dailyInsights",
      "activityTracking",
      "emergencyQR"
    ],
    nav: [baseNav.dashboard, baseNav.wellness, baseNav.medicines, baseNav.emergency, baseNav.records, baseNav.profile]
  },
  child: {
    experience: "child",
    theme: "child",
    title: "Child Health Timeline",
    subtitle: "Pediatric care passport",
    modules: [
      "childHero",
      "vaccinationTracking",
      "growthMonitoring",
      "pediatricRecords",
      "childTimeline",
      "emergencyQR"
    ],
    nav: [baseNav.dashboard, baseNav.growth, baseNav.records, baseNav.emergency, baseNav.family, baseNav.profile]
  },
  adult: {
    experience: "adult",
    theme: "adult",
    title: "Health Dashboard",
    subtitle: "Personal care workspace",
    modules: ["adultHero", "wellnessMonitoring", "activeMedicines", "upcomingAppointments", "familyRecords", "emergencyQR"],
    nav: [baseNav.dashboard, baseNav.wellness, baseNav.medicines, baseNav.emergency, baseNav.records, baseNav.profile]
  }
};
