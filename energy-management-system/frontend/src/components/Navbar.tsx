import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, LogOut, User, Cpu } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link to={isAdmin ? "/admin/dashboard" : "/client/dashboard"} className="flex items-center space-x-3">
              <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm">
                <Zap className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Energy Management System</span>
            </Link>

            <nav className="hidden md:flex space-x-2">
              {isAdmin ? (
                <>
                  <Link
                    to="/admin/dashboard"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/client/dashboard"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition-colors flex items-center space-x-1.5"
                  >
                    <Cpu className="w-4 h-4" />
                    <span>My Devices</span>
                  </Link>
                  <Link
                    to="/client/profile"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition-colors flex items-center space-x-1.5"
                  >
                    <User className="w-4 h-4" />
                    <span>My Profile</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-full">
              <span className="text-xs font-semibold text-slate-700">{user.username}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isAdmin ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {user.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1 text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-md transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
