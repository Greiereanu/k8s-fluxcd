import React, { useState, useEffect } from "react";
import { usersApi } from "../../api/client";
import { User } from "../../types";
import { User as UserIcon, Mail, MapPin, Calendar, ShieldCheck, AlertCircle } from "lucide-react";

export const ProfileView: React.FC = () => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await usersApi.getMe();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Review your personal information and system credentials
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Loading profile...
        </div>
      ) : profile ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center space-x-4">
            <div className="bg-indigo-600/30 border border-white/20 p-4 rounded-2xl">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.full_name || profile.username}</h2>
              <p className="text-xs text-indigo-200 font-mono mt-0.5">UUID: {profile.id}</p>
            </div>
          </div>

          <div className="p-6 divide-y divide-slate-100 space-y-4">
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-slate-500 flex items-center space-x-2">
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>Username</span>
              </span>
              <span className="text-sm font-semibold text-slate-900">{profile.username}</span>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-slate-500 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>Assigned Role</span>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700">
                {profile.role}
              </span>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-slate-500 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>Email Address</span>
              </span>
              <span className="text-sm font-medium text-slate-900">{profile.email || "Not specified"}</span>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-slate-500 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>Physical Address</span>
              </span>
              <span className="text-sm font-medium text-slate-900">{profile.address || "Not specified"}</span>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-slate-500 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Account Created</span>
              </span>
              <span className="text-sm font-medium text-slate-900">
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
