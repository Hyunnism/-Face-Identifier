import os
import sys
import logging
import warnings
import base64
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Suppress noisy logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["GLOG_minloglevel"] = "3"
warnings.filterwarnings("ignore")

# Custom log filter to silence high-frequency polling endpoint (/api/quality-check)
class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "/api/quality-check" not in msg

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

from . import database
from . import face_engine

# Initialize database
database.init_db()

app = FastAPI(title="VisionCore Face Recognition System", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "face-identifier",
        "model": "buffalo_l",
        "version": "1.1.0"
    }

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

def decode_base64_image(b64_str: str) -> np.ndarray:
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Gagal membaca citra dari base64")
    return img

def decode_upload_file(file_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Format berkas citra tidak valid")
    return img

# ---------------- API ENDPOINTS ----------------

@app.get("/api/people")
def get_people():
    return {"people": database.get_people()}

@app.delete("/api/people/{person_id}")
def delete_person(person_id: int):
    success = database.delete_person(person_id)
    if not success:
        raise HTTPException(status_code=404, detail="Orang tidak ditemukan")
    return {"success": True, "message": "Data berhasil dihapus"}

@app.post("/api/register/photo")
async def register_photo(
    name: str = Form(...),
    code: str = Form(...),
    department: str = Form(""),
    file: UploadFile = File(...)
):
    content = await file.read()
    try:
        img = decode_upload_file(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    faces = face_engine.extract_faces(img)
    if not faces:
        raise HTTPException(status_code=400, detail="Tidak ada wajah yang terdeteksi dalam foto. Pastikan wajah tampak jelas dan pencahayaan cukup.")

    best_face = max(faces, key=lambda f: (f["bbox"][2]-f["bbox"][0])*(f["bbox"][3]-f["bbox"][1]))
    embeddings = [("single_photo", best_face["embedding"])]

    person_id = database.save_person(
        code=code.strip(),
        name=name.strip(),
        department=department.strip(),
        embeddings=embeddings
    )

    return {
        "success": True,
        "person_id": person_id,
        "name": name,
        "code": code,
        "message": f"Wajah {name} berhasil didaftarkan!"
    }

class WebcamRegisterPayload(BaseModel):
    name: str
    code: str
    department: str = ""
    poses: Dict[str, str]

@app.post("/api/register/webcam")
def register_webcam(payload: WebcamRegisterPayload):
    if not payload.poses:
        raise HTTPException(status_code=400, detail="Tidak ada data gambar yang dikirim")

    embeddings = []
    saved_poses = []

    for pose_name, b64_str in payload.poses.items():
        try:
            img = decode_base64_image(b64_str)
            faces = face_engine.extract_faces(img)
            if faces:
                best_face = max(faces, key=lambda f: (f["bbox"][2]-f["bbox"][0])*(f["bbox"][3]-f["bbox"][1]))
                embeddings.append((pose_name, best_face["embedding"]))
                saved_poses.append(pose_name)
        except Exception:
            continue

    if not embeddings:
        raise HTTPException(status_code=400, detail="Tidak ada wajah valid yang berhasil diekstrak dari gambar webcam.")

    person_id = database.save_person(
        code=payload.code.strip(),
        name=payload.name.strip(),
        department=payload.department.strip(),
        embeddings=embeddings
    )

    return {
        "success": True,
        "person_id": person_id,
        "saved_poses": saved_poses,
        "message": f"Wajah {payload.name} berhasil didaftarkan dengan {len(saved_poses)} pose!"
    }

class IdentifyPayload(BaseModel):
    image: str
    threshold: float = 0.45

@app.post("/api/identify")
def identify_face(payload: IdentifyPayload):
    try:
        img = decode_base64_image(payload.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal memproses gambar: {str(e)}")

    faces = face_engine.extract_faces(img)
    if not faces:
        return {"faces": [], "message": "Tidak ada wajah terdeteksi"}

    # Use in-memory cached database matrix (ultra-fast)
    db_matrix, db_records = database.load_all_embeddings(use_cache=True)

    results = []
    for face in faces:
        bbox = face["bbox"]
        matched, score, status = face_engine.match_face(
            face["embedding"],
            db_matrix,
            db_records,
            threshold=payload.threshold
        )

        face_result = {
            "bbox": bbox,
            "score": round(score * 100, 1),
            "status": status,
        }

        if matched and status in ["MATCH", "AMBIGUOUS"]:
            face_result["person"] = {
                "id": matched["person_id"],
                "code": matched["code"],
                "name": matched["name"],
                "department": matched["department"],
                "matched_pose": matched["pose"]
            }
        else:
            face_result["person"] = None

        results.append(face_result)

    return {"faces": results, "total_faces": len(results)}

@app.post("/api/identify/photo")
async def identify_uploaded_photo(
    file: UploadFile = File(...),
    threshold: float = Form(0.45)
):
    content = await file.read()
    try:
        img = decode_upload_file(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    faces = face_engine.extract_faces(img)
    if not faces:
        return {"faces": [], "message": "Tidak ada wajah terdeteksi dalam foto."}

    db_matrix, db_records = database.load_all_embeddings(use_cache=True)

    results = []
    for face in faces:
        bbox = face["bbox"]
        matched, score, status = face_engine.match_face(
            face["embedding"],
            db_matrix,
            db_records,
            threshold=threshold
        )
        face_result = {
            "bbox": bbox,
            "score": round(score * 100, 1),
            "status": status,
        }
        if matched and status in ["MATCH", "AMBIGUOUS"]:
            face_result["person"] = {
                "id": matched["person_id"],
                "code": matched["code"],
                "name": matched["name"],
                "department": matched["department"],
                "matched_pose": matched["pose"]
            }
        else:
            face_result["person"] = None
        results.append(face_result)

    return {"faces": results, "total_faces": len(results)}

class QualityCheckPayload(BaseModel):
    image: str

@app.post("/api/quality-check")
def quality_check(payload: QualityCheckPayload):
    try:
        img_bgr = decode_base64_image(payload.image)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    except Exception:
        return {"detected": False, "is_ok": False, "message": "Gagal membaca frame"}

    quality = face_engine.check_image_quality(img_bgr)
    liveness = face_engine.check_head_pose_and_ear(img_rgb)

    return {
        "quality": quality,
        "liveness": liveness
    }

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def index():
    return FileResponse(str(STATIC_DIR / "index.html"))
