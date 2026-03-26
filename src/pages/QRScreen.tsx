import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { QrCode, Clock, ArrowLeft, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const QR_EXPIRY_SECONDS = 300; // 5 minutes

const QRScreen = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(QR_EXPIRY_SECONDS);
  const [isExpired, setIsExpired] = useState(false);
  const [sessionId, setSessionId] = useState(() => Date.now().toString(36));
  const [verificationCode, setVerificationCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [qrCount, setQrCount] = useState(() => {
    const saved = localStorage.getItem(`qr_count_${user?.id}`);
    const today = new Date().toDateString();
    if (saved) {
      const data = JSON.parse(saved);
      if (data.date === today) return data.count;
    }
    return 1;
  });

  const MAX_QR_PER_DAY = 10; // Increased for better UX during demo

  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem(`qr_count_${user?.id}`, JSON.stringify({ date: today, count: qrCount }));
  }, [qrCount, user?.id]);

  useEffect(() => {
    if (user && !isExpired) {
      if (!user.isDemo) {
        updateUser({ 
           activeVerificationCode: verificationCode, 
           activeSessionId: sessionId 
        });
      }
    }
  }, [sessionId, verificationCode, isExpired, user, updateUser]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const resetQR = () => {
    if (qrCount >= MAX_QR_PER_DAY) return;
    setQrCount(prev => prev + 1);
    const newSessionId = Date.now().toString(36);
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newSessionId);
    setVerificationCode(newCode);
    setSecondsLeft(QR_EXPIRY_SECONDS);
    setIsExpired(false);
  };

  if (!user || user.role !== "worker") {
    navigate("/");
    return null;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = secondsLeft / QR_EXPIRY_SECONDS;

  return (
    <div className="container mx-auto flex max-w-lg flex-col items-center py-6 md:py-12 pb-24 px-4 relative overflow-hidden">
       {/* Background Orbs */}
       <div className="absolute top-[10%] left-[-15%] h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />

       <div className="mb-10 flex w-full items-center justify-between relative z-10">
          <button onClick={() => navigate("/dashboard")} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all">
             <ArrowLeft size={24} />
          </button>
          <div className="text-center flex-1">
             <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase italic">Verification ID</h2>
             <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.4em] mt-1 pr-8">Handshake Protocol Active</p>
          </div>
       </div>

      <div className="w-full rounded-[3.5rem] bg-slate-950 p-10 text-center border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px] group-hover:scale-125 transition-transform duration-1000" />
        
        {/* QR visual */}
        <div className="relative mx-auto mb-10 flex h-72 w-72 items-center justify-center">
          {/* Timer ring */}
          <svg className="absolute inset-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke={isExpired ? "#ef4444" : "#f97316"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 301.6} 301.6`}
              transform="rotate(-90 50 50)"
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* QR placeholder */}
          <div className={`flex h-60 w-60 items-center justify-center rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${isExpired ? "border-red-500/20 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5 shadow-[inset_0_0_40px_rgba(249,115,22,0.05)]"}`}>
            {isExpired ? (
              <div className="flex flex-col items-center gap-3">
                 <AlertCircle size={40} className="text-red-500" />
                 <div className="text-[10px] font-black text-red-500 uppercase tracking-widest italic">Signal Expired</div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-[2rem] shadow-2xl shadow-orange-500/20 transform hover:scale-105 transition-transform duration-500">
                <QRCodeSVG 
                  value={`${window.location.origin}/verify/${user.id}/${sessionId}`}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
            )}
          </div>
        </div>

        {!isExpired && (
          <div className="mb-10 animate-in zoom-in-95 duration-700">
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] mb-4">Transmission Code</div>
            <div className="flex items-center justify-center gap-2">
              {verificationCode.split("").map((char, i) => (
                <div key={i} className="h-14 w-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl font-black text-orange-500 shadow-inner uppercase tracking-tighter">
                  {char}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timer & Status */}
        <div className="mb-10 flex flex-col items-center gap-2">
           <div className="flex items-center gap-3">
              <Clock size={20} className={isExpired ? "text-red-500" : "text-orange-500 animate-pulse"} />
              <span className={`text-4xl font-black tabular-nums tracking-tighter italic ${isExpired ? "text-red-500" : "text-white"}`}>
                {isExpired ? "00:00" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
              </span>
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4 leading-relaxed max-w-[240px]">
             {isExpired
               ? "Identity pulse timeout. Please regenerate handshake token."
               : "Request customer to authenticate using this signature."
             }
           </p>
        </div>

        {isExpired ? (
          <div className="w-full space-y-4">
            <button
              onClick={resetQR}
              disabled={qrCount >= MAX_QR_PER_DAY}
              className="h-20 w-full rounded-3xl bg-orange-500 text-white font-black uppercase tracking-[0.4em] shadow-2xl shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 flex items-center justify-center gap-3"
            >
              <RefreshCw size={24} />
              TOKEN REGEN
            </button>
            <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] italic">
              {MAX_QR_PER_DAY - qrCount} Synchronizations Remaining
            </p>
          </div>
        ) : (
          <div className="rounded-[2rem] bg-white/5 border border-white/5 p-6 flex items-center justify-between text-left group-hover:border-orange-500/20 transition-all">
             <div>
                <div className="text-lg font-black text-white italic tracking-tighter uppercase">{user.name}</div>
                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1">{user.skill}</div>
             </div>
             <div className="h-12 w-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                <ShieldCheck size={28} />
             </div>
          </div>
        )}
      </div>

      <div className="mt-10 rounded-[2rem] border border-dashed border-white/5 p-6 text-center bg-white/[0.02] max-w-sm">
         <div className="flex items-center justify-center gap-3 mb-3">
            <AlertCircle size={14} className="text-orange-500" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Safety Protocol 4.0</span>
         </div>
         <p className="text-[9px] font-bold text-slate-600 uppercase leading-relaxed">System cycles tokens every 300s to prevent session hijacking. Keep this screen active during handshake.</p>
      </div>
    </div>
  );
};

export default QRScreen;
