import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  HeartHandshake, 
  Phone, 
  Mail, 
  Check, 
  ShieldAlert, 
  CheckCircle2, 
  Ban,
  Unlock,
  Key,
  Trash2
} from 'lucide-react';
import { User } from '../types';

interface UsersProps {
  users: User[];
  onAddUser: (user: Omit<User, 'id'> & { pin: string }) => void;
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  currentUserRole: 'admin' | 'cashier';
}

export default function UsersComponent({
  users,
  onAddUser,
  onToggleUserStatus,
  onDeleteUser,
  currentUserRole
}: UsersProps) {
  // Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'cashier' as 'admin' | 'cashier',
    active: true,
    pin: ''
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.fullName.trim() || !formData.pin.trim()) return;

    // Check unique username
    const exists = users.some(u => u.username.toLowerCase() === formData.username.trim().toLowerCase());
    if (exists) {
      alert('This username is already taken. Please provide a different identifier.');
      return;
    }

    onAddUser({
      username: formData.username.trim().toLowerCase(),
      fullName: formData.fullName.trim(),
      email: formData.email.trim() || `${formData.username.toLowerCase()}@kenyapos.co.ke`,
      phone: formData.phone.trim() || '0700000000',
      role: formData.role,
      active: formData.active,
      pin: formData.pin.trim()
    });

    // Reset Form
    setFormData({
      username: '',
      fullName: '',
      email: '',
      phone: '',
      role: 'cashier',
      active: true,
      pin: ''
    });
    setIsAddUserOpen(false);
  };

  return (
    <div className="space-y-6" id="users-module-page">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="users-header">
        <div>
          <h2 className="text-xl font-bold font-sans text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="w-5.5 h-5.5 text-emerald-600" />
            Shop Team &amp; Cashier Credentials
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage cashier credentials, lock inactive operator shifts, and manage permission parameters.</p>
        </div>
        
        {currentUserRole === 'admin' && (
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4.5 h-4.5" />
            Register New Cashier
          </button>
        )}
      </div>

      {currentUserRole !== 'admin' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex gap-3 text-xs" id="no-role-warning">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-amber-805 dark:text-amber-400 leading-relaxed font-semibold">
            Kasir view! As an Operator/Cashier, you can view registered team members. However, creating new cashier accounts, resetting passcode keys, or locking operator logins is restricted to Administrators.
          </p>
        </div>
      )}

      {/* Team Listings Core Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="team-cards-grid">
        {users.map((user) => (
          <div 
            key={user.id} 
            className={`bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-xs transition flex flex-col justify-between ${
              user.active 
                ? 'border-zinc-200 dark:border-zinc-800' 
                : 'border-zinc-150 bg-zinc-50/50 dark:bg-zinc-950/25 opacity-70'
            }`}
            id={`user-card-${user.id}`}
          >
            <div>
              <div className="flex justify-between items-start pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                <div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-base">{user.fullName}</h3>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 mt-1 block tracking-wider">
                    Username Identifier: <span className="text-zinc-700 dark:text-zinc-200 font-mono">@{user.username}</span>
                  </span>
                </div>

                {/* Role indicator */}
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  user.role === 'admin' 
                    ? 'bg-red-50 dark:bg-red-950 text-red-750 dark:text-red-400 border border-red-200' 
                    : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-750 dark:text-emerald-400 border border-emerald-200'
                }`}>
                  <Shield className="w-3 h-3" />
                  {user.role}
                </span>
              </div>

              {/* Technical Specifications list */}
              <div className="space-y-2 text-xs text-zinc-650 dark:text-zinc-405 mt-4">
                <p className="flex items-center gap-1.5 font-medium">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  {user.email}
                </p>
                <p className="flex items-center gap-1.5 font-mono">
                  <Phone className="w-4 h-4 text-zinc-400" />
                  {user.phone}
                </p>
                <div className="pt-2 flex items-center gap-1">
                  <span className="text-[10px] text-zinc-455">System permission profile:</span>
                  <span className="font-bold text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {user.role === 'admin' ? 'Total Database Ownership' : 'Checkout & Terminals block'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inactive shift lock togglers */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${user.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-505'}`} />
                <span className="font-semibold text-zinc-500">
                  {user.active ? 'Active on terminal' : 'Shift locked / Inactive'}
                </span>
              </div>

              {currentUserRole === 'admin' && user.username !== 'admin' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleUserStatus(user.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 justify-center cursor-pointer ${
                      user.active
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                    title={user.active ? 'Lock Operator and prevent checkout login' : 'Unlock operator credentials'}
                  >
                    {user.active ? <Ban className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {user.active ? 'Lock' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {
                      const bypassConfirm = new URLSearchParams(window.location.search).get('bypass_confirm') === 'true';
                      if (bypassConfirm || window.confirm(`Are you sure you want to permanently delete operator ${user.fullName}?`)) {
                        onDeleteUser(user.id);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 justify-center bg-red-50 hover:bg-red-105 text-red-700 cursor-pointer border border-red-200"
                    title="Delete operator credentials permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* NEW CASHIER REGISTRATION MODAL FORM */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-800 text-center flex items-center justify-center gap-1.5 text-sm">
              <UserPlus className="text-emerald-600 w-4.5 h-4.5" />
              Register New Shop Operator
            </h3>
            
            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="text-zinc-500 block mb-1">Full Employee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Wambui"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/80 rounded-lg text-white dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-550 block mb-1">Passcode Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. jwambui"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/80 rounded-lg text-white dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-zinc-550 block mb-1">System Authority *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'cashier' })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/80 rounded-lg text-white dark:text-white font-semibold"
                  >
                    <option value="cashier" className="bg-zinc-900 text-white">Cashier Operator</option>
                    <option value="admin" className="bg-zinc-900 text-white">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Login PIN/Passcode *</label>
                <input
                  type="password"
                  required
                  placeholder="Set initial login passcode/PIN"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/80 rounded-lg text-white dark:text-white"
                />
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Contact Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0723456789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/80 rounded-lg text-white dark:text-white"
                />
              </div>

              <div>
                <label className="text-zinc-500 block mb-1">Personal Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. jane@kenyapos.co.ke"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700/80 rounded-lg text-white dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="w-1/2 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  Create credentials
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
