import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { z } from 'zod';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

app.use(cors());
app.use(express.json());

import fs from 'fs';
import path from 'path';

const LOCAL_REQUESTS_PATH = path.join(__dirname, '../data/requests.json');
const LOCAL_USERS_PATH = path.join(__dirname, '../data/users.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'));
}

// Helper for local storage
const saveLocalRequest = (data: any) => {
  let requests = [];
  if (fs.existsSync(LOCAL_REQUESTS_PATH)) {
    requests = JSON.parse(fs.readFileSync(LOCAL_REQUESTS_PATH, 'utf-8'));
  }
  const newReq = { ...data, id: `local-${Date.now()}` };
  requests.push(newReq);
  fs.writeFileSync(LOCAL_REQUESTS_PATH, JSON.stringify(requests, null, 2));
  return newReq;
};

const getLocalRequests = () => {
  if (fs.existsSync(LOCAL_REQUESTS_PATH)) {
    return JSON.parse(fs.readFileSync(LOCAL_REQUESTS_PATH, 'utf-8'));
  }
  return [];
};

const updateLocalRequest = (requestId: string, action: string) => {
  if (fs.existsSync(LOCAL_REQUESTS_PATH)) {
    let requests = JSON.parse(fs.readFileSync(LOCAL_REQUESTS_PATH, 'utf-8'));
    requests = requests.map((r: any) => 
      r.id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r
    );
    fs.writeFileSync(LOCAL_REQUESTS_PATH, JSON.stringify(requests, null, 2));
  }
};

const saveLocalUser = (userData: any) => {
  let users = [];
  if (fs.existsSync(LOCAL_USERS_PATH)) {
    users = JSON.parse(fs.readFileSync(LOCAL_USERS_PATH, 'utf-8'));
  }
  // Update if exists, otherwise add
  const idx = users.findIndex((u: any) => u.id === userData.id);
  if (idx > -1) {
    users[idx] = { ...users[idx], ...userData };
  } else {
    users.push(userData);
  }
  fs.writeFileSync(LOCAL_USERS_PATH, JSON.stringify(users, null, 2));
};

const getLocalUsers = () => {
  if (fs.existsSync(LOCAL_USERS_PATH)) {
    return JSON.parse(fs.readFileSync(LOCAL_USERS_PATH, 'utf-8'));
  }
  return [];
};

// Initialize Firebase Admin with absolute safety for local development
let db: admin.firestore.Firestore | null = null;
let isFirebaseEnabled = false;

try {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (projectId && credentialsPath && fs.existsSync(credentialsPath)) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(credentialsPath),
          projectId: projectId
        });
      }
      db = admin.firestore();
      isFirebaseEnabled = true;
      console.log('✅ Firebase Admin Initialized with Service Account');
    } catch (apiErr: any) {
      console.error('❌ Failed to initialize Firebase with credentials:', apiErr.message);
    }
  } else {
    console.warn('⚠️ Service Account missing or invalid. Backend running in LOCAL-MOCK mode.');
    console.log('   (To enable Firebase, add a valid JSON path to GOOGLE_APPLICATION_CREDENTIALS in .env)');
  }
} catch (err: any) {
  console.error('💥 Critical Boot Error:', err.message);
}

// --- SCHEMAS ---
const VerificationSchema = z.object({
  workerId: z.string(),
  jobId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  rating: z.number().min(1).max(5),
  review: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }),
  deviceId: z.string(),
});

const RegisterSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string(),
  role: z.enum(['worker', 'customer', 'admin']),
  skill: z.string().optional(),
  location: z.string().optional(),
  photo: z.string().optional(),
  workerType: z.number().optional(),
  declaredIncome: z.number().optional(),
});

// --- ROUTES ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Mukti-Backend' });
});

/**
 * Register Worker / User
 */
