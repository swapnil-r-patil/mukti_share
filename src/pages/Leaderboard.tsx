import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { ShieldCheck, Star, Trophy, Medal, Crown, TrendingUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LeaderboardWorker {
  id: string;
  name: string;
  skill: string;
  muktiScore: number;
  isVerifiedByAdmin: boolean;
  photo?: string;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<LeaderboardWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'worker')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as LeaderboardWorker))
        .filter(w => (w.muktiScore || 0) > 0)
        .sort((a, b) => (b.muktiScore || 0) - (a.muktiScore || 0))
        .slice(0, 50);
      setWorkers(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Crown size={24} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />;
    if (rank === 1) return <Medal size={22} className="text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" />;
    if (rank === 2) return <Medal size={20} className="text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.4)]" />;
    return <span className="text-sm font-black text-slate-600 w-6 text-center">{rank + 1}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 0) return 'border-yellow-500/30 bg-yellow-500/5 shadow-[0_0_30px_rgba(250,204,21,0.1)]';
    if (rank === 1) return 'border-slate-400/20 bg-slate-400/5';
    if (rank === 2) return 'border-orange-500/20 bg-orange-500/5';
    return 'border-white/5 bg-white/[0.02]';
  };

  return (
    <div className="container mx-auto max-w-5xl py-6 md:py-10 pb-24 px-4 relative overflow-hidden">
      <div className="absolute top-[5%] left-[-10%] h-[400px] w-[400px] rounded-full bg-yellow-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-5%] h-[500px] w-[500px] rounded-full bg-orange-500/5 blur-[150px] pointer-events-none" />

      <div className="mb-10 relative z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-xl shadow-orange-500/20">
            <Trophy size={28} strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white uppercase">Leaderboard</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">Top Verified Workers by Mukti Score</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-pulse text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Registry...</div>
          </div>
        ) : workers.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/5 rounded-[2rem]">
            <Trophy size={48} className="mx-auto text-slate-800 mb-4 opacity-30" />
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">No scored workers yet</p>
          </div>
        ) : workers.map((worker, rank) => (
          <div
            key={worker.id}
            className={`flex items-center justify-between p-4 sm:p-5 md:p-6 rounded-[2rem] border transition-all hover:scale-[1.01] ${getRankBg(rank)}`}
          >
            <div className="flex items-center gap-5">
              <div className="w-8 flex justify-center">{getRankIcon(rank)}</div>
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-slate-400 text-lg">
                {worker.photo ? <img src={worker.photo} className="h-full w-full rounded-2xl object-cover" /> : worker.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black text-white italic tracking-tighter uppercase">{worker.name}</div>
                  {worker.isVerifiedByAdmin && <ShieldCheck size={14} className="text-emerald-500" />}
                </div>
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{worker.skill || 'General'}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-xl font-black text-lg italic tracking-tighter ${
                (worker.muktiScore || 0) >= 80 ? 'text-emerald-500 bg-emerald-500/10' :
                (worker.muktiScore || 0) >= 50 ? 'text-orange-500 bg-orange-500/10' : 'text-red-500 bg-red-500/10'
              }`}>
                {Math.round(worker.muktiScore || 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
