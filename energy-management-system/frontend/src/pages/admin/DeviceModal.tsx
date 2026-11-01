import React, { useState, useEffect } from "react";
import { Modal } from "../../components/Modal";
import { Device } from "../../types";
import { devicesApi } from "../../api/client";

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deviceToEdit?: Device | null;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({ isOpen, onClose, onSuccess, deviceToEdit }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [maxConsumption, setMaxConsumption] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deviceToEdit) {
      setName(deviceToEdit.name);
      setDescription(deviceToEdit.description || "");
      setAddress(deviceToEdit.address || "");
      setMaxConsumption(String(deviceToEdit.max_consumption));
      setStatus(deviceToEdit.status || "ACTIVE");
    } else {
      setName("");
      setDescription("");
      setAddress("");
      setMaxConsumption("");
      setStatus("ACTIVE");
    }
    setError(null);
  }, [deviceToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedConsumption = parseFloat(maxConsumption);
    if (isNaN(parsedConsumption) || parsedConsumption <= 0) {
      setError("Max consumption must be a positive number (kWh)");
      return;
    }

    setLoading(true);

    try {
      if (deviceToEdit) {
        await devicesApi.update(deviceToEdit.id, {
          name,
          description: description || undefined,
          address: address || undefined,
          max_consumption: parsedConsumption,
          status,
        });
      } else {
        await devicesApi.create({
          name,
          description: description || undefined,
          address: address || undefined,
          max_consumption: parsedConsumption,
          status,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save device");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={deviceToEdit ? "Edit Metering Device" : "Register New Device"}>
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Device Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Smart Meter Kitchen"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Max Consumption (kWh)
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            required
            value={maxConsumption}
            onChange={(e) => setMaxConsumption(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. 5.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Physical Address / Location
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Floor 2, Server Room"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Main electrical circuit breaker..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
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
            {loading ? "Saving..." : deviceToEdit ? "Update Device" : "Register Device"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

