import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, User, CalendarRange, Clock, Bell, LogOut, Lock, LogIn, ChevronRight, Sparkles, Settings
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Attendance from './components/Attendance';
import TimeOff from './components/TimeOff';
import Notifications from './components/Notifications';

// Admin / HR imports
import AdminDashboard from './components/admin/AdminDashboard';
import EmployeeManager from './components/admin/EmployeeManager';
import AttendanceManager from './components/admin/AttendanceManager';
import LeaveManager from './components/admin/LeaveManager';
import PayrollManager from './components/admin/PayrollManager';
import DocumentVerifier from './components/admin/DocumentVerifier';
import AdminSettings from './components/admin/AdminSettings';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  
  // Auth states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotFlow, setForgotFlow] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [loginRole, setLoginRole] = useState('employee'); // 'employee' | 'hr'

  // First-time login force reset states
  const [tempCurrent, setTempCurrent] = useState('');
  const [tempNew, setTempNew] = useState('');
  const [tempConfirm, setTempConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (token) {
      // Re-hydrate user details from token if needed
      // Decode JWT locally or query profile to get name/role
      fetchUserProfile();
    } else {
      setUser(null);
    }
  }, [token]);

  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'HR');

  // Helper to sync tab on login/role change
  useEffect(() => {
    if (user) {
      if (isAdmin && (activeTab === 'My Profile' || activeTab === 'Notifications')) {
        setActiveTab('Dashboard');
      } else if (!isAdmin && (activeTab === 'Employees' || activeTab === 'Payroll' || activeTab === 'Settings' || activeTab === 'Documents')) {
        setActiveTab('Dashboard');
      }
    }
  }, [user, isAdmin, activeTab]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/employee/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) handleLogout();
        return;
      }
      const data = await res.json();
      
      // Store basic user info
      setUser({
        employee_id: data.employee_id,
        name: `${data.first_name} ${data.last_name}`,
        email: data.email,
        role: localStorage.getItem('role') || 'EMPLOYEE',
        temp_password_active: data.temp_password_active,
        profile_picture: data.profile_picture
      });
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: username, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed. Please verify credentials.");
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      setToken(data.access_token);
      
      setUser({
        employee_id: data.employee_id,
        name: data.name,
        email: data.email,
        role: data.role,
        temp_password_active: data.temp_password_active
      });

      // Clear input fields
      setUsername('');
      setPassword('');
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setResetSuccess('');
    try {
      const res = await fetch('http://localhost:8000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_employee_id: forgotInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to process forgot password request.");
      
      setResetSuccess(data.message);
      setForgotInput('');
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleTempResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetLoading(true);

    if (tempNew !== tempConfirm) {
      setResetError("Passwords do not match.");
      setResetLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/auth/reset-temp-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: tempCurrent,
          new_password: tempNew,
          confirm_password: tempConfirm
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password update failed.");

      setResetSuccess(data.message);
      
      // Update user state
      setUser(prev => ({ ...prev, temp_password_active: false }));
      
      // Clear inputs
      setTempCurrent('');
      setTempNew('');
      setTempConfirm('');
    } catch (e) {
      setResetError(e.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken('');
    setUser(null);
    setActiveTab('Dashboard');
  };

  // Login view
  if (!token || !user) {
    const isHrMode = loginRole === 'hr';
    return (
      <div className={`min-h-screen flex transition-all duration-700 ${isHrMode ? 'bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-900' : 'bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-900'}`}>
        {/* Animated background circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse ${isHrMode ? 'bg-purple-400' : 'bg-cyan-400'}`} />
          <div className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse delay-1000 ${isHrMode ? 'bg-violet-400' : 'bg-blue-400'}`} />
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-2xl animate-pulse delay-500 ${isHrMode ? 'bg-pink-400' : 'bg-teal-400'}`} />
        </div>

        {/* Left brand panel */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-16 relative z-10">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl font-black text-white mb-8 shadow-2xl ${isHrMode ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'}`}>
            DF
          </div>
          <h1 className="text-5xl font-black text-white mb-4 leading-tight">Dayflow<br/><span className={isHrMode ? 'text-purple-300' : 'text-cyan-300'}>HRMS</span></h1>
          <p className="text-white/60 text-lg font-medium text-center max-w-sm">Every Workday,<br/>Perfectly Aligned.</p>
          <div className="mt-12 flex flex-col space-y-4 w-full max-w-xs">
            {[
              { icon: '🕐', text: 'Real-time Attendance Tracking' },
              { icon: '🤖', text: 'AI Face Recognition Check-In' },
              { icon: '📊', text: 'Smart HR Analytics Dashboard' },
              { icon: '📅', text: 'Leave & Payroll Management' },
            ].map((f, i) => (
              <div key={i} className="flex items-center space-x-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <span className="text-xl">{f.icon}</span>
                <span className="text-white/80 text-sm font-semibold">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right login card */}
        <div className="flex-1 flex items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-md">
            {/* Role toggle */}
            <div className="flex bg-white/10 backdrop-blur rounded-2xl p-1 mb-8 shadow-lg">
              <button
                onClick={() => { setLoginRole('employee'); setAuthError(''); setUsername(''); setPassword(''); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${!isHrMode ? 'bg-white text-blue-900 shadow-lg' : 'text-white/70 hover:text-white'}`}
              >
                <span>👤</span><span>Employee</span>
              </button>
              <button
                onClick={() => { setLoginRole('hr'); setAuthError(''); setUsername(''); setPassword(''); }}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isHrMode ? 'bg-white text-purple-900 shadow-lg' : 'text-white/70 hover:text-white'}`}
              >
                <span>🏢</span><span>HR / Admin</span>
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
              {/* Mobile logo */}
              <div className="lg:hidden flex items-center space-x-3 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white ${isHrMode ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'}`}>DF</div>
                <div>
                  <h2 className="text-white font-black text-xl">Dayflow HRMS</h2>
                  <p className="text-white/50 text-xs">Every Workday, Perfectly Aligned</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-white text-2xl font-black">{isHrMode ? '🏢 HR Portal' : '👤 Employee Login'}</h3>
                <p className="text-white/50 text-sm mt-1">
                  {isHrMode ? 'Sign in to manage your team and HR operations' : 'Sign in to track attendance, leaves & more'}
                </p>
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-xs font-semibold flex items-center space-x-2">
                  <span>⚠️</span><span>{authError}</span>
                </div>
              )}

              {forgotFlow ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <h4 className="text-white font-bold text-sm">Reset Password</h4>
                  {resetSuccess && <div className="p-3 bg-green-500/20 border border-green-400/30 rounded-xl text-green-200 text-xs font-semibold">{resetSuccess}</div>}
                  <div>
                    <label className="block text-white/70 text-xs font-bold uppercase mb-1.5 tracking-wider">Email or Employee ID</label>
                    <input
                      type="text" required value={forgotInput}
                      onChange={e => setForgotInput(e.target.value)}
                      placeholder="employee@dayflow.com"
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition"
                    />
                  </div>
                  <button type="submit" className={`w-full py-3 rounded-xl text-sm font-black text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isHrMode ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'}`}>
                    Send Reset Request
                  </button>
                  <button type="button" onClick={() => { setForgotFlow(false); setAuthError(''); setResetSuccess(''); }} className="w-full text-white/60 hover:text-white text-xs font-semibold py-1 transition">
                    ← Back to Login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-white/70 text-xs font-bold uppercase mb-1.5 tracking-wider">
                      {isHrMode ? 'Admin Email / ID' : 'Employee Email / ID'}
                    </label>
                    <input
                      type="text" required value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder={isHrMode ? 'admin@dayflow.com' : 'employee@dayflow.com'}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-xs font-bold uppercase mb-1.5 tracking-wider">Password</label>
                    <input
                      type="password" required value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setForgotFlow(true); setAuthError(''); }} className="text-white/50 hover:text-white/80 text-xs font-semibold transition">
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit" disabled={authLoading}
                    className={`w-full py-3.5 rounded-xl text-sm font-black text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${isHrMode ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-purple-900/50' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-blue-900/50'}`}
                  >
                    {authLoading ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Authenticating...</span></>
                    ) : (
                      <><LogIn className="h-4 w-4" /><span>Sign In to {isHrMode ? 'HR Portal' : 'My Workspace'}</span></>
                    )}
                  </button>

                  {!isHrMode && (
                    <p className="text-white/40 text-[11px] text-center pt-1">
                      Only registered employees can sign in. Contact HR to get access.
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Force Password change on first login
  if (user && user.temp_password_active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl border border-slate-200 shadow-lg">
          <div className="text-center">
            <Lock className="h-10 w-10 text-primary-600 mx-auto mb-2" />
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Change Temporary Password</h2>
            <p className="mt-1 text-xs text-slate-500">To secure your profile, HR requires you to change your temporary password before accessing the system.</p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleTempResetSubmit}>
            {resetError && <div className="p-3 bg-red-50 text-red-700 border border-red-150 rounded text-xs font-semibold">{resetError}</div>}
            {resetSuccess && <div className="p-3 bg-green-50 text-green-700 border border-green-150 rounded text-xs font-semibold">{resetSuccess}</div>}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temporary Password</label>
              <input
                type="password"
                required
                value={tempCurrent}
                onChange={(e) => setTempCurrent(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Secure Password</label>
              <input
                type="password"
                required
                value={tempNew}
                onChange={(e) => setTempNew(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={tempConfirm}
                onChange={(e) => setTempConfirm(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-slate-300 placeholder-slate-400 text-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-slate-50"
              />
            </div>

            <div className="flex flex-col space-y-3 pt-2">
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none transition shadow disabled:opacity-50"
              >
                {resetLoading ? 'Updating password...' : 'Update Password & Access Dashboard'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }



  // Dashboard sidebar layout
  const sidebarItems = isAdmin ? [
    { name: 'Dashboard', icon: LayoutDashboard, emoji: '📊' },
    { name: 'Employees', icon: User, emoji: '👥' },
    { name: 'Attendance', icon: Clock, emoji: '🕐' },
    { name: 'Time Off', icon: CalendarRange, emoji: '📅' },
    { name: 'Payroll', icon: Lock, emoji: '💰' },
    { name: 'Documents', icon: Sparkles, emoji: '📄' },
    { name: 'Settings', icon: Settings, emoji: '⚙️' }
  ] : [
    { name: 'Dashboard', icon: LayoutDashboard, emoji: '🏠' },
    { name: 'My Profile', icon: User, emoji: '👤' },
    { name: 'Attendance', icon: Clock, emoji: '🕐' },
    { name: 'Time Off', icon: CalendarRange, emoji: '🌴' },
    { name: 'Notifications', icon: Bell, emoji: '🔔' }
  ];

  const activeNavClass = isAdmin
    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/50'
    : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-900/50';
  const headerAccent = isAdmin ? 'from-violet-600 to-purple-600' : 'from-blue-600 to-cyan-600';
  const roleBadgeClass = isAdmin
    ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';



  return (
    <div className="min-h-screen flex" style={{background: isAdmin ? '#0f0a1e' : '#0a0f1e'}}>

      {/* ── SIDEBAR ─────────────────────────────── */}
      <aside className={`w-64 flex flex-col justify-between flex-shrink-0 hidden md:flex relative overflow-hidden`}
        style={{background: isAdmin
          ? 'linear-gradient(180deg, #1a0933 0%, #2d1b69 50%, #1e1040 100%)'
          : 'linear-gradient(180deg, #0a1628 0%, #0f2044 50%, #0a1628 100%)'}}>

        {/* Subtle glow orb behind sidebar */}
        <div className={`absolute top-0 left-0 w-full h-64 opacity-30 blur-3xl pointer-events-none`}
          style={{background: isAdmin ? 'radial-gradient(ellipse at 50% 0%, #7c3aed, transparent)' : 'radial-gradient(ellipse at 50% 0%, #2563eb, transparent)'}} />

        <div className="relative z-10">
          {/* Logo area */}
          <div className="px-6 py-5 border-b border-white/5">
            <div className="flex items-center space-x-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-xl`}
                style={{background: isAdmin
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'linear-gradient(135deg, #2563eb, #06b6d4)'}}>
                DF
              </div>
              <div>
                <p className="font-black text-sm text-white tracking-tight">Dayflow HRMS</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isAdmin ? 'text-violet-400' : 'text-cyan-400'}`}>
                  {isAdmin ? '🏢 HR Admin Panel' : '✨ My Workspace'}
                </p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="px-3 py-4 space-y-0.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                    isActive
                      ? activeNavClass
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`text-base transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                      {item.emoji}
                    </span>
                    <span className={isActive ? 'text-white font-bold' : ''}>{item.name}</span>
                  </div>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User footer */}
        <div className="relative z-10 p-4 border-t border-white/5">
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 mb-2">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0`}
              style={{background: isAdmin ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'linear-gradient(135deg,#2563eb,#06b6d4)'}}>
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div className="truncate min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className={`text-[9px] font-semibold truncate ${isAdmin ? 'text-violet-400' : 'text-cyan-400'}`}>{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-bold text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">

        {/* Top header */}
        <header className="bg-white border-b border-slate-100 flex items-center justify-between px-6 h-16 flex-shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            {/* Coloured accent bar */}
            <div className={`w-1 h-7 rounded-full bg-gradient-to-b ${headerAccent}`} />
            <div>
              <h1 className="font-black text-slate-800 text-base leading-tight">{activeTab}</h1>
              <p className="text-[10px] text-slate-400 font-semibold">
                {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className={`text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg border uppercase ${roleBadgeClass}`}>
              {user.role}
            </span>

            {!isAdmin && (
              <button
                onClick={() => setActiveTab('Notifications')}
                className="relative p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />
              </button>
            )}

            {/* User avatar pill */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-100">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black text-white`}
                style={{background: isAdmin ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'linear-gradient(135deg,#2563eb,#06b6d4)'}}>
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-700 leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition md:hidden"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {isAdmin ? (
              <>
                {activeTab === 'Dashboard' && <AdminDashboard token={token} onNavigate={setActiveTab} />}
                {activeTab === 'Employees' && <EmployeeManager token={token} />}
                {activeTab === 'Attendance' && <AttendanceManager token={token} />}
                {activeTab === 'Time Off' && <LeaveManager token={token} />}
                {activeTab === 'Payroll' && <PayrollManager token={token} />}
                {activeTab === 'Documents' && <DocumentVerifier token={token} />}
                {activeTab === 'Settings' && <AdminSettings token={token} />}
              </>
            ) : (
              <>
                {activeTab === 'Dashboard' && <Dashboard user={user} onNavigate={setActiveTab} token={token} />}
                {activeTab === 'My Profile' && <Profile user={user} token={token} />}
                {activeTab === 'Attendance' && <Attendance token={token} user={user} />}
                {activeTab === 'Time Off' && <TimeOff token={token} />}
                {activeTab === 'Notifications' && <Notifications token={token} onNavigate={setActiveTab} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
