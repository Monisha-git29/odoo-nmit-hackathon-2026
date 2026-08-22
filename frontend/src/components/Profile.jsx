import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, CreditCard, FileCode, Key, Camera, Check, Trash2, Eye, Upload } from 'lucide-react';

export default function Profile({ user, token, refreshUser }) {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Edit states
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // File upload states
  const [resumeFile, setResumeFile] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [certName, setCertName] = useState('');
  const [certType, setCertType] = useState('CERTIFICATE');

  // Change Password states
  const [passCurrent, setPassCurrent] = useState('');
  const [passNew, setPassNew] = useState('');
  const [passConfirm, setPassConfirm] = useState('');

  // Camera states for Face Enrollment
  const [cameraActive, setCameraActive] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/employee/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load profile.");
      const data = await res.json();
      setProfile(data);
      setPhone(data.phone || '');
      setAddress(data.address || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('http://localhost:8000/api/employee/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone, address })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed.");
      
      setSuccess("Contact details updated successfully.");
      setIsEditing(false);
      fetchProfile();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (passNew !== passConfirm) {
      setError("New passwords do not match.");
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: passCurrent,
          new_password: passNew,
          confirm_password: passConfirm
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password change failed.");
      
      setSuccess("Password changed successfully.");
      setPassCurrent('');
      setPassNew('');
      setPassConfirm('');
    } catch (e) {
      setError(e.message);
    }
  };

  // Upload Resume
  const handleUploadResume = async (e) => {
    e.preventDefault();
    if (!resumeFile) return;
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', resumeFile);
      formData.append('name', 'My Resume');
      formData.append('type', 'RESUME');

      const res = await fetch('http://localhost:8000/api/employee/upload-document', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Resume upload failed.");

      setSuccess("Resume uploaded successfully.");
      setResumeFile(null);
      fetchProfile();
    } catch (e) {
      setError(e.message);
    }
  };

  // Upload Certificate
  const handleUploadCertificate = async (e) => {
    e.preventDefault();
    if (!certFile || !certName) {
      setError("Please provide a name and select a file.");
      return;
    }
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', certFile);
      formData.append('name', certName);
      formData.append('type', 'CERTIFICATE');

      const res = await fetch('http://localhost:8000/api/employee/upload-document', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Certificate upload failed.");

      setSuccess("Certificate uploaded successfully.");
      setCertFile(null);
      setCertName('');
      fetchProfile();
    } catch (e) {
      setError(e.message);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (id) => {
    setError('');
    setSuccess('');
    if (!confirm("Are you sure you want to remove this document?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/employee/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Deletion failed.");
      
      setSuccess("Document removed.");
      fetchProfile();
    } catch (e) {
      setError(e.message);
    }
  };

  // Profile Picture Upload
  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('http://localhost:8000/api/employee/profile-picture', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Picture upload failed.");

      setSuccess("Profile picture updated.");
      fetchProfile();
    } catch (e) {
      setError(e.message);
    }
  };

  // Camera Management for Face Enrollment
  const startCamera = async () => {
    setError('');
    setSuccess('');
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setError("Failed to access camera: " + e.message);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const enrollFace = async () => {
    if (!videoRef.current) return;
    setError('');
    setSuccess('');
    setEnrollLoading(true);
    try {
      // Capture frame from video using a canvas
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 jpeg
      const frameBase64 = canvas.toDataURL('image/jpeg');
      
      // Post to backend
      const res = await fetch('http://localhost:8000/api/attendance/enroll-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image_base64: frameBase64,
          is_front_camera: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Face registration failed.");
      
      setSuccess("Face registered successfully! You can now clock in with face verification.");
      stopCamera();
      fetchProfile();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnrollLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header card */}
      <div className="bg-white rounded-lg border border-slate-100 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
          <div className="relative group">
            {profile.profile_picture ? (
              <img
                src={`http://localhost:8000${profile.profile_picture}`}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-2xl border border-primary-200">
                {profile.first_name[0]}{profile.last_name[0]}
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-primary-600 hover:bg-primary-700 text-white rounded-full p-1.5 cursor-pointer shadow border border-white">
              <Camera className="h-3.5 w-3.5" />
              <input type="file" onChange={handleProfilePictureUpload} accept="image/*" className="hidden" />
            </label>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{profile.first_name} {profile.last_name}</h1>
            <p className="text-sm font-medium text-slate-500">{profile.designation}</p>
            <p className="text-xs text-slate-400">ID: {profile.employee_id} • Dept: {profile.department}</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-col items-center sm:items-end">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary-50 text-primary-700 border border-primary-100">
            {profile.employment_type}
          </span>
          <p className="text-xs text-slate-400 mt-2">Work Mode: <span className="font-bold uppercase">{profile.work_mode}</span></p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50">
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'personal'
                ? 'border-primary-600 text-primary-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Personal Information</span>
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'private'
                ? 'border-primary-600 text-primary-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Employment Details</span>
          </button>
          <button
            onClick={() => setActiveTab('salary')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'salary'
                ? 'border-primary-600 text-primary-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>Salary Details</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'documents'
                ? 'border-primary-600 text-primary-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileCode className="h-4 w-4" />
            <span>Resume & Certs</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-primary-600 text-primary-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>Security & Face</span>
          </button>
        </div>

        {/* Tab contents */}
        <div className="p-6">
          {/* Messages */}
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-150 rounded text-sm font-medium">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-150 rounded text-sm font-medium">{success}</div>}

          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-700">Contact & Personal Details</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition"
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Details'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateContact} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Residential Address</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded font-semibold transition">
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Full Name</p>
                    <p className="text-slate-800 font-semibold mt-1">{profile.first_name} {profile.last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Official Email</p>
                    <p className="text-slate-800 font-semibold mt-1">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Phone Number</p>
                    <p className="text-slate-800 font-semibold mt-1">{profile.phone || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Residential Address</p>
                    <p className="text-slate-800 font-semibold mt-1 whitespace-pre-line">{profile.address || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Date of Birth</p>
                    <p className="text-slate-800 font-semibold mt-1">{profile.date_of_birth || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Gender</p>
                    <p className="text-slate-800 font-semibold mt-1">{profile.gender || '--'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EMPLOYMENT INFORMATION */}
          {activeTab === 'private' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-700">Official HR Details</h3>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">READ-ONLY</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Employee ID</p>
                  <p className="text-slate-700 font-semibold mt-1">{profile.employee_id}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Designation</p>
                  <p className="text-slate-700 font-semibold mt-1">{profile.designation}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Department</p>
                  <p className="text-slate-700 font-semibold mt-1">{profile.department}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Joining Date</p>
                  <p className="text-slate-700 font-semibold mt-1">{profile.joining_date}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Employment Type</p>
                  <p className="text-slate-700 font-semibold mt-1">{profile.employment_type}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Assigned Work Mode</p>
                  <p className="text-slate-700 font-semibold mt-1 font-mono uppercase text-primary-700">{profile.work_mode}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SALARY INFORMATION */}
          {activeTab === 'salary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-700">Monthly Compensation Breakdown</h3>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">READ-ONLY</span>
              </div>

              {profile.payroll ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Earnings */}
                  <div className="border border-slate-100 rounded-lg p-5 bg-slate-50">
                    <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wide border-b border-emerald-100 pb-2 mb-4">Earnings</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Basic Salary</span>
                        <span className="font-bold text-slate-700">₹{profile.payroll.basic_salary.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">HRA</span>
                        <span className="font-bold text-slate-700">₹{profile.payroll.hra.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Special Allowances</span>
                        <span className="font-bold text-slate-700">₹{profile.payroll.allowances.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="border border-slate-100 rounded-lg p-5 bg-slate-50">
                    <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide border-b border-red-100 pb-2 mb-4">Deductions</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Provident Fund (PF)</span>
                        <span className="font-bold text-slate-700">₹{profile.payroll.pf.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Professional Tax</span>
                        <span className="font-bold text-slate-700">₹{profile.payroll.professional_tax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Other Deductions</span>
                        <span className="font-bold text-slate-700">₹{profile.payroll.other_deductions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Compensation Summary */}
                  <div className="border border-primary-100 rounded-lg p-5 bg-primary-50 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-primary-800 uppercase tracking-wide border-b border-primary-100 pb-2 mb-4">Summary</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-slate-600 font-medium">
                          <span>Gross Salary</span>
                          <span>₹{profile.payroll.gross_salary.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-xs">
                          <span>Total Deductions</span>
                          <span>₹{(profile.payroll.pf + profile.payroll.professional_tax + profile.payroll.other_deductions).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-primary-200 pt-4 mt-4">
                      <p className="text-xs text-primary-600 uppercase font-bold">Net Salary (In-Hand)</p>
                      <p className="text-3xl font-black text-primary-900 mt-1">₹{profile.payroll.net_salary.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400 text-sm">Salary information has not been configured by HR yet.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RESUME & CERTIFICATIONS */}
          {activeTab === 'documents' && (
            <div className="space-y-8">
              {/* Resume Section */}
              <div>
                <h3 className="text-base font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">Resume Management</h3>
                
                {profile.documents.some(d => d.type === 'RESUME') ? (
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg max-w-2xl">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-rose-100 text-rose-700 rounded">
                        <FileCode className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Current Resume</p>
                        <p className="text-xs text-slate-400">Uploaded on: {profile.documents.find(d => d.type === 'RESUME').uploaded_at.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <a
                        href={`http://localhost:8000${profile.documents.find(d => d.type === 'RESUME').path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-150 rounded"
                      >
                        <Eye className="h-4.5 w-4.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteDocument(profile.documents.find(d => d.type === 'RESUME').id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUploadResume} className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 max-w-xl">
                    <input
                      type="file"
                      onChange={(e) => setResumeFile(e.target.files[0])}
                      accept=".pdf,.doc,.docx"
                      className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 file:hover:bg-primary-100 cursor-pointer"
                    />
                    <button
                      type="submit"
                      disabled={!resumeFile}
                      className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Resume</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Certifications Section */}
              <div>
                <h3 className="text-base font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">Certifications & Documents</h3>
                
                {/* Upload Form */}
                <form onSubmit={handleUploadCertificate} className="bg-slate-50 p-4 border border-slate-100 rounded-lg max-w-2xl mb-6 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Upload New Certificate</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Certificate Title</label>
                      <input
                        type="text"
                        value={certName}
                        onChange={(e) => setCertName(e.target.value)}
                        placeholder="e.g. AWS Solutions Architect"
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Select File (PDF/Image)</label>
                      <input
                        type="file"
                        onChange={(e) => setCertFile(e.target.files[0])}
                        accept="image/*,.pdf"
                        className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 file:hover:bg-slate-200 cursor-pointer"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded transition"
                  >
                    Add Certificate
                  </button>
                </form>

                {/* List certificates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.documents.filter(d => d.type === 'CERTIFICATE').length === 0 ? (
                    <div className="col-span-2 text-center py-6 border border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                      No certificates uploaded yet.
                    </div>
                  ) : (
                    profile.documents.filter(d => d.type === 'CERTIFICATE').map((c) => (
                      <div key={c.id} className="flex justify-between items-center p-3.5 bg-white border border-slate-150 rounded-lg shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-100 text-indigo-700 rounded">
                            <FileCode className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{c.name}</p>
                            <p className="text-[10px] text-slate-400">Added on: {c.uploaded_at.split('T')[0]}</p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <a
                            href={`http://localhost:8000${c.path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(c.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY, PASSWORD & FACE ENROLLMENT */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* Face Identity Enrollment */}
              <div>
                <h3 className="text-base font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">Face Identity Registration</h3>
                
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-1.5 rounded-full ${profile.has_enrolled_face ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {profile.has_enrolled_face ? 'Face Identity Registered (Normalized Embedding Stored)' : 'No Face Registered yet. Required to Clock In/Out.'}
                  </span>
                </div>

                {cameraActive ? (
                  <div className="space-y-4 max-w-md">
                    <div className="relative border-2 border-primary-500 rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100"></video>
                      {/* Face silhouette overlay */}
                      <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-white opacity-20 rounded-full m-8"></div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={enrollFace}
                        disabled={enrollLoading}
                        className="flex-1 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded transition shadow disabled:opacity-50"
                      >
                        {enrollLoading ? 'Generating embedding...' : 'Capture & Enroll Face'}
                      </button>
                      <button
                        onClick={stopCamera}
                        className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startCamera}
                    className="px-4 py-2.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded transition shadow flex items-center space-x-2"
                  >
                    <Camera className="h-4 w-4" />
                    <span>{profile.has_enrolled_face ? 'Re-enroll Face Identity' : 'Enroll Face Identity'}</span>
                  </button>
                )}
              </div>

              {/* Password Change */}
              <div>
                <h3 className="text-base font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">Change Account Password</h3>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Current Password</label>
                    <input
                      type="password"
                      value={passCurrent}
                      onChange={(e) => setPassCurrent(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">New Password</label>
                    <input
                      type="password"
                      value={passNew}
                      onChange={(e) => setPassNew(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passConfirm}
                      onChange={(e) => setPassConfirm(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded transition shadow"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
