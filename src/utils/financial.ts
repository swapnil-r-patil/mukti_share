import { Timestamp } from "firebase/firestore";

/**
 * Parses a budget string like "₹500-1000", "₹300 - ₹700", "₹2000+", or "₹500"
 * into a single numeric amount (midpoint for ranges).
 */
export const parseBudgetToAmount = (budget: string | number | undefined | null): number => {
  if (typeof budget === 'number') return budget;
  if (!budget || typeof budget !== 'string') return 0;

  // Remove currency symbols, commas, spaces
  const cleaned = budget.replace(/[₹,\s]/g, '');

  // Handle range: "500-1000" or "300-700"
  const rangeMatch = cleaned.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    return Math.round((low + high) / 2); // Return midpoint
  }

  // Handle "2000+" style
  const plusMatch = cleaned.match(/^(\d+)\+$/);
  if (plusMatch) {
    return parseInt(plusMatch[1], 10);
  }

  // Handle plain number "500"
  const plainMatch = cleaned.match(/^(\d+)$/);
  if (plainMatch) {
    return parseInt(plainMatch[1], 10);
  }

  return 0;
};

export interface IncomeStats {
  totalEarnings: number;
  perJobIncome: number;
  monthlyIncome: number;
  incomeRange: { min: number; max: number };
  safeEMI: number;
  loanRange: { min: number; max: number };
  totalJobs: number;
  activeMonths: number;
}

export const calculateIncomeStats = (verifications: any[]): IncomeStats => {
  if (!verifications || verifications.length === 0) {
    return {
      totalEarnings: 0,
      perJobIncome: 0,
      monthlyIncome: 0,
      incomeRange: { min: 0, max: 0 },
      safeEMI: 0,
      loanRange: { min: 0, max: 0 },
      totalJobs: 0,
      activeMonths: 0
    };
  }

  const totalJobs = verifications.length;
  
  // Calculate total earnings by summing 'amount'
  // For records that only have a 'budget' string (legacy), parse it to a number
  const totalEarnings = verifications.reduce((acc, v) => {
    const amt = v.amount || parseBudgetToAmount(v.budget) || 0;
    return acc + amt;
  }, 0);

  // Calculate active months
  const activeMonthSet = new Set(verifications.map(v => {
    const d = v.timestamp instanceof Date ? v.timestamp : (v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.timestamp));
    return isNaN(d.getTime()) ? 'unknown' : `${d.getMonth()}-${d.getFullYear()}`;
  }));
  const activeMonths = activeMonthSet.size || 1;

  const monthlyIncome = totalEarnings / activeMonths;
  const perJobIncome = totalJobs > 0 ? totalEarnings / totalJobs : 0;

  // Real data is more precise, so narrower range (80% to 120%)
  const incomeRange = {
    min: Math.floor(monthlyIncome * 0.8),
    max: Math.ceil(monthlyIncome * 1.2)
  };

  // Standard safe EMI: 35% of monthly income
  const safeEMI = monthlyIncome * 0.35;

  // Loan range: 12x to 18x of safe EMI (roughly 1-1.5 years tenure)
  const loanRange = {
    min: Math.floor(safeEMI * 12),
    max: Math.ceil(safeEMI * 18)
  };

  return {
    totalEarnings,
    perJobIncome,
    monthlyIncome,
    incomeRange,
    safeEMI,
    loanRange,
    totalJobs,
    activeMonths
  };
};
