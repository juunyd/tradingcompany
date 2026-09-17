// The authoritative price list. The browser sends only a publication id —
// never an amount — so a tampered client cannot buy a ₹199 book for ₹1.
// The four-book recovery series. Each book is sold on its own; there is no bundle.
export const CATALOG: Record<string, { title: string; amount: number }> = {
  'lost-money-fo':         { title: 'I Lost Money in F&O. Now What.',        amount: 19900 },
  'revenge-trading-cure':  { title: 'The Revenge Trading Cure',              amount: 19900 },
  'should-i-quit-trading': { title: 'Should I Quit Trading? An Honest Test', amount: 19900 },
  'comeback-plan':         { title: 'The Comeback Plan',                     amount: 19900 },
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
