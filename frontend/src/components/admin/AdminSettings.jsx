import React, { useState, useEffect } from 'react';
import { Save, Shield } from 'lucide-react';

export default function AdminSettings({ token }) {
  const [lat, setLat] = useState(12.9716);
  const [lon, setLon] = useState(77.5946);
  const [radius, setRadius] = useState(100.0);
  const [workHours, setWorkHours] = useState(8.0);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load settings.");
      const data = await res.json();
      setLat(data.office_latitude);
      setLon(data.office_longitude);
      setRadius(data.geofence_radius);
      setWorkHours(data.standard_work_hours);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/admin/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          office_latitude: Number(lat),
          office_longitude: Number(lon),
          geofence_radius: Number(radius),
          standard_work_hours: Number(workHours)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update configurations.");
      setMessage("Organization settings updated successfully. Changes are now active for geofenced check-ins.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 font-medium py-10 text-center">Loading Settings...</div>;

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="font-extrabold text-slate-800 text-sm">Company Settings</h3>
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Configure geofencing and work policies</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>}
      {message && <div className="bg-emerald-50 text-emerald-700 border border-emerald-150 p-4 rounded text-sm font-semibold">{message}</div>}

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSave} className="space-y-4 text-xs font-semibold text-slate-700">
          
          <div className="space-y-3">
            <h4 className="text-[10px] text-indigo-700 font-extrabold uppercase border-b border-indigo-50 pb-1 flex items-center space-x-1">
              <span>📍 Geofence Configuration</span>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 mb-1">Office Latitude</label>
                <input 
                  type="number" 
                  step="0.000000000000001"
                  required 
                  value={lat} 
                  onChange={e => setLat(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" 
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Office Longitude</label>
                <input 
                  type="number" 
                  step="0.000000000000001"
                  required 
                  value={lon} 
                  onChange={e => setLon(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" 
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Allowed Radius (Meters)</label>
              <input 
                type="number" 
                required 
                value={radius} 
                onChange={e => setRadius(e.target.value)} 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" 
              />
              <p className="text-[10px] text-slate-400 font-medium mt-1">Employees working in OFFICE mode must check-in within this distance from coordinates.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-[10px] text-indigo-700 font-extrabold uppercase border-b border-indigo-50 pb-1 flex items-center space-x-1">
              <span>⏳ Attendance Policy</span>
            </h4>
            <div>
              <label className="block text-slate-500 mb-1">Standard Work Shift (Hours)</label>
              <input 
                type="number" 
                step="0.1"
                required 
                value={workHours} 
                onChange={e => setWorkHours(e.target.value)} 
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" 
              />
              <p className="text-[10px] text-slate-400 font-medium mt-1">Minimum hours required for a check-in cycle to mark as PRESENT.</p>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button 
              type="submit" 
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
