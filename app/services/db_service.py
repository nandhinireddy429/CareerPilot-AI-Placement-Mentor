import os
import json
import time
from typing import Dict, Any, List, Optional

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
USER_DATA_FILE = os.path.join(DATA_DIR, "user_data.json")

class DBService:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._init_db()

    def _init_db(self):
        if not os.path.exists(USER_DATA_FILE):
            self._save_db({})

    def _load_db(self) -> Dict[str, Any]:
        try:
            if os.path.exists(USER_DATA_FILE):
                with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading user_data db: {e}")
        return {}

    def _save_db(self, db: Dict[str, Any]):
        try:
            with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(db, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving user_data db: {e}")

    def get_user_record(self, email: str) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        db = self._load_db()
        
        if email_clean not in db:
            # Initialize empty schema
            db[email_clean] = {
                "coding_solved": [],        # list of Dicts: problem_id, difficulty, topic, timestamp, score, solve_time
                "coding_skipped": [],       # list of problem_ids
                "coding_bookmarked": [],    # list of problem_ids
                "interview_sessions": [],   # list of Dicts: session_id, company, role, type, timestamp, score, answers
                "login_history": [],        # list of timestamps
                "streaks": {
                    "login": {"current": 0, "longest": 0, "last_active": 0.0},
                    "coding": {"current": 0, "longest": 0, "last_active": 0.0},
                    "interview": {"current": 0, "longest": 0, "last_active": 0.0},
                    "learning": {"current": 0, "longest": 0, "last_active": 0.0}
                },
                "learning_hours": 0.0,
                "rating": 1500,
                "last_active": 0.0
            }
            self._save_db(db)
            
        return db[email_clean]

    def save_user_record(self, email: str, record: Dict[str, Any]):
        email_clean = email.strip().lower()
        db = self._load_db()
        db[email_clean] = record
        self._save_db(db)

    def _update_streak(self, streak: dict, now: float) -> dict:
        last_active = streak.get("last_active", 0.0)
        current = streak.get("current", 0)
        longest = streak.get("longest", 0)
        
        if last_active == 0.0:
            current = 1
        elif now - last_active > 86400: # Reset after 24 hours of inactivity
            current = 1
        else:
            # Within 24 hours - increment only if it's a new session (> 2 minutes gap)
            if now - last_active > 120:
                current += 1
                
        longest = max(longest, current)
        return {
            "current": current,
            "longest": longest,
            "last_active": now
        }

    def record_login(self, email: str):
        record = self.get_user_record(email)
        now = time.time()
        
        record["login_history"].append(now)
        record["streaks"]["login"] = self._update_streak(record["streaks"]["login"], now)
        record["last_active"] = now
        
        self.save_user_record(email, record)

    def record_coding_attempt(self, email: str, problem_id: str, difficulty: str, topic: str, score: int, solve_time: int, is_solved: bool):
        record = self.get_user_record(email)
        now = time.time()
        
        # Save solved
        if is_solved:
            # Check if already solved to prevent duplicate stats inflation
            already_solved = any(x["problem_id"] == problem_id for x in record["coding_solved"])
            if not already_solved:
                record["coding_solved"].append({
                    "problem_id": problem_id,
                    "difficulty": difficulty,
                    "topic": topic,
                    "timestamp": now,
                    "score": score,
                    "solve_time": solve_time
                })
                # Update ELO rating based on difficulty
                rating_change = 8 if difficulty == "Easy" else (15 if difficulty == "Medium" else 25)
                record["rating"] = min(3000, record["rating"] + rating_change)
                
            record["streaks"]["coding"] = self._update_streak(record["streaks"]["coding"], now)
            # Coding contributes to learning time
            record["learning_hours"] = round(record["learning_hours"] + (solve_time / 3600.0), 2)
            record["streaks"]["learning"] = self._update_streak(record["streaks"]["learning"], now)
            
        record["last_active"] = now
        self.save_user_record(email, record)

    def record_interview_session(self, email: str, session_id: str, company: str, role: str, type_filter: str, answers: List[dict], score: int):
        record = self.get_user_record(email)
        now = time.time()
        
        record["interview_sessions"].append({
            "session_id": session_id,
            "company": company,
            "role": role,
            "type": type_filter,
            "timestamp": now,
            "score": score,
            "answers": answers
        })
        
        record["streaks"]["interview"] = self._update_streak(record["streaks"]["interview"], now)
        # Interview contributes 0.5 hours to learning time
        record["learning_hours"] = round(record["learning_hours"] + 0.5, 2)
        record["streaks"]["learning"] = self._update_streak(record["streaks"]["learning"], now)
        
        record["last_active"] = now
        self.save_user_record(email, record)

    def add_bookmark(self, email: str, problem_id: str):
        record = self.get_user_record(email)
        if problem_id not in record["coding_bookmarked"]:
            record["coding_bookmarked"].append(problem_id)
            self.save_user_record(email, record)

    def remove_bookmark(self, email: str, problem_id: str):
        record = self.get_user_record(email)
        if problem_id in record["coding_bookmarked"]:
            record["coding_bookmarked"].remove(problem_id)
            self.save_user_record(email, record)

    def skip_problem(self, email: str, problem_id: str):
        record = self.get_user_record(email)
        if problem_id not in record["coding_skipped"]:
            record["coding_skipped"].append(problem_id)
            self.save_user_record(email, record)

    def get_dashboard_stats(self, email: str) -> Dict[str, Any]:
        record = self.get_user_record(email)
        
        coding_solved = record["coding_solved"]
        solved_count = len(coding_solved)
        
        easy_count = sum(1 for x in coding_solved if x["difficulty"] == "Easy")
        medium_count = sum(1 for x in coding_solved if x["difficulty"] == "Medium")
        hard_count = sum(1 for x in coding_solved if x["difficulty"] == "Hard")
        
        # Calculate Acceptance Rate (Total Solved / Total Attempts)
        total_attempts = solved_count + len(record["coding_skipped"])
        acceptance_rate = int((solved_count / max(1, total_attempts)) * 100) if total_attempts > 0 else 0
        
        # Load resume history
        from backend.app.api.routes import load_history_db
        res_db = load_history_db()
        resume_history = res_db.get(email, [])
        resume_count = len(resume_history)
        max_resume_score = max([x["overall_score"] for x in resume_history]) if resume_history else 0
        
        # Streaks
        now = time.time()
        # Verify if streaks should reset due to inactivity
        for key in ["login", "coding", "interview", "learning"]:
            streak = record["streaks"][key]
            if streak["last_active"] > 0 and now - streak["last_active"] > 86400:
                streak["current"] = 0
                
        login_streak = record["streaks"]["login"]["current"]
        
        # Skill progress based on solved topics count
        solved_topics = set(x["topic"] for x in coding_solved)
        skill_progress = min(100, int((len(solved_topics) / 8.0) * 100)) # 8 core topics
        
        # Placement Readiness & AI Readiness
        avg_interview_score = int(sum(x["score"] for x in record["interview_sessions"]) / len(record["interview_sessions"])) if record["interview_sessions"] else 0
        ai_readiness = min(100, int(solved_count * 5 + avg_interview_score * 0.6))
        
        # Placement Readiness blends resume score, coding ELO, and skills progress
        placement_readiness = min(100, int(max_resume_score * 0.4 + (record["rating"] / 3000.0 * 40) + skill_progress * 0.2))
        
        return {
            "total_solved": solved_count,
            "easy_solved": easy_count,
            "medium_solved": medium_count,
            "hard_solved": hard_count,
            "acceptance_rate": acceptance_rate,
            "rating": record["rating"],
            "interviews_count": len(record["interview_sessions"]),
            "resumes_count": resume_count,
            "login_streak": login_streak,
            "learning_hours": record["learning_hours"],
            "skill_progress": skill_progress,
            "ai_readiness": ai_readiness if ai_readiness > 0 else 40,
            "placement_readiness": placement_readiness if placement_readiness > 0 else 45
        }

db_service = DBService()
