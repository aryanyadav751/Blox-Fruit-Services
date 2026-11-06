/**
 * Blox Fruit Services - Precision Trade Value Calculator
 * 
 * Rules:
 * 1. Values are measured in Millions (M) of in-game trade value.
 * 2. To eliminate floating point precision drift, all math internally uses
 *    INTEGER hundredths of an M (e.g. 45.00M = 4500, 0.15M = 15, 2.5M = 250).
 * 3. Rounding rule: Round Half Up to nearest hundredth.
 * 4. Payment schedule: 50% deposit upfront, remaining 50% on completion.
 *    Deposit = roundHalfUp(total * 0.5)
 *    Remaining = total - deposit (Guarantees deposit + remaining ALWAYS strictly equals total)
 */

/**
 * Rounds a number to the nearest integer using the Round-Half-Up convention
 * (standard financial/Python Decimal ROUND_HALF_UP).
 */
export function roundHalfUp(val: number): number {
  if (val >= 0) {
    return Math.floor(val + 0.5);
  } else {
    return Math.ceil(val - 0.5);
  }
}

/**
 * Converts a million (M) trade value number or string into integer hundredths.
 * Example: 45 -> 4500, "0.15" -> 15, 2.5 -> 250, "75.5" -> 7550
 */
export function toHundredths(val: number | string): number {
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    return roundHalfUp(parsed * 100);
  }
  if (isNaN(val)) return 0;
  return roundHalfUp(val * 100);
}

/**
 * Converts integer hundredths back into an M string representation.
 * Example: 4500 -> "45.00M", 15 -> "0.15M", 250 -> "2.50M"
 */
export function toMillionString(hundredths: number, includeSuffix = true): string {
  const isNegative = hundredths < 0;
  const abs = Math.abs(hundredths);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const formatted = `${isNegative ? '-' : ''}${whole}.${frac.toString().padStart(2, '0')}`;
  return includeSuffix ? `${formatted}M` : formatted;
}

/**
 * Calculates the exact 50% deposit and remaining balance.
 * INVARIANT: depositHundredths + remainingHundredths === totalHundredths
 */
export function calculateDepositAndRemaining(totalHundredths: number): {
  depositHundredths: number;
  remainingHundredths: number;
  depositString: string;
  remainingString: string;
  totalString: string;
} {
  if (totalHundredths <= 0) {
    return {
      depositHundredths: 0,
      remainingHundredths: 0,
      depositString: '0.00M',
      remainingString: '0.00M',
      totalString: '0.00M',
    };
  }

  // Round half up for deposit
  const depositHundredths = roundHalfUp(totalHundredths * 0.5);
  // Remaining is strictly the difference, NEVER recalculated independently
  const remainingHundredths = totalHundredths - depositHundredths;

  return {
    depositHundredths,
    remainingHundredths,
    depositString: toMillionString(depositHundredths),
    remainingString: toMillionString(remainingHundredths),
    totalString: toMillionString(totalHundredths),
  };
}

export interface ProposedItemInput {
  itemName: string;
  quantity: number;
  proposedValueM?: number | string;
  proposedValueHundredths?: number;
}

/**
 * Calculates the total proposed trade value from customer offered items.
 */
export function calculateItemsTotal(items: ProposedItemInput[]): {
  totalProposedHundredths: number;
  totalProposedString: string;
} {
  let total = 0;
  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const unitHundredths = item.proposedValueHundredths !== undefined
      ? item.proposedValueHundredths
      : toHundredths(item.proposedValueM || 0);
    total += qty * unitHundredths;
  }

  return {
    totalProposedHundredths: total,
    totalProposedString: toMillionString(total),
  };
}

/**
 * Validates whether an order's proposed items meet the minimum 50% deposit.
 */
export function validatePaymentCoverage(
  serviceTotalHundredths: number,
  offeredHundredths: number
): {
  hasMetDeposit: boolean;
  hasMetTotal: boolean;
  depositDeficitHundredths: number;
  totalDeficitHundredths: number;
  depositHundredths: number;
  remainingHundredths: number;
} {
  const { depositHundredths, remainingHundredths } = calculateDepositAndRemaining(serviceTotalHundredths);
  const hasMetDeposit = offeredHundredths >= depositHundredths;
  const hasMetTotal = offeredHundredths >= serviceTotalHundredths;
  const depositDeficitHundredths = Math.max(0, depositHundredths - offeredHundredths);
  const totalDeficitHundredths = Math.max(0, serviceTotalHundredths - offeredHundredths);

  return {
    hasMetDeposit,
    hasMetTotal,
    depositDeficitHundredths,
    totalDeficitHundredths,
    depositHundredths,
    remainingHundredths,
  };
}

/**
 * Generates an order code in the format BFS-XXXX (e.g. BFS-1042)
 */
export function generateOrderCode(seedNumber?: number): string {
  const num = seedNumber !== undefined 
    ? seedNumber 
    : Math.floor(1000 + Math.random() * 9000);
  return `BFS-${num}`;
}

/**
 * Generates an unguessable public token for bookmarking and customer viewing.
 * Prevents sequential ID harvesting/enumeration.
 */
export function generatePublicToken(): string {
  // Generates 32 hex chars with high entropy
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
