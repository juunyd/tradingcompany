// The authoritative price list. The browser sends only a publication id —
// never an amount — so a tampered client cannot buy a ₹399 book for ₹1.
export const CATALOG: Record<string, { title: string; amount: number }> = {
  'risk-framework':  { title: 'The Risk Framework',  amount: 39900 },
  'traders-mind':    { title: "The Trader's Mind",   amount: 39900 },
  'position-sizing': { title: 'Position Sizing',     amount: 39900 },
  'trading-system':  { title: 'The Trading System',  amount: 39900 },
  'review':          { title: 'The Review',          amount: 39900 },
  'bundle':          { title: 'All five publications', amount: 99900 },
};

export const CURRENCY = 'INR';

export function lookup(publicationId: unknown) {
  if (typeof publicationId !== 'string') return null;
  return CATALOG[publicationId] ?? null;
}

// Good enough to reject junk before we create a Razorpay order; real
// verification is the customer receiving the file at this address.
export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
