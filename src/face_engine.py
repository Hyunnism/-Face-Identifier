import os
import sys
import warnings

# Suppress TensorFlow and C++ internal logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["GLOG_minloglevel"] = "3"
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

# ponytail: InsightFace buffalo_l with CPUExecutionProvider and allowed_modules=['detection', 'recognition']
# skips gender/age and 106-point landmarks, cutting CPU inference time by over 50%.
# det_size=(320, 320) delivers rapid ~20-40ms detection on standard CPUs.

_face_app = None

def get_face_app():
    global _face_app
    if _face_app is None:
        import insightface
        from insightface.app import FaceAnalysis

        # Only load detection (SCRFD) and recognition (ArcFace)
        app = FaceAnalysis(
            name='buffalo_l',
            providers=['CPUExecutionProvider'],
            allowed_modules=['detection', 'recognition']
        )
        # det_size=(320, 320) is optimal for high FPS CPU face detection
        app.prepare(ctx_id=-1, det_size=(320, 320))
        _face_app = app
    return _face_app

def extract_faces(img_bgr: np.ndarray) -> List[Dict[str, Any]]:
    """
    Detects faces and extracts 512-d normalized embeddings.
    """
    app = get_face_app()
    faces = app.get(img_bgr)
    results = []
    for face in faces:
        bbox = [int(x) for x in face.bbox]
        emb = face.embedding.astype(np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
            
        results.append({
            "bbox": bbox, # [x1, y1, x2, y2]
            "score": float(face.det_score),
            "embedding": emb,
            "kps": face.kps.tolist() if hasattr(face, 'kps') and face.kps is not None else None
        })
    return results

def match_face(
    query_embedding: np.ndarray,
    db_embeddings: np.ndarray,
    db_records: List[Dict[str, Any]],
    threshold: float = 0.45
) -> Tuple[Optional[Dict[str, Any]], float, str]:
    """
    Performs 1:N Cosine Similarity matching via dot product.
    Returns: (matched_person_record or None, similarity_score, status)
    status: 'MATCH', 'AMBIGUOUS', or 'UNKNOWN'
    """
    if db_embeddings.shape[0] == 0:
        return None, 0.0, "UNKNOWN"

    query_norm = np.linalg.norm(query_embedding)
    if query_norm > 0:
        q_emb = (query_embedding / query_norm).astype(np.float32)
    else:
        return None, 0.0, "UNKNOWN"

    sims = np.dot(db_embeddings, q_emb)
    best_idx = int(np.argmax(sims))
    best_score = float(sims[best_idx])

    if best_score < threshold:
        return None, best_score, "UNKNOWN"

    # Ambiguity check
    best_person_id = db_records[best_idx]["person_id"]
    diff_person_scores = [
        float(sims[i]) for i, r in enumerate(db_records)
        if r["person_id"] != best_person_id
    ]

    is_ambiguous = False
    if diff_person_scores:
        second_best = max(diff_person_scores)
        if (best_score - second_best) < 0.04:
            is_ambiguous = True

    status = "AMBIGUOUS" if is_ambiguous else "MATCH"
    return db_records[best_idx], best_score, status

def check_image_quality(img_bgr: np.ndarray, bbox: Optional[List[int]] = None) -> Dict[str, Any]:
    """
    Checks brightness and sharpness (Laplacian variance).
    """
    if bbox is not None:
        h, w = img_bgr.shape[:2]
        x1, y1, x2, y2 = bbox
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        crop = img_bgr[y1:y2, x1:x2]
        target = crop if crop.size > 0 else img_bgr
    else:
        target = img_bgr

    gray = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    is_bright_ok = 50 <= brightness <= 235
    is_sharp_ok = sharpness >= 60.0
    is_ok = is_bright_ok and is_sharp_ok

    msg = "OK"
    if not is_bright_ok:
        msg = "Pencahayaan kurang" if brightness < 50 else "Pencahayaan terlalu terang"
    elif not is_sharp_ok:
        msg = "Gambar buram / tidak fokus"

    return {
        "is_ok": is_ok,
        "brightness": round(brightness, 1),
        "sharpness": round(sharpness, 1),
        "message": msg
    }

# MediaPipe FaceMesh Liveness Helper
_mp_face_mesh = None
_mp_load_attempted = False

def get_mediapipe_mesh():
    global _mp_face_mesh, _mp_load_attempted
    if not _mp_load_attempted:
        _mp_load_attempted = True
        try:
            import mediapipe as mp
            if hasattr(mp, 'solutions') and hasattr(mp.solutions, 'face_mesh'):
                _mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
        except Exception:
            _mp_face_mesh = None
    return _mp_face_mesh

def check_head_pose_and_ear(img_rgb: np.ndarray) -> Dict[str, Any]:
    """
    Computes Eye Aspect Ratio (EAR) and head direction ('FRONT', 'LEFT', 'RIGHT').
    Falls back to InsightFace 5-landmarks (SCRFD kps) if needed.
    """
    mesh = get_mediapipe_mesh()
    if mesh is not None:
        try:
            results = mesh.process(img_rgb)
            if results.multi_face_landmarks:
                landmarks = results.multi_face_landmarks[0].landmark

                nose_x = landmarks[1].x
                left_cheek_x = landmarks[234].x
                right_cheek_x = landmarks[454].x
                span = right_cheek_x - left_cheek_x

                if span != 0:
                    ratio = (nose_x - left_cheek_x) / span
                    if ratio < 0.38:
                        pose = "RIGHT"
                    elif ratio > 0.62:
                        pose = "LEFT"
                    else:
                        pose = "FRONT"
                else:
                    pose = "FRONT"

                def calc_ear(p1, p2, p3, p4, p5, p6):
                    def dist(a, b):
                        return np.hypot(a.x - b.x, a.y - b.y)
                    return (dist(p2, p6) + dist(p3, p5)) / (2.0 * dist(p1, p4) + 1e-6)

                left_ear = calc_ear(landmarks[33], landmarks[160], landmarks[158], landmarks[133], landmarks[153], landmarks[144])
                right_ear = calc_ear(landmarks[362], landmarks[385], landmarks[387], landmarks[263], landmarks[373], landmarks[380])
                avg_ear = float((left_ear + right_ear) / 2.0)

                return {
                    "detected": True,
                    "pose": pose,
                    "ear": round(avg_ear, 3),
                    "blink": avg_ear < 0.20
                }
        except Exception:
            pass

    # Fallback to InsightFace SCRFD landmarks
    try:
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        faces = extract_faces(img_bgr)
        if faces and faces[0].get("kps"):
            kps = faces[0]["kps"]
            left_eye_x = kps[0][0]
            right_eye_x = kps[1][0]
            nose_x = kps[2][0]
            span = right_eye_x - left_eye_x
            if span != 0:
                ratio = (nose_x - left_eye_x) / span
                if ratio < 0.35:
                    pose = "RIGHT"
                elif ratio > 0.65:
                    pose = "LEFT"
                else:
                    pose = "FRONT"
            else:
                pose = "FRONT"

            return {
                "detected": True,
                "pose": pose,
                "ear": 0.25,
                "blink": False
            }
    except Exception:
        pass

    return {"detected": False, "pose": "NONE", "ear": 0.0, "blink": False}
