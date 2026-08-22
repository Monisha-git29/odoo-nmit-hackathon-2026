import React, { useState, useEffect } from 'react';
import { Check, X, Eye, FileText, AlertTriangle } from 'lucide-react';

export default function LeaveManager({ token }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Review modal
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/admin/leaves', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load leave requests.");
      const list = await res.json();
      setLeaves(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = async (l) => {
    setSelectedLeave(l);
    setRemarks('');
    setConflicts([]);
    setCheckingConflicts(true);
    
    // Check conflicts for this date range
    try {
      const res = await fetch(`http://localhost:8000/api/admin/team-availability?start_date=${l.start_date}&end_date=${l.end_date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out the requesting employee's own record if present
        const others = data.filter(c => c.employee_id !== l.employee_id);
        setConflicts(others);
      }
    } catch (e) {
      console.error("Failed to fetch conflicts", e);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this leave request? This will deduct from the employee's balance.")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/admin/leaves/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Approval failed.");
      }
      alert("Leave request approved successfully.");
      setSelectedLeave(null);
      fetchLeaves();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleReject = async (id) => {
    if (!remarks.strip && !remarks.trim()) {
      alert("Please provide a reason comment before rejecting.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/admin/leaves/${id}/reject`, {
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
      alert("Leave request rejected.");
      setSelectedLeave(null);
      setRemarks('');
      fetchLeaves();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="text-slate-500 font-medium py-10 text-center">Loading leave requests...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-extrabold text-slate-800 text-sm">Leave Approvals</h3>
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Review and approve time off requests</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Leave Type</th>
              <th className="px-5 py-3">Duration</th>
              <th className="px-5 py-3">Days</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {leaves.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-5 py-10 text-center text-slate-400 font-medium">No leave requests found.</td>
              </tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{l.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{l.employee_id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{l.leave_type}</td>
                  <td className="px-5 py-3 text-slate-600">{l.start_date} to {l.end_date}</td>
                  <td className="px-5 py-3 text-slate-800 font-bold">{l.num_days} {l.num_days === 1 ? 'day' : 'days'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      l.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      l.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {l.status === 'PENDING' ? (
                      <button 
                        onClick={() => handleReviewClick(l)}
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

      {/* Review Leave Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Review Leave Request</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Requested by {selectedLeave.employee_id}</p>
              </div>
              <button onClick={() => setSelectedLeave(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Employee</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedLeave.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Leave Type</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedLeave.leave_type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Leave Range</p>
                  <p className="text-slate-800 mt-0.5">{selectedLeave.start_date} to {selectedLeave.end_date}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Requested Days</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedLeave.num_days} {selectedLeave.num_days === 1 ? 'day' : 'days'}</p>
                </div>
              </div>

              {selectedLeave.remarks && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Employee Remarks</p>
                  <p className="text-slate-600 mt-1 italic font-medium leading-relaxed">"{selectedLeave.remarks}"</p>
                </div>
              )}

              {selectedLeave.attachment && (
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Medical/Support Certificate</p>
                  <a 
                    href={`http://localhost:8000${selectedLeave.attachment}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-700 rounded-md font-bold transition text-[10px]"
                  >
                    <FileText className="h-4 w-4" />
                    <span>View Attachment</span>
                  </a>
                </div>
              )}

              {/* Department Availability Overlap Alert */}
              <div className="pt-1">
                {checkingConflicts ? (
                  <p className="text-[10px] text-slate-400 font-bold italic animate-pulse">Checking team availability overlap...</p>
                ) : conflicts.length > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start space-x-2 text-amber-800">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-[11px]">Smart Leave Notice (Overlap Alert)</p>
                      <p className="text-[10px] text-amber-700 font-semibold mt-0.5 leading-relaxed">
                        {conflicts.length} other team member(s) from the same department will be on leave during this period:
                      </p>
                      <ul className="list-disc list-inside text-[10px] text-amber-700 font-bold mt-1 space-y-0.5">
                        {conflicts.map((c, idx) => (
                          <li key={idx}>{c.name} ({c.start_date} to {c.end_date})</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-[10px] text-emerald-800 font-bold">
                    ✓ No team overlap conflicts. All other department members are available.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">HR Approver Comments (Required for rejection)</label>
                <textarea 
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Provide review details/reasons..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
                ></textarea>
              </div>

              <div className="flex justify-between space-x-3 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => handleReject(selectedLeave.id)}
                  className="px-4 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg font-bold flex items-center space-x-1.5 transition"
                >
                  <X className="h-4 w-4" />
                  <span>Reject</span>
                </button>
                <button 
                  onClick={() => handleApprove(selectedLeave.id)}
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
