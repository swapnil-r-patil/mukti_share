import React, { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  History, 
  Smartphone, 
  MapPin,
  Flag,
  UserMinus,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@/types/auth";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

const AdminCustomers = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const { user: currentUser } = useAuth();
  const isDemo = currentUser?.isDemo;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "users"), where("role", "==", "customer"));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      if (list.length === 0) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      // Always show real data from Firebase
      setCustomers(list.map(c => ({ ...c, reviewCount: 0 })));
      setLoading(false);

      const fetchReviewCounts = async () => {
        try {
          const enriched = await Promise.all(list.map(async (customer) => {
            const vQ = query(collection(db, "verifications"), where("customerId", "==", customer.id));
            const vSnap = await getDocs(vQ);
            return { ...customer, reviewCount: vSnap.size };
          }));
          setCustomers(enriched);
        } catch (err) {
          console.warn("Review count enrichment failed:", err);
        }
      };
      fetchReviewCounts();
    }, (err) => {
      console.error("Firestore Customer Sync Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemo]);

  const handleAction = async (customerId: string, action: string) => {
    try {
      if (action === "block") {
        await updateDoc(doc(db, "users", customerId), { status: "blocked" });
        toast.error("Customer blocked");
      } else if (action === "trust") {
        await updateDoc(doc(db, "users", customerId), { badges: ["Trusted Customer"] });
        toast.success("Trusted Badge assigned");
      }
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">{t("admin_sidebar_customers")}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Customer behavior oversight & trust integrity monitoring</p>
        </div>
      </div>

      <div className="flex bg-slate-900/50 p-6 rounded-[2rem] border border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-orange-500 transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center animate-pulse text-slate-600 font-black uppercase tracking-widest text-xs">
            Retrieving Customer Profiles...
          </div>
        ) : filteredCustomers.map((customer) => (
          <div key={customer.id} className="group relative rounded-[2.5rem] bg-slate-900 border border-white/5 p-8 hover:border-white/10 transition-all shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
               <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                 customer.customer_type === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
               }`}>
                 {customer.customer_type === 0 ? 'LONG-TERM' : 'OCCASIONAL'}
               </div>
            </div>

            <div className="flex items-center gap-5 mb-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-white text-xl shadow-inner group-hover:scale-105 transition-transform uppercase">
                {customer.name[0]}
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">{customer.name}</h3>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">{customer.phone}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                     <ShieldCheck size={14} />
                     <span className="text-[9px] font-black uppercase tracking-widest">Trust Store</span>
                  </div>
                  <div className={`text-xl font-black ${
                    (customer.trustScore || 0) > 80 ? 'text-emerald-500' : 
                    (customer.trustScore || 0) > 50 ? 'text-orange-500' : 'text-red-500'
                  }`}>
                    {customer.trustScore || 0}%
                  </div>
               </div>
               <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                     <History size={14} />
                     <span className="text-[9px] font-black uppercase tracking-widest">Reviews</span>
                  </div>
                  <div className="text-xl font-black text-white">
                    {Math.floor((customer as any).reviewCount || 0)}
                  </div>
               </div>
            </div>

            <div className="space-y-3 mb-8">
               <div className="flex items-center gap-3 text-slate-500">
                  <Smartphone size={14} className="text-slate-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Device ID:</span>
                  <span className="text-[10px] font-black text-slate-400 truncate">{customer.deviceId || 'NOT_CAPTURED'}</span>
               </div>
               <div className="flex items-center gap-3 text-slate-500">
                  <MapPin size={14} className="text-slate-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Location:</span>
                  <span className="text-[10px] font-black text-slate-400 truncate">{(customer as any).location || 'Location Unknown'}</span>
               </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-white/5">
              <button 
                onClick={() => handleAction(customer.id, "trust")}
                className="flex-1 py-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
              >
                TRUST
              </button>
              <button 
                onClick={() => handleAction(customer.id, "block")}
                className="flex-1 py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all underline decoration-dotted"
              >
                BLOCK
              </button>
              <button className="p-3 bg-white/5 text-slate-500 rounded-xl hover:text-white transition-all">
                <AlertCircle size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminCustomers;
