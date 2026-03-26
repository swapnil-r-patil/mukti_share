import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Smartphone, 
  Clock, 
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  Slash,
  Eye,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AdminFraud = () => {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { user: currentUser } = useAuth();
  const isDemo = currentUser?.isDemo;

  useEffect(() => {
    const q = query(collection(db, "verifications"), orderBy("timestamp", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlerts(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRemoveAll = async () => {
    if (isDemo) return toast.error("Action disabled in demo mode");
    if (!window.confirm("Are you sure you want to permanently clear ALL fraud records?")) return;
    try {
      const { deleteDoc } = await import("firebase/firestore");
      const promises = alerts.map(a => deleteDoc(doc(db, "verifications", a.id)));
      await Promise.all(promises);
      toast.success("All fraud records cleared.");
    } catch(err: any) {
      toast.error("Action failed: " + err.message);
    }
  };

  const handleUnblockAll = async () => {
    if (isDemo) return toast.error("Action disabled in demo mode");
    if (!window.confirm("Are you sure you want to unblock ALL workers shown here?")) return;
    try {
      const promises: any[] = [];
      alerts.forEach(a => {
        if (a.fraudAction === "blocked") {
          promises.push(updateDoc(doc(db, "verifications", a.id), { fraudAction: null }));
        }
        if (a.workerId) {
          // Unblock the worker in users collection
          promises.push(updateDoc(doc(db, "users", a.workerId), {
            isBanned: false,
            status: "active",
            accountStatus: "active"
          }));
        }
      });
      await Promise.all(promises);
      toast.success("All workers have been unblocked.");
    } catch(err: any) {
      toast.error("Action failed: " + err.message);
    }
  };
  
  const handleAction = async (id: string, action: string, workerId?: string) => {
    if (isDemo) {
      toast.error('Action disabled in demo mode');
      return;
    }
    
    try {
      if (action === "ignore") {
        await updateDoc(doc(db, "verifications", id), { fraudAction: "ignored" });
        if (workerId) {
          await updateDoc(doc(db, "users", workerId), {
            isBanned: false,
            status: "active",
            accountStatus: "active"
          });
        }
        toast.success("Alert ignored and worker ban removed");
      } else if (action === "unblock") {
        await updateDoc(doc(db, "verifications", id), { fraudAction: null });
        if (workerId) {
          await updateDoc(doc(db, "users", workerId), {
            isBanned: false,
            status: "active",
            accountStatus: "active"
          });
        }
        toast.success("Worker has been unblocked");
      } else if (action === "review") {
        await updateDoc(doc(db, "verifications", id), { fraudAction: "review" });
        toast.success("Marked for manual review");
      } else if (action === "block") {
        await updateDoc(doc(db, "verifications", id), { fraudAction: "blocked" });
        if (workerId) {
          await updateDoc(doc(db, "users", workerId), {
            isBanned: true,
            status: "banned",
            accountStatus: "suspended"
          });
        }
        toast.error("Source blocked and suspended");
      } else if (action === "delete") {
        // Confirm before delete
        if (window.confirm("Are you sure you want to permanently clear this fraud record?")) {
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "verifications", id));
          toast.success("Fraud record cleared permanently");
        }
      }
    } catch(err: any) {
       toast.error("Action failed: " + err.message);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground italic tracking-tighter uppercase">{t("admin_sidebar_fraud")}</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Real-time anomaly detection & security enforcement</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
           <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-2xl hidden md:flex items-center gap-2 text-[9px] font-black text-orange-500 uppercase tracking-widest">
             <ShieldAlert size={14} className="animate-pulse" /> Auto-Suspend Active
           </div>
           
           <button onClick={handleUnblockAll} className="bg-background border border-border px-5 py-3 rounded-2xl flex items-center gap-2 text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/20 transition-all font-black uppercase text-[10px] tracking-widest active:scale-95">
              <CheckCircle size={16} /> Unblock All
           </button>
           <button onClick={handleRemoveAll} className="bg-background border border-border px-5 py-3 rounded-2xl flex items-center gap-2 text-muted-foreground hover:text-red-500 hover:border-red-500/20 transition-all font-black uppercase text-[10px] tracking-widest active:scale-95">
              <Trash2 size={16} /> Clear All
           </button>

           <div className="bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={20} />
              <div className="text-xl font-black text-red-500">{alerts.filter(a => (a.muktiScore || 100) < 60).length}</div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">High Risk Alerts</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-muted-foreground font-black uppercase tracking-widest text-xs">
            Scanning Transaction Patterns...
          </div>
        ) : alerts.filter(alert => alert.fraudAction !== "ignored").map((alert, i) => (
          <div key={alert.id} className={`group rounded-[2.5rem] bg-card border ${alert.fraudAction === 'review' ? 'border-blue-500/50' : alert.fraudAction === 'blocked' ? 'border-red-500/50 opacity-50' : 'border-border'} p-8 hover:border-red-500/20 transition-all shadow-2xl overflow-hidden relative`}>
            {alert.fraudAction && (
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
            )}
            <div className="absolute top-0 right-0 p-8 flex gap-3">
               <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                 alert.fraudAction === 'review' ? 'bg-blue-500 text-white border-blue-500' :
                 alert.fraudAction === 'blocked' ? 'bg-red-800 text-white border-red-800' :
                 (alert.muktiScore || 100) < 40 ? 'bg-red-500 text-white border-red-500' : 
                 (alert.muktiScore || 100) < 70 ? 'bg-orange-500 text-white border-orange-500' : 'bg-yellow-500 text-white border-yellow-500'
               }`}>
                 {alert.fraudAction === 'review' ? 'UNDER REVIEW' : alert.fraudAction === 'blocked' ? 'BLOCKED' : (alert.muktiScore || 100) < 40 ? 'CRITICAL' : (alert.muktiScore || 100) < 70 ? 'SUSPICIOUS' : 'MONITOR'}
               </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
               <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="h-14 w-14 rounded-2xl bg-secondary border border-border flex items-center justify-center font-black text-muted-foreground group-hover:scale-110 transition-transform italic">
                        {alert.workerName?.[0] || 'W'}
                     </div>
                     <div>
                        <div className="text-lg font-black text-foreground italic tracking-tight">{alert.workerName || "MUKTI-WORKER"}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target for Review ID: {alert.workerId?.slice(0, 8)}...</div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="flex items-center gap-3 bg-secondary/50 p-4 rounded-2xl border border-border">
                        <MapPin size={16} className="text-red-500" />
                        <div className="space-y-0.5">
                           <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Location</div>
                           <div className="text-xs font-bold text-foreground/80">{alert.location || 'Unknown'}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 bg-secondary/50 p-4 rounded-2xl border border-border">
                        <Smartphone size={16} className="text-red-500" />
                        <div className="space-y-0.5">
                           <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Mukti Score</div>
                           <div className="text-xs font-bold text-foreground/80">{alert.muktiScore ?? 'N/A'}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 bg-secondary/50 p-4 rounded-2xl border border-border">
                        <Clock size={16} className="text-red-500" />
                        <div className="space-y-0.5">
                           <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Timestamp</div>
                           <div className="text-xs font-bold text-foreground/80">{alert.timestamp ? new Date(alert.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 bg-secondary/50 p-4 rounded-2xl border border-border">
                        <MessageSquare size={16} className="text-red-500" />
                        <div className="space-y-0.5">
                           <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Rating</div>
                           <div className="text-xs font-bold text-foreground/80">{alert.rating ? `${alert.rating}/5` : 'N/A'}</div>
                        </div>
                     </div>
                  </div>
               </div>

                 <div className="w-full lg:w-72 space-y-3 pt-4 lg:pt-0">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Tactical Response</div>
                  
                  {alert.fraudAction === 'blocked' ? (
                    <div className="space-y-3">
                      <div className="w-full h-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 font-black text-[10px] uppercase tracking-widest">
                        <Slash size={14} className="mr-2" /> SYSTEM BLOCKED
                      </div>
                      <button 
                        onClick={() => handleAction(alert.id, "unblock", alert.workerId)} 
                        className="w-full h-12 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                        Unblock Worker
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alert.fraudAction !== 'review' && (
                        <button onClick={() => handleAction(alert.id, "review", alert.workerId)} className="w-full h-12 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                          Mark Under Review
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleAction(alert.id, "block", alert.workerId)} className="h-12 rounded-xl border border-red-500/30 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95">
                          Block Source
                        </button>
                        <button onClick={() => handleAction(alert.id, "ignore", alert.workerId)} className="h-12 rounded-xl border border-border text-muted-foreground font-black text-[10px] uppercase tracking-widest hover:bg-secondary transition-all active:scale-95">
                          Ignore Alert
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleAction(alert.id, "delete")} 
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-background border border-border font-bold text-[10px] text-muted-foreground uppercase tracking-widest hover:text-red-500 hover:border-red-500/20 transition-all opacity-50 hover:opacity-100"
                  >
                    <Trash2 size={12} /> Clear Alert Record
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFraud;
