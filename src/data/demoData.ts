export interface Verification {
  id: string;
  workerId: string;
  workerName: string;
  workerSkill: string;
  customerName: string;
  customerPhone: string;
  rating: number;
  comment: string;
  timestamp: Date;
  isRepeatCustomer: boolean;
  workerType?: 0 | 1;
  amount?: number;
  paymentStatus?: "Paid" | "Pending";
}

export interface MonthlyData {
  month: string;
  jobs: number;
  rating: number;
}

export const DEMO_VERIFICATIONS: Verification[] = [
  {
    id: "v1",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Anita Sharma",
    customerPhone: "9988776655",
    rating: 5,
    comment: "Excellent plumbing work. Fixed the leak quickly.",
    timestamp: new Date(2026, 2, 21, 14, 30),
    isRepeatCustomer: true,
    workerType: 0,
    amount: 1200,
    paymentStatus: "Paid",
  },
  {
    id: "v2",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Vikram Singh",
    customerPhone: "9871234567",
    rating: 4,
    comment: "Good work on bathroom fitting.",
    timestamp: new Date(2026, 2, 18, 10, 15),
    isRepeatCustomer: false,
    amount: 850,
    paymentStatus: "Paid",
  },
  {
    id: "v3",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Anita Sharma",
    customerPhone: "9988776655",
    rating: 5,
    comment: "Called again for kitchen work. Very reliable.",
    timestamp: new Date(2026, 2, 15, 9, 0),
    isRepeatCustomer: true,
    amount: 1500,
    paymentStatus: "Paid",
  },
  {
    id: "v4",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Priya Patel",
    customerPhone: "9812345678",
    rating: 4,
    comment: "Arrived on time, neat work.",
    timestamp: new Date(2026, 1, 28, 16, 0),
    isRepeatCustomer: false,
  },
  {
    id: "v5",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Suresh Mehta",
    customerPhone: "9800112233",
    rating: 3,
    comment: "Work was okay, took longer than expected.",
    timestamp: new Date(2026, 1, 20, 11, 30),
    isRepeatCustomer: false,
  },
  {
    id: "v6",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Kavita Joshi",
    customerPhone: "9876001122",
    rating: 5,
    comment: "Best plumber in the area!",
    timestamp: new Date(2026, 0, 15, 13, 45),
    isRepeatCustomer: false,
  },
  {
    id: "v7",
    workerId: "w1",
    workerName: "Ramesh Kumar",
    workerSkill: "Plumber",
    customerName: "Deepak Rao",
    customerPhone: "9845678901",
    rating: 4,
    comment: "Professional service.",
    timestamp: new Date(2026, 0, 8, 10, 0),
    isRepeatCustomer: false,
  },
];

export const MONTHLY_DATA: MonthlyData[] = [
  { month: "Oct", jobs: 3, rating: 4.2 },
  { month: "Nov", jobs: 5, rating: 4.5 },
  { month: "Dec", jobs: 4, rating: 4.3 },
  { month: "Jan", jobs: 2, rating: 4.5 },
  { month: "Feb", jobs: 2, rating: 3.5 },
  { month: "Mar", jobs: 3, rating: 4.7 },
];

export const getAverageRating = (verifications: Verification[]) => {
  if (verifications.length === 0) return 0;
  
  // Weighted Trust Score Calculation
  // - Repeat Customers (proxy for verified active users): High Weight (1.5x)
  // - Standard Customers: Normal Weight (1.0x)
  let totalWeight = 0;
  let weightedSum = 0;
  
  verifications.forEach((v) => {
    // Later this could include 'hasVerifiedPayment', 'userAccountAge', etc.
    const weight = v.isRepeatCustomer ? 1.5 : 1.0; 
    weightedSum += v.rating * weight;
    totalWeight += weight;
  });
  
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
};

export const getRepeatCustomers = (verifications: Verification[]) => {
  return verifications.filter((v) => v.isRepeatCustomer);
};

export const DEMO_DASHBOARD_DATA = {
  summary: { totalJobs: 12, activeMonths: 4, repeatCustomers: 3 },
  performance: { avgRating: 4.8, topSkills: ["Electrical", "Plumbing", "Fittings"], issues: [] },
  financial: {
    incomeRange: { min: 4500, max: 8500 },
    perJobIncome: 650,
    totalEarnings: 12500
  },
  confidence: "HIGH",
  loan: {
    safeEMI: 2400,
    range: { min: 25000, max: 45000 }
  },
  trust: {
    muktiScore: 92,
    fraudRisk: "LOW",
    riskIndicators: []
  }
};
