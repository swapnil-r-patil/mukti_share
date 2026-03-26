import { User } from "@/types/auth";
import { NLPResult } from "@/utils/nlpProcessor";

export interface VerificationRecord {
  workerId: string;
  customerId: string;
  timestamp: Date;
  location?: string;
  deviceId?: string;
  rating: number;
  comment: string;
  workerType?: 0 | 1; // 0: Regular (Monthly), 1: One-time (Dynamic)
  // ── New fields ──
  geoVerified?: boolean;
  customerLat?: number;
  customerLng?: number;
  photoUrl?: string;
  imageHash?: string;
  fraudFlag?: boolean;
  fraudReason?: string;
  trustScore?: number;
  nlp?: NLPResult;
}

// ═══════════════════════════════════════════════════════
// CUSTOMER CLASSIFICATION
// ═══════════════════════════════════════════════════════

/**
 * Classifies a customer based on interaction history.
 * 0: Long-term (Same worker reviewed more than 5 times)
 * 1: Occasional (Regular use or initial engagements)
 */
export const classifyCustomer = (verifications: VerificationRecord[]): 0 | 1 => {
  if (verifications.length === 0) return 1;

  const workerCounts: Record<string, number> = {};
  verifications.forEach((v) => {
    workerCounts[v.workerId] = (workerCounts[v.workerId] || 0) + 1;
  });

  const maxReviewsForOneWorker = Math.max(...Object.values(workerCounts));
  return maxReviewsForOneWorker > 5 ? 0 : 1;
};

// ═══════════════════════════════════════════════════════
// TRUST SCORE ENGINE (0–100)
// ═══════════════════════════════════════════════════════
//
// ┌─────────────────────────┬────────┐
// │ Factor                  │ Points │
// ├─────────────────────────┼────────┤
// │ OTP verified            │  +20   │
// │ Geo verified            │  +20   │
// │ Photo (one-time worker) │  +25   │
// │ Photo (regular, <7d)    │  +10   │
// │ Repeat customer         │  +10   │
// │ Good rating (≥4)        │  +10   │
// │ Poor rating (<3)        │   -5   │
// │ Good NLP comment        │   +5   │
// │ Spam / low comment      │  -10   │
// │ Duplicate image fraud   │  -30   │
// │ Geo mismatch fraud      │  -25   │
// │ Too-frequent jobs       │  -20   │
// └─────────────────────────┴────────┘

export const calculateTrustScore = (
  user: User,
  verifications: VerificationRecord[]
): number => {
  let score = 0;

  // ── OTP verification (+20) ──
  if (user.otpVerified) score += 20;

  // ── Data Density (For both, but critical for Workers) ──
  if (verifications.length > 0) {
    if (verifications.length >= 20) score += 15;
    else if (verifications.length >= 5) score += 10;
    else score += 5;
  }

  // ── Geo verification (+15) ──
  const latestV = verifications[0];
  if (latestV?.geoVerified) score += 15;

  // ── Photo verification (Weight: 20) ──
  if (latestV) {
    const workerType = latestV.workerType ?? 1;
    if (workerType === 1) {
      // One-time worker: photo present → +20
      if (latestV.photoUrl) score += 20;
    } else {
      // Regular worker: recent photo (<7 days) → +10
      if (latestV.photoUrl) {
        const daysSinceVerification =
          (Date.now() - latestV.timestamp.getTime()) / (1000 * 3600 * 24);
        if (daysSinceVerification <= 7) score += 10;
      }
    }
  }

  // ── Role Specifics ──
  if (user.role === 'customer') {
    // Customers get points for variety of workers verified (+10)
    const workerIds = new Set(verifications.map(v => v.workerId));
    if (workerIds.size >= 3) score += 10;
  } else {
    // Workers get points for repeat customers (+10)
    const customerIds = verifications.map(v => v.customerId);
    const hasRepeat = customerIds.filter((id, i) => customerIds.indexOf(id) !== i).length > 0;
    if (hasRepeat) score += 10;
  }

  // ── Rating-based scoring (Weight: 15) ──
  if (verifications.length > 0) {
    const avgRating =
      verifications.reduce((sum, v) => sum + (v.rating || 0), 0) /
      verifications.length;
    if (avgRating >= 4.5) score += 15;
    else if (avgRating >= 4.0) score += 10;
    else if (avgRating < 3) score -= 10;
  }

  // ── NLP quality (& Negative Sentiment) ──
  if (latestV?.nlp) {
    if (latestV.nlp.quality === "high" && latestV.nlp.sentiment === "positive") {
      score += 5;
    } else if (latestV.nlp.sentiment === "negative") {
      score -= 15;
    }
  }

  // ── Fraud penalties (Heavy) ──
  verifications.forEach((v) => {
    if (v.fraudFlag) {
      if (v.fraudReason?.toLowerCase().includes("duplicate image")) score -= 40;
      else if (v.fraudReason?.toLowerCase().includes("location mismatch")) score -= 30;
      else if (v.fraudReason?.toLowerCase().includes("too frequent")) score -= 20;
      else score -= 15; 
    }
  });

  return Math.max(0, Math.min(100, score));
};

