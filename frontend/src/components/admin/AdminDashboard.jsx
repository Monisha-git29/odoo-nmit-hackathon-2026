import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Calendar, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AdminDashboard({ token, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load dashboard statistics.");
      const stats = await res.json();
      setData(stats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-slate-500 font-medium py-10 text-center">Loading Admin Dashboard...</div>;
  if (error) return <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>;

  const { summary, action_center, warnings } = data;

  const cards = [
    { name: 'Total Employees', value: summary.total_employees, icon: Users, color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { name: 'Present Today', value: summary.present, icon: UserCheck, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { name: 'Absent Today', value: summary.absent, icon: UserX, color: 'bg-rose-50 text-rose-700 border-rose-100' },
    { name: 'On Leave Today', value: summary.on_leave, icon: Calendar, color: 'bg-sky-50 text-sky-700 border-sky-100' },
    { name: 'Incomplete Shifts', value: summary.incomplete, icon: AlertCircle, color: 'bg-amber-50 text-amber-700 border-amber-100' }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className={`p-4 rounded-xl border shadow-sm ${card.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">{card.name}</span>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-black mt-2">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Action Center and Warnings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* HR Action Center */}
        <div className="md:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">HR Action Center</h3>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Pending Approvals</p>
          </div>
          
          <div className="space-y-2.5">
            <button 
              onClick={() => onNavigate('Time Off')}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition"
            >
              <span className="text-xs font-bold text-slate-700">Leave Requests</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${action_center.pending_leaves > 0 ? 'bg-amber-150 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>
                {action_center.pending_leaves} Pending
              </span>
            </button>

            <button 
              onClick={() => onNavigate('Attendance')}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition"
            >
              <span className="text-xs font-bold text-slate-700">Attendance Corrections</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${action_center.pending_corrections > 0 ? 'bg-amber-150 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>
                {action_center.pending_corrections} Pending
              </span>
            </button>

            <button 
              onClick={() => onNavigate('Documents')}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition"
            >
              <span className="text-xs font-bold text-slate-700">Document Verifications</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${action_center.pending_documents > 0 ? 'bg-amber-150 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>
                {action_center.pending_documents} Pending
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic Exception Banner Alerts */}
        <div className="md:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Attendance Exceptions</h3>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Automated Violation Checks</p>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {warnings.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-emerald-50/50 rounded-lg border border-emerald-100 text-emerald-800 text-center">
                <ShieldCheck className="h-8 w-8 mb-2" />
                <p className="text-xs font-bold">No attendance exceptions detected.</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">All employees have clean attendance cycles this month.</p>
              </div>
            ) : (
              warnings.map((warn) => (
                <div key={warn.employee_id} className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-lg flex items-start space-x-3">
                  <AlertTriangle className="h-4.5 w-4.5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">{warn.name} ({warn.employee_id})</p>
                    <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-0.5">
                      {warn.warnings.map((w, idx) => (
                        <li key={idx} className="font-semibold">{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
