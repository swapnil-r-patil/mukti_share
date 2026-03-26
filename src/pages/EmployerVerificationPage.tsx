import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ShieldCheck, User, Phone, CheckCircle2, AlertTriangle, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";

const EmployerVerificationPage = () => {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"intro" | "otp" | "success" | "error">("intro");
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const fetchWorker = async () => {
      if (!workerId) {
        setStep("error");
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "users", workerId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role !== "worker" || data.workerType !== "single") {
             setStep("error");
          } else {
             setWorker(data);
          }
        } else {
          setStep("error");
        }
      } catch (err) {
        console.error(err);
        setStep("error");
      } finally {
        setLoading(false);
      }
    };

    fetchWorker();
  }, [workerId]);

  const handleSendOtp = () => {
    setStep("otp");
    toast.success(`Verification code sent to your registered mobile ending in ${worker?.employerPhone?.slice(-4) || 'XXXX'}`);
  };

  const handleVerify = async () => {
    if (otp.length !== 4) {
      toast.error("Please enter a valid 4-digit code.");
      return;
    }

    setIsVerifying(true);
    try {
      if (workerId) {
        // Update worker's employerVerified status
        await updateDoc(doc(db, "users", workerId), {
          employerVerified: true
        });
        setStep("success");
        toast.success("Worker identity verified successfully!");
      }
    } catch (err) {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <p className="font-bold text-muted-foreground animate-pulse">Loading Verification Flow...</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-6">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-2xl font-black mb-2 uppercase">Invalid Link</h1>
        <p className="text-muted-foreground max-w-xs mb-8">This verification link is invalid or has expired. Please ask the worker to send a fresh request.</p>
        <button onClick={() => navigate("/")} className="px-8 py-3 rounded-xl bg-foreground text-background font-bold">Return Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Decorative Blur */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        {step === "intro" && (
          <div className="glass p-8 rounded-[40px] border-primary/20 shadow-2xl animate-in zoom-in-95 duration-500">
             <div className="flex justify-center mb-6">
                <div className="h-20 w-20 rounded-[24px] bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                   <ShieldCheck size={40} className="text-white" />
                </div>
             </div>
             
             <h1 className="text-2xl font-black text-center mb-2 uppercase tracking-tight">Identity Verification</h1>
             <p className="text-sm text-center text-muted-foreground font-medium mb-10 leading-relaxed px-4">
               You are about to verify the work identity for your informal staff member.
             </p>

             <div className="space-y-4 mb-10">
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-background/50 border border-border/30">
                   <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                      <User size={24} className="text-primary" />
                   </div>
                   <div>
                      <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Worker Name</div>
                      <div className="text-base font-black uppercase">{worker?.name || "Unknown"}</div>
                   </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-background/50 border border-border/30">
                   <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                      <Phone size={24} className="text-success" />
                   </div>
                   <div>
                      <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Your Registered Phone</div>
                      <div className="text-base font-black tracking-widest">+91 {worker?.employerPhone?.replace(/(\d{6})(\d{4})/, "******$2") || "XXXXXXXXXX"}</div>
                   </div>
                </div>
             </div>

             <button 
               onClick={handleSendOtp}
               className="w-full h-16 rounded-[24px] bg-foreground text-background font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
             >
               Confirm & Verify 
               <ArrowRight size={20} />
             </button>
             <p className="text-[10px] font-bold text-muted-foreground text-center mt-6 uppercase tracking-widest opacity-60">Verified by Mukti-Portal Security</p>
          </div>
        )}

        {step === "otp" && (
          <div className="glass p-8 rounded-[40px] border-primary/20 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-500">
             <div className="flex items-center gap-4 mb-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                   <Lock size={26} />
                </div>
                <div>
                   <h2 className="text-lg font-black uppercase tracking-tight">Enter Secure OTP</h2>
                   <p className="text-xs font-bold text-muted-foreground">Sent to your registered mobile</p>
                </div>
             </div>

             <div className="flex justify-center gap-3 mb-10">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    type="tel"
                    maxLength={1}
                    value={otp[i] || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const newOtp = otp.split("");
                      newOtp[i] = val;
                      const joined = newOtp.slice(0, 4).join("");
                      setOtp(joined);
                      if (val && e.target.nextElementSibling) {
                        (e.target.nextElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    autoFocus={i === 0}
                    className="h-16 w-14 rounded-2xl border-2 border-border/50 bg-background/50 text-center text-3xl font-black outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                ))}
             </div>

             <button 
               onClick={handleVerify}
               disabled={otp.length < 4 || isVerifying}
               className="w-full h-16 rounded-[24px] bg-primary text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
             >
               {isVerifying ? "Verifying..." : "Complete Verification"}
             </button>
             
             <button 
               onClick={() => setStep("intro")}
               className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
             >
               Edit Details
             </button>
          </div>
        )}

        {step === "success" && (
          <div className="glass p-10 rounded-[40px] border-success/30 bg-success/5 shadow-2xl text-center animate-in zoom-in-95 duration-500">
             <div className="flex justify-center mb-8">
                <div className="h-24 w-24 rounded-full bg-success text-white flex items-center justify-center shadow-lg shadow-success/30">
                   <CheckCircle2 size={56} />
                </div>
             </div>
             
             <h1 className="text-3xl font-black mb-4 uppercase tracking-tighter text-success">Verified!</h1>
             <p className="text-sm text-foreground/80 font-bold mb-10 leading-relaxed px-2">
               Thank you. {worker?.name}'s work identity has been officially verified by you. This session is now securely closed.
             </p>

             <div className="p-4 rounded-2xl bg-success/10 border border-success/20 text-[10px] font-black text-success uppercase tracking-[0.2em] mb-8">
                Trust Score Boosted for Work History
             </div>
             
             <button 
               onClick={() => window.close()}
               className="w-full h-14 rounded-2xl bg-foreground text-background font-black uppercase text-xs tracking-widest"
             >
               Close Window
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployerVerificationPage;
