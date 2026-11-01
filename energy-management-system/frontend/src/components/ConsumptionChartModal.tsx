import React, { useEffect, useState } from "react";
import { Device, HourlyConsumptionRecord } from "../types";
import { monitoringApi } from "../api/client";
import { X, Calendar, RefreshCw, AlertTriangle, Zap } from "lucide-react";

interface ConsumptionChartModalProps {
  device: Device;
  onClose: () => void;
}

export const ConsumptionChartModal: React.FC<ConsumptionChartModalProps> = ({ device, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [records, setRecords] = useState<HourlyConsumptionRecord[]>([]);
  const [maxConsumption, setMaxConsumption] = useState<number>(device.max_consumption);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await monitoringApi.getHourlyHistory(device.id, selectedDate);
      setRecords(data.records);
      if (data.max_consumption !== null) {
        setMaxConsumption(data.max_consumption);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load consumption history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedDate, device.id]);

  // Construct 24 hourly buckets: 0 to 23
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const record = records.find((r) => {
      const recDate = new Date(r.timestamp_hour);
      return recDate.getUTCHours() === hour;
    });
    return {
      hour: `${hour.toString().padStart(2, "0")}:00`,
      consumption: record ? record.total_consumption : 0,
      exceeded: record ? record.total_consumption > maxConsumption : false,
      count: record ? record.measurement_count : 0,
    };
  });

  const totalDaily = hourlyData.reduce((acc, h) => acc + h.consumption, 0);
  const peak = Math.max(...hourlyData.map((h) => h.consumption), 0);
  const chartHeightMax = Math.max(peak, maxConsumption * 1.2, 1.0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">{device.name}</h3>
              <p className="text-xs text-slate-500">
                Hourly Energy Consumption Monitoring | ID: {device.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
          <div className="flex items-center gap-2 md:col-span-1">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchHistory}
              className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Daily Total</span>
            <p className="text-lg font-bold text-slate-800">{totalDaily.toFixed(3)} kWh</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Hourly Limit</span>
            <p className="text-lg font-bold text-amber-600">{maxConsumption.toFixed(2)} kWh</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Peak Hour</span>
            <p className="text-lg font-bold text-slate-800">{peak.toFixed(3)} kWh</p>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="flex-1 min-h-[300px] border border-slate-100 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-end relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-600 bg-white/80">
              <AlertTriangle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          {/* Threshold Line Label */}
          <div
            className="absolute left-4 right-4 border-b-2 border-dashed border-red-400 flex items-center justify-end pr-2 pointer-events-none"
            style={{
              bottom: `${(maxConsumption / chartHeightMax) * 80 + 10}%`,
            }}
          >
            <span className="text-[10px] font-bold text-red-500 bg-white px-1 rounded shadow-sm">
              Limit: {maxConsumption} kWh
            </span>
          </div>

          {/* Bar Columns */}
          <div className="h-64 flex items-end justify-between gap-1 pt-6 pb-2 px-2">
            {hourlyData.map((slot) => {
              const heightPercent = chartHeightMax > 0 ? (slot.consumption / chartHeightMax) * 100 : 0;
              return (
                <div
                  key={slot.hour}
                  className="flex-1 flex flex-col items-center group relative h-full justify-end"
                >
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-lg pointer-events-none whitespace-nowrap">
                    <p className="font-bold">{slot.hour}</p>
                    <p>{slot.consumption.toFixed(3)} kWh</p>
                    {slot.exceeded && <p className="text-red-400 font-bold">Limit Exceeded</p>}
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    className={`w-full rounded-t transition-all ${
                      slot.exceeded
                        ? "bg-red-500 group-hover:bg-red-600 shadow-md shadow-red-200"
                        : slot.consumption > 0
                        ? "bg-blue-500 group-hover:bg-blue-600"
                        : "bg-slate-200"
                    }`}
                  />
                  {/* Hour label */}
                  <span className="text-[9px] text-slate-400 mt-1 transform -rotate-45 md:rotate-0">
                    {slot.hour.slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend & Footer */}
        <div className="pt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 mt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span>Normal Consumption</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-red-500 rounded-sm" />
              <span>Limit Exceeded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 border-b-2 border-dashed border-red-400" />
              <span>Max Threshold</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

