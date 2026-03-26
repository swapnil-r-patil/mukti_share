import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole, WorkerType } from "@/types/auth";
import { Briefcase, User, AlertCircle, Eye, EyeOff, Crosshair, MapPin, Loader2 } from "lucide-react";
import { getCurrentPosition, reverseGeocode } from "@/utils/geoValidator";
import { toast } from "sonner";

const LoginPage = () => {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  
  // Login State
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Signup State
  const [signupStep, setSignupStep] = useState<"role" | "method" | "credentials" | "otp" | "workerType" | "details">("role");
  const [role, setRole] = useState<UserRole>("worker");
  const [workerType, setWorkerType] = useState<WorkerType>(1); // Default to Mobile (1)
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [employerName, setEmployerName] = useState("");
  const [employerPhone, setEmployerPhone] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);

  const { user, login, signup, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const navLocation = useLocation();
  const from = (navLocation.state as any)?.from?.pathname || null;

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      console.log("Logged in as:", user.role);
      
      // Prioritize the 'from' location from ProtectedRoute state
      if (from) {
        navigate(from, { replace: true });
        return;
      }
      
      const path = user.role === "admin" ? "/admin/dashboard" : (user.role === "worker" ? "/dashboard" : "/customer");
      navigate(path, { replace: true });
    }
  }, [user, navigate, from]);

  // === GOOGLE HANDLER ===
  const handleGoogleSignIn = async () => {
    try {
      console.log("Starting Google Sign-In with role:", role);
      await signInWithGoogle(role);
    } catch (err: any) {
      console.error("LoginPage Google Sign-In Error:", err);
      // More descriptive alert
      alert(`Google Sign-In failed: ${err.message || "Unknown error"}`);
    }
  };

  // === LOGIN HANDLERS ===
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError("");
    const phone = loginPhone;
    const password = loginPassword;
    if (phone.length === 10 && password) {
      try {
        await login(phone, password);
      } catch (err: any) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          setLoginError("Invalid credentials or account not found.");
        } else {
          setLoginError("Failed to log in. Please try again.");
        }
      }
    }
  };

  // === SIGNUP HANDLERS ===
  const handleSignupCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length === 10 && password) {
      setSignupStep("otp");
    }
  };

  const handleSignupOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 4) {
      try {
        if (role === "customer") {
          await signup(phone, "customer", "Customer", password);
        } else {
          setSignupStep("details"); // Skip workerType selection
        }
      } catch (err: any) {
        alert(`Signup failed: ${err.message}`);
      }
    }
  };

  // Auto-detect location for details step
  useEffect(() => {
    if (signupStep === "details" && !location) {
      handleDetectLocation();
    }
  }, [signupStep]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const pos = await getCurrentPosition();
      setLocationCoords(pos);
      const city = await reverseGeocode(pos.lat, pos.lng);
      setLocation(city);
      toast.success(`Location detected: ${city}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Location detection failed. Please enter manually.");
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(
        phone, 
        "worker", 
        name || "Worker", 
        password, 
        skill, 
        location, 
        photo,
        workerType,
        undefined, // employerName
        undefined, // employerPhone
        locationCoords || undefined
      );
    } catch (err: any) {
      alert(`Failed to complete profile: ${err.message}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-accent/20 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-[380px] space-y-5 z-10 relative">
        {/* Main Card */}
        <div className="flex flex-col items-center glass px-8 py-10 rounded-2xl card-shadow-hover animate-fade-up">
          {/* Logo / Brand Name */}
          <h1 className="mb-8 font-serif text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            Mukti-Portal
          </h1>

          {/* ==================================== */}
          {/*              LOGIN UI                */}
          {/* ==================================== */}
          {authMode === "login" && (
            <div className="w-full">
              <p className="mb-6 text-center text-sm font-semibold text-muted-foreground">
                Log in to your account.
              </p>
              
              {loginError && (
                <div className="mb-4 flex items-center gap-2 rounded bg-destructive/10 p-2 text-xs font-semibold text-destructive">
                  <AlertCircle size={14} />
                  <p>{loginError}</p>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3" autoComplete="off">
                <div className="relative">
                  <input
                    type="tel"
                    name="loginPhone"
                    autoComplete="off"
                    maxLength={10}
                    value={loginPhone}
                    onChange={(e) => {
                      setLoginPhone(e.target.value.replace(/\D/g, ""));
                      setLoginError("");
                    }}
                    placeholder="Phone number"
                    className={`w-full rounded-xl border ${loginError ? 'border-destructive' : 'border-border'} bg-background/50 backdrop-blur-sm px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background`}
                    autoFocus
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    +91
                  </span>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="loginPassword"
                    autoComplete="new-password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError("");
                    }}
                    placeholder="Password"
                    className={`w-full rounded-xl border ${loginError ? 'border-destructive' : 'border-border'} bg-background/50 backdrop-blur-sm px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loginPhone.length !== 10 || !loginPassword}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary to-orange-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  Log in
                </button>

                <div className="my-3 flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-border/30" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Or continue with</span>
                  <div className="h-[1px] flex-1 bg-border/30" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/50 py-3 text-sm font-bold text-foreground transition-all hover:bg-background active:scale-95"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.63l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>

                {/* One-Click Demo Access buttons are responsive (grid on mobile, flex on desktop) */}
                <div className="mt-8 space-y-3 relative z-50">
                  <p className="text-[10px] font-black text-center text-muted-foreground uppercase tracking-[0.2em] mb-2 opacity-60">One-Click Demo Access</p>
                  <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={async (e) => { 
                        e.preventDefault(); e.stopPropagation();
                        console.log("Worker Demo Clicked");
                        await login("1234567891", "123456");
                      }}
                      className="flex-1 py-3 px-2 text-[10px] sm:text-[11px] font-black rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 shadow-sm cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      Worker
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => { 
                        e.preventDefault(); e.stopPropagation();
                        await login("1234567890", "123456");
                      }}
                      className="flex-1 py-3 px-2 text-[10px] sm:text-[11px] font-black rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all active:scale-95 shadow-sm cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => { 
                        e.preventDefault(); e.stopPropagation();
                        await login("1234567892", "123456");
                      }}
                      className="col-span-2 sm:flex-1 py-3 px-2 text-[10px] sm:text-[11px] font-black rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all active:scale-95 shadow-sm cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      Admin
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}


          {/* ==================================== */}
          {/*              SIGNUP UI               */}
          {/* ==================================== */}
          {authMode === "signup" && (
            <div className="w-full">
              {signupStep === "role" && (
                <div className="flex w-full flex-col gap-3">
                  <p className="mb-4 text-center text-sm font-semibold text-muted-foreground">
                    Join to build your verified work history.
                  </p>
                  <button
                    onClick={() => { setRole("worker"); setSignupStep("method"); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95"
                  >
                    <Briefcase size={18} /> Sign up as Worker
                  </button>
                  
                  <div className="my-3 flex items-center gap-3">
                    <div className="h-[1px] flex-1 bg-border" />
                    <span className="text-xs font-semibold text-muted-foreground">OR</span>
                    <div className="h-[1px] flex-1 bg-border" />
                  </div>

                  <button
                    onClick={() => { setRole("customer"); setSignupStep("method"); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary text-sm font-bold text-primary py-3 transition-all hover:bg-primary/5 active:scale-95"
                  >
                    <User size={18} /> Sign up as Customer
                  </button>
                </div>
              )}

              {signupStep === "method" && (
                <div className="flex w-full flex-col gap-3">
                  <p className="mb-6 text-center text-sm font-semibold text-muted-foreground">
                    Continue with your {role} account.
                  </p>
                  
                  <button
                    onClick={() => setSignupStep("credentials")}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-primary to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95"
                  >
                    Continue with Phone
                  </button>

                  <div className="my-3 flex items-center gap-3">
                    <div className="h-[1px] flex-1 bg-border/30" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">OR</span>
                    <div className="h-[1px] flex-1 bg-border/30" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/50 py-3.5 text-sm font-bold text-foreground transition-all hover:bg-background active:scale-95"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.63l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>
              )}

              {signupStep === "credentials" && (
                <>
                  <p className="mb-6 text-center text-sm font-semibold text-muted-foreground">
                    Create your account credentials.
                  </p>
                  <form onSubmit={handleSignupCredentialsSubmit} className="flex flex-col gap-3">
                    <div className="relative">
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="Phone number"
                        className="w-full rounded-xl border border-border bg-background/50 backdrop-blur-sm px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background"
                        autoFocus
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        +91
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create Password"
                        className="w-full rounded-xl border border-border bg-background/50 backdrop-blur-sm px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={phone.length !== 10 || !password}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary to-orange-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                    >
                      Send OTP
                    </button>
                  </form>
                </>
              )}

              {signupStep === "otp" && (
                <div className="w-full text-center">
                  <p className="mb-2 text-sm font-semibold text-foreground">Enter Confirmation Code</p>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Code sent to +91 {phone}.<br /><span className="text-xs">(Demo: any 4 digits)</span>
                  </p>
                  <form onSubmit={handleSignupOtpSubmit} className="flex flex-col gap-2">
                    <div className="flex justify-center gap-2">
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
                            setOtp(newOtp.join(""));
                            if (val && e.target.nextElementSibling) {
                              (e.target.nextElementSibling as HTMLInputElement).focus();
                            }
                          }}
                          className="h-12 w-12 rounded-xl border border-border bg-background/50 backdrop-blur-sm text-center text-xl font-bold outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background"
                          autoFocus={i === 0}
                          required
                        />
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={otp.length < 4}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary to-orange-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </form>
                </div>
              )}

              {signupStep === "details" && (
                <div className="w-full text-center">
                  <p className="mb-6 text-sm font-semibold text-muted-foreground">
                    Complete your profile details.
                  </p>
                  <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-3">
                    <div className="mb-2 flex flex-col items-center">
                      <label htmlFor="photo-upload" className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:bg-muted/80 text-muted-foreground hover:text-foreground">
                        {photo ? (
                          <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center">
                            <User size={24} />
                            <span className="mt-1 text-[10px] font-semibold">Add Photo</span>
                          </div>
                        )}
                        <input 
                          id="photo-upload" type="file" accept="image/*" className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setPhoto(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    <input
                      type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full rounded-xl border border-border bg-background/50 backdrop-blur-sm px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background"
                      autoFocus required
                    />

                    <input
                      type="text" value={skill}
                      placeholder="Skill (e.g. Plumber)"
                      className="w-full rounded-xl border border-border bg-background/50 backdrop-blur-sm px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background"
                      required
                      onChange={(e) => {
                        const val = e.target.value;
                        setSkill(val);
                        // Auto-detect workerType: 0 = Fixed (Maid, Cook, Helper), 1 = Mobile (Plumber, Electrician, etc.)
                        const fixedSkills = ["maid", "cook", "helper", "servant", "cleaner"];
                        const isFixed = fixedSkills.some(s => val.toLowerCase().includes(s));
                        setWorkerType(isFixed ? 0 : 1);
                      }}
                    />
                    <div className="relative group">
                      <input
                        type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                        placeholder="Location (Auto-detecting...)"
                        className="w-full rounded-xl border border-border bg-background/50 backdrop-blur-sm px-4 py-3.5 pr-12 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isDetectingLocation}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                        title="Detect Current Location"
                      >
                        {isDetectingLocation ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!name.trim() || !skill.trim() || !location.trim()}
                      className={`mt-4 w-full rounded-xl bg-gradient-to-r ${workerType === 1 ? 'from-primary to-blue-600 shadow-primary/25' : 'from-accent to-indigo-600 shadow-accent/25'} py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50`}
                    >
                      Finish Sign Up
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================================== */}
        {/*           TOGGLE BTM CARD            */}
        {/* ==================================== */}
        <div className="glass p-5 text-center text-sm rounded-2xl animate-fade-up">
          {authMode === "login" ? (
            <p className="text-foreground">
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setSignupStep("role");
                  setPhone(""); setPassword("");
                }}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-foreground">
              Already have an account?{" "}
              <button
                onClick={() => {
                  setAuthMode("login");
                  setLoginPhone(""); setLoginPassword(""); setLoginError("");
                }}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Log in
              </button>
            </p>
          )}
        </div>
        
        {/* Navigation internal to Signup */}
        {authMode === "signup" && signupStep !== "role" && (
          <div className="flex justify-center text-sm">
            <button
               onClick={() => { setSignupStep("role"); setPassword(""); setPhone(""); }}
               className="font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
               Choose a different role
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginPage;

