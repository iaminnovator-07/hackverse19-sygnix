import mockFamily from "@/data/mockFamily.json";
import type { MockFamilyData } from "@/data/types";

export interface HealthRepository {
  getFamilyAccount(): Promise<MockFamilyData>;
  saveFamilyAccount(data: MockFamilyData): Promise<MockFamilyData>;
}

export const mockHealthRepository: HealthRepository = {
  async getFamilyAccount() {
    return mockFamily as MockFamilyData;
  },
  async saveFamilyAccount(data) {
    return data;
  }
};

export const backendReadiness = {
  supabase: {
    status: "adapter-ready",
    tables: ["families", "profiles", "medicines", "records", "alerts", "devices"]
  },
  postgresql: {
    status: "schema-ready",
    notes: "IDs and member ownership already map to relational rows."
  },
  abha: {
    status: "integration-boundary-ready",
    notes: "Emergency and record objects isolate ABHA health identifiers from UI components."
  },
  aiAssistant: {
    status: "service-boundary-ready",
    modules: ["AI Caregiver Assistant", "Prescription Parsing", "Refill Prediction"]
  },
  iotDevices: {
    status: "device-model-ready",
    modules: ["Smart Pill Box", "Voice Reminder Device", "Wearable Sync"]
  },
  offlineFirst: {
    status: "queue-boundary-ready",
    notes: "Future sync can replace the mock repository without changing dashboards."
  }
};
