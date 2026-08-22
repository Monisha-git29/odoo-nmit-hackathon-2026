import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle, AlertCircle, Clock, Calendar, HelpCircle } from 'lucide-react';

export default function Attendance({ token, user }) {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date filters for history
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Camera check-in state
  const [cameraActive, setCameraActive] = useState(false);
  const [actionType, setActionType] = useState('check-in'); // 'check-in' or 'check-out'
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [locationStatus, setLocationStatus] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  
  // Correction Form
  const [corrDate, setCorrDate] = useState('');
  const [corrType, setCorrType] = useState('Forgot Check-In');
  const [corrTime, setCorrTime] = useState('09:00 AM');
  const [corrReason, setCorrReason] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchTodayStatus();
    fetchHistory();
    fetchCorrections();
  }, [filterMonth, filterYear]);

  const fetchTodayStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/attendance/today', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setToday(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/api/attendance/history?month=${filterMonth}&year=${filterYear}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data.history);
      setSummary(data.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCorrections = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/attendance/corrections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCorrections(data);
    } catch (e) {
      console.error(e);
    }
  };

  const startCamera = async (type) => {
    setError('');
    setSuccess('');
    setActionType(type);
    setCameraActive(true);
    
    // Start video
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setError("Failed to open camera: " + e.message);
      setCameraActive(false);
      return;
    }

    // Get location if check-in and required today
    if (type === 'check-in' && today?.today_work_mode === 'OFFICE') {
      setLocationStatus("Fetching coordinates...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationStatus(`Verified Location: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        (err) => {
          setCoords({ lat: null, lon: null });
          setLocationStatus("Location unavailable (empty coordinates sent).");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    setCoords({ lat: null, lon: null });
    setLocationStatus('');
  };

  const handleVerifyAttendance = async () => {
    if (!videoRef.current) return;
    setError('');
    setSuccess('');
    setVerifyLoading(true);

    try {
      // Capture canvas snapshot
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const frameBase64 = canvas.toDataURL('image/jpeg');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      if (actionType === 'check-in') {
        const body = {
          image_base64: frameBase64,
          is_front_camera: true,
          latitude: coords.lat,
          longitude: coords.lon
        };
        const res = await fetch('http://localhost:8000/api/attendance/check-in', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Check-in failed.");
        
        setSuccess(data.message + ` Clocked In at ${data.time}`);
      } else {
        const res = await fetch('http://localhost:8000/api/attendance/check-out', {
          method: 'POST',
          headers,
          body: JSON.stringify({ image_base64: frameBase64, is_front_camera: true })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Check-out failed.");
        
        setSuccess(data.message + ` Clocked Out at ${data.time}. Total hours: ${data.work_hours} hrs.`);
      }

      stopCamera();
      fetchTodayStatus();
      fetchHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('http://localhost:8000/api/attendance/correction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attendance_date: corrDate,
          issue_type: corrType,
          requested_time: corrTime,
          reason: corrReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit correction.");

      setSuccess(data.message);
      setCorrDate('');
      setCorrReason('');
      fetchCorrections();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Messages */}
      {error && <div className="p-3.5 bg-red-50 text-red-700 border border-red-150 rounded text-sm font-medium">{error}</div>}
      {success && <div className="p-3.5 bg-green-50 text-green-700 border border-green-150 rounded text-sm font-medium">{success}</div>}

      {/* TOP SECTION: Today's Shift Logs */}
      {today && (
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            <span>Today's Attendance Status</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            {/* Status overview */}
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Scheduled mode</p>
                <p className="text-sm font-extrabold text-slate-700 mt-1 uppercase">
                  {today.today_work_mode === 'OFFICE' ? '🏢 OFFICE' : '🏠 WFH'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Status</p>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 mt-1 rounded-full ${
                  today.status === 'NOT_CHECKED_IN' ? 'bg-slate-150 text-slate-700' :
                  today.status === 'CHECKED_IN' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                }`}>
                  {today.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">In Time</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">{today.check_in_time}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Out Time</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">{today.check_out_time}</p>
              </div>
            </div>

            {/* Check in/out trigger button */}
            <div className="text-center sm:text-right">
              {today.status === 'NOT_CHECKED_IN' && (
                <button
                  onClick={() => startCamera('check-in')}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm transition shadow-md flex items-center justify-center space-x-1"
                >
                  <Camera className="h-4.5 w-4.5" />
                  <span>Clock In</span>
                </button>
              )}
              {today.status === 'CHECKED_IN' && (
                <button
                  onClick={() => startCamera('check-out')}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition shadow-md flex items-center justify-center space-x-1"
                >
                  <Camera className="h-4.5 w-4.5" />
                  <span>Clock Out</span>
                </button>
              )}
              {(today.status !== 'NOT_CHECKED_IN' && today.status !== 'CHECKED_IN') && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-center font-bold text-sm flex items-center justify-center space-x-1">
                  <CheckCircle className="h-4.5 w-4.5" />
                  <span>Shift Completed</span>
                </div>
              )}
            </div>
          </div>

          {/* Camera Frame popup */}
          {cameraActive && (
            <div className="mt-6 border-t border-slate-100 pt-6 max-w-md mx-auto space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-150">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 capitalize">{actionType} Verification</h3>
                <span className="text-[10px] text-primary-700 font-bold bg-primary-50 px-2 py-0.5 rounded">TFLite Active</span>
              </div>

              {/* Mode indicator */}
              <div className="text-xs space-y-1 text-slate-500">
                <p>Verify Mode: <span className="font-bold text-slate-700 uppercase">{today.today_work_mode}</span></p>
                {today.today_work_mode === 'OFFICE' && actionType === 'check-in' && (
                  <div className="space-y-2 mt-1">
                    <p className="flex items-center text-primary-700">
                      <MapPin className="h-3 w-3 mr-1" />
                      <span>{locationStatus}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="relative border-2 border-primary-500 rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100"></video>
                <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-white opacity-20 rounded-full m-8"></div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleVerifyAttendance}
                  disabled={verifyLoading}
                  className="flex-1 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded transition shadow disabled:opacity-50"
                >
                  {verifyLoading ? 'Running Face Embedder...' : `Verify Face & ${actionType === 'check-in' ? 'Clock In' : 'Clock Out'}`}
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MID SECTION: Attendance History & Summary stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Logs Table */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden lg:col-span-3">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary-600" />
              <span>Attendance Log History</span>
            </h2>
            <div className="flex space-x-2">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded text-sm bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded text-sm bg-white"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <th className="p-4">Date</th>
                  <th className="p-4">Work Mode</th>
                  <th className="p-4">Check-In</th>
                  <th className="p-4">Check-Out</th>
                  <th className="p-4">Work Hours</th>
                  <th className="p-4">Extra Hours</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No records found for this period.
                    </td>
                  </tr>
                ) : (
                  history.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 text-slate-700">
                      <td className="p-4 font-bold">{r.date}</td>
                      <td className="p-4 font-mono text-xs">{r.work_mode}</td>
                      <td className="p-4">{r.check_in}</td>
                      <td className="p-4">{r.check_out}</td>
                      <td className="p-4 font-medium">{r.work_hours}</td>
                      <td className="p-4 font-semibold text-emerald-600">{r.extra_hours !== '--' && parseFloat(r.extra_hours) > 0 ? r.extra_hours : '--'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          r.status === 'PRESENT' ? 'bg-green-50 text-green-700 border border-green-100' :
                          r.status === 'HALF_DAY' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          r.status === 'LEAVE' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          r.status === 'ABSENT' ? 'bg-red-50 text-red-700 border border-red-100' :
                          'bg-slate-50 text-slate-600 border border-slate-100'
                        }`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary side stats */}
        {summary && (
          <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Monthly Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-sm text-slate-500">Present Days</span>
                <span className="text-sm font-bold text-slate-800">{summary.present}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-sm text-slate-500">Half Days</span>
                <span className="text-sm font-bold text-slate-800">{summary.half_day}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-sm text-slate-500">Approved Leaves</span>
                <span className="text-sm font-bold text-slate-800">{summary.leave}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="text-sm text-slate-500">Incomplete Days</span>
                <span className="text-sm font-bold text-slate-800">{summary.incomplete}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-sm text-slate-500">Absent Days</span>
                <span className="text-sm font-bold text-red-600">{summary.absent}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Attendance Correction Request */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Correction submission form */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Request Attendance Correction</h2>
          <form onSubmit={handleCorrectionSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Attendance Date</label>
              <input
                type="date"
                required
                value={corrDate}
                onChange={(e) => setCorrDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Issue Type</label>
              <select
                value={corrType}
                onChange={(e) => setCorrType(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              >
                <option value="Forgot Check-In">Forgot Check-In</option>
                <option value="Forgot Check-Out">Forgot Check-Out</option>
                <option value="Incorrect Attendance Time">Incorrect Attendance Time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Requested Corrected Time</label>
              <input
                type="text"
                required
                value={corrTime}
                onChange={(e) => setCorrTime(e.target.value)}
                placeholder="e.g. 09:15 AM or 06:00 PM"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Reason for Request</label>
              <textarea
                required
                rows={3}
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="Please state the reason clearly..."
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded font-bold text-xs transition shadow"
            >
              Submit Correction Request
            </button>
          </form>
        </div>

        {/* Correction request logs */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Previous Correction Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <th className="p-3">Date Info</th>
                  <th className="p-3">Issue Type</th>
                  <th className="p-3">Correction Details</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                      No correction requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  corrections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 text-slate-700 text-xs">
                      <td className="p-3 font-bold">{c.attendance_date}</td>
                      <td className="p-3">{c.issue_type}</td>
                      <td className="p-3 font-mono">{c.requested_time}</td>
                      <td className="p-3 truncate max-w-[150px]" title={c.reason}>{c.reason}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 font-bold rounded-full ${
                          c.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          c.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {c.status}
                        </span>
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
