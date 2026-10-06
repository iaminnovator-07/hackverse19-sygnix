import { Bell, HeartPulse, Menu, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardExperience } from "@/hooks/useDashboardExperience";
import { useMediRouteStore } from "@/context/useMediRouteStore";

export function Navbar() {
  const navigate = useNavigate();
  const { config, currentMember, familyData, viewedMember, isCaregiver } = useDashboardExperience();
  const setCurrentUser = useMediRouteStore((state) => state.setCurrentUser);

  return (
    <header className="app-topbar">
      <div className="brand-block">
        <span>{config.subtitle}</span>
        <strong>{config.title}</strong>
      </div>
      <div className="topbar-actions">
        <button type="button" className="round-button" aria-label="Search health records">
          <Search size={17} />
        </button>
        <button type="button" className="round-button has-dot" aria-label="Notifications">
          <Bell size={17} />
        </button>
        <button type="button" className="round-button mobile-menu" aria-label="Open menu">
          <Menu size={17} />
        </button>
      </div>
      <div className="profile-switcher">
        <HeartPulse size={16} />
        <select
          aria-label="Switch active family profile"
          value={currentMember.id}
          onChange={(event) => {
            setCurrentUser(event.target.value);
            navigate("/dashboard");
          }}
        >
          {familyData.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        {isCaregiver && viewedMember.id !== currentMember.id && <small>Viewing {viewedMember.name}</small>}
      </div>
    </header>
  );
}
