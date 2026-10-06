import { create } from "zustand";
import mockFamily from "@/data/mockFamily.json";
import type { FamilyMember, Medicine, MockFamilyData } from "@/data/types";

type MediRouteState = {
  familyData: MockFamilyData;
  currentUserId: string;
  selectedMemberId: string | null;
  setCurrentUser: (memberId: string) => void;
  selectMember: (memberId: string | null) => void;
  addWaterGlass: (memberId: string) => void;
  markMedicineTaken: (medicineId: string) => void;
};

const initialData = mockFamily as MockFamilyData;

export const useMediRouteStore = create<MediRouteState>((set) => ({
  familyData: initialData,
  currentUserId: initialData.currentUserId,
  selectedMemberId: null,
  setCurrentUser: (memberId) =>
    set({
      currentUserId: memberId,
      selectedMemberId: null
    }),
  selectMember: (memberId) => set({ selectedMemberId: memberId }),
  addWaterGlass: (memberId) =>
    set((state) => ({
      familyData: {
        ...state.familyData,
        youngHealth: {
          ...state.familyData.youngHealth,
          [memberId]: state.familyData.youngHealth[memberId]
            ? {
                ...state.familyData.youngHealth[memberId],
                waterGlasses: Math.min(8, state.familyData.youngHealth[memberId].waterGlasses + 1)
              }
            : state.familyData.youngHealth[memberId]
        }
      }
    })),
  markMedicineTaken: (medicineId) =>
    set((state) => ({
      familyData: {
        ...state.familyData,
        medicines: state.familyData.medicines.map((medicine) =>
          medicine.id === medicineId
            ? {
                ...medicine,
                status: "taken",
                adherence: Math.min(100, medicine.adherence + 2)
              }
            : medicine
        )
      }
    }))
}));

export function selectCurrentMember(state: MediRouteState): FamilyMember {
  return state.familyData.members.find((member) => member.id === state.currentUserId) ?? state.familyData.members[0];
}

export function getMemberName(members: FamilyMember[], id: string) {
  return members.find((member) => member.id === id)?.name ?? "Family member";
}

export function getMemberMedicines(medicines: Medicine[], memberId: string) {
  return medicines.filter((medicine) => medicine.memberId === memberId);
}
