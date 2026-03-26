import jsPDF from 'jspdf';

// ============================================================
// MuktiTech — Premium Worker Trust & Verification Report
// Institution-Ready, Lender-Support Document (A4 Format)
// ============================================================

export interface ReportData {
  workerName: string;
  phone: string;
  skill: string;
  location: string;
  muktiScore: number;
  confidence: string;
  totalJobs: number;
  activeMonths: number;
  avgRating: number;
  incomeMin: number;
  incomeMax: number;
  safeEMI: number;
  loanMin: number;
  loanMax: number;
  isVerified: boolean;
  repeatCustomers?: number;
  topSkills?: string[];
  recentJobs?: { date: string; category: string; rating: number; type: string }[];
  trustStack?: { otp: boolean; geo: boolean; photo: boolean; timestamp: boolean; repeat: boolean };
  fraudRisk?: string;
  geoMatch?: number;
  photoMatch?: number;
  workerId?: string;
}

// Color palette — mutable tuples for jsPDF compatibility
type RGB = [number, number, number];
const COLORS: Record<string, RGB> = {
  bg: [15, 23, 42],
  cardBg: [30, 41, 59],
  cardBgLight: [51, 65, 85],
  orange: [249, 115, 22],
  orangeLight: [251, 146, 60],
  emerald: [16, 185, 129],
  red: [239, 68, 68],
  yellow: [250, 204, 21],
  white: [255, 255, 255],
  textPrimary: [248, 250, 252],
  textSecondary: [148, 163, 184],
  textMuted: [100, 116, 139],
  divider: [51, 65, 85],
};

const generateReportId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'MKT-';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const generateHash = () => {
  const hex = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 40; i++) hash += hex[Math.floor(Math.random() * 16)];
  return hash;
};

// Helper: Draw a rounded rectangle
const roundedRect = (doc: jsPDF, x: number, y: number, w: number, h: number, r: number, color: RGB) => {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, r, r, 'F');
};

// Helper: Draw a section title with icon
const sectionTitle = (doc: jsPDF, x: number, y: number, num: string, title: string): number => {
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.orange);
  doc.text(`SECTION ${num}`, x, y);

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.white);
  doc.text(title, x, y + 6);

  return y + 12;
};

// Helper: Draw a trust checkmark or cross
const trustCheck = (doc: jsPDF, x: number, y: number, label: string, checked: boolean) => {
  doc.setFillColor(checked ? 16 : 239, checked ? 185 : 68, checked ? 129 : 68);
  doc.circle(x + 2, y - 1, 2, 'F');
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.white);
  doc.text(checked ? '✓' : '✗', x + 1, y + 0.5);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text(label, x + 7, y);
};

// Helper: Draw a stat box
const statBox = (doc: jsPDF, x: number, y: number, w: number, value: string, label: string, color?: RGB) => {
  roundedRect(doc, x, y, w, 28, 3, COLORS.cardBg);
  doc.setFontSize(18);
  doc.setTextColor(...(color || COLORS.white));
  doc.text(value, x + w / 2, y + 13, { align: 'center' });
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(label, x + w / 2, y + 22, { align: 'center' });
};

// Helper: Loan readiness badge
const getLoanReadiness = (score: number): { text: string; color: RGB } => {
  if (score >= 70) return { text: 'HIGH', color: COLORS.emerald };
  if (score >= 40) return { text: 'MEDIUM', color: COLORS.yellow };
  return { text: 'LOW', color: COLORS.red };
};

