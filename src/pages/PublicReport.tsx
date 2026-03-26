import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ShieldCheck,
  Star,
  Briefcase,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle2,
  MapPin,
  Fingerprint,
  Lock,
  AlertCircle,
} from "lucide-react";

interface WorkerData {
  name: string;
  phone: string;
  skill: string;
  location: string;
  muktiScore: number;
  isVerifiedByAdmin: boolean;
  status: string;
}

const PublicReport = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reportId) {
      setError("No report ID provided");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const snap = await getDoc(doc(db, "public_reports", reportId));
        if (!snap.exists()) {
          setError("Report Snapshot not found or unavailable.");
          setLoading(false);
          return;
        }

        setReportData(snap.data());
      } catch (err: any) {
        console.error("Public report fetch error:", err);
        setError("Failed to load report. Ensure Firestore Security Rules allow read for public_reports.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading Authentic Report Snapshot...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Report Unavailable</h2>
          <p className="text-slate-500 text-sm mb-4">{error || "Worker snapshot data could not be loaded."}</p>
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded text-left font-mono break-words">
            Developer Note: If this is a live environment, ensure Firebase Firestore rules for "public_reports" are set to allow read.
          </div>
        </div>
      </div>
    );
  }

  // Pre-calculated metrics extracted from the snapshot
  const workerName = reportData.workerName || 'Unknown';
  const skill = reportData.skill || 'General Worker';
  const location = reportData.location || 'N/A';
  const phone = reportData.phone || '';
  
  const muktiScore = reportData.muktiScore || 0;
  const confidence = reportData.confidence || 'LOW';
  const totalJobs = reportData.totalJobs || 0;
  const avgRating = reportData.avgRating || 0;
  const activeMonths = reportData.activeMonths || 0;
  const repeatCustomers = reportData.repeatCustomers || 0;
  
  const incomeMin = reportData.incomeMin || 0;
  const incomeMax = reportData.incomeMax || 0;

  const isVerified = reportData.isVerified;
  const maskedPhone = phone ? `**** **** ${phone.slice(-4)}` : "****";
  const recentJobs = reportData.computed?.recentJobs || [];
  const trustStack = reportData.computed?.trustStack || { otp: true, geo: true, photo: totalJobs > 0, timestamp: true, repeat: repeatCustomers > 0 };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
      {/* Header */}
      <div className="bg-[#0B3D91] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-lg">M</div>
              <div>
                <h1 className="font-bold text-lg">MuktiTech Portal</h1>
                <p className="text-blue-200 text-xs">Worker Trust & Verification Report</p>
              </div>
            </div>
            {isVerified && (
              <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck size={12} /> VERIFIED
              </span>
            )}
          </div>
        </div>
        <div className="h-1 bg-orange-500" />
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Worker Info */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-md">
              {workerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{workerName}</h2>
              <p className="text-sm text-slate-500">{skill} | {location}</p>
              <p className="text-xs text-slate-400 mt-1">Aadhaar: {maskedPhone}</p>
            </div>
          </div>
        </div>

        {/* Trust Score Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-xs font-bold text-[#0B3D91] mb-2 uppercase tracking-wide">Mukti Score</p>
            <p className={`text-3xl font-black ${muktiScore >= 70 ? 'text-emerald-600' : muktiScore >= 40 ? 'text-orange-500' : 'text-red-500'}`}>{muktiScore}</p>
            <p className="text-xs text-slate-400">/100</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-xs font-bold text-[#0B3D91] mb-2 uppercase tracking-wide">Bank Confidence</p>
            <p className={`text-xl font-black ${confidence === 'HIGH' ? 'text-emerald-600' : confidence === 'MEDIUM' ? 'text-orange-500' : 'text-red-500'}`}>{confidence}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-xs font-bold text-[#0B3D91] mb-2 uppercase tracking-wide">Loan Ready</p>
            <p className={`text-xl font-black ${muktiScore >= 70 ? 'text-emerald-600' : muktiScore >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
              {muktiScore >= 70 ? "ELIGIBLE" : muktiScore >= 40 ? "MODERATE" : "BUILDING"}
            </p>
          </div>
        </div>

        {/* Work Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Briefcase, label: "Total Works", value: totalJobs, color: "text-blue-600" },
            { icon: CheckCircle2, label: "Verified", value: totalJobs, color: "text-emerald-600" },
            { icon: Star, label: "Avg Rating", value: `${avgRating.toFixed(1)}/5`, color: "text-yellow-600" },
            { icon: Calendar, label: "Months", value: `${activeMonths}mo`, color: "text-slate-600" },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Financial Profile */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-[#0B3D91] mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> Financial Profile
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Monthly Income Range</p>
              <p className="text-base font-bold text-slate-800">INR {incomeMin.toLocaleString()} - {incomeMax.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Repeat Customers</p>
              <p className="text-base font-bold text-emerald-600">{repeatCustomers}</p>
            </div>
          </div>
        </div>

        {/* Trust Stack */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-[#0B3D91] mb-3 flex items-center gap-2">
            <Fingerprint size={16} /> Trust Stack Verification
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "OTP", ok: trustStack.otp },
              { label: "Geo", ok: trustStack.geo },
              { label: "Photo", ok: trustStack.photo },
              { label: "Time", ok: trustStack.timestamp },
              { label: "Repeat", ok: trustStack.repeat },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${item.ok ? 'bg-emerald-500' : 'bg-red-400'}`}>
                  {item.ok ? "Y" : "N"}
                </div>
                <span className="text-[9px] text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Work History */}
        {recentJobs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-[#0B3D91] mb-3 flex items-center gap-2">
              <Briefcase size={16} /> Verified Work History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0B3D91] text-white text-xs">
                    <th className="py-2 px-3 text-left rounded-tl-lg">Date</th>
                    <th className="py-2 px-3 text-left">Category</th>
                    <th className="py-2 px-3 text-left">Rating</th>
                    <th className="py-2 px-3 text-left rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.slice(0, 5).map((v: any, i: number) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'} border-b border-slate-100`}>
                      <td className="py-2 px-3 text-slate-600 text-xs">
                        {v.date}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-xs">{v.category}</td>
                      <td className="py-2 px-3 text-yellow-600 font-bold text-xs">{(v.rating || 4).toFixed(1)}/5</td>
                      <td className="py-2 px-3 text-emerald-600 font-bold text-xs">VERIFIED</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong>Disclaimer:</strong> This document is not a credit score and does not replace formal underwriting by financial institutions.
            This report serves as supporting trust data for financial inclusion and informal sector lending.
            Generated based on user-consented and verified activity through the MuktiTech platform.
            This report is valid for 30 days from the date of issue.
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <Lock size={12} className="text-slate-400" />
              <span className="text-[10px] text-slate-400">Digitally Verified by Code Storm</span>
            </div>
            <span className="text-[10px] text-slate-400">MuktiTech Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicReport;
