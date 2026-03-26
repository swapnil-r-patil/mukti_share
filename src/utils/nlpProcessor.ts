export interface NLPResult {
  sentiment: "positive" | "negative" | "neutral";
  skills: string[];
  issues: string[];
  quality: "high" | "low";
}

const POSITIVE_WORDS = ["good", "great", "excellent", "professional", "polite", "helpful", "fast", "on time", "skilled", "brilliant", "expert", "diligent", "clean", "trustworthy"];
const NEGATIVE_WORDS = ["bad", "rude", "late", "unprofessional", "expensive", "issue", "problem", "missed", "slow", "lazy", "broken", "dirty", "overpriced"];
const SKILL_KEYWORDS = ["cleaning", "plumbing", "electrician", "cooking", "repair", "painting", "carpentry", "fixing", "wiring", "installation"];
const ISSUE_KEYWORDS = ["late", "rude", "no-show", "broken", "dirty", "unfriendly", "damaged", "stains", "leak"];

export const analyzeReview = (text: string): NLPResult => {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  // Sentiment
  let posCount = 0;
  let negCount = 0;
  POSITIVE_WORDS.forEach(w => { if (lowerText.includes(w)) posCount++; });
  NEGATIVE_WORDS.forEach(w => { if (lowerText.includes(w)) negCount++; });
  
  const sentiment = posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral";
  
  // Skills & Issues
  const skills = SKILL_KEYWORDS.filter(s => lowerText.includes(s));
  const issues = ISSUE_KEYWORDS.filter(i => lowerText.includes(i));
  
  // Quality Detection
  // High quality if text is long enough AND has diverse sentiment/keywords
  const uniqueWords = new Set(words).size;
  const hasSubstance = text.length > 40 && uniqueWords > 8;
  const quality = hasSubstance ? "high" : "low";
  
  return { sentiment, skills, issues, quality };
};
