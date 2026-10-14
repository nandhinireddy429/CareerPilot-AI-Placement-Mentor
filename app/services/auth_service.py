import os
import json
import hashlib
import secrets
import base64
import hmac
import time
from typing import Dict, Any, Optional

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
USERS_FILE = os.path.join(DATA_DIR, "users.json")
SECRET_KEY = "careerpilot_super_secret_jwt_sign_key_2026_change_in_production"

def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode('utf-8'), 
        salt.encode('utf-8'), 
        100000
    )
    return f"{salt}:{key.hex()}"

def verify_password(password: str, hashed_pw: str) -> bool:
    try:
        if ":" not in hashed_pw:
            # Fallback for legacy plain text migration
            return password == hashed_pw
        salt, key_hex = hashed_pw.split(":")
        new_hashed = hash_password(password, salt)
        return new_hashed == hashed_pw
    except Exception:
        return False

def create_jwt(payload: dict) -> str:
    # Set expiry to 24 hours
    payload["exp"] = time.time() + 86400
    
    header = {"alg": "HS256", "typ": "JWT"}
    
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().strip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().strip("=")
    
    signature = hmac.new(
        SECRET_KEY.encode(),
        f"{header_b64}.{payload_b64}".encode(),
        hashlib.sha256
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().strip("=")
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_jwt(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        
        # Recalculate signature
        expected_sig = hmac.new(
            SECRET_KEY.encode(),
            f"{header_b64}.{payload_b64}".encode(),
            hashlib.sha256
        ).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode().strip("=")
        
        # Check signature (constant time comparison)
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            return None
            
        # Decode payload
        pad_len = 4 - (len(payload_b64) % 4)
        if pad_len < 4:
            payload_b64 += "=" * pad_len
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())
        
        # Check expiry
        if payload.get("exp", 0) < time.time():
            return None
            
        return payload
    except Exception:
        return None

class AuthService:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._init_db()

    def _init_db(self):
        default_users = {
            "guest@university.edu": {
                "name": "Guest Student",
                "password": hash_password("placement2026"),
                "target_role": "SDE",
                "skills": ["Python", "Data Structures", "Algorithms", "SQL", "Git"],
                "education": "B.Tech Computer Science, XYZ University, CGPA 8.5",
                "experience": "Web Development Intern at StartupX - built database REST APIs",
                "projects": "URL Shortener in Python; Personal Blog Website using FastAPI",
                "summary": "Engineering student specializing in software engineering, backend databases, and algorithms."
            }
        }
        
        if not os.path.exists(USERS_FILE):
            self._save_users(default_users)
        else:
            # Migration check: upgrade plain text passwords to hashes
            users = self._load_users_raw()
            modified = False
            for email, data in users.items():
                if ":" not in data.get("password", ""):
                    data["password"] = hash_password(data["password"])
                    modified = True
            if modified:
                self._save_users(users)

    def _load_users_raw(self) -> Dict[str, Any]:
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_users(self, users: Dict[str, Any]):
        try:
            with open(USERS_FILE, "w", encoding="utf-8") as f:
                json.dump(users, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving users database: {e}")

    def authenticate(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        users = self._load_users_raw()
        if email_clean in users and verify_password(password, users[email_clean]["password"]):
            user_data = users[email_clean].copy()
            user_data.pop("password", None)
            return user_data
        return None

    def register(self, name: str, email: str, password: str, target_role: str) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        users = self._load_users_raw()
        
        if email_clean in users:
            return None
            
        skills = ["Python", "SQL", "Git"]
        if target_role == "SDE":
            skills.extend(["Data Structures", "Algorithms"])
        elif target_role == "ML Engineer":
            skills.extend(["Machine Learning", "Statistics"])
            
        users[email_clean] = {
            "name": name,
            "password": hash_password(password),
            "target_role": target_role,
            "skills": skills,
            "education": "B.Tech Candidate, ABC University",
            "experience": "Student",
            "projects": "Placement Projects",
            "summary": f"Aspiring {target_role} seeking intern and placement opportunities."
        }
        self._save_users(users)
        
        user_data = users[email_clean].copy()
        user_data.pop("password", None)
        return user_data

    def get_user_profile(self, email: str) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        users = self._load_users_raw()
        if email_clean in users:
            user_data = users[email_clean].copy()
            user_data.pop("password", None)
            return user_data
        return None

    def update_profile(self, email: str, profile_dict: dict) -> Optional[Dict[str, Any]]:
        email_clean = email.strip().lower()
        users = self._load_users_raw()
        if email_clean not in users:
            return None
            
        user_record = users[email_clean]
        for key in ["name", "target_role", "skills", "education", "experience", "projects", "summary"]:
            if key in profile_dict:
                user_record[key] = profile_dict[key]
                
        self._save_users(users)
        
        user_data = user_record.copy()
        user_data.pop("password", None)
        return user_data

# Singleton Instance
auth_service = AuthService()
