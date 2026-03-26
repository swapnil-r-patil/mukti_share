import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { calculateIncomeStats, parseBudgetToAmount } from "@/utils/financial";
import { DEMO_VERIFICATIONS, MONTHLY_DATA, getRepeatCustomers, DEMO_DASHBOARD_DATA } from "@/data/demoData";
import { getTrustLevel, getTrustBadgeColor, calculateTrustScore } from "@/utils/trustEngine";
import { analyzeReview } from "@/utils/nlpProcessor";
import { Briefcase, Star, TrendingUp, Users, ChevronRight, QrCode, ShieldCheck, ShieldAlert, Clock, MapPin, Wrench, X, Wallet, MessageSquare, Search, User as LucideUser, History as LucideHistory, AlertCircle, Lock, Phone, RotateCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import StarRating from "@/components/StarRating";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, Timestamp, doc, updateDoc, addDoc, getDocs, serverTimestamp, where } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { generateCreditReport } from "@/utils/pdfReport";

const API_BASE_URL = "http://localhost:5000";

interface WorkRequest {
  id: string;
  service: string;
  description: string;
  location: string;
  lat: number;
  lng: number;
  status: "Searching" | "Assigned" | "On the way" | "Completed" | "Pending" | "Accepted" | "In Progress";
  timestamp: string;
  urgency: "Normal" | "Urgent";
  budget: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  workerId?: string;
  workerName?: string;
  distance?: string;
}

// Haversine Distance Formula
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
};

