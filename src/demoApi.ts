/**
 * In-browser SIMULATION used only in demo mode (see api.ts).
 * It mirrors the real backend's rules and response shapes, but nothing here touches the XRP Ledger.
 * Hashes are prefixed DEMO- and the UI does not link them to the explorer.
 */
import type { Api } from './api.ts';
import { ApiError, setToken } from './session.ts';
import type { AttemptResult, ServerClaim, ServerEvent, ServerState } from './types.ts';

const iso = (minsAgo = 0) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const fakeHash = () =>
  'DEMO-' + Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 1000;

const AGENT = 'rDemoAgent000000000000000000000';
const state: ServerState = {
  network: 'testnet',
  treasuryAddress: 'rDemoTreasury0000000000000000000',
  treasuryBalance: 1000,
  ledgerError: null,
  quorum: 2,
  signers: [
    { account: 'rDemoHuman00000000000000000000', weight: 2, role: 'human', label: 'Stokvel Treasurer (human)' },
    { account: 'rDemoPolicy0000000000000000000', weight: 1, role: 'policy', label: 'Policy Service (independent co-signer)' },
    { account: AGENT, weight: 1, role: 'agent', label: 'AI Treasurer Agent' },
  ],
  agentActive: true,
  agentAddress: AGENT,
  agentMode: 'rules',
  explorerTx: 'https://testnet.xrpl.org/transactions/',
  mandate: {
    perPaymentCap: 20,
    monthlyCap: 100,
    monthlySpent: 10,
    month: new Date().toISOString().slice(0, 7),
    approvedRecipients: [
      { address: 'rDemoFuneralParlour00000000000', label: 'Funeral Parlour' },
      { address: 'rDemoCommunityHall000000000000', label: 'Community Hall Rental' },
      { address: 'rDemoBulkGroceries000000000000', label: 'Bulk Groceries Wholesaler' },
    ],
  },
  logs: [
    {
      id: 3, time: iso(40), type: 'SUCCESS', recipient: 'rDemoFuneralParlour00000000000 (Funeral Parlour)',
      amount: '10 XRP', reason: 'Monthly burial-cover premium', hash: 'DEMO-0000000000000000000A7B82C',
      submittedBy: 'Treasurer Agent (scheduled)', memberId: 'AGENT', code: 'tesSUCCESS',
    },
  ],
  demo: { strangerAddress: 'rDemoStranger0000000000000000000' },
};

const claims: ServerClaim[] = [];
const log = (type: ServerEvent['type'], f: Partial<ServerEvent>) =>
  state.logs.unshift({
    id: nextId++, time: iso(), type, recipient: 'N/A', amount: '0 XRP', reason: '', hash: null,
    submittedBy: 'System', memberId: 'N/A', ...f,
  });
const label = (addr: string) => {
  const r = state.mandate.approvedRecipients.find((x) => x.address === addr);
  return r ? `${addr} (${r.label})` : addr;
};

function attemptPayment(destination: string, amount: number, reason: string, who: string, skipPolicy = false): AttemptResult {
  const m = state.mandate;
  const base = { submittedBy: who, memberId: 'AGENT', recipient: label(destination), amount: `${amount} XRP` };
  if (skipPolicy) {
    const reasonText = 'Bypass attempt rejected by the XRP Ledger (tefBAD_QUORUM): policy co-signature missing, signer quorum not met.';
    log('BLOCKED', { ...base, reason: reasonText, code: 'tefBAD_QUORUM' });
    return { status: 'LEDGER_REJECTED', code: 'tefBAD_QUORUM', reason: 'The XRP Ledger rejected the transaction (tefBAD_QUORUM).' };
  }
  const refuse = (code: string, why: string): AttemptResult => {
    log('BLOCKED', { ...base, reason: why, code });
    return { status: 'POLICY_BLOCKED', code, reason: why };
  };
  if (!m.approvedRecipients.some((r) => r.address === destination))
    return refuse('UNAPPROVED_RECIPIENT', "Unapproved recipient (not on the stokvel's approved list).");
  if (amount > m.perPaymentCap) return refuse('OVER_PAYMENT_CAP', `Exceeds per-payment cap (${m.perPaymentCap} XRP).`);
  if (m.monthlySpent + amount > m.monthlyCap)
    return refuse('OVER_MONTHLY_CAP', `Exceeds monthly budget cap (${m.monthlyCap} XRP). Already committed this month: ${m.monthlySpent} XRP.`);
  if (!state.agentActive) {
    log('BLOCKED', { ...base, code: 'tefBAD_SIGNATURE', reason: 'Co-signed, but the XRP Ledger rejected it (tefBAD_SIGNATURE).' });
    return { status: 'LEDGER_REJECTED', code: 'tefBAD_SIGNATURE', reason: 'The XRP Ledger rejected the transaction (tefBAD_SIGNATURE).' };
  }
  const txHash = fakeHash();
  m.monthlySpent = round(m.monthlySpent + amount);
  state.treasuryBalance = round(state.treasuryBalance - amount);
  log('SUCCESS', { ...base, reason, hash: txHash, code: 'tesSUCCESS' });
  return { status: 'PAID', code: 'tesSUCCESS', txHash, reason: 'Simulated payment (demo mode, nothing was sent to the ledger).' };
}

