import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Copy, CheckCheck, User, Key, Mail, IdCard } from 'lucide-react';

export default function EmployeeManager({ token }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [newEmpCredentials, setNewEmpCredentials] = useState(null); // { id, email, password, hasFace }
  const [copied, setCopied] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState(1);
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [employmentType, setEmploymentType] = useState('Full-Time');
  const [workMode, setWorkMode] = useState('OFFICE');
  const [faceImage, setFaceImage] = useState(null);
  const [facePreview, setFacePreview] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load employees list.");
      const list = await res.json();
      setEmployees(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('address', address);
      formData.append('designation', designation);
      formData.append('department_id', Number(departmentId));
      formData.append('joining_date', joiningDate);
      formData.append('employment_type', employmentType);
      formData.append('work_mode', workMode);
      if (faceImage) formData.append('face_image', faceImage);

      const res = await fetch('http://localhost:8000/api/admin/employees', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add employee.");
      
      const faceMsg = faceImage ? ' Face recognition pre-registered ✓' : ' (Remind employee to enroll face)';
      setNewEmpCredentials({
        id: data.employee_id,
        email: email,
        password: data.temporary_password,
        hasFace: data.face_registered === true,
        faceError: data.face_error || null,
        name: `${firstName} ${lastName}`
      });
      setIsAddOpen(false);
      resetForm();
      fetchEmployees();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEditClick = (emp) => {
    setSelectedEmp(emp);
    setFirstName(emp.first_name);
    setLastName(emp.last_name);
    setEmail(emp.email);
    setPhone(emp.phone || '');
    setAddress(emp.address || '');
    setDesignation(emp.designation);
    setDepartmentId(emp.department === 'Engineering' ? 1 : emp.department === 'Human Resources' ? 2 : 3);
    setEmploymentType(emp.employment_type);
    setWorkMode(emp.work_mode);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:8000/api/admin/employees/${selectedEmp.employee_id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          address,
          designation,
          department_id: Number(departmentId),
          employment_type: employmentType,
          work_mode: workMode
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update employee.");
      
      setIsEditOpen(false);
      resetForm();
      fetchEmployees();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteClick = async (empId) => {
    if (!window.confirm(`Are you sure you want to delete employee ${empId}? This will remove their user login and profile permanently.`)) return;
    try {
      const res = await fetch(`http://localhost:8000/api/admin/employees/${empId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete employee.");
      
      fetchEmployees();
    } catch (e) {
      alert(e.message);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setDesignation('');
    setDepartmentId(1);
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setEmploymentType('Full-Time');
    setWorkMode('OFFICE');
    setFaceImage(null);
    setFacePreview(null);
    setSelectedEmp(null);
  };

  if (loading) return <div className="text-slate-500 font-medium py-10 text-center">Loading Employees list...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">Employee Directory</h3>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Manage staff profiles</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg shadow transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Designation</th>
              <th className="px-5 py-3">Department</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Joining Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {employees.map((emp) => (
              <tr key={emp.employee_id} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 font-mono font-bold text-slate-500">{emp.employee_id}</td>
                <td className="px-5 py-3">
                  <div>
                    <p className="font-bold text-slate-900">{emp.first_name} {emp.last_name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{emp.email}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-600">{emp.designation}</td>
                <td className="px-5 py-3 text-slate-600">{emp.department}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    emp.work_mode === 'OFFICE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                    emp.work_mode === 'WFH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}>
                    {emp.work_mode}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{emp.joining_date}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button 
                      onClick={() => handleEditClick(emp)}
                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition"
                      title="Edit Profile"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(emp.employee_id)}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
                      title="Delete Employee"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">Add New Employee</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fill in profile details</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Phone</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Joining Date</label>
                  <input type="date" required value={joiningDate} onChange={e => setJoiningDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Designation</label>
                  <input type="text" required value={designation} onChange={e => setDesignation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Department</label>
                  <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value={1}>Engineering</option>
                    <option value={2}>Human Resources</option>
                    <option value={3}>Marketing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Employment Type</label>
                  <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Intern">Intern</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Default Work Mode</label>
                  <select value={workMode} onChange={e => setWorkMode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="OFFICE">OFFICE</option>
                    <option value="WFH">WFH</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"></textarea>
              </div>

              {/* Face Registration Photo */}
              <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/40">
                <label className="block font-bold text-indigo-700 mb-2 text-xs">📷 Face Recognition Photo <span className="font-normal text-slate-400">(Optional — auto-registers attendance)</span></label>
                {facePreview && (
                  <div className="mb-3 flex justify-center">
                    <img src={facePreview} alt="Face preview" className="h-20 w-20 rounded-full object-cover border-4 border-indigo-300 shadow" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) { setFaceImage(file); setFacePreview(URL.createObjectURL(file)); }
                  }}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"
                />
                {faceImage && <p className="text-[10px] text-indigo-600 font-bold mt-1.5">✓ Face photo selected — embedding will be extracted on save</p>}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">Edit Employee Profile</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Modify profile info for {selectedEmp.employee_id}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Email Address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Phone</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Default Work Mode</label>
                  <select value={workMode} onChange={e => setWorkMode(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="OFFICE">OFFICE</option>
                    <option value="WFH">WFH</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Designation</label>
                  <input type="text" required value={designation} onChange={e => setDesignation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Department</label>
                  <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value={1}>Engineering</option>
                    <option value={2}>Human Resources</option>
                    <option value={3}>Marketing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Employment Type</label>
                <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500">
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Intern">Intern</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREDENTIAL REVEAL MODAL ─────────────────────── */}
      {newEmpCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)'}}>
          <div className="relative w-full max-w-md">

            {/* Glow ring */}
            <div className="absolute -inset-1 rounded-3xl opacity-60 blur-xl"
              style={{background: 'linear-gradient(135deg, #7c3aed, #06b6d4)'}} />

            <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl">

              {/* Header gradient banner */}
              <div className="px-8 pt-8 pb-6 text-center"
                style={{background: 'linear-gradient(135deg, #1a0933 0%, #2d1b69 100%)'}}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-xl"
                  style={{background: 'linear-gradient(135deg,#7c3aed,#a855f7)'}}>
                  🎉
                </div>
                <h2 className="text-xl font-black text-white">Employee Registered!</h2>
                <p className="text-violet-300 text-sm mt-1 font-medium">
                  Share these credentials with <span className="text-white font-bold">{newEmpCredentials.name}</span>
                </p>
              </div>

              {/* Credentials body */}
              <div className="px-8 py-6 space-y-3">

                {/* Employee ID */}
                <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <IdCard className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Employee ID</p>
                    <p className="text-sm font-black text-slate-800 font-mono">{newEmpCredentials.id}</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Login Email</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{newEmpCredentials.email}</p>
                  </div>
                </div>

                {/* Temp Password — highlighted */}
                <div className="flex items-center space-x-3 border-2 border-amber-300 bg-amber-50 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
                    <Key className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Temporary Password</p>
                    <p className="text-sm font-black text-amber-900 font-mono tracking-wide">{newEmpCredentials.password}</p>
                  </div>
                </div>

                {/* Face status */}
                <div className={`flex items-start space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold ${
                  newEmpCredentials.hasFace
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : newEmpCredentials.faceError
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-orange-50 border border-orange-200 text-orange-700'
                }`}>
                  <span className="flex-shrink-0 mt-0.5">
                    {newEmpCredentials.hasFace ? '✅' : newEmpCredentials.faceError ? '❌' : '⚠️'}
                  </span>
                  <span>
                    {newEmpCredentials.hasFace
                      ? 'Face recognition pre-registered — employee can check-in immediately!'
                      : newEmpCredentials.faceError
                        ? <>Photo uploaded but face not detected: <b>{newEmpCredentials.faceError}</b> Employee must enroll face after login.</>
                        : 'No face photo uploaded — employee must enroll face after first login.'
                    }
                  </span>
                </div>

                {/* Copy all button */}
                <button
                  onClick={() => {
                    const text = `Dayflow HRMS Login Credentials\n\nEmployee ID: ${newEmpCredentials.id}\nEmail: ${newEmpCredentials.email}\nTemporary Password: ${newEmpCredentials.password}\n\nLogin at: http://localhost:5173\nYou will be asked to set a new password on first login.`;
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                  className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-black transition-all duration-200 ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'text-white hover:opacity-90'
                  }`}
                  style={copied ? {} : {background: 'linear-gradient(135deg,#7c3aed,#a855f7)'}}
                >
                  {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied to clipboard!' : 'Copy Credentials to Share'}</span>
                </button>

                <p className="text-[10px] text-slate-400 text-center font-medium">
                  Share via WhatsApp, email, or in-person. The employee must reset their password on first login.
                </p>

                <button
                  onClick={() => { setNewEmpCredentials(null); setCopied(false); }}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
