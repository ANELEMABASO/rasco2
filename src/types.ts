export type UserRole = 'treasurer' | 'user';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  username?: string;
  memberId?: string;
  staffId?: string;
  department?: string;
  title?: string;
  clearanceLevel?: string;
  avatarUrl?: string;
  walletAddress?: string;
  phone?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  staffId: string;
  department: string;
  title: string;
  clearanceLevel: 'Level 1' | 'Level 2' | 'Level 3';
  clearanceDesc: string;
  avatarUrl?: string;
  initials: string;
  phone: string;
  walletAddress: string;
  status: 'Active' | 'On Duty' | 'In Session' | 'Standby';
  duties: string[];
  isPrimaryAdmin?: boolean;
  defaultPassword?: string;
}

export interface AuditLog {
  id: number;
  time: string;
  type: 'SUCCESS' | 'BLOCKED' | 'KILL_SWITCH' | 'SYSTEM';
  recipient: string;
  amount: string;
  reason: string;
  hash: string | null;
  submittedBy?: string;
  memberId?: string;
  /** Machine-readable reason, e.g. UNAPPROVED_RECIPIENT or tefBAD_QUORUM. */
  code?: string;
  /** SHA-256 of the agent's reasoning, as written into the XRPL memo. */
  reasoningHash?: string;
}

export interface MemberClaim {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  recipient: string;
  category: string;
  reason: string;
  status: 'APPROVED' | 'BLOCKED' | 'PENDING';
  blockReason?: string;
  txHash?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Shapes returned by the backend (backend/api.py)
// ---------------------------------------------------------------------------

export interface ApprovedRecipient {
  address: string;
  label: string;
}

export interface SignerInfo {
  account: string;
  weight: number;
  role: 'human' | 'policy' | 'agent' | 'unknown';
  label: string;
}

export interface ServerEvent extends Omit<AuditLog, 'time'> {
  /** ISO timestamp from the server. */
  time: string;
}

export interface ServerClaim extends Omit<MemberClaim, 'blockReason' | 'txHash'> {
  blockReason?: string | null;
  txHash?: string | null;
}

export interface ServerState {
  network: string;
  treasuryAddress: string;
  treasuryBalance: number;
  ledgerError: string | null;
  quorum: number;
  signers: SignerInfo[];
  /** True only if the agent is currently in the signer list ON THE LEDGER. */
  agentActive: boolean;
  agentAddress: string;
  agentMode: 'llm' | 'rules';
  explorerTx: string;
  mandate: {
    perPaymentCap: number;
    monthlyCap: number;
    monthlySpent: number;
    month: string;
    approvedRecipients: ApprovedRecipient[];
  };
  logs: ServerEvent[];
  demo: { strangerAddress: string };
}

export interface AttemptResult {
  status: 'PAID' | 'POLICY_BLOCKED' | 'LEDGER_REJECTED' | 'ERROR' | 'DECLINED';
  code: string;
  reason: string;
  txHash?: string;
  reasoningHash?: string;
}