// ═══════════════════════════════════════════════════════
// TRUST LEVEL HELPERS
// ═══════════════════════════════════════════════════════

export const getTrustLevel = (
  score: number
): "HIGH TRUST" | "MEDIUM TRUST" | "SUSPICIOUS" => {
  if (score >= 80) return "HIGH TRUST";
  if (score >= 50) return "MEDIUM TRUST";
  return "SUSPICIOUS";
};

export const getTrustBadgeColor = (score: number): string => {
  if (score >= 80)
    return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  if (score >= 50)
    return "text-orange-500 bg-orange-500/10 border-orange-500/20";
  return "text-red-500 bg-red-500/10 border-red-500/20";
};

// ═══════════════════════════════════════════════════════
// FRAUD DETECTION
// ═══════════════════════════════════════════════════════

export const detectFraud = (
  newV: VerificationRecord,
  history: VerificationRecord[]
): string | null => {
  const customerType = classifyCustomer(history);

  // Rule 1: 7-day cooldown for reviewing SAME worker (Universal)
  const sameWorkerPrev = history.find((v) => v.workerId === newV.workerId);
  if (sameWorkerPrev) {
    const daysDiff =
      (newV.timestamp.getTime() - sameWorkerPrev.timestamp.getTime()) /
      (1000 * 3600 * 24);
    if (daysDiff < 7)
      return "Review frequency too high for this worker (Min 7 days).";
  }

  // Rule 2: Behavior-based checks
  if (customerType === 0) {
    // Long-term: suspicious if reviewing multiple workers in short time
    const workersInLast30Days = new Set(
      history
        .filter((v) => {
          const diff =
            (newV.timestamp.getTime() - v.timestamp.getTime()) /
            (1000 * 3600 * 24);
          return diff < 30;
        })
        .map((v) => v.workerId)
    );
    if (workersInLast30Days.size > 3) {
      return "Suspicious worker variety for a Long-term account.";
    }
  } else {
    // Occasional: suspicious if reviewing same worker repeatedly on new account
    const reviewsForThisWorker = history.filter(
      (v) => v.workerId === newV.workerId
    ).length;
    if (reviewsForThisWorker > 2 && history.length < 5) {
      return "Bulk reviews for same worker detected on new account.";
    }
  }

  // Rule 3: Daily limit (Universal)
  const todayVerifications = history.filter(
    (v) => v.timestamp.toDateString() === newV.timestamp.toDateString()
  );
  if (todayVerifications.length >= 3) return "Daily review limit exceeded.";

  // Rule 4: Suspicious Velocity
  if (history.length > 0) {
    const lastV = history[0];
    const timeDiffHours =
      (newV.timestamp.getTime() - lastV.timestamp.getTime()) / (1000 * 3600);
    if (
      timeDiffHours < 1 &&
      newV.location !== lastV.location &&
      !newV.location?.includes("Demo")
    ) {
      return "Inconsistent location sequence detected.";
    }
  }

  // Rule 5: Geo mismatch — if geo was checked and failed
  if (newV.geoVerified === false) {
    return "Location mismatch. Please verify at the work location.";
  }

  // Rule 6: Duplicate image flag (set by imageHasher before calling detectFraud)
  if (newV.fraudFlag && newV.fraudReason) {
    return newV.fraudReason;
  }

  return null;
};
