import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { History, Search, Calendar, Filter, Star, Clock, MapPin, CheckCircle2, ArrowLeft, Phone, User, Wrench, Wallet, X, QrCode } from "lucide-react";
import StarRating from "@/components/StarRating";
import { DEMO_VERIFICATIONS } from "@/data/demoData";
import { useNavigate } from "react-router-dom";

interface ActivityItem {
  id: string;
  type: "verification" | "request";
  service: string;
  customerName?: string;
  workerName?: string;
  workerPhone?: string;
  workerSkill?: string;
  rating?: number;
  status: string;
  timestamp: Date;
  location: string;
  budget?: string;
  description?: string;
}

const CustomerActivity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | "verification" | "request">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  const updateCombined = (list: ActivityItem[], source: string) => {
     setActivities(prev => {
        const other = prev.filter(i => source === "v" ? i.type !== "verification" : i.type !== "request");
        return [...other, ...list].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
     });
  };

  useEffect(() => {
    if (!user) return;

    if (user.isDemo) {
      const demoList: ActivityItem[] = DEMO_VERIFICATIONS.map(v => ({
        id: v.id,
        type: "verification",
        service: v.workerSkill,
        workerName: v.workerName,
        rating: v.rating,
        status: "Completed",
        timestamp: v.timestamp,
        location: "Patna, Bihar"
      }));
      
      demoList.push({
        id: "req1",
        type: "request",
        service: "Electrician",
        status: "In Progress",
        workerName: "Ramesh Kumar",
        workerPhone: "9876543210",
        workerSkill: "Electrician & Plumber",
        timestamp: new Date(),
        location: "Rajendra Nagar, Patna",
        budget: "₹500-1000",
        description: "Fix wiring in kitchen area"
      });

      setActivities(demoList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
      return;
    }

    const vQuery = query(collection(db, "verifications"), where("customerId", "==", user.id));
    const rQuery = query(collection(db, "work_requests"), where("customerId", "==", user.id));

    const unsubV = onSnapshot(vQuery, (snapshot) => {
       const vList = snapshot.docs.map(doc => {
         const data = doc.data();
         return {
           id: doc.id,
           type: "verification",
           service: data.service || "General Work",
           workerName: data.workerName || "Worker",
           rating: data.rating,
           status: "Completed",
           timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
           location: data.location?.address || data.location || "Patna, Bihar"
         } as ActivityItem;
       });
       updateCombined(vList, "v");
    });

    const unsubR = onSnapshot(rQuery, (snapshot) => {
       const rList = snapshot.docs.map(doc => {
         const data = doc.data();
         return {
           id: doc.id,
           type: "request",
           service: data.service,
           workerName: data.workerName,
           workerPhone: data.workerPhone,
           workerSkill: data.workerSkill,
           status: data.status,
           timestamp: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
           location: data.location || "Local Area",
           budget: data.budget,
           description: data.description
         } as ActivityItem;
       });
       updateCombined(rList, "r");
    });

    return () => {
      unsubV();
      unsubR();
    };
  }, [user]);

  const filtered = activities.filter(a => {
    const matchesType = filterType === "all" || a.type === filterType;
    const matchesSearch = a.service.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (a.workerName || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed": return "bg-emerald-500/5 text-emerald-500 border-emerald-500/10";
      case "In Progress": return "bg-blue-500/5 text-blue-500 border-blue-500/10";
      case "Searching": return "bg-orange-500/5 text-orange-500 border-orange-500/10 animate-pulse";
      case "Accepted": return "bg-emerald-500/5 text-emerald-500 border-emerald-500/10";
      default: return "bg-yellow-500/5 text-yellow-500 border-yellow-500/10";
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-6 md:py-12 pb-24 px-4 relative">
       {/* Background Orbs */}
       <div className="absolute top-0 right-[-10%] h-[300px] w-[300px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />
       
       <div className="mb-10 flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-4 uppercase">
              <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                <History size={28} />
              </div>
              My Activity
            </h2>
            <p className="text-slate-500 mt-2 font-bold text-[10px] uppercase tracking-widest pl-1">Registry of all your verified transactions</p>
          </div>
          <button onClick={() => navigate(-1)} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all">
             <ArrowLeft size={24} />
          </button>
      </div>

      {/* Filters */}
      <div className="mb-10 flex flex-col md:flex-row gap-5 relative z-10">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input 
            type="text"
            placeholder="Search service or worker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-950 border border-white/5 outline-none focus:border-orange-500/50 transition-all font-bold text-white text-sm placeholder:text-slate-800"
          />
        </div>
        <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl border border-white/5">
           {["all", "verification", "request"].map(t => (
             <button
               key={t}
               onClick={() => setFilterType(t as any)}
               className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                 filterType === t ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:text-white"
               }`}
             >
               {t}
             </button>
           ))}
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-4 relative z-10">
        {filtered.length > 0 ? (
          filtered.map((activity) => (
            <div 
              key={activity.id} 
              className="rounded-[2.5rem] bg-slate-950 p-6 border border-white/5 transition-all hover:border-orange-500/20 group animate-in slide-in-from-bottom-5 cursor-pointer"
              onClick={() => setSelectedActivity(activity)}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-110 ${
                  activity.type === "verification" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/10" : 
                  activity.status === "In Progress" ? "bg-blue-500/10 text-blue-500 border-blue-500/10" :
                  "bg-orange-500/10 text-orange-500 border-orange-500/10"
                }`}>
                  {activity.type === "verification" ? <CheckCircle2 size={32} /> : 
                   activity.status === "In Progress" ? <Wrench size={32} /> : <Clock size={32} />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-black text-xl flex items-center gap-3 text-white italic">
                       {activity.service}
                       <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full border ${
                         activity.type === "verification" ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" : "bg-orange-500/5 text-orange-500 border-orange-500/10"
                       }`}>
                         {activity.type}
                       </span>
                    </div>
                    <div className="text-[10px] font-black text-slate-600 flex items-center gap-2 uppercase tracking-widest">
                       <Calendar size={12} />
                       {activity.timestamp.toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-4 mt-2">
                    <div className="text-sm font-bold text-slate-400 flex items-center gap-2">
                       {activity.type === "verification" ? "Verified:" : activity.workerName ? "Worker:" : "Status:"} 
                       <span className="text-white font-black">{activity.workerName || "Search ongoing"}</span>
                    </div>
                    {activity.rating && (
                      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                        <StarRating value={activity.rating} readonly size={12} />
                        <span className="text-[10px] font-black text-orange-400">{activity.rating}</span>
                      </div>
                    )}
                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-tighter">
                      <MapPin size={12} className="text-orange-500" />
                      {activity.location}
                    </div>
                  </div>

                  {/* Show worker info for in-progress jobs */}
                  {activity.workerName && activity.status === "In Progress" && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-black">
                        {activity.workerName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-white truncate">{activity.workerName}</div>
                        {activity.workerSkill && <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{activity.workerSkill}</div>}
                      </div>
                      <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest animate-pulse">Working...</div>
                    </div>
                  )}
                </div>

                <div className={`ml-auto px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-inner ${getStatusStyle(activity.status)}`}>
                  {activity.status}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 flex flex-col items-center text-center bg-slate-950 rounded-[3rem] border border-dashed border-white/5 shadow-inner">
             <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center text-slate-700 mb-6 border border-white/5">
               <Filter size={48} />
             </div>
             <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">System Idle</h3>
             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] max-w-xs mt-3 leading-relaxed">No transactions match your current scan parameters.</p>
          </div>
        )}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedActivity(null)} />
          <div className="relative w-full max-w-lg bg-slate-950 p-8 rounded-[3rem] border border-orange-500/20 font-black italic max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedActivity(null)} className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl z-10">
              <X size={20} className="text-slate-600" />
            </button>
            
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border ${
                selectedActivity.type === "verification" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/10" :
                selectedActivity.status === "In Progress" ? "bg-blue-500/10 text-blue-500 border-blue-500/10" :
                "bg-orange-500/10 text-orange-500 border-orange-500/10"
              }`}>
                {selectedActivity.type === "verification" ? <CheckCircle2 size={32} /> :
                 selectedActivity.status === "In Progress" ? <Wrench size={32} /> : <Clock size={32} />}
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedActivity.service}</h3>
                <div className={`inline-block mt-1 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${getStatusStyle(selectedActivity.status)}`}>
                  {selectedActivity.status}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedActivity.description && (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 mb-6 text-sm text-slate-400 italic">
                "{selectedActivity.description}"
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Location</div>
                <div className="text-xs font-black text-white flex items-center gap-2"><MapPin size={12} className="text-orange-500" /> {selectedActivity.location}</div>
              </div>
              {selectedActivity.budget && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Budget</div>
                  <div className="text-lg font-black text-emerald-500">{selectedActivity.budget}</div>
                </div>
              )}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Date</div>
                <div className="text-xs font-black text-white">{selectedActivity.timestamp.toLocaleDateString()}</div>
              </div>
              {selectedActivity.rating && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Rating</div>
                  <div className="flex items-center gap-2">
                    <StarRating value={selectedActivity.rating} readonly size={14} />
                    <span className="text-lg font-black text-orange-500">{selectedActivity.rating}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Worker Info Card (for requests with a worker assigned) */}
            {selectedActivity.workerName && (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 mb-6">
                <div className="text-[9px] font-black text-orange-500 uppercase tracking-[0.3em] mb-4">Assigned Worker</div>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-500 text-xl font-black">
                    {selectedActivity.workerName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-black text-white italic uppercase tracking-tighter">{selectedActivity.workerName}</div>
                    {selectedActivity.workerSkill && (
                      <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mt-1">{selectedActivity.workerSkill}</div>
                    )}
                  </div>
                  {selectedActivity.workerPhone && (
                    <a 
                      href={`tel:${selectedActivity.workerPhone}`} 
                      className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                    >
                      <Phone size={20} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedActivity.status === "In Progress" && selectedActivity.type === "request" && (
              <button
                onClick={() => {
                  setSelectedActivity(null);
                  navigate(`/tracking/${selectedActivity.id}`);
                }}
                className="w-full h-16 rounded-2xl bg-blue-500 text-white font-black uppercase tracking-[0.4em] text-[10px] shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all mb-4"
              >
                Track & Review
              </button>
            )}

            {selectedActivity.status === "Searching" && selectedActivity.type === "request" && (
              <button
                onClick={() => {
                  setSelectedActivity(null);
                  navigate(`/tracking/${selectedActivity.id}`);
                }}
                className="w-full h-16 rounded-2xl bg-orange-500 text-white font-black uppercase tracking-[0.4em] text-[10px] shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all mb-4"
              >
                Track Request
              </button>
            )}

            <button 
              onClick={() => setSelectedActivity(null)}
              className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] hover:text-white transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerActivity;
