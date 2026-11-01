import React, { useState, useEffect } from "react";
import { Modal } from "../../components/Modal";
import { Device, User } from "../../types";
import { devicesApi } from "../../api/client";

interface AssignDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  device: Device | null;
  users: User[];
}

export const AssignDeviceModal: React.FC<AssignDeviceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  device,
  users,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (device) {
      setSelectedUserId(device.assigned_user_id || "");
    }
    setError(null);
  }, [device, isOpen]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    if (!selectedUserId) {
      setError("Please select a user to assign the device to");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await devicesApi.assign(device.id, selectedUserId);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign device");
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!device) return;
    setLoading(true);
    setError(null);

    try {
      await devicesApi.unassign(device.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unassign device");
    } finally {
      setLoading(false);
    }
  };

  if (!device) return null;

  const clientUsers = users.filter((u) => u.role === "CLIENT");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Device: ${device.name}`}>
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleAssign} className="space-y-4">
        <div>
          <p className="text-sm text-slate-600 mb-3">
            Map device <span className="font-semibold text-slate-800">{device.name}</span> (Max:{" "}
            {device.max_consumption} kWh) to a registered Client user.
          </p>

          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Select Client User
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">-- Choose a user --</option>
            {clientUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} {u.full_name ? `(${u.full_name})` : ""} - {u.email || "No email"}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4 flex justify-between items-center border-t border-slate-100">
          <div>
            {device.assigned_user_id && (
              <button
                type="button"
                disabled={loading}
                onClick={handleUnassign}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
              >
                Unassign Device
              </button>
            )}
          </div>

          <div className="flex space-x-3">
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
              {loading ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
