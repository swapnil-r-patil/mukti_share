import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, QrCode, FileText, UserCircle, History, PlusCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const WORKER_NAV = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/qr", label: "QR Code", icon: QrCode },
  { path: "/report", label: "Report", icon: FileText },
  { path: "/profile", label: "Profile", icon: UserCircle },
];

const CUSTOMER_NAV = [
  { path: "/customer", label: "Home", icon: LayoutDashboard },
  { path: "/verify", label: "Scanner", icon: QrCode },
  { path: "/activity", label: "Registry", icon: History },
  { path: "/profile", label: "Identity", icon: UserCircle },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;

  const navItems = user.role === "worker" ? WORKER_NAV : CUSTOMER_NAV;

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 px-6 md:hidden pb-safe print:hidden">
      <nav className="mx-auto flex h-20 max-w-lg items-center justify-around rounded-[2.5rem] bg-card/80 border border-border px-4 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === "/verify" && location.pathname.startsWith("/verify") && !location.pathname.includes("request"));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 px-3 py-2 transition-all duration-500 ease-out active:scale-90",
                isActive
                  ? "text-orange-500 scale-110"
                  : "text-slate-500 hover:text-white"
              )}
            >
              <div className={cn(
                "flex items-center justify-center rounded-2xl p-2.5 transition-all duration-500",
                isActive ? "bg-orange-500/10 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)] border border-orange-500/20" : "bg-transparent border border-transparent"
              )}>
                <item.icon size={24} strokeWidth={isActive ? 3 : 2} className={isActive ? "drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" : ""} />
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-500 italic",
                isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-2 h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,1)] animate-in fade-in zoom-in duration-500" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
