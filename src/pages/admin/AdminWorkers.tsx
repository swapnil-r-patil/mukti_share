import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Award, 
  FileText,
  ArrowUpDown,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@/types/auth";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { calculateEstimatedIncome, calculateLoanEligibility, getFraudRiskLevel } from "@/utils/adminLogic";
import { toast } from "sonner";

const AdminWorkers = () => {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSkill, setFilterSkill] = useState("All");
  const [loading, setLoading] = useState(true);

  const { user: currentUser } = useAuth();
  const isDemo = currentUser?.isDemo;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "users"), where("role", "==", "worker"));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      if (list.length === 0) {
        setWorkers([]);
        setLoading(false);
        return;
      }

      // Always show real data from Firebase
      setWorkers(list.map(w => ({ ...w, jobCount: 0 }))); // Initial view
      setLoading(false);
      
      // Background enrichment
      const fetchJobCounts = async () => {
        try {
          const enriched = await Promise.all(list.map(async (worker) => {
            const vQ = query(collection(db, "verifications"), where("workerId", "==", worker.id));
            const vSnap = await getDocs(vQ);
            return { ...worker, jobCount: vSnap.size };
          }));
          setWorkers(enriched);
        } catch (err) {
          console.warn("Job count enrichment failed:", err);
        }
      };
      fetchJobCounts();
    }, (err) => {
      console.error("Firestore Worker Sync Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemo]);

  const handleAction = async (workerId: string, action: string) => {
    try {
      if (action === "suspend") {
        await updateDoc(doc(db, "users", workerId), { status: "suspended" });
        toast.error("Worker account suspended");
      } else if (action === "approve") {
        await updateDoc(doc(db, "users", workerId), { status: "verified" });
        toast.success("Worker account verified");
      } else if (action === "badge") {
        await updateDoc(doc(db, "users", workerId), { badges: ["Verified Pro"] });
        toast.success("Verified Badge assigned");
      } else if (action === "verify" || action === "approve") {
        await updateDoc(doc(db, "users", workerId), { 
          isVerifiedByAdmin: true,
          status: "verified"
        });
        toast.success("Worker identity verified");
      } else if (action === "unverify") {
        await updateDoc(doc(db, "users", workerId), { 
          isVerifiedByAdmin: false,
          status: "not verified"
        });
        toast.warning("Worker verification revoked");
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          w.skill?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSkill = filterSkill === "All" || w.skill?.includes(filterSkill);
    return matchesSearch && matchesSkill;
  });

  const handleResetAll = async () => {
    if (!window.confirm("RESET ALL? This will set ALL workers as UNVERIFIED. Are you sure?")) return;
    
    try {
      setLoading(true);
      const q = query(collection(db, "users"), where("role", "==", "worker"));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((workerDoc) => {
        batch.update(workerDoc.ref, { 
          isVerifiedByAdmin: false,
          status: "not verified"
        });
      });
      
      await batch.commit();
      toast.success(`Reset complete: ${snapshot.size} workers unverified.`);
    } catch (err) {
      console.error("Reset all failed:", err);
      toast.error("Global reset failed. Check permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">{t("admin_sidebar_workers")}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Registry workforce management & financial profiling</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleResetAll}
            className="h-12 px-6 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
          >
            Reset All Verifications
          </button>
          <button className="h-12 px-6 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-slate-900/50 p-6 rounded-[2rem] border border-white/5">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or skill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-orange-500 transition-all"
          />
        </div>
        <select 
          value={filterSkill}
          onChange={(e) => setFilterSkill(e.target.value)}
          className="bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500 min-w-[150px] font-bold uppercase tracking-wider"
        >
          <option value="All">All Skills</option>
          <option value="Maid">Maid</option>
          <option value="Electrician">Electrician</option>
          <option value="Plumber">Plumber</option>
        </select>
        <button className="px-6 py-3 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-600/20">
          Apply Filters
        </button>
      </div>

      {/* Workers Table */}
      <div className="bg-slate-900 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Worker Profile</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Location / Skill</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Mukti Score</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Financal Profile</th>
                <th className="px-6 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Risk</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="animate-pulse text-slate-500 font-bold uppercase tracking-widest text-[10px]">Synthesizing Worker Registry...</div>
                  </td>
                </tr>
              ) : filteredWorkers.map((worker: any) => {
                // Use synced real income if available, otherwise estimate
                const minInc = worker.minIncome || 0;
                const maxInc = worker.maxIncome || 0;
                const hasRealData = minInc > 0;
                
                const estIncome = hasRealData ? (minInc + maxInc) / 2 : calculateEstimatedIncome(worker, worker.jobCount || 0);
                const eligibility = calculateLoanEligibility(hasRealData ? maxInc : estIncome);
                const risk = getFraudRiskLevel(worker.muktiScore || 0);
                
                return (
                  <tr key={worker.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-slate-400 group-hover:scale-110 transition-transform">
                          {worker.photo ? <img src={worker.photo} className="h-full w-full rounded-2xl object-cover" /> : worker.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-black text-white">{worker.name}</div>
                            {worker.isVerifiedByAdmin && (
                              <div className="text-emerald-500" title="Admin Verified">
                                <CheckCircle2 size={12} fill="currentColor" className="fill-emerald-500/20" />
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{worker.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-xs font-bold text-white uppercase tracking-wider">{worker.skill || "N/A"}</div>
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{worker.location || "N/A"}</div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className={`inline-block px-3 py-1 rounded-lg font-black text-sm ${
                        (worker.muktiScore || 0) > 80 ? 'text-emerald-500 bg-emerald-500/10' : 
                        (worker.muktiScore || 0) > 50 ? 'text-orange-500 bg-orange-500/10' : 'text-red-500 bg-red-500/10'
                      }`}>
                        {worker.muktiScore || 0}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600 uppercase leading-none">{hasRealData ? 'Real:' : 'Est:'}</span>
                        <span className="text-sm font-black text-emerald-500">₹{Math.round(estIncome).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600 uppercase leading-none">Loan:</span>
                        <span className="text-[11px] font-black text-indigo-400">₹{eligibility.maxLoan.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                        risk === 'LOW' ? 'text-emerald-500' : risk === 'MEDIUM' ? 'text-orange-500' : 'text-red-500'
                      }`}>
                        <div className={`h-2 w-2 rounded-full ${
                          risk === 'LOW' ? 'bg-emerald-500' : risk === 'MEDIUM' ? 'bg-orange-500' : 'bg-red-500'
                        }`} />
                        {risk} Risk
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleAction(worker.id, "suspend")}
                          className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all shadow-sm"
                          title="Suspend Account"
                        >
                          <XCircle size={18} />
                        </button>
                        <button 
                          onClick={() => handleAction(worker.id, worker.isVerifiedByAdmin ? "unverify" : "verify")}
                          className={`p-2.5 rounded-xl transition-all shadow-sm ${worker.isVerifiedByAdmin ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-white/5 text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                          title={worker.isVerifiedByAdmin ? "Revoke Verification" : "Verify Worker"}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 transition-all shadow-sm">
                          <ExternalLink size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Mock */}
        <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Showing 1-10 of {filteredWorkers.length} workers
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg bg-white/5 text-slate-500 hover:text-white disabled:opacity-30" disabled>
              <ChevronLeft size={18} />
            </button>
            <button className="p-2 rounded-lg bg-white/5 text-slate-500 hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWorkers;
