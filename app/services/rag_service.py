import os
import numpy as np
from typing import List, Dict, Any, Tuple
from backend.app.utils.data_loader import data_loader
from backend.app.services.llm_service import llm_service

# Attempt to import sentence-transformers, fallback to TF-IDF if unavailable
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("WARNING: sentence-transformers not found. RAG service will fall back to TF-IDF semantic search.")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("WARNING: scikit-learn not found. RAG service will fall back to simple keyword matching.")


class RAGService:
    def __init__(self):
        self.documents: List[Dict[str, Any]] = []
        self.embeddings = None
        self.model = None
        self.vectorizer = None
        self.tfidf_matrix = None
        
        # Initialize document corpus and vector index
        self.build_corpus()
        self.initialize_vector_db()

    def build_corpus(self):
        """
        Gathers text blocks from jobs, interview questions, and company reviews to build the vector corpus.
        """
        print("RAGService: Building corpus from datasets...")
        self.documents = []

        # 1. Index Jobs from job_dataset
        for job in data_loader.jobs:
            skills_str = ", ".join(job.get("Skills", []))
            resp_str = ". ".join(job.get("Responsibilities", []))
            text = f"Job Title: {job.get('Title')} in target role. Experience Level: {job.get('ExperienceLevel')}. Required Skills: {skills_str}. Responsibilities: {resp_str}."
            self.documents.append({
                "text": text,
                "title": job.get("Title"),
                "category": "jobs",
                "metadata": {
                    "job_id": job.get("JobID"),
                    "experience_level": job.get("ExperienceLevel"),
                    "years_of_experience": job.get("YearsOfExperience"),
                    "skills": job.get("Skills")
                }
            })

        # 2. Index Interview Questions
        if not data_loader.interview_questions.empty:
            for _, row in data_loader.interview_questions.iterrows():
                q = row.get("question")
                company = row.get("company")
                role = row.get("role")
                topic = row.get("topic")
                difficulty = row.get("difficulty")
                text = f"Company: {company}. Interview Role: {role}. Question Type: {row.get('type')}. Topic: {topic}. Question: {q}. Difficulty: {difficulty}."
                self.documents.append({
                    "text": text,
                    "title": f"{company} {role} Interview Question",
                    "category": "questions",
                    "metadata": {
                        "company": company,
                        "role": role,
                        "type": row.get("type"),
                        "topic": topic,
                        "difficulty": difficulty,
                        "question": q
                    }
                })

        # 3. Index Company Profiles (using unique company profiles to keep corpus size optimal)
        for name, profile in data_loader.company_profiles_dict.items():
            desc = profile.get("description", "")
            industry = profile.get("industry", "")
            locations = profile.get("locations", "")
            text = f"Company: {profile.get('name')}. Industry: {industry}. Description: {desc}. HQ: {profile.get('headquarters')}. Locations: {locations}."
            self.documents.append({
                "text": text,
                "title": f"Company Profile: {profile.get('name')}",
                "category": "companies",
                "metadata": {
                    "company": profile.get("name"),
                    "rating": profile.get("rating"),
                    "website": profile.get("website"),
                    "industry": industry
                }
            })

        print(f"RAGService: Completed corpus setup with {len(self.documents)} documents.")

    def initialize_vector_db(self):
        """
        Embeds the corpus using local SentenceTransformers if available, else TF-IDF.
        """
        if not self.documents:
            print("RAGService: Corpus is empty. Skipping index creation.")
            return

        texts = [doc["text"] for doc in self.documents]

        # Try SentenceTransformers first
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                print("RAGService: Loading sentence-transformers model (all-MiniLM-L6-v2)...")
                # Suppress huggingface download progress bars/output to keep log clean
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
                print("RAGService: Encoding documents (this might take a moment)...")
                self.embeddings = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
                print("RAGService: Local vector database initialized successfully.")
                return
            except Exception as e:
                print(f"RAGService: SentenceTransformers error: {e}. Falling back to TF-IDF.")

        # Fallback to TF-IDF
        if SKLEARN_AVAILABLE:
            try:
                print("RAGService: Initializing TF-IDF vector database fallback...")
                self.vectorizer = TfidfVectorizer(stop_words='english')
                self.tfidf_matrix = self.vectorizer.fit_transform(texts)
                print("RAGService: TF-IDF database initialized successfully.")
            except Exception as e:
                print(f"RAGService: TF-IDF initialization error: {e}")
        else:
            print("RAGService: No vectorization library available. Falling back to keyphrase match.")

    def search(self, query: str, category: str = "all", top_k: int = 5) -> List[Tuple[Dict[str, Any], float]]:
        """
        Performs semantic search on the vector corpus.
        Returns a list of tuples containing (document_dict, similarity_score).
        """
        if not self.documents:
            return []

        # Filter documents by category if requested
        filtered_indices = []
        for i, doc in enumerate(self.documents):
            if category == "all" or doc["category"] == category:
                filtered_indices.append(i)

        if not filtered_indices:
            return []

        # Perform similarity score calculation
        scores = []
        
        # 1. SentenceTransformers similarity
        if self.embeddings is not None and self.model is not None:
            try:
                query_vector = self.model.encode([query], convert_to_numpy=True)[0]
                for idx in filtered_indices:
                    doc_vector = self.embeddings[idx]
                    # Cosine similarity
                    dot_product = np.dot(query_vector, doc_vector)
                    norm_q = np.linalg.norm(query_vector)
                    norm_d = np.linalg.norm(doc_vector)
                    score = dot_product / (norm_q * norm_d) if norm_q > 0 and norm_d > 0 else 0.0
                    scores.append((self.documents[idx], float(score)))
            except Exception as e:
                print(f"RAGService: Search execution failed with model: {e}. Trying TF-IDF fallback...")
                
        # 2. TF-IDF similarity (if model failed or wasn't loaded)
        if not scores and self.tfidf_matrix is not None and self.vectorizer is not None:
            try:
                query_vector = self.vectorizer.transform([query])
                # Compute similarities for the subset
                similarities = cosine_similarity(query_vector, self.tfidf_matrix).flatten()
                for idx in filtered_indices:
                    scores.append((self.documents[idx], float(similarities[idx])))
            except Exception as e:
                print(f"RAGService: TF-IDF search error: {e}")

        # 3. Simple Keyword Match Fallback (if both failed)
        if not scores:
            query_words = set(query.lower().split())
            for idx in filtered_indices:
                doc_text = self.documents[idx]["text"].lower()
                matches = sum(1 for word in query_words if word in doc_text)
                score = matches / len(query_words) if query_words else 0.0
                scores.append((self.documents[idx], score))

        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    def answer_question(self, query: str, user_profile_context: str = "", history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Retrieves context using semantic search and queries the LLM to generate a grounded response.
        """
        results = self.search(query, category="all", top_k=4)
        
        context_str = ""
        citations = []
        for i, (doc, score) in enumerate(results):
            if score > 0.15:  # Relevance threshold
                context_str += f"Context Source {i+1} ({doc['title']}): {doc['text']}\n\n"
                citations.append({
                    "title": doc["title"],
                    "category": doc["category"],
                    "score": round(score, 2),
                    "summary": doc["text"][:150] + "..."
                })

        system_prompt = (
            "You are CareerPilot AI, an elite personal AI Placement Mentor. Your job is to answer the student's career, resume, and interview questions. "
            "Use the provided context datasets (jobs, interview questions, company reviews) to answer the query accurately. "
            "Be encouraging, highly professional, and structure your responses with markdown bullets, bold headers, and short paragraphs. "
            "If the answer cannot be found in the context, use your built-in placement mentorship expertise, but favor the context details when available. "
            "Do not fabricate credentials or dummy urls. State facts clearly."
        )

        user_prompt = f"User Profile Context: {user_profile_context}\n\n"
        if context_str:
            user_prompt += f"Grounded Context Data:\n{context_str}\n"
        user_prompt += f"Student Query: {query}\n\nAnswer the query using the above context."

        answer = llm_service.query(system_prompt, user_prompt, history=history, temperature=0.6)
        
        if not answer or answer.startswith("Error") or "error" in answer.lower():
            if citations:
                fallback_parts = [
                    f"### 📚 Grounded Placement Guidance for: *\"{query}\"*\n",
                    "Based on CareerPilot's placement database, here is the retrieved matching information for your query:\n"
                ]
                for i, cite in enumerate(citations[:3]):
                    fallback_parts.append(
                        f"**{i+1}. {cite['title']}** (Category: *{cite['category'].upper()}*, Relevance Match: {int(cite['score']*100)}%)\n"
                        f"> {cite['summary']}\n"
                    )
                fallback_parts.append(
                    "\n*Note: CareerPilot AI service is currently operating in offline mode. Direct placement database matches are displayed above.*"
                )
                answer = "\n".join(fallback_parts)
            else:
                q_lower = query.lower()
                if "resume" in q_lower:
                    answer = (
                        "### 📄 Resume Optimization Advice\n\n"
                        "To optimize your resume for applicant tracking systems (ATS):\n"
                        "1. **Include Key Tech Keywords**: Match the precise skills requested in the job description.\n"
                        "2. **Quantify Metrics**: Use numbers to describe achievements (e.g., 'Optimized query latency by 40%').\n"
                        "3. **Simple Formatting**: Avoid complex tables or multi-column grids that confuse ATS parsers.\n\n"
                        "You can upload your resume in the **Resume Suite** tab for a detailed analysis."
                    )
                elif "interview" in q_lower or "prepare" in q_lower or "prep" in q_lower or "sde" in q_lower or "role" in q_lower:
                    answer = (
                        "### 🎯 Placement Preparation Advice\n\n"
                        "For tech company recruitment processes (like Google, Amazon, TCS):\n"
                        "1. **Data Structures & Algorithms**: Master Arrays, Strings, Trees, and Dynamic Programming in the **Coding Playground**.\n"
                        "2. **Mock Practice**: Perform mock interview rounds under the **Interview Arena** tab.\n"
                        "3. **Targeted Research**: Read specific company strategies in the **Placement Prep** tab."
                    )
                else:
                    answer = (
                        "### 💡 CareerPilot Placement Guidance\n\n"
                        "I am happy to guide you! To prepare effectively for campus placements:\n"
                        "- Keep your resume updated and tailored to specific job profiles.\n"
                        "- Solve daily coding challenges on arrays and strings.\n"
                        "- Build projects with modern tech stacks like Python, Node.js, and SQL databases.\n\n"
                        "Please select the target tabs in the left sidebar to access our sandbox resources."
                    )
        
        return {
            "response": answer,
            "sources": citations
        }

# Global RAG service instance
rag_service = RAGService()
