import React, { useState, useEffect } from "react";
import { Modal } from "../../components/Modal";
import { User, UserRole } from "../../types";
import { usersApi } from "../../api/client";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit?: User | null;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSuccess, userToEdit }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<UserRole>("CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setUsername(userToEdit.username);
      setEmail(userToEdit.email || "");
      setFullName(userToEdit.full_name || "");
      setAddress(userToEdit.address || "");
      setRole(userToEdit.role);
      setPassword("");
    } else {
      setUsername("");
      setPassword("");
      setEmail("");
      setFullName("");
      setAddress("");
      setRole("CLIENT");
    }
    setError(null);
  }, [userToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (userToEdit) {
        await usersApi.update(userToEdit.id, {
          email: email.trim() || undefined,
          full_name: fullName.trim() || undefined,
          address: address.trim() || undefined,
          role,
          password: password.trim() ? password.trim() : undefined,
        });
      } else {
        if (!password) {
          setError("Password is required for new users");
          setLoading(false);
          return;
        }
        await usersApi.create({
          username: username.trim(),
          password: password.trim(),
          email: email.trim() || undefined,
          full_name: fullName.trim() || undefined,
          address: address.trim() || undefined,
          role,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={userToEdit ? `Edit User: ${userToEdit.username}` : "Create New User"}>
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Username
          </label>
          <input
            type="text"
            required
            disabled={!!userToEdit}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 font-mono"
            placeholder="e.g. john_doe"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="john@example.com"
            />
          </div>
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
            placeholder="Main Street 123"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="CLIENT">Client</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            {userToEdit ? "Reset Password (Optional)" : "Password *"}
          </label>
          <input
            type="password"
            required={!userToEdit}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={userToEdit ? "Leave blank to keep current password" : "••••••••"}
          />
        </div>

        <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : userToEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
