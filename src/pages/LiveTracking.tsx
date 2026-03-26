import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  User, 
  CheckCircle2, 
  Phone, 
  MessageSquare, 
  Clock, 
  ShieldCheck,
  AlertCircle,
  X,
  Wrench,
  Star,
  Send
} from "lucide-react";
import { toast } from "sonner";
import StarRating from "@/components/StarRating";

interface WorkRequest {
  id: string;
  service: string;
  description: string;
  status: "Searching" | "Assigned" | "On the way" | "Completed" | "Pending" | "Accepted" | "In Progress";
  workerName?: string;
  workerPhone?: string;
  workerSkill?: string;
  workerId?: string;
  location: string;
  budget?: string;
  customerName?: string;
  createdAt: any;
}

const LiveTracking = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<WorkRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const unsub = onSnapshot(doc(db, "work_requests", jobId), (docSnap) => {
      if (docSnap.exists()) {
        setJob({ id: docSnap.id, ...docSnap.data() } as WorkRequest);
      } else {
        toast.error("Process aborted by system");
        navigate("/verify");
      }
      setLoading(false);
    }, (error) => {
      console.warn("LiveTracking: Firestore error, trying backend...", error.message);
      fetch(`http://localhost:5000/api/work-request/${jobId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setJob(data as WorkRequest);
          }
          setLoading(false);
        })
        .catch(() => {
          toast.error("Cannot load job details");
          setLoading(false);
        });
    });

    return () => unsub();
  }, [jobId, navigate]);

  const handleComplete = async () => {
    if (!job || reviewRating === 0) {
      toast.error("Please give a rating before completing.");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "work_requests", job.id), { 
        status: "Completed",
        rating: reviewRating,
        reviewComment: reviewComment,
        completedAt: serverTimestamp()
      });
      toast.success("✅ Job completed! Review saved.");
      navigate("/verify");
    } catch (err) {
      // Backend fallback
      try {
        await fetch(`http://localhost:5000/api/work-request/${job.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            status: "Completed", 
            rating: reviewRating, 
            reviewComment: reviewComment 
          })
        });
        toast.success("✅ Job completed via server!");
        navigate("/verify");
      } catch (apiErr) {
        toast.error("Failed to complete. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    if (window.confirm("Abort this service requirement?")) {
      try {
        await deleteDoc(doc(db, "work_requests", job.id));
        toast.success("Requirement Deleted");
        navigate("/verify");
      } catch (err) {
        toast.error("Deletion failed");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-orange-500 border-t-transparent shadow-[0_0_20px_rgba(249,115,22,0.3)]"></div>
      </div>
    );
  }

  if (!job) return null;

  const steps = [
    { label: "SCANNING", key: "Searching", icon: Navigation },
    { label: "IN PROGRESS", key: "In Progress", icon: Wrench },
    { label: "REVIEW", key: "Review", icon: Star },
    { label: "COMPLETED", key: "Completed", icon: CheckCircle2 }
  ];

  const states = ["Searching", "In Progress", "Review", "Completed"];
  const currentIndex = (() => {
    if (job.status === "Completed") return 3;
    if (job.status === "In Progress" || job.status === "Accepted") return 1;
    if (job.status === "Pending") return 0;
    return states.indexOf(job.status);
  })();

  return (
    <div className="container mx-auto max-w-2xl py-6 md:py-12 pb-24 px-4 relative overflow-hidden">
       {/* Background Orbs */}
       <div className="absolute top-[20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />

      <div className="mb-10 flex items-center justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-4 uppercase">
              <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                <Navigation size={28} className="animate-pulse" />
              </div>
              Live Tracking
            </h1>
            <p className="text-slate-500 mt-2 font-bold text-[10px] uppercase tracking-widest pl-1">Quantum State: {job.status}</p>
          </div>
          <button onClick={() => navigate("/verify")} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all">
             <ArrowLeft size={24} />
          </button>
      </div>

      <div className="rounded-[3rem] bg-slate-950 border border-white/5 p-12 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl mb-10 group">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px] group-hover:scale-125 transition-transform duration-1000" />
        
        <div className="relative mb-10 flex justify-center">
           <div className="relative h-36 w-36">
              <div className="absolute inset-0 animate-[ping_3s_infinite] rounded-full bg-orange-500/10 opacity-75" />
              <div className="relative flex h-36 w-36 items-center justify-center rounded-[3rem] bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-2xl border border-white/10">
                 {job.status === "Searching" ? <Navigation size={64} className="animate-[spin_4s_linear_infinite]" /> : 
                  job.status === "In Progress" ? <Wrench size={64} /> :
                  <ShieldCheck size={64} />}
              </div>
           </div>
        </div>

        <h3 className="text-3xl font-black mb-4 tracking-tighter italic text-white uppercase italic">
          {job.status === "Searching" ? "SYSTEM SCANNING..." : 
           job.status === "In Progress" ? "WORK IN PROGRESS" :
           job.status === "Accepted" ? "WORKER ACCEPTED" :
           job.status === "Completed" ? "CYCLE COMPLETED" : "PROCESSING..."}
        </h3>
        <p className="text-[10px] font-bold text-slate-500 max-w-[320px] mx-auto mb-12 leading-relaxed uppercase tracking-[0.2em] italic">
          {job.status === "Searching" ? `Calibrating 3km area for available ${job.service} specialists.` : 
           job.status === "In Progress" ? `${job.workerName || 'Worker'} is currently performing ${job.service} at ${job.location}.` :
           `Service completed at ${job.location}.`}
        </p>

        {/* Timeline */}
        <div className="flex items-center justify-between relative mb-16 px-4">
           <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-white/5 -translate-y-1/2 z-0 mx-12 rounded-full" />
           {steps.map((s, i) => {
             const stepIndex = states.indexOf(s.key);
             const isActive = stepIndex <= currentIndex;
             const isCurrent = stepIndex === currentIndex;

             return (
               <div key={s.key} className="relative z-10 flex flex-col items-center gap-4">
                 <div className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-700 ${
                   isCurrent ? "bg-orange-500 border-orange-500 text-white scale-125 shadow-[0_0_30px_rgba(249,115,22,0.4)]" : 
                   isActive ? "bg-orange-500/10 border-orange-500/30 text-orange-500" : "bg-black border-white/5 text-slate-800"
                 }`}>
                   <s.icon size={24} strokeWidth={isCurrent ? 3 : 2} />
                 </div>
                 <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${isActive ? "text-orange-500" : "text-slate-800"}`}>
                   {s.label}
                 </span>
               </div>
             );
           })}
        </div>

        {/* Worker Info Card */}
        {job.workerName && (
          <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/5 text-left flex items-center gap-6 animate-fade-in shadow-inner group-hover:border-orange-500/20 transition-all mb-10">
             <div className="h-20 w-20 rounded-3xl bg-orange-500/20 flex items-center justify-center text-orange-500 text-3xl font-black border border-orange-500/10 shadow-inner">
                {job.workerName.charAt(0)}
             </div>
             <div className="flex-1 min-w-0">
                <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2 pl-1">Primary Match</div>
                <div className="text-xl font-black text-white truncate italic uppercase tracking-tighter">{job.workerName}</div>
                {job.workerSkill && (
                  <div className="text-[9px] font-black text-orange-400 mt-1 uppercase tracking-widest">{job.workerSkill}</div>
                )}
                <div className="flex items-center gap-3 mt-3">
                   <div className="flex items-center gap-2 text-[8px] font-black text-emerald-500 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 uppercase tracking-widest">
                      <ShieldCheck size={12} />
                      TRUST VERIFIED
                   </div>
                </div>
             </div>
             <div className="flex gap-3">
                <a href={`tel:${job.workerPhone}`} className="h-14 w-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all shadow-lg border border-orange-500/20">
                   <Phone size={22} />
                </a>
                <button className="h-14 w-14 rounded-2xl bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-all shadow-lg border border-white/10">
                   <MessageSquare size={22} />
                </button>
             </div>
          </div>
        )}

        <div className="space-y-6">
           {/* Review & Complete Form for In Progress jobs */}
           {(job.status === "In Progress" || job.status === "Accepted") && (
             <div className="space-y-4">
               {!showReviewForm ? (
                 <button
                   onClick={() => setShowReviewForm(true)}
                   className="w-full h-20 rounded-3xl bg-emerald-500 text-white font-black uppercase tracking-[0.4em] shadow-2xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs"
                 >
                  REVIEW & COMPLETE JOB
                 </button>
               ) : (
                 <div className="p-8 rounded-[2rem] bg-white/5 border border-emerald-500/20 animate-in slide-in-from-bottom-3 duration-300 text-left">
                   <h4 className="text-sm font-black text-white uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                     <Star size={18} className="text-orange-500" />
                     Rate This Service
                   </h4>
                   
                   {/* Star Rating */}
                   <div className="flex justify-center mb-6">
                     <div className="flex gap-3">
                       {[1, 2, 3, 4, 5].map(star => (
                         <button
                           key={star}
                           onClick={() => setReviewRating(star)}
                           className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
                             star <= reviewRating 
                               ? "bg-orange-500 text-white shadow-xl shadow-orange-500/30 scale-110" 
                               : "bg-white/5 text-slate-600 border border-white/10 hover:border-orange-500/30"
                           }`}
                         >
                           <Star size={24} fill={star <= reviewRating ? "currentColor" : "none"} />
                         </button>
                       ))}
                     </div>
                   </div>

                   {/* Comment */}
                   <textarea
                     value={reviewComment}
                     onChange={(e) => setReviewComment(e.target.value)}
                     placeholder="Share your experience... (optional)"
                     className="w-full p-4 rounded-2xl bg-black/40 border border-white/10 text-sm text-white placeholder:text-slate-700 outline-none focus:border-orange-500/50 resize-none h-24 mb-6"
                   />

                   <div className="flex gap-4">
                     <button
                       onClick={() => setShowReviewForm(false)}
                       className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={handleComplete}
                       disabled={reviewRating === 0 || isSubmitting}
                       className="flex-[2] h-14 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                     >
                       <Send size={16} />
                       {isSubmitting ? "SUBMITTING..." : "SUBMIT & COMPLETE"}
                     </button>
                   </div>
                 </div>
               )}
             </div>
           )}

           {job.status === "Searching" && (
             <button
               onClick={handleCancel}
               className="w-full h-20 rounded-3xl bg-white/5 border border-red-500/20 text-red-500 font-black uppercase tracking-[0.4em] hover:bg-red-500/5 transition-all text-[10px]"
             >
                ABORT MISSION
             </button>
           )}
           <div className="flex items-center justify-center gap-3 text-[9px] font-black text-slate-700 py-2 uppercase tracking-[0.3em] italic">
              <Clock size={12} className="text-orange-500" />
              Pulse Active since {job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "now"}
           </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-slate-950 p-8 border border-white/5 relative overflow-hidden">
         <div className="absolute -top-12 -right-12 h-24 w-24 bg-orange-500/5 rounded-full blur-2xl" />
         <h4 className="font-black text-[10px] text-slate-500 mb-6 flex items-center gap-3 uppercase tracking-[0.3em] pl-1 relative z-10">
            <AlertCircle size={16} className="text-orange-500" />
            Security Protocol
         </h4>
         <div className="space-y-6 relative z-10">
            <div className="flex items-start gap-4">
               <div className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">Worker generates a job-specific QR. Scan it to verify completion and leave a review.</p>
            </div>
            <div className="flex items-start gap-4">
               <div className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">Job is marked complete ONLY after your review, ensuring accountability for both parties.</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default LiveTracking;
