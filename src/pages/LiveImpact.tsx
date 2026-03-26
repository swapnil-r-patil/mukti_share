import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Users, ShieldCheck, TrendingUp, Briefcase, Star, Globe, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveImpact = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalWorkers: 0,
    totalCustomers: 0,
    verifiedWorkers: 0,
    totalVerifications: 0,
    totalRequests: 0,
    avgScore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubWorkers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'worker')), (snap) => {
      const workers = snap.docs.map(d => d.data());
      const verified = workers.filter(w => w.isVerifiedByAdmin || w.status === 'verified').length;
      const scores = workers.map(w => w.muktiScore || 0).filter(s => s > 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      setStats(prev => ({ ...prev, totalWorkers: snap.size, verifiedWorkers: verified, avgScore: Math.round(avg) }));
      setLoading(false);
    });

    const unsubCustomers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'customer')), (snap) => {
      setStats(prev => ({ ...prev, totalCustomers: snap.size }));
    });

    const unsubVerifications = onSnapshot(collection(db, 'verifications'), (snap) => {
      setStats(prev => ({ ...prev, totalVerifications: snap.size }));
    });

    const unsubRequests = onSnapshot(collection(db, 'verification_requests'), (snap) => {
      setStats(prev => ({ ...prev, totalRequests: snap.size }));
    });

    return () => { unsubWorkers(); unsubCustomers(); unsubVerifications(); unsubRequests(); };
  }, []);

  const impactCards = [
    { icon: Users, label: 'Workers Onboarded', value: stats.totalWorkers, color: 'from-orange-500 to-orange-600', shadow: 'shadow-orange-500/30' },
    { icon: ShieldCheck, label: 'Identity Verified', value: stats.verifiedWorkers, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/30' },
    { icon: Users, label: 'Customers Active', value: stats.totalCustomers, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' },
    { icon: Briefcase, label: 'Work Verifications', value: stats.totalVerifications, color: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/30' },
    { icon: TrendingUp, label: 'Verification Requests', value: stats.totalRequests, color: 'from-pink-500 to-pink-600', shadow: 'shadow-pink-500/30' },
    { icon: Star, label: 'Avg Mukti Score', value: stats.avgScore, color: 'from-yellow-500 to-orange-500', shadow: 'shadow-yellow-500/30' },
  ];

  // Estimate credit unlocked: verified workers × avg income estimate
  const creditUnlocked = stats.verifiedWorkers * 15000;

  return (
    <div className="container mx-auto max-w-7xl py-6 md:py-10 pb-24 px-4 relative overflow-hidden">
      <div className="absolute top-[5%] left-[-15%] h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[50%] right-[-10%] h-[600px] w-[600px] rounded-full bg-blue-500/5 blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[30%] h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <div className="mb-12 relative z-10 text-center">
        <button onClick={() => navigate(-1)} className="absolute left-0 top-0 flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
          <Globe size={16} className="text-orange-500" />
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em]">Live Data • Real-Time</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black italic tracking-tighter text-white uppercase">
          Mukti <span className="text-orange-500">Impact</span>
        </h1>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-4 max-w-lg mx-auto">
          Building creditworthiness for India's informal workforce — one verified handshake at a time.
        </p>
      </div>

      {/* Hero Stat */}
      <div className="relative z-10 mb-10">
        <div className="rounded-[3rem] bg-gradient-to-br from-orange-600 to-orange-400 p-8 sm:p-10 md:p-14 text-center shadow-2xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
          <div className="relative z-10">
            <div className="text-[10px] font-black text-white/70 uppercase tracking-[0.5em] mb-3">Estimated Credit Unlocked</div>
            <div className="text-3xl sm:text-5xl md:text-7xl font-black text-white italic tracking-tighter">
              ₹{creditUnlocked.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mt-3">
              For {stats.verifiedWorkers} verified workers • Estimated monthly potential
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 relative z-10 mb-10">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="animate-pulse text-slate-500 font-bold uppercase tracking-widest text-[10px]">Computing Impact...</div>
          </div>
        ) : impactCards.map((card, i) => (
          <div key={i} className="rounded-[2rem] bg-slate-950 border border-white/5 p-4 sm:p-6 md:p-8 text-center group hover:border-white/10 transition-all">
            <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mx-auto mb-4 shadow-lg ${card.shadow} group-hover:scale-110 transition-transform`}>
              <card.icon size={24} className="text-white" />
            </div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white italic tracking-tighter">{card.value}</div>
            <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mt-2">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Mission Statement */}
      <div className="rounded-[2.5rem] bg-slate-950 border border-white/5 p-8 md:p-12 text-center relative z-10">
        <div className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] mb-4">Our Mission</div>
        <p className="text-lg md:text-xl font-bold text-slate-300 leading-relaxed max-w-2xl mx-auto italic">
          "Every informal worker deserves a digital identity. Every verified handshake builds a credit-ready future. Mukti Portal bridges the gap between informal labor and financial inclusion."
        </p>
      </div>
    </div>
  );
};

export default LiveImpact;
