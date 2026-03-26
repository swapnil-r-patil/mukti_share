import { Sun, Moon, LogOut, LayoutDashboard, QrCode, FileText, UserCircle, Languages, WifiOff, Bell, ShieldCheck, UserCheck, History, PlusCircle, Trophy, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/context/LanguageContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from "firebase/firestore";

const WORKER_NAV = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/qr", label: "QR Code", icon: QrCode },
  { path: "/report", label: "Report", icon: FileText },
  { path: "/profile", label: "Profile", icon: UserCircle },
];

const CUSTOMER_NAV = [
  { path: "/verify", label: "Home", icon: LayoutDashboard },
  { path: "/activity", label: "Activity", icon: History },
  { path: "/profile", label: "Profile", icon: UserCircle },
];

const AppHeader = () => {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const navItems = user?.role === "worker" ? WORKER_NAV : CUSTOMER_NAV;

  // Real-time notifications from Firebase
  useEffect(() => {
    if (!user) return;

    if (user.role === 'worker') {
      // Workers get notified about their verification status
      const q = query(
        collection(db, 'verification_requests'),
        where('workerId', '==', user.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.status === 'approved' ? 'verified' : data.status === 'rejected' ? 'rejected' : 'pending',
            title: data.status === 'approved' ? 'Identity Verified ✔' : data.status === 'rejected' ? 'Verification Rejected' : 'Request Under Review',
            message: data.status === 'approved' ? 'Your identity has been verified by admin.' : data.status === 'rejected' ? `Reason: ${data.rejectionReason || 'Contact admin for details'}` : 'Your verification request is being processed.',
            time: data.timestamp ? (data.timestamp as Timestamp).toDate().toLocaleDateString() : 'Recently',
            icon: data.status === 'approved' ? 'shield' : data.status === 'rejected' ? 'alert' : 'clock'
          };
        });
        setNotifications(notifs);
      });
      return () => unsub();
    } else if (user.role === 'admin') {
      // Admins get notified about new verification requests
      const q = query(
        collection(db, 'verification_requests'),
        where('status', '==', 'pending')
      );
      const unsub = onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'request',
            title: `New Request: ${data.workerName || 'Worker'}`,
            message: `${data.workerSkill || 'Worker'} from verification queue`,
            time: data.timestamp ? (data.timestamp as Timestamp).toDate().toLocaleDateString() : 'Just now',
            icon: 'plus'
          };
        });
        setNotifications(notifs);
      });
      return () => unsub();
    }
  }, [user?.id, user?.role]);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 print:hidden">
      <div className="relative container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        
        {/* Left: Logo */}
        <Link 
          to={user ? (user.role === 'customer' ? "/verify" : "/dashboard") : "/"}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 transition-opacity hover:opacity-80 active:scale-95 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/20">
            <span className="text-xl font-black italic">M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black italic leading-none text-white tracking-tighter uppercase">Mukti</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 leading-none mt-1 pl-0.5">Portal</span>
          </div>
          {!isOnline && (
            <div className="ml-3 flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[8px] font-black text-red-500 border border-red-500/20 animate-pulse uppercase tracking-widest">
              <WifiOff size={10} />
              Offline
            </div>
          )}
        </Link>
        
        {/* Center: Desktop Navigation */}
        {user && (
          <nav className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-2xl border border-white/5 bg-black/40 p-1.5 backdrop-blur-2xl">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === "/verify" && location.pathname.startsWith("/verify") && !location.pathname.includes("request"));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    isActive ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20 italic" : "text-slate-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon size={16} strokeWidth={isActive ? 3 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        
        {/* Right: Actions */}
        <div className="flex items-center gap-3 md:gap-4 font-black">
          {user && (
            <div className="hidden items-center gap-3 sm:flex">
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-white italic tracking-tight">{user.name}</span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{user.role}</span>
              </div>
              <div className="h-9 w-9 overflow-hidden rounded-xl border border-orange-500/30 bg-slate-900 shadow-lg shadow-orange-500/10">
                {user.photo ? (
                  <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-orange-500/10 text-orange-500 font-black text-sm italic uppercase">
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="h-6 w-px bg-white/5 hidden sm:block mx-1"></div>
          
          <button
            onClick={() => setLanguage(language === "en" ? "hi" : language === "hi" ? "mr" : "en")}
            className="h-9 min-w-[3rem] px-2 rounded-xl bg-white/5 border border-white/10 text-white transition-all hover:bg-white/10 text-[10px] uppercase tracking-widest font-black"
          >
            {language}
          </button>
          
          <button
            onClick={toggle}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all hover:text-white hover:bg-white/10 active:scale-95"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all active:scale-95 relative border ${showNotifications ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 border-2 border-slate-950 text-[8px] font-black text-white flex items-center justify-center">{notifications.length > 9 ? '9+' : notifications.length}</span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-80 rounded-[2.5rem] bg-slate-950 border border-white/10 shadow-3xl p-6 animate-in fade-in slide-in-from-top-4 duration-300 z-[100] backdrop-blur-2xl">
                   <div className="flex items-center justify-between mb-6">
                      <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-white italic">Notifications</h4>
                      {notifications.length > 0 && (
                        <span className="text-[8px] font-black text-orange-500 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/10">{notifications.length.toString().padStart(2, '0')} NEW</span>
                      )}
                   </div>
                   <div className="space-y-4 max-h-72 overflow-y-auto">
                      {notifications.length > 0 ? notifications.slice(0, 5).map(n => (
                        <div key={n.id} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 transition-all hover:border-orange-500/20 group">
                           <div className={`p-2.5 rounded-xl h-fit group-hover:scale-110 transition-transform ${n.type === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : n.type === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                             {n.type === 'verified' ? <ShieldCheck size={16} /> : n.type === 'rejected' ? <Bell size={16} /> : <PlusCircle size={16} />}
                           </div>
                           <div className="min-w-0">
                              <div className="font-black text-sm text-white italic truncate uppercase tracking-tighter">{n.title}</div>
                              <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase leading-relaxed">{n.message}</div>
                              <div className="text-[8px] font-bold text-slate-700 mt-1 uppercase tracking-widest">{n.time}</div>
                           </div>
                        </div>
                      )) : (
                        <div className="py-12 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
                           <Bell size={32} className="mx-auto text-slate-800 mb-4 opacity-30" />
                           <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] italic">No active notifications</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          )}

          {user && (
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 transition-all hover:bg-red-500 hover:text-white active:scale-95 shadow-lg shadow-red-500/5 group"
              aria-label="Logout"
            >
              <LogOut size={18} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
