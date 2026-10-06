import { Navigate, useNavigate } from "react-router-dom";
import { HeartPulse, LogIn, ShieldCheck, Users } from "lucide-react";
import { FamilyCard } from "@/components/cards/FamilyCard";
import { useMediRouteStore } from "@/context/useMediRouteStore";
import { resolveExperience } from "@/utils/roleResolver";

export function LoginPage() {
  const navigate = useNavigate();
  const familyData = useMediRouteStore((state) => state.familyData);
  const currentUserId = useMediRouteStore((state) => state.currentUserId);
  const setCurrentUser = useMediRouteStore((state) => state.setCurrentUser);

  if (!familyData.members.length) return <Navigate to="/dashboard" replace />;

  return (
    <section className="login-screen">
      <div className="login-brand">
        <div className="brand-mark">
          <HeartPulse size={28} />
        </div>
        <span>MediRoute</span>
        <h1>Adaptive Family Healthcare Operating System</h1>
        <p>One family account. Role-aware dashboards. Shared emergency infrastructure.</p>
      </div>

      <div className="login-card">
        <div className="section-card-header">
          <div>
            <span>Mock login</span>
            <h2>Choose family profile</h2>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="family-list">
          {familyData.members.map((member) => (
            <FamilyCard
              key={member.id}
              member={member}
              active={member.id === currentUserId}
              onSelect={(memberId) => {
                setCurrentUser(memberId);
              }}
            />
          ))}
        </div>
        <button type="button" className="primary-action" onClick={() => navigate("/dashboard")}>
          <LogIn size={18} />
          Continue as {familyData.members.find((member) => member.id === currentUserId)?.name}
        </button>
      </div>

      <div className="login-foot">
        <Users size={16} />
        <span>
          Active experience: {resolveExperience(familyData.members.find((member) => member.id === currentUserId) ?? familyData.members[0])}
        </span>
      </div>
    </section>
  );
}
