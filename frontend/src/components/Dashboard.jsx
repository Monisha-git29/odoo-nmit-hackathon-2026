import React, { useState, useEffect } from 'react';
import { Play, Pause, Calendar, Award, AlertCircle, Compass, FileText, CheckCircle, Clock, Sparkles } from 'lucide-react';

export default function Dashboard({ user, onNavigate, token }) {
  const [todayData, setTodayData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState({ paid_leave: 0, sick_leave: 0, unpaid_leave: 0 });
  const [notifications, setNotifications] = useState([]);
  const [insightsData, setInsightsData] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // 1. Today's attendance
      const resToday = await fetch('http://localhost:8000/api/attendance/today', { headers });
      const dataToday = await resToday.json();
      setTodayData(dataToday);
      
      // 2. Leave balance
      const resBal = await fetch('http://localhost:8000/api/timeoff/balance', { headers });
      const dataBal = await resBal.json();
      setBalance(dataBal);
      
      // 3. Leave history (for pending requests)
      const resLeaves = await fetch('http://localhost:8000/api/timeoff/history', { headers });
      const dataLeaves = await resLeaves.json();
      setLeaves(dataLeaves.filter(l => l.status === 'PENDING').slice(0, 5));
      
      // 4. Notifications
      const resNotifs = await fetch('http://localhost:8000/api/notifications', { headers });
      const dataNotifs = await resNotifs.json();
      setNotifications(dataNotifs.slice(0, 5));

      // 5. Smart insights
      const resInsights = await fetch('http://localhost:8000/api/attendance/insights', { headers });
      if (resInsights.ok) {
        const dataInsights = await resInsights.json();
        setInsightsData(dataInsights);
      }
    } catch (e) {
      console.error("Error loading dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  // Timer logic for checked-in status
  useEffect(() => {
    if (!todayData || todayData.status !== 'CHECKED_IN' || !todayData.check_in_time) {
      setElapsedTime('00:00:00');
      return;
    }

    // Parse check in time to calculate elapsed
    // FastAPI returns check_in_time as hh:mm AM/PM, so we need to calculate based on date/time.
    // For local convenience, let's calculate based on current time.
    // The server returns absolute check-in timestamp in get_today_attendance (which we can get from database or just estimate)
    // To make it exact, let's fetch today's attendance details with raw timestamp
    const timer = setInterval(() => {
      // Parse today's date + check-in string or use a mock timer increment
      // For reliable display, we can increment based on current time difference
      const [time, modifier] = todayData.check_in_time.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      
      const checkInDate = new Date();
      checkInDate.setHours(hours, minutes, 0, 0);
      
      const now = new Date();
      let diffMs = now - checkInDate;
      if (diffMs < 0) {
        // Handle timezone/date transition
        diffMs = 0;
      }
      
      const totalSecs = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
      const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSecs % 60).toString().padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [todayData]);

  const markNotificationRead = async (id) => {
    try {
      await fetch(`http://localhost:8000/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isCheckedIn = todayData?.status === 'CHECKED_IN';
  const isCompleted = todayData?.status === 'COMPLETED' || todayData?.status === 'PRESENT' || todayData?.status === 'HALF_DAY' || todayData?.status === 'INCOMPLETE';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-2xl border border-primary-200">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{getGreeting()}, {user.name}</h1>
            <p className="text-sm text-slate-500">Designation: Software Engineer • Dept: Engineering</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-right bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
          <p className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="text-xs text-slate-400">Work Mode: <span className="font-bold text-primary-600">{todayData?.today_work_mode || todayData?.employee_work_mode}</span></p>
        </div>
      </div>

      {/* Attendance & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Attendance Card */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Today's Attendance</h2>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                isCheckedIn ? 'bg-amber-100 text-amber-700' :
                isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {todayData?.status.replace('_', ' ')}
              </span>
            </div>
            
            <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-100 mb-6">
              <Clock className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <div className="text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
                {isCheckedIn ? elapsedTime : isCompleted ? `${todayData?.work_hours} hrs` : '--:--:--'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isCheckedIn ? 'Running Work Hours' : isCompleted ? 'Total Shift Logged' : 'Not Clocked In'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <p className="text-slate-400 text-xs">CHECK-IN</p>
                <p className="font-bold text-slate-700">{todayData?.check_in_time || '--'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">CHECK-OUT</p>
                <p className="font-bold text-slate-700">{todayData?.check_out_time || '--'}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('Attendance')}
            className={`w-full py-2.5 rounded-lg font-semibold transition text-sm flex items-center justify-center space-x-2 ${
              isCompleted 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
            }`}
            disabled={isCompleted}
          >
            {isCheckedIn ? 'Go to Check-Out' : isCompleted ? 'Shift Logged' : 'Verify & Check-In'}
          </button>
        </div>

        {/* Leave Summary */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Leave Balances</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
              <p className="text-emerald-800 text-xs font-semibold uppercase">Paid Leave</p>
              <p className="text-3xl font-extrabold text-emerald-900 mt-2">{balance.paid_leave} <span className="text-xs font-normal">days</span></p>
              <p className="text-emerald-600 text-xs mt-1">Available balance</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
              <p className="text-blue-800 text-xs font-semibold uppercase">Sick Leave</p>
              <p className="text-3xl font-extrabold text-blue-900 mt-2">{balance.sick_leave} <span className="text-xs font-normal">days</span></p>
              <p className="text-blue-600 text-xs mt-1">Available balance</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg">
              <p className="text-slate-800 text-xs font-semibold uppercase">Unpaid Leave</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">{balance.unpaid_leave} <span className="text-xs font-normal">days</span></p>
              <p className="text-slate-500 text-xs mt-1">Logged unpaid</p>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button onClick={() => onNavigate('Attendance')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg transition text-slate-700">
              <Compass className="h-5 w-5 text-primary-600 mb-2" />
              <span className="text-xs font-medium">Attendance</span>
            </button>
            <button onClick={() => onNavigate('Time Off')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg transition text-slate-700">
              <Calendar className="h-5 w-5 text-emerald-600 mb-2" />
              <span className="text-xs font-medium">Apply Leave</span>
            </button>
            <button onClick={() => onNavigate('My Profile')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg transition text-slate-700">
              <Award className="h-5 w-5 text-indigo-600 mb-2" />
              <span className="text-xs font-medium">My Profile</span>
            </button>
            <button onClick={() => onNavigate('Notifications')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-lg transition text-slate-700">
              <AlertCircle className="h-5 w-5 text-amber-600 mb-2" />
              <span className="text-xs font-medium">Notifications</span>
            </button>
          </div>
        </div>
      </div>

      {/* Smart Attendance Insights Section */}
      {insightsData && (
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-primary-500" />
            <span>Smart Attendance Insights</span>
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="border border-slate-100 p-4 rounded-lg bg-slate-50 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Consistency</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{insightsData.consistency_percentage}%</p>
            </div>
            <div className="border border-slate-100 p-4 rounded-lg bg-slate-50 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Late Check-ins</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{insightsData.late_checkins}</p>
            </div>
            <div className="border border-slate-100 p-4 rounded-lg bg-slate-50 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Incomplete Records</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{insightsData.incomplete_records}</p>
            </div>
            <div className="border border-slate-100 p-4 rounded-lg bg-slate-50 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Work Hours</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{insightsData.average_work_hours}h</p>
            </div>
          </div>

          {insightsData.insights.length > 0 && (
            <div className="bg-primary-50 border border-primary-100 p-4 rounded-lg space-y-2">
              <h3 className="text-xs font-bold text-primary-800 uppercase tracking-wide">Key Takeaways</h3>
              <ul className="list-disc list-inside text-xs text-primary-700 space-y-1">
                {insightsData.insights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Pending Requests & Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Requests */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Pending Leave Requests</h2>
          {leaves.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No pending leave requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaves.map((l) => (
                <div key={l.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{l.leave_type}</p>
                    <p className="text-xs text-slate-400">{l.start_date} to {l.end_date} • {l.num_days} day(s)</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">PENDING</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Notifications</h2>
            <button onClick={() => onNavigate('Notifications')} className="text-xs font-semibold text-primary-600 hover:text-primary-700">View All</button>
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
              <CheckCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">All caught up! No unread notifications.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="flex justify-between items-start p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex-1 mr-4">
                    <p className="text-xs text-slate-600">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{n.created_at}</p>
                  </div>
                  <button
                    onClick={() => markNotificationRead(n.id)}
                    className="text-xs text-slate-400 hover:text-primary-600 font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
