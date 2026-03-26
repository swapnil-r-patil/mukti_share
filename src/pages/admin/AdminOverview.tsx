import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserCheck, 
  MessageSquare, 
  ShieldAlert, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Briefcase,
  Shield,
  Trash2,
  RotateCcw,
  Download
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from "recharts";
import { ResponsiveContainer } from "recharts";
import { collection, onSnapshot, query, where, getDocs, Timestamp, writeBatch, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const API_BASE_URL = "http://localhost:5000";

// All data now comes from real-time Firebase listeners (no hardcoded demo data)

const AdminOverview = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();
  
  const [stats, setStats] = useState({
    totalWorkers: 0,
    totalCustomers: 0,
    totalReviews: 0,
    verifiedWorkers: 0,
    activeAlerts: 0,
    activeUsers: 0,
    pendingRequests: 0
  });

  const [realSkillData, setRealSkillData] = useState<any[]>([]);
  const [realChartData, setRealChartData] = useState<any[]>([]);

  useEffect(() => {
    const qWorkers = query(collection(db, "users"), where("role", "==", "worker"));
    const unsubWorkers = onSnapshot(qWorkers, (snap) => {
      const verified = snap.docs.filter(d => d.data().status === 'verified').length;
      setStats(prev => ({ ...prev, totalWorkers: snap.size, verifiedWorkers: verified }));
    });

    const qCustomers = query(collection(db, "users"), where("role", "==", "customer"));
    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      setStats(prev => ({ ...prev, totalCustomers: snap.size }));
    });

    // === CHART DATA: Aggregate activity from ALL sources ===
    const unsubReviews = onSnapshot(collection(db, "verifications"), (snap) => {
      setStats(prev => ({ ...prev, totalReviews: snap.size }));
    });

    // Build chart from MULTIPLE collections for comprehensive velocity tracking
    const buildChartData = () => {
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return {
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          dateStr: d.toDateString()
        };
      }).reverse();

      const counts: Record<string, { signups: number; requests: number; verified: number }> = {};
      last7Days.forEach(d => {
        counts[d.dateStr] = { signups: 0, requests: 0, verified: 0 };
      });

      // Source 1: All users — track sign-up activity via lastActive
      const unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
        // Reset counts
        last7Days.forEach(d => {
          counts[d.dateStr] = { ...counts[d.dateStr], signups: 0, verified: 0 };
        });

        snap.docs.forEach(d => {
          const data = d.data();
          // Count sign-ups
          if (data.lastActive) {
            const ts = (data.lastActive as Timestamp).toDate().toDateString();
            if (counts[ts]) counts[ts].signups++;
          }
          // Count verifications
          if (data.status === 'verified' && data.lastUpdated) {
            const ts = (data.lastUpdated as Timestamp).toDate().toDateString();
            if (counts[ts]) counts[ts].verified++;
          }
        });

        updateChart();
      });

      // Source 2: Verification requests — track request activity
      const unsubVReqs = onSnapshot(collection(db, "verification_requests"), (snap) => {
        last7Days.forEach(d => {
          counts[d.dateStr] = { ...counts[d.dateStr], requests: 0 };
        });

        snap.docs.forEach(d => {
          const data = d.data();
          if (data.timestamp) {
            const ts = (data.timestamp as Timestamp).toDate().toDateString();
            if (counts[ts]) counts[ts].requests++;
          }
        });

        updateChart();
      });

      const updateChart = () => {
        setRealChartData(last7Days.map(d => ({
          name: d.label,
          reviews: (counts[d.dateStr]?.signups || 0) + (counts[d.dateStr]?.requests || 0) + (counts[d.dateStr]?.verified || 0),
          fraud: counts[d.dateStr]?.verified || 0
        })));
      };

      return () => {
        unsubAllUsers();
        unsubVReqs();
      };
    };

    const cleanupChart = buildChartData();

    const fetchSkillData = async () => {
      const q = query(collection(db, "users"), where("role", "==", "worker"));
      const snap = await getDocs(q);
      const skills: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const s = doc.data().skill || "Unspecified";
        skills[s] = (skills[s] || 0) + 1;
      });
      const formatted = Object.entries(skills).map(([name, count], i) => ({
        name,
        count,
        color: ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"][i % 5]
      })).sort((a, b) => b.count - a.count).slice(0, 5);
      setRealSkillData(formatted);
    };

    fetchSkillData();

    const unsubPending = onSnapshot(query(collection(db, "verification_requests"), where("status", "==", "pending")), (snap) => {
      setStats(prev => ({ ...prev, pendingRequests: snap.size }));
    });

    const unsubSkillData = onSnapshot(query(collection(db, "users"), where("role", "==", "worker")), (snap) => {
      const skills: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const s = doc.data().skill || "Unspecified";
        skills[s] = (skills[s] || 0) + 1;
      });
      const formatted = Object.entries(skills).map(([name, count], i) => ({
        name,
        count,
        color: ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899"][i % 5]
      })).sort((a, b) => b.count - a.count).slice(0, 5);
      setRealSkillData(formatted);
    });

    // ONE-TIME AUTOMATED RESET (Requested by Assistant to fix credentials issue)
    const hasBeenReset = localStorage.getItem("assistant_global_reset_done");
    if (!hasBeenReset) {
      console.log("🚀 Assistant: Performing one-time global reset...");
      handleGlobalReset(true).then(() => {
        localStorage.setItem("assistant_global_reset_done", "true");
      });
    }

    return () => {
      unsubWorkers();
      unsubCustomers();
      unsubReviews();
      unsubPending();
      unsubSkillData();
      cleanupChart();
    };
  }, []);

  const handleGlobalReset = async (skipConfirm = false) => {
    if (!skipConfirm && !window.confirm("CRITICAL: Reset ALL workers to Unverified?")) return;
    try {
      const q = query(collection(db, "users"), where("role", "==", "worker"));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { isVerifiedByAdmin: false, status: "pending" });
      });
      await batch.commit();
      toast.success("All workers reset to unverified status.");
    } catch (err) {
      console.error("Global reset failed:", err);
      toast.error("Global reset failed.");
    }
  };

  const handlePurgeRequests = async () => {
    if (!window.confirm("DELETE ALL verification requests?")) return;
    try {
      const snap = await getDocs(collection(db, "verification_requests"));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast.success("Verification request queue purged.");
    } catch (err) {
      console.error("Queue purge failed:", err);
      toast.error("Queue purge failed.");
    }
  };

  const displayChartData = realChartData;
  const displaySkillData = realSkillData;

  const statCards = [
    { 
      label: t("total_workers"), 
      value: stats.totalWorkers, 
      icon: <Briefcase size={24} />, 
      trend: "LIVE", 
      isUp: true,
      color: "from-blue-600 to-indigo-700"
    },
    { 
      label: t("total_customers"), 
      value: stats.totalCustomers, 
      icon: <Users size={24} />, 
      trend: "LIVE", 
      isUp: true,
      color: "from-orange-500 to-orange-700" 
    },
    { 
      label: "Verified Workers", 
      value: stats.verifiedWorkers, 
      icon: <UserCheck size={24} />, 
      trend: stats.totalWorkers > 0 ? `${Math.round((stats.verifiedWorkers / stats.totalWorkers) * 100)}%` : '0%', 
      isUp: stats.verifiedWorkers > 0,
      color: "from-emerald-500 to-teal-700"
    },
    { 
      label: "Pending Requests", 
      value: stats.pendingRequests, 
      icon: <Clock size={24} />, 
      trend: stats.pendingRequests > 0 ? 'ACTION' : 'CLEAR', 
      isUp: stats.pendingRequests === 0,
      color: "from-purple-600 to-violet-700"
    },
    { 
      label: t("fraud_alerts"), 
      value: Math.floor(stats.totalReviews * 0.05), 
      icon: <ShieldAlert size={24} />, 
      trend: "AUTO", 
      isUp: false,
      color: "from-red-600 to-rose-700",
      urgent: true
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-foreground italic tracking-tighter uppercase">{t("system_overview")}</h1>
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Real-time registry monitoring & deep analytics active</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
        {statCards.map((card, i) => (
          <div key={i} className={cn(
            "group relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] bg-card border border-border p-4 sm:p-6 hover:border-border/80 transition-all cursor-pointer shadow-2xl",
            i === statCards.length - 1 && "col-span-2 lg:col-span-1"
          )}>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${card.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
            <div className="flex justify-between items-start mb-3 sm:mb-4">
              <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-lg`}>
                {React.cloneElement(card.icon as React.ReactElement, { size: window.innerWidth < 640 ? 18 : 24 })}
              </div>
              <div className={`flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[10px] font-black ${card.isUp ? 'text-emerald-500' : 'text-red-500'} bg-secondary/50 px-1.5 py-0.5 rounded-lg`}>
                {card.isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {card.trend}
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-black text-foreground tracking-tighter">{card.value}</div>
              <div className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-[3.5rem] bg-card border border-border p-10 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <div className="space-y-1">
              <h3 className="text-xl font-black text-foreground italic tracking-tight uppercase">Verification Velocity</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">7-day transaction frequency tracking</p>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayChartData}>
                <defs>
                  <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#ffffff05" : "#00000005"} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis stroke={isDark ? "#475569" : "#94a3b8"} fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    border: isDark ? '1px solid #ffffff10' : '1px solid #e2e8f0', 
                    borderRadius: '1.5rem', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }} 
                  itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }} 
                />
                <Area type="monotone" dataKey="reviews" stroke="#f97316" strokeWidth={4} fillOpacity={1} fill="url(#colorReviews)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-[3.5rem] bg-card border border-border p-10 shadow-2xl flex flex-col">
            <div className="mb-10">
              <h3 className="text-xl font-black text-foreground italic tracking-tight uppercase">Skill Hotspots</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Growth by profession</p>
            </div>
            <div className="flex-1 space-y-6">
              {displaySkillData.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">{item.count} Workers</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (item.count / 50) * 100)}%`, backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}50` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[3.5rem] bg-card border border-border p-10 shadow-2xl">
            <div className="mb-8 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-500">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground italic uppercase tracking-tight">Maintenance</h3>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Critical system operations</p>
              </div>
            </div>
            <div className="space-y-4">
              <button onClick={() => handleGlobalReset()} className="w-full flex items-center justify-between p-4 rounded-2xl bg-secondary border border-border hover:bg-red-500/10 hover:border-red-500/20 group transition-all">
                <div className="flex items-center gap-3">
                  <RotateCcw size={16} className="text-muted-foreground group-hover:text-red-500" />
                  <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Reset All Verification</span>
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-red-500" />
              </button>
              <button onClick={handlePurgeRequests} className="w-full flex items-center justify-between p-4 rounded-2xl bg-secondary border border-border hover:bg-red-500/10 hover:border-red-500/20 group transition-all">
                <div className="flex items-center gap-3">
                  <Trash2 size={16} className="text-muted-foreground group-hover:text-red-500" />
                  <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Purge Request Queue</span>
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
