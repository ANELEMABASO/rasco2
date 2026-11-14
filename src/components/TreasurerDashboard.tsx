import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Power,
  RefreshCw,
  ExternalLink,
  Sliders,
  Trash2,
  Plus,
  Zap,
  CheckCircle2,
  XCircle,
  Wallet,
  Users,
  Key,
  Info,
  Clock,
  Sparkles,
  Inbox
} from 'lucide-react';
import { AttemptResult, AuditLog, MemberClaim, SignerInfo } from '../types.ts';
import { DEMO_MODE } from '../api.ts';

interface TreasurerDashboardProps {
  isAgentActive: boolean;
  onToggleKillSwitch: () => void;
  perPaymentCap: number;
  setPerPaymentCap: (val: number) => void;
  monthlyCap: number;
  setMonthlyCap: (val: number) => void;
  approvedRecipients: string[];
  onAddRecipient: (rec: string) => void;
  onRemoveRecipient: (rec: string) => void;
  treasuryBalance: number;
  monthlySpent: number;
  logs: AuditLog[];
  onSimulatePayment: (data: { amount: string; recipient: string; reason: string; skipPolicy?: boolean }) => void;
  claims: MemberClaim[];
  signers: SignerInfo[];
  quorum: number;
  treasuryAddress: string;
  strangerAddress: string;
  agentMode: 'llm' | 'rules';
  attemptPending: boolean;
  lastAttempt: AttemptResult | null;
  onRunAgentCycle: () => void;
  cycleRunning: boolean;
  cycleSummary: string | null;
  explorerTx: string;
}

