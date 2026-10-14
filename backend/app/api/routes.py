from fastapi import APIRouter, HTTPException, Query, Header, Depends, UploadFile, File
from typing import List, Optional
import random

from backend.app.models.schemas import (
    ResumeTextRequest, ResumeAnalysisResponse, ATSScoreRequest, ATSScoreResponse,
    SkillGapRequest, SkillGapResponse, CompanyPrepResponse, RecommendationRequest,
    RecommendationResponse, JobRecommendation, InterviewStartRequest, InterviewQuestionResponse,
    InterviewSubmitRequest, InterviewSubmitResponse, CodingProblemResponse, CodingSubmitRequest,
    CodingSubmitResponse, LearningRoadmapRequest, LearningRoadmapResponse, ChatRequest, ChatResponse,
    SemanticSearchResponse, SearchResultItem, LoginRequest, SignupRequest, AuthResponse, UserProfile,
    FullATSReportResponse, CodingActionRequest, UserDashboardStatsResponse
)

from backend.app.utils.data_loader import data_loader
from backend.app.services.resume_service import resume_service
from backend.app.services.interview_service import interview_service, CODING_BANK
from backend.app.services.rag_service import rag_service
from backend.app.services.llm_service import llm_service
from backend.app.services.auth_service import auth_service, create_jwt, verify_jwt
from backend.app.services.db_service import db_service

router = APIRouter()

def get_current_user_email(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, 
            detail="Session authorization credentials missing. Please log in."
        )
    token = authorization.split(" ")[1]
    payload = verify_jwt(token)
    if not payload or "email" not in payload:
        raise HTTPException(
            status_code=401, 
            detail="Invalid or expired session token. Please log in."
        )
    return payload["email"]

@router.post("/auth/login", response_model=AuthResponse)
def login_endpoint(request: LoginRequest):
    profile = auth_service.authenticate(request.email, request.password)
    if profile:
        email_clean = request.email.strip().lower()
        db_service.record_login(email_clean)
        token = create_jwt({"email": email_clean})
        return AuthResponse(success=True, message="Login successful", token=token, profile=profile)
    return AuthResponse(success=False, message="Invalid email or password", token=None, profile=None)

@router.post("/auth/signup", response_model=AuthResponse)
def signup_endpoint(request: SignupRequest):
    profile = auth_service.register(request.name, request.email, request.password, request.target_role)
    if profile:
        email_clean = request.email.strip().lower()
        db_service.record_login(email_clean)
        token = create_jwt({"email": email_clean})
        return AuthResponse(success=True, message="Registration successful", token=token, profile=profile)
    return AuthResponse(success=False, message="Registration failed. Email already exists.", token=None, profile=None)

