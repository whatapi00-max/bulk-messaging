import { whatsappNumbers } from "../db/schema";

export interface RotationCandidate {
  id: string;
  dailyLimit: number | null;
  messagesSentToday: number | null;
  healthScore: string | number | null;
  isActive: boolean | null;
  isPaused: boolean | null;
  errorCount?: number | null;
}

export interface AllocationResult {
  numberId: string;
  count: number;
  weight: number;
}

function safeNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) ? num : fallback;
}

export function getAvailableCapacity(number: RotationCandidate): number {
  const dailyLimit = safeNumber(number.dailyLimit, 0);
  const sentToday = safeNumber(number.messagesSentToday, 0);
  return Math.max(0, dailyLimit - sentToday);
}

export function getHealthWeight(number: RotationCandidate): number {
  const health = safeNumber(number.healthScore, 100);
  const errorPenalty = Math.min(safeNumber(number.errorCount, 0) * 0.02, 0.3);
  return Math.max(0, health / 100 - errorPenalty);
}

export function isEligibleNumber(number: RotationCandidate): boolean {
  return Boolean(number.isActive) && !Boolean(number.isPaused) && getAvailableCapacity(number) > 0;
}

export function calculateProportionalAllocation(
  numbers: RotationCandidate[],
  totalMessages: number
): AllocationResult[] {
  const eligible = numbers.filter(isEligibleNumber);
  if (eligible.length === 0 || totalMessages <= 0) return [];

  const weighted = eligible.map((number) => {
    const capacity = getAvailableCapacity(number);
    const healthWeight = getHealthWeight(number);
    return {
      numberId: number.id,
      capacity,
      weight: Math.max(0.01, capacity * healthWeight),
    };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let allocated = 0;

  const results = weighted.map((item) => {
    const share = Math.floor((item.weight / totalWeight) * totalMessages);
    const count = Math.min(item.capacity, share);
    allocated += count;
    return { numberId: item.numberId, count, weight: item.weight };
  });

  let remainder = totalMessages - allocated;
  while (remainder > 0) {
    const next = results
      .filter((result) => {
        const original = weighted.find((item) => item.numberId === result.numberId);
        return original ? result.count < original.capacity : false;
      })
      .sort((a, b) => b.weight - a.weight)[0];

    if (!next) break;
    next.count += 1;
    remainder -= 1;
  }

  return results.filter((item) => item.count > 0);
}

export function pickFailoverNumber(
  numbers: RotationCandidate[],
  failedNumberId: string
): RotationCandidate | null {
  return (
    numbers
      .filter((number) => number.id !== failedNumberId)
      .filter(isEligibleNumber)
      .sort((a, b) => getHealthWeight(b) * getAvailableCapacity(b) - getHealthWeight(a) * getAvailableCapacity(a))[0] ?? null
  );
}

export function shouldAutoPauseNumber(number: RotationCandidate): boolean {
  const health = safeNumber(number.healthScore, 100);
  const errors = safeNumber(number.errorCount, 0);
  return health < 40 || errors >= 25;
}
