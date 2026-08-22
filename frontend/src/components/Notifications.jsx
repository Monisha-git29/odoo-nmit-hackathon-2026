import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Clock, Trash2, Check, ArrowRight } from 'lucide-react';

export default function Notifications({ token, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await fetch(`http://localhost:8000/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, status: 'READ' } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('http://localhost:8000/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => ({ ...n, status: 'READ' })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = (n) => {
    handleMarkRead(n.id);
    if (!n.link) return;
    
    // Map links to dashboard tab navigation names
    if (n.link.includes('profile')) onNavigate('My Profile');
    else if (n.link.includes('attendance') || n.link.includes('correction')) onNavigate('Attendance');
    else if (n.link.includes('timeoff') || n.link.includes('leave')) onNavigate('Time Off');
    else if (n.link.includes('dashboard')) onNavigate('Dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="relative p-2.5 bg-primary-50 text-primary-600 rounded-lg">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-white"></span>
            )}
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Notification Center</h1>
            <p className="text-xs text-slate-400">You have {unreadCount} unread notification(s)</p>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 rounded border border-primary-100 transition flex items-center space-x-1"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-medium">
            <Bell className="h-10 w-10 text-slate-200 mx-auto mb-2" />
            <p>You have no notifications yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex justify-between items-center transition hover:bg-slate-50 ${
                n.status === 'UNREAD' ? 'bg-primary-50/20' : ''
              }`}
            >
              <div className="flex-1 mr-6">
                <div className="flex items-center space-x-2">
                  <span className={`h-2 w-2 rounded-full ${n.status === 'UNREAD' ? 'bg-primary-600' : 'bg-transparent'}`}></span>
                  <p className={`text-sm ${n.status === 'UNREAD' ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                    {n.message}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-4">{n.created_at}</p>
              </div>

              <div className="flex items-center space-x-3">
                {n.link && (
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className="p-1.5 hover:bg-slate-150 text-slate-500 hover:text-primary-700 rounded transition flex items-center space-x-1 text-xs font-semibold"
                    title="Go to page"
                  >
                    <span>View</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {n.status === 'UNREAD' && !n.link && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1.5 hover:bg-slate-150 text-slate-400 hover:text-green-700 rounded transition"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