function processClaim(c: ServerClaim) {
  const dest = c.recipient.trim().split(/\s+/)[0];
  const r = attemptPayment(dest, c.amount, `Claim ${c.id} from ${c.memberName}: ${c.reason}`, 'Treasurer Agent');
  if (r.status === 'PAID') {
    c.status = 'APPROVED';
    c.txHash = r.txHash;
    c.blockReason = null;
  } else {
    c.status = 'BLOCKED';
    c.blockReason = r.status === 'LEDGER_REJECTED' ? `Rejected by the XRP Ledger (${r.code}). Agent may have been revoked.` : r.reason;
  }
}

const wait = () => sleep(400);

export const demoApi: Api = {
  async login() {
    setToken('demo-session');
  },
  async logout() {
    setToken(null);
  },
  async getState() {
    return structuredClone(state);
  },
  async getClaims(memberId) {
    return structuredClone(memberId ? claims.filter((c) => c.memberId === memberId) : claims);
  },
  async setCaps(caps) {
    const m = state.mandate;
    const parts: string[] = [];
    if (caps.perPaymentCap !== undefined) { parts.push(`per-payment cap ${m.perPaymentCap} -> ${caps.perPaymentCap} XRP`); m.perPaymentCap = caps.perPaymentCap; }
    if (caps.monthlyCap !== undefined) { parts.push(`monthly cap ${m.monthlyCap} -> ${caps.monthlyCap} XRP`); m.monthlyCap = caps.monthlyCap; }
    if (parts.length) log('SYSTEM', { reason: `Treasurer changed the mandate: ${parts.join('; ')}.` });
    return {};
  },
  async addRecipient(address, lbl) {
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address) && !address.startsWith('rDemo'))
      throw new ApiError(422, 'Not a valid XRPL address.');
    const list = state.mandate.approvedRecipients.filter((r) => r.address !== address);
    state.mandate.approvedRecipients = [...list, { address, label: lbl || 'Approved vendor' }];
    log('SYSTEM', { recipient: `${address} (${lbl})`, reason: 'Treasurer added a vendor to the approved list.' });
    return {};
  },
  async removeRecipient(address) {
    state.mandate.approvedRecipients = state.mandate.approvedRecipients.filter((r) => r.address !== address);
    log('SYSTEM', { recipient: address, reason: 'Treasurer removed a vendor from the approved list.' });
    return {};
  },
  async revokeAgent() {
    await wait();
    state.agentActive = false;
    state.signers = state.signers.filter((s) => s.role !== 'agent');
    const hash = fakeHash();
    log('KILL_SWITCH', { hash, reason: 'Treasurer removed the agent from the on-ledger signer list. The ledger now rejects its signatures.' });
    return { hash };
  },
  async reauthorizeAgent() {
    await wait();
    state.agentActive = true;
    state.signers = [...state.signers, { account: AGENT, weight: 1, role: 'agent', label: 'AI Treasurer Agent' }];
    const hash = fakeHash();
    log('SYSTEM', { hash, reason: 'Treasurer re-authorised the agent: it is back in the on-ledger signer list.' });
    return { hash };
  },
  async attempt(body) {
    await wait();
    return attemptPayment(body.destination, body.amount, `Scripted attempt: ${body.reason}`, 'Treasurer Agent (test)', body.skipPolicy);
  },
  async runAgentCycle() {
    await wait();
    const pending = claims.filter((c) => c.status === 'PENDING');
    pending.forEach(processClaim);
    return { claims: pending.map((c) => ({ id: c.id, status: c.status })), obligations: [] };
  },
  async submitClaim(claim) {
    await wait();
    const c: ServerClaim = { id: `claim-${nextId++}`, ...claim, status: 'PENDING', timestamp: iso(), blockReason: null, txHash: null };
    claims.unshift(c);
    processClaim(c);
    return structuredClone(c);
  },
};
