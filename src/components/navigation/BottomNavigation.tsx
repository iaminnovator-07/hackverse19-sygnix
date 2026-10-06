import { NavLink } from "react-router-dom";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";
import { navIconMap, type NavIconName } from "./iconMap";

export function BottomNavigation() {
  const { config } = useDashboardExperience();

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {config.nav.map((item) => {
        const Icon = navIconMap[item.icon as NavIconName] ?? navIconMap.Home;
        return (
          <NavLink key={item.id} to={item.path} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
            <span className={item.highlight ? "nav-icon emergency" : "nav-icon"}>
              <Icon size={20} />
            </span>
            <small>{item.label}</small>
          </NavLink>
        );
      })}
    </nav>
  );
}