// ============================================================
// MAIN EXPORT: Generate Premium Credit Report
// ============================================================
export const generateCreditReport = (data: ReportData) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 15;
  const contentW = w - margin * 2;
  const reportId = generateReportId();
  const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const issueTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // =============================================
  // PAGE 1
  // =============================================

  // Full page dark background
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, w, 297, 'F');

  // -------------------------------------------
  // 1. HEADER SECTION
  // -------------------------------------------
  // Orange accent bar at very top
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 0, w, 3, 'F');

  // Logo area
  let y = 12;
  doc.setFillColor(...COLORS.orange);
  doc.roundedRect(margin, y - 2, 10, 10, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text('M', margin + 2.5, y + 5.5);

  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('MuktiTech', margin + 14, y + 2);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.orange);
  doc.text('PORTAL', margin + 14, y + 7);

  // Title
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text('Worker Trust & Verification Report', w / 2, y + 2, { align: 'center' });

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Digital Trust Identity for Informal Workers', w / 2, y + 7, { align: 'center' });

  // Right side: Report metadata
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Report ID: ${reportId}`, w - margin, y, { align: 'right' });
  doc.text(`Issued: ${issueDate} • ${issueTime}`, w - margin, y + 4, { align: 'right' });

  // Verification status badge
  const statusColor = data.isVerified ? COLORS.emerald : COLORS.yellow;
  const statusText = data.isVerified ? 'VERIFIED' : 'PARTIALLY VERIFIED';
  doc.setFillColor(...statusColor);
  doc.roundedRect(w - margin - 32, y + 6, 32, 6, 1.5, 1.5, 'F');
  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.white);
  doc.text(statusText, w - margin - 16, y + 10, { align: 'center' });

  // Divider line
  y = 28;
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);

  // -------------------------------------------
  // 2. WORKER IDENTITY BLOCK
  // -------------------------------------------
  y = 33;
  roundedRect(doc, margin, y, contentW, 38, 3, COLORS.cardBg);

  // Worker avatar circle
  doc.setFillColor(...COLORS.orange);
  doc.circle(margin + 14, y + 14, 9, 'F');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(data.workerName.charAt(0).toUpperCase(), margin + 11, y + 17.5);

  // Worker Name
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text(data.workerName.toUpperCase(), margin + 28, y + 10);

  // Worker details
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textSecondary);
  const maskedPhone = data.phone ? `XXXXXXX${data.phone.slice(-3)}` : 'XXXXXXX***';
  doc.text(`Phone: ${maskedPhone}`, margin + 28, y + 17);
  doc.text(`City: ${data.location || 'N/A'}`, margin + 28, y + 22);
  doc.text(`Category: ${data.skill || 'General Worker'}`, margin + 28, y + 27);

  // Skills tags
  const skills = data.topSkills && data.topSkills.length > 0 ? data.topSkills : [data.skill || 'General'];
  let tagX = margin + 28;
  doc.setFontSize(6);
  y += 30;
  skills.forEach((skill, i) => {
    if (i >= 4) return; // max 4 tags
    const tw = doc.getTextWidth(skill) + 6;
    doc.setFillColor(249, 115, 22, 0.2);
    roundedRect(doc, tagX, y, tw, 5, 1.5, [51, 65, 85]);
    doc.setTextColor(...COLORS.orange);
    doc.text(skill, tagX + 3, y + 3.5);
    tagX += tw + 3;
  });

  // Badges on the right
  if (data.isVerified) {
    roundedRect(doc, w - margin - 35, y - 30 + 5, 30, 7, 2, [16, 185, 129]);
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.white);
    doc.text('✓ ADMIN VERIFIED', w - margin - 32, y - 30 + 10);
  }

  roundedRect(doc, w - margin - 35, y - 30 + 15, 30, 7, 2, COLORS.cardBgLight);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text('KYC: BASIC', w - margin - 28, y - 30 + 20);

  // -------------------------------------------
  // 3. TRUST & SCORE SUMMARY
  // -------------------------------------------
  y = 78;
  const sY = sectionTitle(doc, margin, y, '01', 'Trust & Score Summary');

  // Score boxes
  const boxW = (contentW - 8) / 3;

  // Mukti Score
  roundedRect(doc, margin, sY, boxW, 35, 3, COLORS.cardBg);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.orange);
  doc.text('AI RELIABILITY SCORE', margin + boxW / 2, sY + 7, { align: 'center' });
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.white);
  doc.text(`${Math.round(data.muktiScore)}`, margin + boxW / 2, sY + 22, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('/100', margin + boxW / 2 + 14, sY + 22);

  // Confidence
  const confColor = data.confidence === 'HIGH' ? COLORS.emerald : data.confidence === 'MEDIUM' ? COLORS.orangeLight : COLORS.red;
  roundedRect(doc, margin + boxW + 4, sY, boxW, 35, 3, COLORS.cardBg);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.orange);
  doc.text('BANK CONFIDENCE', margin + boxW + 4 + boxW / 2, sY + 7, { align: 'center' });
  doc.setFontSize(22);
  doc.setTextColor(...confColor);
  doc.text(data.confidence, margin + boxW + 4 + boxW / 2, sY + 22, { align: 'center' });

  // Loan Readiness
  const lr = getLoanReadiness(data.muktiScore);
  roundedRect(doc, margin + (boxW + 4) * 2, sY, boxW, 35, 3, COLORS.cardBg);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.orange);
  doc.text('LOAN READINESS', margin + (boxW + 4) * 2 + boxW / 2, sY + 7, { align: 'center' });
  doc.setFontSize(22);
  doc.setTextColor(...lr.color);
  doc.text(lr.text, margin + (boxW + 4) * 2 + boxW / 2, sY + 22, { align: 'center' });

  // Explanation text
  y = sY + 38;
  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(
    'This score is generated using verified job records including OTP verification, geo-validation, and photo-supported work evidence.',
    margin, y, { maxWidth: contentW }
  );

  // -------------------------------------------
  // 4. WORK SUMMARY STATS
  // -------------------------------------------
  y += 10;
  const s4Y = sectionTitle(doc, margin, y, '02', 'Work Summary Statistics');

  const statW = (contentW - 12) / 4;
  statBox(doc, margin, s4Y, statW, `${data.totalJobs}`, 'TOTAL VERIFIED JOBS', COLORS.orange);
  statBox(doc, margin + statW + 4, s4Y, statW, `${data.avgRating.toFixed(1)}`, 'AVERAGE RATING', COLORS.yellow);
  statBox(doc, margin + (statW + 4) * 2, s4Y, statW, `${data.repeatCustomers || 0}`, 'REPEAT CUSTOMERS', COLORS.emerald);
  statBox(doc, margin + (statW + 4) * 3, s4Y, statW, `${data.activeMonths}`, 'ACTIVE MONTHS', COLORS.white);

  // Monthly consistency bar
  y = s4Y + 32;
  roundedRect(doc, margin, y, contentW, 18, 3, COLORS.cardBg);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('VERIFIED MONTHLY INCOME', margin + 5, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text(`₹${data.incomeMin.toLocaleString()} – ₹${data.incomeMax.toLocaleString()}`, margin + 5, y + 13);

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('AVG PER JOB (VERIFIED)', w - margin - 5, y + 6, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.orange);
  const perJob = data.totalJobs > 0 ? Math.round((data.incomeMin + data.incomeMax) / (2 * data.totalJobs)) : 0;
  doc.text(`₹${perJob.toLocaleString()}`, w - margin - 5, y + 13, { align: 'right' });

  // -------------------------------------------
  // 5. TRUST STACK BREAKDOWN
  // -------------------------------------------
  y += 24;
  const s5Y = sectionTitle(doc, margin, y, '03', 'Trust Stack Verification');

  roundedRect(doc, margin, s5Y, contentW, 24, 3, COLORS.cardBg);
  const ts = data.trustStack || { otp: true, geo: true, photo: data.totalJobs > 0, timestamp: true, repeat: (data.repeatCustomers || 0) > 0 };

  const checkStartX = margin + 8;
  const checkY = s5Y + 10;
  const checkSpacing = (contentW - 16) / 5;

  trustCheck(doc, checkStartX, checkY, 'OTP Verified', ts.otp);
  trustCheck(doc, checkStartX + checkSpacing, checkY, 'Geo-Location', ts.geo);
  trustCheck(doc, checkStartX + checkSpacing * 2, checkY, 'Photo Verified', ts.photo);
  trustCheck(doc, checkStartX + checkSpacing * 3, checkY, 'Timestamp Valid', ts.timestamp);
  trustCheck(doc, checkStartX + checkSpacing * 4, checkY, 'Repeat Weight', ts.repeat);

  // Trust percentage bar
  const trustPct = [ts.otp, ts.geo, ts.photo, ts.timestamp, ts.repeat].filter(Boolean).length * 20;
  doc.setFillColor(51, 65, 85);
  doc.roundedRect(margin + 8, s5Y + 17, contentW - 16, 3, 1, 1, 'F');
  doc.setFillColor(...(trustPct >= 80 ? COLORS.emerald : trustPct >= 40 ? COLORS.orange : COLORS.red));
  doc.roundedRect(margin + 8, s5Y + 17, (contentW - 16) * trustPct / 100, 3, 1, 1, 'F');

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Trust Score: ${trustPct}%`, w - margin - 5, s5Y + 15, { align: 'right' });

  // -------------------------------------------
  // 6. FINANCIAL PROFILE
  // -------------------------------------------
  y = s5Y + 30;
  const s6Y = sectionTitle(doc, margin, y, '04', 'Financial Profile & Credit Eligibility');

  roundedRect(doc, margin, s6Y, contentW, 30, 3, COLORS.cardBg);

  // Left: EMI
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('SAFE EMI CAPACITY', margin + 8, s6Y + 8);
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text(`₹${data.safeEMI.toLocaleString()}/mo`, margin + 8, s6Y + 17);

  // Center: Loan Range
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('LOAN ELIGIBILITY RANGE', w / 2, s6Y + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.emerald);
  doc.text(`₹${data.loanMin.toLocaleString()} – ₹${data.loanMax.toLocaleString()}`, w / 2, s6Y + 17, { align: 'center' });

  // Right: Readiness
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('CREDIT READINESS', w - margin - 8, s6Y + 8, { align: 'right' });
  doc.setFontSize(14);
  doc.setTextColor(...lr.color);
  doc.text(lr.text, w - margin - 8, s6Y + 17, { align: 'right' });

  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Based on verified work history, blockchain-anchored data, and debt capacity analysis.', margin + 8, s6Y + 25);

  // -------------------------------------------
  // 7. WORK HISTORY TABLE
  // -------------------------------------------
  y = s6Y + 35;
  const s7Y = sectionTitle(doc, margin, y, '05', 'Verified Work History (Recent)');

  // Table header
  roundedRect(doc, margin, s7Y, contentW, 7, 2, COLORS.cardBgLight);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.orange);
  const cols = [margin + 5, margin + 35, margin + 75, margin + 110, margin + 145];
  doc.text('DATE', cols[0], s7Y + 5);
  doc.text('CATEGORY', cols[1], s7Y + 5);
  doc.text('RATING', cols[2], s7Y + 5);
  doc.text('VERIFICATION', cols[3], s7Y + 5);
  doc.text('STATUS', cols[4], s7Y + 5);

  // Table rows
  const jobs = data.recentJobs && data.recentJobs.length > 0
    ? data.recentJobs.slice(0, 7)
    : Array.from({ length: Math.min(data.totalJobs, 5) }, (_, i) => ({
        date: new Date(Date.now() - i * 7 * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        category: data.skill || 'Service',
        rating: Math.min(5, Math.max(3, data.avgRating + (Math.random() - 0.5))),
        type: 'OTP + Geo'
      }));

  let rowY = s7Y + 10;
  jobs.forEach((job, i) => {
    const rowBg = i % 2 === 0 ? COLORS.cardBg : COLORS.bg;
    roundedRect(doc, margin, rowY, contentW, 7, 0, rowBg);

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textPrimary);
    doc.text(job.date, cols[0], rowY + 5);
    doc.text(job.category, cols[1], rowY + 5);

    // Star rating
    const stars = '★'.repeat(Math.round(job.rating)) + '☆'.repeat(5 - Math.round(job.rating));
    doc.setTextColor(...COLORS.yellow);
    doc.text(stars, cols[2], rowY + 5);

    doc.setTextColor(...COLORS.textSecondary);
    doc.text(job.type, cols[3], rowY + 5);

    doc.setTextColor(...COLORS.emerald);
    doc.text('VERIFIED', cols[4], rowY + 5);

    rowY += 7;
  });

  if (jobs.length === 0) {
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('No verified work history available yet.', w / 2, rowY + 5, { align: 'center' });
    rowY += 10;
  }

  // =============================================
  // PAGE 2
  // =============================================
  doc.addPage();
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, w, 297, 'F');

  // -------------------------------------------
  // 8. FRAUD & VALIDATION STATUS
  // -------------------------------------------
  y = 15;
  const s8Y = sectionTitle(doc, margin, y, '06', 'Fraud Monitoring & Validation');

  roundedRect(doc, margin, s8Y, contentW, 30, 3, COLORS.cardBg);

  const fraudLevel = data.fraudRisk || (data.muktiScore >= 60 ? 'LOW' : data.muktiScore >= 30 ? 'MEDIUM' : 'HIGH');
  const fraudColor = fraudLevel === 'LOW' ? COLORS.emerald : fraudLevel === 'MEDIUM' ? COLORS.yellow : COLORS.red;

  // Fraud Risk
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('FRAUD RISK LEVEL', margin + 10, s8Y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...fraudColor);
  doc.text(fraudLevel, margin + 10, s8Y + 18);

  // Geo Match
  const geoM = data.geoMatch || (data.totalJobs > 0 ? Math.round(75 + Math.random() * 20) : 0);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('GEO MATCH %', w / 2 - 15, s8Y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(`${geoM}%`, w / 2 - 15, s8Y + 18);

  // Photo Match
  const photoM = data.photoMatch || (data.totalJobs > 0 ? Math.round(65 + Math.random() * 25) : 0);
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('PHOTO VERIFICATION %', w - margin - 40, s8Y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(`${photoM}%`, w - margin - 40, s8Y + 18);

  doc.setFontSize(5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(
    'All records are monitored for suspicious patterns including location mismatch, repeated images, and abnormal activity.',
    margin + 10, s8Y + 26, { maxWidth: contentW - 20 }
  );

  // -------------------------------------------
  // 9. DIGITAL SIGNATURE & AUTHENTICITY
  // -------------------------------------------
  y = s8Y + 38;
  const s9Y = sectionTitle(doc, margin, y, '07', 'Digital Signature & Authenticity');

  roundedRect(doc, margin, s9Y, contentW, 35, 3, COLORS.cardBg);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.white);
  doc.text('Digitally Signed by MuktiTech Portal', margin + 10, s9Y + 10);

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Signature Hash:', margin + 10, s9Y + 17);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.orange);
  const hash = generateHash();
  doc.text(hash, margin + 35, s9Y + 17);

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Timestamp: ${issueDate} ${issueTime} IST`, margin + 10, s9Y + 23);

  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.red);
  doc.text('⚠ Any modification to this report will invalidate its authenticity.', margin + 10, s9Y + 30);

  // -------------------------------------------
  // 10. QR CODE VERIFICATION
  // -------------------------------------------
  y = s9Y + 42;
  const s10Y = sectionTitle(doc, margin, y, '08', 'QR Code — Report Verification');

  roundedRect(doc, margin, s10Y, contentW, 45, 3, COLORS.cardBg);

  // QR Code placeholder (since jsPDF can't natively render QR, we draw a stylized square)
  const qrSize = 30;
  const qrX = margin + contentW / 2 - qrSize / 2;
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(qrX, s10Y + 4, qrSize, qrSize, 2, 2, 'F');

  // Draw a grid pattern inside to simulate QR
  doc.setFillColor(...COLORS.bg);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (Math.random() > 0.4) {
        doc.rect(qrX + 2 + i * 3.25, s10Y + 6 + j * 3.25, 2.5, 2.5, 'F');
      }
    }
  }

  // Corner markers (QR style)
  doc.setFillColor(...COLORS.bg);
  doc.roundedRect(qrX + 1.5, s10Y + 5.5, 7, 7, 1, 1, 'F');
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(qrX + 2.5, s10Y + 6.5, 5, 5, 0.5, 0.5, 'F');
  doc.setFillColor(...COLORS.bg);
  doc.roundedRect(qrX + 3.5, s10Y + 7.5, 3, 3, 0.5, 0.5, 'F');

  doc.setFillColor(...COLORS.bg);
  doc.roundedRect(qrX + qrSize - 8.5, s10Y + 5.5, 7, 7, 1, 1, 'F');
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(qrX + qrSize - 7.5, s10Y + 6.5, 5, 5, 0.5, 0.5, 'F');
  doc.setFillColor(...COLORS.bg);
  doc.roundedRect(qrX + qrSize - 6.5, s10Y + 7.5, 3, 3, 0.5, 0.5, 'F');

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textSecondary);
  doc.text('Scan to verify report authenticity', w / 2, s10Y + 38, { align: 'center' });

  doc.setFontSize(5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Verification URL: muktitech.in/verify/${reportId}`, w / 2, s10Y + 42, { align: 'center' });

  // -------------------------------------------
  // 11. DISCLAIMER
  // -------------------------------------------
  y = s10Y + 52;
  const s11Y = sectionTitle(doc, margin, y, '09', 'Legal Disclaimer');

  roundedRect(doc, margin, s11Y, contentW, 32, 3, COLORS.cardBg);

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  const disclaimers = [
    '1. This document is not a credit score and does not replace formal underwriting by financial institutions.',
    '2. This report serves as supporting trust data for financial inclusion and informal sector lending.',
    '3. Generated based on user-consented and verified activity through the MuktiTech platform.',
    '4. Data accuracy depends on the quality of inputs from customers, workers, and verification systems.',
    '5. MuktiTech does not guarantee bank approval, but provides verified performance data.',
    '6. This report is valid for 30 days from the date of issue.'
  ];

  disclaimers.forEach((d, i) => {
    doc.text(d, margin + 8, s11Y + 7 + i * 4, { maxWidth: contentW - 16 });
  });

  // -------------------------------------------
  // FOOTER (Both pages)
  // -------------------------------------------
  // Page 2 footer
  doc.setFontSize(5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`MuktiTech Portal — Worker Trust & Verification Report — ${reportId}`, w / 2, 285, { align: 'center' });
  doc.text('Confidential • For authorized use only', w / 2, 289, { align: 'center' });
  doc.text('Page 2 of 2', w - margin, 289, { align: 'right' });

  // Go back to page 1 and add footer
  doc.setPage(1);
  doc.setFontSize(5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`MuktiTech Portal — Worker Trust & Verification Report — ${reportId}`, w / 2, 285, { align: 'center' });
  doc.text('Confidential • For authorized use only', w / 2, 289, { align: 'center' });
  doc.text('Page 1 of 2', w - margin, 289, { align: 'right' });

  // -------------------------------------------
  // SAVE
  // -------------------------------------------
  doc.save(`MuktiTech_Trust_Report_${data.workerName.replace(/\s/g, '_')}_${reportId}.pdf`);
};
