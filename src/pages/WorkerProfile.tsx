import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DEMO_VERIFICATIONS, getAverageRating, DEMO_DASHBOARD_DATA } from "@/data/demoData";
import { calculateTrustScore, getTrustLevel, getTrustBadgeColor } from "@/utils/trustEngine";
import { calculateIncomeStats, parseBudgetToAmount } from "@/utils/financial";
import StarRating from "@/components/StarRating";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, Timestamp, where } from "firebase/firestore";
import {
  MapPin,
  Wrench,
  Phone,
  Shield,
  Star,
  Briefcase,
  CalendarDays,
  ChevronRight,
  LogOut,
  Edit2,
  User,
  UserCheck,
  History as LucideHistory,
  ArrowLeft,
  Award
} from "lucide-react";

const WorkerProfile = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [verifications, setVerifications] = useState<any[]>([]);
  const isDemoWorker = !!user?.isDemo;

  const [verificationsList, setVerificationsList] = useState<any[]>([]);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    if (isDemoWorker) {
      setVerifications(DEMO_VERIFICATIONS);
      return;
    }

    // Listen to official verifications
    const vQuery = query(
      collection(db, "verifications"), 
      where("workerId", "==", user.id),
      orderBy("timestamp", "desc")
    );
    
    const unsubscribeV = onSnapshot(vQuery, (snapshot) => {
      const vList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          };
        });
      setVerificationsList(vList);
    });

    // Listen to completed/active work_requests
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
          ...data,
          timestamp: data.completedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
          source: "work_request",
          amount: data.amount || (data.budget ? parseBudgetToAmount(data.budget) : 0),
        };
      });
      setCompletedJobs(wrList);
    });

    return () => {
      unsubscribeV();
      unsubscribeWR();
    };
  }, [user, isDemoWorker]);

  // Merge verifications + completed work_requests (Inconsistent data Fix)
  useEffect(() => {
    if (isDemoWorker) return;
    const merged = [...verificationsList];
    completedJobs.forEach(job => {
      if (!merged.find(v => v.id === job.id)) {
        merged.push(job);
      }
    });
    merged.sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    setVerifications(merged);
  }, [verificationsList, completedJobs, isDemoWorker]);

  // Unified Data Calculation (Matches Dashboard)
  const profileMetrics = useMemo(() => {
    if (isDemoWorker) return DEMO_DASHBOARD_DATA;
    if (!verifications || verifications.length === 0) {
      return {
        summary: { totalJobs: 0, activeMonths: 0, repeatCustomers: 0 },
        performance: { avgRating: 0 },
        financial: { totalEarnings: 0 },
        trust: { muktiScore: user?.muktiScore || 0 }
      };
    }

    const stats = calculateIncomeStats(verifications);
    const avgR = verifications.reduce((acc: number, v: any) => acc + (v.rating || 0), 0) / verifications.length;
    const score = calculateTrustScore(user, verifications);

    return {
      summary: { totalJobs: stats.totalJobs, activeMonths: stats.activeMonths, repeatCustomers: 0 },
      performance: { avgRating: Number(avgR.toFixed(1)) },
      financial: { totalEarnings: stats.totalEarnings },
      trust: { muktiScore: score }
    };
  }, [verifications, user, isDemoWorker]);

  const avgRating = profileMetrics.performance.avgRating;
  const muktiScore = profileMetrics.trust.muktiScore;

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editSkill, setEditSkill] = useState(user?.skill || "");
  const [editLocation, setEditLocation] = useState(user?.location || "");
  const [editPhoto, setEditPhoto] = useState(user?.photo || "");

  if (!user) {
    navigate("/");
    return null;
  }

  const memberSince = "October 2025";

  const infoItems = user.role === "worker" 
    ? (Number(user.workerType) === 0 ? [
        { icon: Phone, label: "Identity", value: user.phone },
        { icon: User, label: "Employer", value: user.employerName || "Direct Hire" },
        { icon: Phone, label: "Emergency contact", value: user.employerPhone || "000-000-0000" },
        { icon: CalendarDays, label: "Registry Date", value: memberSince },
      ] : [
        { icon: Phone, label: "Identity", value: user.phone },
        { icon: Wrench, label: "Prime Skill", value: user.skill || "Generalist" },
        { icon: MapPin, label: "Base Ops", value: user.location || "Patna Core" },
        { icon: CalendarDays, label: "Registry Date", value: memberSince },
      ])
    : [
        { icon: Phone, label: "Identity", value: user.phone },
        { icon: MapPin, label: "Verified Area", value: user.location || "Bihar, India" },
        { icon: CalendarDays, label: "Registry Date", value: memberSince },
        { icon: Shield, label: "Auth Status", value: "Verified Resident" },
      ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSave = () => {
    updateUser({ 
      name: editName, 
      skill: editSkill || undefined, 
      location: editLocation || undefined, 
      photo: editPhoto || undefined 
    });
    setIsEditing(false);
  };

  return (
    <div className="container mx-auto max-w-7xl py-6 md:py-10 pb-24 px-4 relative overflow-hidden">
       {/* Background Orbs */}
       <div className="absolute top-[5%] right-[-15%] h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />

        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-foreground flex items-center gap-3 sm:gap-4 uppercase">
              <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                <User size={28} />
              </div>
              {user.role === "worker" ? "Professional Profile" : "User Account"}
            </h2>
            <p className="text-slate-500 mt-2 font-bold text-[10px] uppercase tracking-widest pl-1">Identity Management & Trust Metrics</p>
          </div>
          <button onClick={() => navigate(-1)} className="p-3 rounded-2xl bg-white/5 border border-border text-slate-500 hover:text-foreground transition-all">
             <ArrowLeft size={24} />
          </button>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 relative z-10">
        
        {/* Left Column: Avatar & Details */}
        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-4">
          
          {/* Avatar Identity Card OR Edit Form */}
          {isEditing ? (
            <div className="flex flex-col items-center rounded-[2.5rem] bg-card p-10 border border-border shadow-2xl animate-in zoom-in-95 duration-300">
              <label htmlFor="edit-photo" className="group relative mb-8 flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-[2rem] border-2 border-dashed border-border bg-white/5 transition-all hover:border-orange-500">
                {editPhoto ? (
                  <img src={editPhoto} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-orange-500 text-5xl font-black text-foreground italic">
                    {(editName || user.name).charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-[10px] font-black uppercase tracking-widest">Update</span>
                </div>
                <input id="edit-photo" type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setEditPhoto(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                }} />
              </label>

              <div className="w-full space-y-4">
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full Identity" className="w-full rounded-2xl border border-border bg-black px-6 py-4 text-sm text-foreground font-bold outline-none focus:border-orange-500 transition-all" />
                <input value={editSkill} onChange={e => setEditSkill(e.target.value)} placeholder="Professional Skill" className="w-full rounded-2xl border border-border bg-black px-6 py-4 text-sm text-foreground font-bold outline-none focus:border-orange-500 transition-all" />
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Current Base" className="w-full rounded-2xl border border-border bg-black px-6 py-4 text-sm text-foreground font-bold outline-none focus:border-orange-500 transition-all" />
              </div>
              
              <div className="mt-8 flex w-full gap-4">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl bg-white/5 border border-border text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-4 rounded-2xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all">Commit</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[3rem] bg-card p-12 text-center border border-border shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 h-48 w-48 bg-orange-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative mb-6">
                 <div className="h-32 w-32 rounded-[2.5rem] bg-orange-500 flex items-center justify-center text-5xl font-black text-foreground italic shadow-[0_0_40px_rgba(249,115,22,0.3)] overflow-hidden border-4 border-border">
                    {user.photo ? <img src={user.photo} alt="Profile" className="h-full w-full object-cover" /> : user.name.charAt(0)}
                 </div>
                 <div className="absolute -bottom-2 -right-2 p-3 rounded-2xl bg-secondary border border-orange-500/30 text-orange-500 shadow-xl">
                    <Award size={20} />
                 </div>
              </div>
              <h2 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">{user.name}</h2>
              {user.skill && <span className="mt-2 text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] italic">{user.skill}</span>}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                  <Shield size={14} />
                  <span>IDENTITY VERIFIED</span>
                </div>
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 rounded-full bg-white/5 border border-border px-4 py-2 text-[9px] font-black text-slate-400 hover:text-foreground hover:bg-white/10 transition-all uppercase tracking-widest">
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            </div>
          )}

          {/* Details List */}
          <div className="rounded-[2.5rem] bg-card border border-border shadow-2xl overflow-hidden">
            <div className="px-8 py-5 border-b border-border bg-white/[0.02] font-black text-[10px] uppercase tracking-[0.3em] text-slate-600">
               Core Registry Metadata
            </div>
            <div className="p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-1 gap-2">
              {infoItems.map((item, i) => (
                <div key={item.label} className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl hover:bg-white/5 transition-all group border border-border sm:border-transparent hover:border-border">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/10 group-hover:scale-110 transition-transform">
                    <item.icon size={window.innerWidth < 640 ? 14 : 18} />
                  </div>
                  <div>
                    <div className="text-[7px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">{item.label}</div>
                    <div className="text-[10px] sm:text-sm font-black text-foreground tracking-tight truncate max-w-[80px] sm:max-w-none">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Rating Summary & Actions */}
        <div className="flex flex-col gap-8 md:col-span-12 lg:col-span-8">

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            {user.role === "worker" ? (
              <>
                <div className="rounded-[1.5rem] sm:rounded-[2.5rem] bg-card p-4 sm:p-8 border border-border text-center shadow-xl group hover:border-orange-500/20 transition-all">
                  <div className="mb-2 sm:mb-4 flex justify-center text-orange-500">
                    <Star size={window.innerWidth < 640 ? 20 : 32} className="fill-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                  </div>
                  <div className="text-xl sm:text-4xl font-black text-foreground italic tracking-tighter">{avgRating}</div>
                  <div className="mt-1 sm:mt-2 text-[7px] sm:text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Average Rating</div>
                </div>
                
                <div className="rounded-[2.5rem] bg-card p-8 border border-border text-center shadow-xl group hover:border-orange-500/20 transition-all">
                  <div className="mb-4 flex justify-center text-orange-500">
                    <Briefcase size={32} />
                  </div>
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{verifications.length}</div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Verified Cycles</div>
                </div>
                
                <div className="rounded-[2.5rem] bg-card p-8 border border-border text-center shadow-xl group hover:border-orange-500/20 transition-all">
                  <div className="mb-4 flex justify-center text-emerald-500">
                    <Shield size={32} className="fill-emerald-500/10" />
                  </div>
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">
                    {Math.round(muktiScore)}
                  </div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Mukti Trust Score</div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-[2.5rem] bg-card p-8 border border-border text-center shadow-xl group hover:border-orange-500/20 transition-all">
                  <div className="mb-4 flex justify-center text-orange-500">
                    <Shield size={32} className="fill-orange-500/10" />
                  </div>
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{user.trustScore || 0}</div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Trust Score</div>
                </div>

                <div className="rounded-[2.5rem] bg-card p-8 border border-border text-center shadow-xl group hover:border-orange-500/20 transition-all">
                  <div className="mb-4 flex justify-center text-orange-500">
                    <UserCheck size={32} />
                  </div>
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">{verifications.length}</div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Verifications</div>
                </div>

                <div className="rounded-[2.5rem] bg-card p-8 border border-border text-center shadow-xl group hover:border-orange-500/20 transition-all">
                  <div className="mb-4 flex justify-center text-orange-500">
                    <LucideHistory size={32} />
                  </div>
                  <div className="text-4xl font-black text-foreground italic tracking-tighter">
                    {isDemoWorker ? "TOP 1%" : (verifications.length === 0 ? "N/A" : `TOP ${Math.max(5, 100 - verifications.length * 5)}%`)}
                  </div>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Registry Rank</div>
                </div>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] ml-2">System Commands</h3>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <button onClick={() => navigate("/report")} className="group relative rounded-[2.5rem] bg-card p-8 border border-border text-left shadow-xl hover:border-orange-500/30 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-6">
                   <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/10 group-hover:scale-110 transition-transform">
                      <Briefcase size={28} />
                   </div>
                   <div className="flex-1">
                      <span className="block text-lg font-black text-foreground italic uppercase tracking-tighter mb-1">Work Report</span>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Generate PDF Export</span>
                   </div>
                   <ChevronRight size={20} className="text-slate-700 group-hover:text-orange-500 transition-colors" />
                </div>
              </button>

              <button onClick={handleLogout} className="group relative rounded-[2.5rem] bg-card p-8 border border-border text-left shadow-xl hover:border-red-500/30 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-6">
                   <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/10 group-hover:scale-110 transition-transform">
                      <LogOut size={28} />
                   </div>
                   <div className="flex-1">
                      <span className="block text-lg font-black text-red-500 italic uppercase tracking-tighter mb-1">Disconnect</span>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Terminate Session</span>
                   </div>
                   <ChevronRight size={20} className="text-slate-700 group-hover:text-red-500 transition-colors" />
                </div>
              </button>
            </div>
          </div>

          {/* Activity Preview Placeholder */}
          <div className="rounded-[2.5rem] bg-secondary/50 border border-border p-8 text-center border-dashed">
             <LucideHistory size={40} className="mx-auto text-slate-800 mb-4" />
             <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">Extended registry details available in Activity module</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WorkerProfile;