@router.get("/auth/me", response_model=UserProfile)
def get_current_user_profile(email: str = Depends(get_current_user_email)):
    profile = auth_service.get_user_profile(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile

@router.put("/auth/profile", response_model=UserProfile)
def update_current_user_profile(request: UserProfile, email: str = Depends(get_current_user_email)):
    profile = auth_service.update_profile(email, request.model_dump())
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile



@router.get("/sample-resumes")
def get_sample_resumes():
    """
    Returns standard student resumes from the dataset for evaluation.
    """
    return data_loader.sample_resumes

@router.post("/resume/analyze", response_model=ResumeAnalysisResponse)
def analyze_resume(request: ResumeTextRequest):
    try:
        return resume_service.analyze_resume(request.text, request.target_role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze resume: {str(e)}")

@router.post("/resume/ats-score", response_model=ATSScoreResponse)
def calculate_ats_score(request: ATSScoreRequest):
    try:
        return resume_service.calculate_ats_score(request.resume_text, request.target_role, request.job_description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate ATS score: {str(e)}")

@router.post("/resume/skill-gap", response_model=SkillGapResponse)
def analyze_skill_gap(request: SkillGapRequest):
    try:
        return resume_service.analyze_skill_gap(request.skills, request.target_role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze skill gap: {str(e)}")

@router.get("/prep/companies", response_model=List[str])
def get_companies():
    """
    Combines company reviews and interview questions dataset to return a unique list of companies.
    """
    companies = set()
    # Add from interview questions
    if not data_loader.interview_questions.empty:
        companies.update(data_loader.interview_questions['company'].dropna().unique())
    # Add from reviews
    companies.update([p['name'] for p in data_loader.company_profiles_dict.values()])
    # Clean and filter empty
    clean_list = sorted([str(c) for c in companies if str(c).strip() and len(str(c)) > 1])
    return clean_list

@router.get("/prep/{company}", response_model=CompanyPrepResponse)
def get_company_prep(company: str, role: str = "SDE"):
    try:
        # Load profile
        profile = data_loader.get_company_profile(company)
        rating = profile.get("rating") if profile else None
        desc = profile.get("description") if profile else "No description available."
        diff = profile.get("interview_difficulty") if profile else "Medium"
        dur = profile.get("interview_duration") if profile else "Varies"
        website = profile.get("website") if profile else ""
        
        salary_val = profile.get("salary") if profile else None
        salary_str = str(salary_val) if salary_val else "Not specified"
        
        loc_val = profile.get("locations") if profile else ""
        locations = [l.strip() for l in str(loc_val).split(',') if l.strip()] if loc_val else []
        
        # Load matching questions
        questions = data_loader.get_interview_questions(company=company, role=role)
        # If no questions found by role, get generic questions for the company
        if not questions:
            questions = data_loader.get_interview_questions(company=company)
        
        # Generate custom preparation strategy
        system_prompt = (
            f"You are a Senior Placement Coordinator. Write a detailed Placement Strategy guide "
            f"for cracking interviews at {company} for the role of {role}. Mention recruitment rounds, "
            f"coding focus areas, tech stacks, and behavioral expectations based on their reviews."
        )
        user_prompt = (
            f"Company Name: {company}\n"
            f"Target Role: {role}\n"
            f"Company Rating: {rating}/5\n"
            f"Company Overview: {desc[:300]}\n"
            f"Salary Insights: {salary_str}\n"
            f"Typical Interview Difficulty: {diff}\n"
            f"Sample Questions in Database: {len(questions)}"
        )
        
        prep_strategy = llm_service.query(system_prompt, user_prompt, temperature=0.6)
        
        # Fallback if LLM call failed due to API credit limits or timeout
        if not prep_strategy or prep_strategy.startswith("Error") or "error" in prep_strategy.lower():
            prep_strategy = (
                f"### 🚀 {company} {role} Recruitment Strategy Guide\n\n"
                f"**1. Recruitment Process & Rounds**\n"
                f"- **Online Assessment (OA)**: Typically consists of 2 coding questions (data structures & algorithms) and an aptitude/behavioral segment.\n"
                f"- **Technical Round 1 & 2**: Focuses on core computer science concepts (Data Structures, Algorithms, System Design) and deep questions on your projects.\n"
                f"- **HR & Fitment Round**: Evaluates your cultural alignment, long-term goals, and soft skills.\n\n"
                f"**2. Key Technical Focus Areas**\n"
                f"- **SDE**: Practice high-frequency LeetCode questions on Arrays, Dynamic Programming, and Graph Traversals. Focus on clean, structured code.\n"
                f"- **Data Analyst**: Heavy focus on complex SQL queries (Window functions, JOINs, Group By), Python/R data libraries, and statistical A/B testing concepts.\n"
                f"- **ML Engineer**: Master ML fundamentals (bias-variance trade-offs, optimization algorithms), deep learning theory, and machine learning system design patterns.\n"
                f"- **System/QA Engineer**: Master Linux kernel commands, network protocols, continuous integration tools (Docker, Kubernetes), and test framework design (POM, Selenium).\n\n"
                f"**3. Preparation Tips**\n"
                f"- Review the typical interview questions listed on the right panel.\n"
                f"- Practice mock interviews inside the **Interview Arena** to build speed and accuracy."
            )
        
        return CompanyPrepResponse(
            company=company,
            role=role,
            rating=rating,
            description=desc,
            interview_difficulty=diff,
            interview_duration=dur,
            locations=locations,
            salary_info=salary_str,
            questions=questions[:10], # Return top 10 questions
            prep_strategy=prep_strategy
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load placement guide for {company}: {str(e)}")

@router.post("/recommendations", response_model=RecommendationResponse)
def get_recommendations(request: RecommendationRequest):
    try:
        # Match user skills with jobs database
        matched_jobs = []
        user_skills_set = set(s.lower().strip() for s in request.skills)
        
        for job in data_loader.jobs:
            job_skills = job.get("Skills", [])
            job_skills_set = set(s.lower().strip() for s in job_skills)
            
            # Intersection of skills
            matching = user_skills_set.intersection(job_skills_set)
            missing = job_skills_set.difference(user_skills_set)
            
            # Simple match score out of 100
            total_job_skills = len(job_skills_set)
            if total_job_skills == 0:
                score = 50
            else:
                score = int((len(matching) / total_job_skills) * 100)
            
            # Match role/title keyword as boost
            title = job.get("Title", "").lower()
            target_role = request.target_role.lower()
            if target_role in title or title in target_role:
                score = min(score + 15, 100)
                
            # Filter matches matching general experience level
            # e.g., if user is Fresher, favor Fresher or Entry-level
            if request.experience_level.lower() == "fresher" and job.get("ExperienceLevel", "").lower() == "experienced":
                score = max(score - 20, 10)
                
            matched_jobs.append(JobRecommendation(
                job_id=job.get("JobID", ""),
                title=job.get("Title", ""),
                experience_level=job.get("ExperienceLevel", ""),
                years_of_experience=job.get("YearsOfExperience", ""),
                skills=job_skills,
                responsibilities=job.get("Responsibilities", []),
                match_score=score,
                matching_skills=[s for s in job_skills if s.lower() in user_skills_set],
                missing_skills=[s for s in job_skills if s.lower() not in user_skills_set]
            ))
            
        # Sort by score descending and return top 8
        matched_jobs.sort(key=lambda x: x.match_score, reverse=True)
        return RecommendationResponse(recommendations=matched_jobs[:8])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to match recommendations: {str(e)}")

@router.post("/interview/start", response_model=InterviewQuestionResponse)
def start_interview(request: InterviewStartRequest, email: str = Depends(get_current_user_email)):
    try:
        q_data = interview_service.get_random_question(
            company=request.company,
            role=request.role,
            type_filter=request.type,
            difficulty=request.difficulty,
            email=email
        )
        return InterviewQuestionResponse(**q_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate interview question: {str(e)}")

@router.post("/interview/submit", response_model=InterviewSubmitResponse)
def submit_interview(request: InterviewSubmitRequest, email: str = Depends(get_current_user_email)):
    try:
        res = interview_service.evaluate_interview_answer(
            question=request.question,
            user_answer=request.user_answer,
            company=request.company,
            role=request.role,
            type_filter=request.type
        )
        import uuid
        session_id = str(uuid.uuid4())[:8]
        ans_log = [{"question": request.question, "answer": request.user_answer, "score": res.score}]
        db_service.record_interview_session(email, session_id, request.company, request.role, request.type, ans_log, res.score)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate answer: {str(e)}")

@router.get("/interview/coding/generate", response_model=CodingProblemResponse)
def generate_coding_problem(topic: str = "Arrays", difficulty: str = "Medium", email: str = Depends(get_current_user_email)):
    try:
        return interview_service.generate_coding_problem(topic, difficulty, email=email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate coding problem: {str(e)}")

@router.post("/interview/coding/evaluate", response_model=CodingSubmitResponse)
def evaluate_code(request: CodingSubmitRequest, email: str = Depends(get_current_user_email)):
    try:
        res = interview_service.evaluate_code(request.problem_id, request.code, request.language)
        
        difficulty = "Medium"
        topic = "Arrays"
        for x in CODING_BANK:
            if x["id"] == request.problem_id:
                difficulty = x["difficulty"]
                topic = x["topic"]
                break
                
        is_solved = res.correctness_score >= 70
        db_service.record_coding_attempt(
            email=email,
            problem_id=request.problem_id,
            difficulty=difficulty,
            topic=topic,
            score=res.correctness_score,
            solve_time=request.time_taken,
            is_solved=is_solved
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate coding response: {str(e)}")

@router.post("/roadmap/generate", response_model=LearningRoadmapResponse)
def generate_roadmap(request: LearningRoadmapRequest):
    try:
        return interview_service.generate_roadmap(request.target_role, request.missing_skills)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate learning roadmap: {str(e)}")

@router.get("/challenge/daily", response_model=CodingProblemResponse)
def get_daily_challenge():
    """
    Returns a consistent daily challenge based on the day of month.
    """
    import datetime
    topics = ["Arrays", "Strings", "SQL", "Dynamic Programming", "Trees", "Sorting"]
    day = datetime.datetime.now().day
    topic = topics[day % len(topics)]
    difficulty = "Easy" if day % 3 == 0 else "Medium"
    
    return generate_coding_problem(topic=topic, difficulty=difficulty)

@router.post("/chat", response_model=ChatResponse)
def mentor_chat(request: ChatRequest):
    try:
        # Create student profile context if supplied
        profile_context = ""
        if request.user_profile:
            p = request.user_profile
            profile_context = (
                f"Student Name: {p.name}, Target Role: {p.target_role}, "
                f"Acquired Skills: {', '.join(p.skills)}, "
                f"Education: {p.education}, Experience: {p.experience}, Projects: {p.projects}."
            )
            
        return ChatResponse(**rag_service.answer_question(
            query=request.message,
            user_profile_context=profile_context,
            history=request.history
        ))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat module error: {str(e)}")

@router.get("/semantic-search", response_model=SemanticSearchResponse)
def semantic_search(query: str = Query(..., min_length=2), category: str = "all"):
    try:
        results = rag_service.search(query, category=category, top_k=10)
        formatted = []
        for doc, score in results:
            formatted.append(SearchResultItem(
                title=doc["title"],
                category=doc["category"],
                content=doc["text"],
                score=round(score, 3),
                metadata=doc["metadata"]
            ))
        return SemanticSearchResponse(results=formatted)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

import os
import json
import uuid
import time
from pydantic import BaseModel

HISTORY_FILE = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data")), "resume_history.json")

def load_history_db() -> dict:
    if not os.path.exists(HISTORY_FILE):
        return {}
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_history_db(db: dict):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(db, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving resume history: {e}")

class AnalyzeFullRequest(BaseModel):
    resume_text: str
    target_role: str
    job_description: Optional[str] = None

@router.post("/resume/upload")
async def upload_resume_endpoint(file: UploadFile = File(...)):
    filename = file.filename
    content_type = file.content_type
    file_bytes = await file.read()
    
    try:
        if filename.endswith(".pdf") or content_type == "application/pdf":
            extracted_text = resume_service.extract_text_from_pdf(file_bytes)
        elif filename.endswith(".docx") or content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
            extracted_text = resume_service.extract_text_from_docx(file_bytes)
        else:
            # Try to decode as plain text
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
            
        return {"filename": filename, "text": extracted_text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse upload file: {str(e)}")

@router.post("/resume/analyze-full", response_model=FullATSReportResponse)
def analyze_full_resume_endpoint(
    request: AnalyzeFullRequest, 
    email: str = Depends(get_current_user_email)
):
    try:
        report = resume_service.analyze_full_report(
            request.resume_text, 
            request.target_role, 
            request.job_description
        )
        
        # Save to history database
        db = load_history_db()
        user_history = db.get(email, [])
        
        history_item = {
            "id": str(uuid.uuid4())[:8],
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "target_role": request.target_role,
            "overall_score": report.overall_score,
            "resume_strength": report.resume_strength,
            "has_jd": request.job_description is not None and len(request.job_description.strip()) > 0,
            "report": report.model_dump()
        }
        
        user_history.insert(0, history_item)
        db[email] = user_history[:10]  # Store last 10 audits
        save_history_db(db)
        
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ATS Analysis failed: {str(e)}")

@router.get("/resume/history")
def get_resume_history_endpoint(email: str = Depends(get_current_user_email)):
    db = load_history_db()
    return {"history": db.get(email, [])}

@router.delete("/resume/history")
def clear_resume_history_endpoint(email: str = Depends(get_current_user_email)):
    db = load_history_db()
    db[email] = []
    save_history_db(db)
    return {"message": "Resume analysis history cleared successfully"}

@router.get("/user/stats", response_model=UserDashboardStatsResponse)
def get_user_stats(email: str = Depends(get_current_user_email)):
    try:
        stats = db_service.get_dashboard_stats(email)
        return UserDashboardStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user stats: {str(e)}")

@router.post("/coding/skip")
def skip_coding_challenge(request: CodingActionRequest, email: str = Depends(get_current_user_email)):
    try:
        db_service.skip_problem(email, request.problem_id)
        return {"message": "Problem marked as skipped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to skip problem: {str(e)}")

@router.post("/coding/bookmark")
def bookmark_coding_challenge(request: CodingActionRequest, email: str = Depends(get_current_user_email)):
    try:
        db_service.add_bookmark(email, request.problem_id)
        return {"message": "Problem bookmarked successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bookmark problem: {str(e)}")

@router.delete("/coding/bookmark/{problem_id}")
def remove_coding_bookmark(problem_id: str, email: str = Depends(get_current_user_email)):
    try:
        db_service.remove_bookmark(email, problem_id)
        return {"message": "Bookmark removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove bookmark: {str(e)}")

@router.post("/login-streak")
def update_login_streak(email: str = Depends(get_current_user_email)):
    try:
        db_service.record_login(email)
        return {"message": "Streak updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update login streak: {str(e)}")

