import os
import json
import pandas as pd
from typing import Dict, List, Any, Optional

DATASETS_DIR = r"C:\CareerPilot_AI\Datasets"

class DataLoader:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DataLoader, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.ats_keywords: pd.DataFrame = pd.DataFrame()
        self.interview_questions: pd.DataFrame = pd.DataFrame()
        self.company_reviews: pd.DataFrame = pd.DataFrame()
        self.jobs: List[Dict[str, Any]] = []
        self.skill_taxonomy: Dict[str, List[str]] = {}
        self.sample_resumes: List[Dict[str, Any]] = []
        self.sample_job_descriptions: pd.DataFrame = pd.DataFrame()
        
        self.load_all()
        self._initialized = True

    def load_all(self):
        print("DataLoader: Initializing and loading datasets...")
        
        # Load ATS Keywords
        ats_path = os.path.join(DATASETS_DIR, "ats_keywords.csv")
        if os.path.exists(ats_path):
            self.ats_keywords = pd.read_csv(ats_path)
            print(f"Loaded ATS keywords: {len(self.ats_keywords)} items.")
        else:
            print(f"WARNING: ATS keywords not found at {ats_path}")

        # Load Company Interview Questions
        questions_path = os.path.join(DATASETS_DIR, "company_interview_questions.csv")
        if os.path.exists(questions_path):
            self.interview_questions = pd.read_csv(questions_path)
            print(f"Loaded interview questions: {len(self.interview_questions)} items.")
        else:
            print(f"WARNING: Interview questions not found at {questions_path}")

        # Load Company Reviews (24 MB) - Cache only unique companies or load efficiently
        reviews_path = os.path.join(DATASETS_DIR, "company_reviews.csv")
        if os.path.exists(reviews_path):
            try:
                # To be efficient, we can load columns we need or just load it with pandas
                # Pandas reads 24MB in <0.5 seconds
                self.company_reviews = pd.read_csv(reviews_path)
                # Drop rows where company name is null
                self.company_reviews = self.company_reviews.dropna(subset=['name'])
                # Deduplicate by name to get unique company profiles (keeping high rating ones)
                # This makes operations on it very fast
                self.company_profiles = self.company_reviews.sort_values(by='rating', ascending=False).drop_duplicates(subset=['name']).to_dict(orient='records')
                self.company_profiles_dict = {str(item['name']).lower(): item for item in self.company_profiles}
                print(f"Loaded company reviews: {len(self.company_reviews)} rows. Cached {len(self.company_profiles_dict)} unique company profiles.")
            except Exception as e:
                print(f"ERROR: Failed to load company reviews: {e}")
                self.company_profiles_dict = {}
        else:
            print(f"WARNING: Company reviews not found at {reviews_path}")
            self.company_profiles_dict = {}

        # Load Job Dataset JSON (cleaner than CSV)
        jobs_json_path = os.path.join(DATASETS_DIR, "job_dataset.json")
        if os.path.exists(jobs_json_path):
            try:
                with open(jobs_json_path, 'r', encoding='utf-8') as f:
                    self.jobs = json.load(f)
                print(f"Loaded job dataset (JSON): {len(self.jobs)} jobs.")
            except Exception as e:
                print(f"ERROR: Failed to load job JSON: {e}. Falling back to CSV.")
                # Fallback to CSV
                jobs_csv_path = os.path.join(DATASETS_DIR, "job_dataset.csv")
                if os.path.exists(jobs_csv_path):
                    df_jobs = pd.read_csv(jobs_csv_path)
                    for _, row in df_jobs.iterrows():
                        skills = [s.strip() for s in str(row.get('Skills', '')).split(';') if s.strip()]
                        resps = [r.strip() for r in str(row.get('Responsibilities', '')).split(';') if r.strip()]
                        self.jobs.append({
                            "JobID": row.get("JobID", ""),
                            "Title": row.get("Title", ""),
                            "ExperienceLevel": row.get("ExperienceLevel", ""),
                            "YearsOfExperience": row.get("YearsOfExperience", ""),
                            "Skills": skills,
                            "Responsibilities": resps,
                            "Keywords": [k.strip() for k in str(row.get('Keywords', '')).split(';') if k.strip()]
                        })
                    print(f"Loaded job dataset (CSV Fallback): {len(self.jobs)} jobs.")
        else:
            print(f"WARNING: Job JSON not found. Trying CSV...")
            jobs_csv_path = os.path.join(DATASETS_DIR, "job_dataset.csv")
            if os.path.exists(jobs_csv_path):
                try:
                    df_jobs = pd.read_csv(jobs_csv_path)
                    for _, row in df_jobs.iterrows():
                        skills = [s.strip() for s in str(row.get('Skills', '')).split(';') if s.strip()]
                        resps = [r.strip() for r in str(row.get('Responsibilities', '')).split(';') if r.strip()]
                        self.jobs.append({
                            "JobID": row.get("JobID", ""),
                            "Title": row.get("Title", ""),
                            "ExperienceLevel": row.get("ExperienceLevel", ""),
                            "YearsOfExperience": row.get("YearsOfExperience", ""),
                            "Skills": skills,
                            "Responsibilities": resps,
                            "Keywords": [k.strip() for k in str(row.get('Keywords', '')).split(';') if k.strip()]
                        })
                    print(f"Loaded job dataset (CSV): {len(self.jobs)} jobs.")
                except Exception as ex:
                    print(f"ERROR: Failed to load job CSV: {ex}")

        # Load Skill Taxonomy
        skills_path = os.path.join(DATASETS_DIR, "skill_taxonomy.json")
        if os.path.exists(skills_path):
            try:
                with open(skills_path, 'r', encoding='utf-8') as f:
                    self.skill_taxonomy = json.load(f)
                print(f"Loaded skill taxonomy roles: {list(self.skill_taxonomy.keys())}")
            except Exception as e:
                print(f"ERROR: Failed to load skill taxonomy: {e}")
        else:
            print(f"WARNING: Skill taxonomy not found at {skills_path}")

        # Load Sample Resumes
        resumes_path = os.path.join(DATASETS_DIR, "sample_resumes.json")
        if os.path.exists(resumes_path):
            try:
                with open(resumes_path, 'r', encoding='utf-8') as f:
                    self.sample_resumes = json.load(f)
                print(f"Loaded sample resumes: {len(self.sample_resumes)}")
            except Exception as e:
                print(f"ERROR: Failed to load sample resumes: {e}")
        else:
            print(f"WARNING: Sample resumes not found at {resumes_path}")

        # Load Sample Job Descriptions
        sample_jd_path = os.path.join(DATASETS_DIR, "sample_job_descriptions.csv")
        if os.path.exists(sample_jd_path):
            self.sample_job_descriptions = pd.read_csv(sample_jd_path)
            print(f"Loaded sample job descriptions: {len(self.sample_job_descriptions)}")
        else:
            print(f"WARNING: Sample job descriptions not found at {sample_jd_path}")

    def get_company_profile(self, name: str) -> Optional[Dict[str, Any]]:
        return self.company_profiles_dict.get(name.lower())

    def get_interview_questions(self, company: Optional[str] = None, role: Optional[str] = None, type_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.interview_questions.empty:
            return []
        
        df = self.interview_questions.copy()
        if company:
            # Case insensitive match
            df = df[df['company'].str.lower() == company.lower()]
        if role:
            df = df[df['role'].str.lower() == role.lower()]
        if type_filter:
            df = df[df['type'].str.lower() == type_filter.lower()]
            
        return df.to_dict(orient='records')

# Global DataLoader instance
data_loader = DataLoader()
