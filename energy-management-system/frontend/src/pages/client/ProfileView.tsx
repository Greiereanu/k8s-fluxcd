import React, { useState, useEffect } from "react";
import { usersApi } from "../../api/client";
import { User } from "../../types";
import { Modal } from "../../components/Modal";
import { User as UserIcon, Mail, MapPin, Calendar, ShieldCheck, AlertCircle, Edit2, CheckCircle2 } from "lucide-react";

export const ProfileView: React.FC = () => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersApi.getMe();
      setProfile(data);
      setFullName(data.full_name || "");
      setEmail(data.email || "");
      setAddress(data.address || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const updated = await usersApi.updateMe({
        full_name: fullName.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      });
      setProfile(updated);
      setEditModalOpen(false);
      setSuccessMsg("Profile information updated successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Review and update your personal information and contact specifications
          </p>
        </div>

        {profile && (
          <button
            onClick={() => {
              setFullName(profile.full_name || "");
              setEmail(profile.email || "");
              setAddress(profile.address || "");
              setEditModalOpen(true);
            }}
            className="mt-4 sm:mt-0 inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

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
              <span className="text-sm font-semibold text-slate-900 font-mono">{profile.username}</span>
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

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Update Your Profile Information">
        {editError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">
            {editError}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Ionut Popescu"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. ionut@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Physical Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Main Street 42, Bucharest"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
