import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Power,
  User,
  Users,
  LogOut,
  KeyRound,
  ChevronDown,
  Lock,
  Sliders,
  X,
  WifiOff,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { AuthProvider, useAuth, PRESET_USERS, STAFF_MEMBERS } from './context/AuthContext.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { StaffLoginView } from './components/StaffLoginView.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { TreasurerDashboard } from './components/TreasurerDashboard.tsx';
import { MemberPortal } from './components/MemberPortal.tsx';
import {
  AttemptResult,
  AuditLog,
  MemberClaim,
  ServerClaim,
  ServerState,
  UserRole
} from './types.ts';
import { api, ApiError, DEMO_MODE, getToken, setToken } from './api.ts';

interface SecurityViolationInfo {
  action: string;
  message: string;
}

const POLL_MS = 3000;
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString();
};

const toClaim = (c: ServerClaim): MemberClaim => ({
  ...c,
  blockReason: c.blockReason ?? undefined,
  txHash: c.txHash ?? undefined,
  timestamp: fmtTime(c.timestamp)
});

/** The UI shows recipients as "rAddress (Label)"; the backend stores them separately. */
const recipientLabel = (r: { address: string; label: string }) => `${r.address} (${r.label})`;
const addressOf = (text: string) => text.trim().split(/\s+/)[0] ?? '';

