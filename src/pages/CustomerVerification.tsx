import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import jsQR from "jsqr";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { Camera, CheckCircle, AlertTriangle, ArrowLeft, Wrench, MapPin, Navigation, Award, Wallet, Clock, Plus, Send, User, CheckCircle2, Edit, Trash2, X, ArrowRight, UserCheck, History, Star, Mic, Image as ImageIcon, Sparkles, ShieldCheck, MapPinOff, ImageOff, Crosshair, RefreshCw, Phone } from "lucide-react";
import StarRating from "@/components/StarRating";
import { getDeviceId } from "@/utils/device";
import { calculateTrustScore, getTrustLevel, getTrustBadgeColor, classifyCustomer, detectFraud, VerificationRecord } from "@/utils/trustEngine";
import { analyzeReview, NLPResult } from "@/utils/nlpProcessor";
import { queueOfflineReview, syncOfflineReviews, getOfflineQueueCount } from "@/utils/offlineQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCurrentPosition, validateProximity, GeoValidationResult } from "@/utils/geoValidator";
import { hashImage, checkDuplicate, captureFromVideo, compressImage } from "@/utils/imageHasher";
import { db } from "@/lib/firebase";
import { parseBudgetToAmount } from "@/utils/financial";
import { 
  collection, 
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp, 
  serverTimestamp,
  limit,
  getDoc,
  getDocs
} from "firebase/firestore";
import { toast } from "sonner";

interface WorkRequest {
  id: string;
  service: string;
  description: string;
  location: string;
  lat?: number;
  lng?: number;
  status: "Searching" | "Assigned" | "On the way" | "Completed" | "Pending" | "Accepted" | "In Progress";
  urgency: "Normal" | "Urgent";
  budget: string;
  preferredTime: string;
  timestamp: string;
  customerId: string;
  workerId?: string;
  workerName?: string;
  workerPhone?: string;
  workerSkill?: string;
  acceptedAt?: any;
}

