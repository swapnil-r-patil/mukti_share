import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  LogOut, 
  Search, 
  Globe, 
  Menu, 
  X,
  TrendingUp,
  Wallet,
  ShieldCheck,
  BrainCircuit,
  Bell,
  Sun,
  Moon
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const API_BASE_URL = "http://localhost:5000";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  React.useEffect(() => {
    if (!user || user.role !== "admin") return;
    
    // Switch from backend polling to real-time Firestore listeners (Self-Healing)
    const qReqs = query(collection(db, "verification_requests"), where("status", "==", "pending"));
    const qUsers = query(collection(db, "users"), where("status", "==", "pending"));

    let reqsCount = 0;
    let usersCount = 0;
    const pendingUsersIds: string[] = [];

    const unsubReqs = onSnapshot(qReqs, (snap) => {
      reqsCount = snap.size;
      const ids = snap.docs.map(d => d.data().workerId);
      updateTotal(reqsCount, usersCount, ids);
    });

    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const docs = snap.docs;
      usersCount = docs.length;
      updateTotal(reqsCount, usersCount, []); // We'll deduplicate in the helper
    });

    const updateTotal = (r: number, u: number, activeWorkerIds: string[]) => {
      // Simple approximation: use the larger of the two or a merged count if we had all IDs
      // For the badge, we just want to ensure it's not zero if someone is pending
      setPendingRequests(Math.max(r, u)); 
    };

    return () => {
      unsubReqs();
      unsubUsers();
    };
  }, [user]);

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: t("admin_sidebar_home"), path: "/admin/dashboard" },
    { icon: <Users size={20} />, label: t("admin_sidebar_workers"), path: "/admin/workers" },
    { icon: <Users size={20} />, label: t("admin_sidebar_customers"), path: "/admin/customers" },
    { icon: <AlertTriangle size={20} />, label: t("admin_sidebar_fraud"), path: "/admin/fraud" },
    { icon: <ShieldCheck size={20} />, label: "Verification Requests", path: "/admin/requests" },
    { icon: <MessageSquare size={20} />, label: t("admin_sidebar_reviews"), path: "/admin/reviews" },
    { icon: <TrendingUp size={20} />, label: t("admin_sidebar_analytics"), path: "/admin/analytics" },
    { icon: <Wallet size={20} />, label: t("admin_sidebar_financials"), path: "/admin/financials" },
    { icon: <BrainCircuit size={20} />, label: t("admin_sidebar_ml"), path: "/admin/ml" },
    { icon: <Settings size={20} />, label: t("admin_sidebar_settings"), path: "/admin/settings" },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      {/* Sidebar - Responsive: Hidden on mobile (overlay when open), fixed on desktop */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-border bg-card transition-all duration-300 overflow-hidden",
          isSidebarOpen ? "w-64 translate-x-0" : "-translate-x-full w-64 lg:translate-x-0 lg:w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
            <ShieldCheck className="text-white" size={24} />
          </div>
          {isSidebarOpen && (
            <span className="font-black text-foreground tracking-tighter text-xl italic uppercase">MUKTI CTRL</span>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group active:scale-95 ${
                location.pathname === item.path 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 italic' 
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <span className={`${location.pathname === item.path ? 'text-white' : 'text-muted-foreground group-hover:text-orange-500 transition-colors'}`}>
                {item.icon}
              </span>
              {isSidebarOpen && <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-border space-y-6">
          {/* Admin Profile - Downside */}
          {isSidebarOpen && (
            <div className="flex items-center gap-4 px-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center font-black text-white shadow-lg italic shadow-orange-600/20">
                {user?.name?.[0]}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-foreground uppercase tracking-wider truncate italic">{user?.name}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Super Admin</span>
              </div>
            </div>
          )}

          {/* Language Selector - Down One */}
          {isSidebarOpen && (
            <div className="flex items-center gap-1.5 bg-secondary/50 p-1 rounded-xl border border-border italic">
              {(['en', 'hi', 'mr'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    language === lang 
                    ? 'bg-orange-600 text-white shadow-md' 
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}

          <button 
            onClick={logout}
            className="flex items-center gap-4 px-4 py-3 w-full rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all group active:scale-95 italic font-black"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarOpen && <span className="text-sm uppercase tracking-wider">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
      )}>
        {/* Overlay for mobile when sidebar is open */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        {/* Top Navbar */}
        <header className="h-16 sm:h-20 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 z-40">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground lg:hidden transition-all active:scale-95"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hidden lg:flex transition-all active:scale-95 shadow-sm"
            >
              <Menu size={20} />
            </button>
            <div className="relative group hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-orange-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search..."
                className="bg-secondary border border-border rounded-full pl-12 pr-6 py-2 text-sm outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all w-48 sm:w-80 text-foreground font-bold italic shadow-inner"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Notification Bell with Above Functionality */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2.5 rounded-xl transition-all group relative active:scale-95 ${showNotifications ? 'bg-orange-600 text-white shadow-lg' : 'bg-secondary text-muted-foreground border border-border hover:text-foreground hover:bg-secondary/80'}`}
              >
                <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                {pendingRequests > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-background animate-pulse shadow-lg">
                    {pendingRequests}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-4 w-80 rounded-[2.5rem] bg-card border border-border shadow-3xl p-6 animate-in fade-in slide-in-from-top-4 duration-300 z-50 backdrop-blur-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-foreground italic">Registry Protocol</h4>
                    <span className="text-[8px] font-black text-orange-500 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/10 uppercase">
                      {pendingRequests} Pending
                    </span>
                  </div>
                  <div className="space-y-4">
                    {pendingRequests > 0 ? (
                      <div 
                        onClick={() => {
                          setShowNotifications(false);
                          (window as any).location.href = "/admin/requests";
                        }}
                        className="flex gap-4 p-4 rounded-2xl bg-secondary border border-border transition-all hover:border-orange-500/20 group cursor-pointer"
                      >
                        <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 h-fit group-hover:scale-110 transition-transform">
                          <ShieldCheck size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-sm text-foreground italic truncate uppercase tracking-tighter">Verification Needed</div>
                          <div className="text-[10px] font-bold text-muted-foreground mt-1 uppercase leading-relaxed opacity-70">
                            {pendingRequests} workers awaiting registry approval.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-secondary/20 rounded-3xl border border-dashed border-border">
                        <Bell size={32} className="mx-auto text-slate-400 mb-4 opacity-30" />
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic">No active system signals</p>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => {
                      setShowNotifications(false);
                      (window as any).location.href = "/admin/requests";
                    }}
                    className="w-full mt-6 py-3 text-[9px] font-black uppercase text-slate-500 hover:text-orange-500 transition-all tracking-[0.4em] italic border-t border-border pt-4"
                  >
                    View Registry Ledger
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={toggle}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-secondary border border-border text-slate-400 transition-all hover:text-foreground hover:bg-secondary/80 active:scale-95"
                title={isDark ? "Switch to Bright Mode" : "Switch to Deep Galaxy"}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={logout}
                className="hidden sm:flex h-9 px-4 items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 transition-all hover:bg-red-500 hover:text-white active:scale-95 text-[10px] font-black uppercase tracking-widest"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
