import re
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    TfidfVectorizer = None

from backend.app.utils.data_loader import data_loader
from backend.app.services.llm_service import llm_service
from backend.app.models.schemas import (
    FullATSReportResponse, ContactInfoCheck, SectionCompleteness, JdMatchResult,
    AISuggestionDetail, CourseRecommendation, CompanyReadinessItem, SkillGapDetail,
    ResumeAnalysisResponse, ATSScoreResponse, SkillGapResponse
)

# Predefined Semantic Clusters representing related skills
SEMANTIC_CLUSTERS = [
    {
        "name": "GenAI / LLM / Prompt Engineering", 
        "keywords": ["generative ai", "llms", "llm", "large language models", "chatgpt api", "prompt engineering", "openai", "gemini", "claude", "langchain", "llamaindex", "vector database", "rag", "retrieval-augmented generation", "semantic search", "nlp", "natural language processing"]
    },
    {
        "name": "Machine Learning / Deep Learning / AI", 
        "keywords": ["machine learning", "deep learning", "artificial intelligence", "ai", "pytorch", "tensorflow", "keras", "scikit-learn", "sklearn", "neural networks", "cnn", "rnn", "transformers", "computer vision", "cv", "reinforcement learning"]
    },
    {
        "name": "Backend Development / Frameworks", 
        "keywords": ["backend", "fastapi", "flask", "django", "nodejs", "node.js", "express", "spring boot", "java", "python", "go", "golang", "ruby", "php", "rest apis", "rest api", "graphql", "microservices", "apis", "api design"]
    },
    {
        "name": "Frontend Development / Frameworks", 
        "keywords": ["frontend", "react", "react.js", "angular", "vue", "vue.js", "javascript", "typescript", "html5", "html", "css3", "css", "sass", "tailwind", "next.js", "nextjs", "vite", "ui/ux"]
    },
    {
        "name": "Cloud / DevOps / Containers", 
        "keywords": ["cloud", "devops", "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "jenkins", "github actions", "ci/cd", "cicd", "terraform", "ansible", "linux", "bash", "shell", "monitoring"]
    },
    {
        "name": "Databases / Data Engineering", 
        "keywords": ["sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "cassandra", "data engineering", "spark", "hadoop", "etl", "kafka", "snowflake", "databases", "database", "data warehousing"]
    }
]

class ResumeService:
    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        if pypdf is None:
            raise ImportError("PDF extraction helper requires the 'pypdf' package. Please install it.")
        
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_list = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_list.append(page_text)
            extracted = "\n".join(text_list)
            if not extracted.strip():
                return file_bytes.decode("utf-8", errors="ignore")
            return extracted
        except Exception as e:
            raise ValueError(f"Failed to parse PDF file: {str(e)}")

    def extract_text_from_docx(self, file_bytes: bytes) -> str:
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx:
                xml_content = docx.read('word/document.xml')
                root = ET.fromstring(xml_content)
                text_list = []
                for elem in root.iter():
                    if elem.tag.endswith('t'):
                        if elem.text:
                            text_list.append(elem.text)
                    elif elem.tag.endswith('p') or elem.tag.endswith('br') or elem.tag.endswith('cr'):
                        text_list.append('\n')
                return "".join(text_list)
        except Exception as e:
            raise ValueError(f"Failed to parse DOCX archive: {str(e)}")

    def check_contact_info(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
        phone_pattern = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        
        emails = re.findall(email_pattern, text)
        phones = re.findall(phone_pattern, text)
        
        has_linkedin = "linkedin.com/" in text_lower or "linkedin.com/in/" in text_lower
        has_github = "github.com/" in text_lower
        
        return {
            "has_email": len(emails) > 0,
            "has_phone": len(phones) > 0,
            "has_linkedin": has_linkedin,
            "has_github": has_github,
            "found_email": emails[0] if emails else None,
            "found_phone": phones[0] if phones else None
        }

    def evaluate_sections(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        patterns = {
            "education": [r"\beducation\b", r"\bacademics\b", r"\bqualifications\b", r"\bacademic qualifications\b"],
            "experience": [r"\bexperience\b", r"\bemployment\b", r"\bwork history\b", r"\binternship\b", r"\bprofessional experience\b"],
            "projects": [r"\bprojects\b", r"\bpersonal projects\b", r"\bacademic projects\b", r"\bkey projects\b"],
            "skills": [r"\bskills\b", r"\btechnical skills\b", r"\btechnologies\b", r"\bcore competencies\b"],
            "certifications": [r"\bcertifications\b", r"\bcertificates\b", r"\bcourses\b", r"\bawards\b"]
        }
        
        found = {}
        found_count = 0
        for section, keywords in patterns.items():
            matched = False
            for kw in keywords:
                if re.search(kw, text_lower):
                    matched = True
                    break
            found[section] = matched
            if matched:
                found_count += 1
                
        completeness_score = int((found_count / len(patterns)) * 100)
        return {
            "has_education": found["education"],
            "has_experience": found["experience"],
            "has_projects": found["projects"],
            "has_skills": found["skills"],
            "has_certifications": found["certifications"],
            "completeness_score": completeness_score
        }

    def calculate_readability(self, text: str) -> int:
        words = text.split()
        word_count = len(words)
        if word_count == 0:
            return 0
            
        bullet_count = len(re.findall(r"[\u2022\-\*]", text))
        
        if 350 <= word_count <= 750:
            word_score = 45
        elif 250 <= word_count <= 850:
            word_score = 35
        else:
            word_score = 15
            
        if 8 <= bullet_count <= 22:
            bullet_score = 45
        elif 3 <= bullet_count <= 30:
            bullet_score = 30
        else:
            bullet_score = 10
            
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        avg_line_len = sum(len(line) for line in lines) / len(lines) if lines else 0
        layout_score = 10 if (30 <= avg_line_len <= 80) else 5
        
        return min(100, word_score + bullet_score + layout_score)

    def evaluate_grammar_and_verbs(self, text: str) -> int:
        action_verbs = [
            "led", "managed", "built", "designed", "developed", "implemented", "created", 
            "increased", "reduced", "optimized", "spearheaded", "engineered", "achieved",
            "constructed", "coordinated", "delivered", "executed", "formulated", "initiated",
            "overhauled", "resolved", "revamped", "streamlined", "transformed"
        ]
        text_lower = text.lower()
        words = text_lower.split()
        if not words:
            return 0
            
        verb_count = sum(1 for w in words if w in action_verbs)
        verb_density = (verb_count / len(words)) * 100
        if 1.2 <= verb_density <= 4.0:
            verb_score = 70
        elif 0.5 <= verb_density <= 6.0:
            verb_score = 50
        else:
            verb_score = 25
            
        duplicates = len(words) - len(set(words))
        duplicate_density = (duplicates / len(words)) * 100
        spelling_grammar_score = 30
        if duplicate_density > 45:
            spelling_grammar_score = 15
            
        return verb_score + spelling_grammar_score

    def calculate_tfidf_similarity(self, text1: str, text2: str) -> float:
        if TfidfVectorizer is None:
            # Fallback Jaccard similarity index
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            return len(intersection) / len(union) if union else 0.0
        try:
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf = vectorizer.fit_transform([text1, text2])
            pairwise_similarity = (tfidf * tfidf.T).toarray()
            return float(pairwise_similarity[0, 1])
        except Exception:
            return 0.0

    def analyze_skills_gap_extended(self, resume_text: str, target_role: str) -> Dict[str, Any]:
        text_lower = resume_text.lower()
        tax_skills = data_loader.skill_taxonomy.get(target_role, ["Python", "SQL", "Git", "Algorithms", "Data Structures"])
        
        acquired = []
        missing = []
        for skill in tax_skills:
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            if re.search(pattern, text_lower) or skill.lower() in text_lower:
                acquired.append(skill)
            else:
                missing.append(skill)
                
        recommended = []
        if "SQL" in missing:
            recommended.append("Relational Database Design")
        if "Algorithms" in missing or "Data Structures" in missing:
            recommended.append("Computer Science Foundations")
        if "Python" in missing:
            recommended.append("Object Oriented Python Programming")
        if "Machine Learning" in missing or "Statistics" in missing:
            recommended.append("Supervised & Unsupervised Machine Learning")
            
        for m in missing[:3]:
            if m not in recommended:
                recommended.append(m)
                
        courses = []
        course_mappings = {
            "Algorithms": [CourseRecommendation(course_name="Algorithms Specialization", platform="Coursera (Stanford)", url="https://www.coursera.org/specializations/algorithms")],
            "SQL": [CourseRecommendation(course_name="SQL for Data Science", platform="Coursera (UC Davis)", url="https://www.coursera.org/learn/sql-for-data-science")],
            "Python": [CourseRecommendation(course_name="Python for Everybody", platform="Coursera (Michigan)", url="https://www.coursera.org/specializations/python-3-programming")],
            "Machine Learning": [CourseRecommendation(course_name="Machine Learning Specialization", platform="Coursera (Andrew Ng)", url="https://www.coursera.org/specializations/machine-learning-introduction")],
            "Docker": [CourseRecommendation(course_name="Docker and Kubernetes: The Complete Guide", platform="Udemy", url="https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/")]
        }
        
        for m in missing:
            if m in course_mappings:
                courses.extend(course_mappings[m])
        if not courses:
            courses.append(CourseRecommendation(course_name="Technical Placement Interview Prep", platform="CareerPilot Portal"))
            courses.append(CourseRecommendation(course_name="Software Engineering Bootcamp Foundations", platform="Coursera"))
            
        priority = []
        for idx, m in enumerate(missing):
            level = "High" if idx < 2 else ("Medium" if idx < 4 else "Low")
            priority.append({"skill": m, "priority": level})
            
        companies_list = ["Google", "Amazon", "Microsoft", "TCS", "Wipro", "Infosys"]
        readiness = []
        for idx, comp in enumerate(companies_list):
            base = 40 + (len(acquired) * 8)
            if comp in ["Google", "Microsoft"]:
                base = max(10, base - 25)
            elif comp in ["TCS", "Wipro"]:
                base = min(100, base + 20)
            score = max(5, min(int(base), 100))
            
            if score > 80:
                status = "Ready to Apply"
            elif score > 50:
                status = "Requires Skill Bridging"
            else:
                status = "Critical Skill Gaps"
                
            readiness.append(CompanyReadinessItem(company=comp, readiness_score=score, status=status))
            
        return {
            "acquired_skills": acquired,
            "missing_skills": missing,
            "recommended_skills": recommended[:5],
            "learning_priority": priority[:6],
            "suggested_courses": courses[:4],
            "company_readiness": readiness
        }

    def analyze_full_report(self, resume_text: str, target_role: str, job_description: Optional[str] = None) -> FullATSReportResponse:
        text_lower = resume_text.lower()
        
        contact = self.check_contact_info(resume_text)
        completeness = self.evaluate_sections(resume_text)
        readability_score = self.calculate_readability(resume_text)
        
        formatting_score = 40 + (sum(1 for k, v in completeness.items() if v and k != "completeness_score") * 12)
        formatting_score = min(100, formatting_score)
        
        grammar_score = self.evaluate_grammar_and_verbs(resume_text)
        skills_analysis = self.analyze_skills_gap_extended(resume_text, target_role)
        
        jd_match = None
        skill_match_contrib = 50
        exp_match_contrib = 60
        proj_quality_contrib = 55
        
        # We start with base calculations
        acquired_pct = (len(skills_analysis["acquired_skills"]) / max(1, len(skills_analysis["acquired_skills"]) + len(skills_analysis["missing_skills"]))) * 100
        base_calc = (
            completeness["completeness_score"] * 0.20 +
            formatting_score * 0.20 +
            grammar_score * 0.15 +
            readability_score * 0.15 +
            acquired_pct * 0.30
        )
        
        if job_description:
            # 1. Extract target skills from the Job Description based on taxonomy
            jd_lower = job_description.lower()
            
            target_skills_in_jd = []
            for role, tax_skills in data_loader.skill_taxonomy.items():
                for skill in tax_skills:
                    if skill.lower() in jd_lower and skill not in target_skills_in_jd:
                        target_skills_in_jd.append(skill)
            
            # Fallback targets if none extracted
            if not target_skills_in_jd:
                # Retrieve from target role taxonomy
                target_skills_in_jd = data_loader.skill_taxonomy.get(target_role, ["Python", "SQL", "Git", "Algorithms", "Data Structures"])
            
            # 2. Semantic matching checks
            matched_skills = []
            partially_matched_skills = []
            missing_skills = []
            
            for skill in target_skills_in_jd:
                skill_lower = skill.lower()
                pattern = r'\b' + re.escape(skill_lower) + r'\b'
                if re.search(pattern, text_lower) or skill_lower in text_lower:
                    matched_skills.append(skill)
                else:
                    # Semantic Synonym matching check
                    found_partial = False
                    for cluster in SEMANTIC_CLUSTERS:
                        if skill_lower in cluster["keywords"]:
                            # Look inside the resume for other keywords in this cluster
                            for related in cluster["keywords"]:
                                if related != skill_lower:
                                    rel_pattern = r'\b' + re.escape(related) + r'\b'
                                    if re.search(rel_pattern, text_lower) or related in text_lower:
                                        partially_matched_skills.append({
                                            "jd_skill": skill,
                                            "matched_with": related.title(),
                                            "reason": f"Required '{skill}' is semantically related to '{related.title()}' listed in your resume."
                                        })
                                        found_partial = True
                                        break
                            if found_partial:
                                break
                    if not found_partial:
                        missing_skills.append(skill)
            
            # 3. Calculate metrics mathematically
            total_targets = len(target_skills_in_jd)
            direct_count = len(matched_skills)
            partial_count = len(partially_matched_skills)
            
            # Direct match = 100%, Partial match = 60%, Missing = 0%
            skill_match_contrib = int(((direct_count + partial_count * 0.6) / total_targets) * 100) if total_targets > 0 else 100
            
            # Keyword match counts direct and partial as matches
            keyword_match_contrib = int(((direct_count + partial_count) / total_targets) * 100) if total_targets > 0 else 100
            
            # Text similarity index (TF-IDF Cosine Similarity)
            tfidf_similarity = self.calculate_tfidf_similarity(resume_text, job_description)
            keyword_density = round(tfidf_similarity * 12.0, 1)  # standard density metric ratio
            
            # Experience scoring logic
            exp_match_contrib = 65
            if completeness["has_experience"]:
                exp_match_contrib = 85
                # Seniority checks
                if "senior" in jd_lower and not ("senior" in text_lower or "lead" in text_lower):
                    exp_match_contrib = 55
            else:
                if "senior" in jd_lower or "lead" in jd_lower:
                    exp_match_contrib = 25
                    
            # Project quality match
            proj_quality_contrib = 50
            if completeness["has_projects"]:
                proj_quality_contrib = 75
                # Check for impact metrics
                if re.search(r"star|impact|metrics|optimized|improved|\d+%", text_lower):
                    proj_quality_contrib = 90
            
            # Calculate overall match percentage combining metrics
            # Semantic overlapping counts 40% TF-IDF Cosine Similarity + 30% Skill match + 20% Keyword match + 10% Experience
            overall_jd_match_pct = int(tfidf_similarity * 40 + skill_match_contrib * 30 + keyword_match_contrib * 20 + exp_match_contrib * 10)
            overall_jd_match_pct = max(5, min(overall_jd_match_pct, 100))
            
            # Explanations explaining exact mathematical assignment
            explanations = {
                "ats_match": f"Evaluated at {overall_jd_match_pct}% compatibility based on a TF-IDF text similarity of {int(tfidf_similarity*100)}% and semantic alignment.",
                "skill_match": f"Evaluated at {skill_match_contrib}% based on matching {direct_count} skills directly and {partial_count} skills partially out of {total_targets} target skills.",
                "keyword_match": f"Evaluated at {keyword_match_contrib}% based on matching {direct_count + partial_count} keywords (both direct and related clusters).",
                "experience_match": f"Evaluated at {exp_match_contrib}% based on experience section verification and target role requirements comparison.",
                "project_match": f"Evaluated at {proj_quality_contrib}% based on project completeness, descriptions, and presence of impact metric clauses."
            }
            
            # Convert matched/missing to lists for compatibility
            matched_kws = matched_skills.copy()
            for p in partially_matched_skills:
                matched_kws.append(f"{p['jd_skill']} (via {p['matched_with']})")
                
            jd_match = JdMatchResult(
                match_percentage=overall_jd_match_pct,
                matched_keywords=matched_kws,
                missing_keywords=missing_skills,
                keyword_density=keyword_density,
                skill_match_score=skill_match_contrib,
                experience_match_score=exp_match_contrib,
                project_quality_score=proj_quality_contrib,
                matched_skills=matched_skills,
                partially_matched_skills=partially_matched_skills,
                missing_skills=missing_skills,
                explanations=explanations
            )
            
            # Blend overall score
            overall_score = int(base_calc * 0.5 + overall_jd_match_pct * 0.5)
        else:
            overall_score = int(base_calc)
            
        overall_score = max(5, min(overall_score, 100))
        strength = "Strong" if overall_score >= 80 else ("Average" if overall_score >= 50 else "Weak")
        
        # Query OpenRouter for highly personalized recommendations
        system_prompt = (
            "You are CareerPilot's Senior ATS Auditor and Tech Recruiter. Analyze the provided resume text and target role. "
            "Generate actionable, personalized feedback tailored to this specific resume. "
            "You must output JSON format only, matching this structure exactly:\n"
            "[\n"
            '  {"category": "Resume Improvement Tips", "suggestions": ["Provide 2-3 short suggestions"]},\n'
            '  {"category": "Missing Technical Skills", "suggestions": ["Suggest 2 technical skills to acquire"]},\n'
            '  {"category": "Better Project Descriptions", "suggestions": ["Explain how to rewrite one project bullet point using STAR format"]},\n'
            '  {"category": "Better Achievement Statements", "suggestions": ["Provide 2 examples of quantified achievement lines (e.g. using percentages)"]},\n'
            '  {"category": "Better Action Verbs", "suggestions": ["List 4 stronger action verbs appropriate for the role"]},\n'
            '  {"category": "Resume Summary Improvements", "suggestions": ["Draft a 2-sentence professional summary based on their role"]} \n'
            "]"
        )
        
        user_prompt = (
            f"Target Career Role: {target_role}\n"
            f"ATS Score achieved: {overall_score}/100\n"
            f"Contact Details check: {json.dumps(contact)}\n"
            f"Education/Exp completeness: {json.dumps(completeness)}\n"
            f"Resume Text:\n{resume_text}\n\n"
        )
        if job_description:
            user_prompt += f"Job Description matching context:\n{job_description}\n"
            
        fallback = [
            {
                "category": "Resume Improvement Tips", 
                "suggestions": [
                    "Format sections clearly using capital headers", 
                    "Ensure contact details are located at the very top"
                ]
            },
            {
                "category": "Missing Technical Skills",
                "suggestions": [
                    f"Acquire missing {target_role} taxonomy certifications",
                    "Add cloud/devops containerization (Docker, AWS) items"
                ]
            },
            {
                "category": "Better Project Descriptions",
                "suggestions": [
                    "Rewrite: 'Built a backend web API using Python' -> 'Engineered a high-throughput REST API using Python and FastAPI, reducing query latency by 35% using Redis caching.'"
                ]
            },
            {
                "category": "Better Achievement Statements",
                "suggestions": [
                    "Refactored relational SQL database schemas, reducing index lookups by 22%.",
                    "Collaborated in a team of 4 to design responsive user interfaces, scaling traffic by 40%."
                ]
            },
            {
                "category": "Better Action Verbs",
                "suggestions": ["Spearheaded", "Architected", "Deployed", "Optimized"]
            },
            {
                "category": "Resume Summary Improvements",
                "suggestions": [
                    f"Result-driven engineering student specializing in target-role guidelines, technical algorithms, and scalable web solutions."
                ]
            }
        ]
        
        ai_suggs = llm_service.query_json(system_prompt, user_prompt, fallback_structure=fallback)
        
        # Verify block format to avoid TypeErrors
        if not isinstance(ai_suggs, list):
            ai_suggs = fallback
            
        suggestions_list = []
        for block in ai_suggs:
            if isinstance(block, dict):
                suggestions_list.append(AISuggestionDetail(
                    category=block.get("category", "General Guidance"),
                    suggestions=block.get("suggestions", [])
                ))
            
        skill_gap_detail = SkillGapDetail(
            acquired_skills=skills_analysis["acquired_skills"],
            missing_skills=skills_analysis["missing_skills"],
            recommended_skills=skills_analysis["recommended_skills"],
            learning_priority=skills_analysis["learning_priority"],
            suggested_courses=skills_analysis["suggested_courses"],
            company_readiness=skills_analysis["company_readiness"]
        )
        
        return FullATSReportResponse(
            overall_score=overall_score,
            resume_strength=strength,
            formatting_score=formatting_score,
            grammar_score=grammar_score,
            readability_score=readability_score,
            completeness_score=completeness["completeness_score"],
            contact_info=ContactInfoCheck(**contact),
            completeness=SectionCompleteness(**completeness),
            jd_match=jd_match,
            ai_suggestions=suggestions_list,
            skill_gap=skill_gap_detail,
            raw_text=resume_text
        )

    def analyze_resume(self, text: str, target_role: str) -> ResumeAnalysisResponse:
        report = self.analyze_full_report(text, target_role)
        sections = [k for k, v in report.completeness.dict().items() if v and k != "completeness_score"]
        missing = [k for k, v in report.completeness.dict().items() if not v and k != "completeness_score"]
        
        tips = []
        for s in report.ai_suggestions:
            tips.extend(s.suggestions)
            
        return ResumeAnalysisResponse(
            is_valid=report.completeness_score > 40,
            sections_found=sections,
            missing_sections=missing,
            readability_score=report.readability_score,
            strengths=["Good formatting structure" if report.formatting_score > 70 else "Basic layout structure"],
            weaknesses=["Lacks contact details" if not report.contact_info.has_email else "Could improve action verb usage"],
            improvement_tips=tips[:5]
        )

    def calculate_ats_score(self, resume_text: str, target_role: str, job_description: Optional[str] = None) -> ATSScoreResponse:
        report = self.analyze_full_report(resume_text, target_role, job_description)
        matched_kws = []
        missing_kws = []
        if report.jd_match:
            matched_kws = report.jd_match.matched_keywords
            missing_kws = report.jd_match.missing_keywords
            keyword_pct = report.jd_match.skill_match_score
        else:
            keyword_pct = report.completeness_score
            
        feedback_bullets = [s.suggestions[0] for s in report.ai_suggestions if s.suggestions]
        detailed_feedback = ". ".join(feedback_bullets) if feedback_bullets else "Format and verify key technology items."
        
        return ATSScoreResponse(
            score=report.overall_score,
            keyword_match_percentage=keyword_pct,
            formatting_score=report.formatting_score,
            matched_keywords=matched_kws,
            missing_keywords=missing_kws,
            detailed_feedback=detailed_feedback
        )

    def analyze_skill_gap(self, skills: List[str], target_role: str) -> SkillGapResponse:
        tax_skills = data_loader.skill_taxonomy.get(target_role, ["Python", "SQL", "Git", "Algorithms", "Data Structures"])
        skills_lower = [s.lower().strip() for s in skills]
        acquired = []
        missing = []
        for s in tax_skills:
            if s.lower().strip() in skills_lower:
                acquired.append(s)
            else:
                missing.append(s)
        gap_pct = int((len(missing) / len(tax_skills)) * 100) if tax_skills else 0
        return SkillGapResponse(
            role=target_role,
            acquired_skills=acquired,
            missing_skills=missing,
            skill_gap_percentage=gap_pct
        )

# Global resume service instance
resume_service = ResumeService()
