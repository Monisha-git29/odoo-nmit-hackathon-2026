import React, { useState, useEffect } from 'react';
import { Check, X, FileText, ExternalLink } from 'lucide-react';

export default function DocumentVerifier({ token }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load employee documents.");
      const data = await res.json();
      setDocs(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id, status) => {
    try {
      const res = await fetch(`http://localhost:8000/api/admin/documents/${id}/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          remarks
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Verification failed.");
      }
      alert(`Document marked as ${status}.`);
      setSelectedDoc(null);
      setRemarks('');
      fetchDocs();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="text-slate-500 font-medium py-10 text-center">Loading documents...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-extrabold text-slate-800 text-sm">Document Verification</h3>
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Audit employee resumes and certificates</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Document Name</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Uploaded Date</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {docs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-5 py-10 text-center text-slate-400 font-medium">No documents uploaded yet.</td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{d.employee_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{d.employee_id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{d.name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-500">
                      {d.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{d.uploaded_at}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      d.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      d.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {d.status === 'PENDING' ? (
                      <button 
                        onClick={() => { setSelectedDoc(d); setRemarks(''); }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-950 text-white rounded font-bold text-[10px] transition"
                      >
                        <span>Audit</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Verified</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Audit Document Verification</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verification ID: {selectedDoc.id}</p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Employee</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedDoc.employee_name} ({selectedDoc.employee_id})</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px]">Document Type</p>
                  <p className="text-slate-800 font-bold mt-0.5">{selectedDoc.type}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px]">Document File Name</p>
                <p className="text-slate-800 mt-0.5">{selectedDoc.name}</p>
              </div>

              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Uploaded PDF Document</p>
                <a 
                  href={`http://localhost:8000${selectedDoc.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-355 text-slate-700 rounded-md font-bold transition text-[10px]"
                >
                  <FileText className="h-4 w-4" />
                  <span>Open PDF in new tab</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Audit Verification Remarks (Reason for status)</label>
                <textarea 
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Provide feedback remarks for employee..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
                ></textarea>
              </div>

              <div className="flex justify-between space-x-3 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => handleVerify(selectedDoc.id, 'REJECTED')}
                  className="px-4 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg font-bold flex items-center space-x-1.5 transition"
                >
                  <X className="h-4 w-4" />
                  <span>Reject Document</span>
                </button>
                <button 
                  onClick={() => handleVerify(selectedDoc.id, 'APPROVED')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center space-x-1.5 shadow transition"
                >
                  <Check className="h-4 w-4" />
                  <span>Verify / Approve</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
