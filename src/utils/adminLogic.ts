import { User } from "@/types/auth";

// These are now only used as FALLBACKS if no job data is present
export const BASE_RATES: Record<string, number> = {
  maid: 500,
  cook: 600,
  helper: 400,
  plumber: 800,
  electrician: 900,
  carpenter: 850,
  driver: 700,
  default: 500
};

/**
 * Calculates income based on actual job count and average rates.
 * In the new system, we prioritize the 'amount' field in verifications,
 * but this utility serves as an admin-side validator.
 */
export const calculateEstimatedIncome = (worker: User, jobCount: number) => {
  const skill = (worker.skill || "default").toLowerCase();
  const rateKey = Object.keys(BASE_RATES).find(key => skill.includes(key)) || "default";
  const rate = BASE_RATES[rateKey];
  
  // Weekly estimate: jobs * rate (assuming jobCount is recent verified jobs)
  return jobCount * rate;
};

export const calculateLoanEligibility = (monthlyIncome: number) => {
  // Max EMI = 35% of monthly income
  const maxEMI = monthlyIncome * 0.35;
  
  // Realistic loan range: 12x to 18x of max EMI
  return {
    maxEMI: Math.round(maxEMI),
    minLoan: Math.round(maxEMI * 12),
    maxLoan: Math.round(maxEMI * 18)
  };
};

export const checkVerifiedBadgeEligibility = (worker: User, jobCount: number, avgRating: number, fraudRisk: "LOW" | "MEDIUM" | "HIGH") => {
  const hasMinJobs = jobCount >= 10; // Relaxed from 20 for realism
  const isHighlyRated = avgRating >= 4.0;
  const isSafe = fraudRisk === "LOW";
  
  return hasMinJobs && isHighlyRated && isSafe;
};

export const getFraudRiskLevel = (score: number): "LOW" | "MEDIUM" | "HIGH" => {
  if (score >= 80) return "LOW";
  if (score >= 50) return "MEDIUM";
  return "HIGH";
};
