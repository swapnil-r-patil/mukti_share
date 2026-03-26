import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, query, where, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDBOpcXT1RtUP6c9fhVIlhpyjaLvAODRa8",
  authDomain: "muktitech-v1.firebaseapp.com",
  projectId: "muktitech-v1",
  storageBucket: "muktitech-v1.firebasestorage.app",
  messagingSenderId: "972165187376",
  appId: "1:972165187376:web:ec94e15dc8f8a456b6eaf5",
};

async function purge() {
  console.log("🚀 Starting database purge script...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  try {
    // 1. Delete verification_requests
    const vReqSnap = await getDocs(collection(db, "verification_requests"));
    if (vReqSnap.size > 0) {
        const batch1 = writeBatch(db);
        vReqSnap.forEach(d => batch1.delete(d.ref));
        await batch1.commit();
        console.log(`✅ Deleted ${vReqSnap.size} verification requests.`);
    } else {
        console.log("No verification requests found.");
    }

    // 2. Delete worker users
    const q = query(collection(db, "users"), where("role", "==", "worker"));
    const userSnap = await getDocs(q);
    if (userSnap.size > 0) {
        const batch2 = writeBatch(db);
        userSnap.docs.forEach(d => batch2.delete(d.ref));
        await batch2.commit();
        console.log(`✅ Deleted ${userSnap.size} worker accounts.`);
    } else {
        console.log("No worker users found.");
    }

    // 3. Delete specific user from screenshot if still exists
    const targetId = "BWUNgOwrtnbRsc4FKzOBioK031X2";
    const targetSnap = await getDocs(query(collection(db, "users"), where("id", "==", targetId))); // In case it's id field
    const batch3 = writeBatch(db);
    targetSnap.forEach(d => batch3.delete(d.ref));
    await batch3.commit();
    
    console.log("🎉 DESTRUCTION COMPLETE.");
  } catch (err) {
    console.error("❌ Purge FAILED:", err.message);
    if (err.message.includes("permission-denied")) {
        console.error("PERMISSION DENIED: The database is protected by security rules. I need an authenticated session.");
    }
  }
}

purge();
