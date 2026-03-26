import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { matchSchemes, GovScheme } from '@/utils/govSchemes';
import { ArrowLeft, ExternalLink, ShieldCheck, Banknote, GraduationCap, Heart, Landmark, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { calculateIncomeStats } from '@/utils/financial';

const SchemesMatcher = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isHindi = language === 'hi';

  const [verifications, setVerifications] = useState<any[]>([]);
  const [muktiScore, setMuktiScore] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  useEffect(() => {
    if (!user) return;

    const vQuery = query(collection(db, 'verifications'), where('workerId', '==', user.id));
    const unsub = onSnapshot(vQuery, (snap) => {
      const vList = snap.docs.map(d => d.data());
      setVerifications(vList);

      const stats = calculateIncomeStats(vList);
      setMonthlyIncome(Math.round(stats.monthlyIncome));
    });

    setMuktiScore(user.muktiScore || 0);
    return () => unsub();
  }, [user]);

  if (!user || user.role !== 'worker') {
    navigate('/');
    return null;
  }

  const matched = matchSchemes(muktiScore, monthlyIncome, verifications.length, !!user.isVerifiedByAdmin);

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'loan': return <Banknote size={20} className="text-emerald-500" />;
      case 'insurance': return <Heart size={20} className="text-red-500" />;
      case 'skill': return <GraduationCap size={20} className="text-blue-500" />;
      case 'pension': return <Landmark size={20} className="text-purple-500" />;
      default: return <ShieldCheck size={20} className="text-orange-500" />;
    }
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'loan': return 'border-emerald-500/20 bg-emerald-500/5';
      case 'insurance': return 'border-red-500/20 bg-red-500/5';
      case 'skill': return 'border-blue-500/20 bg-blue-500/5';
      case 'pension': return 'border-purple-500/20 bg-purple-500/5';
      default: return 'border-orange-500/20 bg-orange-500/5';
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-6 md:py-10 pb-24 px-4 relative overflow-hidden">
      <div className="absolute top-[5%] left-[-10%] h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      
      <div className="mb-10 relative z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white uppercase">
          {isHindi ? 'सरकारी योजनाएँ' : 'Government Schemes'}
        </h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">
          {isHindi ? 'आपकी प्रोफ़ाइल के अनुसार मिलान' : 'Matched to your profile • Mukti Score: '}{muktiScore}
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-[2rem] bg-gradient-to-r from-emerald-600/20 to-emerald-500/5 border border-emerald-500/20 p-6 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="text-2xl font-black text-white italic tracking-tighter">
              {matched.length} {isHindi ? 'योजनाएँ उपलब्ध' : 'Schemes Available'}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isHindi ? 'आपकी आय और कार्य इतिहास के आधार पर' : 'Based on your income & work history'}
            </div>
          </div>
        </div>
      </div>

      {/* Scheme Cards */}
      <div className="space-y-4 relative z-10">
        {matched.map(scheme => (
          <div key={scheme.id} className={`rounded-[2rem] border p-5 sm:p-6 md:p-8 transition-all hover:scale-[1.01] ${categoryColor(scheme.category)}`}>
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="text-3xl mt-1">{scheme.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">
                      {isHindi ? scheme.nameHi : scheme.name}
                    </h3>
                    <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/10 text-slate-500">
                      {scheme.category}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">
                    {isHindi ? scheme.descriptionHi : scheme.description}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    {categoryIcon(scheme.category)}
                    <span className="text-sm font-black text-white italic tracking-tight">
                      {isHindi ? scheme.benefitHi : scheme.benefit}
                    </span>
                  </div>
                </div>
              </div>
              <a
                href={scheme.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all w-full sm:w-auto mt-4 sm:mt-0"
              >
                {isHindi ? 'आवेदन' : 'Apply'} <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}

        {matched.length === 0 && (
          <div className="py-20 text-center border border-dashed border-white/5 rounded-[2rem]">
            <Landmark size={48} className="mx-auto text-slate-800 mb-4 opacity-30" />
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
              {isHindi ? 'अभी कोई योजना मिलान नहीं। अपना स्कोर बढ़ाएँ।' : 'No schemes matched yet. Increase your Mukti Score to unlock more.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemesMatcher;