export const TreasurerDashboard: React.FC<TreasurerDashboardProps> = ({
  isAgentActive,
  onToggleKillSwitch,
  perPaymentCap,
  setPerPaymentCap,
  monthlyCap,
  setMonthlyCap,
  approvedRecipients,
  onAddRecipient,
  onRemoveRecipient,
  treasuryBalance,
  monthlySpent,
  logs,
  onSimulatePayment,
  claims,
  signers,
  quorum,
  treasuryAddress,
  strangerAddress,
  agentMode,
  attemptPending,
  lastAttempt,
  onRunAgentCycle,
  cycleRunning,
  cycleSummary,
  explorerTx
}) => {
  const [recipientInput, setRecipientInput] = useState('');

  // Caps are edited as drafts and saved on blur/Enter
  const [draftPer, setDraftPer] = useState(String(perPaymentCap));
  const [draftMonthly, setDraftMonthly] = useState(String(monthlyCap));
  const [editingCap, setEditingCap] = useState<'per' | 'monthly' | null>(null);

  useEffect(() => {
    if (editingCap !== 'per') setDraftPer(String(perPaymentCap));
    if (editingCap !== 'monthly') setDraftMonthly(String(monthlyCap));
  }, [perPaymentCap, monthlyCap, editingCap]);

  const commitCap = (which: 'per' | 'monthly') => {
    setEditingCap(null);
    const value = Number(which === 'per' ? draftPer : draftMonthly);
    const current = which === 'per' ? perPaymentCap : monthlyCap;
    if (!Number.isFinite(value) || value <= 0 || value === current) {
      if (which === 'per') setDraftPer(String(perPaymentCap));
      else setDraftMonthly(String(monthlyCap));
      return;
    }
    (which === 'per' ? setPerPaymentCap : setMonthlyCap)(value);
  };

  const onCapKey = (which: 'per' | 'monthly') => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setEditingCap(null);
      if (which === 'per') setDraftPer(String(perPaymentCap));
      else setDraftMonthly(String(monthlyCap));
      e.currentTarget.blur();
    }
  };

  const [skipPolicy, setSkipPolicy] = useState(false);
  const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 7)}...${a.slice(-5)}` : a);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Simulator State
  const [simAmount, setSimAmount] = useState<string>('15');
  const [simRecipient, setSimRecipient] = useState<string>(approvedRecipients[0] || '');
  useEffect(() => {
    if (!simRecipient && approvedRecipients[0]) setSimRecipient(approvedRecipients[0]);
  }, [approvedRecipients, simRecipient]);
  const [simReason, setSimReason] = useState<string>('Bereavement grant disbursement');
  const [activeTab, setActiveTab] = useState<'audit' | 'claims'>('audit');

  const handleAddRecipientForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = recipientInput.trim();
    if (trimmed) {
      onAddRecipient(trimmed);
      setRecipientInput('');
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'ALL') return true;
    return log.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Top Metric Cards - Matching Frosted Glass Aesthetic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center justify-between text-white transition hover:bg-white/[0.11]">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              Stokvel Treasury Reserve
            </p>
            <p className="text-2xl font-bold text-white mt-1 font-mono drop-shadow">
              {treasuryBalance.toLocaleString()}{' '}
              <span className="text-sm font-normal text-amber-300">XRP</span>
            </p>
            <p className="text-[11px] text-emerald-300 mt-1 flex items-center gap-1 font-mono">
              ≈ R{(treasuryBalance * 22.4).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
              ZAR
            </p>
          </div>
          <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-400/30 shadow-md">
            <Wallet size={24} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center justify-between text-white transition hover:bg-white/[0.11]">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              Monthly Budget Burn
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-white font-mono drop-shadow">{monthlySpent}</p>
              <p className="text-xs text-white/60 font-mono">/ {monthlyCap} XRP</p>
            </div>
            <div className="w-32 bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-300 ${
                  monthlySpent / monthlyCap > 0.8
                    ? 'bg-amber-400'
                    : monthlySpent / monthlyCap > 1
                    ? 'bg-rose-400'
                    : 'bg-indigo-300'
                }`}
                style={{ width: `${Math.min(100, (monthlySpent / monthlyCap) * 100)}%` }}
              />
            </div>
          </div>
          <div className="p-3 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-400/30 shadow-md">
            <Clock size={24} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center justify-between text-white transition hover:bg-white/[0.11]">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              On-Ledger Quorum
            </p>
            <p className="text-2xl font-bold text-white mt-1 font-mono drop-shadow">
              {quorum} <span className="text-sm font-normal text-white/70">weight</span>
            </p>
            <p className="text-[11px] text-white/60 mt-1">
              {isAgentActive
                ? 'Agent + Policy Service, or Human'
                : 'Agent removed: Human or Human + Policy'}
            </p>
          </div>
          <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30 shadow-md">
            <Key size={24} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] flex items-center justify-between text-white transition hover:bg-white/[0.11]">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              Approved Vendors
            </p>
            <p className="text-2xl font-bold text-white mt-1 font-mono drop-shadow">
              {approvedRecipients.length}
            </p>
            <p className="text-[11px] text-emerald-300 mt-1">Strict Whitelist Enforcement</p>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30 shadow-md">
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Mandate Controls & Signers */}
        <div className="space-y-6">
          {/* Mandate & Limits Card */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
            <h2 className="text-base font-bold tracking-wide uppercase mb-4 flex items-center gap-2 text-amber-300">
              <Sliders size={18} /> Mandate &amp; Limits
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold tracking-wider uppercase text-white/80">
                    Per-Payment Cap (XRP)
                  </label>
                  <span className="text-[10px] font-mono text-amber-200 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
                    Max {perPaymentCap} XRP
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draftPer}
                  onFocus={() => setEditingCap('per')}
                  onChange={(e) => setDraftPer(e.target.value)}
                  onBlur={() => commitCap('per')}
                  onKeyDown={onCapKey('per')}
                  className="w-full bg-black/30 border border-white/20 hover:border-white/50 focus:border-amber-400 rounded-xl p-2.5 text-white font-mono text-sm outline-none transition placeholder:text-white/30"
                />
                <p className="text-[10px] text-white/50 mt-1">
                  Enforced by the policy service. Press Enter or blur to save; applies to next
                  attempt.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold tracking-wider uppercase text-white/80">
                    Monthly Budget Cap (XRP)
                  </label>
                  <span className="text-[10px] font-mono text-amber-200 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
                    Max {monthlyCap} XRP
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={draftMonthly}
                  onFocus={() => setEditingCap('monthly')}
                  onChange={(e) => setDraftMonthly(e.target.value)}
                  onBlur={() => commitCap('monthly')}
                  onKeyDown={onCapKey('monthly')}
                  className="w-full bg-black/30 border border-white/20 hover:border-white/50 focus:border-amber-400 rounded-xl p-2.5 text-white font-mono text-sm outline-none transition placeholder:text-white/30"
                />
                <p className="text-[10px] text-white/50 mt-1">
                  Calendar-month allocation (UTC). Spent so far: {monthlySpent} XRP.
                </p>
              </div>

              <hr className="border-white/10 my-4" />

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold tracking-wider uppercase text-white/80">
                    Approved Recipients (Vendors)
                  </label>
                  <span className="text-[10px] text-white/50 font-mono">
                    {approvedRecipients.length} registered
                  </span>
                </div>

                <ul className="space-y-2 mb-3 max-h-56 overflow-y-auto pr-1">
                  {approvedRecipients.map((rec, idx) => (
                    <li
                      key={idx}
                      className="group bg-black/25 px-3 py-2 rounded-xl text-xs border border-white/10 text-amber-200 flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-mono" title={rec}>
                        {rec}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveRecipient(rec)}
                        className="opacity-50 group-hover:opacity-100 hover:text-red-400 text-white/60 p-1 rounded transition cursor-pointer"
                        title="Remove recipient from approved whitelist"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>

                <form onSubmit={handleAddRecipientForm} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="rAddress Label (e.g. rPT1... Funeral Parlour)"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    className="flex-1 bg-black/30 border border-white/20 rounded-xl p-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="bg-[#1e2532] hover:bg-[#151b26] border border-white/20 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1 cursor-pointer transition shadow-md"
                  >
                    <Plus size={14} /> Add
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Multi-Sig Signer Ring: read live from the ledger */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
            <h3 className="text-sm font-bold tracking-wide uppercase text-amber-300 flex items-center gap-2 mb-1">
              <Users size={16} /> Signer List on XRPL (Quorum {quorum})
            </h3>
            {treasuryAddress && (
              <a
                href={DEMO_MODE ? undefined : explorerTx.replace('/transactions/', '/accounts/') + treasuryAddress}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 mb-3"
              >
                Treasury {shortAddr(treasuryAddress)} <ExternalLink size={10} />
              </a>
            )}
            <div className="space-y-2.5 text-xs">
              {signers.length === 0 && (
                <p className="text-white/50">Waiting for ledger...</p>
              )}
              {signers.map((signer) => (
                <div
                  key={signer.account}
                  className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/10"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        signer.role === 'agent'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-white">{signer.label}</p>
                      <p className="text-[10px] font-mono text-white/50">
                        {shortAddr(signer.account)} (Weight: {signer.weight})
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      signer.role === 'agent'
                        ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                    }`}
                  >
                    {signer.role === 'human'
                      ? 'Human Signer'
                      : signer.role === 'policy'
                      ? 'Policy Service'
                      : 'Active Agent'}
                  </span>
                </div>
              ))}
              {!isAgentActive && signers.length > 0 && (
                <div className="flex items-center justify-between bg-red-950/40 p-2.5 rounded-xl border border-red-500/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <div>
                      <p className="font-semibold text-red-200">AI Treasurer Agent</p>
                      <p className="text-[10px] font-mono text-red-300/70">
                        Removed from the ledger signer list
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-500/40">
                    Revoked
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Live Audit Feed, Agent Status & Guardrail Tester */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Banner with Kill Switch Action */}
          <div
            className={`p-5 rounded-2xl backdrop-blur-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl transition-all ${
              isAgentActive
                ? 'bg-white/[0.08] border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/40 border-red-500/50 text-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  isAgentActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-red-500/20 text-red-300 border-red-400/30'
                }`}
              >
                {isAgentActive ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white">
                  Agentic Status:{' '}
                  {isAgentActive ? 'Active & Monitored' : 'Revoked by Human (Kill Switch Engaged)'}
                </h3>
                <p className="text-xs text-white/80 mt-0.5">
                  {isAgentActive
                    ? 'Every payment needs the policy service co-signature, enforced by the ledger quorum.'
                    : 'The agent is no longer in the on-ledger signer list. Its signatures are rejected by the XRP Ledger.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs px-3 py-1.5 rounded-full bg-black/40 border border-white/20 font-mono text-white/90">
                Quorum: {quorum}
              </span>
              <button
                type="button"
                onClick={onToggleKillSwitch}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold tracking-wider uppercase text-xs transition shadow-lg cursor-pointer ${
                  isAgentActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse border border-rose-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40'
                }`}
              >
                <Power size={14} />
                {isAgentActive ? 'REVOKE AGENT' : 'RE-AUTHORIZE'}
              </button>
            </div>
          </div>

          {/* Guardrail Policy Simulator: Test the agent live */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold tracking-wide uppercase flex items-center gap-2 text-amber-300">
                  <Zap size={18} /> Test Agent Guardrails (live testnet)
                </h2>
                <p className="text-xs text-white/70">
                  Makes the agent attempt a real payment. Allowed ones settle on ledger; the rest
                  are refused.
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={attemptPending || !approvedRecipients[0]}
                  onClick={() =>
                    onSimulatePayment({
                      amount: '10',
                      recipient: approvedRecipients[0] || '',
                      reason: 'Emergency burial assistance payout'
                    })
                  }
                  className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 px-2.5 py-1 rounded-lg text-emerald-200 transition cursor-pointer disabled:opacity-50 font-medium"
                >
                  ✓ Pay Approved
                </button>
                <button
                  type="button"
                  disabled={attemptPending || !approvedRecipients[0]}
                  onClick={() =>
                    onSimulatePayment({
                      amount: String(Math.max(35, perPaymentCap + 15)),
                      recipient: approvedRecipients[0] || '',
                      reason: 'High value invoice'
                    })
                  }
                  className="text-[11px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 px-2.5 py-1 rounded-lg text-amber-200 transition cursor-pointer disabled:opacity-50 font-medium"
                >
                  ⚠ Over Cap
                </button>
                <button
                  type="button"
                  disabled={attemptPending || !strangerAddress}
                  onClick={() =>
                    onSimulatePayment({
                      amount: '5',
                      recipient: strangerAddress,
                      reason: 'Unverified invoice from unknown payee'
                    })
                  }
                  className="text-[11px] bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 px-2.5 py-1 rounded-lg text-rose-200 transition cursor-pointer disabled:opacity-50 font-medium"
                >
                  ✕ Unapproved
                </button>
                <button
                  type="button"
                  disabled={attemptPending || !approvedRecipients[0]}
                  onClick={() =>
                    onSimulatePayment({
                      amount: '5',
                      recipient: approvedRecipients[0] || '',
                      reason: 'Agent tries to skip the co-signer',
                      skipPolicy: true
                    })
                  }
                  className="text-[11px] bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 px-2.5 py-1 rounded-lg text-purple-200 transition cursor-pointer disabled:opacity-50 font-medium"
                >
                  ⛓ Bypass Policy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-white/80 mb-1">
                  Disbursement Amount (XRP)
                </label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl p-2.5 text-sm text-white font-mono focus:border-amber-400 focus:outline-none"
                  placeholder="e.g. 15"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-white/80 mb-1">
                  Target Recipient
                </label>
                <select
                  value={simRecipient}
                  onChange={(e) => setSimRecipient(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/20 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none truncate"
                >
                  {approvedRecipients.map((rec, i) => (
                    <option key={i} value={rec}>
                      {rec}
                    </option>
                  ))}
                  {strangerAddress && (
                    <option value={strangerAddress}>{strangerAddress} (Never approved: test)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-white/80 mb-1">
                  Payment Reason / Memo
                </label>
                <input
                  type="text"
                  value={simReason}
                  onChange={(e) => setSimReason(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  placeholder="e.g. Bereavement support"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipPolicy}
                  onChange={(e) => setSkipPolicy(e.target.checked)}
                  className="accent-amber-400"
                />
                Agent skips policy service (the ledger should reject it)
              </label>

              {/* Exact Dark Solid Button Style from Lock Screen */}
              <button
                type="button"
                disabled={attemptPending || !simRecipient}
                onClick={() =>
                  onSimulatePayment({
                    amount: simAmount,
                    recipient: simRecipient,
                    reason: simReason,
                    skipPolicy
                  })
                }
                className="bg-[#1e2532] hover:bg-[#151b26] active:bg-[#0f141d] disabled:opacity-60 disabled:cursor-wait text-white font-bold tracking-[0.2em] uppercase text-xs py-3 px-6 rounded-md shadow-2xl border border-white/20 hover:border-white/40 transition cursor-pointer flex items-center gap-2"
              >
                <Sparkles size={14} className="text-amber-400" />
                {attemptPending ? 'SUBMITTING TO TESTNET...' : 'AGENT ATTEMPTS PAYMENT'}
              </button>
            </div>

            {attemptPending && (
              <p className="mt-3 text-xs text-white/60 font-mono">
                Waiting for the policy service and for the XRP Ledger to validate...
              </p>
            )}

            {lastAttempt && !attemptPending && (
              <div
                className={`mt-3 p-3.5 rounded-xl border text-xs backdrop-blur-md ${
                  lastAttempt.status === 'PAID'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}
              >
                <p className="font-bold">
                  {lastAttempt.status === 'PAID' && 'Paid: tesSUCCESS'}
                  {lastAttempt.status === 'POLICY_BLOCKED' &&
                    `Blocked by policy service (${lastAttempt.code})`}
                  {lastAttempt.status === 'LEDGER_REJECTED' &&
                    `Rejected by the XRP Ledger (${lastAttempt.code})`}
                  {lastAttempt.status === 'ERROR' && `Error (${lastAttempt.code})`}
                  {lastAttempt.status === 'DECLINED' && 'Declined by the agent'}
                </p>
                <p className="opacity-90 mt-0.5">{lastAttempt.reason}</p>
                {lastAttempt.txHash && (
                  <a
                    href={DEMO_MODE ? undefined : `${explorerTx}${lastAttempt.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1 font-mono text-amber-300 hover:text-amber-200"
                  >
                    View on explorer {lastAttempt.txHash.slice(0, 8)}... <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-white/60">
                Agent brain:{' '}
                <span className="font-mono text-amber-200">
                  {agentMode === 'llm'
                    ? 'Claude tool-calling'
                    : 'Rule-based evaluation loop'}
                </span>
                {cycleSummary && <span className="block mt-1 text-white/80">{cycleSummary}</span>}
              </p>
              <button
                type="button"
                onClick={onRunAgentCycle}
                disabled={cycleRunning}
                className="text-xs bg-white/10 hover:bg-white/20 disabled:opacity-60 border border-white/20 px-3.5 py-1.5 rounded-xl text-white transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={cycleRunning ? 'animate-spin' : ''} />
                {cycleRunning ? 'Agent working...' : 'Run agent cycle now'}
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Live Audit Feed vs Member Claims Queue */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`text-sm font-bold tracking-wider uppercase flex items-center gap-2 transition pb-1.5 cursor-pointer border-b-2 ${
                    activeTab === 'audit'
                      ? 'text-white border-amber-400'
                      : 'text-white/50 border-transparent hover:text-white'
                  }`}
                >
                  <RefreshCw size={15} /> Live Audit &amp; Block Feed
                </button>
                <span className="text-white/20">|</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('claims')}
                  className={`text-sm font-bold tracking-wider uppercase flex items-center gap-2 transition pb-1.5 cursor-pointer border-b-2 ${
                    activeTab === 'claims'
                      ? 'text-white border-amber-400'
                      : 'text-white/50 border-transparent hover:text-white'
                  }`}
                >
                  <Inbox size={15} /> Member Claims Queue ({claims.length})
                </button>
              </div>

              {activeTab === 'audit' && (
                <div className="flex bg-black/30 border border-white/15 rounded-xl p-0.5 text-xs backdrop-blur-md">
                  {(['ALL', 'SUCCESS', 'BLOCKED', 'KILL_SWITCH'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilterType(tab)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                        filterType === tab
                          ? 'bg-white/20 text-white shadow-sm border border-white/20'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {tab === 'ALL' ? 'All Logs' : tab.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'audit' ? (
              <div className="overflow-x-auto rounded-xl border border-white/15 backdrop-blur-md">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/15 text-white/70 text-[11px] uppercase tracking-widest font-mono">
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Recipient</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Reason / Memo Hash</th>
                      <th className="py-3 px-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-black/20">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-white/50 text-xs">
                          No audit logs match current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="py-3 px-3 text-xs text-white/60 font-mono whitespace-nowrap">
                            {log.time}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono inline-flex items-center gap-1 border ${
                                log.type === 'SUCCESS'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                  : log.type === 'KILL_SWITCH'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                                  : log.type === 'SYSTEM'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                              }`}
                            >
                              {log.type === 'SUCCESS' && <CheckCircle2 size={11} />}
                              {log.type === 'BLOCKED' && <XCircle size={11} />}
                              {log.type === 'KILL_SWITCH' && <Power size={11} />}
                              {log.type}
                            </span>
                          </td>
                          <td
                            className="py-3 px-3 font-medium text-white text-xs max-w-[180px] truncate"
                            title={log.recipient}
                          >
                            {log.recipient}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-amber-300 font-semibold whitespace-nowrap">
                            {log.amount}
                          </td>
                          <td
                            className="py-3 px-3 text-xs text-white/80 max-w-xs truncate"
                            title={
                              log.reasoningHash
                                ? `${log.reason}\n\nMemo (SHA-256): ${log.reasoningHash}`
                                : log.reason
                            }
                          >
                            {log.code && log.type === 'BLOCKED' && (
                              <span className="font-mono text-[10px] text-rose-300 mr-1.5">
                                [{log.code}]
                              </span>
                            )}
                            {log.reason}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {log.hash &&
                            log.hash !== 'REVOKE...LEDGER' &&
                            log.hash !== 'ENABLE...LEDGER' ? (
                              <a
                                href={DEMO_MODE ? undefined : `${explorerTx}${log.hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 text-xs font-mono transition"
                                title={`Verify on XRPL Testnet: ${log.hash}`}
                              >
                                {log.hash.slice(0, 6)}...{log.hash.slice(-4)}{' '}
                                <ExternalLink size={12} />
                              </a>
                            ) : log.hash ? (
                              <span className="text-purple-300 font-mono text-[11px] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/30">
                                {log.hash}
                              </span>
                            ) : (
                              <span className="text-white/40 text-xs font-mono">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/15 backdrop-blur-md">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-black/40 border-b border-white/15 text-white/70 uppercase tracking-widest font-mono text-[11px]">
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Member</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Recipient</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Agent Verdict</th>
                      <th className="py-3 px-3 text-right">XRPL Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-black/20">
                    {claims.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-white/50">
                          No member claims submitted yet. Members can submit claims from their portal.
                        </td>
                      </tr>
                    ) : (
                      claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-white/5 transition">
                          <td className="py-3 px-3 text-white/60 font-mono whitespace-nowrap">
                            {claim.timestamp}
                          </td>
                          <td className="py-3 px-3 font-semibold text-white">
                            {claim.memberName}{' '}
                            <span className="text-[10px] text-white/50 font-mono">
                              ({claim.memberId})
                            </span>
                          </td>
                          <td className="py-3 px-3 text-white/80">{claim.category}</td>
                          <td
                            className="py-3 px-3 font-mono text-white/70 max-w-[140px] truncate"
                            title={claim.recipient}
                          >
                            {claim.recipient}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-amber-300">
                            {claim.amount} XRP
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono inline-flex items-center gap-1 border ${
                                claim.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                  : claim.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                              }`}
                            >
                              {claim.status === 'APPROVED' ? (
                                <CheckCircle2 size={11} />
                              ) : (
                                <XCircle size={11} />
                              )}
                              {claim.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {claim.txHash ? (
                              <a
                                href={DEMO_MODE ? undefined : `${explorerTx}${claim.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 font-mono transition"
                              >
                                {claim.txHash.slice(0, 6)}...{claim.txHash.slice(-4)}{' '}
                                <ExternalLink size={11} />
                              </a>
                            ) : (
                              <span
                                className="text-white/40 font-mono"
                                title={claim.blockReason}
                              >
                                {claim.status === 'PENDING' ? 'Queued' : 'None'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Feed Footer Info */}
            <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-white/60 mt-3 pt-3 border-t border-white/10 gap-2">
              <div className="flex items-center gap-1.5">
                <Info size={13} className="text-amber-300" />
                <span>
                  Logs are cryptographically linked to Stokvel multisig policy rules on XRPL.
                </span>
              </div>
              <div className="font-mono text-[11px] text-white/50">
                {activeTab === 'audit'
                  ? `Showing ${filteredLogs.length} of ${logs.length} entries`
                  : `Showing ${claims.length} claims`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
