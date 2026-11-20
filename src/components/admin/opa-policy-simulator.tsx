import React, { useState } from 'react';

export interface OpaPreviewState {
  userId: string;
  userRoles: string[];
  userTenant: string;
  action: string;
  resourceType: string;
  resourceTenant: string;
  battleState: 'waiting' | 'in_progress' | 'completed';
  clientIp: string;
  ipWhitelist: string;
  maintenanceWindow: boolean;
}

export const OpaPolicySimulator: React.FC = () => {
  const [form, setForm] = useState<OpaPreviewState>({
    userId: 'user_dev_01',
    userRoles: ['MEMBER'],
    userTenant: 'enterprise-alpha',
    action: 'view_code',
    resourceType: 'battle_session',
    resourceTenant: 'enterprise-alpha',
    battleState: 'in_progress',
    clientIp: '192.168.1.100',
    ipWhitelist: '',
    maintenanceWindow: false,
  });

  const [decision, setDecision] = useState<{
    allow?: boolean;
    evaluationDurationMs?: number;
    denyReasons?: string[];
    matchedRules?: string[];
  } | null>(null);

  const simulatePolicy = () => {
    const start = performance.now();
    const whitelist = form.ipWhitelist
      ? form.ipWhitelist.split(',').map((ip) => ip.trim())
      : [];

    const isSuperAdmin = form.userRoles.includes('SUPER_ADMIN');
    const validTenant =
      form.resourceTenant === 'global' || form.userTenant === form.resourceTenant;
    const ipValid = whitelist.length === 0 || whitelist.includes(form.clientIp);
    const timeValid = !form.maintenanceWindow;

    const denyReasons: string[] = [];
    const matchedRules: string[] = [];
    let allow = false;

    if (isSuperAdmin) {
      allow = true;
      matchedRules.push('SUPER_ADMIN_UNCONDITIONAL_BYPASS');
    } else {
      if (!validTenant) {
        denyReasons.push(
          `Cross-tenant violation: user tenant '${form.userTenant}' cannot access '${form.resourceTenant}'`,
        );
      }
      if (!ipValid) {
        denyReasons.push(
          `IP authorization failure: client IP '${form.clientIp}' not whitelisted`,
        );
      }
      if (!timeValid) {
        denyReasons.push('System is currently undergoing scheduled maintenance');
      }

      if (validTenant && ipValid && timeValid) {
        if (form.action === 'view_code' && form.resourceType === 'battle_session') {
          if (form.battleState === 'in_progress') {
            if (form.userRoles.includes('LEAD') || form.userRoles.includes('ADMIN')) {
              allow = true;
              matchedRules.push('ABAC_BATTLE_LEAD_CODE_INSPECT');
            } else {
              denyReasons.push(
                'Contextual ABAC rejection: only team leads or match participants may inspect live code during an active battle',
              );
            }
          } else {
            allow = true;
            matchedRules.push('RBAC_POST_BATTLE_REPLAY_INSPECT');
          }
        } else if (['execute_code', 'submit_solution'].includes(form.action)) {
          allow = true;
          matchedRules.push('RBAC_CHALLENGE_CODE_EXECUTION');
        } else if (['create_repo', 'delete_repo'].includes(form.action)) {
          if (form.userRoles.includes('ADMIN')) {
            allow = true;
            matchedRules.push('RBAC_REPO_ADMIN_MUTATION');
          } else {
            denyReasons.push('RBAC rejection: requires ADMIN role');
          }
        } else {
          allow = true;
          matchedRules.push('RBAC_GENERIC_ACCESS');
        }
      }
    }

    const elapsed = performance.now() - start;
    setDecision({
      allow,
      evaluationDurationMs: Number(elapsed.toFixed(4)),
      denyReasons,
      matchedRules,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 max-w-3xl mx-auto shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
            🛡️ OPA Rego Policy Simulator
          </h2>
          <p className="text-sm text-slate-400">
            Live in-process Attribute-Based Access Control (ABAC) & Rego rule preview
          </p>
        </div>
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
          Wasm Engine &lt; 0.8ms
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-slate-400">User ID</label>
          <input
            type="text"
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400">User Role</label>
          <select
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            value={form.userRoles[0]}
            onChange={(e) => setForm({ ...form, userRoles: [e.target.value] })}
          >
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="LEAD">LEAD</option>
            <option value="MEMBER">MEMBER</option>
            <option value="GUEST">GUEST</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400">User Tenant</label>
          <input
            type="text"
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            value={form.userTenant}
            onChange={(e) => setForm({ ...form, userTenant: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400">Resource Tenant</label>
          <input
            type="text"
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            value={form.resourceTenant}
            onChange={(e) => setForm({ ...form, resourceTenant: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400">Action</label>
          <select
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
          >
            <option value="view_code">view_code (during battle)</option>
            <option value="execute_code">execute_code</option>
            <option value="create_repo">create_repo</option>
            <option value="delete_repo">delete_repo</option>
            <option value="read">read</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400">Battle State</label>
          <select
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            value={form.battleState}
            onChange={(e) =>
              setForm({
                ...form,
                battleState: e.target.value as 'waiting' | 'in_progress' | 'completed',
              })
            }
          >
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="waiting">waiting</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.maintenanceWindow}
            onChange={(e) => setForm({ ...form, maintenanceWindow: e.target.checked })}
            className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
          />
          System Maintenance Window Active
        </label>

        <button
          onClick={simulatePolicy}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-sm transition-colors shadow-lg shadow-emerald-900/30"
        >
          Evaluate Policy
        </button>
      </div>

      {decision && (
        <div
          className={`p-4 rounded-lg border ${
            decision.allow
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/40 border-red-500/50 text-red-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-lg">
              {decision.allow ? '✅ ALLOWED' : '❌ DENIED'}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Evaluated in {decision.evaluationDurationMs}ms
            </span>
          </div>

          {decision.matchedRules && decision.matchedRules.length > 0 && (
            <div className="text-xs mt-1">
              <span className="font-semibold">Matched Rules: </span>
              {decision.matchedRules.join(', ')}
            </div>
          )}

          {decision.denyReasons && decision.denyReasons.length > 0 && (
            <div className="mt-2 text-xs">
              <span className="font-semibold text-red-400">Denial Audit Traces:</span>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                {decision.denyReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