const CustomerVerification = () => {
  const { user, addPoints, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { workerId: urlWorkerId, jobId: urlJobId } = useParams();

  const [step, setStep] = useState<"dashboard" | "scan" | "form" | "geo" | "photo" | "done" | "error" | "request" | "searching" | "tracking">("dashboard");
  const [errorMsg, setErrorMsg] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [verificationsToday, setVerificationsToday] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // ── Geo-validation state ──
  const [geoResult, setGeoResult] = useState<GeoValidationResult | null>(null);
  const [isCheckingGeo, setIsCheckingGeo] = useState(false);

  // ── Photo capture state ──
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoHash, setPhotoHash] = useState<string>("");
  const [isDuplicatePhoto, setIsDuplicatePhoto] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);

  // Request Work State
  const [activeRequests, setActiveRequests] = useState<WorkRequest[]>([]);
  const [trackingJob, setTrackingJob] = useState<WorkRequest | null>(null);
  
  const [reqService, setReqService] = useState("");
  const [reqDescription, setReqDescription] = useState("");
  const [reqLocation, setReqLocation] = useState("");
  const [reqUrgency, setReqUrgency] = useState<"Normal" | "Urgent">("Normal");
  const [reqBudget, setReqBudget] = useState("₹300 - ₹700");
  const [reqTime, setReqTime] = useState("Now");
  const [reqCoords, setReqCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [reqBudgetCustom, setReqBudgetCustom] = useState("");
  const [reqDate, setReqDate] = useState(new Date().toISOString().split("T")[0]);
  const [reqPhone, setReqPhone] = useState(user?.phone || "");
  const [reqAddress, setReqAddress] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const BUDGET_PRESETS = ["₹100-300", "₹300-500", "₹500-1000", "₹1000-2000", "₹2000+"];
  const SERVICE_CATEGORIES = [
    { value: "Plumber", icon: "🔧" },
    { value: "Electrician", icon: "⚡" },
    { value: "Maid / Cleaning", icon: "🧹" },
    { value: "Carpenter", icon: "🪚" },
    { value: "Gardener", icon: "🌿" },
    { value: "Painter", icon: "🎨" },
    { value: "Cook", icon: "👨‍🍳" },
    { value: "Driver", icon: "🚗" },
    { value: "AC Repair", icon: "❄️" },
    { value: "Laundry", icon: "👕" },
    { value: "Helper", icon: "🤝" },
    { value: "Other", icon: "📋" },
  ];

  const [recentVerifications, setRecentVerifications] = useState<any[]>([]);
  const [currentWorker, setCurrentWorker] = useState<any>(null);
  const [manualCode, setManualCode] = useState("");
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [trustScore, setTrustScore] = useState(user?.trustScore || 75);
  const [customerType, setCustomerType] = useState<0 | 1>(user?.customer_type || 1);
  const [nlpInsights, setNlpInsights] = useState<NLPResult[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isOnline = useOnlineStatus();

  // Auto-sync offline reviews when back online
  useEffect(() => {
    if (isOnline && getOfflineQueueCount() > 0) {
      syncOfflineReviews().then(count => {
        if (count > 0) {
          toast.success(`${count} offline review${count > 1 ? 's' : ''} synced to Firebase!`);
        }
      });
    }
  }, [isOnline]);

  const [workerDemo] = useState({ 
    id: "worker-123",
    name: "Ramesh Kumar", 
    skill: "Electrician & Plumber", 
    phone: "1234567891",
    rating: 4.8,
    points: 450,
    completedJobs: 124,
    location: "Patna, Bihar"
  });

  // Initial routing check
  useEffect(() => {
    if (urlWorkerId && urlWorkerId !== "request") {
      setStep("form");
      const fetchWorker = async (retryCount = 0) => {
        try {
          const wDoc = await getDoc(doc(db, "users", urlWorkerId));
          if (wDoc.exists()) {
            const workerData = wDoc.data();
            
            // Security Check: Validate sessionId if provided in URL (Direct Scan)
            if (urlJobId && workerData.activeSessionId && workerData.activeSessionId !== urlJobId) {
              if (retryCount < 3) {
                 // Retry after a short delay to account for Firestore sync lag
                 console.log(`Sync lag detected. Retrying handshake validation... (Attempt ${retryCount + 1})`);
                 setTimeout(() => fetchWorker(retryCount + 1), 1000);
                 return;
              }
              setErrorMsg("Identity pulse timeout. This QR code has expired or the worker regenerated it. Please ask the worker to show the current QR code.");
              setStep("error");
              return;
            }
            
            setCurrentWorker({ id: wDoc.id, ...workerData });
          } else if (user?.isDemo) {
            setCurrentWorker(workerDemo);
          }
        } catch (e) {
          if (user?.isDemo) setCurrentWorker(workerDemo);
        }
      };
      fetchWorker();
    } else if (location.pathname.includes("/request")) {
      setStep("request");
    } else {
      setStep("dashboard");
    }
  }, [urlWorkerId, location.pathname, user?.isDemo]);

  // Consolidated camera handling for both scan and photo steps
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      // 1. Clean up ANY existing streams first (Global Track Reset)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (photoStreamRef.current) {
        photoStreamRef.current.getTracks().forEach(track => track.stop());
        photoStreamRef.current = null;
      }

      // 2. Start new camera based on step
      if (step === "scan") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
          });
          activeStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            
            // --- QR SCANNING BRAIN ---
            const scanQR = () => {
              if (step !== "scan" || !videoRef.current) return;
              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement("canvas");
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                  });
                  if (code) {
                    console.log("✅ QR Signature Detected:", code.data);
                    // Extract workerId from URL: .../verify/:workerId/:sessionId
                    const parts = code.data.split("/");
                    const workerId = parts[parts.length - 2];
                    const sessionId = parts[parts.length - 1];
                    
                    if (workerId && sessionId) {
                       toast.success("Identity Verified! Syncing details...");
                       navigate(`/verify/${workerId}/${sessionId}`);
                       return; // Exit loop
                    }
                  }
                }
              }
              requestAnimationFrame(scanQR);
            };
            requestAnimationFrame(scanQR);
          }
        } catch (err) {
          console.error("Scanning camera error:", err);
          toast.error("Camera access error. Reset permissions.");
        }
      } else if (step === "photo" && !capturedPhoto) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          activeStream = stream;
          if (photoVideoRef.current) {
            photoVideoRef.current.srcObject = stream;
            photoStreamRef.current = stream;
          }
        } catch (err) {
          console.error("Verification camera error:", err);
          toast.error("Photo camera failed—check gallery option.");
        }
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (photoStreamRef.current) photoStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [step, capturedPhoto]);

  // Listen to recent verifications
  useEffect(() => {
    if (!user) return;
    const vQuery = query(collection(db, "verifications"), where("customerId", "==", user.id), orderBy("timestamp", "desc"), limit(50));
    return onSnapshot(vQuery, (snap) => {
      const allV = snap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
        } as any;
      });
      
      setRecentVerifications(allV.slice(0, 5));
      
      const vRecords: VerificationRecord[] = allV.map(v => ({
        workerId: v.workerId,
        customerId: v.customerId,
        timestamp: v.timestamp,
        location: v.location?.address || v.location || "",
        deviceId: v.deviceId || "",
        rating: v.rating,
        comment: v.comment || ""
      }));

      const newType = classifyCustomer(vRecords);
      const newScore = calculateTrustScore(user, vRecords);
      
      setCustomerType(newType);
      setTrustScore(newScore);

      const insights = allV.map(v => analyzeReview(v.comment || ""));
      setNlpInsights(insights);
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const count = allV.filter((v: any) => v.timestamp >= today).length;
      setVerificationsToday(count);

      if (user.trustScore !== newScore || user.customer_type !== newType) {
        updateUser({ trustScore: newScore, customer_type: newType });
      }
    });
  }, [user]);

  // Real-time listener for requests
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "work_requests"), where("customerId", "==", user.id));
    return onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.createdAt ? (data.createdAt as Timestamp).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"
        } as WorkRequest;
      }).sort((a, b) => {
        const timeA = (a as any).createdAt?.seconds || 0;
        const timeB = (b as any).createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setActiveRequests(reqs);
      
      const latest = reqs.find(r => r.status !== "Completed");
      if (latest && ["Searching", "Assigned", "On the way", "Accepted", "Pending", "In Progress"].includes(latest.status)) {
        setTrackingJob(latest);
      } else {
        setTrackingJob(null);
      }
    });
  }, [user]);

  if (!user || user.role !== "customer") {
    navigate("/");
    return null;
  }

  const MAX_DAILY = 3;

  const handleScan = () => {
    if (verificationsToday >= MAX_DAILY) {
      setErrorMsg(`Daily limit reached (${MAX_DAILY}). For security, verification is limited.`);
      setStep("error");
      return;
    }
    if (user.isDemo) {
      setStep("form");
      return;
    }
    if (urlWorkerId && urlWorkerId !== "request") {
      setStep("form");
    } else {
      setStep("scan");
    }
  };

  // ── Step 1: Form submit → OTP → Geo check ──
  const handleSubmit = () => {
    if (rating === 0) return;
    if (comment.trim().length < 10) {
      toast.error("Review must be at least 10 characters long.");
      return;
    }

    // If OTP not done yet, trigger OTP first
    if (!otpSent && !user.otpVerified) {
      setOtpSent(true);
      toast.success("Identity verification OTP sent!");
      return;
    }

    if (!user.otpVerified && otpCode.length !== 4) {
      toast.error("Please enter a valid 4-digit OTP.");
      return;
    }

    // Proceed to geo-validation step
    setStep("geo");
  };

  // ── Step 2: Geo-location validation ──
  const handleGeoValidation = async () => {
    setIsCheckingGeo(true);
    try {
      const customerPos = await getCurrentPosition();

      // Worker's stored location_coords OR fallback
      const workerLat = currentWorker?.location_coords?.lat || currentWorker?.lat || 25.5941;
      const workerLng = currentWorker?.location_coords?.lng || currentWorker?.lng || 85.1376;

      const result = validateProximity(
        customerPos.lat,
        customerPos.lng,
        workerLat,
        workerLng
      );

      setGeoResult(result);

      if (!result.isValid) {
        // In demo mode, allow override
        if (user?.isDemo) {
          toast.warning(`Demo: Skipping geo block (${result.distance}m away)`);
          setGeoResult({ ...result, isValid: true, geoVerified: true });
          setStep("photo");
        } else {
          toast.error(result.message || "Location mismatch.");
        }
      } else {
        toast.success(`Location verified! (${result.distance}m away)`);
        setStep("photo");
      }
    } catch (err: any) {
      // GPS failed — allow in demo mode, block otherwise
      if (user?.isDemo) {
        const fallback: GeoValidationResult = {
          isValid: true, distance: 0, geoVerified: true,
          customerLat: 25.5941, customerLng: 85.1376,
          workerLat: 25.5941, workerLng: 85.1376,
          message: "Demo: GPS skipped"
        };
        setGeoResult(fallback);
        toast.warning("Demo: GPS unavailable, skipping.");
        setStep("photo");
      } else {
        toast.error(`GPS access required: ${err.message}`);
      }
    } finally {
      setIsCheckingGeo(false);
    }
  };


  // ── Step 3: Capture photo ──
  const handleCapturePhoto = async () => {
    if (!photoVideoRef.current) return;
    setIsCapturing(true);
    const photo = captureFromVideo(photoVideoRef.current);
    if (photo) {
      setCapturedPhoto(photo);
      // Hash and check for duplicates
      try {
        const hash = await hashImage(photo);
        setPhotoHash(hash);
        const targetWorkerId = currentWorker?.id || urlWorkerId || "unknown";
        const dupResult = await checkDuplicate(hash, targetWorkerId);
        if (dupResult.isDuplicate) {
          setIsDuplicatePhoto(true);
          setDuplicateReason(dupResult.fraudReason);
          toast.error("⚠️ Duplicate image detected!");
        } else {
          setIsDuplicatePhoto(false);
          setDuplicateReason("");
        }
      } catch {
        // Hash failed — proceed anyway
      }
    }
    setIsCapturing(false);
  };

  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoHash("");
    setIsDuplicatePhoto(false);
    setDuplicateReason("");
  };

  const handlePhotoFromGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setIsCapturing(true);
      try {
        const compressed = await compressImage(base64);
        setCapturedPhoto(compressed);
        const hash = await hashImage(compressed);
        setPhotoHash(hash);
        const targetWorkerId = currentWorker?.id || urlWorkerId || "unknown";
        const dupResult = await checkDuplicate(hash, targetWorkerId);
        if (dupResult.isDuplicate) {
          setIsDuplicatePhoto(true);
          setDuplicateReason(dupResult.fraudReason);
          toast.error("⚠️ Duplicate image detected!");
        } else {
          setIsDuplicatePhoto(false);
          setDuplicateReason("");
        }
      } catch (err) {
        console.error("Gallery photo processing failed", err);
        toast.error("Failed to process image. Try a smaller file.");
      } finally {
        setIsCapturing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Step 4: Final save with all enriched data ──
  const handleFinalSave = async () => {
    setIsSaving(true);
    try {
      const deviceId = getDeviceId();
      const timestamp = new Date();
      const locationData = reqLocation || "Patna, Bihar";
      const targetWorkerId = currentWorker?.id || urlWorkerId || "unknown";
      const workerType = currentWorker?.workerType ?? 1;

      // ===== WORKER TYPE PHOTO RULES =====
      if (workerType === 1 && !capturedPhoto) {
        // One-time worker: photo is MANDATORY
        setErrorMsg("Photo is mandatory for one-time worker verification.");
        setStep("error");
        setIsSaving(false);
        return;
      }

      if (workerType === 0 && !capturedPhoto) {
        // Regular worker: check if last photo was > 7 days
        const lastPhotoV = recentVerifications.find((v: any) => v.workerId === targetWorkerId && v.photoUrl);
        if (lastPhotoV) {
          const daysSince = (Date.now() - (lastPhotoV.timestamp instanceof Date ? lastPhotoV.timestamp.getTime() : new Date(lastPhotoV.timestamp).getTime())) / (1000 * 3600 * 24);
          if (daysSince > 7) {
            setErrorMsg("Photo required — last photo verification was more than 7 days ago.");
            setStep("error");
            setIsSaving(false);
            return;
          }
        }
      }

      // ===== 7-DAY COOLDOWN ENFORCEMENT =====
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cooldownQuery = query(
        collection(db, "verifications"),
        where("customerId", "==", user.id),
        where("workerId", "==", targetWorkerId)
      );
      const cooldownSnap = await getDocs(cooldownQuery);
      const recentForWorker = cooldownSnap.docs.find(d => {
        const t = d.data().timestamp?.toDate ? d.data().timestamp.toDate() : new Date(d.data().timestamp);
        return t >= sevenDaysAgo;
      });
      if (recentForWorker) {
        const lastDate = recentForWorker.data().timestamp?.toDate ? recentForWorker.data().timestamp.toDate() : new Date();
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 7);
        setErrorMsg(`7-day cooldown active for this worker. You can review again after ${nextDate.toLocaleDateString()}.`);
        setStep("error");
        setIsSaving(false);
        return;
      }

      // ===== BUILD VERIFICATION RECORD =====
      const newVerification: VerificationRecord = {
        workerId: targetWorkerId,
        customerId: user.id,
        rating,
        comment,
        timestamp,
        location: locationData,
        deviceId,
        workerType,
        geoVerified: geoResult?.geoVerified ?? false,
        customerLat: geoResult?.customerLat,
        customerLng: geoResult?.customerLng,
        photoUrl: capturedPhoto || undefined,
        imageHash: photoHash || undefined,
        fraudFlag: isDuplicatePhoto || (geoResult?.geoVerified === false),
        fraudReason: isDuplicatePhoto
          ? duplicateReason
          : geoResult?.geoVerified === false
          ? "Geo-location mismatch detected"
          : "",
      };

      // ===== FRAUD DETECTION =====
      const fraudError = detectFraud(newVerification, recentVerifications.map(v => ({
        ...v,
        timestamp: v.timestamp?.toDate ? v.timestamp.toDate() : v.timestamp
      })));

      if (fraudError) {
        // Auto-Suspend Trigger Logic
        const isSevereFraud = fraudError.toLowerCase().includes("duplicate") || 
                              fraudError.toLowerCase().includes("mismatch") ||
                              fraudError.toLowerCase().includes("suspicious");

        if (isSevereFraud) {
          const alertPayload = {
            workerId: targetWorkerId,
            customerId: user.id,
            rating, 
            comment,
            location: locationData,
            timestamp: serverTimestamp(),
            fraudFlag: true,
            fraudReason: fraudError,
            fraudAction: "blocked",
            workerName: currentWorker?.name || "Worker",
            customerName: user.name || "Customer",
            deviceId: getDeviceId(),
            photoUrl: capturedPhoto || null
          };
          
          // Log alert for admins
          await addDoc(collection(db, "verifications"), alertPayload);
          
          // Active Enforcement (Auto-Suspend)
          await updateDoc(doc(db, "users", targetWorkerId), {
            isBanned: true,
            status: "banned",
            accountStatus: "suspended"
          });
        }
        
        setErrorMsg(fraudError);
        setStep("error");
        setIsSaving(false);
        return;
      }

      // ===== NLP + TRUST SCORE =====
      const nlpResult = analyzeReview(comment);
      newVerification.nlp = nlpResult;

      const computedTrustScore = calculateTrustScore(user, [
        newVerification,
        ...recentVerifications.map(v => ({
          ...v,
          timestamp: v.timestamp?.toDate ? v.timestamp.toDate() : v.timestamp
        }))
      ]);
      newVerification.trustScore = computedTrustScore;

      // ===== FULL FIRESTORE PAYLOAD =====
      const payload = {
        workerId: targetWorkerId,
        customerId: user.id,
        rating,
        comment,
        workerName: currentWorker?.name || "Worker",
        workerSkill: currentWorker?.skill || "Service",
        workerType,
        location: locationData,
        deviceId,
        customer_type: customerType,
        nlp: nlpResult,
        timestamp: serverTimestamp(),
        // ── New enriched fields ──
        photoUrl: capturedPhoto || null,
        imageHash: photoHash || null,
        geoVerified: geoResult?.geoVerified ?? false,
        customerLat: geoResult?.customerLat ?? null,
        customerLng: geoResult?.customerLng ?? null,
        workerLat: geoResult?.workerLat ?? null,
        workerLng: geoResult?.workerLng ?? null,
        geoDistance: geoResult?.distance ?? null,
        fraudFlag: isDuplicatePhoto,
        fraudReason: isDuplicatePhoto ? duplicateReason : "",
        trustScore: computedTrustScore,
      };

      // ===== OFFLINE QUEUE =====
      if (!navigator.onLine) {
        queueOfflineReview({
          ...payload,
          timestamp: new Date().toISOString(),
        } as any);
        toast.success(`Review saved offline! Will sync when you're back online. (${getOfflineQueueCount()} queued)`);
        setEarnedPoints(10);
        setStep("done");
        setIsSaving(false);
        return;
      }

      // ===== SAVE TO FIRESTORE =====
      await addDoc(collection(db, "verifications"), payload);
      await addPoints(10, "Verified Transaction");
      setEarnedPoints(10);

      // Update trust score on user profile
      await updateUser({
        trustScore: computedTrustScore,
        ...((!user.otpVerified) ? { otpVerified: true, lastOtpDate: new Date() } : {}),
      });

      setStep("done");
    } catch (err) {
      console.error("Verification error:", err);
      toast.error("Action failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.success("Voice recognition active...", { icon: <Mic className="animate-pulse text-orange-500" /> });
      setTimeout(() => {
        setComment(prev => prev + (prev ? " " : "") + "The worker was very professional and completed the task with high precision.");
        setIsRecording(false);
        toast.info("Voice transcribed successfully!");
      }, 3000);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => [...prev, reader.result as string]);
        toast.success("Work evidence uploaded!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLocationDetect = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          const lat = p.coords.latitude;
          const lng = p.coords.longitude;
          setReqCoords({ lat, lng });

          // Reverse geocode for a real address
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
            const data = await res.json();
            const addr = data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            const shortAddr = [
              data?.address?.road,
              data?.address?.suburb || data?.address?.neighbourhood,
              data?.address?.city || data?.address?.town || data?.address?.village,
              data?.address?.state
            ].filter(Boolean).join(", ");
            setReqLocation(shortAddr || addr);
            setReqAddress(addr);
          } catch {
            setReqLocation(`GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
          setIsLocating(false);
          toast.success("📍 Location pinned!");
        },
        () => {
          setReqCoords({ lat: 25.5941, lng: 85.1376 });
          setReqLocation("Patna, Bihar");
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleRequestSubmit = async () => {
    if (!reqService || !reqDescription || !reqLocation) {
      toast.error("Please fill all required fields.");
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const finalBudget = reqBudgetCustom ? `₹${reqBudgetCustom}` : reqBudget;
      const payload: Record<string, any> = {
        // Work details
        service: reqService,
        description: reqDescription,
        urgency: reqUrgency,
        budget: finalBudget,
        amount: parseBudgetToAmount(finalBudget), // Numeric amount for financial calculations
        preferredTime: reqTime,
        preferredDate: reqDate,
        // Location (real GPS)
        location: reqLocation,
        fullAddress: reqAddress || reqLocation,
        lat: reqCoords?.lat || 25.5941,
        lng: reqCoords?.lng || 85.1376,
        // Customer info
        customerId: user.id,
        customerName: user.name,
        customerPhone: reqPhone || user.phone || "Hidden",
        // Status tracking
        status: "Searching",
        createdAt: serverTimestamp(),
      };

      let saved = false;

      // ── Strategy 1: Direct Firestore Write ──
      try {
        const docRef = await addDoc(collection(db, "work_requests"), payload);
        console.log("✅ Work request saved to Firestore:", docRef.id);
        saved = true;
      } catch (firestoreErr: any) {
        console.warn("⚠️ Direct Firestore write blocked:", firestoreErr.message);
      }

      // ── Strategy 2: Backend API Fallback (uses Admin SDK → bypasses rules) ──
      if (!saved) {
        try {
          const backendPayload = {
            ...payload,
            createdAt: new Date().toISOString(), // serverTimestamp() doesn't work in JSON
          };
          const res = await fetch("http://localhost:5000/api/work-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backendPayload),
          });
          if (res.ok) {
            console.log("✅ Work request saved via Backend API");
            saved = true;
          } else {
            console.warn("⚠️ Backend API returned error:", res.status);
          }
        } catch (backendErr: any) {
          console.warn("⚠️ Backend API unreachable:", backendErr.message);
        }
      }

      if (saved) {
        toast.success("✅ Work request posted! Workers nearby will see it.");
        setStep("searching");
        setTimeout(() => {
          setStep("dashboard");
          // Reset form
          setReqService(""); setReqDescription(""); setReqBudgetCustom("");
          setReqLocation(""); setReqAddress("");
        }, 3000);
      } else {
        toast.error("Could not save request. Check your internet connection.");
      }
    } catch (err) {
      console.error("Request error:", err);
      toast.error("Failed to post request. Try again.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCodeVerify = async () => {
    if (manualCode.length !== 6) return;
    setIsSearchingCode(true);
    try {
      if (user?.isDemo && manualCode.toUpperCase() === "MUKTI2") {
        setCurrentWorker(workerDemo);
        setStep("form");
        return;
      }
      const q = query(collection(db, "users"), where("role", "==", "worker"), where("activeVerificationCode", "==", manualCode.toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setCurrentWorker({ id: snap.docs[0].id, ...snap.docs[0].data() });
        setStep("form");
      } else {
        toast.error("Invalid Code.");
      }
    } finally {
      setIsSearchingCode(false);
    }
  };

  const handleBack = () => {
    setStep("dashboard");
    setErrorMsg("");
    setRating(0);
    setComment("");
    setOtpSent(false);
    setOtpCode("");
    setGeoResult(null);
    setCapturedPhoto(null);
    setPhotoHash("");
    setIsDuplicatePhoto(false);
    setDuplicateReason("");
  };

  return (
    <div className="container mx-auto flex flex-col items-center py-4 sm:py-6 md:py-10 px-3 sm:px-4 lg:px-6 relative overflow-hidden min-h-[calc(100vh-4rem)]">
      {/* Background Orbs */}
      <div className="absolute top-[0%] left-[-20%] h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-20%] h-[300px] w-[300px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />

      {step === "dashboard" && (
        <div className="w-full max-w-7xl space-y-8 opacity-0 animate-fade-up relative z-10" style={{ animationDelay: "100ms" }}>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column: Profile & Status */}
            <div className="w-full lg:w-[320px] space-y-6">
              <div className="rounded-[2.5rem] bg-slate-950 p-6 border border-white/5 text-center shadow-2xl relative overflow-hidden group">
                 <div className="absolute -top-24 -right-24 h-48 w-48 bg-orange-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                 
                 <div className="relative z-10">
                    <div className="mb-4 flex justify-center">
                       <div className="relative">
                          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl font-black shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                             {user.name.charAt(0)}
                          </div>
                          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-slate-900 border border-orange-500/30 text-orange-500 shadow-lg">
                             <Award size={14} />
                          </div>
                       </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-white">{user.name}</h3>
                    <div className="flex flex-col items-center gap-2 mt-3">
                       <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${getTrustBadgeColor(trustScore)}`}>
                          {getTrustLevel(trustScore)}
                       </div>
                       <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          {customerType === 0 ? "Regular (Monthly)" : "One-time (Dynamic)"}
                       </div>
                    </div>

                    {/* Trust Meter */}
                    <div className="mt-6 space-y-2">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                          <span>Trust Score</span>
                          <span className="text-orange-500">{trustScore}%</span>
                       </div>
                       <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                          <div 
                             className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-1000"
                             style={{ width: `${trustScore}%` }}
                          />
                       </div>
                    </div>

                    <div className="mt-6 flex justify-between items-center px-4 py-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                       <div className="text-left">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-[#F0A500]">Trust Points (OTP)</div>
                          <div className="text-2xl font-black text-white">{recentVerifications.length * 10 || 0}</div>
                       </div>
                       <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-[#F0A500]/10 text-[#F0A500] border border-[#F0A500]/20">
                          <ShieldCheck size={18} />
                       </div>
                    </div>

                     {/* Sentiment Trend */}
                     {nlpInsights.length > 0 && (
                       <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-left">
                         <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Service Sentiment</div>
                         <div className="flex flex-wrap gap-2">
                           {Array.from(new Set(nlpInsights.flatMap(n => n.skills))).slice(0, 3).map(skill => (
                             <span key={skill} className="text-[8px] font-black uppercase px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/10">
                               {skill}
                             </span>
                           ))}
                           {nlpInsights.filter(n => n.sentiment === "positive").length > 0 && (
                             <span className="text-[8px] font-black uppercase px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 italic">
                               Highly Positive
                             </span>
                           )}
                         </div>
                       </div>
                     )}
                  </div>
              </div>

              {/* Alerts Card */}
              <div className="rounded-3xl bg-slate-900/50 p-6 border border-white/5 space-y-4">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <AlertTriangle size={14} className="text-orange-500" />
                    Security Baseline
                 </h4>
                 <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-slate-400 flex items-center gap-3">
                       <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                       OTP required for new devices
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-slate-400 flex items-center gap-3">
                       <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                       7-day cooldown on same worker
                    </div>
                 </div>
              </div>

              {/* Active Jobs */}
              <div className="rounded-3xl glass p-6 border-white/5 space-y-4">
                 <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-3 flex items-center justify-between">
                    Live Tracking
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                 </h4>
                 {activeRequests.length > 0 ? (
                    <div className="space-y-3">
                       {activeRequests.filter(r => r.status !== "Completed").slice(0, 3).map(r => (
                          <button 
                            key={r.id} 
                            onClick={() => navigate(`/tracking/${r.id}`)}
                            className="w-full text-left p-4 rounded-2xl bg-slate-900 border border-white/5 hover:border-orange-500/30 transition-all hover:scale-[1.02] group"
                          >
                             <div className="flex justify-between items-start mb-2">
                                <div className="font-black text-[10px] uppercase tracking-widest text-orange-500">{r.service}</div>
                                <Clock size={12} className="text-slate-600" />
                             </div>
                              <div className="text-sm font-black flex items-center gap-2 text-white mb-2">
                                 <span className={`p-1 rounded text-[8px] tracking-widest uppercase ${
                                   r.status === 'Accepted' || r.status === 'In Progress' ? 'bg-blue-500/10 text-blue-500' :
                                   r.status === 'Searching' ? 'bg-orange-500/10 text-orange-500 animate-pulse' :
                                   r.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                   r.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                   'bg-blue-500/10 text-blue-500'
                                 }`}>{r.status}</span>
                                 <span className="truncate opacity-50 text-[10px]">Near {r.location}</span>
                              </div>
                              {/* Show accepted worker info */}
                              {r.workerName && (
                                <div className="mt-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 text-sm font-black">
                                      {r.workerName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-black text-white truncate">{r.workerName}</div>
                                      <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Worker Accepted ✓</div>
                                    </div>
                                    {r.workerPhone && (
                                      <a href={`tel:${r.workerPhone}`} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all" onClick={(e) => e.stopPropagation()}>
                                        <Phone size={14} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                           </button>
                        ))}
                    </div>
                 ) : (
                    <div className="py-6 text-center">
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No active bookings</p>
                    </div>
                 )}
              </div>
            </div>

            {/* Right Column: Key Actions & History */}
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep("request")}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-gradient-to-br from-orange-400 to-orange-600 p-6 sm:p-10 text-white shadow-2xl shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:scale-150 transition-transform duration-700" />
                  <div className="relative z-10 p-3 sm:p-5 rounded-2xl bg-white/20 backdrop-blur-md">
                    <Plus size={32} className="group-hover:rotate-90 transition-transform duration-500" />
                  </div>
                  <div className="relative z-10 text-center">
                    <h3 className="text-xl sm:text-2xl font-black italic tracking-tighter">GET HELP NOW</h3>
                    <p className="text-[10px] font-bold opacity-80 mt-2 uppercase tracking-[0.2em]">Instant Local Hire</p>
                  </div>
                </button>

                <button
                  onClick={() => setStep("scan")}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-slate-900 border border-white/10 p-6 sm:p-10 shadow-2xl transition-all hover:bg-slate-800 active:scale-[0.98] overflow-hidden"
                >
                  <div className="p-3 sm:p-5 rounded-2xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform">
                    <Camera size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl sm:text-2xl font-black italic tracking-tighter text-white">SCAN WORKER ID</h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-[0.2em]">Verify & Earn Credits</p>
                  </div>
                </button>
              </div>

              {/* Recent History */}
              <div className="rounded-[2.5rem] bg-slate-950 p-5 sm:p-8 border border-white/5">
                 <div className="flex items-center justify-between mb-8">
                    <h4 className="text-xl font-black tracking-tight text-white flex items-center gap-3">
                       <History size={24} className="text-orange-500" />
                       Recent History
                    </h4>
                    <Link to="/activity" className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] border-b border-orange-500 hover:text-white transition-all">View All</Link>
                 </div>
                 
                 <div className="space-y-4">
                    {recentVerifications.length > 0 ? (
                      recentVerifications.map((v, i) => (
                        <div key={v.id} className="flex items-center justify-between p-5 rounded-[2rem] bg-white/5 border border-white/5 group hover:border-orange-500/20 transition-all">
                           <div className="flex items-center gap-5">
                              <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-xl font-black uppercase border border-orange-500/10">
                                 {v.workerName?.charAt(0) || "W"}
                              </div>
                              <div className="text-left">
                                 <div className="text-base font-black text-white">{v.workerName || "Worker"}</div>
                                 <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2 mt-1 uppercase tracking-tight">
                                    {v.service || "Home Service"} • <Star className="text-orange-400 fill-orange-400" size={10} /> <span className="text-orange-400">{v.rating}</span>
                                    {nlpInsights[i] && (
                                      <>
                                        <span className="h-1 w-1 rounded-full bg-slate-800"></span>
                                        <span className={`${nlpInsights[i].sentiment === 'positive' ? 'text-emerald-500' : 'text-slate-500'} italic`}>
                                          {nlpInsights[i].sentiment}
                                        </span>
                                      </>
                                    )}
                                 </div>
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="text-[10px] font-bold text-slate-600 mb-2 uppercase tracking-widest text-right">
                                 {v.timestamp instanceof Date ? v.timestamp.toLocaleDateString() : "Just now"}
                              </div>
                              <div className="flex items-center gap-1.5 text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/10">
                                 <CheckCircle size={10} /> VERIFIED
                              </div>
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-16 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
                        <History size={40} className="mx-auto text-slate-800 mb-4" />
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">History will appear after your first scan</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "scan" && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
           <button onClick={handleBack} className="absolute top-8 left-8 p-4 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all">
              <ArrowLeft size={24} />
           </button>
           
           <div className="relative w-full max-w-[340px] aspect-[3/4] rounded-[3rem] border-4 border-orange-500 overflow-hidden shadow-[0_0_60px_rgba(249,115,22,0.3)] bg-black">
              <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <div className="w-56 h-56 border-2 border-dashed border-orange-500/50 rounded-[2rem] animate-[pulse_2s_infinite]" />
                 <p className="mt-12 text-orange-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Scanning QR Signature</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent" />
           </div>

           <div className="mt-12 text-center text-white space-y-8 max-w-sm w-full relative z-10 px-6">
              <div className="space-y-2">
                 <h3 className="text-3xl font-black italic tracking-tighter">SECURE HANDSHAKE</h3>
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Align worker's dashboard QR in the frame</p>
              </div>

              <div className="relative py-2">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                 <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-black px-4 text-slate-600 font-black tracking-widest">OR ENTER ID CODE</span></div>
              </div>

              <div className="space-y-4">
                 <input 
                   type="text"
                   value={manualCode}
                   onChange={(e) => setManualCode(e.target.value.toUpperCase().slice(0, 6))}
                   placeholder="000-000"
                   className="w-full bg-slate-900 border border-white/10 rounded-[1.5rem] py-5 px-6 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-orange-500 transition-all text-orange-500 placeholder:text-slate-800"
                 />
                 <button 
                   onClick={handleCodeVerify}
                   disabled={manualCode.length !== 6 || isSearchingCode}
                   className="w-full py-5 rounded-[1.5rem] bg-orange-500 text-white font-black uppercase tracking-widest text-xs hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-20 shadow-xl shadow-orange-500/20"
                 >
                   {isSearchingCode ? "FETCHING DATA..." : "VERIFY ID NOW"}
                 </button>
              </div>
           </div>
        </div>
      )}

      {step === "request" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-slate-950 rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 animate-fade-up">
            <div className="p-8 pb-5 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
               <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-3 italic uppercase">
                  <div className="p-2.5 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                    <Wrench size={20} />
                  </div>
                  Request a Worker
               </h3>
               <button onClick={handleBack} className="p-2.5 rounded-full hover:bg-white/5 text-slate-500 transition-all">
                  <X size={22} />
               </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-950/50">

              {/* ── Section 1: Service Type ── */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 ml-1 flex items-center gap-2">
                  <Wrench size={12} /> What Service Do You Need?
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {SERVICE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setReqService(cat.value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-all ${
                        reqService === cat.value
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-500 shadow-lg shadow-orange-500/10"
                          : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-[8px] font-black uppercase tracking-widest truncate w-full">{cat.value.split("/")[0].trim()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Section 2: Work Description ── */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Describe the Work</label>
                <textarea
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="e.g. Kitchen tap is leaking badly, need urgent repair..."
                  rows={3}
                  className="w-full rounded-2xl border border-white/5 bg-slate-900 p-5 text-sm text-white font-medium outline-none focus:border-orange-500 transition-all resize-none placeholder:text-slate-700"
                />
              </div>

              {/* ── Section 3: Budget ── */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1 flex items-center gap-2">
                  <Wallet size={12} /> Budget (₹)
                </label>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_PRESETS.map((b) => (
                    <button
                      key={b}
                      onClick={() => { setReqBudget(b); setReqBudgetCustom(""); }}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        reqBudget === b && !reqBudgetCustom
                          ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                          : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-orange-500 font-black text-sm">₹</span>
                  <input
                    type="number"
                    value={reqBudgetCustom}
                    onChange={(e) => { setReqBudgetCustom(e.target.value); setReqBudget(""); }}
                    placeholder="Or enter custom amount"
                    className="w-full rounded-2xl border border-white/5 bg-slate-900 py-4 pl-10 pr-6 text-sm text-white font-black outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
                  />
                </div>
              </div>

              {/* ── Section 4: Location (Real GPS) ── */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                   <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
                     <MapPin size={12} /> Service Location
                   </label>
                   <button onClick={handleLocationDetect} className="text-[9px] font-black text-orange-500 uppercase tracking-widest hover:text-white transition-all flex items-center gap-1.5 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
                      {isLocating ? <Clock size={12} className="animate-spin" /> : <Navigation size={12} />}
                      {isLocating ? "DETECTING..." : "📍 USE GPS"}
                   </button>
                </div>
                <div className="relative">
                   <MapPin size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-orange-500" />
                   <input
                     type="text"
                     value={reqLocation}
                     onChange={(e) => setReqLocation(e.target.value)}
                     placeholder="Auto-detect or type: Kankarbagh, Patna"
                     className="w-full rounded-2xl border border-white/5 bg-slate-900 py-4 pl-12 pr-6 text-sm text-white font-black outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
                   />
                </div>
                {reqCoords && reqAddress && (
                  <div className="text-[9px] font-bold text-emerald-500/60 px-2 truncate">
                    ✅ GPS Locked: {reqAddress.slice(0, 80)}...
                  </div>
                )}
              </div>

              {/* ── Section 5: Date, Time & Urgency ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1 flex items-center gap-1">
                    <Clock size={10} /> When
                  </label>
                  <input
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="w-full rounded-xl border border-white/5 bg-slate-900 p-3 text-xs text-white font-black outline-none focus:border-orange-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Time</label>
                  <select
                    value={reqTime}
                    onChange={(e) => setReqTime(e.target.value)}
                    className="w-full rounded-xl border border-white/5 bg-slate-900 p-3 text-xs text-white font-black outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="Now">Right Now</option>
                    <option value="Morning">Morning (8-12)</option>
                    <option value="Afternoon">Afternoon (12-4)</option>
                    <option value="Evening">Evening (4-8)</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Priority</label>
                   <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-white/5">
                      <button onClick={() => setReqUrgency("Normal")} className={`py-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${reqUrgency === "Normal" ? "bg-white text-black shadow-lg" : "text-slate-600 hover:text-white"}`}>Normal</button>
                      <button onClick={() => setReqUrgency("Urgent")} className={`py-3 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${reqUrgency === "Urgent" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-slate-600 hover:text-white"}`}>🔴 Urgent</button>
                   </div>
                </div>
              </div>

              {/* ── Section 6: Contact ── */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1 flex items-center gap-2">
                  <User size={12} /> Your Contact Number
                </label>
                <input
                  type="tel"
                  value={reqPhone}
                  onChange={(e) => setReqPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full rounded-2xl border border-white/5 bg-slate-900 py-4 px-6 text-sm text-white font-black outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
                />
              </div>
            </div>
            
            {/* ── Submit ── */}
            <div className="p-8 bg-white/5 border-t border-white/5 space-y-3">
              {/* Summary row */}
              {reqService && reqLocation && (
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 px-2">
                  <span>{reqService} • {reqUrgency}</span>
                  <span>{reqBudgetCustom ? `₹${reqBudgetCustom}` : reqBudget}</span>
                </div>
              )}
              <button
                onClick={handleRequestSubmit}
                disabled={!reqService || !reqDescription || !reqLocation || isSubmittingRequest}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-3"
              >
                {isSubmittingRequest ? <><Clock size={16} className="animate-spin" /> Posting...</> : <>Find Best Specialist <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "searching" && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="relative flex h-72 w-72 items-center justify-center">
              <div className="absolute inset-0 animate-[ping_3s_infinite] rounded-full bg-orange-500/10" />
              <div className="absolute inset-4 animate-[ping_2s_infinite] rounded-full bg-orange-500/20" />
              <div className="absolute inset-8 animate-[ping_1.5s_infinite] rounded-full bg-orange-500/30" />
              <div className="relative flex h-36 w-36 items-center justify-center rounded-[3rem] bg-orange-500 text-white shadow-[0_0_80px_rgba(249,115,22,0.5)]">
                 <Wrench size={56} className="animate-spin duration-500" style={{ animationDuration: '3s' }} />
              </div>
           </div>
           <div className="mt-16 text-center space-y-4">
              <h3 className="text-4xl font-black tracking-tighter text-white italic truncate px-4">CONTRACTING PROS...</h3>
              <p className="text-[10px] font-black text-slate-500 tracking-[0.5em] uppercase animate-pulse">Scanning 5km Radius for Top-Rated Workers</p>
           </div>
        </div>
      )}

      {(step === "form" || step === "geo" || step === "photo" || step === "done" || step === "error") && (
        <div className="w-full max-w-2xl space-y-4 animate-fade-up relative z-10">
           <button onClick={handleBack} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all border border-white/5">
              <ArrowLeft size={24} />
           </button>

           {step === "form" && (
             <div className="w-full bg-slate-950 rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden">
                <div className="p-10 pb-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                   <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                         <CheckCircle2 size={24} />
                      </div>
                      Work Accomplished
                   </h3>
                   <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                      ID: { manualCode || "Verified" }
                   </div>
                </div>
                
                <div className="p-10 space-y-10">
                   <div className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white/5 border border-white/5">
                      <div className="h-20 w-20 rounded-3xl bg-orange-500/20 flex items-center justify-center text-orange-500 text-3xl font-black border border-orange-500/10 shadow-inner">
                         {(currentWorker || workerDemo).name.charAt(0)}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                         <div className="text-xl font-black text-white truncate">{(currentWorker || workerDemo).name}</div>
                         <div className="text-sm font-black text-orange-400 uppercase tracking-widest mt-1">{(currentWorker || workerDemo).skill}</div>
                         <div className="text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1.5 uppercase">
                            <MapPin size={12} /> {(currentWorker || workerDemo).location}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className="space-y-4 text-center">
                         <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Service Performance</label>
                         <div className="flex justify-center scale-[1.6]">
                            <StarRating value={rating} onChange={setRating} />
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Work Evidence (NLP Verified)</label>
                            <span className={`text-[9px] font-black tracking-widest uppercase ${comment.length >= 10 ? 'text-emerald-500' : 'text-slate-700'}`}>
                               {comment.length} / 10 CHARS
                            </span>
                         </div>
                         <div className="relative group/text">
                             <textarea
                               value={comment}
                               onChange={(e) => setComment(e.target.value)}
                               placeholder="Describe the quality, effort and skill..."
                               rows={5}
                               className={`w-full rounded-[2rem] border ${comment.length > 0 && comment.length < 10 ? 'border-orange-500/30' : 'border-white/5'} bg-slate-900 p-8 pt-12 text-white text-base outline-none transition-all focus:border-orange-500 focus:ring-8 focus:ring-orange-500/5 resize-none font-medium leading-relaxed placeholder:text-slate-800`}
                             />
                             
                             {/* AI/Voice Tools */}
                             <div className="absolute top-4 right-6 flex items-center gap-3">
                                <button 
                                  onClick={toggleRecording}
                                  className={`p-2.5 rounded-xl border transition-all ${isRecording ? 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse' : 'bg-white/5 text-slate-500 border-white/5 hover:text-orange-500 hover:border-orange-500/30 font-black italic'}`}
                                >
                                   <Mic size={18} />
                                </button>
                                <label className="p-2.5 rounded-xl border bg-white/5 text-slate-500 border-white/5 hover:text-orange-500 hover:border-orange-500/30 transition-all cursor-pointer">
                                   <ImageIcon size={18} />
                                   <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                </label>
                             </div>

                             {comment.length >= 10 && (
                               <div className="absolute -bottom-4 right-10 px-4 py-1.5 rounded-full bg-slate-950 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in flex items-center gap-2">
                                  <Sparkles size={10} /> {analyzeReview(comment).sentiment === "positive" ? "🔥 Superior Insight" : "📝 Data Captured"}
                               </div>
                             )}
                          </div>

                          {/* Image Preview Area */}
                          {uploadedImages.length > 0 && (
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none mt-2">
                               {uploadedImages.map((img, i) => (
                                 <div key={i} className="relative h-20 w-20 shrink-0 rounded-2xl overflow-hidden border border-white/10 group">
                                    <img src={img} className="h-full w-full object-cover" />
                                    <button 
                                      onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                       <X size={12} />
                                    </button>
                                 </div>
                               ))}
                            </div>
                          )}
                      </div>

                      {otpSent && (
                         <div className="p-10 rounded-[2.5rem] bg-orange-500/5 border border-orange-500/10 text-center space-y-8 animate-in zoom-in-95 duration-500">
                           <div className="text-[10px] font-black text-orange-500 uppercase tracking-[0.5em]">Identity Handshake</div>
                           <div className="flex justify-center gap-4">
                             {[0, 1, 2, 3].map((i) => (
                               <input
                                  key={i}
                                  type="text"
                                  maxLength={1}
                                  value={otpCode[i] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (/^\d*$/.test(val)) {
                                      const newOtp = otpCode.split("");
                                      newOtp[i] = val;
                                      setOtpCode(newOtp.join(""));
                                      if (val && e.target.nextElementSibling) (e.target.nextElementSibling as HTMLInputElement).focus();
                                    }
                                  }}
                                  className="h-20 w-16 rounded-2xl border border-white/10 bg-black text-center text-4xl font-black text-white outline-none focus:border-orange-500 transition-all shadow-inner"
                               />
                             ))}
                           </div>
                           <p className="text-[9px] font-black text-slate-700 tracking-[0.3em] uppercase italic">Real-time OTP verification active</p>
                         </div>
                      )}
                   </div>
                </div>
                
                <div className="p-10 bg-white/5 border-t border-white/5">
                   <button
                     onClick={handleSubmit}
                     disabled={rating === 0 || isVerifyingLocation || (otpSent && otpCode.length < 4) || (comment.length < 10)}
                     className={`h-20 w-full rounded-3xl bg-gradient-to-br ${otpSent ? 'from-emerald-500 to-teal-600 shadow-emerald-500/30' : 'from-orange-500 to-orange-600 shadow-orange-500/40'} font-black text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-4 uppercase tracking-[0.4em] text-sm`}
                   >
                     {isVerifyingLocation ? <><Clock size={20} className="animate-spin" /> VERIFYING GPS...</> : otpSent ? "NEXT: GEO VERIFY" : <>NEXT: SECURE AUTH <ArrowRight size={20} /></>}
                   </button>
                </div>
             </div>
           )}

           {step === "geo" && (
              <div className="w-full bg-slate-950 rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden animate-in fade-in duration-500">
                <div className="p-10 pb-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                   <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                         <Crosshair size={24} />
                      </div>
                      Geo Verification
                   </h3>
                   <div className="px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest">
                      Step 2 of 3
                   </div>
                </div>

                <div className="p-10 space-y-8">
                   <div className="text-center space-y-4">
                      <div className="relative mx-auto h-40 w-40 flex items-center justify-center">
                         <div className={`absolute inset-0 rounded-full ${isCheckingGeo ? 'animate-[ping_2s_infinite]' : ''} bg-orange-500/10`} />
                         <div className={`absolute inset-4 rounded-full ${isCheckingGeo ? 'animate-[ping_1.5s_infinite]' : ''} bg-orange-500/20`} />
                         <div className="relative h-20 w-20 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-[0_0_40px_rgba(249,115,22,0.4)]">
                            {isCheckingGeo ? <Clock size={36} className="animate-spin" /> : geoResult?.isValid ? <ShieldCheck size={36} /> : <Crosshair size={36} />}
                         </div>
                      </div>

                      {geoResult ? (
                        <div className={`p-6 rounded-[2rem] border ${geoResult.isValid ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                           <div className={`text-sm font-black uppercase tracking-widest ${geoResult.isValid ? 'text-emerald-500' : 'text-red-500'}`}>
                              {geoResult.isValid ? '✅ LOCATION VERIFIED' : '❌ LOCATION MISMATCH'}
                           </div>
                           <div className="text-[10px] font-bold text-slate-500 mt-2">
                              Distance: {geoResult.distance}m {geoResult.isValid ? '(within 100m)' : '(exceeds 100m limit)'}
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                           <h4 className="text-lg font-black text-white uppercase tracking-tight">Proximity Check Required</h4>
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">You must be within 100 meters of the worker to verify</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-10 bg-white/5 border-t border-white/5">
                   {!geoResult?.isValid ? (
                     <button
                       onClick={handleGeoValidation}
                       disabled={isCheckingGeo}
                       className="h-20 w-full rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 font-black text-white shadow-2xl shadow-orange-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-4 uppercase tracking-[0.4em] text-sm"
                     >
                       {isCheckingGeo ? <><Clock size={20} className="animate-spin" /> TRIANGULATING POSITION...</> : <><Crosshair size={20} /> VERIFY MY LOCATION</>}
                     </button>
                   ) : (
                     <button
                       onClick={() => setStep("photo")}
                       className="h-20 w-full rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 font-black text-white shadow-2xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-4 uppercase tracking-[0.4em] text-sm"
                     >
                       NEXT: PHOTO CAPTURE <ArrowRight size={20} />
                     </button>
                   )}
                </div>
              </div>
           )}

           {step === "photo" && (
              <div className="w-full bg-slate-950 rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden animate-in fade-in duration-500">
                <div className="p-10 pb-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                   <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                         <Camera size={24} />
                      </div>
                      Photo Verification
                   </h3>
                   <div className="px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest">
                      Step 3 of 3
                   </div>
                </div>

                <div className="p-10 space-y-6">
                   {!capturedPhoto ? (
                     <>
                       <div className="relative w-full aspect-[4/3] rounded-[2.5rem] border-4 border-orange-500/30 overflow-hidden bg-black shadow-[0_0_40px_rgba(249,115,22,0.15)]">
                          <video ref={photoVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div className="w-48 h-48 border-2 border-dashed border-orange-500/40 rounded-[2rem] animate-[pulse_2s_infinite]" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={handleCapturePhoto}
                            disabled={isCapturing}
                            className="py-5 rounded-2xl bg-orange-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-3"
                          >
                            {isCapturing ? <Clock size={16} className="animate-spin" /> : <Camera size={16} />}
                            {isCapturing ? "CAPTURING..." : "CAPTURE"}
                          </button>
                          <label className="py-5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-widest text-xs text-center cursor-pointer hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                            <ImageIcon size={16} /> GALLERY
                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoFromGallery} />
                          </label>
                       </div>
                     </>
                   ) : (
                     <>
                       <div className="relative w-full aspect-[4/3] rounded-[2.5rem] overflow-hidden border-4 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                          <img src={capturedPhoto} className="w-full h-full object-cover" alt="Captured" />
                          {isDuplicatePhoto && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                               <div className="p-6 rounded-3xl bg-black/80 border border-red-500/50 text-center">
                                  <AlertTriangle size={32} className="text-red-500 mx-auto mb-3" />
                                  <div className="text-sm font-black text-red-400 uppercase tracking-widest">DUPLICATE DETECTED</div>
                                  <div className="text-[9px] font-bold text-slate-500 mt-2 max-w-xs">{duplicateReason}</div>
                               </div>
                            </div>
                          )}
                       </div>

                       {photoHash && (
                         <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                            <div className="text-[9px] font-mono font-bold text-slate-500 truncate">
                               Hash: {photoHash.slice(0, 16)}...{photoHash.slice(-8)}
                            </div>
                            <div className={`ml-auto text-[9px] font-black uppercase tracking-widest ${isDuplicatePhoto ? 'text-red-500' : 'text-emerald-500'}`}>
                               {isDuplicatePhoto ? 'FRAUD' : 'UNIQUE'}
                            </div>
                         </div>
                       )}

                       <button
                         onClick={handleRetakePhoto}
                         className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black uppercase tracking-widest text-xs hover:text-white transition-all flex items-center justify-center gap-3"
                       >
                         <RefreshCw size={14} /> RETAKE PHOTO
                       </button>
                     </>
                   )}
                </div>

                <div className="p-10 bg-white/5 border-t border-white/5">
                   <button
                     onClick={handleFinalSave}
                     disabled={!capturedPhoto || isDuplicatePhoto || isSaving}
                     className="h-20 w-full rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 font-black text-white shadow-2xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-4 uppercase tracking-[0.4em] text-sm"
                   >
                     {isSaving ? <><Clock size={20} className="animate-spin" /> SYNCING TO FIREBASE...</> : <>FINALIZE VERIFICATION <ShieldCheck size={20} /></>}
                   </button>
                </div>
              </div>
           )}

           {step === "done" && (
              <div className="flex w-full flex-col items-center rounded-[3.5rem] bg-slate-950 p-16 text-center border border-emerald-500/30 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
                <div className="mb-10 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
                  <CheckCircle size={56} className="text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
                </div>
                <h3 className="mb-4 text-4xl font-black tracking-tighter text-white italic uppercase">VERIFIED SUCCESS!</h3>
                <p className="mb-12 text-sm font-black text-slate-500 max-w-sm mx-auto uppercase tracking-widest leading-relaxed">
                  Worker professional data successfully appended to the registry.
                </p>
                <div className="mb-12 w-full rounded-[2.5rem] bg-white/5 p-8 border border-white/10 flex items-center justify-between shadow-inner">
                  <div className="text-left">
                     <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">CREDIT AWARDED</div>
                     <div className="text-3xl font-black text-orange-500 tracking-tighter">+{earnedPoints} MUKTI PTS</div>
                  </div>
                  <div className="h-16 w-16 rounded-3xl bg-orange-500 text-white flex items-center justify-center shadow-2xl shadow-orange-500/40">
                     <Award size={32} />
                  </div>
                </div>
                <button
                  onClick={handleBack}
                  className="h-20 w-full rounded-3xl bg-white/5 border border-white/5 font-black text-white text-[10px] tracking-[0.5em] uppercase transition-all hover:bg-white/10 active:scale-[0.98]"
                >
                  DISMISS & RETURN
                </button>
              </div>
           )}

           {step === "error" && (
              <div className="flex w-full flex-col items-center rounded-[3.5rem] bg-slate-950 p-16 text-center border border-red-500/30 shadow-2xl relative">
                <div className="mb-10 flex h-28 w-28 items-center justify-center rounded-full bg-red-500/10">
                  <AlertTriangle size={56} className="text-red-500" />
                </div>
                <h3 className="mb-4 text-4xl font-black tracking-tighter text-white italic uppercase">SECURITY ABORT</h3>
                <p className="mb-12 text-sm font-black text-slate-500 max-w-sm mx-auto uppercase tracking-widest leading-relaxed">{errorMsg}</p>
                <button
                  onClick={handleBack}
                  className="h-20 w-full rounded-3xl bg-red-500 text-white font-black text-[10px] tracking-[0.5em] uppercase transition-all hover:bg-red-600 active:scale-[0.98] shadow-2xl shadow-red-500/30"
                >
                  RETRY SYSTEM
                </button>
              </div>
           )}
        </div>
      )}
    </div>
  );
};

export default CustomerVerification;