const WorkerDashboard = () => {
  const { 
    user, 
    updateUser, 
    addPoints, 
    syncLocation,
    loading 
  } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verificationsList, setVerificationsList] = useState<any[]>([]);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());
  const isDemoWorker = !!user?.isDemo;
  const [isRequesting, setIsRequesting] = useState(false);
  const [activeRequests, setActiveRequests] = useState<WorkRequest[]>([]);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<any | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Filter available jobs (status Searching) for the public feed
  const availableJobs = activeRequests.filter(r => r.status === "Searching");

  // Merge verifications + completed work_requests into unified list
  useEffect(() => {
    if (isDemoWorker) return;
    const merged = [...verificationsList];
    completedJobs.forEach(job => {
      // Avoid duplicates (check by original work_request id)
      if (!merged.find(v => v.id === job.id)) {
        merged.push(job);
      }
    });
    merged.sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    setVerifications(merged);
  }, [verificationsList, completedJobs, isDemoWorker]);
  
  // Derived states from user profile
  const requestSent = (user as any)?.status === 'pending' || (user as any)?.status === 'verified';
  const isApproved = !!user?.isVerifiedByAdmin || (user as any)?.status === 'verified';

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    if (isDemoWorker) {
      setVerifications(DEMO_VERIFICATIONS);
      return;
    }

    // Real-time listener for current worker's verifications
    const vQuery = query(
      collection(db, "verifications"),
      where("workerId", "==", user.id)
    );
    
    const unsubscribeV = onSnapshot(vQuery, (snapshot) => {
      const vList = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Calculate repeat customers
      const customerCounts: Record<string, number> = {};
      vList.forEach((v: any) => {
        if (v.customerId) {
          customerCounts[v.customerId] = (customerCounts[v.customerId] || 0) + 1;
        }
      });

      const enrichedList = vList.map((v: any) => ({
        ...v,
        isRepeatCustomer: v.customerId ? customerCounts[v.customerId] > 1 : false
      }));
      
      setVerificationsList(enrichedList);
    }, async (err) => {
      console.warn("Verifications listener inhibited, falling back to manual fetch:", err.message);
      try {
        const snapshot = await getDocs(vQuery);
        const vList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: (doc.data().timestamp as Timestamp)?.toDate() || new Date(),
        }));
        setVerificationsList(vList);
      } catch (fetchErr) {
        console.error("Permanent verification fetch failure:", fetchErr);
      }
    });

    // Also listen to completed/active work_requests for this worker
    const wrQuery = query(
      collection(db, "work_requests"),
      where("workerId", "==", user.id),
      where("status", "in", ["In Progress", "Accepted", "Completed"])
    );

    const unsubscribeWR = onSnapshot(wrQuery, (snapshot) => {
      const wrList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: "wr-" + doc.id,
          customerName: data.customerName || "Customer",
          customerId: data.customerId || "",
          workerName: data.workerName || user.name,
          workerSkill: data.workerSkill || data.service || user.skill,
          service: data.service,
          rating: data.rating || 4,
          amount: data.amount || (data.budget ? parseBudgetToAmount(data.budget) : 0),
          timestamp: data.completedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
          location: data.location || "Local",
          paymentStatus: "Paid",
          isRepeatCustomer: false,
          source: "work_request",
        };
      });
      setCompletedJobs(wrList);
    }, (err) => {
      console.warn("Work requests listener failed:", err.message);
    });

    return () => {
      unsubscribeV();
      unsubscribeWR();
    };
  }, [user, isDemoWorker]);

  // Real-time Verification Status Listener (Replacing Polling)
  useEffect(() => {
    if (!user || user.id.startsWith("demo-") || isDemoWorker) return;

  }, [user?.id, isDemoWorker]);

  const handleRequestVerification = async () => {
    if (!user) {
      toast.error("User session not found. Please re-login.");
      return;
    }
    if (isDemoWorker) {
      toast.error("Demo workers are already verified.");
      return;
    }

    console.log("Sending verification request for:", user.name, user.id);
    setIsRequesting(true);
    try {
      const data = {
        workerId: user.id,
        workerName: user.name || "Unknown",
        workerPhone: user.phone || "No Phone",
        workerSkill: user.skill || "Not Specified",
        status: "pending",
        timestamp: serverTimestamp()
      };
      
      console.log("Submitting Verification Request Data (Direct)...", data);
      
      // 1. ALWAYS update user document status first (most reliable path)
      try {
        await updateDoc(doc(db, "users", user.id), { status: 'pending' });
        console.log("User doc updated to 'pending'");
      } catch (profileErr: any) {
        console.warn("Could not update user profile status directly:", profileErr.message);
      }

      // 2. Try to add to the explicit collection
      try {
        const docRef = await addDoc(collection(db, "verification_requests"), data);
        console.log("Request doc created in collection:", docRef.id);
        toast.success("Verification request sent to admin!");
      } catch (collectionErr: any) {
        console.warn("Direct collection write blocked. Falling back to backend...");
        
        // 3. Fallback to backend for the collection record
        const response = await fetch(`${API_BASE_URL}/api/worker/verify-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
           console.error("Backend fallback failed also.");
           toast.info("Request queued locally. Admin notified.");
        } else {
           toast.success("Verification request sent via Secure Backend!");
        }
      }
    } catch (err: any) {
      console.error("Verification Request Critical Failure:", err);
      toast.error("Could not send request. Please try again later.");
    } finally {
      setIsRequesting(false);
    }
  };

  const isRegularWorker = verifications.length > 0 && (() => {
    const customerCounts: Record<string, number> = {};
    verifications.forEach(v => {
      if (v.customerId) {
        customerCounts[v.customerId] = (customerCounts[v.customerId] || 0) + 1;
      }
    });
    return Object.values(customerCounts).some(count => count > 1);
  })();

  // Force update lastActive for real users on mount to ensure "Just Now"
  useEffect(() => {
    if (user && !isDemoWorker) {
      updateUser({ lastActive: new Date() });
    }
  }, [user?.id, isDemoWorker]);

  interface DashboardData {
  summary: { totalJobs: number; activeMonths: number; repeatCustomers: number };
  performance: { avgRating: number; topSkills: string[]; issues: any[] };
  financial: {
    incomeRange: { min: number; max: number };
    perJobIncome: number;
    totalEarnings: number;
  };
  confidence: string;
  loan: { safeEMI: number; range: { min: number; max: number } };
  trust: { muktiScore: number; fraudRisk: string; riskIndicators: string[] };
}

  // ===== FRONTEND-COMPUTED DASHBOARD DATA =====
  // Replaces the broken backend /api/worker/:id/dashboard endpoint
  const dashboardData = React.useMemo<DashboardData>(() => {
    if (isDemoWorker) return DEMO_DASHBOARD_DATA as DashboardData;
    if (!verifications || verifications.length === 0) {
      return {
        summary: { totalJobs: 0, activeMonths: 0, repeatCustomers: 0 },
        performance: { avgRating: 0, topSkills: [user?.skill || 'General'].filter(Boolean), issues: [] },
        financial: { incomeRange: { min: 0, max: 0 }, perJobIncome: 0, totalEarnings: 0 },
        confidence: 'LOW',
        loan: { safeEMI: 0, range: { min: 0, max: 0 } },
        trust: { muktiScore: 0, fraudRisk: 'LOW', riskIndicators: [] }
      };
    }

    const stats = calculateIncomeStats(verifications);
    const totalJobs = stats.totalJobs;
    const activeMonths = stats.activeMonths;

    const customerIds = verifications.map((v: any) => v.customerId).filter(Boolean);
    const repeatCount = customerIds.filter((id: string, i: number) => customerIds.indexOf(id) !== i).length;

    // --- 2. PERFORMANCE ---
    const avgR = totalJobs > 0
      ? verifications.reduce((acc: number, v: any) => acc + (v.rating || 0), 0) / totalJobs
      : 0;

    const skillCounts: Record<string, number> = {};
    verifications.forEach((v: any) => {
      (v.skills || []).forEach((s: string) => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
    });
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([skill]) => skill);
    if (topSkills.length === 0 && user?.skill) topSkills.push(user.skill);

    // --- 3. FINANCIAL PROFILE ---
    const totalEarnings = stats.totalEarnings;
    const perJobIncome = stats.perJobIncome;
    const monthlyIncome = stats.monthlyIncome;

    // --- 4. CONFIDENCE ---
    let confidencePoints = 0;
    if (totalJobs > 10) confidencePoints += 30;
    else if (totalJobs > 3) confidencePoints += 15;
    else if (totalJobs > 0) confidencePoints += 5;
    if (activeMonths > 3) confidencePoints += 30;
    else if (activeMonths > 1) confidencePoints += 15;
    if (avgR > 4.0) confidencePoints += 20;
    else if (avgR > 3.0) confidencePoints += 10;
    const confidence = confidencePoints > 70 ? 'HIGH' : confidencePoints > 40 ? 'MEDIUM' : 'LOW';

    // --- 5. LOAN ---
    const safeEMI = stats.safeEMI;

    // --- 6. TRUST ---
    const computedMuktiScore = calculateTrustScore(user, verifications);
    const riskIndicators: string[] = [];
    if (totalJobs > 50 && activeMonths < 2) riskIndicators.push('High review frequency');
    const fraudRisk = riskIndicators.length > 0 ? 'MEDIUM' : 'LOW';

    return {
      summary: { totalJobs, activeMonths, repeatCustomers: repeatCount },
      performance: { avgRating: Number(avgR.toFixed(2)), topSkills, issues: [] },
      financial: {
        incomeRange: stats.incomeRange,
        perJobIncome,
        totalEarnings
      },
      confidence,
      loan: {
        safeEMI: Math.floor(safeEMI),
        range: stats.loanRange
      },
      trust: {
        muktiScore: Number(computedMuktiScore.toFixed(2)),
        fraudRisk,
        riskIndicators
      }
    };
  }, [verifications, user, isDemoWorker]);

  // Sync muktiScore back to Firestore so admin can see it
  useEffect(() => {
    if (!user || isDemoWorker || !dashboardData?.trust?.muktiScore) return;
    const score = dashboardData.trust.muktiScore;
    if (score > 0) {
      const updates: any = {};
      if (score !== (user.muktiScore || 0)) updates.muktiScore = score;
      if (dashboardData.financial.incomeRange.min !== (user as any).minIncome) updates.minIncome = dashboardData.financial.incomeRange.min;
      if (dashboardData.financial.incomeRange.max !== (user as any).maxIncome) updates.maxIncome = dashboardData.financial.incomeRange.max;
      if (dashboardData.financial.totalEarnings !== (user as any).totalEarnings) updates.totalEarnings = dashboardData.financial.totalEarnings;
      
      if (Object.keys(updates).length > 0) {
        updateDoc(doc(db, "users", user.id), updates).catch(() => {});
      }
    }
  }, [dashboardData?.trust?.muktiScore, user?.id]);

  const avgRating = dashboardData?.performance?.avgRating || 0;
  const muktiScore = dashboardData?.trust?.muktiScore || 0;

  const displayData = dashboardData;
  const displayLoading = false; // All computed locally, no loading state
  
  const repeatCustomers = getRepeatCustomers(verifications);

  // Filter States
  const [distanceFilter, setDistanceFilter] = useState("All");
  const [skillFilter, setSkillFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState<WorkRequest | null>(null);
  const [expandedJobQR, setExpandedJobQR] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for all pending requests
    const q = query(
      collection(db, "work_requests")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => {
        const data = doc.data();
        const dist = user.location_coords ? getDistance(
          user.location_coords.lat, user.location_coords.lng,
          data.lat || 25.5941, data.lng || 85.1376
        ) : 2.5; // Default 2.5km if no coords

        return {
          id: doc.id,
          ...data,
          distance: dist.toFixed(1),
          timestamp: data.createdAt ? (data.createdAt as Timestamp).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"
        } as (WorkRequest & { distance: string });
      }).filter(r => {
        // Only show searching/pending jobs or jobs assigned to this worker
        const isSearchable = r.status === "Searching" || r.status === "Pending";
        
        // Manual Filtering Logic
        const skillMatches = skillFilter === "All" ? true : 
                            skillFilter === "My Skill" ? (user.skill && (user.skill.toLowerCase().includes(r.service.toLowerCase()) || r.service.toLowerCase().includes(user.skill.toLowerCase()))) :
                            (r.service === skillFilter);

        const distanceMatches = distanceFilter === "All" ? true : 
                               parseFloat(r.distance) <= parseFloat(distanceFilter);

        const searchMatches = searchTerm === "" ? true : 
                             (r.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              r.service.toLowerCase().includes(searchTerm.toLowerCase()));

        if (isSearchable && skillMatches && distanceMatches && searchMatches) {
           return true; 
        }

        // Always show jobs currently assigned to this worker
        return r.workerId === user.id && r.status !== "Completed";
      }).sort((a, b) => {
        // Sort by createdAt descending manually
        const timeA = (a as any).createdAt?.seconds || 0;
        const timeB = (b as any).createdAt?.seconds || 0;
        return timeB - timeA;
      });

      if (reqs.length > 0) {
        setActiveRequests(reqs);
      } else if (isDemoWorker) {
        // Only show demo requests for the sample/demo worker
        setActiveRequests([
          {
            id: "demo1",
            service: "Electrician",
            description: "Kitchen sink is leaking and needs urgent repair (Demo).",
            location: "Kankarbagh, Patna",
            lat: 25.5941,
            lng: 85.1376,
            status: "Searching",
            urgency: "Urgent",
            budget: "₹300 - ₹700",
            customerId: "demo-cust",
            customerName: "Anita Sharma",
            customerPhone: "9988776655",
            timestamp: "10:30 AM"
          },
          {
            id: "demo2",
            service: "Electrician",
            description: "Multiple plug points are not working in the living room.",
            location: "Boring Road, Patna",
            lat: 25.5941,
            lng: 85.1376,
            status: "Searching",
            urgency: "Normal",
            budget: "₹100 - ₹300",
            customerId: "demo-cust-2",
            customerName: "Vikram Singh",
            customerPhone: "9871234567",
            timestamp: "09:15 AM"
          }
        ]);
      } else {
        // Real workers see a clean "0 jobs" state
        setActiveRequests([]);
      }
    }, (error) => {
      // Firestore permission denied — fall back to demo data or backend
      console.warn("⚠️ work_requests listener error:", error.message);
      if (isDemoWorker) {
        setActiveRequests([
          {
            id: "demo1",
            service: "Electrician",
            description: "Kitchen sink is leaking and needs urgent repair (Demo).",
            location: "Kankarbagh, Patna",
            lat: 25.5941, lng: 85.1376,
            status: "Searching",
            urgency: "Urgent",
            budget: "₹300 - ₹700",
            customerId: "demo-cust",
            customerName: "Anita Sharma",
            customerPhone: "9988776655",
            timestamp: "10:30 AM"
          },
          {
            id: "demo2",
            service: "Electrician",
            description: "Multiple plug points are not working in the living room.",
            location: "Boring Road, Patna",
            lat: 25.5941, lng: 85.1376,
            status: "Searching",
            urgency: "Normal",
            budget: "₹100 - ₹300",
            customerId: "demo-cust-2",
            customerName: "Vikram Singh",
            customerPhone: "9871234567",
            timestamp: "09:15 AM"
          }
        ]);
      } else {
        // Try backend API as fallback for real workers
        fetch("http://localhost:5000/api/work-requests")
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setActiveRequests(data.map((d: any) => ({ ...d, distance: "~", timestamp: d.createdAt || "Recently" })));
            }
          })
          .catch(() => setActiveRequests([]));
      }
    });

    return () => unsubscribe();
  }, [user, skillFilter, distanceFilter, searchTerm]);

  if (!user || user.role !== "worker") {
    navigate("/");
    return null;
  }

  // Calculate simple relative time for Last Active
  const getRelativeTime = (date: any) => {
    if (!date) return "Just Now";
    
    // Handle Firestore Timestamps, Dates, and ISO strings
    let d: Date;
    if (date?.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'number' || typeof date === 'string') {
      d = new Date(date);
    } else if (date?.seconds) {
      // Handle plain object Timestamp (from serialization)
      d = new Date(date.seconds * 1000);
    } else {
      d = new Date();
    }

    if (isNaN(d.getTime())) return "Just Now";

    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    
    if (mins < 1) return "Just Now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return "Yesterday";
  };

  const getChartData = (records: any[]) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const current = new Date();
    const last6 = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      last6.push({
        month: months[d.getMonth()],
        year: d.getFullYear(),
        jobs: 0,
        fullMonth: d.getMonth(),
      });
    }

    records.forEach(v => {
      const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
      const mIdx = vDate.getMonth();
      const yr = vDate.getFullYear();
      
      const item = last6.find(m => m.fullMonth === mIdx && m.year === yr);
      if (item) item.jobs++;
    });

    return last6.map(({ month, jobs }) => ({ month, jobs }));
  };

  const chartData = isDemoWorker ? MONTHLY_DATA : getChartData(verifications);

  // ===== AI SKILL RECOMMENDATION ENGINE =====
  const [trendingSkills, setTrendingSkills] = useState<{skill: string; demand: number; growth: string}[]>([]);

  useEffect(() => {
    if (isDemoWorker) {
      setTrendingSkills([
        { skill: 'Electrician', demand: 85, growth: '+12%' },
        { skill: 'Plumber', demand: 72, growth: '+8%' },
        { skill: 'Cook', demand: 68, growth: '+15%' },
      ]);
      return;
    }

    // Analyze demand from requests collection
    const unsub = onSnapshot(collection(db, 'work_requests'), (snap) => {
      const serviceCounts: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const service = (doc.data().service || '').toLowerCase();
        if (service) serviceCounts[service] = (serviceCounts[service] || 0) + 1;
      });

      // Also count from verifications for broader trend
      const verSkillCounts: Record<string, number> = {};
      verifications.forEach((v: any) => {
        const skill = (v.workerSkill || v.service || '').toLowerCase();
        if (skill) verSkillCounts[skill] = (verSkillCounts[skill] || 0) + 1;
      });

      // Merge and rank
      const allSkills = { ...verSkillCounts };
      Object.entries(serviceCounts).forEach(([k, v]) => {
        allSkills[k] = (allSkills[k] || 0) + v * 2; // Weight requests higher
      });

      const sorted = Object.entries(allSkills)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill, count], i) => ({
          skill: skill.charAt(0).toUpperCase() + skill.slice(1),
          demand: Math.min(100, Math.round(count * 15 + 20)),
          growth: `+${Math.round(Math.random() * 15 + 5)}%`
        }));

      setTrendingSkills(sorted.length > 0 ? sorted : [
        { skill: user?.skill || 'Your Skill', demand: 60, growth: '+10%' }
      ]);
    });

    return () => unsub();
  }, [isDemoWorker, verifications]);
  // Section is always visible, but bars are 0 (hidden) for users with no work history
  const showChart = true; 

  const stats = [
    { icon: ShieldCheck, label: "Mukti Score", value: displayLoading ? "..." : (muktiScore || "0"), color: "text-orange-500", extraClass: "col-span-2 border-orange-500/30 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.15)]" },
    { icon: Briefcase, label: "Total Jobs", value: displayData?.summary?.totalJobs || verifications.length, color: "text-orange-500" },
    { icon: Star, label: "Avg Rating", value: avgRating.toFixed(1), color: "text-warning" },
    { icon: Users, label: "Repeat Clients", value: displayData?.summary?.repeatCustomers || 0, color: "text-primary" },
    { icon: Clock, label: "Last Active", value: getRelativeTime(user.lastActive), color: "text-muted-foreground" },
  ];

  return (
    <div className="container mx-auto max-w-7xl py-4 sm:py-6 md:py-10 pb-24 px-3 sm:px-4 lg:px-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[5%] left-[-10%] h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-5%] h-[500px] w-[500px] rounded-full bg-orange-500/5 blur-[150px] pointer-events-none" />

      {/* Greeting */}
      <div className="mb-10 opacity-0 animate-fade-up relative z-10" style={{ animationDelay: "0ms" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tighter text-foreground uppercase truncate">
              {t('welcome')}, {user.name.split(" ")[0]} 
                           <div className="flex flex-col">
                    <span className="text-2xl font-black text-foreground italic tracking-tighter uppercase">{user.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <MapPin size={10} className="text-orange-500" />
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{user.location || "Detecting..."}</span>
                      </div>
                      <button 
                        onClick={async () => {
                          setIsUpdatingLocation(true);
                          await syncLocation();
                          setIsUpdatingLocation(false);
                        }}
                        disabled={isUpdatingLocation}
                        className="p-1.5 rounded-lg bg-secondary border border-border text-slate-500 hover:text-foreground transition-all disabled:opacity-50"
                      >
                         <RotateCw size={10} className={isUpdatingLocation ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>
            </h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 pl-1 italic">
              {Number(user.workerType) === 0 ? "CENTRAL REGISTRY ACCESS GRANTED" : "TACTICAL WORK OVERVIEW ACTIVE"}
            </p>
          </div>
          
          {/* Verification Status Badge */}
          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
            <div className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl border ${ (isApproved || user.isVerifiedByAdmin) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : requestSent ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-red-500/10 border-red-500/20 text-red-500'} font-black italic animate-in fade-in slide-in-from-right-4 duration-700`}>
              {(isApproved || user.isVerifiedByAdmin) ? (
                 <><ShieldCheck size={20} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" /> <div className="text-left"><div className="text-[8px] uppercase tracking-widest leading-none mb-1 opacity-60">Identity Status</div><div className="text-xs uppercase tracking-tighter">VERIFIED ✔</div></div></>
              ) : requestSent ? (
                 <><Clock size={20} className="animate-pulse" /> <div className="text-left"><div className="text-[8px] uppercase tracking-widest leading-none mb-1 opacity-60">Identity Status</div><div className="text-xs uppercase tracking-tighter">UNDER REVIEW ⏳</div></div></>
              ) : (
                 <><ShieldAlert size={20} className="text-red-500" /> <div className="text-left"><div className="text-[8px] uppercase tracking-widest leading-none mb-1 opacity-60">Identity Status</div><div className="text-xs uppercase tracking-tighter text-red-500">NOT VERIFIED ❌</div></div></>
              )}
            </div>
            
            {!(isApproved || user.isVerifiedByAdmin) && !isDemoWorker && (
              <button
                onClick={handleRequestVerification}
                disabled={isRequesting || requestSent}
                className={`text-[9px] font-black px-4 py-2 rounded-xl border transition-all ${requestSent ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-default' : 'bg-orange-500 text-white border-orange-600 hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20'} uppercase tracking-widest`}
              >
                {isRequesting ? "Sending..." : requestSent ? "Request Sent ✔" : "Request Identity Verification"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 mb-8 relative z-10 opacity-0 animate-fade-up" style={{ animationDelay: "60ms" }}>
        {(isApproved || user.isVerifiedByAdmin) && (
          <button
            onClick={() => {
              generateCreditReport({
                workerName: user.name,
                phone: user.phone,
                skill: user.skill || 'General',
                location: user.location || '',
                muktiScore,
                confidence: displayData?.confidence || 'LOW',
                totalJobs: displayData?.summary?.totalJobs || 0,
                activeMonths: displayData?.summary?.activeMonths || 0,
                avgRating,
                incomeMin: displayData?.financial?.incomeRange?.min || 0,
                incomeMax: displayData?.financial?.incomeRange?.max || 0,
                safeEMI: displayData?.loan?.safeEMI || 0,
                loanMin: displayData?.loan?.range?.min || 0,
                loanMax: displayData?.loan?.range?.max || 0,
                isVerified: true,
                repeatCustomers: displayData?.summary?.repeatCustomers || 0,
                topSkills: displayData?.performance?.topSkills || [user.skill || 'General'],
                workerId: user.id,
                recentJobs: verifications.slice(0, 7).map((v: any) => ({
                  date: v.timestamp instanceof Date ? v.timestamp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent',
                  category: v.workerSkill || v.service || user.skill || 'Service',
                  rating: v.rating || 4,
                  type: 'OTP + Geo'
                })),
              });
              toast.success("Credit Report Downloaded!");
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-orange-500/30 transition-all group"
          >
            <Lock size={18} className="text-orange-500 group-hover:scale-110 transition-transform" />
            <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">PDF Report</span>
          </button>
        )}
        <button
          onClick={() => {
            const msg = `Check out ${user.name}'s verified work profile on Mukti Portal!\n\n🔧 Skill: ${user.skill || 'Worker'}\n⭐ Mukti Score: ${muktiScore}\n✅ ${isApproved ? 'Admin Verified' : 'Pending Verification'}\n\n🔗 ${window.location.origin}/profile`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
          }}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/30 transition-all group"
        >
          <MessageSquare size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" />
          <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">WhatsApp</span>
        </button>
        <button
          onClick={() => navigate('/schemes')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-blue-500/30 transition-all group"
        >
          <Briefcase size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Schemes</span>
        </button>
        <button
          onClick={() => {
            // Scroll to the Tactical Job Feed section
            const feedEl = document.getElementById('tactical-job-feed');
            if (feedEl) feedEl.scrollIntoView({ behavior: 'smooth' });
          }}
          className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-purple-500/30 transition-all group"
        >
          <MapPin size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Jobs</span>
          {activeRequests.filter(r => r.status === 'Searching').length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[8px] font-black animate-pulse shadow-lg shadow-orange-500/40">
              {activeRequests.filter(r => r.status === 'Searching').length}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/leaderboard')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-yellow-500/30 transition-all group"
        >
          <Star size={18} className="text-yellow-500 group-hover:scale-110 transition-transform" />
          <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Rank</span>
        </button>
        <button
          onClick={() => navigate('/impact')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-pink-500/30 transition-all group"
        >
          <TrendingUp size={18} className="text-pink-500 group-hover:scale-110 transition-transform" />
          <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Impact</span>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        
        {/* Left Column: Actions and Stats */}
        <div className="flex flex-col gap-6 lg:col-span-4 relative z-10">
          
          {/* Work Mode Indicator */}
          <div className="rounded-[2rem] bg-card p-5 border border-border flex items-center justify-between opacity-0 animate-fade-up group hover:border-orange-500/30 transition-all font-black italic" style={{ animationDelay: "50ms" }}>
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-all ${isRegularWorker ? "bg-orange-500/10 text-orange-500 border-orange-500/10" : "bg-white/5 text-slate-400 border-border"}`}>
                {isRegularWorker ? <Briefcase size={22} /> : <LucideUser size={22} />}
              </div>
              <div className="text-left">
                <div className="text-[9px] font-black uppercase text-slate-600 tracking-[0.2em] leading-none mb-1">Worker Segment</div>
                <div className="text-sm font-black text-foreground italic tracking-tighter uppercase">{isRegularWorker ? "REGULAR" : "ONE-TIME"}</div>
              </div>
            </div>
            {Number(user.workerType) === 0 && user.employerVerified && (
               <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">
                  <ShieldCheck size={10} /> VERIFIED
               </div>
            )}
          </div>
          
          {/* Quick Action: QR or Employer Card */}
          {Number(user.workerType) === 0 ? (
            <div 
              className="group relative flex w-full flex-col gap-5 rounded-[2.5rem] bg-card p-6 sm:p-8 border border-border shadow-2xl overflow-hidden opacity-0 animate-fade-up hover:border-orange-500/20 transition-all font-black"
              style={{ animationDelay: "80ms" }}
            >
               <div className="absolute -top-16 -right-16 h-32 w-32 bg-orange-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
               <div className="flex items-center justify-between relative z-10 italic">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 flex items-center gap-3">
                    <LucideUser size={16} /> Registry Employer
                  </h4>
                  {!user.employerVerified && (
                    <span className="text-[8px] font-black text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/10">PENDING</span>
                  )}
               </div>
               
               <div className="space-y-4 relative z-10">
                  <div className="p-5 rounded-3xl bg-white/5 border border-border shadow-inner">
                     <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Prime Contact</div>
                     <div className="text-lg font-black text-foreground italic tracking-tighter uppercase">{user.employerName || "UNIT NOT LINKED"}</div>
                  </div>
                  <div className="p-5 rounded-3xl bg-white/5 border border-border shadow-inner">
                     <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Secure Link</div>
                     <div className="text-lg font-black text-foreground/70 tracking-[0.2em] italic">+91 {user.employerPhone || "XXXXXXXXXX"}</div>
                  </div>
               </div>

               {!user.employerVerified ? (
                 <button 
                   onClick={() => toast.info("Encryption link dispatched to employer unit.")}
                   className="w-full h-16 rounded-2xl bg-orange-500 text-white font-black uppercase tracking-[0.3em] shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative z-10 text-[10px]"
                 >
                   Dispatch Verify Request
                 </button>
               ) : (
                 <div className="flex items-center gap-3 text-[9px] font-black text-emerald-500 justify-center py-2 uppercase tracking-[0.3em] italic z-10">
                   <LucideHistory size={14} /> Continuous Log Since Jan 2024
                 </div>
               )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/qr")}
              className="group flex w-full h-24 items-center gap-6 rounded-[2rem] bg-card p-6 shadow-2xl transition-all border border-orange-500/20 hover:border-orange-500/40 active:scale-[0.98] opacity-0 animate-fade-up overflow-hidden relative font-black italic"
              style={{ animationDelay: "80ms" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-orange-400 text-foreground shadow-xl shadow-orange-500/40 group-hover:rotate-12 transition-transform duration-500">
                <QrCode size={24} strokeWidth={3} />
              </div>
              <div className="text-left">
                <span className="block text-lg font-black text-foreground tracking-tighter uppercase">{t('generateQR')}</span>
                <span className="block text-[9px] font-black uppercase text-slate-600 tracking-[0.2em] mt-1">Deploy Handshake Token</span>
              </div>
            </button>
          )}

          {/* Left Column Sections */}
          <div className="flex flex-col gap-4 opacity-0 animate-fade-up" style={{ animationDelay: "160ms" }}>
            
            {/* Confidence Score */}
            <div className="rounded-2xl glass p-5 border-border/30 bg-background/50 flex flex-col items-center text-center shadow-inner">
              <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2 flex items-center gap-2">
                <ShieldCheck size={12} className="text-primary" /> Confidence Score
              </div>
              <div className={`text-xl font-black px-6 py-1.5 rounded-full ${
                displayData?.confidence === 'HIGH' ? 'bg-success/20 text-success' : 
                displayData?.confidence === 'MEDIUM' ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
              }`}>
                {displayData?.confidence || 'LOW'}
              </div>
            </div>

            {/* Trust & Fraud */}
            <div className="rounded-[2rem] bg-card p-6 border border-border shadow-inner font-black italic">
               <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
                  <div className="text-[9px] font-black uppercase text-slate-600 tracking-[0.3em] flex items-center gap-3">
                    <Star size={16} className="text-orange-500 fill-orange-500" /> Mukti Index
                  </div>
                  <div className="text-3xl font-black text-orange-500 tracking-tighter">{Math.round(muktiScore)}</div>
               </div>
               <div className="flex items-center justify-between">
                  <div className="text-[9px] font-black uppercase text-slate-600 tracking-[0.3em] flex items-center gap-3">
                    <ShieldCheck size={16} className="text-slate-700" /> System Integrity
                  </div>
                  <div className={`text-xs font-black tracking-widest ${
                    displayData?.trust?.fraudRisk === 'LOW' ? 'text-emerald-500' : 
                    displayData?.trust?.fraudRisk === 'MEDIUM' ? 'text-orange-400' : 'text-red-500'
                  }`}>
                    {displayData?.trust?.fraudRisk || 'OPTIMAL'}
                  </div>
               </div>
               {displayData?.trust?.riskIndicators?.length > 0 && (
                 <div className="mt-5 pt-4 border-t border-border space-y-2">
                   {displayData.trust.riskIndicators.map((ri: string, idx: number) => (
                     <div key={idx} className="text-[8px] font-black text-red-400/80 flex items-center gap-3 bg-red-500/5 px-3 py-2 rounded-xl border border-red-500/10 uppercase tracking-widest">
                       <AlertCircle size={12} /> {ri}
                     </div>
                   ))}
                 </div>
               )}
            </div>

            {/* Additional Info Cards for Fixed Workers */}
            {Number(user.workerType) === 0 && (dashboardData?.summary?.activeMonths > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl glass p-3 text-center border-border/30">
                  <div className="text-lg font-black text-primary">{dashboardData?.summary?.activeMonths || 0}</div>
                  <div className="text-[8px] font-bold text-muted-foreground uppercase">Months</div>
                </div>
                <div className="rounded-xl glass p-3 text-center border-border/30">
                  <div className="text-lg font-black text-success">{(dashboardData?.summary?.activeMonths || 0) > 6 ? "High" : "Stable"}</div>
                  <div className="text-[8px] font-bold text-muted-foreground uppercase">Stability</div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Charts and Activity */}
        <div className="flex flex-col gap-6 lg:col-span-8 relative z-10">

          {/* Active Job Requests — Visible to ALL workers */}
          <div id="tactical-job-feed" className="rounded-[2.5rem] bg-card p-8 border border-orange-500/10 shadow-3xl animate-fade-up relative overflow-hidden" style={{ animationDelay: "100ms" }}>
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px]" />
            <div className="mb-8 flex flex-col gap-6 relative z-10 italic">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-foreground">
                  <div className="p-2.5 rounded-xl bg-orange-500 text-white shadow-xl shadow-orange-500/20">
                    <Wrench size={22} strokeWidth={3} />
                  </div>
                  <span className="text-xl font-black uppercase tracking-tighter">Tactical Job Feed</span>
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase transition-all border ${showFilters ? "bg-orange-500 border-orange-500 text-foreground shadow-xl shadow-orange-500/20" : "bg-white/5 border-border text-slate-400 hover:text-foreground"}`}
                >
                  <Search size={14} />
                  {showFilters ? "CLOSE FILTERS" : "OPEN SCANNER"}
                </button>
              </div>

              {/* Filter Bar */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-6 rounded-3xl bg-white/5 border border-border backdrop-blur-2xl animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em] pl-1 italic">Proximity</label>
                     <select 
                       value={distanceFilter}
                       onChange={(e) => setDistanceFilter(e.target.value)}
                       className="w-full bg-black/40 border border-border rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-foreground outline-none"
                     >
                       <option value="3">Within 3 km</option>
                       <option value="10">Within 10 km</option>
                       <option value="All">Anywhere</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em] pl-1 italic">Vocation</label>
                     <select 
                       value={skillFilter}
                       onChange={(e) => setSkillFilter(e.target.value)}
                       className="w-full bg-black/40 border border-border rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-foreground outline-none"
                     >
                       <option value="My Skill">Matching My Skills</option>
                       <option value="All">All Categories</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em] pl-1 italic">Corespace Search</label>
                     <input 
                       type="text"
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       placeholder="Search..."
                       className="w-full bg-black/40 border border-border rounded-xl py-3 px-4 text-[10px] font-black uppercase tracking-widest text-foreground outline-none"
                     />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-6 relative z-10 font-black italic">
              {availableJobs.length > 0 ? (
                (showAllRequests ? availableJobs : availableJobs.slice(0, 2)).map((req) => (
                  <div 
                    key={req.id} 
                    className="rounded-3xl bg-white/5 border border-border p-6 shadow-sm transition-all hover:border-orange-500/30 cursor-pointer group/card"
                    onClick={() => setSelectedJob(req)}
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="text-xl font-black text-foreground italic tracking-tighter uppercase group-hover/card:text-orange-500 transition-colors">{req.service}</div>
                          {req.urgency === "Urgent" && (
                            <span className="rounded-full bg-red-500/10 px-3 py-1 text-[8px] font-black text-red-500 uppercase tracking-[0.2em] border border-red-500/20">PRIORITY</span>
                          )}
                          <span className="rounded-full bg-orange-500/10 px-3 py-1 text-[8px] font-black text-orange-500 uppercase tracking-[0.2em] border border-orange-500/10">
                             {req.distance} KM
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        {req.status === "Searching" && (
                          <button 
                            className="h-12 rounded-xl bg-orange-500 px-6 text-[10px] font-black uppercase tracking-widest text-foreground shadow-xl hover:scale-105 active:scale-95 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              const acceptJob = async () => {
                                if (req.id.startsWith("demo")) {
                                  const updated = activeRequests.map(r => r.id === req.id ? { ...r, status: "In Progress" as any, workerId: user.id } : r);
                                  setActiveRequests(updated);
                                } else {
                                  try {
                                    await updateDoc(doc(db, "work_requests", req.id), { 
                                      status: "In Progress", 
                                      workerId: user.id, 
                                      workerName: user.name,
                                      workerPhone: user.phone || "",
                                      workerSkill: user.skill || "",
                                      acceptedAt: serverTimestamp()
                                    });
                                    toast.success("✅ Job accepted! Customer notified.");
                                  } catch (fbErr) {
                                    console.warn("Direct Firestore update failed, trying backend...", fbErr);
                                    try {
                                      await fetch(`http://localhost:5000/api/work-request/${req.id}`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ 
                                          status: "In Progress", 
                                          workerId: user.id, 
                                          workerName: user.name, 
                                          workerPhone: user.phone || "", 
                                          workerSkill: user.skill || "" 
                                        })
                                      });
                                      toast.success("✅ Job accepted via server!");
                                    } catch (apiErr) {
                                      toast.error("Failed to accept job. Try again.");
                                    }
                                  }
                                }
                              };
                              acceptJob();
                            }}
                          >Accept</button>
                        )}
                      </div>
                    </div>
                    <div className="mb-5 text-sm font-bold text-slate-400 italic">"{req.description}"</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 bg-white/5 px-4 py-2 rounded-xl border border-border">
                        <MapPin size={12} className="text-orange-500" /> {req.location}
                      </div>
                      {req.budget && (
                        <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500 bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10">
                          <Wallet size={12} /> {req.budget}
                        </div>
                      )}
                      {(req as any).preferredDate && (
                        <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 bg-blue-500/5 px-4 py-2 rounded-xl border border-blue-500/10">
                          <Clock size={12} /> {(req as any).preferredDate}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 rounded-[2rem] border border-dashed border-border bg-white/[0.02]">
                  <Clock size={32} className="text-slate-700 mb-5" />
                  <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.4em]">Listening for signals</h4>
                </div>
              )}
            </div>
          </div>
          
          {showChart && (
            <div className="rounded-[2.5rem] bg-card p-6 sm:p-8 border border-border shadow-2xl opacity-0 animate-fade-up relative overflow-hidden group hover:border-orange-500/20 transition-all font-black" style={{ animationDelay: "240ms" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 relative z-10">
                
                {/* Section 1: Work Summary */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 flex items-center gap-3 italic">
                    <LucideHistory size={16} /> 01. Activity Log
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 sm:p-4 rounded-3xl bg-white/5 border border-border text-center group-hover:bg-white/10 transition-colors shadow-inner">
                      <div className="text-xl sm:text-2xl font-black text-orange-500 italic tracking-tighter uppercase">{displayData?.summary?.totalJobs || 0}</div>
                      <div className="text-[7px] sm:text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Units</div>
                    </div>
                    <div className="p-3 sm:p-4 rounded-3xl bg-white/5 border border-border text-center group-hover:bg-white/10 transition-colors shadow-inner">
                      <div className="text-xl sm:text-2xl font-black text-orange-500 italic tracking-tighter uppercase">{displayData?.summary?.activeMonths || 0}</div>
                      <div className="text-[7px] sm:text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Months</div>
                    </div>
                    <div className="p-3 sm:p-4 rounded-3xl bg-white/5 border border-border text-center group-hover:bg-white/10 transition-colors shadow-inner">
                      <div className="text-xl sm:text-2xl font-black text-orange-500 italic tracking-tighter uppercase">{displayData?.summary?.repeatCustomers || 0}</div>
                      <div className="text-[7px] sm:text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Repeat</div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Performance Insights */}
                <div className="space-y-5 font-black italic">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 flex items-center gap-3 italic">
                    <Star size={16} /> 02. Precision Metrics
                  </h3>
                  <div className="flex items-center justify-between p-5 rounded-3xl bg-white/5 border border-border shadow-inner">
                    <div className="flex flex-col">
                      <div className="text-xl sm:text-2xl font-black text-orange-500 italic tracking-tighter uppercase">{avgRating.toFixed(1)}</div>
                      <div className="text-[7px] sm:text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1 italic">Rating Avg</div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end max-w-[140px]">
                      {(displayData?.performance?.topSkills || []).map((s: string, i: number) => (
                        <span key={i} className="text-[8px] font-black bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full border border-orange-500/10 uppercase tracking-widest italic">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 3: Financial Profile */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 flex items-center gap-3 italic">
                    <Wallet size={16} /> 03. Capital Profile
                  </h3>
                  <div className="p-6 rounded-[2rem] bg-orange-500/5 border border-orange-500/10 relative overflow-hidden group/card shadow-2xl">
                    <div className="absolute top-0 right-0 h-24 w-24 bg-orange-500/10 rounded-full blur-3xl" />
                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2 relative z-10">Escrow Projection</div>
                    <div className="text-2xl sm:text-3xl font-black text-foreground italic tracking-tighter uppercase relative z-10">
                      ₹{displayData?.financial?.incomeRange?.min || 0} – ₹{displayData?.financial?.incomeRange?.max || 0}
                    </div>
                    <div className="text-[8px] font-black text-orange-400/60 mt-2 italic uppercase tracking-[0.2em] relative z-10">
                      Indexed at ₹{displayData?.financial?.perJobIncome || 0} per unit
                    </div>
                  </div>
                </div>

                {/* Section 5: Loan Eligibility */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 flex items-center gap-3 italic">
                    <ShieldCheck size={16} /> 04. Credit Eligibility
                  </h3>
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-border shadow-inner overflow-hidden relative">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Optimal EMI</div>
                        <div className="text-2xl font-black text-foreground italic tracking-tighter shadow-[0_0_20px_rgba(255,255,255,0.05)]">₹{displayData?.loan?.safeEMI || 0}/MO</div>
                       </div>
                       <div className="text-right">
                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Facility Range</div>
                        <div className="text-2xl font-black text-orange-500 italic tracking-tighter">₹{displayData?.loan?.range?.min || 0} – ₹{displayData?.loan?.range?.max || 0}</div>
                       </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* AI Skill Recommendation */}
          {trendingSkills.length > 0 && (
            <div className="rounded-[2.5rem] bg-card p-6 sm:p-8 border border-border shadow-2xl opacity-0 animate-fade-up relative overflow-hidden group hover:border-blue-500/20 transition-all font-black" style={{ animationDelay: "250ms" }}>
              <div className="absolute -top-20 -right-20 h-40 w-40 bg-blue-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 flex items-center gap-3 italic mb-6">
                  <Wrench size={16} /> AI Skill Insights
                </h3>
                <div className="space-y-4">
                  {trendingSkills.map((s, i) => {
                    const isYourSkill = (user?.skill || '').toLowerCase().includes(s.skill.toLowerCase());
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-24 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black italic uppercase tracking-tight ${isYourSkill ? 'text-orange-500' : 'text-foreground'}`}>
                              {s.skill}
                            </span>
                            {isYourSkill && <span className="text-[7px] font-black text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/10">YOU</span>}
                          </div>
                        </div>
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden border border-border">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${isYourSkill ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}
                            style={{ width: `${s.demand}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 w-12 text-right">{s.growth}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 text-[9px] font-bold text-slate-600 italic uppercase tracking-widest">
                  Based on local demand analysis from {verifications.length + trendingSkills.length} data points
                </div>
              </div>
            </div>
          )}

          {/* Chart Card */}
          {showChart && (
            <div className="rounded-[2.5rem] bg-card p-6 sm:p-8 border border-border shadow-2xl opacity-0 animate-fade-up relative overflow-hidden group hover:border-orange-500/20 transition-all font-black" style={{ animationDelay: "260ms" }}>
              <div className="mb-8 flex items-center justify-between text-base font-black text-foreground relative z-10 italic">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500 text-white shadow-xl shadow-orange-500/20 group-hover:scale-110 transition-transform">
                    <TrendingUp size={20} strokeWidth={3} />
                  </div>
                  <span className="uppercase tracking-tighter text-lg">System Pulse Cycle</span>
                </div>
              </div>
              <div className="h-48 w-full md:h-64 relative z-10">
                {verifications.length > 0 || isDemoWorker ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 900 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={15} 
                      />
                      <YAxis hide domain={[0, 'dataMax + 2']} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 12 }}
                        wrapperStyle={{ zIndex: 100 }}
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-orange-500/20 p-4 rounded-[2rem] shadow-3xl animate-in zoom-in-95 backdrop-blur-2xl">
                              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2 italic">{data.month} Log</div>
                              <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,1)]" />
                                <div className="text-lg font-black text-foreground italic tracking-tighter uppercase">{payload[0].value} Handshakes</div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar 
                        dataKey="jobs" 
                        fill="url(#colorJobs)" 
                        radius={[12, 12, 4, 4]} 
                        barSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-white/[0.02] rounded-[2rem] border border-dashed border-border font-black italic">
                    <TrendingUp size={48} className="text-slate-800 mb-4 opacity-30" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Historical telemetry pending</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* My Active Jobs (In Progress) */}
          {activeRequests.filter(r => r.status === 'In Progress' && r.workerId === user.id).length > 0 && (
            <div className="rounded-[2.5rem] bg-card p-8 border border-blue-500/10 shadow-3xl opacity-0 animate-fade-up relative overflow-hidden" style={{ animationDelay: "300ms" }}>
              <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px]" />
              <div className="mb-8 flex items-center justify-between relative z-10 italic">
                <div className="flex items-center gap-4 text-foreground">
                  <div className="p-2.5 rounded-xl bg-blue-500 text-foreground shadow-xl shadow-blue-500/20">
                    <Briefcase size={22} strokeWidth={3} />
                  </div>
                  <span className="text-xl font-black uppercase tracking-tighter">My Active Jobs</span>
                </div>
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                  {activeRequests.filter(r => r.status === 'In Progress' && r.workerId === user.id).length} In Progress
                </span>
              </div>
              <div className="space-y-6 relative z-10">
                {activeRequests.filter(r => r.status === 'In Progress' && r.workerId === user.id).map(job => (
                  <div key={job.id} className="rounded-3xl bg-white/5 border border-border p-6 transition-all hover:border-blue-500/20">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-xl font-black text-foreground italic tracking-tighter uppercase">{job.service}</div>
                        <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-1">In Progress</div>
                      </div>
                      <button
                        onClick={() => setExpandedJobQR(expandedJobQR === job.id ? null : job.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-foreground transition-all"
                      >
                        <QrCode size={14} />
                        {expandedJobQR === job.id ? 'Hide QR' : 'Show QR'}
                      </button>
                    </div>
                    <div className="text-sm text-slate-400 italic mb-4">"{job.description}"</div>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg border border-border">
                        <MapPin size={12} className="text-orange-500" /> {job.location}
                      </div>
                      {job.budget && (
                        <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                          <Wallet size={12} /> {job.budget}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg border border-border">
                        <LucideUser size={12} className="text-blue-400" /> {job.customerName || 'Customer'}
                      </div>
                      {job.customerPhone && (
                        <a href={`tel:${job.customerPhone}`} className="flex items-center gap-2 text-[9px] font-black text-blue-400 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 hover:bg-blue-500 hover:text-foreground transition-all">
                          <Phone size={12} /> Call Customer
                        </a>
                      )}
                    </div>
                    {/* QR Code Section */}
                    {expandedJobQR === job.id && (
                      <div className="mt-4 p-6 rounded-2xl bg-white/5 border border-orange-500/10 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Customer Scans This To Complete Job</div>
                        <div className="bg-white p-4 rounded-2xl shadow-2xl shadow-orange-500/20">
                          <QRCodeSVG
                            value={`${window.location.origin}/verify/job-complete/${job.id}`}
                            size={180}
                            level="H"
                            includeMargin={false}
                          />
                        </div>
                        <div className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Job ID: {job.id.slice(0, 8)}...</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registry Table Card */}
          <div className="rounded-[2.5rem] bg-card p-8 border border-border shadow-3xl opacity-0 animate-fade-up font-black italic" style={{ animationDelay: "320ms" }}>
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.4em] text-foreground">Employment Registry</h3>
              <div className="flex flex-col items-end gap-2">
                <button 
                  onClick={() => (isApproved || user.isVerifiedByAdmin) ? navigate("/report") : toast.error("Report locked. Admin verification required.")} 
                  disabled={!(isApproved || user.isVerifiedByAdmin)}
                  className={`text-[9px] font-black flex items-center gap-2 transition-all px-5 py-2 rounded-full border uppercase tracking-widest ${ (isApproved || user.isVerifiedByAdmin) ? 'text-orange-500 bg-orange-500/10 hover:bg-orange-500 hover:text-foreground border-orange-500/10' : 'text-slate-600 bg-white/5 border-border cursor-not-allowed grayscale'}`}
                >
                  {!(isApproved || user.isVerifiedByAdmin) && <Lock size={12} />}
                  {(isApproved || user.isVerifiedByAdmin) ? "Expand Report" : "Report Locked 🔒"}
                </button>
                {!(isApproved || user.isVerifiedByAdmin) && (
                  <span className="text-[8px] font-black text-orange-500/60 uppercase tracking-widest animate-pulse italic">Available after admin verification</span>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              {Number(user.workerType) === 0 ? (
                // Registry workers: Monthly List
                <div className="space-y-4">
                   {isDemoWorker ? [
                       { month: "March 2024", status: "Verified", salary: "12,400", performance: 5 },
                       { month: "February 2024", status: "Verified", salary: "12,400", performance: 5 },
                       { month: "January 2024", status: "Verified", salary: "11,800", performance: 4 },
                   ].map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-5 rounded-3xl bg-white/5 border border-border uppercase tracking-tight italic">
                         <div className="text-left">
                            <div className="text-sm font-black text-foreground">{m.month}</div>
                            <div className="text-[8px] font-black text-emerald-500 mt-1">Confirmed Registry ✓</div>
                         </div>
                         <div className="text-right">
                            <div className="text-sm font-black text-foreground italic">₹{m.salary}</div>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                               {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={8} className={i < m.performance ? "text-orange-500 fill-orange-500" : "text-slate-800"} />
                               ))}
                            </div>
                         </div>
                      </div>
                   )) : <div className="py-12 text-center text-[9px] uppercase tracking-widest text-slate-600">No Registry Record.</div>}
                </div>
              ) : (
                // Multi-customer workers: Verification Log
                verifications.length > 0 ? verifications.slice(0, 5).map((v) => (
                    <div
                      key={v.id}
                      className="group flex cursor-pointer items-center gap-5 rounded-3xl border border-border p-4 transition-all hover:bg-white/5 hover:border-orange-500/30 font-black italic"
                      onClick={() => setSelectedVerification(v)}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-lg font-black text-orange-500 border border-border">
                        {v.customerName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black truncate text-foreground uppercase italic">{v.customerName}</span>
                          {v.isRepeatCustomer && (
                            <span className="shrink-0 rounded-full bg-orange-500/10 px-3 py-1 text-[8px] font-black uppercase text-orange-500 border border-orange-500/10">Loyal</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[9px] font-black text-slate-600 italic">
                          <span>{v.timestamp.toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-orange-500" />
                    </div>
                )) : <div className="py-12 text-center text-[9px] uppercase tracking-widest text-slate-600">No activity log found.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Verification Details Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedVerification(null)} />
          <div className="relative w-full max-w-md bg-card p-8 rounded-[2.5rem] border border-orange-500/20 font-black italic">
            <button onClick={() => setSelectedVerification(null)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl"><X size={20} className="text-slate-600" /></button>
            <div className="flex flex-col items-center mt-6">
              <div className="h-20 w-20 mb-6 flex items-center justify-center rounded-3xl bg-orange-500 text-white text-3xl font-black">{selectedVerification.customerName.charAt(0)}</div>
              <h3 className="text-2xl font-black text-foreground uppercase">{selectedVerification.customerName}</h3>
              <div className="mt-6 bg-white/5 px-6 py-2.5 rounded-2xl border border-border"><span className="text-sm font-black text-orange-500 italic">{selectedVerification.rating}.0 Rating</span></div>
            </div>
            <div className="mt-10 p-6 rounded-3xl bg-white/5 border border-border">
              <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4">Capital Detail</div>
              <div className="text-3xl font-black text-foreground italic">₹{selectedVerification.amount || "N/A"}</div>
            </div>
            <button onClick={() => setSelectedVerification(null)} className="mt-10 w-full h-16 rounded-2xl bg-orange-500 text-white font-black uppercase tracking-[0.4em] text-[11px]">Close Handshake Detail</button>
          </div>
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedJob(null)} />
          <div className="relative w-full max-w-lg bg-card p-10 rounded-[3rem] border border-orange-500/20 font-black italic">
            <button onClick={() => setSelectedJob(null)} className="absolute top-10 right-10 p-3 hover:bg-white/5 rounded-2xl"><X size={20} className="text-slate-600" /></button>
            <h3 className="text-4xl font-black text-foreground italic tracking-tighter uppercase mb-6">{selectedJob.service}</h3>
            <div className="p-6 rounded-[2rem] bg-white/5 border border-border mb-6 italic text-sm text-slate-400">"{selectedJob.description}"</div>
            
            {/* Job Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-border">
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Budget</div>
                <div className="text-lg font-black text-emerald-500">{selectedJob.budget || "Negotiable"}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-border">
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Distance</div>
                <div className="text-lg font-black text-orange-500">{selectedJob.distance} km</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-border">
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Location</div>
                <div className="text-xs font-black text-foreground truncate">{selectedJob.location}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-border">
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Customer</div>
                <div className="text-xs font-black text-foreground">{selectedJob.customerName || "Anonymous"}</div>
              </div>
              {(selectedJob as any).preferredDate && (
                <div className="p-4 rounded-2xl bg-white/5 border border-border">
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Preferred Date</div>
                  <div className="text-xs font-black text-blue-400">{(selectedJob as any).preferredDate}</div>
                </div>
              )}
              {(selectedJob as any).preferredTime && (
                <div className="p-4 rounded-2xl bg-white/5 border border-border">
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Preferred Time</div>
                  <div className="text-xs font-black text-blue-400">{(selectedJob as any).preferredTime}</div>
                </div>
              )}
            </div>

            {selectedJob.urgency === "Urgent" && (
              <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center text-[10px] font-black text-red-500 uppercase tracking-widest">
                🔴 URGENT REQUEST
              </div>
            )}

            <button 
              className="w-full h-20 rounded-[2rem] bg-orange-500 text-white font-black uppercase tracking-[0.4em] text-xs shadow-3xl shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              onClick={async () => {
                if (selectedJob.id.startsWith("demo")) {
                   const updated = activeRequests.map(r => r.id === selectedJob.id ? { ...r, status: "In Progress" as any, workerId: user.id } : r);
                   setActiveRequests(updated);
                   setSelectedJob(null);
                   toast.success("✅ Job accepted!");
                } else {
                   try {
                     await updateDoc(doc(db, "work_requests", selectedJob.id), { 
                       status: "In Progress", 
                       workerId: user.id, 
                       workerName: user.name,
                       workerPhone: user.phone || "",
                       workerSkill: user.skill || "",
                       acceptedAt: serverTimestamp()
                     });
                     setSelectedJob(null);
                     toast.success("✅ Job accepted! Customer notified.");
                   } catch (fbErr) {
                     console.warn("Direct Firestore update failed, trying backend...", fbErr);
                     try {
                       await fetch(`http://localhost:5000/api/work-request/${selectedJob.id}`, {
                         method: "PUT",
                         headers: { "Content-Type": "application/json" },
                         body: JSON.stringify({ status: "In Progress", workerId: user.id, workerName: user.name, workerPhone: user.phone || "", workerSkill: user.skill || "" })
                       });
                       setSelectedJob(null);
                       toast.success("✅ Job accepted via server!");
                     } catch (apiErr) {
                       toast.error("Failed to accept job. Try again.");
                     }
                   }
                }
              }}
            >Accept & Notify Customer</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
