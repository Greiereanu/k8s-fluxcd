import React, { useState, useEffect } from "react";
import { usersApi, devicesApi } from "../../api/client";
import { User, Device } from "../../types";
import { UserModal } from "./UserModal";
import { DeviceModal } from "./DeviceModal";
import { AssignDeviceModal } from "./AssignDeviceModal";
import {
  Users,
  Cpu,
  Zap,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Search,
  Activity,
  AlertCircle,
} from "lucide-react";

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "devices">("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [deviceToAssign, setDeviceToAssign] = useState<Device | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, devicesData] = await Promise.all([
        usersApi.getAll(),
        devicesApi.getAll(),
      ]);
      setUsers(usersData);
      setDevices(devicesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteUser = async (user: User) => {
    if (
      !window.confirm(
        `Are you sure you want to delete user "${user.username}"? This will also unassign all their devices and revoke login access.`
      )
    ) {
      return;
    }
    try {
      await usersApi.delete(user.id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!window.confirm(`Are you sure you want to delete device "${device.name}"?`)) {
      return;
    }
    try {
      await devicesApi.delete(device.id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete device");
    }
  };

  const handleUnassignDevice = async (device: Device) => {
    if (!window.confirm(`Unassign "${device.name}" from its current user?`)) {
      return;
    }
    try {
      await devicesApi.unassign(device.id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unassign device");
    }
  };

  const totalMaxPower = devices.reduce((sum, d) => sum + d.max_consumption, 0);
  const activeDevices = devices.filter((d) => d.status === "ACTIVE").length;
  const unassignedDevices = devices.filter((d) => !d.assigned_user_id).length;

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.address && d.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getUserMap = () => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  };
  const userMap = getUserMap();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Administration</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage system users, register smart metering devices, and configure mappings
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Registered Users</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{users.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Devices</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {devices.length}{" "}
              <span className="text-xs font-normal text-slate-500">({activeDevices} Active)</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Max Consumption Cap</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {totalMaxPower.toFixed(1)} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-sky-50 text-sky-600 p-3 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unassigned Devices</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{unassignedDevices}</p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs & Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("users");
                setSearchQuery("");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "users"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              User Management ({users.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("devices");
                setSearchQuery("");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "devices"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Device Management ({devices.length})
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder={activeTab === "users" ? "Search users..." : "Search devices..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
              />
            </div>

            {activeTab === "users" ? (
              <button
                onClick={() => {
                  setUserToEdit(null);
                  setUserModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setDeviceToEdit(null);
                  setDeviceModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Register Device</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Users Table */}
        {activeTab === "users" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    User Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Contact & Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    UUID
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-900">{u.username}</div>
                        <div className="text-xs text-slate-500">{u.full_name || "No name set"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            u.role === "ADMIN"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div>{u.email || "—"}</div>
                        <div className="text-xs text-slate-400">{u.address || "—"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-400" title={u.id}>
                        {u.id.substring(0, 13)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="inline-flex space-x-2">
                          <button
                            onClick={() => {
                              setUserToEdit(u);
                              setUserModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit User Profile"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Devices Table */}
        {activeTab === "devices" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Device Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Max Consumption
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assigned Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                      Loading devices...
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                      No devices found.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) => {
                    const assignedUser = d.assigned_user_id ? userMap.get(d.assigned_user_id) : null;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">{d.name}</div>
                          <div className="text-xs text-slate-500">{d.address || d.description || "No address"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            {d.max_consumption} kWh
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {assignedUser ? (
                            <div className="flex items-center space-x-1.5 text-xs text-slate-800">
                              <span className="font-semibold">{assignedUser.username}</span>
                              <span className="text-slate-400 font-mono">({assignedUser.id.substring(0, 8)}...)</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              d.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="inline-flex space-x-1.5">
                            <button
                              onClick={() => {
                                setDeviceToAssign(d);
                                setAssignModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Assign / Reassign Device"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            {d.assigned_user_id && (
                              <button
                                onClick={() => handleUnassignDevice(d)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Unassign Device"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setDeviceToEdit(d);
                                setDeviceModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Device"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(d)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Device"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserModal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        onSuccess={fetchData}
        userToEdit={userToEdit}
      />

      <DeviceModal
        isOpen={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        onSuccess={fetchData}
        deviceToEdit={deviceToEdit}
      />

      <AssignDeviceModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onSuccess={fetchData}
        device={deviceToAssign}
        users={users}
      />
    </div>
  );
};
