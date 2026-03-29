# Mukti-Portal
**A trust-building system for informal workers that converts daily work into a verified digital identity.**

👉 *Not just a platform*  
👉 *It’s a Trust Infrastructure*

🎯 **ONE-LINE WORKFLOW:**
> "Workers generate proof, customers validate it, and our system transforms it into a trusted digital identity."

---

## 🔁 🔥 COMPLETE WORKFLOW

### 1. Worker Onboarding 👷
- Worker registers using a mobile number.
- Profile includes: Skill (plumber, maid, etc.) and Location.
- **System creates a Digital Worker Identity.**

### 2. Worker Dashboard 📊
- Worker sees: Total verified jobs, Trust score, and Monthly activity.
- 👉 **This is their digital work reputation.**

### 3. Job Completion → Proof Creation 🔳
- After completing a job: Worker generates a time-bound QR.
- 👉 **This QR = "Proof request for this specific job."**

### 4. Customer Interaction (Key Step) 👤
- Customer logs in and scans the QR.
- *Customer does NOT generate anything.*
- 👉 **Only action:** Confirm job & Give rating.

### 5. Trust Validation Layer 🛡️
- System verifies:
  - Role = Customer ✅
  - Not same as worker ✅
  - QR valid (time-limited) ✅
- 👉 **Prevents:** Fake entries & Self-verification.

### 6. Data Conversion Engine 📊
- Every verified job becomes:
  - Work entry
  - Timestamped record
  - Trust signal
- 👉 **System builds:** Work consistency, Customer reliability, and Rating patterns.

### 7. Trust Score Generation 🧠
- System calculates: Job frequency, Rating stability, and Repeat customers.
- 👉 **Output: Dynamic Trust Score.**
- *"Not just how much you work, but how reliably you work."*

### 8. Credit-Ready Output 📄
- System generates a 👉 **Digital Work Report**:
  - Verified job history
  - Monthly trends
  - Trust score
  - Estimated income

### 9. Real-World Use 🏦
- Banks / lenders can use this as an **Alternative credit proof**.
- Worker becomes: **Financially visible**.

---

## 🧠 SYSTEM ARCHITECTURE

👉 **Three Core Layers:**

1. **Identity Layer**
   - Worker profile
   - Customer profile
2. **Verification Layer**
   - QR-based job confirmation
   - Role-based validation
3. **Trust Layer (Most Important)**
   - Converts raw data → meaningful insights
   - Generates: Trust score, Work history

---

## 🔥 WHAT MAKES THIS INNOVATIVE

👉 **"We are not just storing data, we are creating trust signals."**  
👉 **"We convert informal activity into structured financial identity."**  
👉 **"This is an alternative credit infrastructure."**  

---

## 🏆 FINAL IMPACT STATEMENT
> "Mukti-Portal bridges the gap between informal work and formal financial systems by turning everyday labor into verifiable, trustable digital records."

---

## 🛠️ TECHNOLOGY STACK

### 🌐 Frontend (User Interface)
- **React (TypeScript)**: Core framework for the dynamic dashboard.
- **Tailwind CSS**: Modern, utility-first styling.
- **Radix UI / Shadcn**: Professional UI components (Dialogs, Tabs, Toasts).
- **TanStack Query (React Query)**: Efficient data fetching and real-time sync.
- **Leaflet**: Interactive maps for location tracking.
- **Recharts**: Data visualization and analytics dashboards.
- **Framer Motion**: Smooth micro-animations and transitions.
- **QR Code System**: Secure identity verification via `qrcode.react` and `jsqr`.

### ⚙️ Backend (API & Logic)
- **Node.js & Express**: Server-side runtime and web framework.
- **TypeScript**: Shared type safety across the entire stack.
- **Firebase Admin SDK**: Secure server-side database and auth management.
- **PDFKit**: Automated generation of verified work reports.

### 🗄️ Database & Security
- **Firebase Firestore**: Real-time NoSQL database.
- **Firebase Auth**: Secure Email/Password and Google authentication.
- **Firebase Storage**: Hosting for documents and profile media.
- **Zod**: Strict schema validation for data integrity.

### 🤖 Machine Learning (ML) Service
- **Python (Flask)**: Microservice for intelligent processing.
- **NLP (Natural Language Processing)**: Sentiment analysis and skill extraction via `TextBlob`.
- **Fraud Detection**: Risk scoring engine to identify suspicious patterns.

---

## 🚀 Getting Started

To run the project locally:

1. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Environment Variables**:
   Create a `.env` file in the root and `/backend` directories using the provided `.env.example` templates.

3. **Start Development Servers**:
   ```bash
   # Run both frontend and backend
   npm run dev:all
   ```
