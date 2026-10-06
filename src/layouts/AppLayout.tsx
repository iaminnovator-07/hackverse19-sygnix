import { Outlet } from "react-router-dom";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { Navbar } from "@/components/navigation/Navbar";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";

export function AppLayout() {
  const { config } = useDashboardExperience();

  return (
    <div className={`viewport theme-${config.theme}`}>
      <div className="app-phone">
        <Navbar />
        <main className="screen-scroll">
          <Outlet />
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
