from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from cryptography.fernet import Fernet
import uuid
import os
import time
import hashlib
import base64
import random
import re
from collections import Counter
from database import get_connection, init_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

STORAGE_DIR = "storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

init_db()

def derive_fernet_key(secret_key: str) -> bytes:
    digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def generate_ai_caption(filename: str, file_data: bytes) -> str:
    # Try to extract actual keywords from the file content if it's text
    try:
        text = file_data[:5000].decode('utf-8')
        words = re.findall(r'\b[A-Za-z]{5,}\b', text)
        if len(words) > 5:
            words = [w.upper() for w in words]
            common = [w[0] for w in Counter(words).most_common(10)]
            # Pick top 3-4 keywords
            keywords = ", ".join(common[:4])
            return f"FILE CONTEXT: {keywords}"
    except Exception:
        pass # Fall back to filename if not valid text or binary
        
    # Fallback to filename based keywords
    name_parts = re.findall(r'[A-Za-z]{3,}', filename.split('.')[0])
    if name_parts:
        keywords = ", ".join(p.upper() for p in name_parts[:3])
        return f"FILE TYPE: {keywords}"
        
    ext = filename.split('.')[-1].upper() if '.' in filename else 'DATA'
    return f"FILE TYPE: {ext}_PAYLOAD"

@app.post("/login")
async def login(username: str = Form(...), secret_key: str = Form(...)):
    key_hash = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key_hash FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Username not found")
    if row[0] != key_hash:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid Master Secret Key")
    conn.close()
    return {"message": "Success", "username": username}

@app.post("/signup")
async def signup(
    username: str = Form(...), 
    secret_key: str = Form(...),
    security_answer: str = Form(...)
):
    key_hash = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
    answer_hash = hashlib.sha256(security_answer.lower().strip().encode("utf-8")).hexdigest()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Username already registered")
        
    cursor.execute(
        "INSERT INTO users (username, key_hash, security_answer_hash) VALUES (?, ?, ?)", 
        (username, key_hash, answer_hash)
    )
    conn.commit()
    conn.close()
    return {"message": "User created successfully", "username": username}

@app.post("/forgot-password")
async def forgot_password(
    username: str = Form(...),
    security_answer: str = Form(...),
    new_secret_key: str = Form(...)
):
    answer_hash = hashlib.sha256(security_answer.lower().strip().encode("utf-8")).hexdigest()
    new_key_hash = hashlib.sha256(new_secret_key.encode("utf-8")).hexdigest()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT security_answer_hash FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Username not found")
        
    if row[0] != answer_hash:
        conn.close()
        raise HTTPException(status_code=401, detail="Incorrect security answer")
        
    cursor.execute("UPDATE users SET key_hash = ? WHERE username = ?", (new_key_hash, username))
    conn.commit()
    conn.close()
    return {"message": "Master Key reset successfully. Old files are now permanently locked."}

@app.post("/upload")
async def upload_file(
    file_path: str = Form(...),
    expires_in_secs: int = Form(...),
    username: str = Form(...),
    secret_key: str = Form(...)
):
    # Strip surrounding quotes from Windows "Copy as path"
    file_path = file_path.strip().strip('"').strip("'")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"Local file not found exactly at: {file_path}")
        
    if os.path.isdir(file_path):
        raise HTTPException(status_code=400, detail="You entered a folder path. Please explicitly select a single file (like document.txt).")
        
    filename = os.path.basename(file_path)
    file_id = str(uuid.uuid4())
    filepath = os.path.join(STORAGE_DIR, f"{file_id}.enc")
    
    with open(file_path, "rb") as f:
        file_data = f.read()
    
    fernet_key = derive_fernet_key(secret_key)
    fernet = Fernet(fernet_key)
    encrypted_data = fernet.encrypt(file_data)
    
    ai_caption = generate_ai_caption(filename, file_data)
    
    with open(filepath, "wb") as f:
        f.write(encrypted_data)
        
    # Magically vanish the physical file
    try:
        os.remove(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete local file: {e}")
        
    expiry_time = int(time.time()) + expires_in_secs
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO files (id, filename, filepath, owner_username, expiry_time, ai_caption, original_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (file_id, filename, filepath, username, expiry_time, ai_caption, file_path))
    
    cursor.execute("""
        INSERT INTO history (file_id, filename, action, timestamp, owner_username)
        VALUES (?, ?, 'UPLOAD', ?, ?)
    """, (file_id, filename, int(time.time()), username))
    
    conn.commit()
    conn.close()
    
    return {
        "file_id": file_id,
        "expires_at": expiry_time
    }

@app.get("/files")
def get_files(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, expiry_time, ai_caption FROM files WHERE owner_username = ? ORDER BY expiry_time DESC", (username,))
    rows = cursor.fetchall()
    conn.close()
    
    current_time = int(time.time())
    files = []
    for r in rows:
        fid, fname, exp, caption = r
        status = "Active" if current_time < exp else "Deleted"
        time_left = max(0, exp - current_time)
        files.append({
            "file_id": fid,
            "filename": fname,
            "status": status,
            "expires_in_secs": time_left,
            "expiry_time": exp,
            "ai_caption": caption
        })
    return {"files": files}

@app.post("/recover")
async def recover_file(
    file_id: str = Form(...),
    secret_key: str = Form(...),
    username: str = Form(...)
):
    conn = get_connection()
    cursor = conn.cursor()
    
    # First check if user is valid
    key_hash = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
    cursor.execute("SELECT key_hash FROM users WHERE username = ?", (username,))
    user_row = cursor.fetchone()
    if not user_row or user_row[0] != key_hash:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid Master Secret Key")
        
    cursor.execute("SELECT filename, filepath, original_path FROM files WHERE id = ? AND owner_username = ?", (file_id, username))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="File not found")
        
    filename, filepath, original_path = row
    
    if not os.path.exists(filepath):
        conn.close()
        raise HTTPException(status_code=404, detail="Physical file missing")
        
    with open(filepath, "rb") as f:
        encrypted_data = f.read()
        
    fernet_key = derive_fernet_key(secret_key)
    try:
        fernet = Fernet(fernet_key)
        decrypted_data = fernet.decrypt(encrypted_data)
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="Decryption failed. The key might be malformed.")
        
    # Magically restore original physical file
    try:
        os.makedirs(os.path.dirname(original_path), exist_ok=True)
        with open(original_path, "wb") as f:
            f.write(decrypted_data)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to restore original file: {e}")
        
    cursor.execute("""
        INSERT INTO history (file_id, filename, action, timestamp, owner_username)
        VALUES (?, ?, 'RECOVER', ?, ?)
    """, (file_id, filename, int(time.time()), username))
    
    conn.commit()
    conn.close()

    return {"message": "Success", "restored_path": original_path}

@app.get("/history")
def get_history(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, file_id, filename, action, timestamp FROM history WHERE owner_username = ? ORDER BY timestamp DESC", (username,))
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        hid, fid, fname, action, ts = r
        history.append({
            "id": hid,
            "file_id": fid,
            "filename": fname,
            "action": action,
            "timestamp": ts
        })
    return {"history": history}

# Serve Frontend
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/")
    async def serve_frontend():
        return FileResponse(os.path.join(frontend_dist, "index.html"))
        
    @app.get("/{catchall:path}")
    async def serve_fallback(catchall: str):
        file_path = os.path.join(frontend_dist, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
