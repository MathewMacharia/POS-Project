import React, { useState, useMemo } from 'react';
import { ShieldCheck, Calendar, Search, Trash2, Key, HelpCircle } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogsProps {
  logs: AuditLog[];
  onClearLogs: () => void;
  currentUserRole: 'admin' | 'cashier';
  onRestoreWipedData: (payload: string) => void;
}

export default function AuditLogs({
  logs,
  onClearLogs,
  currentUserRole,
  onRestoreWipedData
}: AuditLogsProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (!search) return true;
      return (
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [logs, search]);

  return (
    <div className="space-y-6" id="audit-logs-page">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="audit-logs-header">
        <div>
          <h2 className="text-xl font-bold font-sans text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5.5 h-5.5 text-emerald-600 pointer-events-none" />
            Security Audit Logs &amp; Session Traces
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-405">Immutable record of logins, transactions, inventory deletions and administration overrides.</p>
        </div>
        
        {currentUserRole === 'admin' && logs.length > 0 && (
          <button
            onClick={() => {
              const confirmClear = window.confirm("Futa logs zote? Clean audit records? This override cannot be reverted.");
              if (confirmClear) onClearLogs();
            }}
            className="px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-805 text-red-600 border border-zinc-200 dark:border-zinc-750 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear Audit Trail
          </button>
        )}
      </div>

      {/* Filter and Table Tools Panel */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-3.5 justify-between" id="audit-search-wrapper">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-zinc-400" />
          <input
            id="audit-search-input"
            type="text"
            placeholder="Search security trail by User, Action details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden"
          />
        </div>
      </div>

      {/* Core Audit table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden" id="audit-table-element-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="audit-logs-table">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-220 dark:border-zinc-800 font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-450">
                <th className="py-3.5 px-4 font-mono">Timestamp</th>
                <th className="py-3.5 px-4">Operator</th>
                <th className="py-3.5 px-4">System action</th>
                <th className="py-3.5 px-4">Trace Details</th>
                <th className="py-3.5 px-4 text-center">Actions &amp; Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    <HelpCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    No security audit logs found matching lookup filters.
                  </td>
                </tr>
              ) : (
                filtered.slice().reverse().map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition text-zinc-700 dark:text-zinc-300">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono font-medium text-zinc-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-KE')}
                    </td>
                    
                    {/* Username indicator */}
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      <span className="inline-flex items-center gap-1.5 font-sans">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block pointer-events-none"></span>
                        {log.userName}
                      </span>
                    </td>

                    {/* System Action */}
                    <td className="py-3 px-4 font-bold text-zinc-950 dark:text-zinc-100 uppercase tracking-tight text-[11px]">
                      {log.action}
                    </td>

                    {/* Details and notes */}
                    <td className="py-3 px-4 font-medium text-zinc-500 leading-relaxed max-w-sm">
                      {log.details}
                    </td>

                    {/* Immutable Badge status & Restore Option */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400 font-mono text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider">
                          SECURE LOG
                        </span>
                        {log.restorePayload && currentUserRole === 'admin' && (
                          <button
                            onClick={() => {
                              const confirmRestore = window.confirm("Je, ungependa kurejesha data hii iliyofutwa? Restore this wiped data version? Existing records will be merged.");
                              if (confirmRestore && log.restorePayload) {
                                onRestoreWipedData(log.restorePayload);
                              }
                            }}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md text-[10px] transition cursor-pointer"
                          >
                            Restore version
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
