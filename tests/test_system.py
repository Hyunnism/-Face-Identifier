import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import numpy as np
from src import database, face_engine
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)

def run_tests():
    print("=== 1. Testing Database & Matching Logic ===")
    database.init_db()
    
    initial_mat, _ = database.load_all_embeddings(use_cache=False)
    initial_count = initial_mat.shape[0]

    emb1 = np.random.randn(512).astype(np.float32)
    emb1 = emb1 / np.linalg.norm(emb1)
    
    emb2 = np.random.randn(512).astype(np.float32)
    emb2 = emb2 / np.linalg.norm(emb2)

    p1_id = database.save_person("TEST-01", "Budi Santoso", "Engineering", [("front", emb1)])
    p2_id = database.save_person("TEST-02", "Siti Rahma", "Finance", [("single_photo", emb2)])
    print(f"Saved test people with IDs: {p1_id}, {p2_id}")

    mat, records = database.load_all_embeddings(use_cache=False)
    assert mat.shape[0] == initial_count + 2, f"Expected {initial_count + 2}, got {mat.shape[0]}"
    print("Database matrix load: PASSED")

    matched, score, status = face_engine.match_face(emb1, mat, records, threshold=0.45)
    assert matched is not None and matched["code"] == "TEST-01", f"Match failed: {matched}"
    assert score > 0.99, f"Expected score > 0.99, got {score}"
    assert status == "MATCH", f"Expected MATCH, got {status}"
    print(f"Exact match test: PASSED (score={score:.4f}, person={matched['name']})")

    random_emb = np.random.randn(512).astype(np.float32)
    random_emb = random_emb / np.linalg.norm(random_emb)
    unmatched, score_u, status_u = face_engine.match_face(random_emb, mat, records, threshold=0.45)
    assert unmatched is None or status_u == "UNKNOWN", f"Expected UNKNOWN, got {status_u}"
    print(f"Non-matching rejection test: PASSED (score={score_u:.4f}, status={status_u})")

    print("\n=== 2. Testing FastAPI Endpoints ===")
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200, f"Expected 200, got {health_resp.status_code}"
    assert health_resp.json()["status"] == "healthy"
    print("GET /api/health: PASSED")

    resp = client.get("/api/people")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert "people" in data
    print(f"GET /api/people: PASSED (found {len(data['people'])} people)")

    del_resp = client.delete(f"/api/people/{p1_id}")
    assert del_resp.status_code == 200
    del_resp2 = client.delete(f"/api/people/{p2_id}")
    assert del_resp2.status_code == 200
    print("DELETE /api/people/{id}: PASSED")

    mat_after, records_after = database.load_all_embeddings(use_cache=False)
    assert mat_after.shape[0] == initial_count, f"Expected {initial_count} after delete, got {mat_after.shape[0]}"
    print("Database cleanup: PASSED")

    print("\n=== 3. Testing InsightFace Engine Initialization ===")
    app_engine = face_engine.get_face_app()
    assert app_engine is not None
    print("InsightFace buffalo_l engine: PASSED")

    print("\nALL AUTOMATED TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
