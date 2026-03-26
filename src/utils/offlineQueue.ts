import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const QUEUE_KEY = 'mukti_offline_reviews';

export interface OfflineReview {
  workerId: string;
  customerId: string;
  workerName: string;
  workerSkill: string;
  rating: number;
  comment: string;
  location: string;
  deviceId: string;
  timestamp: string; // ISO string since we can't serialize Date to localStorage
  customer_type: number;
  nlp?: any;
}

// Save a review to localStorage when offline
export const queueOfflineReview = (review: OfflineReview): void => {
  const existing = getQueuedReviews();
  existing.push(review);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
};

// Get all queued reviews
export const getQueuedReviews = (): OfflineReview[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Sync all queued reviews to Firebase
export const syncOfflineReviews = async (): Promise<number> => {
  const queued = getQueuedReviews();
  if (queued.length === 0) return 0;

  let synced = 0;
  const failed: OfflineReview[] = [];

  for (const review of queued) {
    try {
      await addDoc(collection(db, 'verifications'), {
        ...review,
        timestamp: serverTimestamp(),
        syncedFromOffline: true,
        originalTimestamp: review.timestamp,
      });
      synced++;
    } catch (err) {
      console.error('Failed to sync offline review:', err);
      failed.push(review);
    }
  }

  // Keep only failed ones in queue
  localStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  return synced;
};

// Get count of pending offline reviews
export const getOfflineQueueCount = (): number => {
  return getQueuedReviews().length;
};

// Clear the offline queue (after successful sync)
export const clearOfflineQueue = (): void => {
  localStorage.removeItem(QUEUE_KEY);
};
