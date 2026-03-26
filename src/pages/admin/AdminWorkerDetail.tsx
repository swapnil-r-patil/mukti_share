import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  Wrench,
  MapPin,
  Shield,
  Star,
  Briefcase,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Award,
  Clock,
  BadgeCheck,
  AlertTriangle,
  History,
  UserCheck,
  Fingerprint,
} from "lucide-react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { calculateTrustScore } from "@/utils/trustEngine";
import { calculateIncomeStats } from "@/utils/financial";

const API_BASE_URL = "http://localhost:5000";

const AdminWorkerDetail = () => {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<any>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);

  useEffect(() => {
    if (!workerId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch user doc
        const userSnap = await getDoc(doc(db, "users", workerId));
        if (userSnap.exists()) {
          setWorker({ id: userSnap.id, ...userSnap.data() });
        }

        // Fetch verifications for this worker
        // NOTE: No orderBy here to avoid Firestore composite index requirement
        // (same pattern used in AdminWorkers.tsx). We sort in-memory below.
        const vQuery = query(
          collection(db, "verifications"),
          where("workerId", "==", workerId)
        );
        const vSnap = await getDocs(vQuery);
        const vList = vSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              timestamp: data.timestamp
                ? (data.timestamp as Timestamp).toDate()
                : new Date(),
            };
          })
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setVerifications(vList);
      } catch (err) {
        console.error("Error fetching worker details:", err);
        toast.error("Failed to load worker details.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workerId]);

  // ── Unified Metric Engine ──
  const workerMetrics = React.useMemo(() => {
    if (!worker || verifications.length === 0) {
      return {
        trustScore: worker?.trustScore || 0,
        avgRating: 0,
        income: calculateIncomeStats([]),
        repeatCount: 0
      };
    }

    // Calculate real-time trust score from engine
    const computedTrust = calculateTrustScore(worker, verifications);
    
    // Calculate financial stats
    const income = calculateIncomeStats(verifications);

    // Calculate repeating customers
    const customerIds = verifications.map(v => v.customerId);
    const repeatCount = customerIds.filter((id, i) => customerIds.indexOf(id) !== i).length;

    return {
      trustScore: computedTrust,
      avgRating: income.totalJobs > 0 ? verifications.reduce((s, v) => s + (v.rating || 0), 0) / verifications.length : 0,
      income,
      repeatCount
    };
  }, [worker, verifications]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!workerId) return;
    setActionLoading(true);
    try {
      const userRef = doc(db, "users", workerId);
      const userUpdate: any = {
        isVerifiedByAdmin: action === "approve",
        status: action === "approve" ? "verified" : "not verified",
      };
      if (action === "reject" && rejectReason) {
        userUpdate.rejectionReason = rejectReason;
        userUpdate.rejectedAt = new Date();
      }
      await updateDoc(userRef, userUpdate);

      // Try to update verification_requests too
      try {
        const reqQuery = query(
          collection(db, "verification_requests"),
          where("workerId", "==", workerId),
          where("status", "==", "pending")
        );
        const reqSnap = await getDocs(reqQuery);
        for (const reqDoc of reqSnap.docs) {
          await updateDoc(reqDoc.ref, {
            status: action === "approve" ? "verified" : "rejected",
            ...(action === "reject" && rejectReason
              ? { rejectionReason: rejectReason, rejectedAt: new Date() }
              : {}),
          });
        }
      } catch (_) {
        // non-blocking
      }

      // Backend notify (optional)
      try {
        await fetch(`${API_BASE_URL}/api/admin/process-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId, action, reason: rejectReason }),
        });
      } catch (_) {}

      if (action === "approve") {
        toast.success("✅ Worker verified! Report access unlocked.");
      } else {
        toast.error(`Worker rejected: ${rejectReason || "No reason"}`);
      }

      // Update local worker state
      setWorker((prev: any) => ({
        ...prev,
        isVerifiedByAdmin: action === "approve",
        status: action === "approve" ? "verified" : "not verified",
      }));
      setShowRejectPanel(false);
      setRejectReason("");
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          Loading Worker Profile...
        </p>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-6 text-center">
        <AlertTriangle size={48} className="text-red-500" />
        <div>
          <h2 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">
            Worker Not Found
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            No data found for worker ID: {workerId}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-2xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const statusColor =
    worker.status === "verified"
      ? "emerald"
      : worker.status === "not verified"
      ? "red"
      : "orange";

  const statusLabel =
    worker.status === "verified"
      ? "Verified"
      : worker.status === "not verified"
      ? "Rejected"
      : "Pending";

  const memberSince = worker.createdAt
    ? new Date(
        (worker.createdAt as Timestamp)?.toDate
          ? (worker.createdAt as Timestamp).toDate()
          : worker.createdAt
      ).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "N/A";

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-700">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="h-11 w-11 flex items-center justify-center rounded-2xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">
              Worker Profile
            </h1>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
              Full identity & history review for admin
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            statusColor === "emerald"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : statusColor === "red"
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : "bg-orange-500/10 text-orange-400 border-orange-500/20"
          }`}
        >
          {statusLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Left Column ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Avatar Card */}
          <div className="relative rounded-[2.5rem] bg-card border border-border p-10 flex flex-col items-center text-center overflow-hidden shadow-2xl group">
            <div className="absolute -top-16 -right-16 h-40 w-40 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-all duration-1000" />

            <div className="relative mb-6">
              <div className="h-28 w-28 rounded-[2rem] bg-orange-500 flex items-center justify-center text-5xl font-black text-white italic shadow-[0_0_40px_rgba(249,115,22,0.3)] border-4 border-white/10 overflow-hidden">
                {worker.photo ? (
                  <img
                    src={worker.photo}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (worker.name || "?").charAt(0)
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 p-2.5 rounded-xl bg-secondary border border-orange-500/30 text-orange-500 shadow-xl italic font-black">
                <Award size={18} />
              </div>
            </div>

            <h2 className="text-2xl font-black text-foreground italic tracking-tighter uppercase">
              {worker.name || "Unknown"}
            </h2>
            {worker.skill && (
              <span className="mt-1 text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] italic">
                {worker.skill}
              </span>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border ${
                  worker.isVerifiedByAdmin
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                }`}
              >
                {worker.isVerifiedByAdmin ? (
                  <BadgeCheck size={12} />
                ) : (
                  <Clock size={12} />
                )}
                <span>
                  {worker.isVerifiedByAdmin ? "Admin Verified" : "Awaiting Review"}
                </span>
              </div>
            </div>
          </div>

          {/* Registry Metadata */}
          <div className="rounded-[2.5rem] bg-card border border-border shadow-2xl overflow-hidden">
            <div className="px-8 py-4 border-b border-border bg-secondary/30 font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground italic">
              Core Registry Metadata
            </div>
            <div className="p-4 space-y-1.5">
              {[
                { icon: Fingerprint, label: "Worker ID", value: worker.id },
                { icon: Phone, label: "Phone", value: worker.phone || "N/A" },
                { icon: Wrench, label: "Skill", value: worker.skill || "Generalist" },
                { icon: MapPin, label: "Location", value: worker.location || "Bihar, India" },
                { icon: CalendarDays, label: "Member Since", value: memberSince },
                {
                  icon: UserCheck,
                  label: "Employer",
                  value: worker.employerName || "Independent",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-secondary transition-all group border border-transparent hover:border-border italic"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/10 shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-0.5 opacity-60">
                      {item.label}
                    </div>
                    <div className="text-xs font-black text-foreground tracking-tight truncate">
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Trust Metrics */}
          {/* ── Professional Metric Dashboard ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 01. ACTIVITY LOG */}
            <div className="rounded-[2.5rem] bg-card border border-border p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                 <History size={40} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-2 mb-6">
                 <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                 </div>
                 <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] font-serif italic">01. Activity Log</span>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{workerMetrics.income.totalJobs}</div>
                  <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Units</div>
                </div>
                <div className="h-10 w-[1px] bg-border" />
                <div className="space-y-1 text-center">
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{workerMetrics.income.activeMonths}</div>
                  <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Months</div>
                </div>
                <div className="h-10 w-[1px] bg-border" />
                <div className="space-y-1 text-right">
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{workerMetrics.repeatCount}</div>
                  <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Repeat</div>
                </div>
              </div>
            </div>

            {/* 02. PRECISION METRICS */}
            <div className="rounded-[2.5rem] bg-card border border-border p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Shield size={40} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-2 mb-6">
                 <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                 </div>
                 <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] font-serif italic">02. Precision Metrics</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{workerMetrics.avgRating.toFixed(1)}</div>
                  <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Rating Avg</div>
                </div>
                
                <div className="relative h-16 w-16">
                  <svg className="h-full w-full" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" className="text-secondary" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray={`${workerMetrics.trustScore}, 100`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black text-foreground italic">{workerMetrics.trustScore}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 03. CAPITAL PROFILE */}
            <div className="rounded-[2.5rem] bg-card border border-border p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                 <TrendingUp size={40} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-2 mb-6">
                 <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                 </div>
                 <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] font-serif italic">03. Capital Profile</span>
              </div>

              <div className="space-y-4">
                <div>
                   <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 italic opacity-60">Escrow Projection</div>
                   <div className="text-3xl font-black text-foreground italic tracking-tighter">
                      ₹{workerMetrics.income.incomeRange.min} - ₹{workerMetrics.income.incomeRange.max}
                   </div>
                </div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] italic">
                   Indexed at ₹{Math.round(workerMetrics.income.perJobIncome)} per unit
                </div>
              </div>
            </div>

            {/* 04. CREDIT ELIGIBILITY */}
            <div className="rounded-[2.5rem] bg-card border border-border p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                 <BadgeCheck size={40} className="text-orange-500" />
              </div>
              <div className="flex items-center gap-2 mb-6">
                 <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                 </div>
                 <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] font-serif italic">04. Credit Eligibility</span>
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-1">
                   <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 italic">Optimal EMI</div>
                   <div className="text-2xl font-black text-foreground italic tracking-tighter">₹{Math.round(workerMetrics.income.safeEMI)}/mo</div>
                </div>
                <div className="text-right space-y-1">
                   <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 italic">Facility Range</div>
                   <div className="text-2xl font-black text-orange-500 italic tracking-tighter">₹{workerMetrics.income.loanRange.min} - ₹{workerMetrics.income.loanRange.max}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Approve / Reject Actions ── */}
          {worker.status !== "verified" && (
            <div className="rounded-[2.5rem] bg-card border border-border p-8 shadow-xl space-y-4">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">
                Admin Decision
              </div>

              {!showRejectPanel ? (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowRejectPanel(true)}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-secondary text-muted-foreground border border-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-40 italic active:scale-95 shadow-sm"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/20 hover:scale-[1.02] active:scale-95 transition-all text-[11px] font-black uppercase tracking-widest disabled:opacity-40 italic"
                  >
                    {actionLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}{" "}
                    Approve
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Select or type a rejection reason
                  </p>
                  <div className="space-y-2">
                    {[
                      "Incomplete documents",
                      "Blurry photo / Low quality",
                      "Unverifiable identity",
                      "Suspicious activity detected",
                      "Duplicate account",
                    ].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRejectReason(r)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                          rejectReason === r
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Or type a custom reason..."
                    rows={2}
                    className="w-full rounded-xl bg-secondary border border-border p-4 text-sm text-foreground font-bold outline-none focus:border-red-500 transition-all resize-none italic shadow-inner placeholder:text-muted-foreground/30"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setShowRejectPanel(false);
                        setRejectReason("");
                      }}
                      className="py-3 rounded-xl bg-secondary text-muted-foreground border border-border text-[10px] font-black uppercase tracking-widest hover:text-foreground transition-all active:scale-95 italic"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={!rejectReason || actionLoading}
                      className="py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-30 active:scale-95 italic"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {worker.status === "verified" && (
            <div className="rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 p-8 flex items-center gap-4 shadow-xl italic">
              <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 shadow-inner">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="text-sm font-black text-emerald-500 uppercase tracking-tight">
                  Worker Approved
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                  This worker has been verified by admin. Report access is unlocked.
                </div>
              </div>
            </div>
          )}

          {/* ── Work History ── */}
          <div className="rounded-[2.5rem] bg-card border border-border shadow-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-border bg-secondary/30 flex items-center gap-3 italic">
              <History size={16} className="text-orange-500" />
              <span className="font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Work History
              </span>
              <span className="ml-auto text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">
                {verifications.length} records
              </span>
            </div>

            {verifications.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <Briefcase size={36} className="mx-auto text-muted-foreground/10" />
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] italic">
                  No verified jobs on record yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {verifications.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-4 px-8 py-5 hover:bg-secondary/50 transition-all font-black italic"
                  >
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/10 shrink-0 shadow-inner">
                      <Briefcase size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-foreground uppercase tracking-tight truncate">
                        {v.workerName || v.customerName || "Verification Job"}
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mt-0.5 opacity-60">
                        <Clock size={9} />
                        {v.timestamp?.toLocaleDateString?.("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }) || "N/A"}
                        {v.workerSkill && <span className="text-orange-500/70">· {v.workerSkill}</span>}
                      </div>
                      {v.comment && <div className="text-[10px] text-muted-foreground italic truncate mt-0.5 opacity-50">"{v.comment}"</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={
                            s <= (v.rating || 0)
                              ? "text-orange-500 fill-orange-500"
                              : "text-secondary"
                          }
                        />
                      ))}
                      <span className="text-[10px] font-black text-muted-foreground ml-1 uppercase opacity-40">
                        {v.rating ? `${v.rating}/5` : "N/R"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWorkerDetail;
