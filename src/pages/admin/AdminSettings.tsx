import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Globe, 
  Shield, 
  MessageSquare, 
  BrainCircuit, 
  TrendingUp,
  Clock,
  Zap,
  DollarSign
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { BASE_RATES } from "@/utils/adminLogic";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

const AdminSettings = () => {
  const { t } = useLanguage();
  const [config, setConfig] = useState({
    minReviewGap: 7,
    fraudSensitivity: "Medium",
    enableML: true,
    enableNLP: true,
    baseRates: { ...BASE_RATES }
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "system"), (snap) => {
      if (snap.exists()) {
        setConfig(prev => ({ ...prev, ...snap.data() }));
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, "config", "system"), config, { merge: true });
      toast.success("System configurations updated successfully");
    } catch (err) {
      console.error("Save config failed:", err);
      toast.error("Failed to save configuration");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Restore factory defaults?")) return;
    try {
      const defaults = {
        minReviewGap: 7,
        fraudSensitivity: "Medium",
        enableML: true,
        enableNLP: true,
        baseRates: { ...BASE_RATES }
      };
      await setDoc(doc(db, "config", "system"), defaults);
      setConfig(defaults);
      toast.info("Settings reverted to factory defaults");
    } catch (err) {
      toast.error("Reset failed");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">{t("admin_sidebar_settings")}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Global system parameters & algorithmic thresholds</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleReset} className="h-12 px-6 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/10 transition-all">
            <RotateCcw size={16} /> Reset Default
          </button>
          <button onClick={handleSave} className="h-12 px-8 rounded-xl bg-orange-600 text-white flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-600/20 hover:scale-105 transition-all">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Core Algorithm Settings */}
        <div className="space-y-8">
          <div className="rounded-[2.5rem] bg-slate-900 border border-white/5 p-8 shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-orange-600/10 text-orange-500">
                   <Shield size={24} />
                </div>
                <h3 className="text-xl font-black text-white italic uppercase">Trust & Fraud Logic</h3>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                      <span>Minimum Review Gap</span>
                      <span className="text-orange-500">{config.minReviewGap} Days</span>
                   </div>
                   <input 
                     type="range" min="1" max="30" value={config.minReviewGap} 
                     onChange={(e) => setConfig({...config, minReviewGap: parseInt(e.target.value)})}
                     className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-orange-600"
                   />
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Fraud Detection sensitivity</label>
                   <div className="grid grid-cols-3 gap-3">
                      {["Low", "Medium", "High"].map((level) => (
                        <button
                          key={level}
                          onClick={() => setConfig({...config, fraudSensitivity: level})}
                          className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            config.fraudSensitivity === level 
                            ? 'bg-orange-600 text-white shadow-lg' 
                            : 'bg-white/5 text-slate-600 border border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                   <div className="flex items-center gap-3">
                      <BrainCircuit size={20} className="text-slate-400" />
                      <div className="text-sm font-bold text-white uppercase tracking-wider">AI Fraud Prediction (ML)</div>
                   </div>
                   <button 
                     onClick={() => setConfig({...config, enableML: !config.enableML})}
                     className={`w-14 h-8 rounded-full transition-all relative ${config.enableML ? 'bg-orange-600' : 'bg-slate-950'}`}
                   >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${config.enableML ? 'left-7' : 'left-1 shadow-inner'}`} />
                   </button>
                </div>
             </div>
          </div>

          <div className="rounded-[2.5rem] bg-slate-900 border border-white/5 p-8 shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-500">
                   <MessageSquare size={24} />
                </div>
                <h3 className="text-xl font-black text-white italic uppercase">NLP Content Engine</h3>
             </div>

             <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                   <div className="flex items-center gap-3">
                      <Zap size={20} className="text-blue-400" />
                      <div className="text-sm font-bold text-white uppercase tracking-wider">Semantic Analysis</div>
                   </div>
                   <button 
                     onClick={() => setConfig({...config, enableNLP: !config.enableNLP})}
                     className={`w-14 h-8 rounded-full transition-all relative ${config.enableNLP ? 'bg-blue-600' : 'bg-slate-950'}`}
                   >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${config.enableNLP ? 'left-7' : 'left-1'}`} />
                   </button>
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 leading-relaxed">Extracts skills, sentiment and issues automatically from raw review text during the verification handshake.</p>
             </div>
          </div>
        </div>

        {/* Financial Base Rates */}
        <div className="rounded-[2.5rem] bg-slate-900 border border-white/5 p-8 shadow-2xl relative flex flex-col overflow-hidden">
           <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-2xl bg-emerald-600/10 text-emerald-500">
                 <DollarSign size={24} />
              </div>
              <h3 className="text-xl font-black text-white italic uppercase">Financial Parameterization</h3>
           </div>

           <div className="flex-1 space-y-4">
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Base Daily Rates for Income Projections (₹)</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Object.entries(config.baseRates).map(([skill, rate]) => (
                   <div key={skill} className="p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-emerald-500/30 transition-all">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">{skill}</div>
                      <input 
                        type="number" 
                        value={rate}
                        onChange={(e) => setConfig({
                          ...config, 
                          baseRates: { ...config.baseRates, [skill]: parseInt(e.target.value) || 0 }
                        })}
                        className="bg-transparent text-xl font-black text-white w-full outline-none focus:text-emerald-500 transition-colors"
                      />
                   </div>
                 ))}
              </div>
           </div>

           <div className="mt-8 p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-3 mb-2">
                 <TrendingUp size={18} className="text-emerald-500" />
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">IMPACT ANALYTICS</span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-relaxed">Adjusting these rates will globally recalculate the **Loan Eligibility** and **Yield Projections** for over 1,200 informal workers.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
