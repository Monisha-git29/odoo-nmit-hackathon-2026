import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, FileText, CheckCircle, Clock } from 'lucide-react';

export default function TimeOff({ token }) {
  const [balance, setBalance] = useState({ paid_leave: 0, sick_leave: 0, unpaid_leave: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [leaveType, setLeaveType] = useState('Paid Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachment, setAttachment] = useState(null);
  
  // Conflict checker states
  const [conflictWarning, setConflictWarning] = useState(null);
  const [conflictCount, setConflictCount] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchBalances();
    fetchLeaveHistory();
  }, []);

  // Check conflicts when dates change
  useEffect(() => {
    if (startDate && endDate) {
      checkConflicts();
    } else {
      setConflictWarning(null);
    }
  }, [startDate, endDate]);

  const fetchBalances = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/timeoff/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setBalance(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeaveHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/api/timeoff/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const checkConflicts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/timeoff/check-conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate
        })
      });
      const data = await res.json();
      if (data.warning) {
        setConflictWarning(data.message);
        setConflictCount(data.conflict_count);
      } else {
        setConflictWarning(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setError("Start date cannot be after end date.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('leave_type', leaveType);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      if (remarks) formData.append('remarks', remarks);
      if (attachment) formData.append('file', attachment);

      const res = await fetch('http://localhost:8000/api/timeoff/apply', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit leave application.");

      setSuccess(data.message + ` Requested for ${data.num_days} day(s).`);
      
      // Reset form
      setStartDate('');
      setEndDate('');
      setRemarks('');
      setAttachment(null);
      setConflictWarning(null);
      
      // Reload details
      fetchBalances();
      fetchLeaveHistory();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && <div className="p-3.5 bg-red-50 text-red-700 border border-red-150 rounded text-sm font-medium">{error}</div>}
      {success && <div className="p-3.5 bg-green-50 text-green-700 border border-green-150 rounded text-sm font-medium">{success}</div>}

      {/* TOP SECTION: Leave Balance Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase">Paid Leaves</p>
          <div className="flex justify-between items-end mt-3">
            <span className="text-4xl font-extrabold text-slate-700 font-mono">{balance.paid_leave}</span>
            <span className="text-xs text-slate-400 pb-1">Days remaining</span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase">Sick Leaves</p>
          <div className="flex justify-between items-end mt-3">
            <span className="text-4xl font-extrabold text-slate-700 font-mono">{balance.sick_leave}</span>
            <span className="text-xs text-slate-400 pb-1">Days remaining</span>
          </div>
        </div>
        <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase">Unpaid Leaves</p>
          <div className="flex justify-between items-end mt-3">
            <span className="text-4xl font-extrabold text-slate-700 font-mono">{balance.unpaid_leave}</span>
            <span className="text-xs text-slate-400 pb-1">Days logged</span>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Application form & Leave History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave application form */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm h-fit">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Calendar className="h-4.5 w-4.5 text-primary-600" />
            <span>Apply for Leave</span>
          </h2>
          
          <form onSubmit={handleApplyLeave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              >
                <option value="Paid Leave">Paid Leave (Annual)</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                />
              </div>
            </div>

            {/* Smart Conflict Banner */}
            {conflictWarning && (
              <div className="p-3 bg-amber-50 border border-amber-250 text-amber-800 rounded text-xs flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-bold">Team Availability Notice</p>
                  <p className="mt-0.5">{conflictWarning}</p>
                  <p className="text-[10px] text-amber-500 mt-1">You may still submit this request for review.</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Reason / Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Reason for requesting time off..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Supporting Attachment (Optional)</label>
              <input
                type="file"
                onChange={(e) => setAttachment(e.target.files[0])}
                accept=".pdf,image/*"
                className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 file:hover:bg-slate-200 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-bold text-xs transition shadow"
            >
              Submit Leave Request
            </button>
          </form>
        </div>

        {/* Leave Request Logs */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Leave Application Log History</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <th className="p-3">Type</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  history.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 text-xs">
                      <td className="p-3 font-bold">{r.leave_type}</td>
                      <td className="p-3 whitespace-nowrap">{r.start_date} to {r.end_date}</td>
                      <td className="p-3 text-center">{r.num_days}</td>
                      <td className="p-3 truncate max-w-[120px]" title={r.remarks}>{r.remarks || '--'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 font-bold rounded-full ${
                          r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 italic max-w-[120px] truncate" title={r.hr_comment || 'No feedback'}>
                        {r.hr_comment || '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
