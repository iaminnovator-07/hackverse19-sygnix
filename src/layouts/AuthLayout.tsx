import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="viewport theme-caregiver">
      <div className="app-phone auth-phone">
        <Outlet />
      </div>
    </div>
  );
}
