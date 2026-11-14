import React from 'react';
import { ShieldAlert, Lock, ArrowRight, ArrowLeft, KeyRound, UserX, AlertOctagon } from 'lucide-react';
import { UserProfile, UserRole } from '../types.ts';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  currentUser: UserProfile | null;
  children: React.ReactNode;
  onRequestTreasurerAuth: () => void;
  onRedirectToMemberPortal: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  currentUser,
  children,
  onRequestTreasurerAuth,
  onRedirectToMemberPortal
}) => {
  const isAuthorized = currentUser && allowedRoles.includes(currentUser.role);

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-2xl p-6 sm:p-10 backdrop-blur-2xl bg-white/[0.08] border border-white/20 shadow-2xl relative overflow-hidden my-4 text-white">
      {/* Background glowing indicator */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl mx-auto text-center space-y-6">
        <div className="inline-flex p-4 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300 shadow-xl shadow-rose-950/40">
          <ShieldAlert size={48} className="animate-pulse" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-rose-950/80 border border-rose-500/50 text-rose-200 mb-3">
            <Lock size={12} />
            <span>403 FORBIDDEN • MULTI-SIG ROUTE GUARD</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow">
            Treasurer Clearance Required
          </h2>
          <p className="text-sm text-white/70 mt-2">
            The <strong>Treasurer Dashboard</strong>, mandate configuration, approved vendor whitelist modification, and autonomous agent supervision are restricted to authenticated Stokvel Treasurers.
          </p>
        </div>

        {/* Current User Identity Breakdown */}
        <div className="bg-black/35 border border-white/15 rounded-2xl p-5 text-left space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="text-white/50 uppercase tracking-widest font-semibold text-[10px]">Active Session</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-semibold">
              Restricted Role
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white">
              {currentUser?.name ? currentUser.name[0] : <UserX size={18} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {currentUser?.name || 'Unauthenticated User'}
              </p>
              <p className="text-xs text-white/60 font-mono">
                {currentUser?.email || 'No active session'} • Role:{' '}
                <span className="text-rose-300 font-bold uppercase">{currentUser?.role || 'Guest'}</span>
              </p>
            </div>
          </div>

          <div className="text-[11px] text-white/70 bg-black/30 p-3 rounded-xl border border-white/10 mt-2 flex items-start gap-2">
            <AlertOctagon size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              Your current account does not hold the Multi-Sig signing weights (<code className="text-amber-300 font-mono">rChair...9921</code>) required to inspect or modify treasury guardrails.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {/* Exact Dark Button Style from Lock Screen */}
          <button
            type="button"
            onClick={onRequestTreasurerAuth}
            className="w-full sm:w-auto bg-[#1e2532] hover:bg-[#151b26] active:bg-[#0f141d] text-white font-bold tracking-[0.2em] uppercase text-xs px-6 py-3.5 rounded-md shadow-2xl border border-white/20 hover:border-white/40 flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <KeyRound size={15} className="text-amber-300" />
            <span>AUTHENTICATE AS CHIEF TREASURER</span>
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            onClick={onRedirectToMemberPortal}
            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-5 py-3.5 rounded-md flex items-center justify-center gap-2 cursor-pointer transition border border-white/20"
          >
            <ArrowLeft size={15} />
            <span>RETURN TO MEMBER PORTAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
