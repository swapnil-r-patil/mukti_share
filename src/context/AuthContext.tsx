import React, { createContext, useState, ReactNode, useEffect } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { getDeviceId, isSessionValid } from "@/utils/device";
import { getCurrentPosition, reverseGeocode } from "@/utils/geoValidator";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  updateDoc, 
  increment, 
  arrayUnion,
  Timestamp,
  serverTimestamp,
  collection,
  addDoc
} from "firebase/firestore";
import { User, UserRole, WorkerType } from "@/types/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phone: string, password?: string) => Promise<void>;
  signup: (phone: string, role: UserRole, name: string, password?: string, skill?: string, location?: string, photo?: string, workerType?: WorkerType, employerName?: string, employerPhone?: string, locationCoords?: {lat: number, lng: number}) => Promise<void>;
  signInWithGoogle: (role: UserRole) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  addPoints: (amount: number, badgeStr?: string) => Promise<void>;
  logout: () => Promise<void>;
  syncLocation: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = "http://localhost:5000";
const phoneToEmail = (phone: string) => `${phone}@mukti.com`;
const cleanObject = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) delete newObj[key];
  });
  return newObj;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // Check for persisted demo session
    const persistedDemo = localStorage.getItem("mukti_demo_user");
    if (persistedDemo) {
      try {
        const demoData = JSON.parse(persistedDemo);
        setUser({
          ...demoData,
          isDemo: true, // Ensure it's treated as demo
          lastActive: new Date(demoData.lastActive)
        });
        setLoading(false);
      } catch (e) {
        console.error("Failed to parse persisted demo user", e);
      }
    }

    // --- Vercel Reliability Hotfix: Loading Safety Timeout ---
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn("Auth initialization timed out (5s). Forcing load sequence...");
        // Check for missing config which is the #1 cause for Vercel hangs
        if (!import.meta.env.VITE_FIREBASE_API_KEY) {
          setInitError("Firebase Config Missing: Please add VITE_FIREBASE_API_KEY to Vercel Environment Variables.");
        }
        setLoading(false);
      }
    }, 5000);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeoutId);
      if (firebaseUser) {
        // If we have a firebase user, clear demo session
        localStorage.removeItem("mukti_demo_user");
        
        // Real-time listener for user profile (with initial getDoc for robustness)
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        const syncUser = async () => {
          try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              const lastOtp = data.lastOtpDate ? (data.lastOtpDate as Timestamp).toDate() : null;
              
              const isAdmin = firebaseUser.email === "astrotopg@gmail.com";
              
              setUser({
                ...data,
                id: firebaseUser.uid,
                role: isAdmin ? "admin" : data.role,
                isDemo: false,
                lastActive: data.lastActive ? (data.lastActive as Timestamp).toDate() : new Date(),
                lastOtpDate: lastOtp,
              } as User);
            }
          } catch (err) {
            console.warn("Initial user fetch failed, trying listener...", err);
          } finally {
            setLoading(false);
          }
        };

        syncUser();

        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser(prev => prev ? { ...prev, ...data } : { ...data, id: firebaseUser.uid } as User);
          }
        }, (err) => {
          console.warn("User profile sync listener inhibited (Permission/Rule):", err.message);
        });

        return () => unsubscribeUser();
      } else if (!localStorage.getItem("mukti_demo_user")) {
        // Only set null if no demo user exists
        setUser(null);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => {
      clearTimeout(timeoutId);
      unsubscribeAuth();
    };
  }, []);

  // Auto-sync location when user is loaded
  useEffect(() => {
    if (user && !user.isDemo) {
      syncLocation();
    }
  }, [user?.id]);

  async function syncLocation() {
    if (!user || user.isDemo) return;
    try {
      const pos = await getCurrentPosition();
      const city = await reverseGeocode(pos.lat, pos.lng);
      
      await updateDoc(doc(db, "users", user.id), {
        location: city,
        location_coords: { lat: pos.lat, lng: pos.lng },
        lastActive: serverTimestamp()
      });
      
      setUser(prev => prev ? { ...prev, location: city, location_coords: { lat: pos.lat, lng: pos.lng } } : null);
    } catch (err) {
      console.warn("Location sync failed:", err);
    }
  }

  async function login(phone: string, password?: string) {
    if ((phone === "1234567891" || phone === "1234567890" || phone === "1234567892") && password === "123456") {
      const isWorker = phone === "1234567891";
      const isAdmin = phone === "1234567892";
      const demoUser: User = {
        id: isAdmin ? "demo-admin-id" : (isWorker ? "demo-worker-id" : "demo-customer-id"),
        phone,
        name: isAdmin ? "Admin Mukti" : (isWorker ? "Ramesh Kumar" : "Suresh Sharma"),
        role: isAdmin ? "admin" : (isWorker ? "worker" : "customer"),
        workerType: isWorker ? 1 : undefined,
        skill: isWorker ? "Electrician & Plumber" : undefined,
        location: "Patna, Bihar",
        location_coords: { lat: 25.5941, lng: 85.1376 },
        otpVerified: true,
        lastActive: new Date(),
        lastOtpDate: new Date(),
        createdAt: new Date(),
        deviceId: getDeviceId(),
        muktiScore: isAdmin ? 100 : 88,
        trustScore: isAdmin ? 100 : 92,
        points: isWorker || isAdmin ? undefined : 250,
        badges: isWorker || isAdmin ? undefined : ["Early Adopter"],
        isDemo: true,
        isVerifiedByAdmin: isWorker ? true : undefined, // Ramesh is verified for demo
      };
      setUser(demoUser);
      localStorage.setItem("mukti_demo_user", JSON.stringify(demoUser));
      return;
    }
    const result = await signInWithEmailAndPassword(auth, phoneToEmail(phone), password || "password123");
    
    // Update device ID on successful login if it's a customer
    const userDoc = await getDoc(doc(db, "users", result.user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.role === "customer") {
        const currentDeviceId = getDeviceId();
        await updateDoc(doc(db, "users", result.user.uid), {
          deviceId: currentDeviceId,
          lastOtpDate: serverTimestamp(),
          otpVerified: true // Set to true since they just logged in with password/google
        });
      }
    }
  }

  async function signInWithGoogle(role: UserRole) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      const isAdmin = firebaseUser.email === "astrotopg@gmail.com";
      const assignedRole = isAdmin ? "admin" : role;

      if (!userDoc.exists()) {
        const newUser: any = {
          phone: firebaseUser.phoneNumber || "Google User",
          email: firebaseUser.email,
          name: firebaseUser.displayName || "Google User",
          role: assignedRole,
          status: assignedRole === "worker" ? "not verified" : undefined,
          isVerifiedByAdmin: assignedRole === "worker" ? false : undefined,
          otpVerified: true,
          lastActive: new Date(),
          createdAt: new Date(),
          points: assignedRole === "customer" ? 0 : undefined,
          badges: assignedRole === "customer" ? [] : undefined,
        };
        await setDoc(userDocRef, cleanObject({
          ...newUser,
          lastActive: Timestamp.fromDate(new Date()),
        }));

        setUser({ ...newUser, id: firebaseUser.uid, isDemo: false } as User);
      } else {
        const data = userDoc.data();
        if (isAdmin) {
          await updateDoc(userDocRef, { role: "admin" });
          setUser({ 
            ...data, 
            id: firebaseUser.uid, 
            role: "admin", 
            isDemo: false,
            lastActive: data.lastActive ? (data.lastActive as Timestamp).toDate() : new Date(),
          } as User);
        } else {
          setUser({ 
            ...data, 
            id: firebaseUser.uid, 
            isDemo: false,
            lastActive: data.lastActive ? (data.lastActive as Timestamp).toDate() : new Date(),
          } as User);
        }
      }
    } catch (error: any) {
      throw error;
    }
  }

  async function signup(
    phone: string, 
    role: UserRole, 
    name: string, 
    password?: string, 
    skill?: string, 
    location?: string, 
    photo?: string,
    workerType?: WorkerType,
    employerName?: string,
    employerPhone?: string,
    locationCoords?: {lat: number, lng: number}
  ) {
    let firebaseUser;
    try {
      const result = await createUserWithEmailAndPassword(auth, phoneToEmail(phone), password || "password123");
      firebaseUser = result.user;
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        // Just log them in instead of failing
        const result = await signInWithEmailAndPassword(auth, phoneToEmail(phone), password || "password123");
        firebaseUser = result.user;
      } else {
        throw err;
      }
    }

    const newUser: any = { 
      id: firebaseUser.uid, 
      phone, 
      name, 
      role, 
      skill, 
      location: location || "Unknown", 
      location_coords: locationCoords || null,
      photo, 
      workerType,
      employerName,
      employerPhone,
      employerVerified: employerPhone ? false : undefined,
      status: role === "worker" ? "not verified" : undefined,
      isVerifiedByAdmin: role === "worker" ? false : undefined
    };
    
    // 1. Direct Firestore Write (Primary Source of Truth)
    const firestoreUser = cleanObject({
      ...newUser,
      createdAt: serverTimestamp(),
      otpVerified: true,
      lastActive: Timestamp.fromDate(new Date()),
      muktiScore: 0,
      points: role === "customer" ? 0 : undefined,
      badges: role === "customer" ? [] : undefined,
      status: role === "worker" ? "not verified" : undefined,
      isVerifiedByAdmin: role === "worker" ? false : undefined,
    });

    try {
      await setDoc(doc(db, "users", firebaseUser.uid), firestoreUser);
      
      console.log("✅ Firestore registration successful");
    } catch (err) {
      console.error("❌ Firestore registration failed:", err);
      // If Firestore fails, we have a critical problem, but we'll try to continue
    }

    // 2. Backend Notification (For local backups/ML)
    try {
      fetch(`${API_BASE_URL}/api/worker/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      }).catch(err => console.warn("Backend sync failed (non-critical):", err));
    } catch (err) {
      console.warn("Backend sync suppressed:", err);
    }

    setUser({ ...newUser, createdAt: new Date(), otpVerified: true, lastActive: new Date(), points: role === "customer" ? 0 : undefined, badges: role === "customer" ? [] : undefined, isDemo: false } as User);
  }

  async function updateUser(updates: Partial<User>) {
    if (!user) return;
    const firestoreUpdates = { ...updates };
    if (updates.lastActive) firestoreUpdates.lastActive = Timestamp.fromDate(updates.lastActive) as any;
    await updateDoc(doc(db, "users", user.id), cleanObject(firestoreUpdates));
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }

  async function addPoints(amount: number, badgeStr?: string) {
    if (!user || user.role !== "customer") return;
    const updates: any = { points: increment(amount) };
    if (badgeStr && !user.badges?.includes(badgeStr)) updates.badges = arrayUnion(badgeStr);
    await updateDoc(doc(db, "users", user.id), updates);
    setUser(prev => {
      if (!prev) return null;
      const newBadges = prev.badges ? [...prev.badges] : [];
      if (badgeStr && !newBadges.includes(badgeStr)) newBadges.push(badgeStr);
      return { ...prev, points: (prev.points || 0) + amount, badges: newBadges };
    });
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("mukti_demo_user");
    setUser(null);
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#020617]">
        <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
          <div className="relative">
            <div className={`h-16 w-16 animate-spin rounded-full border-4 ${initError ? 'border-red-500/20 border-t-red-500' : 'border-orange-500/20 border-t-orange-500Shadow-[0_0_20px_rgba(249,115,22,0.3)]'}`}></div>
            <div className={`absolute inset-0 h-16 w-16 animate-pulse rounded-full ${initError ? 'bg-red-500/10' : 'bg-orange-500/10'} blur-xl`}></div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-lg font-black text-white tracking-wider uppercase">Mukti Portal</h2>
            <p className={`text-[10px] font-bold ${initError ? 'text-red-500' : 'text-slate-500'} uppercase tracking-[0.2em] animate-pulse`}>
              {initError || "Initialising Secure Session"}
            </p>
            {initError && (
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Retry Connection
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, signInWithGoogle, updateUser, addPoints, logout, syncLocation, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
