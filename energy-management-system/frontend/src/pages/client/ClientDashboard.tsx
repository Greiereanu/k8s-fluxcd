import React, { useState, useEffect } from "react";
import { devicesApi } from "../../api/client";
import { Device } from "../../types";
import { Zap, Cpu, MapPin, AlertCircle, RefreshCw, BarChart2 } from "lucide-react";
import { ConsumptionChartModal } from "../../components/ConsumptionChartModal";

export const ClientDashboard: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceForChart, setSelectedDeviceForChart] = useState<Device | null>(null);

  const fetchMyDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await devicesApi.getMyDevices();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assigned devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDevices();
  }, []);

  const totalMaxPower = devices.reduce((sum, d) => sum + d.max_consumption, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Smart Metering Devices</h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time monitoring of energy metering units assigned to your account
          </p>
        </div>

        <button
          onClick={fetchMyDevices}
          disabled={loading}
          className="mt-4 sm:mt-0 inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-md mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <p className="text-xs uppercase font-semibold tracking-wider text-indigo-300">Energy Allocation</p>
          <h3 className="text-xl font-bold mt-1">Total Assigned Hourly Consumption Cap</h3>
          <p className="text-xs text-indigo-200 mt-1">
            Aggregated maximum load across all your active smart meters
          </p>
        </div>

        <div className="flex items-center space-x-6">
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-center">
            <span className="text-xs text-indigo-200 font-medium block">Active Units</span>
            <span className="text-2xl font-bold">{devices.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-center">
            <span className="text-xs text-indigo-200 font-medium block">Total Cap</span>
            <span className="text-2xl font-bold">{totalMaxPower.toFixed(1)} <span className="text-sm font-normal">kWh</span></span>
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Loading assigned metering devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm max-w-lg mx-auto">
          <div className="bg-slate-50 text-slate-400 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Devices Assigned</h3>
          <p className="text-sm text-slate-500 mt-2">
            You do not currently have any smart energy meters linked to your account. Please contact an administrator to map a metering device to you.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div
              key={device.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
                    <Zap className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      device.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {device.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mt-4 tracking-tight">{device.name}</h3>

                {device.address && (
                  <div className="flex items-center text-xs text-slate-500 mt-1.5 space-x-1">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{device.address}</span>
                  </div>
                )}

                {device.description && (
                  <p className="text-xs text-slate-600 mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {device.description}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider block">
                    Max Consumption
                  </span>
                  <span className="text-lg font-extrabold text-slate-900">
                    {device.max_consumption} <span className="text-xs font-medium text-slate-500">kWh</span>
                  </span>
                </div>

                <button
                  onClick={() => setSelectedDeviceForChart(device)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs rounded-lg transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>Consumption</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDeviceForChart && (
        <ConsumptionChartModal
          device={selectedDeviceForChart}
          onClose={() => setSelectedDeviceForChart(null)}
        />
      )}
    </div>
  );
};
