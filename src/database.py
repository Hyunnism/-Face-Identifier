import os
import sqlite3
import numpy as np
from pathlib import Path
from contextlib import contextmanager
from typing import List, Tuple, Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = os.environ.get("DATABASE_PATH", str(DATA_DIR / "face_system.db"))

# In-memory cache for fast 1:N real-time matching
_cached_matrix: Optional[np.ndarray] = None
_cached_records: Optional[List[Dict[str, Any]]] = None

def invalidate_cache():
    global _cached_matrix, _cached_records
    _cached_matrix = None
    _cached_records = None

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                department TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS face_embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                person_id INTEGER NOT NULL,
                pose TEXT NOT NULL,
                embedding BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
            )
        """)
    invalidate_cache()

def save_person(code: str, name: str, department: str, embeddings: List[Tuple[str, np.ndarray]]) -> int:
    with get_db() as conn:
        row = conn.execute("SELECT id FROM people WHERE code = ?", (code,)).fetchone()
        if row:
            person_id = row["id"]
            conn.execute(
                "UPDATE people SET name = ?, department = ? WHERE id = ?",
                (name, department, person_id)
            )
        else:
            cur = conn.execute(
                "INSERT INTO people (code, name, department) VALUES (?, ?, ?)",
                (code, name, department)
            )
            person_id = cur.lastrowid

        for pose, emb in embeddings:
            emb_f32 = np.asarray(emb, dtype=np.float32)
            blob = emb_f32.tobytes()
            conn.execute(
                "INSERT INTO face_embeddings (person_id, pose, embedding) VALUES (?, ?, ?)",
                (person_id, pose, blob)
            )
    invalidate_cache()
    return person_id

def load_all_embeddings(use_cache: bool = True) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Loads all embeddings. If use_cache is True, serves from RAM in microseconds.
    """
    global _cached_matrix, _cached_records
    if use_cache and _cached_matrix is not None and _cached_records is not None:
        return _cached_matrix, _cached_records

    with get_db() as conn:
        rows = conn.execute("""
            SELECT fe.id as emb_id, fe.person_id, fe.pose, fe.embedding,
                   p.code, p.name, p.department
            FROM face_embeddings fe
            JOIN people p ON fe.person_id = p.id
        """).fetchall()

    if not rows:
        _cached_matrix = np.empty((0, 512), dtype=np.float32)
        _cached_records = []
        return _cached_matrix, _cached_records

    records = []
    vectors = []
    for r in rows:
        vec = np.frombuffer(r["embedding"], dtype=np.float32)
        if vec.shape[0] == 512:
            vectors.append(vec)
            records.append({
                "emb_id": r["emb_id"],
                "person_id": r["person_id"],
                "pose": r["pose"],
                "code": r["code"],
                "name": r["name"],
                "department": r["department"]
            })

    if not vectors:
        _cached_matrix = np.empty((0, 512), dtype=np.float32)
        _cached_records = []
    else:
        _cached_matrix = np.vstack(vectors)
        _cached_records = records

    return _cached_matrix, _cached_records

def get_people() -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT p.id, p.code, p.name, p.department, p.created_at,
                   COUNT(fe.id) as sample_count
            FROM people p
            LEFT JOIN face_embeddings fe ON p.id = fe.person_id
            GROUP BY p.id
            ORDER BY p.id DESC
        """).fetchall()
        return [dict(r) for r in rows]

def delete_person(person_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM people WHERE id = ?", (person_id,))
        success = cur.rowcount > 0
    if success:
        invalidate_cache()
    return success
