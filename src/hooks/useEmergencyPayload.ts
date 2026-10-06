import type { FamilyMember, Medicine } from "@/data/types";

export function useEmergencyPayload(member: FamilyMember, medicines: Medicine[]) {
  const memberMedicines = medicines.filter((medicine) => medicine.memberId === member.id);

  return {
    product: "MediRoute Emergency QR",
    memberId: member.id,
    name: member.name,
    age: member.age,
    relationship: member.relationship,
    bloodGroup: member.bloodGroup,
    allergies: member.allergies.length ? member.allergies.join(", ") : "None",
    conditions: member.conditions.length ? member.conditions.join(", ") : "None",
    activeMedicines: memberMedicines.map((medicine) => `${medicine.name} - ${medicine.dosage}`),
    emergencyContact: member.emergencyContact,
    doctor: member.doctor
  };
}
