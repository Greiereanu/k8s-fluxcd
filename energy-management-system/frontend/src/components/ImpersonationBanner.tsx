import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ShieldAlert, LogOut } from "lucide-react";

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, user, originalAdmin, stopImpersonation } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating || !user || !originalAdmin) return null;

  const handleExit = () => {
    stopImpersonation();
    navigate("/admin/dashboard");
  };

  return (
    <div className="bg-amber-500 text-slate-950 font-medium px-4 py-2.5 shadow-md flex items-center justify-between z-50 sticky top-0 border-b border-amber-600">
      <div className="flex items-center space-x-2 text-xs sm:text-sm">
        <ShieldAlert className="w-5 h-5 text-slate-950 flex-shrink-0" />
        <span>
          <strong className="font-bold">Impersonation Mode:</strong> You are currently viewing as{" "}
          <span className="bg-amber-600/30 px-1.5 py-0.5 rounded font-mono font-bold">
            {user.username}
          </span>{" "}
          (Role: {user.role}) &bull; Admin: {originalAdmin.username}
        </span>
      </div>

      <button
        onClick={handleExit}
        className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Exit Impersonation</span>
      </button>
    </div>
  );
};

