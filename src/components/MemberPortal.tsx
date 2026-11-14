import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Wallet,
  AlertTriangle,
  FileText,
  Building,
  HeartHandshake,
  ShoppingBag,
  Info,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DEMO_MODE } from '../api.ts';
import { MemberClaim, AuditLog } from '../types.ts';

interface MemberPortalProps {
  isAgentActive: boolean;
  perPaymentCap: number;
  monthlyCap: number;
  monthlySpent: number;
  treasuryBalance: number;
  approvedRecipients: string[];
  claims: MemberClaim[];
  onSubmitClaim: (claim: Omit<MemberClaim, 'id' | 'timestamp' | 'status'>) => Promise<MemberClaim>;
  logs: AuditLog[];
}

export const MemberPortal: React.FC<MemberPortalProps> = ({
  isAgentActive,
  perPaymentCap,
  monthlyCap,
  monthlySpent,
  treasuryBalance,
  approvedRecipients,
  claims,
  onSubmitClaim
}) => {
  const { currentUser } = useAuth();

  const [category, setCategory] = useState('Funeral / Bereavement Cover');
  const [recipient, setRecipient] = useState(approvedRecipients[0] || '');
  const [customRecipient, setCustomRecipient] = useState('');
  const [isCustomRecipient, setIsCustomRecipient] = useState(false);
  const [amount, setAmount] = useState('10');
  const [reason, setReason] = useState('Family bereavement support claim');
  const [submitting, setSubmitting] = useState(false);
  const [recentEvaluation, setRecentEvaluation] = useState<MemberClaim | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The approved list arrives from the backend after first render
  useEffect(() => {
    if (!recipient && approvedRecipients[0]) setRecipient(approvedRecipients[0]);
  }, [approvedRecipients, recipient]);

  const targetRecipient = isCustomRecipient ? customRecipient : recipient;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setSubmitError('Please enter a valid amount.');
      return;
    }
    if (!targetRecipient) {
      setSubmitError('Please select or specify a recipient.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setRecentEvaluation(null);
    try {
      const result = await onSubmitClaim({
        memberId: currentUser?.memberId || 'STK-001',
        memberName: currentUser?.name || 'Stokvel Member',
        amount: parsedAmount,
        recipient: targetRecipient,
        category,
        reason
      });
      setRecentEvaluation(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const memberClaims = claims.filter(
    (c) => c.memberId === currentUser?.memberId || c.memberName === currentUser?.name
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Frosted Glass with Twilight Sunset Accents */}
      <div className="rounded-2xl p-6 sm:p-7 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
              Stokvel Member Portal
            </span>
            <span className="text-xs text-white/60 font-mono">
              ID: {currentUser?.memberId || 'STK-042'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow">
            Sawubona, {currentUser?.name || 'Member'}!
          </h2>
          <p className="text-xs sm:text-sm text-white/70 mt-1 max-w-xl">
            Submit claims directly to the autonomous AI Treasurer Agent. Approved disbursements are signed on XRPL testnet ledger.
          </p>
        </div>

        {/* Agentic Health Badge */}
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 shrink-0 backdrop-blur-md ${
            isAgentActive
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 shadow-lg shadow-emerald-950/30'
              : 'bg-rose-500/15 border-rose-400/40 text-rose-200 shadow-lg shadow-rose-950/30'
          }`}
        >
          {isAgentActive ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">
              {isAgentActive ? 'AI Agent Online' : 'AI Agent Revoked'}
            </p>
            <p className="text-[11px] opacity-80">
              {isAgentActive
                ? 'Autonomous co-signing active'
                : 'Kill switch engaged by Treasurer'}
            </p>
          </div>
        </div>
      </div>

      {/* Transparency Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] text-white">
          <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
            Total Stokvel Reserve
          </p>
          <p className="text-2xl font-bold text-white mt-1 font-mono drop-shadow">
            {treasuryBalance.toLocaleString()}{' '}
            <span className="text-sm text-amber-300 font-normal">XRP</span>
          </p>
          <p className="text-[11px] text-emerald-300 mt-1 font-mono">
            ≈ R{(treasuryBalance * 22.4).toLocaleString()} ZAR
          </p>
        </div>

        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] text-white">
          <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
            Per-Claim Limit (Cap)
          </p>
          <p className="text-2xl font-bold text-amber-300 mt-1 font-mono drop-shadow">
            {perPaymentCap} <span className="text-sm text-white/70 font-normal">XRP</span>
          </p>
          <p className="text-[11px] text-white/60 mt-1">
            Maximum single payout allowed by mandate
          </p>
        </div>

        <div className="rounded-2xl p-5 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.15)] text-white">
          <p className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
            Monthly Budget Remaining
          </p>
          <p className="text-2xl font-bold text-emerald-300 mt-1 font-mono drop-shadow">
            {Math.max(0, monthlyCap - monthlySpent)}{' '}
            <span className="text-sm text-white/70 font-normal">/ {monthlyCap} XRP</span>
          </p>
          <p className="text-[11px] text-white/60 mt-1 font-mono">
            {monthlySpent} XRP disbursed this cycle
          </p>
        </div>
      </div>

      {/* Main Member Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Claim Submission Form (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl p-6 sm:p-7 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
          <div className="flex items-center gap-3 mb-5">
            <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <Send size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold tracking-wide uppercase text-white">
                Submit Disbursement / Benefit Claim
              </h3>
              <p className="text-xs text-white/70">
                The AI Treasurer Agent will instantly evaluate your claim against Stokvel policy.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-xs font-semibold tracking-wider uppercase text-white/80 mb-2">
                Claim Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Bereavement / Funeral', icon: HeartHandshake },
                  { label: 'Hall & Venue Rental', icon: Building },
                  { label: 'Bulk Groceries', icon: ShoppingBag },
                  { label: 'Emergency Medical', icon: ShieldCheck },
                  { label: 'General Reimbursement', icon: FileText }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setCategory(item.label)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition cursor-pointer backdrop-blur-sm ${
                      category === item.label
                        ? 'bg-white/20 border-white/40 text-white font-semibold shadow-md ring-1 ring-amber-400/40 text-amber-200'
                        : 'bg-black/25 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon size={14} className="shrink-0 text-amber-300" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Selection */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold tracking-wider uppercase text-white/80">
                  Beneficiary / Vendor Recipient
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomRecipient(!isCustomRecipient)}
                  className="text-[11px] text-amber-300 hover:text-white underline cursor-pointer"
                >
                  {isCustomRecipient ? 'Pick from Approved Whitelist' : 'Enter Custom Address'}
                </button>
              </div>

              {!isCustomRecipient ? (
                <div className="space-y-1.5">
                  <select
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full bg-slate-900/90 border border-white/20 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {approvedRecipients.map((rec, i) => (
                      <option key={i} value={rec}>
                        ✓ {rec}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-300 font-mono">
                    ✓ Pre-approved recipient: Fast-tracked by AI Agent &amp; Policy Service
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={customRecipient}
                    onChange={(e) => setCustomRecipient(e.target.value)}
                    placeholder="Enter XRPL Address (e.g. rDestination...)"
                    className="w-full bg-black/30 border border-white/20 rounded-xl p-2.5 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-amber-300">
                    ⚠ Warning: Unapproved recipients will be blocked by policy rules unless whitelisted by Treasurer.
                  </p>
                </div>
              )}
            </div>

            {/* Amount & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-white/80 mb-1">
                  Amount (XRP)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl p-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                  placeholder="e.g. 10"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold tracking-wider uppercase text-white/80 mb-1">
                  Claim Reason &amp; Supporting Note
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-xl p-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
                  placeholder="e.g. Funeral assistance, groceries invoice #442..."
                />
              </div>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs">
                {submitError}
              </div>
            )}

            {/* Submit Action: Exact Lock Screen Dark Button Style */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1e2532] hover:bg-[#151b26] active:bg-[#0f141d] disabled:opacity-60 text-white font-bold tracking-[0.2em] uppercase text-xs py-3.5 px-6 rounded-md shadow-2xl border border-white/20 hover:border-white/40 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles size={14} className="text-amber-400" />
                <span>
                  {submitting ? 'AGENT EVALUATING CLAIM...' : 'SUBMIT CLAIM TO AGENT'}
                </span>
              </button>
            </div>
          </form>

          {/* Recent Evaluation Result Box */}
          {recentEvaluation && (
            <div
              className={`mt-4 p-4 rounded-xl border text-xs backdrop-blur-md animate-fadeIn ${
                recentEvaluation.status === 'APPROVED'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                {recentEvaluation.status === 'APPROVED' ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-rose-400" />
                )}
                <span>
                  Verdict:{' '}
                  {recentEvaluation.status === 'APPROVED'
                    ? 'Claim Approved & Disbursed'
                    : recentEvaluation.status === 'PENDING'
                    ? 'Claim Queued: the agent will retry'
                    : 'Claim Blocked'}
                </span>
              </div>
              <p className="opacity-90">
                {recentEvaluation.blockReason ||
                  `Payment of ${recentEvaluation.amount} XRP authorized to ${recentEvaluation.recipient}.`}
              </p>
              {recentEvaluation.txHash && (
                <div className="mt-2 pt-2 border-t border-emerald-500/30 flex items-center justify-between">
                  <span className="font-mono text-[10px]">
                    TX: {recentEvaluation.txHash.slice(0, 12)}...
                  </span>
                  <span className="text-[10px] text-emerald-300 font-semibold">
                    {DEMO_MODE ? 'Simulated (demo mode)' : '✓ Confirmed on XRPL'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Member History & Guidelines (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Member Claims History Card */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
            <h3 className="text-sm font-bold tracking-wide uppercase text-amber-300 flex items-center gap-2 mb-3">
              <Clock size={16} /> My Submitted Claims ({memberClaims.length})
            </h3>

            {memberClaims.length === 0 ? (
              <div className="text-center py-8 text-white/50 text-xs">
                No past claims found for your account. Submit a claim on the left to test the autonomous agent.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {memberClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-3 rounded-xl bg-black/30 border border-white/10 text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white">{claim.category}</span>
                        <p className="text-[10px] text-white/50 font-mono">{claim.timestamp}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          claim.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                            : claim.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/10">
                      <span className="font-mono text-amber-300 font-bold">{claim.amount} XRP</span>
                      <span className="text-white/60 truncate max-w-[150px] font-mono">
                        {claim.recipient}
                      </span>
                    </div>

                    {claim.blockReason && (
                      <p className="text-[10px] text-rose-300 bg-rose-950/40 p-1.5 rounded-lg border border-rose-500/30">
                        {claim.blockReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Policy Guidelines Box */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl text-white">
            <h4 className="text-xs font-bold tracking-wider uppercase text-amber-300 flex items-center gap-1.5 mb-2">
              <Info size={14} /> Stokvel Disbursement Guidelines
            </h4>
            <ul className="space-y-2 text-xs text-white/80">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Per-payment limit:</strong> {perPaymentCap} XRP maximum per claim. Higher amounts trigger a policy block.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Approved Whitelist:</strong> Only verified funeral homes, grocery wholesalers, and community halls are paid automatically.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>
                  <strong>Proof of Payment:</strong> All disbursements generate immutable transaction hashes on the XRPL testnet ledger.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
