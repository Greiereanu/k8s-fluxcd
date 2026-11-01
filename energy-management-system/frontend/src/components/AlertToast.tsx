import React from "react";
import { useAlerts } from "../context/AlertsContext";
import { AlertTriangle, X, Bell } from "lucide-react";

export const AlertToast: React.FC = () => {
  const { activeAlert, dismissAlert, alerts, clearAlerts } = useAlerts();
  const [showHistory, setShowHistory] = React.useState(false);

  return (
    <>
      {/* Floating Active Warning Banner */}
      {activeAlert && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full animate-bounce duration-300">
          <div className="bg-red-50 border-2 border-red-500 rounded-xl shadow-2xl p-4 text-red-900 relative">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-red-800">
                    Consumption Limit Exceeded!
                  </h4>
                  <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded-full font-mono">
                    LIVE
                  </span>
                </div>
                <p className="text-sm mt-1 text-red-700 font-medium">
                  {activeAlert.message}
                </p>
                <div className="mt-2 text-xs text-red-600 flex items-center justify-between">
                  <span>Device: {activeAlert.device_name}</span>
                  <span>{new Date(activeAlert.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(activeAlert.timestamp)}
                className="absolute top-3 right-3 text-red-400 hover:text-red-700 p-1 rounded-lg hover:bg-red-100 transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bell Trigger when alerts exist */}
      {alerts.length > 0 && !activeAlert && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg font-medium text-sm transition-all transform hover:scale-105"
          >
            <Bell className="w-4 h-4" />
            <span>Alerts</span>
            <span className="ml-1 px-2 py-0.5 bg-white text-red-600 text-xs font-bold rounded-full">
              {alerts.length}
            </span>
          </button>
        </div>
      )}

      {/* Alert History Drawer / Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-slate-800">Alert Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAlerts}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-100"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {alerts.map((alt, idx) => (
                <div
                  key={`${alt.timestamp}-${idx}`}
                  className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900"
                >
                  <div className="flex items-center justify-between font-bold text-xs text-red-700">
                    <span>{alt.device_name}</span>
                    <span>{new Date(alt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-red-800">{alt.message}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-red-600 font-mono">
                    <span>Current: {alt.current_consumption} kWh</span>
                    <span>Limit: {alt.max_consumption} kWh</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
