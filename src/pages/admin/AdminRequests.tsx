import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User as UserIcon, 
  Phone, 
  Wrench,
  ShieldCheck,
  AlertCircle,
  Eye
} from "lucide-react";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  Timestamp, 
  orderBy,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

const API_BASE_URL = "http://localhost:5000";

const AdminRequests = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [explicitRequests, setExplicitRequests] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<{id: string; workerId: string; source: string; name: string} | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    // 1. Listen to explicit verification_requests collection
    const qReqs = query(
      collection(db, "verification_requests"),
      where("status", "==", "pending")
    );

    // 2. Listen to users who are 'pending' but might have missed the request doc
    const qUsers = query(
      collection(db, "users"),
      where("status", "==", "pending")
    );

    const unsubReqs = onSnapshot(qReqs, (snap) => {
      const list = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          source: "collection",
          ...d,
          // Robust workerId mapping
          workerId: d.workerId || d.uid || d.userId || "", 
          workerName: d.workerName || d.name || "Unknown Worker",
          workerPhone: d.workerPhone || d.phone || "No Phone",
          workerSkill: d.workerSkill || d.skill || "Not Specified",
          timestamp: (d.timestamp as Timestamp)?.toDate() || new Date()
        };
      });
      setExplicitRequests(list);
    });

    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const list = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: `usr-${doc.id}`,
          workerId: doc.id,
          workerName: d.name || "Unknown Worker",
          workerPhone: d.phone || "No Phone",
          workerSkill: d.skill || "Not Specified",
          status: "pending",
          source: "profile",
          timestamp: (d.lastActive as Timestamp)?.toDate() || new Date()
        };
      });
      setPendingUsers(list);
    });

    return () => {
      unsubReqs();
      unsubUsers();
    };
  }, []);

  // Merge sources and deduplicate by workerId
  useEffect(() => {
    const combined = [...explicitRequests];
    
    // Add pending users who aren't already in explicitRequests
    pendingUsers.forEach(u => {
      if (!combined.find(r => r.workerId === u.workerId)) {
        combined.push(u);
      }
    });

    const sorted = combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setRequests(sorted);
    setLoading(false);
  }, [explicitRequests, pendingUsers]);

  const handleAction = async (requestId: string, workerId: string, action: "approve" | "reject", source: string, reason?: string) => {
    if (!workerId || workerId === "") {
      toast.error("Critical: Worker ID is missing from this request. Cannot update database.");
      return;
    }

    try {
      setLoading(true);

      // ===== PRIMARY PATH: Direct Firebase Client SDK =====
      const userRef = doc(db, "users", workerId);
      const userUpdate: any = { 
        isVerifiedByAdmin: action === "approve",
        status: action === "approve" ? "verified" : "not verified" 
      };
      if (action === "reject" && reason) {
        userUpdate.rejectionReason = reason;
        userUpdate.rejectedAt = new Date();
      }
      await updateDoc(userRef, userUpdate);

      // Clean up the request document if it came from the collection
      if (source === "collection" && !requestId.startsWith('usr-') && !requestId.startsWith('local-')) {
        const reqRef = doc(db, "verification_requests", requestId);
        if (action === "approve") {
          await updateDoc(reqRef, { status: "verified" });
        } else {
          await updateDoc(reqRef, { 
            status: "rejected",
            rejectionReason: reason || "No reason provided",
            rejectedAt: new Date()
          });
        }
      }

      if (action === "approve") {
        toast.success("✅ Worker verified! Firebase updated & report unlocked.");
      } else {
        toast.error(`Worker rejected: ${reason || 'No reason'}`);
      }

      // ===== SECONDARY: Notify backend for local data cleanup =====
      try {
        await fetch(`${API_BASE_URL}/api/admin/process-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, workerId, action, source, reason }),
        });
      } catch (_) {
        // Backend notification is optional — Firebase is already updated
      }

      setRejectTarget(null);
      setRejectReason("");
    } catch (err: any) {
      console.error("Firebase update failed:", err);
      toast.error(`Firebase update failed: ${err.message}. Please check your Firestore security rules.`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("ARE YOU SURE? This will permanently delete ALL verification requests from the database!")) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/clear-all-requests`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to clear requests");

      toast.success("Database Purged: All requests removed.");
      setRequests([]);
    } catch (err) {
      console.error("Clear failed:", err);
      toast.error("Cleanup failed. Check backend connectivity.");
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground italic tracking-tighter uppercase">Verification Requests</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Manage manual worker identity & report access approval</p>
        </div>
        <button 
          onClick={handleClearAll}
          className="h-10 px-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
        >
          Purge All Requests
        </button>
      </div>

      {loading ? (
        <div className="bg-card rounded-[3rem] border border-border p-20 flex flex-col items-center justify-center gap-4 shadow-xl">
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Scanning Request Queue...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-card rounded-[3rem] border border-border p-20 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
           <div className="h-16 w-16 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground/30">
              <CheckCircle2 size={32} />
           </div>
           <div className="space-y-1">
              <h3 className="text-xl font-black text-foreground italic tracking-tighter uppercase">All Caught Up!</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No pending verification requests at the moment.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((req) => (
            <div key={req.id} className="group relative bg-card rounded-[2.5rem] border border-border p-8 hover:border-orange-500/30 transition-all shadow-2xl overflow-hidden font-black italic">
              <div className="absolute -top-10 -right-10 h-32 w-32 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-all duration-700" />
              
              <div className="mb-6 flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center text-orange-500 shadow-inner italic">
                    <UserIcon size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-foreground uppercase tracking-tight">{req.workerName}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> {req.timestamp.toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-orange-500/10">
                  {req.source === 'profile' ? 'URGENT' : 'PENDING'}
                </div>
              </div>

              <div className="space-y-4 mb-8 relative z-10">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border">
                  <Phone size={14} className="text-muted-foreground" />
                  <span className="text-[11px] text-foreground/70 font-bold">{req.workerPhone}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border">
                  <Wrench size={14} className="text-muted-foreground" />
                  <span className="text-[11px] text-foreground/70 font-bold uppercase tracking-wider">{req.workerSkill}</span>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <button
                  onClick={() => navigate(`/admin/worker/${req.workerId}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-foreground/80 border border-border hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/20 transition-all active:scale-95"
                >
                  <Eye size={15} /> <span className="text-[10px] uppercase tracking-widest font-black">View Profile</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setRejectTarget({ id: req.id, workerId: req.workerId, source: req.source, name: req.workerName })}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-muted-foreground border border-border hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95"
                  >
                    <XCircle size={16} /> <span className="text-[10px] uppercase tracking-widest">Reject</span>
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, req.workerId, "approve", req.source)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <ShieldCheck size={16} /> <span className="text-[10px] uppercase tracking-widest">Approve</span>
                  </button>
                </div>
              </div>

              {/* Security Badge Overlay */}
              <div className="absolute bottom-4 right-8 opacity-5">
                <AlertCircle size={80} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/50 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-card rounded-[2.5rem] border border-red-500/20 p-8 shadow-2xl animate-fade-up">
            <h3 className="text-xl font-black text-foreground italic tracking-tighter uppercase mb-2">Reject {rejectTarget.name}</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">This reason will be shown to the worker</p>
            
            <div className="space-y-3 mb-6">
              {['Incomplete documents', 'Blurry photo / Low quality', 'Unverifiable identity', 'Suspicious activity detected', 'Duplicate account'].map(r => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    rejectReason === r ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >{r}</button>
              ))}
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Or type a custom reason..."
              rows={2}
              className="w-full rounded-xl bg-secondary border border-border p-4 text-sm text-foreground font-bold outline-none focus:border-red-500 transition-all resize-none mb-6 placeholder:text-muted-foreground/30 shadow-inner"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                className="py-3 rounded-xl bg-secondary text-muted-foreground border border-border text-[10px] font-black uppercase tracking-widest hover:text-foreground hover:border-foreground/30 transition-all active:scale-95"
              >Cancel</button>
              <button
                onClick={() => handleAction(rejectTarget.id, rejectTarget.workerId, "reject", rejectTarget.source, rejectReason)}
                disabled={!rejectReason}
                className="py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-30 active:scale-95"
              >Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRequests;
