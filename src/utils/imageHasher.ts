/**
 * Image Hasher & Duplicate Detector
 * Generates SHA-256 hash of image data and checks for duplicates in Firestore.
 */

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ImageHashResult {
  hash: string;
  isDuplicate: boolean;
  fraudFlag: boolean;
  fraudReason: string;
}

/**
 * Generate a SHA-256 hash from a base64 image string.
 * Strips the data URI prefix before hashing to ensure consistency.
 */
export const hashImage = async (base64Image: string): Promise<string> => {
  // Strip data URI prefix (e.g., "data:image/jpeg;base64,")
  const rawData = base64Image.includes(",")
    ? base64Image.split(",")[1]
    : base64Image;

  const encoder = new TextEncoder();
  const data = encoder.encode(rawData);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
};

/**
 * Check if the same imageHash already exists in Firestore verifications.
 * Returns fraud info if a duplicate is found.
 */
export const checkDuplicate = async (
  imageHash: string,
  workerId: string
): Promise<ImageHashResult> => {
  try {
    const q = query(
      collection(db, "verifications"),
      where("imageHash", "==", imageHash)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      return {
        hash: imageHash,
        isDuplicate: true,
        fraudFlag: true,
        fraudReason: "Duplicate image detected — this photo was already used in a previous verification.",
      };
    }

    return {
      hash: imageHash,
      isDuplicate: false,
      fraudFlag: false,
      fraudReason: "",
    };
  } catch (err) {
    console.error("Duplicate check failed:", err);
    // Non-blocking — allow verification to proceed if check fails
    return {
      hash: imageHash,
      isDuplicate: false,
      fraudFlag: false,
      fraudReason: "",
    };
  }
};

/**
 * Captures a photo from a video element (camera stream).
 * Returns the image as a base64 data URL.
 */
export const captureFromVideo = (video: HTMLVideoElement): string | null => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
};