app.post('/api/worker/register', async (req, res) => {
  const database = db;
  if (!database) return res.status(503).json({ error: "Backend database not initialized" });
  try {
    const data = RegisterSchema.parse(req.body);
    const userRef = database.collection('users').doc(data.id);
    
    const newUser = {
      ...data,
      otpVerified: true,
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      muktiScore: 0,
      status: data.role === 'worker' ? 'pending' : undefined,
      isVerifiedByAdmin: data.role === 'worker' ? false : (data.role === 'admin' ? true : undefined),
    };

    await userRef.set(newUser);
    saveLocalUser(newUser);
    res.json({ success: true, user: newUser });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(400).json({ error: 'Registration failed' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    let allUsers = [...getLocalUsers()];

    if (db) {
      const firebaseFetch = db.collection('users')
        .get()
        .then(snapshot => {
          snapshot.docs.forEach(doc => {
            if (!allUsers.find(u => u.id === doc.id)) {
              allUsers.push({ id: doc.id, ...doc.data() });
            }
          });
        })
        .catch(err => console.warn('Firestore users fetch failed:', err.message));

      await Promise.race([
        firebaseFetch,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    }
    
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Submit Verification
 * 1. Validate Input
 * 2. Call ML Service for Fraud Detection
 * 3. Call ML Service for NLP Analysis
 * 4. Store in Firestore
 */
app.post('/api/verify', async (req, res) => {
  const database = db;
  if (!database) return res.status(503).json({ error: "Backend database not initialized" });
  try {
    const data = VerificationSchema.parse(req.body);
    
    // 1. Fraud Detection
    const fraudResponse = await axios.post(`${ML_SERVICE_URL}/fraud-detect`, {
      worker_id: data.workerId,
      customer_id: data.customerId,
      device_id: data.deviceId,
      location: data.location,
      timestamp: new Date().toISOString(),
    });
    
    const { risk_score, fraud_risk } = fraudResponse.data;

    // 2. NLP Analysis
    const nlpResponse = await axios.post(`${ML_SERVICE_URL}/nlp-analyze`, {
      text: data.review
    });

    const { sentiment, sentiment_label, extracted_skills, review_quality } = nlpResponse.data;

    // 3. Store in Firestore
    const verificationDoc = {
      ...data,
      fraudRisk: fraud_risk,
      riskScore: risk_score,
      sentiment: sentiment_label,
      sentimentScore: sentiment,
      skills: extracted_skills,
      qualityScore: review_quality,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await database.collection('verifications').add(verificationDoc);

    // 4. Update Worker Score (Simplified logic for demo)
    const workerRef = database.collection('users').doc(data.workerId);
    await workerRef.update({
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      verificationsCount: admin.firestore.FieldValue.increment(1)
    });

    res.json({
      success: true,
      id: docRef.id,
      analysis: {
        fraud_risk,
        sentiment: sentiment_label,
        skills: extracted_skills
      }
    });

  } catch (err: any) {
    console.error('Verification Error:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Get Worker Dashboard Data
 */
app.get('/api/worker/:id/dashboard', async (req, res) => {
  const database = db;
  if (!database) return res.status(503).json({ error: "Backend database not initialized" });
  try {
    const workerId = req.params.id;
    const workerDoc = await database.collection('users').doc(workerId).get();
    const verificationsSnapshot = await database.collection('verifications')
      .where('workerId', '==', workerId)
      .get();

    const worker = workerDoc.exists ? workerDoc.data() : null;
    const verifications = verificationsSnapshot.docs.map(doc => doc.data());
    
    // --- 1. WORK SUMMARY ---
    const totalJobs = verifications.length;
    const activeMonths = new Set(verifications.map(v => {
      let date: Date;
      if (v.timestamp?.toDate) {
        date = v.timestamp.toDate();
      } else if (v.timestamp) {
        date = new Date(v.timestamp);
      } else {
        return "unknown"; // Handle missing timestamp
      }
      
      if (isNaN(date.getTime())) return "unknown";
      return `${date.getMonth()}-${date.getFullYear()}`;
    })).size || (totalJobs > 0 ? 1 : 0);
    
    const customerIds = verifications.map(v => v.customerId);
    const repeatCustomers = customerIds.filter((id, index) => customerIds.indexOf(id) !== index).length;

    // --- 2. PERFORMANCE INSIGHTS ---
    const avgRating = totalJobs > 0 
      ? verifications.reduce((acc, v) => acc + (v.rating || 0), 0) / totalJobs 
      : 0;
    
    // Extract top skills from NLP data in verifications
    const skillCounts: Record<string, number> = {};
    verifications.forEach(v => {
      (v.skills || []).forEach((s: string) => {
        skillCounts[s] = (skillCounts[s] || 0) + 1;
      });
    });
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill]) => skill);

    // --- 3. FINANCIAL PROFILE (INCOME ESTIMATION) ---
    let baseRate = 500; // Default
    const skillLower = (worker?.skill || "").toLowerCase();
    if (skillLower.includes('maid')) baseRate = 300;
    else if (skillLower.includes('plumber')) baseRate = 600;
    else if (skillLower.includes('electrician')) baseRate = 800;

    let adjustments = 0;
    if (avgRating > 4.5) adjustments += 50;
    if (worker?.location?.toLowerCase().includes('city') || worker?.location?.toLowerCase().includes('delhi') || worker?.location?.toLowerCase().includes('mumbai')) {
      adjustments += 100;
    }

    const perJobIncome = baseRate + adjustments;
    // For a more realistic estimate, we might want jobs per month
    const avgJobsPerMonth = activeMonths > 0 ? totalJobs / activeMonths : totalJobs;
    const realisticMonthlyIncome = avgJobsPerMonth * perJobIncome;

    // --- 4. CONFIDENCE SCORE ---
    let confidencePoints = 0;
    if (totalJobs > 10) confidencePoints += 30;
    if (activeMonths > 3) confidencePoints += 30;
    if (avgRating > 4.0) confidencePoints += 20;
    
    let confidence = "LOW";
    if (confidencePoints > 70) confidence = "HIGH";
    else if (confidencePoints > 40) confidence = "MEDIUM";

    // --- 5. LOAN ELIGIBILITY ---
    const safeEMI = realisticMonthlyIncome * 0.35;
    const minLoan = safeEMI * 12;
    const maxLoan = safeEMI * 18;

    // --- 6. TRUST & FRAUD ---
    const fraudRisk = verifications.some(v => v.fraudRisk === 'HIGH') ? 'HIGH' : (verifications.some(v => v.fraudRisk === 'MEDIUM') ? 'MEDIUM' : 'LOW');
    const muktiScore = Math.min(100, Math.max(0, (avgRating * 20) + (confidencePoints * 0.2)));

    const riskIndicators = [];
    if (verifications.some(v => v.riskScore > 0.7)) riskIndicators.push("Location inconsistency");
    if (totalJobs > 50 && activeMonths < 2) riskIndicators.push("High review frequency");

    res.json({
      summary: { totalJobs, activeMonths, repeatCustomers },
      performance: { avgRating: Number(avgRating.toFixed(2)), topSkills, issues: [] },
      financial: {
        incomeRange: { 
          min: Math.floor(realisticMonthlyIncome * 0.8) || 0, 
          max: Math.ceil(realisticMonthlyIncome * 1.2) || 0 
        },
        perJobIncome
      },
      confidence,
      loan: {
        safeEMI: Math.floor(safeEMI) || 0,
        range: { min: Math.floor(minLoan) || 0, max: Math.ceil(maxLoan) || 0 }
      },
      trust: {
        muktiScore: Number(muktiScore.toFixed(2)),
        fraudRisk,
        riskIndicators
      }
    });

  } catch (err: any) {
    console.error(`Dashboard API Error [Worker: ${req.params.id}]:`, err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data', message: err.message });
  }
});

/**
 * Generate PDF Report (Credit-Ready)
 */
app.get('/api/worker/:id/report', async (req, res) => {
  const database = db;
  if (!database) return res.status(503).json({ error: "Backend database not initialized" });
  try {
    const workerId = req.params.id;
    const workerDoc = await database.collection('users').doc(workerId).get();
    const verificationsSnapshot = await database.collection('verifications')
      .where('workerId', '==', workerId)
      .orderBy('timestamp', 'desc')
      .get();

    const worker = workerDoc.data();
    const verifications = verificationsSnapshot.docs.map(doc => doc.data());

    // In a real app, use PDFKit here to generate a buffer and stream it.
    // For now, we return the data structure that the frontend can render as a "Report View"
    // or we can implement a basic PDF stream if needed.
    
    res.json({
      title: "Credit-Ready Work Summary",
      generatedAt: new Date().toISOString(),
      worker: {
        id: worker?.id,
        name: worker?.name,
        skill: worker?.skill,
        phone: worker?.phone,
        muktiScore: worker?.muktiScore || 85, // Placeholder
      },
      summary: {
        totalJobs: verifications.length,
        avgRating: verifications.reduce((acc, v) => acc + v.rating, 0) / (verifications.length || 1),
        fraudRiskLevel: "LOW",
        sentimentSummary: "Highly Positive",
      },
      history: verifications.map(v => ({
        date: v.timestamp?.toDate ? v.timestamp.toDate() : v.timestamp,
        customer: v.customerName,
        rating: v.rating,
        skills: v.skills,
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report data' });
  }
});

/**
 * --- VERIFICATION REQUESTS (Manual Flow) ---
 */

// 1. Create Request (Worker)
app.post('/api/worker/verify-request', async (req, res) => {
  try {
    const { workerId, workerName, workerPhone, workerSkill } = req.body;
    const requestDoc: any = {
      workerId,
      workerName,
      workerPhone,
      workerSkill: workerSkill || "Not Specified",
      status: "pending",
      timestamp: new Date().toISOString()
    };

    let result;
    if (db) {
      try {
        const fbDoc = { ...requestDoc, timestamp: admin.firestore.FieldValue.serverTimestamp() };
        const docRef = await db.collection('verification_requests').add(fbDoc);
        
        // Also attempt to update user status in Firestore
        try {
          await db.collection('users').doc(workerId).update({ status: 'pending' });
          console.log(`Backend updated user ${workerId} status to pending`);
        } catch (uErr: any) {
          console.warn(`Backend could not update user status: ${uErr.message}`);
        }

        result = { id: docRef.id, ...requestDoc };
      } catch (err) {
        console.warn('Firestore write failed, falling back to local storage.');
        result = saveLocalRequest(requestDoc);
        
        // Even if collection write failed, we might still be able to update user doc? 
        // (Unlikely if credentials are missing, but good for completeness)
        try {
          await db?.collection('users').doc(workerId).update({ status: 'pending' });
        } catch (sErr) {}
      }
    } else {
      result = saveLocalRequest(requestDoc);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Create Request Error:', err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.get('/api/worker/:workerId/verification-status', async (req, res) => {
  try {
    const { workerId } = req.params;
    let status = 'none';

    // 1. Check Local Fallback (Immediate)
    const localReqs = getLocalRequests();
    const myLocalReq = localReqs.find((r: any) => r.workerId === workerId);
    if (myLocalReq) {
      status = myLocalReq.status;
    }

    // 2. Check Firestore (Concurrent with 3s timeout)
    if (db) {
      const firebaseFetch = db.collection('verification_requests')
        .where('workerId', '==', workerId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then(snap => {
          if (!snap.empty) {
            status = snap.docs[0].data().status;
          }
        })
        .catch(err => console.warn('Worker status Firestore failed:', err.message));

      await Promise.race([
        firebaseFetch,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    }

    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// 2. Get Pending Requests (Admin)
app.get('/api/admin/requests', async (req, res) => {
  try {
    const allRequests = [...getLocalRequests()];

    if (db) {
      // Fetch Firestore concurrently with a 3s timeout
      const firebaseFetch = db.collection('verification_requests')
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
          snapshot.docs.forEach(doc => {
            if (!allRequests.find(r => r.id === doc.id)) {
              allRequests.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : doc.data().timestamp
              });
            }
          });
        })
        .catch(err => console.warn('Firestore fetch failed:', err.message));

      // Wait max 3 seconds for Firestore, then return what we have (including local)
      await Promise.race([
        firebaseFetch,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    }
    
    res.json(allRequests.filter(r => r.status === 'pending'));
  } catch (err) {
    console.error('Fetch Requests Error:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// 3. Process Request (Admin)
app.post('/api/admin/process-request', async (req, res) => {
  try {
    const { requestId, workerId, action, source } = req.body; 
    console.log(`[ADMIN-ACTION] Action: ${action}, Request: ${requestId}, Worker: ${workerId}, Source: ${source}`);
    
    if (!workerId) {
      console.error('Missing workerId in request body');
      return res.status(400).json({ error: 'Missing workerId' });
    }

    const database = db;
    
    // 1. Handle Local
    if (requestId.startsWith('local-')) {
      updateLocalRequest(requestId, action);
    }

    // 2. Handle Firestore (Only if fully enabled)
    if (isFirebaseEnabled && database) {
      try {
        const userRef = database.collection('users').doc(workerId);
        const newStatus = action === 'approve' ? 'verified' : 'not verified';
        
        console.log(`[FIREBASE-ADMIN] Attempting update for user ${workerId}...`);
        
        // Update User Profile
        await userRef.update({
          status: newStatus,
          isVerifiedByAdmin: action === 'approve',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update/Delete Request Document
        if (source === 'collection' && !requestId.startsWith('usr-') && !requestId.startsWith('local-')) {
          const requestRef = database.collection('verification_requests').doc(requestId);
          if (action === 'approve') {
            await requestRef.update({
              status: 'verified',
              processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } else {
            await requestRef.delete();
          }
        }
        console.log(`[FIREBASE-ADMIN] Successfully updated user ${workerId}`);
      } catch (fbErr: any) {
        console.error('[FIREBASE-ADMIN-ERROR]:', fbErr.message);
        // We DON'T throw here so the response can still return success (local only)
        // or we return a warning.
      }
    }
    
    res.json({ success: true, message: `Worker ${action === 'approve' ? 'verified' : 'rejected'} successfully (Backend Processed).` });
  } catch (err: any) {
    console.error('[CRITICAL-BACKEND-ERROR]:', err);
    res.status(500).json({ error: 'Failed to process request', details: err.message });
  }
});

// 4. Clear All Requests (Admin)
app.post('/api/admin/clear-all-requests', async (req, res) => {
  try {
    // 1. Clear Local
    fs.writeFileSync(LOCAL_REQUESTS_PATH, JSON.stringify([], null, 2));

    // 2. Clear Firestore (Only if fully enabled)
    if (isFirebaseEnabled && db) {
      const snapshot = await db.collection('verification_requests').get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    res.json({ success: true, message: "All requests purged successfully" });
  } catch (err) {
    console.error('Clear All Error:', err);
    res.status(500).json({ error: 'Failed to clear requests' });
  }
});

// 5. Reset All Worker Status (Admin)
app.post('/api/admin/reset-workers-status', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const snapshot = await db.collection('users').where('role', '==', 'worker').get();
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
        isVerifiedByAdmin: false,
        status: "pending" 
      });
    });
    
    await batch.commit();
    res.json({ success: true, count: snapshot.size });
  } catch (err) {
    console.error('Reset Workers Error:', err);
    res.status(500).json({ error: 'Failed to reset workers' });
  }
});

// ═══════════════════════════════════════════════════════════
//  WORK REQUESTS (Customer ↔ Worker Job Marketplace)
// ═══════════════════════════════════════════════════════════

const LOCAL_WORK_REQUESTS_PATH = path.join(__dirname, '../data/work_requests.json');

const getLocalWorkRequests = () => {
  if (fs.existsSync(LOCAL_WORK_REQUESTS_PATH)) {
    return JSON.parse(fs.readFileSync(LOCAL_WORK_REQUESTS_PATH, 'utf-8'));
  }
  return [];
};

const saveLocalWorkRequest = (data: any) => {
  const requests = getLocalWorkRequests();
  const newReq = { ...data, id: `local-wr-${Date.now()}` };
  requests.push(newReq);
  fs.writeFileSync(LOCAL_WORK_REQUESTS_PATH, JSON.stringify(requests, null, 2));
  return newReq;
};

// 1. Create Work Request (Customer)
app.post('/api/work-request', async (req, res) => {
  try {
    const data = req.body;
    console.log('[WORK-REQUEST] New request:', data.service, 'from', data.customerName);

    let result: any = null;

    // Try Firestore (Admin SDK bypasses security rules)
    if (isFirebaseEnabled && db) {
      try {
        const firestorePayload = {
          ...data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Remove any client-side createdAt string
        delete firestorePayload.createdAt;
        firestorePayload.createdAt = admin.firestore.FieldValue.serverTimestamp();

        const docRef = await db.collection('work_requests').add(firestorePayload);
        result = { id: docRef.id, ...data };
        console.log('✅ Work request saved to Firestore:', docRef.id);
      } catch (fbErr: any) {
        console.warn('⚠️ Firestore write failed:', fbErr.message);
      }
    }

    // Fallback: Local file storage
    if (!result) {
      result = saveLocalWorkRequest({ ...data, createdAt: new Date().toISOString() });
      console.log('✅ Work request saved locally:', result.id);
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[WORK-REQUEST-ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to create work request' });
  }
});

// 2. Get All Work Requests (Worker dashboard feed)
app.get('/api/work-requests', async (req, res) => {
  try {
    let allRequests = [...getLocalWorkRequests()];

    if (isFirebaseEnabled && db) {
      try {
        const snapshot = await db.collection('work_requests')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();

        snapshot.docs.forEach(doc => {
          if (!allRequests.find((r: any) => r.id === doc.id)) {
            const data = doc.data();
            allRequests.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() || data.createdAt,
            });
          }
        });
      } catch (fbErr: any) {
        console.warn('⚠️ Firestore read failed:', fbErr.message);
      }
    }

    res.json(allRequests);
  } catch (err: any) {
    console.error('[WORK-REQUESTS-LIST-ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to fetch work requests' });
  }
});

// 3. Get Single Work Request by ID (for LiveTracking fallback)
app.get('/api/work-request/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try Firestore first
    if (isFirebaseEnabled && db && !id.startsWith('local-')) {
      try {
        const docSnap = await db.collection('work_requests').doc(id).get();
        if (docSnap.exists) {
          const data = docSnap.data()!;
          return res.json({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            acceptedAt: data.acceptedAt?.toDate?.() || data.acceptedAt,
          });
        }
      } catch (fbErr: any) {
        console.warn('⚠️ Firestore single read failed:', fbErr.message);
      }
    }

    // Fallback: local storage
    const local = getLocalWorkRequests().find((r: any) => r.id === id);
    if (local) return res.json(local);

    res.status(404).json({ error: 'Work request not found' });
  } catch (err: any) {
    console.error('[WORK-REQUEST-GET-ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to fetch work request' });
  }
});

// 4. Accept / Update Work Request (Worker)
app.put('/api/work-request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log('[WORK-REQUEST-UPDATE] ID:', id, 'Data:', updateData);

    // Update in Firestore
    if (isFirebaseEnabled && db && !id.startsWith('local-')) {
      try {
        await db.collection('work_requests').doc(id).update({
          ...updateData,
          ...(updateData.status === 'Accepted' ? { acceptedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
          ...(updateData.status === 'Completed' ? { completedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
        });
        console.log('✅ Work request updated in Firestore');
      } catch (fbErr: any) {
        console.warn('⚠️ Firestore update failed:', fbErr.message);
      }
    }

    // Update locally
    if (id.startsWith('local-')) {
      const requests = getLocalWorkRequests();
      const updated = requests.map((r: any) => r.id === id ? { ...r, ...updateData } : r);
      fs.writeFileSync(LOCAL_WORK_REQUESTS_PATH, JSON.stringify(updated, null, 2));
    }

    res.json({ success: true, message: 'Work request updated' });
  } catch (err: any) {
    console.error('[WORK-REQUEST-UPDATE-ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to update work request' });
  }
});

app.listen(PORT, () => {
  console.log(`Mukti-Backend running on http://localhost:${PORT}`);
});
