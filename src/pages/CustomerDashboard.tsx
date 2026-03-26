import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  updateDoc 
} from "firebase/firestore";
import { 
  LayoutDashboard, 
  ShieldCheck, 
  Award, 
  History, 
  Star, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare, 
  MapPin, 
  CheckCircle2, 
  Info,
  ArrowRight,
  ShieldAlert,
  Search,
  PlusCircle,
  HelpCircle,
  Clock
} from "lucide-react";
import StarRating from "@/components/StarRating";
import { getTrustLevel, getTrustBadgeColor, classifyCustomer, VerificationRecord, calculateTrustScore } from "@/utils/trustEngine";
import { analyzeReview, NLPResult } from "@/utils/nlpProcessor";

const CustomerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nlpInsights, setNlpInsights] = useState<NLPResult[]>([]);

  useEffect(() => {
    if (!user) return;

    const vQuery = query(
      collection(db, "verifications"), 
      where("customerId", "==", user.id), 
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(vQuery, (snapshot) => {
      const vList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          comment: data.comment || "",
          rating: data.rating || 0,
          workerId: data.workerId || "",
          workerName: data.workerName || "Worker",
          service: data.service || "Service",
          timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate() : new Date(),
          ...data
        };
      });
      setVerifications(vList);
      
      const insights = vList.map(v => analyzeReview(v.comment || ""));
      setNlpInsights(insights);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user || user.role !== "customer") {
    navigate("/");
    return null;
  }

  const trustScore = calculateTrustScore(user, verifications);
  const trustLevel = getTrustLevel(trustScore);
  const badgeColor = getTrustBadgeColor(trustScore);
  const customerType = classifyCustomer(verifications);

  // NLP Analytics
  const commonWords = Array.from(new Set(nlpInsights.flatMap(n => n.skills))).slice(0, 5);
  const commonIssues = Array.from(new Set(nlpInsights.flatMap(n => n.issues))).slice(0, 3);
  const positiveSentimentCount = nlpInsights.filter(n => n.sentiment === "positive").length;
  const sentimentRatio = nlpInsights.length > 0 ? (positiveSentimentCount / nlpInsights.length) * 100 : 0;
  
  // Real-time Trust Sync
  useEffect(() => {
    if (!user || user.isDemo) return;
    
    // Calculate real score using centralized engine
    const calculatedScore = calculateTrustScore(user, verifications);
    
    // Only update if changed (prevents loops)
    if (calculatedScore !== (user.trustScore || 0)) {
       console.log("Syncing customer trust score:", calculatedScore);
       updateDoc(doc(db, "users", user.id), { 
         trustScore: calculatedScore,
         lastActive: new Date() 
       }).catch(err => console.warn("Trust sync failed:", err));
    }
  }, [verifications, user?.id, user?.trustScore]);

  return (
    <div className="container mx-auto max-w-7xl py-6 md:py-10 pb-24 px-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[5%] left-[-10%] h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-5%] h-[500px] w-[500px] rounded-full bg-orange-500/5 blur-[150px] pointer-events-none" />

      {/* Header Area */}
      <div className="mb-10 opacity-0 animate-fade-up relative z-10" style={{ animationDelay: "0ms" }}>
        <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white uppercase italic leading-tight">
          Welcome Back, {user.name.split(" ")[0]} 
        </h2>
        <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 pl-1 italic">
          REGISTRY OVERSIGHT & TRUST CONTROL ACTIVE
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        
        {/* Left Column: Profile & Trust */}
        <div className="flex flex-col gap-6 lg:col-span-4 relative z-10">
          
          {/* Section 1: Identity & Classification */}
          <div className="rounded-[2.5rem] bg-slate-950 p-6 sm:p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
             <div className="absolute -top-24 -right-24 h-48 w-48 bg-orange-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
             
             <div className="relative z-10 text-center">
                <div className="mb-6 flex justify-center">
                   <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-4xl font-black shadow-[0_0_30px_rgba(249,115,22,0.4)] italic">
                      {user.name.charAt(0)}
                   </div>
                </div>
                
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{user.name}</h3>
                <div className="flex flex-col items-center gap-3 mt-4">
                   <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2 rounded-full border ${badgeColor} italic`}>
                      <ShieldCheck size={14} strokeWidth={3} /> {trustLevel}
                   </div>
                   <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] italic mb-2">
                      {customerType === 0 ? "LONG-TERM CUSTOMER (0)" : "OCCASIONAL CUSTOMER (1)"}
                   </div>
                </div>

                {/* Trust Score Progress */}
                <div className="mt-8 space-y-3">
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 px-1">
                      <span>Trust Integrity</span>
                      <span className="text-orange-500">{trustScore}%</span>
                   </div>
                   <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                      <div 
                         className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                         style={{ width: `${trustScore}%` }}
                      />
                   </div>
                </div>
             </div>
          </div>

          {/* Section 2: Contribution Metrics */}
          <div className="rounded-[2rem] bg-slate-950 p-6 border border-white/5 shadow-inner grid grid-cols-2 gap-4">
             <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-2xl font-black text-orange-500 italic tracking-tighter">{verifications.length}</div>
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Verified Jobs</div>
             </div>
             <div className="text-center p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-2xl font-black text-white italic tracking-tighter">{user.points || 0}</div>
                <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">Credits Earned</div>
             </div>
          </div>

          {/* Section 3: Alerts & Warnings */}
          <div className="rounded-[2rem] bg-slate-950 p-6 border border-white/5 font-black italic">
             <div className="text-[9px] font-black uppercase text-slate-600 tracking-[0.3em] mb-4 flex items-center gap-3">
                <ShieldAlert size={16} className="text-orange-500" /> Security Intelligence
             </div>
             <div className="space-y-3">
                <div className="text-[8px] font-black text-emerald-400/80 flex items-center gap-3 bg-emerald-500/5 px-4 py-3 rounded-xl border border-emerald-500/10 uppercase tracking-widest">
                   <CheckCircle2 size={12} /> Account secured with OTP
                </div>
                {verifications.length > 5 && (
                  <div className="text-[8px] font-black text-orange-400/80 flex items-center gap-3 bg-orange-500/5 px-4 py-3 rounded-xl border border-orange-500/10 uppercase tracking-widest">
                    <Info size={12} /> Long-term pattern established
                  </div>
                )}
                <div className="text-[8px] font-black text-slate-600 flex items-center gap-3 bg-white/5 px-4 py-3 rounded-xl border border-white/5 uppercase tracking-widest leading-relaxed">
                   <Clock size={12} /> Registry Rule: 7-day cooldown on same worker
                </div>
             </div>
          </div>
        </div>

        {/* Right Column: Analytics & History */}
        <div className="flex flex-col gap-6 md:col-span-8 lg:col-span-8 relative z-10">
          
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <button onClick={() => navigate("/verify")} className="group flex items-center justify-between p-6 rounded-[2rem] bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-2xl hover:scale-[1.02] transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                   <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
                      <PlusCircle size={28} />
                   </div>
                   <div className="text-left font-black italic">
                      <div className="text-xl tracking-tighter uppercase whitespace-nowrap">Verify Worker</div>
                      <div className="text-[8px] opacity-70 uppercase tracking-widest italic whitespace-nowrap">Scan Handshake Token</div>
                   </div>
                </div>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
             </button>

             <button onClick={() => navigate("/verify/request")} className="group flex items-center justify-between p-6 rounded-[2rem] bg-slate-950 border border-orange-500/20 text-white shadow-xl hover:border-orange-500/50 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                   <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500">
                      <Search size={28} />
                   </div>
                   <div className="text-left font-black italic">
                      <div className="text-xl tracking-tighter uppercase whitespace-nowrap">Find Specialist</div>
                      <div className="text-[8px] text-slate-500 uppercase tracking-widest italic whitespace-nowrap">Broadcast Skill Signal</div>
                   </div>
                </div>
                <ArrowRight size={20} className="text-slate-700 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>

          {/* NLP Insights Card */}
          <div className="rounded-[2.5rem] bg-slate-950 p-8 border border-white/5 shadow-2xl font-black italic">
             <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 flex items-center gap-3 italic">
                   <MessageSquare size={16} /> 01. Cognitive Insights (NLP)
                </h4>
                <div className="flex items-center gap-2 text-[8px] font-black text-emerald-500 uppercase tracking-widest border border-emerald-500/20 px-3 py-1 rounded-full bg-emerald-500/5">
                   Sentiment Velocity: {sentimentRatio.toFixed(0)}% POS
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] pl-1">Primary Success Indicators</div>
                   <div className="flex flex-wrap gap-3">
                      {commonWords.length > 0 ? commonWords.map(word => (
                        <span key={word} className="px-5 py-2.5 rounded-2xl bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-widest border border-orange-500/10 shadow-inner">
                           {word}
                        </span>
                      )) : (
                        <span className="text-[10px] text-slate-800 uppercase tracking-widest pl-1 italic">Pending Data Analysis...</span>
                      )}
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] pl-1">Detected Friction Points</div>
                   <div className="flex flex-wrap gap-3">
                      {commonIssues.length > 0 ? commonIssues.map(issue => (
                        <span key={issue} className="px-5 py-2.5 rounded-2xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/10 shadow-inner">
                           {issue}
                        </span>
                      )) : (
                        <span className="text-[10px] text-slate-800 uppercase tracking-widest pl-1 italic">None Identified ✓</span>
                      )}
                   </div>
                </div>
             </div>
          </div>

          {/* Social Contribution Section */}
          <div className="rounded-[2.5rem] bg-orange-500/5 p-8 border border-orange-500/10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 h-40 w-40 bg-orange-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
             <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                   <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-xl shadow-orange-500/20">
                      <Award size={24} />
                   </div>
                   <h4 className="text-xl font-black italic tracking-tighter text-white uppercase italic">Registry Contribution</h4>
                </div>
                <p className="text-sm font-bold text-slate-400 mb-6 max-w-lg leading-relaxed uppercase tracking-tight italic">
                   "Your verified handshakes empower informal workers to access official credit facilities and government benefits. You've verified <span className="text-orange-500 font-black">{verifications.length} units</span> so far."
                </p>
                <div className="flex gap-4">
                   <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 text-[9px] font-black text-white hover:bg-white/10 transition-all cursor-help uppercase tracking-widest">
                      Credit Enablement: Active
                   </div>
                   <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 text-[9px] font-black text-white hover:bg-white/10 transition-all cursor-help uppercase tracking-widest">
                      Benefit Eligibility: Tier 1
                   </div>
                </div>
             </div>
          </div>

          {/* Historical Log */}
          <div className="rounded-[2.5rem] bg-slate-950 p-8 border border-white/5">
             <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-3 italic">
                   <History size={16} /> 02. Historical Telemetry
                </h4>
                <button onClick={() => navigate("/activity")} className="text-[8px] font-black text-orange-500 uppercase tracking-[0.4em] hover:text-white transition-all underline underline-offset-4">Expand All</button>
             </div>
             
             <div className="space-y-4">
                {verifications.length > 0 ? verifications.slice(0, 3).map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-white/5 border border-white/5 group hover:border-orange-500/20 transition-all font-black italic">
                     <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-xl text-orange-400">
                           {v.workerName?.charAt(0) || "W"}
                        </div>
                        <div className="text-left">
                           <div className="text-lg text-white tracking-tighter uppercase">{v.workerName || "Worker"}</div>
                           <div className="text-[9px] text-slate-600 uppercase tracking-widest mt-1">
                              {v.service} • {v.timestamp instanceof Date ? v.timestamp.toLocaleDateString() : "Just now"}
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                           {[...Array(5)].map((_, i) => (
                              <Star key={i} size={10} className={i < v.rating ? "text-orange-500 fill-orange-500" : "text-slate-800"} />
                           ))}
                        </div>
                        <CheckCircle2 size={18} className="text-emerald-500 opacity-50" />
                     </div>
                  </div>
                )) : (
                  <div className="py-20 text-center border border-dashed border-white/5 rounded-[2rem]">
                     <History size={40} className="mx-auto text-slate-800 mb-4 opacity-50" />
                     <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Historical Registry Pending</p>
                  </div>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
