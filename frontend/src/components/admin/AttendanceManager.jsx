import React, { useState, useEffect } from 'react';
import { Check, X, Shield, MapPin, Eye } from 'lucide-react';

export default function AttendanceManager({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [userFilter, setUserFilter] = useState('');

  // Review modal
  const [selectedCorr, setSelectedCorr] = useState(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeSubTab, dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeSubTab === 'logs') {
        const query = `date_filter=${dateFilter}&user_filter=${userFilter}`;
        const res = await fetch(`http://localhost:8000/api/admin/attendance?${query}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load attendance logs.");
        const data = await res.json();
        setLogs(data);
      } else {
        const res = await fetch('http://localhost:8000/api/admin/corrections', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load corrections requests.");
        const data = await res.json();
        setCorrections(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCorr = async (id) => {
    if (!window.confirm("Are you sure you want to approve this correction? This will write/update the attendance record for that day.")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/admin/corrections/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Approval failed.");
      }
      alert("Correction request approved successfully.");
      setSelectedCorr(null);
      fetchData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRejectCorr = async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/admin/corrections/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'REJECTED',
          remarks: remarks
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Rejection failed.");
      }
      alert("Correction request rejected.");
      setSelectedCorr(null);
      setRemarks('');
      fetchData();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">Attendance Management</h3>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Track and adjust daily hours</p>
        </div>

        {/* Sub-tab Toggle */}
        <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-bold text-slate-500">
          <button 
            onClick={() => { setActiveSubTab('logs'); fetchData(); }}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'logs' ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'}`}
          >
            Daily Logs
          </button>
          <button 
            onClick={() => { setActiveSubTab('corrections'); fetchData(); }}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'corrections' ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'}`}
          >
            Correction Requests
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>}

      {/* Render Daily Logs */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center space-x-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
            <div>
              <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Select Date</label>
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Search Employee ID</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={userFilter}
                  placeholder="e.g. EMP001"
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                />
                <button 
                  onClick={fetchData}
                  className="px-3.5 py-1.5 bg-slate-800 text-white rounded-lg font-bold"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-slate-500 py-10 text-center font-medium">Loading logs...</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Work Mode</th>
                    <th className="px-5 py-3">Check-In</th>
                    <th className="px-5 py-3">Check-Out</th>
                    <th className="px-5 py-3">Hours Worked</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Verifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-5 py-10 text-center text-slate-400 font-medium">No attendance records found for this date.</td>
                    </tr>
                  ) : (
                    logs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-bold text-slate-900">{r.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{r.employee_id}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            r.work_mode === 'OFFICE' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {r.work_mode}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{r.check_in}</td>
                        <td className="px-5 py-3 text-slate-600">{r.check_out}</td>
                        <td className="px-5 py-3 text-slate-600 font-mono">{r.work_hours > 0 ? `${r.work_hours} hrs` : '--'}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            r.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            r.status === 'HALF_DAY' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            r.status === 'INCOMPLETE' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            r.status === 'LEAVE' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400">
                            <span className="flex items-center space-x-1">
                              <Shield className={`h-3.5 w-3.5 ${r.face_verified ? 'text-emerald-500' : 'text-slate-300'}`} />
                              <span>Face</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <MapPin className={`h-3.5 w-3.5 ${r.location_verified ? 'text-emerald-500' : 'text-slate-300'}`} />
                              <span>Geo</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Render Corrections Queue */}
      {activeSubTab === 'corrections' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-slate-500 py-10 text-center font-medium">Loading requests...</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Target Date</th>
                    <th className="px-5 py-3">Issue Type</th>
                    <th className="px-5 py-3">Requested Time</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {corrections.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-10 text-center text-slate-400 font-medium">No correction requests found.</td>
                    </tr>
                  ) : (
                    corrections.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-bold text-slate-900">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{c.employee_id}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{c.attendance_date}</td>
                        <td className="px-5 py-3 text-slate-600">{c.issue_type}</td>
                        <td className="px-5 py-3 font-bold text-slate-800">{c.requested_time}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            c.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {c.status === 'PENDING' ? (
                            <button 
                              onClick={() => setSelectedCorr(c)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-950 text-white rounded font-bold text-[10px] transition"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Review</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Request Modal */}
      {selectedCorr && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Review Correction Request</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Requested by {selectedCorr.employee_id}</p>
              </div>
              <button onClick={() => setSelectedCorr(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Employee</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedCorr.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Target Date</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedCorr.attendance_date}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px]">Issue Type</p>
                <p className="text-slate-800 font-bold mt-0.5">{selectedCorr.issue_type}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Requested Time</p>
                  <p className="text-emerald-700 font-bold mt-0.5">{selectedCorr.requested_time}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Submission Date</p>
                  <p className="text-slate-800 mt-0.5">{selectedCorr.created_at}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
                <p className="text-slate-400 font-bold uppercase text-[9px]">Reason for Change</p>
                <p className="text-slate-600 mt-1 italic font-medium leading-relaxed">"{selectedCorr.reason}"</p>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">HR Review Comment (Optional for Rejections)</label>
                <textarea 
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Provide comments if rejecting..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
                ></textarea>
              </div>

              <div className="flex justify-between space-x-3 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => handleRejectCorr(selectedCorr.id)}
                  className="px-4 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg font-bold flex items-center space-x-1.5 transition"
                >
                  <X className="h-4 w-4" />
                  <span>Reject</span>
                </button>
                <button 
                  onClick={() => handleApproveCorr(selectedCorr.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center space-x-1.5 shadow transition"
                >
                  <Check className="h-4 w-4" />
                  <span>Approve</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
