import React, { useState, useEffect } from 'react';
import { Edit2, X, Percent } from 'lucide-react';

export default function PayrollManager({ token }) {
  const [payrollList, setPayrollList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Edit modal
  const [selectedPay, setSelectedPay] = useState(null);
  
  // Form fields
  const [basic, setBasic] = useState(0);
  const [hra, setHra] = useState(0);
  const [allowances, setAllowances] = useState(0);
  const [pf, setPf] = useState(0);
  const [ptax, setPtax] = useState(0);
  const [deductions, setDeductions] = useState(0);

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/payroll', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load payroll records.");
      const list = await res.json();
      setPayrollList(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (pay) => {
    setSelectedPay(pay);
    setBasic(pay.basic_salary);
    setHra(pay.hra);
    setAllowances(pay.allowances);
    setPf(pay.pf);
    setPtax(pay.professional_tax);
    setDeductions(pay.other_deductions);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:8000/api/admin/payroll/${selectedPay.employee_id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          basic_salary: Number(basic),
          hra: Number(hra),
          allowances: Number(allowances),
          pf: Number(pf),
          professional_tax: Number(ptax),
          other_deductions: Number(deductions)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update payroll contract.");
      
      setSelectedPay(null);
      fetchPayroll();
    } catch (e) {
      alert(e.message);
    }
  };

  // Live calculations
  const liveGross = Number(basic) + Number(hra) + Number(allowances);
  const liveNet = liveGross - (Number(pf) + Number(ptax) + Number(deductions));

  if (loading) return <div className="text-slate-500 font-medium py-10 text-center">Loading Payroll contracts...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-extrabold text-slate-800 text-sm">Payroll Control</h3>
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Manage employee salary structures</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-150 p-4 rounded text-sm font-semibold">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Basic Salary</th>
              <th className="px-5 py-3">HRA</th>
              <th className="px-5 py-3">Allowances</th>
              <th className="px-5 py-3">Deductions (PF+Tax+Other)</th>
              <th className="px-5 py-3 text-slate-800 font-bold">Net Salary</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {payrollList.map((p) => {
              const totalDeductions = p.pf + p.professional_tax + p.other_deductions;
              return (
                <tr key={p.employee_id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{p.employee_id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">₹{p.basic_salary.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-600">₹{p.hra.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-600">₹{p.allowances.toLocaleString()}</td>
                  <td className="px-5 py-3 text-rose-600">₹{totalDeductions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-800 font-black text-sm">₹{p.net_salary.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button 
                      onClick={() => handleEditClick(p)}
                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition"
                      title="Adjust Salary"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Payroll Modal */}
      {selectedPay && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Adjust Salary Structure</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Salary rules for {selectedPay.employee_id}</p>
              </div>
              <button onClick={() => setSelectedPay(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
                <p className="text-slate-400 font-bold uppercase text-[9px]">Employee Profile</p>
                <p className="text-slate-800 font-bold mt-0.5">{selectedPay.name}</p>
              </div>

              {/* Earnings */}
              <div className="space-y-3">
                <h5 className="text-[10px] text-indigo-700 font-extrabold uppercase border-b border-indigo-50 pb-1 flex items-center space-x-1">
                  <span>💰 Monthly Earnings</span>
                </h5>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">Basic Salary</label>
                    <input type="number" required value={basic} onChange={e => setBasic(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">HRA (Rent)</label>
                    <input type="number" required value={hra} onChange={e => setHra(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Allowances</label>
                    <input type="number" required value={allowances} onChange={e => setAllowances(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-3">
                <h5 className="text-[10px] text-rose-700 font-extrabold uppercase border-b border-rose-50 pb-1 flex items-center space-x-1">
                  <span>📉 Deductions</span>
                </h5>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">PF Contribution</label>
                    <input type="number" required value={pf} onChange={e => setPf(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Prof. Tax (PT)</label>
                    <input type="number" required value={ptax} onChange={e => setPtax(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Other Deduct.</label>
                    <input type="number" required value={deductions} onChange={e => setDeductions(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                  </div>
                </div>
              </div>

              {/* Live Computations Panel */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 border border-slate-950 shadow">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>Gross Earnings:</span>
                  <span className="font-mono">₹{liveGross.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-rose-400">
                  <span>Total Deductions:</span>
                  <span className="font-mono">₹{(Number(pf) + Number(ptax) + Number(deductions)).toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-800 my-1"></div>
                <div className="flex items-center justify-between text-xs font-black text-white">
                  <span>ESTIMATED NET SALARY:</span>
                  <span className="font-mono text-sm text-emerald-400">₹{liveNet.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setSelectedPay(null)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
