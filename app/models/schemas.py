from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class UserProfile(BaseModel):
    name: str = "Student"
    target_role: str = "SDE"
    skills: List[str] = []
    education: str = ""
    experience: str = ""
    projects: str = ""
    summary: str = ""

class ResumeTextRequest(BaseModel):
    text: str
    target_role: str = "SDE"

class ResumeAnalysisResponse(BaseModel):
    is_valid: bool
    sections_found: List[str]
    missing_sections: List[str]
    readability_score: int
    strengths: List[str]
    weaknesses: List[str]
    improvement_tips: List[str]

class ATSScoreRequest(BaseModel):
    resume_text: str
    target_role: str
    job_description: Optional[str] = None

class ATSScoreResponse(BaseModel):
    score: int
    keyword_match_percentage: int
    formatting_score: int
    matched_keywords: List[str]
    missing_keywords: List[str]
    detailed_feedback: str

class SkillGapRequest(BaseModel):
    skills: List[str]
    target_role: str

class SkillGapResponse(BaseModel):
    role: str
    acquired_skills: List[str]
    missing_skills: List[str]
    skill_gap_percentage: int

class CompanyPrepResponse(BaseModel):
    company: str
    role: str
    rating: Optional[float] = None
    description: Optional[str] = None
    interview_difficulty: Optional[str] = None
    interview_duration: Optional[str] = None
    locations: List[str] = []
    salary_info: Optional[str] = None
    questions: List[Dict[str, Any]] = []
    prep_strategy: str

class JobRecommendation(BaseModel):
    job_id: str
    title: str
    experience_level: str
    years_of_experience: str
    skills: List[str]
    responsibilities: List[str]
    match_score: int
    matching_skills: List[str]
    missing_skills: List[str]

class RecommendationRequest(BaseModel):
    skills: List[str]
    target_role: str
    experience_level: str = "Fresher"

class RecommendationResponse(BaseModel):
    recommendations: List[JobRecommendation]

class InterviewStartRequest(BaseModel):
    company: str
    role: str
    type: str  # "hr" or "technical"
    difficulty: str = "Medium"

class InterviewQuestionResponse(BaseModel):
    question_id: int
    question: str
    company: str
    role: str
    topic: str
    difficulty: str

class InterviewSubmitRequest(BaseModel):
    question_id: int
    question: str
    user_answer: str
    company: str
    role: str
    type: str

class InterviewSubmitResponse(BaseModel):
    model_config = {'protected_namespaces': ()}
    
    score: int
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]
    model_answer: str

class CodingProblemResponse(BaseModel):
    problem_id: str
    title: str
    description: str
    difficulty: str
    topic: str
    constraints: List[str]
    input_format: str
    output_format: str
    sample_input: str
    sample_output: str

class CodingSubmitRequest(BaseModel):
    problem_id: str
    code: str
    language: str = "python"
    time_taken: int = 60

class TestCaseResult(BaseModel):
    input: str
    expected: str
    actual: str
    passed: bool

class CodingSubmitResponse(BaseModel):
    correctness_score: int
    time_complexity: str
    space_complexity: str
    logical_feedback: str
    suggestions: List[str]
    optimized_code: str
    test_cases: List[TestCaseResult] = []
    runtime_ms: int = 25
    memory_mb: float = 32.4

class LearningRoadmapRequest(BaseModel):
    target_role: str
    missing_skills: List[str]

class RoadmapWeek(BaseModel):
    week: int
    title: str
    topics: List[str]
    projects: List[str]
    resources: List[str]

class LearningRoadmapResponse(BaseModel):
    role: str
    roadmap: List[RoadmapWeek]

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []
    user_profile: Optional[UserProfile] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]] = []

class SemanticSearchRequest(BaseModel):
    query: str
    category: str = "all"  # "jobs", "questions", "companies", "all"

class SearchResultItem(BaseModel):
    title: str
    category: str
    content: str
    score: float
    metadata: Dict[str, Any]

class SemanticSearchResponse(BaseModel):
    results: List[SearchResultItem]

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    target_role: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    profile: Optional[UserProfile] = None

class ContactInfoCheck(BaseModel):
    has_email: bool
    has_phone: bool
    has_linkedin: bool
    has_github: bool
    found_email: Optional[str] = None
    found_phone: Optional[str] = None

class SectionCompleteness(BaseModel):
    has_education: bool
    has_experience: bool
    has_projects: bool
    has_skills: bool
    has_certifications: bool
    completeness_score: int

class JdMatchResult(BaseModel):
    match_percentage: int
    matched_keywords: List[str]
    missing_keywords: List[str]
    keyword_density: float
    skill_match_score: int
    experience_match_score: int
    project_quality_score: int
    matched_skills: List[str]
    partially_matched_skills: List[Dict[str, str]]
    missing_skills: List[str]
    explanations: Dict[str, str]

class AISuggestionDetail(BaseModel):
    category: str
    suggestions: List[str]

class CourseRecommendation(BaseModel):
    course_name: str
    platform: str
    url: Optional[str] = None

class CompanyReadinessItem(BaseModel):
    company: str
    readiness_score: int
    status: str

class SkillGapDetail(BaseModel):
    acquired_skills: List[str]
    missing_skills: List[str]
    recommended_skills: List[str]
    learning_priority: List[Dict[str, str]]
    suggested_courses: List[CourseRecommendation]
    company_readiness: List[CompanyReadinessItem]

class FullATSReportResponse(BaseModel):
    overall_score: int
    resume_strength: str
    formatting_score: int
    grammar_score: int
    readability_score: int
    completeness_score: int
    contact_info: ContactInfoCheck
    completeness: SectionCompleteness
    jd_match: Optional[JdMatchResult] = None
    ai_suggestions: List[AISuggestionDetail]
    skill_gap: SkillGapDetail
    raw_text: str

class ATSHistoryItem(BaseModel):
    id: str
    timestamp: str
    target_role: str
    overall_score: int
    resume_strength: str
    has_jd: bool
    report: FullATSReportResponse

class ATSHistoryResponse(BaseModel):
    history: List[ATSHistoryItem]

class CodingActionRequest(BaseModel):
    problem_id: str

class UserDashboardStatsResponse(BaseModel):
    total_solved: int
    easy_solved: int
    medium_solved: int
    hard_solved: int
    acceptance_rate: int
    rating: int
    interviews_count: int
    resumes_count: int
    login_streak: int
    learning_hours: float
    skill_progress: int
    ai_readiness: int
    placement_readiness: int