function StokvelApp() {
  const { currentUser, logout, directLoginUser, loading } = useAuth();

  // Navigation & Route State
  const [activeRoute, setActiveRoute] = useState<'treasurer' | 'member'>(() => {
    return currentUser?.role === 'treasurer' ? 'treasurer' : 'member';
  });

  // Toggle to view the mountain login screen with staff directory
  const [showFullLoginScreen, setShowFullLoginScreen] = useState(false);

  // Modal & Security state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalDefaultTab, setLoginModalDefaultTab] = useState<UserRole>('treasurer');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [securityViolation, setSecurityViolation] = useState<SecurityViolationInfo | null>(null);

  // Sync active route when user changes role
  useEffect(() => {
    if (currentUser?.role === 'treasurer') {
      setActiveRoute('treasurer');
    } else if (currentUser?.role === 'user') {
      setActiveRoute('member');
    }
  }, [currentUser?.role]);

  // ----------------------------------------------------
  // BACKEND / IN-MEMORY STATE
  // ----------------------------------------------------
  const [server, setServer] = useState<ServerState | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [claims, setClaims] = useState<MemberClaim[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [killBusy, setKillBusy] = useState(false);
  const [attemptPending, setAttemptPending] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<AttemptResult | null>(null);
  const [cycleSummary, setCycleSummary] = useState<string | null>(null);
  const [cycleRunning, setCycleRunning] = useState(false);

  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return; // never stack polls on a slow backend
    refreshing.current = true;
    try {
      try {
        setServer(await api.getState());
        setBackendError(null);
      } catch (e) {
        setBackendError(e instanceof Error ? e.message : 'Backend unreachable');
        return;
      }
      try {
        const isTreasurer = currentUser?.role === 'treasurer' && !!getToken();
        const memberId = currentUser?.memberId;
        const list = isTreasurer ? await api.getClaims() : memberId ? await api.getClaims(memberId) : [];
        setClaims(list.map(toClaim));
      } catch (e) {
        // An expired treasurer session: drop the token so the next action asks for the PIN again.
        if (e instanceof ApiError && e.status === 401 && getToken()) setToken(null);
      }
    } finally {
      refreshing.current = false;
    }
  }, [currentUser?.memberId, currentUser?.role]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Derived view of the server state
  // Zeros until the first response arrives: never show invented numbers.
  const perPaymentCap = server?.mandate.perPaymentCap ?? 0;
  const monthlyCap = server?.mandate.monthlyCap ?? 0;
  const monthlySpent = server?.mandate.monthlySpent ?? 0;
  const treasuryBalance = server?.treasuryBalance ?? 0;
  const isAgentActive = server?.agentActive ?? true;
  const approvedRecipients = (server?.mandate.approvedRecipients ?? []).map(recipientLabel);
  const logs: AuditLog[] = (server?.logs ?? []).map((e) => ({ ...e, time: fmtTime(e.time) }));

  const triggerSecurityViolation = (action: string, message: string) => {
    setSecurityViolation({ action, message });
  };

  const promptTreasurerAuth = () => {
    setLoginModalDefaultTab('treasurer');
    setIsLoginModalOpen(true);
  };

  const adminCall = async <T,>(action: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (!currentUser || currentUser.role !== 'treasurer') {
      triggerSecurityViolation(
        action,
        'Permission Denied: only the signed-in Chief Treasurer can do this. The backend enforces it too.'
      );
      return undefined;
    }
    setActionError(null);
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        triggerSecurityViolation(
          action,
          'Your treasurer session is missing or expired. Sign in again with the treasurer PIN.'
        );
        promptTreasurerAuth();
      } else {
        setActionError(`${action}: ${e instanceof Error ? e.message : 'failed'}`);
      }
      return undefined;
    }
  };

  const handleAddRecipient = (newRec: string) => {
    const address = addressOf(newRec);
    const label = newRec.trim().slice(address.length).replace(/^[\s(]+|[\s)]+$/g, '') || 'Approved vendor';
    void adminCall('Add approved recipient', () => api.addRecipient(address, label));
  };

  const handleRemoveRecipient = (recToRemove: string) => {
    void adminCall('Remove approved recipient', () => api.removeRecipient(addressOf(recToRemove)));
  };

  const handleSetPerPaymentCap = (val: number) => {
    void adminCall('Set per-payment cap', () => api.setCaps({ perPaymentCap: val }));
  };

  const handleSetMonthlyCap = (val: number) => {
    void adminCall('Set monthly cap', () => api.setCaps({ monthlyCap: val }));
  };

  const toggleKillSwitch = async () => {
    if (!currentUser || currentUser.role !== 'treasurer') {
      triggerSecurityViolation(
        'Emergency Kill Switch Revocation',
        'Permission Denied: only the Chief Treasurer, who holds the human signing key, can change the agent signer list.'
      );
      return;
    }
    const revoking = isAgentActive;
    const ok = window.confirm(
      revoking
        ? 'Remove the agent from the treasury signer list on the XRP Ledger? Its signatures will be rejected immediately.'
        : 'Add the agent back into the treasury signer list on the XRP Ledger?'
    );
    if (!ok) return;
    setKillBusy(true);
    await adminCall(revoking ? 'Kill switch (revoke agent)' : 'Re-authorise agent', () =>
      revoking ? api.revokeAgent() : api.reauthorizeAgent()
    );
    setKillBusy(false);
  };

  const handleSimulatePayment = async (data: {
    amount: string;
    recipient: string;
    reason: string;
    skipPolicy?: boolean;
  }) => {
    const parsed = parseFloat(data.amount);
    if (isNaN(parsed) || parsed <= 0) {
      setActionError('Enter an amount greater than zero.');
      return;
    }
    setAttemptPending(true);
    setLastAttempt(null);
    const result = await adminCall('Agent payment attempt', () =>
      api.attempt({
        destination: addressOf(data.recipient),
        amount: parsed,
        reason: data.reason,
        skipPolicy: data.skipPolicy
      })
    );
    if (result) setLastAttempt(result);
    setAttemptPending(false);
  };

  const handleRunAgentCycle = async () => {
    setCycleRunning(true);
    setCycleSummary(null);
    const res = await adminCall('Run agent cycle', () => api.runAgentCycle());
    if (res) {
      const parts: string[] = [];
      if (res.skipped) parts.push(res.skipped);
      parts.push(`${res.claims?.length ?? 0} pending claim(s) processed`);
      for (const ob of res.obligations ?? []) parts.push(`${ob.id}: ${ob.status}`);
      setCycleSummary(parts.join(' • '));
    }
    setCycleRunning(false);
  };

  const handleSubmitMemberClaim = async (
    claimData: Omit<MemberClaim, 'id' | 'timestamp' | 'status'>
  ): Promise<MemberClaim> => {
    const saved = await api.submitClaim({
      memberId: claimData.memberId,
      memberName: claimData.memberName,
      amount: claimData.amount,
      recipient: claimData.recipient,
      category: claimData.category,
      reason: claimData.reason
    });
    await refresh();
    return toClaim(saved);
  };

  if (loading) return <div className="min-h-screen bg-slate-950" />; // restoring a saved session

  // IF USER IS NOT LOGGED IN OR EXPLICITLY VIEWING THE FULL LOGIN SCREEN:
  if (!currentUser || showFullLoginScreen) {
    return (
      <StaffLoginView
        onSuccess={() => setShowFullLoginScreen(false)}
        isOpenModal={false}
      />
    );
  }

  // IF USER IS LOGGED IN: SHOW DASHBOARD WITH DIRECT ACCESS TO STAFF DIRECTORY & LOGIN
  return (
    <div
      className="min-h-screen text-slate-100 p-4 sm:p-6 font-sans relative select-none bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: `url('/mountain_sunset_bg.jpg')`,
        backgroundColor: '#0f172a'
      }}
    >
      {/* Twilight atmospheric gradient overlay matching lock screen */}
      <div className="fixed inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/75 to-slate-950/90 pointer-events-none backdrop-blur-[1px]" />

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Top App Header with Frosted Glassmorphism */}
        <header className="p-4 sm:p-5 rounded-2xl backdrop-blur-xl bg-white/[0.08] border border-white/20 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-amber-300 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow">
                  Stokvel Treasurer Agent Control Panel
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  XRPL Multi-Sig
                </span>
              </div>
              <p className="text-white/70 text-xs sm:text-sm">
                Policy Guardrails, Signer Quorum &amp; Autonomous Agent Governance
              </p>
            </div>
          </div>

          {/* Authentication & Profile Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Staff Members & Login Screen Switcher */}
            <button
              onClick={() => setShowFullLoginScreen(true)}
              className="bg-white/10 hover:bg-white/20 border border-white/25 text-amber-200 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md transition"
              title="Open the Mountain Sunset Staff Login Portal"
            >
              <Users size={15} className="text-amber-400" />
              <span>Staff Login &amp; Directory</span>
            </button>

            {/* Network pill */}
            <div className="hidden sm:flex items-center gap-2 bg-black/30 border border-white/15 px-3 py-1.5 rounded-xl text-xs backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-white/90 font-mono">
                XRPL {server?.network === 'testnet' || !server ? 'Testnet' : server.network}
              </span>
            </div>

            {/* Active User profile badge */}
            <div className="flex items-center gap-2 relative">
              <div className="bg-black/30 border border-white/20 rounded-xl p-1.5 flex items-center gap-2 shadow-sm backdrop-blur-md">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    currentUser.role === 'treasurer'
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                      : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                  }`}
                >
                  {currentUser.role === 'treasurer' ? <KeyRound size={14} /> : <User size={14} />}
                </div>

                <div className="text-left pr-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-white leading-tight">
                      {currentUser.name}
                    </p>
                    <span
                      className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded ${
                        currentUser.role === 'treasurer'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {currentUser.role === 'treasurer' ? 'Staff Officer' : 'Member'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 font-mono">
                    {currentUser.staffId || currentUser.memberId || currentUser.email}
                  </p>
                </div>

                {/* Switch Role Quick Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                    title="Switch User or Staff Member"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {isRoleDropdownOpen && (
                    <div className="absolute right-0 top-9 w-64 bg-slate-900/95 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-white/50 px-2 py-1 font-semibold flex items-center justify-between">
                        <span>Authorized Staff Officers</span>
                        <span className="text-amber-400 font-bold">{STAFF_MEMBERS.length}</span>
                      </p>

                      {STAFF_MEMBERS.map((staff) => (
                        <button
                          key={staff.id}
                          onClick={() => {
                            setIsRoleDropdownOpen(false);
                            // Officers need the PIN outside demo mode, so open the sign-in screen instead.
                            if (!directLoginUser(staff)) setShowFullLoginScreen(true);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition cursor-pointer ${
                            currentUser.id === staff.id
                              ? 'bg-white/20 text-amber-200 border border-white/30'
                              : 'hover:bg-white/10 text-white/80'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-white">{staff.name}</p>
                            <p className="text-[10px] text-white/60">
                              {staff.title.split('&')[0]} • {staff.staffId}
                            </p>
                          </div>
                          {currentUser.id === staff.id && (
                            <span className="text-[10px] text-amber-400 font-bold">✓ Active</span>
                          )}
                        </button>
                      ))}

                      <hr className="border-white/10 my-1" />

                      <button
                        onClick={() => {
                          setIsRoleDropdownOpen(false);
                          setShowFullLoginScreen(true);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 text-amber-300 transition cursor-pointer text-left font-medium"
                      >
                        <Users size={13} />
                        <span>Open Mountain Login Portal</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsRoleDropdownOpen(false);
                          logout();
                          setShowFullLoginScreen(true);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-red-950/60 text-red-300 transition cursor-pointer text-left"
                      >
                        <LogOut size={13} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Kill Switch Button */}
            {currentUser?.role === 'treasurer' ? (
              <button
                onClick={toggleKillSwitch}
                disabled={killBusy || !server}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold tracking-wider uppercase text-xs transition shadow-xl cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
                  isAgentActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse border border-rose-400/40 shadow-rose-950/60'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 shadow-emerald-950/60'
                }`}
                title="Immediate cryptographic revocation of autonomous agent signing rights on XRPL ledger"
              >
                <Power size={15} />
                <span>
                  {killBusy
                    ? 'Submitting to ledger...'
                    : isAgentActive
                    ? 'KILL SWITCH (Revoke Agent)'
                    : 'Re-Enable Agent'}
                </span>
              </button>
            ) : (
              <div
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
                  isAgentActive
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/50 border-red-500/50 text-red-300'
                }`}
              >
                <Lock size={12} />
                <span>Agent: {isAgentActive ? 'Active' : 'Revoked'}</span>
              </div>
            )}
          </div>
        </header>

        {/* Security Violation Alert Toast / Banner */}
        {securityViolation && (
          <div className="bg-red-950/90 backdrop-blur-xl border border-red-500/60 text-red-100 rounded-2xl p-4 shadow-2xl flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-600/30 text-red-300 rounded-xl shrink-0 mt-0.5 border border-red-500/40">
                <ShieldAlert size={20} />
              </div>
              <div>
                <p className="font-bold text-sm tracking-wide text-white">
                  Security Guardrail Triggered: {securityViolation.action}
                </p>
                <p className="text-xs text-red-200/90 mt-0.5">{securityViolation.message}</p>
              </div>
            </div>
            <button
              onClick={() => setSecurityViolation(null)}
              className="text-red-300 hover:text-white p-1 rounded-lg hover:bg-red-900/50 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Environment + connectivity banners */}
        {DEMO_MODE && (
          <div className="bg-amber-500/15 border border-amber-400/50 text-amber-100 rounded-2xl p-3 text-xs backdrop-blur-xl">
            <span className="font-bold">DEMO MODE:</span> this deployment is not connected to a backend. Everything on
            screen is a simulation, no XRPL transactions are made, and transaction hashes are placeholders. Set
            VITE_API_BASE to connect the real system.
          </div>
        )}
        {backendError && (
          <div className="bg-amber-950/70 border border-amber-500/60 text-amber-100 rounded-2xl p-3 text-xs flex items-start gap-3 backdrop-blur-xl">
            <WifiOff size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Backend not reachable</p>
              <p className="opacity-90 mt-0.5">{backendError}</p>
            </div>
          </div>
        )}
        {server?.ledgerError && (
          <div className="bg-amber-950/50 border border-amber-600/50 text-amber-100 rounded-2xl p-3 text-xs">
            {server.ledgerError}. Showing the last known ledger data.
          </div>
        )}
        {actionError && (
          <div className="bg-red-950/80 border border-red-500/60 text-red-100 rounded-2xl p-3 text-xs flex items-start justify-between gap-3">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-300 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Navigation Tabs (Treasurer Dashboard vs Member Portal) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/[0.08] p-1.5 rounded-2xl border border-white/20 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveRoute('treasurer')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeRoute === 'treasurer'
                  ? 'bg-white/20 text-white shadow-lg border border-white/30 text-amber-200'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sliders size={14} className="text-amber-400" />
              <span>Treasurer Dashboard</span>
            </button>

            <button
              onClick={() => setActiveRoute('member')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeRoute === 'member'
                  ? 'bg-white/20 text-white shadow-lg border border-white/30 text-emerald-200'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <User size={14} className="text-emerald-400" />
              <span>Member Portal</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/70 px-3 py-1">
            <span className="font-mono text-white/50">Active View:</span>
            <span className="font-semibold text-white">
              {activeRoute === 'treasurer' ? 'Chief Governance Panel' : 'Member Self-Service Portal'}
            </span>
          </div>
        </div>

        {/* ROUTE GUARDING & COMPONENT EXECUTION */}
        {activeRoute === 'treasurer' ? (
          <ProtectedRoute
            allowedRoles={['treasurer']}
            currentUser={currentUser}
            onRequestTreasurerAuth={promptTreasurerAuth}
            onRedirectToMemberPortal={() => setActiveRoute('member')}
          >
            <TreasurerDashboard
              isAgentActive={isAgentActive}
              onToggleKillSwitch={toggleKillSwitch}
              perPaymentCap={perPaymentCap}
              setPerPaymentCap={handleSetPerPaymentCap}
              monthlyCap={monthlyCap}
              setMonthlyCap={handleSetMonthlyCap}
              approvedRecipients={approvedRecipients}
              onAddRecipient={handleAddRecipient}
              onRemoveRecipient={handleRemoveRecipient}
              treasuryBalance={treasuryBalance}
              monthlySpent={monthlySpent}
              logs={logs}
              onSimulatePayment={handleSimulatePayment}
              claims={claims}
              signers={server?.signers ?? []}
              quorum={server?.quorum ?? 2}
              treasuryAddress={server?.treasuryAddress ?? ''}
              strangerAddress={server?.demo.strangerAddress ?? ''}
              agentMode={server?.agentMode ?? 'rules'}
              attemptPending={attemptPending}
              lastAttempt={lastAttempt}
              onRunAgentCycle={handleRunAgentCycle}
              cycleRunning={cycleRunning}
              cycleSummary={cycleSummary}
              explorerTx={server?.explorerTx ?? 'https://testnet.xrpl.org/transactions/'}
            />
          </ProtectedRoute>
        ) : (
          <MemberPortal
            isAgentActive={isAgentActive}
            perPaymentCap={perPaymentCap}
            monthlyCap={monthlyCap}
            monthlySpent={monthlySpent}
            treasuryBalance={treasuryBalance}
            approvedRecipients={approvedRecipients}
            claims={claims}
            onSubmitClaim={handleSubmitMemberClaim}
            logs={logs}
          />
        )}

        {/* Footer */}
        <footer className="pt-6 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center text-xs text-white/60 gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>
              Stokvel Treasury Management • Multi-Signature XRPL Ledger &amp; Staff Directory
            </span>
          </div>
          <div className="font-mono text-[11px] text-white/50">
            Quorum {server?.quorum ?? 2} • Signers: {STAFF_MEMBERS.length} Officers Registered
          </div>
        </footer>
      </div>

      {/* Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        defaultTab={loginModalDefaultTab}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StokvelApp />
    </AuthProvider>
  );
}
