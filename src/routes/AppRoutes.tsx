import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { EmergencyPage } from "@/pages/EmergencyPage";
import { FamilyPage } from "@/pages/FamilyPage";
import { LoginPage } from "@/pages/LoginPage";
import { MedicinesPage } from "@/pages/MedicinesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RecordsPage } from "@/pages/RecordsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/medicines" element={<MedicinesPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/emergency" element={<EmergencyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
