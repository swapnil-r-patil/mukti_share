import React, { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Search, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Star, 
  User, 
  Wrench,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { analyzeReview } from "@/utils/nlpProcessor";
import { toast } from "sonner";

const AdminReviews = () => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const isDemo = currentUser?.isDemo;
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "verifications"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "verifications", id));
      toast.error("Review permanently deleted");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleModerate = async (id: string, action: string) => {
    toast.success(`Review marked as ${action}`);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-foreground italic tracking-tighter uppercase">{t("admin_sidebar_reviews")}</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">NLP-enriched content moderation & quality control</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-muted-foreground font-black uppercase tracking-widest text-xs">
            Synthesizing NLP Insights...
          </div>
        ) : reviews.map((review) => {
          const nlp = review.nlp || analyzeReview(review.comment || "");
          
          return (
            <div key={review.id} className="group rounded-[3rem] bg-card border border-border p-8 hover:border-orange-500/20 transition-all shadow-2xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* User Info */}
                  <div className="lg:w-64 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center font-black text-muted-foreground uppercase italic shadow-sm">
                           {review.workerName?.[0] || 'W'}
                        </div>
                        <div className="min-w-0">
                           <div className="text-sm font-black text-foreground truncate italic tracking-tight">{review.workerName || "Worker"}</div>
                           <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{review.workerSkill || "Service"}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 pt-4 border-t border-border">
                        <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center font-black text-muted-foreground text-[10px] border border-border shadow-inner">
                           C
                        </div>
                        <div className="min-w-0">
                           <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Customer ID</div>
                           <div className="text-[10px] font-bold text-foreground/60 truncate">{review.customerId?.slice(0, 12)}...</div>
                        </div>
                     </div>
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 flex flex-col justify-between pt-4 lg:pt-0">
                     <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           {[...Array(5)].map((_, i) => (
                             <Star key={i} size={14} className={i < review.rating ? "text-orange-500 fill-orange-500" : "text-secondary"} />
                           ))}
                           <span className="ml-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest italic opacity-60">Captured {new Date(review.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                        </div>
                        <p className="text-foreground text-base font-medium leading-relaxed italic">"{review.comment}"</p>
                     </div>

                     {/* NLP Insights Bar */}
                     <div className="mt-8 flex flex-wrap gap-2">
                        <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2 ${
                          nlp.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                          'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                           <Sparkles size={12} />
                           <span className="text-[10px] font-black uppercase tracking-[0.2em]">{nlp.sentiment} SENTIMENT</span>
                        </div>
                        {nlp.skills?.map((skill: string, idx: number) => (
                           <div key={idx} className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center gap-2">
                              <Wrench size={12} />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{skill}</span>
                           </div>
                        ))}
                        {nlp.issues?.map((issue: string, idx: number) => (
                           <div key={idx} className="px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                              <AlertCircle size={12} />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{issue}</span>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Actions */}
                  <div className="lg:w-48 flex flex-col gap-3 justify-end pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border lg:pl-8">
                     <button onClick={() => handleModerate(review.id, "approved")} className="h-12 w-full rounded-xl bg-emerald-500/10 text-emerald-500 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20 active:scale-95">
                        Approve
                     </button>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleModerate(review.id, "flagged")} className="h-12 rounded-xl border border-border text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-all flex items-center justify-center active:scale-95">
                           <Flag size={18} />
                        </button>
                        <button onClick={() => handleDelete(review.id)} className="h-12 rounded-xl border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center active:scale-95">
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </div>
                </div>
              </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminReviews;
