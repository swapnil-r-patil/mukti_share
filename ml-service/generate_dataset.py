import pandas as pd
import random
import uuid

def generate_sample_data(n=100):
    data = []
    for _ in range(n):
        worker_id = f"worker_{random.randint(1, 10)}"
        customer_id = f"customer_{random.randint(1, 50)}"
        device_id = f"device_{random.randint(1, 40)}"
        
        # Features
        same_employer_count = random.randint(1, 5)
        location_variance = random.uniform(0, 500) # meters
        time_gap = random.randint(1, 3600*24*7) # seconds since last
        rating = random.randint(1, 5)
        
        # Target: Fraud (Simple rule-based for sample)
        is_fraud = 0
        if same_employer_count > 3 and location_variance < 10:
            is_fraud = 1
        if device_id == "device_99": # specific flag
            is_fraud = 1
            
        data.append({
            "worker_id": worker_id,
            "customer_id": customer_id,
            "device_id": device_id,
            "same_employer_count": same_employer_count,
            "location_variance": location_variance,
            "time_gap": time_gap,
            "rating": rating,
            "is_fraud": is_fraud
        })
    
    df = pd.DataFrame(data)
    df.to_csv("sample_ml_dataset.csv", index=False)
    print("Generated sample_ml_dataset.csv with 100 rows.")

if __name__ == "__main__":
    generate_sample_data()
