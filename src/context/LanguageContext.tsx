import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "hi" | "mr";

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

const translations: Translations = {
  welcome: { en: "Welcome back", hi: "आपका स्वागत है", mr: "तुमचे स्वागत आहे" },
  muktiscore: { en: "Mukti Score", hi: "मुक्ति स्कोर", mr: "मुक्ती स्कोर" },
  generateqr: { en: "Generate QR Code", hi: "QR कोड बनाएं", mr: "QR कोड व्युत्पन्न करा" },
  totaljobs: { en: "Total Jobs", hi: "कुल कार्य", mr: "एकूण कामे" },
  avgrating: { en: "Avg Rating", hi: "औसत रेटिंग", mr: "सरासरी रेटिंग" },
  repeatclients: { en: "Repeat Clients", hi: "पुराने ग्राहक", mr: "वारंवार येणारे ग्राहक" },
  lastactive: { en: "Last Active", hi: "अंतिम सक्रिय", mr: "शेवटचे सक्रिय" },
  verifyWorker: { en: "Verify Worker", hi: "वर्कर सत्यापित करें", mr: "कामगार तपासा" },
  submitVerification: { en: "Submit Verification", hi: "सत्यापन जमा करें", mr: "पडताळणी सबमिट करा" },
  admin_dashboard: { en: "Admin Dashboard", hi: "एडमिन डैशबोर्ड", mr: "अ‍ॅडमिन डॅशबोर्ड" },
  admin_sidebar_home: { en: "Overview", hi: "अवलोकन", mr: "आढावा" },
  admin_sidebar_workers: { en: "Workers", hi: "श्रमिक", mr: "कामगार" },
  admin_sidebar_customers: { en: "Customers", hi: "ग्राहक", mr: "ग्राहक" },
  admin_sidebar_reviews: { en: "Reviews", hi: "समीक्षा", mr: "समीक्षा" },
  admin_sidebar_fraud: { en: "Fraud Alerts", hi: "धोखाधड़ी अलर्ट", mr: "फसवणूक अलर्ट" },
  admin_sidebar_settings: { en: "Settings", hi: "सेटिंग्स", mr: "सेटिंग्ज" },
  admin_sidebar_analytics: { en: "Analytics", hi: "एनालिटिक्स", mr: "विश्लेषण" },
  admin_sidebar_financials: { en: "Financials", hi: "वित्तीय", mr: "आर्थिक" },
  admin_sidebar_ml: { en: "ML Center", hi: "ML केंद्र", mr: "ML केंद्र" },
  admin_sidebar_nlp: { en: "NLP Insights", hi: "NLP अंतर्दृष्टि", mr: "NLP अंतर्दृष्टी" },
  total_workers: { en: "Total Workers", hi: "कुल श्रमिक", mr: "एकूण कामगार" },
  total_customers: { en: "Total Customers", hi: "कुल ग्राहक", mr: "एकूण ग्राहक" },
  active_users: { en: "Active Users", hi: "सक्रिय उपयोगकर्ता", mr: "सक्रिय वापरकर्ते" },
  fraud_alerts: { en: "Fraud Alerts", hi: "धोखाधड़ी अलर्ट", mr: "फसवणूक अलर्ट" },
  system_overview: { en: "System Overview", hi: "सिस्टम अवलोकन", mr: "सिस्टम आढावा" },
  loan_eligibility: { en: "Loan Eligibility", hi: "ऋण पात्रता", mr: "कर्ज पात्रता" },
  estimated_income: { en: "Est. Income", hi: "अनुमानित आय", mr: "अंदाजित उत्पन्न" },
  // New feature translations
  pdf_report: { en: "PDF Report", hi: "PDF रिपोर्ट", mr: "PDF अहवाल" },
  whatsapp_share: { en: "Share on WhatsApp", hi: "WhatsApp पर शेयर करें", mr: "WhatsApp वर शेअर करा" },
  gov_schemes: { en: "Government Schemes", hi: "सरकारी योजनाएँ", mr: "सरकारी योजना" },
  job_map: { en: "Job Map", hi: "नौकरी का नक्शा", mr: "नोकरी नकाशा" },
  leaderboard: { en: "Leaderboard", hi: "लीडरबोर्ड", mr: "लीडरबोर्ड" },
  impact: { en: "Impact", hi: "प्रभाव", mr: "प्रभाव" },
  notifications: { en: "Notifications", hi: "सूचनाएँ", mr: "सूचना" },
  credit_report: { en: "Credit Report", hi: "क्रेडिट रिपोर्ट", mr: "क्रेडिट अहवाल" },
  download_report: { en: "Download Report", hi: "रिपोर्ट डाउनलोड करें", mr: "अहवाल डाउनलोड करा" },
  skill_demand: { en: "Skill Demand", hi: "कौशल मांग", mr: "कौशल्य मागणी" },
  trending_skills: { en: "Trending Skills", hi: "ट्रेंडिंग कौशल", mr: "ट्रेंडिंग कौशल्ये" },
  schemes_available: { en: "Schemes Available", hi: "योजनाएँ उपलब्ध", mr: "योजना उपलब्ध" },
  verified_workers: { en: "Verified Workers", hi: "सत्यापित श्रमिक", mr: "सत्यापित कामगार" },
  identity_verified: { en: "Identity Verified", hi: "पहचान सत्यापित", mr: "ओळख सत्यापित" },
  under_review: { en: "Under Review", hi: "समीक्षाधीन", mr: "समीक्षेत" },
  not_verified: { en: "Not Verified", hi: "सत्यापित नहीं", mr: "सत्यापित नाही" },
  confidence_score: { en: "Confidence Score", hi: "विश्वास स्कोर", mr: "विश्वास स्कोर" },
  financial_profile: { en: "Financial Profile", hi: "वित्तीय प्रोफ़ाइल", mr: "आर्थिक प्रोफाइल" },
  safe_emi: { en: "Safe EMI", hi: "सुरक्षित EMI", mr: "सुरक्षित EMI" },
  per_job: { en: "Per Job", hi: "प्रति कार्य", mr: "प्रत्येक कामासाठी" },
  monthly_income: { en: "Monthly Income", hi: "मासिक आय", mr: "मासिक उत्पन्न" },
  work_history: { en: "Work History", hi: "कार्य इतिहास", mr: "कामाचा इतिहास" },
  apply_now: { en: "Apply Now", hi: "अभी आवेदन करें", mr: "आता अर्ज करा" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string) => {
    return translations[key.toLowerCase()]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
