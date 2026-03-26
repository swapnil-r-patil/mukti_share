from flask import Flask, request, jsonify
from flask_cors import CORS
from textblob import TextBlob
import random

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "Mukti-ML"})

@app.route('/fraud-detect', methods=['POST'])
def fraud_detect():
    data = request.json
    # Placeholder Logic: Supervised Model Features
    # In a real app, this would use job_lib over a trained scikit-learn model
    
    # Simple logic for now:
    score = random.uniform(0, 1)
    risk = "LOW"
    if score > 0.8: risk = "HIGH"
    elif score > 0.5: risk = "MEDIUM"
    
    return jsonify({
        "risk_score": score,
        "fraud_risk": risk,
        "features_analyzed": list(data.keys())
    })

@app.route('/nlp-analyze', methods=['POST'])
def nlp_analyze():
    data = request.json
    review_text = data.get("text", "")
    
    analysis = TextBlob(review_text)
    sentiment = analysis.sentiment.polarity # -1 to 1
    
    # Skill extraction logic
    skills_map = ["plumbing", "cleaning", "electrician", "carpenter"]
    found_skills = [s for s in skills_map if s in review_text.lower()]
    
    return jsonify({
        "sentiment": sentiment,
        "sentiment_label": "POSITIVE" if sentiment > 0.1 else "NEGATIVE" if sentiment < -0.1 else "NEUTRAL",
        "extracted_skills": found_skills,
        "review_quality": len(review_text) / 100 # Mock quality based on length
    })

if __name__ == '__main__':
    app.run(port=5001, debug=True)
