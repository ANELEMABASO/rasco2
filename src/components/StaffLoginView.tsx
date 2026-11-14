import React, { useState } from 'react';
import { DEMO_MODE } from '../api.ts';
import { SUPABASE_ENABLED } from '../supabase.ts';
import {
  ShieldCheck,
  ShieldAlert,
  User,
  Users,
  KeyRound,
  CheckCircle2,
  Lock,
  Mail,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Info,
  X,
  Phone,
  Wallet,
  Building,
  BadgeCheck,
  Eye,
  EyeOff,
  LayoutGrid,
  Maximize2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { STAFF_MEMBERS } from '../data/staffMembers.ts';
import { StaffMember, UserRole } from '../types.ts';

interface StaffLoginViewProps {
  onSuccess?: () => void;
  isOpenModal?: boolean;
  onClose?: () => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({
  onSuccess,
  isOpenModal = false,
  onClose
}) => {
  const { login, register, directLoginUser } = useAuth();

  // Active form state
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'STAFF'>('LOGIN');
  const [username, setUsername] = useState('admin1234');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('user');
  const [regDepartment, setRegDepartment] = useState('Executive Treasury');

  // Selected staff member (default: Ancle Mabaso / admin1234)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(STAFF_MEMBERS[0]);
  const [inspectingStaff, setInspectingStaff] = useState<StaffMember | null>(null);

  // UI view options: 'split' (side by side with staff), 'focus' (exact replica like mockup)
  const [viewMode, setViewMode] = useState<'split' | 'focus'>('split');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginSuccessToast, setLoginSuccessToast] = useState<string | null>(null);

  // Handle staff selection
  const handleSelectStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setUsername(staff.username);
    setPassword('');
    setErrorMessage('');
    setActiveTab('LOGIN');
  };

  // Handle direct 1-click staff authentication
  const handleInstantStaffAuth = (staff: StaffMember) => {
    // Treasurer access is verified by the backend, so there is no one-click shortcut outside demo mode.
    if ((staff.role === 'treasurer' || SUPABASE_ENABLED) && !DEMO_MODE) {
      handleSelectStaff(staff);
      setErrorMessage(SUPABASE_ENABLED ? 'Enter your email and password to sign in.' : 'Treasurer access is verified by the backend. Enter the treasurer PIN as the password.');
      return;
    }
    setIsSubmitting(true);
    setLoginSuccessToast(`Authenticating ${staff.name} (${staff.title})...`);
    setTimeout(() => {
      directLoginUser(staff);
      setIsSubmitting(false);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    }, 450);
  };

  // Handle form submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Please enter your staff username or email');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // Find matching staff member or user
      const matched = STAFF_MEMBERS.find(
        (s) =>
          s.username.toLowerCase() === username.trim().toLowerCase() ||
          s.email.toLowerCase() === username.trim().toLowerCase()
      );

      if (matched) {
        await login(username, matched.role, matched.name, password);
        setLoginSuccessToast(`Access Granted: Welcome, ${matched.name}`);
      } else {
        // Unknown usernames can only ever be ordinary members, never officers.
        await login(username, 'user', username, password);
        setLoginSuccessToast(`Welcome, ${username}`);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 400);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed. Please verify credentials.');
    }
  };

  // Handle registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (SUPABASE_ENABLED && regPassword.length < 8) {
      setErrorMessage('Choose a password of at least 8 characters.');
      return;
    }
    if (!regName.trim() || !regEmail.trim()) {
      setErrorMessage('Please provide your name and official email');
      return;
    }

    if (regRole === 'treasurer') {
      setErrorMessage('Officer access cannot be self-registered. An existing officer must promote your account.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(regEmail, regName, SUPABASE_ENABLED ? regPassword : 'member');
      setLoginSuccessToast(`Account provisioned for ${regName}`);
      setTimeout(() => {
        setIsSubmitting(false);
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 500);
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Registration could not be completed.');
    }
  };

  return (
    <div
      className={`relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden font-sans select-none bg-cover bg-center bg-no-repeat transition-all duration-700 ${
        isOpenModal ? 'fixed inset-0 z-50 overflow-y-auto' : ''
      }`}
      style={{
        backgroundImage: `url('/mountain_sunset_bg.jpg')`,
        backgroundColor: '#0f172a'
      }}
    >
      {/* Background Gradient & Mist Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/60 pointer-events-none" />
      <div className="absolute inset-0 backdrop-blur-[0.5px] pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg shadow-black/20">
            <ShieldCheck size={22} className="text-white drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold tracking-wider text-sm sm:text-base drop-shadow-md">
                STOKVEL TREASURY
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                XRPL TESTNET
              </span>
            </div>
            <p className="text-[11px] text-white/70 font-mono tracking-tight hidden sm:block">
              Multi-Signature Mandate & Autonomous Agent Guardrails
            </p>
          </div>
        </div>

        {/* View mode toggle & Quick Access actions */}
        <div className="flex items-center gap-2.5">
          <div className="bg-slate-900/40 backdrop-blur-md p-1 rounded-xl border border-white/20 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
              title="Show Login alongside Staff Members Showcase"
            >
              <Users size={14} />
              <span className="hidden md:inline">Staff Members Showcase</span>
              <span className="md:hidden">Showcase</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('focus')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'focus'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
              title="Exact replica matching the mockup screenshot"
            >
              <Maximize2 size={13} />
              <span className="hidden md:inline">Reference Replica</span>
              <span className="md:hidden">Replica</span>
            </button>
          </div>

          {isOpenModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-900/50 backdrop-blur-md border border-white/20 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 md:py-10">
        <div
          className={`w-full transition-all duration-500 ease-out flex flex-col items-center justify-center ${
            viewMode === 'split'
              ? 'max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10'
              : 'max-w-md'
          }`}
        >
          {/* ========================================================================= */}
          {/* LEFT/MAIN: FROSTED GLASS LOGIN CARD (REPRODUCING EXACT USER SCREENSHOT)  */}
          {/* ========================================================================= */}
          <div
            className={`w-full transition-all duration-300 ${
              viewMode === 'split' ? 'lg:col-span-6 xl:col-span-5' : 'mx-auto'
            }`}
          >
            {/* The Frosted Glass Container with Luminous Ambient Halo */}
            <div
              className="relative rounded-2xl p-8 sm:p-10 backdrop-blur-2xl border border-white/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.65),0_0_50px_rgba(255,255,255,0.08)] overflow-hidden"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                boxShadow:
                  '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px 0 rgba(255, 255, 255, 0.06), inset 0 1px 1px 0 rgba(255, 255, 255, 0.3)'
              }}
            >
              {/* Subtle top light edge sheen */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

              {/* TABS: Exactly "LOGIN" and "REGISTER", with optional "STAFF" */}
              <div className="flex items-center justify-center gap-8 mb-8 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('LOGIN');
                    setErrorMessage('');
                  }}
                  className={`text-base tracking-[0.2em] uppercase font-semibold transition cursor-pointer relative pb-1 ${
                    activeTab === 'LOGIN'
                      ? 'text-white font-bold drop-shadow'
                      : 'text-white/55 hover:text-white/80'
                  }`}
                >
                  LOGIN
                  {activeTab === 'LOGIN' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-white/70 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('REGISTER');
                    setErrorMessage('');
                  }}
                  className={`text-base tracking-[0.2em] uppercase font-semibold transition cursor-pointer relative pb-1 ${
                    activeTab === 'REGISTER'
                      ? 'text-white font-bold drop-shadow'
                      : 'text-white/55 hover:text-white/80'
                  }`}
                >
                  REGISTER
                  {activeTab === 'REGISTER' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-white/70 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('STAFF');
                    setErrorMessage('');
                  }}
                  className={`text-sm tracking-[0.15em] uppercase font-medium transition cursor-pointer relative pb-1 ${
                    activeTab === 'STAFF'
                      ? 'text-white font-bold drop-shadow'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  STAFF ROSTER
                  {activeTab === 'STAFF' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-amber-400 rounded-full" />
                  )}
                </button>
              </div>

              {/* Quick Staff Member Selector Strip (above inputs) */}
              <div className="mb-6 p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-white/70 flex items-center gap-1.5">
                    <Users size={12} className="text-amber-300" />
                    STAFF QUICK SIGN-IN
                  </span>
                  <span className="text-[10px] text-white/50 font-mono">
                    {STAFF_MEMBERS.length} Officers
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {STAFF_MEMBERS.map((staff) => {
                    const isSelected = selectedStaff?.id === staff.id;
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => handleSelectStaff(staff)}
                        title={`${staff.name} • ${staff.title}`}
                        className={`group relative flex flex-col items-center justify-center p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-white/20 border border-white/40 shadow-md ring-1 ring-white/50'
                            : 'bg-white/5 hover:bg-white/15 border border-white/5'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition shadow-sm ${
                            staff.isPrimaryAdmin
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                              : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                          }`}
                        >
                          {staff.initials}
                        </div>
                        <span className="text-[9px] text-white/80 font-medium truncate max-w-full mt-1">
                          {staff.name.split(' ')[0]}
                        </span>
                        {staff.isPrimaryAdmin && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedStaff && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] px-1 text-white/90">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="font-semibold">{selectedStaff.name}</span>
                      <span className="text-white/50 font-mono text-[10px]">
                        ({selectedStaff.staffId})
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 font-mono text-white/80">
                      {selectedStaff.clearanceLevel}
                    </span>
                  </div>
                )}
              </div>

              {/* Toast message */}
              {loginSuccessToast && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-medium">{loginSuccessToast}</span>
                </div>
              )}

              {/* Error message */}
              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <ShieldAlert size={16} className="text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ==================================== */}
              {/* TAB 1: EXACT REFERENCE LOGIN FORM   */}
              {/* ==================================== */}
              {activeTab === 'LOGIN' && (
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  {/* USERNAME FIELD */}
                  <div>
                    <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-2">
                      USERNAME
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin1234 or email"
                        autoComplete="username"
                        className="w-full bg-transparent text-white font-mono tracking-wider text-base sm:text-lg border-b border-white/40 hover:border-white/70 focus:border-white pb-2.5 outline-none transition-colors placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* PASSWORD FIELD */}
                  <div>
                    <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-2">
                      PASSWORD
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        className="w-full bg-transparent text-white font-mono tracking-widest text-base sm:text-lg border-b border-white/40 hover:border-white/70 focus:border-white pb-2.5 pr-8 outline-none transition-colors placeholder:text-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 bottom-3 text-white/50 hover:text-white transition cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-white/50 -mt-3">
                    {DEMO_MODE
                      ? 'Demo mode: officers can enter any password. Nothing is sent to the ledger.'
                      : 'Officers: the password is the treasurer PIN issued during backend setup. Members: any password.'}
                  </p>

                  {/* LOGIN BUTTON (Dark Solid Rectangular Button from Screenshot) */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#1e2532] hover:bg-[#151b26] active:bg-[#0f141d] text-white font-bold tracking-[0.25em] uppercase text-sm py-4 px-6 rounded-md shadow-2xl transition-all duration-200 cursor-pointer border border-white/10 hover:border-white/25 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>AUTHENTICATING...</span>
                        </>
                      ) : (
                        <span>LOGIN</span>
                      )}
                    </button>
                  </div>

                  {/* FORGOT PASSWORD? LINK */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/60 hover:text-white transition cursor-pointer"
                    >
                      FORGOT PASSWORD?
                    </button>
                  </div>

                  {/* Direct 1-Click Officer Sign-In Banner */}
                  {selectedStaff && (
                    <div className="pt-3 border-t border-white/10 text-center">
                      <button
                        type="button"
                        onClick={() => handleInstantStaffAuth(selectedStaff)}
                        className="text-xs text-amber-200 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 px-3.5 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Sparkles size={13} className="text-amber-400" />
                        <span>Instant 1-Click Access as {selectedStaff.name}</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* ==================================== */}
              {/* TAB 2: REGISTER FORM                 */}
              {/* ==================================== */}
              {activeTab === 'REGISTER' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-1.5">
                      FULL NAME
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Kagiso Motsepe"
                      className="w-full bg-transparent text-white font-mono tracking-wider text-sm border-b border-white/40 focus:border-white pb-2 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-1.5">
                      OFFICIAL EMAIL
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@stokvel.org"
                      className="w-full bg-transparent text-white font-mono tracking-wider text-sm border-b border-white/40 focus:border-white pb-2 outline-none"
                    />
                  </div>

                  {SUPABASE_ENABLED && (
                    <div>
                      <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-1.5">
                        PASSWORD (8+ CHARACTERS)
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full bg-transparent text-white font-mono tracking-wider text-sm border-b border-white/40 focus:border-white pb-2 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-1.5">
                      PORTAL ROLE
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setRegRole('treasurer')}
                        className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex flex-col items-center gap-1 ${
                          regRole === 'treasurer'
                            ? 'bg-amber-500/30 border-amber-400 text-white'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <ShieldCheck size={16} />
                        <span>Staff Officer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegRole('user')}
                        className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex flex-col items-center gap-1 ${
                          regRole === 'user'
                            ? 'bg-emerald-500/30 border-emerald-400 text-white'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <User size={16} />
                        <span>Stokvel Member</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold tracking-[0.2em] uppercase text-white/80 mb-1.5">
                      DEPARTMENT
                    </label>
                    <select
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      className="w-full bg-slate-900/90 text-white border border-white/20 rounded-lg p-2 text-xs outline-none"
                    >
                      <option value="Executive Treasury">Executive Treasury</option>
                      <option value="Financial Audit & Risk">Financial Audit & Risk</option>
                      <option value="Member Affairs & Claims">Member Affairs & Claims</option>
                      <option value="Automated Treasury Systems">Automated Treasury Systems</option>
                      <option value="Board of Trustees">Board of Trustees</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#1e2532] hover:bg-[#151b26] text-white font-bold tracking-[0.2em] uppercase text-xs py-3.5 px-6 rounded-md shadow-xl transition cursor-pointer border border-white/10"
                    >
                      REGISTER ACCOUNT
                    </button>
                  </div>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('LOGIN')}
                      className="text-[11px] text-white/60 hover:text-white uppercase tracking-wider"
                    >
                      Already registered? Return to Login
                    </button>
                  </div>
                </form>
              )}

              {/* ==================================== */}
              {/* TAB 3: IN-CARD STAFF ROSTER          */}
              {/* ==================================== */}
              {activeTab === 'STAFF' && (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  <p className="text-xs text-white/70 mb-2">
                    Select any verified staff member to authenticate with their security privileges:
                  </p>
                  {STAFF_MEMBERS.map((staff) => (
                    <div
                      key={staff.id}
                      onClick={() => handleSelectStaff(staff)}
                      className={`p-3 rounded-xl border backdrop-blur-md transition-all cursor-pointer flex items-center justify-between ${
                        selectedStaff?.id === staff.id
                          ? 'bg-white/20 border-white/40 ring-1 ring-white/40'
                          : 'bg-white/5 border-white/10 hover:bg-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                            staff.isPrimaryAdmin
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                              : 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
                          }`}
                        >
                          {staff.initials}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <span>{staff.name}</span>
                            {staff.isPrimaryAdmin && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                Chief
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-white/60">{staff.title}</p>
                          <p className="text-[9px] text-white/40 font-mono">
                            Username: <span className="text-amber-200">{staff.username}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstantStaffAuth(staff);
                          }}
                          className="px-2.5 py-1 rounded bg-[#1e2532] hover:bg-[#151b26] text-white text-[10px] font-semibold uppercase tracking-wider border border-white/20 cursor-pointer"
                        >
                          Sign In
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT: AUTHORIZED STAFF MEMBERS & TREASURY OFFICERS DIRECTORY SHOWCASE    */}
          {/* ========================================================================= */}
          {viewMode === 'split' && (
            <div className="w-full lg:col-span-6 xl:col-span-7 space-y-4">
              {/* Header Box */}
              <div className="p-6 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs uppercase tracking-widest font-bold text-amber-300">
                        EXECUTIVE DIRECTORY
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow">
                      Authorized Staff Members &amp; Officers
                    </h2>
                    <p className="text-xs text-white/80 mt-1 max-w-xl">
                      Official credentials, multi-signature ledger weights, and access clearance levels for Stokvel governance officers.
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/15 border border-white/20 font-mono text-white/90">
                      XRPL Quorum: 2/3
                    </span>
                    <span className="text-[10px] text-white/60 mt-1">Multi-Sig Guardrails</span>
                  </div>
                </div>

                {/* Staff Cards Grid */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {STAFF_MEMBERS.map((staff) => {
                    const isSelected = selectedStaff?.id === staff.id;
                    return (
                      <div
                        key={staff.id}
                        className={`group p-4 rounded-xl backdrop-blur-md border transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-white/20 border-white/40 shadow-xl ring-1 ring-white/50'
                            : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/30'
                        }`}
                      >
                        <div>
                          {/* Top row: Avatar, Name, Clearance */}
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${
                                  staff.isPrimaryAdmin
                                    ? 'bg-amber-500/30 text-amber-200 border-2 border-amber-400'
                                    : 'bg-indigo-500/30 text-indigo-200 border-2 border-indigo-400/60'
                                }`}
                              >
                                {staff.initials}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                                  staff.status === 'On Duty'
                                    ? 'bg-emerald-400'
                                    : 'bg-blue-400'
                                }`}
                                title={`Status: ${staff.status}`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-200 transition">
                                  {staff.name}
                                </h3>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 border border-white/20 font-mono text-white/90 shrink-0">
                                  {staff.staffId}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/80 font-medium truncate">
                                {staff.title}
                              </p>
                              <p className="text-[10px] text-white/50 font-mono truncate">
                                {staff.department}
                              </p>
                            </div>
                          </div>

                          {/* Credentials preview */}
                          <div className="mt-3 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-white/40 text-[9px] uppercase tracking-wider block">
                                Username
                              </span>
                              <span className="font-mono text-amber-300 font-semibold text-xs">
                                {staff.username}
                              </span>
                            </div>
                            <div>
                              <span className="text-white/40 text-[9px] uppercase tracking-wider block">
                                Clearance
                              </span>
                              <span className="text-white/90 font-medium text-[10px]">
                                {staff.clearanceLevel}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectingStaff(staff)}
                            className="text-[10px] text-white/70 hover:text-white flex items-center gap-1 font-medium transition cursor-pointer"
                          >
                            <Info size={12} />
                            <span>View Duties</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectStaff(staff)}
                              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-medium transition cursor-pointer"
                              title="Fill credentials into login form"
                            >
                              Fill Form
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInstantStaffAuth(staff)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold transition cursor-pointer shadow-sm flex items-center gap-1"
                            >
                              <span>Enter</span>
                              <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Info Footnote */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/70">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={14} className="text-emerald-400" />
                    <span>Cryptographic Multi-Sig &amp; XRPL Policy Enforcement Enabled</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/50">
                    Network: XRP Testnet
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer bar */}
      <footer className="relative z-10 w-full px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-white/60 border-t border-white/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-2">
          <span>Stokvel Treasury Multi-Sig Management</span>
          <span>•</span>
          <span>XRPL Autonomous Agent Security Gateway</span>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0 font-mono text-[10px]">
          <span>Chief Treasurer: Ancle Mabaso (admin1234)</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Quorum: 2 / Weight: 4</span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL: STAFF MEMBER PROFILE & DUTIES INSPECTOR                             */}
      {/* ========================================================================= */}
      {inspectingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl p-6 backdrop-blur-2xl bg-slate-900/90 border border-white/20 shadow-2xl text-white relative">
            <button
              type="button"
              onClick={() => setInspectingStaff(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                  inspectingStaff.isPrimaryAdmin
                    ? 'bg-amber-500/30 text-amber-200 border-amber-400'
                    : 'bg-indigo-500/30 text-indigo-200 border-indigo-400'
                }`}
              >
                {inspectingStaff.initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{inspectingStaff.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/15 font-mono">
                    {inspectingStaff.staffId}
                  </span>
                </div>
                <p className="text-xs text-amber-300 font-medium">{inspectingStaff.title}</p>
                <p className="text-[11px] text-white/60">{inspectingStaff.department}</p>
              </div>
            </div>

            <div className="space-y-3 my-4 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-white/50">Username</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {inspectingStaff.username}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Official Email</span>
                  <span className="font-mono text-white/90">{inspectingStaff.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Contact Phone</span>
                  <span className="font-mono text-white/90">{inspectingStaff.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">XRPL Wallet</span>
                  <span className="font-mono text-indigo-300 truncate max-w-[220px]">
                    {inspectingStaff.walletAddress}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white/80 uppercase tracking-wider text-[11px] mb-1.5">
                  Clearance Level &amp; Cryptographic Authority
                </h4>
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs">
                  <span className="font-bold text-amber-300 block mb-0.5">
                    {inspectingStaff.clearanceLevel}
                  </span>
                  <p className="text-[11px] opacity-90">{inspectingStaff.clearanceDesc}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white/80 uppercase tracking-wider text-[11px] mb-1.5">
                  Official Mandate Responsibilities
                </h4>
                <ul className="space-y-1.5">
                  {inspectingStaff.duties.map((duty, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[11px] text-white/80">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{duty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSelectStaff(inspectingStaff);
                  setInspectingStaff(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
              >
                Fill In Credentials
              </button>
              <button
                type="button"
                onClick={() => {
                  const staff = inspectingStaff;
                  setInspectingStaff(null);
                  handleInstantStaffAuth(staff);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Authenticate as {inspectingStaff.name.split(' ')[0]}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FORGOT PASSWORD RECOVERY                                           */}
      {/* ========================================================================= */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl p-6 backdrop-blur-2xl bg-slate-900/90 border border-white/20 shadow-2xl text-white relative">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setForgotSent(false);
              }}
              className="absolute top-4 right-4 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold">Password &amp; PIN Recovery</h3>
                <p className="text-xs text-white/60">Stokvel Officer Multi-Factor Verification</p>
              </div>
            </div>

            {forgotSent ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs">
                  <p className="font-bold mb-1">Recovery Instructions Dispatched</p>
                  <p className="opacity-90">
                    A secure password reset link and testnet PIN hint has been sent to{' '}
                    <span className="font-mono text-white">{forgotEmail || 'your email'}</span>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80">
                  <p className="font-semibold text-amber-300 mb-1">Demo Environment Shortcut:</p>
                  <p>
                    Chief Treasurer credentials: Username <span className="font-mono font-bold text-white">admin1234</span>,
                    Password <span className="font-mono font-bold text-white">••••••••••••</span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSent(false);
                    setUsername('admin1234');
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Return to Login (Auto-fill admin1234)
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!forgotEmail) return;
                  setForgotSent(true);
                }}
                className="space-y-4 text-xs"
              >
                <p className="text-white/70">
                  Enter your registered Staff Officer ID or official email address to receive authorization keys:
                </p>
                <div>
                  <label className="block text-white/70 mb-1 font-medium">Officer Email / Staff ID</label>
                  <input
                    type="text"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="mabasoanele76@gmail.com or STF-001"
                    className="w-full bg-slate-950/80 border border-white/20 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-md"
                  >
                    Send Recovery Code
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
