import { StaffMember, UserProfile } from '../types.ts';

export const STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'Ancle Mabaso',
    username: 'admin1234',
    email: 'mabasoanele76@gmail.com',
    role: 'treasurer',
    staffId: 'STF-001',
    department: 'Executive Treasury',
    title: 'Chief Treasurer & Multi-Sig Co-Signer',
    clearanceLevel: 'Level 3',
    clearanceDesc: 'Full Treasury Execution, XRPL Signer (Weight: 2), Emergency Kill-Switch Keyholder',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    initials: 'AM',
    phone: '+27 82 123 4567',
    walletAddress: 'rChair99217K9M3qL4xF82B',
    status: 'On Duty',
    duties: [
      'Ledger multi-sig co-signing authority',
      'Mandate per-payment and monthly limit adjustments',
      'Approved vendor whitelist authorization',
      'Emergency SignerListSet circuit breaker revocation'
    ],
    isPrimaryAdmin: true,
    defaultPassword: '••••••••••••'
  },
  {
    id: 'staff-2',
    name: 'Kagiso Motsepe',
    username: 'kmotsepe',
    email: 'kagiso.motsepe@stokvel.org',
    role: 'treasurer',
    staffId: 'STF-002',
    department: 'Financial Audit & Risk',
    title: 'Deputy Treasurer & Policy Auditor',
    clearanceLevel: 'Level 2',
    clearanceDesc: 'Policy Audit, Reserve Verification, Mandate Oversight',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    initials: 'KM',
    phone: '+27 83 234 5678',
    walletAddress: 'rAuditor44P2mN9vL81E9',
    status: 'Active',
    duties: [
      'Policy service ledger reconciliation',
      'SHA-256 reasoning hash validation',
      'Quarterly treasury audit reports',
      'Disbursement quota compliance'
    ],
    isPrimaryAdmin: false,
    defaultPassword: '••••••••••••'
  },
  {
    id: 'staff-3',
    name: 'Thandiwe Zulu',
    username: 'tzulu',
    email: 'thandiwe.zulu@stokvel.org',
    role: 'treasurer',
    staffId: 'STF-003',
    department: 'Member Affairs & Disbursements',
    title: 'General Secretary & Claims Lead',
    clearanceLevel: 'Level 2',
    clearanceDesc: 'Claim Evaluation, Proof of Payment Verification, Member Onboarding',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    initials: 'TZ',
    phone: '+27 71 345 6789',
    walletAddress: 'rSecr901K4qR8wT33F1',
    status: 'Active',
    duties: [
      'Burial cover and bereavement verification',
      'Grocery voucher and emergency fund processing',
      'Member claim dispute resolution',
      'Executive meeting secretarial records'
    ],
    isPrimaryAdmin: false,
    defaultPassword: '••••••••••••'
  },
  {
    id: 'staff-4',
    name: 'David Ndlovu',
    username: 'dndlovu',
    email: 'david.ndlovu@stokvel.org',
    role: 'treasurer',
    staffId: 'STF-004',
    department: 'Automated Treasury Systems',
    title: 'XRPL Autonomous Agent Supervisor',
    clearanceLevel: 'Level 2',
    clearanceDesc: 'Agent Heartbeat, Ledger Quorum Monitoring, Faucet & Node Health',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    initials: 'DN',
    phone: '+27 84 456 7890',
    walletAddress: 'rAgentSup77Y4kP11C7',
    status: 'On Duty',
    duties: [
      'Autonomous payment cycle agent supervision',
      'Claude 3.5 Sonnet tool-calling latency monitoring',
      'Testnet ledger quorum connectivity',
      'Fail-closed budget reservation oversight'
    ],
    isPrimaryAdmin: false,
    defaultPassword: '••••••••••••'
  },
  {
    id: 'staff-5',
    name: 'Dr. Lindiwe Nkosi',
    username: 'lnkosi',
    email: 'lindiwe.nkosi@stokvel.org',
    role: 'treasurer',
    staffId: 'STF-005',
    department: 'Board of Trustees',
    title: 'Senior Trustee & Governance Chair',
    clearanceLevel: 'Level 3',
    clearanceDesc: 'Constitutional Governance, Legal Compliance, High-Value Authorization',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
    initials: 'LN',
    phone: '+27 82 987 6543',
    walletAddress: 'rTrustee55H8mZ99AA',
    status: 'Standby',
    duties: [
      'Stokvel constitutional mandate enforcement',
      'Reserve fund investment policy',
      'Inter-stokvel syndicate coordination',
      'Annual financial transparency reporting'
    ],
    isPrimaryAdmin: false,
    defaultPassword: '••••••••••••'
  }
];

export const MEMBER_PROFILES: UserProfile[] = [
  {
    id: 'member-1',
    name: 'Sipho Khumalo',
    username: 'skhumalo',
    email: 'sipho.khumalo@stokvel.org',
    role: 'user',
    memberId: 'STK-042',
    department: 'General Membership',
    title: 'Active Member (Tier 1)',
    walletAddress: 'rMem42K89T4wL77CA',
    phone: '+27 82 555 0192'
  },
  {
    id: 'member-2',
    name: 'Nomsa Dlamini',
    username: 'ndlamini',
    email: 'nomsa.dlamini@stokvel.org',
    role: 'user',
    memberId: 'STK-088',
    department: 'General Membership',
    title: 'Active Member (Tier 1)',
    walletAddress: 'rMem88P33X1mK99BA',
    phone: '+27 73 555 4321'
  },
  {
    id: 'member-3',
    name: 'Zanele Sithole',
    username: 'zsithole',
    email: 'zanele.sithole@stokvel.org',
    role: 'user',
    memberId: 'STK-105',
    department: 'General Membership',
    title: 'Active Member (Tier 1)',
    walletAddress: 'rMem105B88kP44BB',
    phone: '+27 76 111 2233'
  }
];

export const ALL_PRESET_USERS: UserProfile[] = [
  ...STAFF_MEMBERS.map((s) => ({
    id: s.id,
    name: s.name,
    username: s.username,
    email: s.email,
    role: s.role,
    memberId: `${s.staffId} (${s.title.split('&')[0].trim()})`,
    staffId: s.staffId,
    department: s.department,
    title: s.title,
    clearanceLevel: s.clearanceLevel,
    avatarUrl: s.avatarUrl,
    walletAddress: s.walletAddress,
    phone: s.phone
  })),
  ...MEMBER_PROFILES
];
