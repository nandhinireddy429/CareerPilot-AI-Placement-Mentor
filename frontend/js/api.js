/* CareerPilot AI Backend API client wrapper */

const API_BASE = (!window.location.origin || window.location.origin === "null" || window.location.protocol === "file:") 
    ? "http://127.0.0.1:8000/api" 
    : `${window.location.origin}/api`;

const API = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        
        // Setup headers
        const token = localStorage.getItem("careerpilot_token");
        const headers = {
            ...(options.headers || {})
        };
        if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `HTTP error ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request Error on ${endpoint}:`, error);
            throw error;
        }
    },

    // 1. Samples & Settings
    async getSampleResumes() {
        return this.request("/sample-resumes");
    },

    // 2. Resume Suite
    async analyzeResume(text, targetRole) {
        return this.request("/resume/analyze", {
            method: "POST",
            body: JSON.stringify({ text, target_role: targetRole })
        });
    },

    async calculateATSScore(resumeText, targetRole, jobDescription = null) {
        return this.request("/resume/ats-score", {
            method: "POST",
            body: JSON.stringify({
                resume_text: resumeText,
                target_role: targetRole,
                job_description: jobDescription
            })
        });
    },

    async analyzeSkillGap(skills, targetRole) {
        return this.request("/resume/skill-gap", {
            method: "POST",
            body: JSON.stringify({ skills, target_role: targetRole })
        });
    },

    // 3. Placement Prep
    async getCompanies() {
        return this.request("/prep/companies");
    },

    async getCompanyPrep(company, role = "SDE") {
        return this.request(`/prep/${encodeURIComponent(company)}?role=${encodeURIComponent(role)}`);
    },

    // 4. Recommendation Engine
    async getRecommendations(skills, targetRole, experienceLevel = "Fresher") {
        return this.request("/recommendations", {
            method: "POST",
            body: JSON.stringify({
                skills,
                target_role: targetRole,
                experience_level: experienceLevel
            })
        });
    },

    // 5. Interview Simulators
    async startMockInterview(company, role, type, difficulty = "Medium") {
        return this.request("/interview/start", {
            method: "POST",
            body: JSON.stringify({
                company,
                role,
                type,
                difficulty
            })
        });
    },

    async submitMockAnswer(qId, question, userAnswer, company, role, type) {
        return this.request("/interview/submit", {
            method: "POST",
            body: JSON.stringify({
                question_id: qId,
                question,
                user_answer: userAnswer,
                company,
                role,
                type
            })
        });
    },

    // 6. Coding Arena
    async generateCodingProblem(topic = "Arrays", difficulty = "Medium") {
        return this.request(`/interview/coding/generate?topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(difficulty)}`);
    },

    async evaluateCode(problemId, code, language = "python", timeTaken = 60) {
        return this.request("/interview/coding/evaluate", {
            method: "POST",
            body: JSON.stringify({
                problem_id: problemId,
                code,
                language,
                time_taken: timeTaken
            })
        });
    },

    // 7. Learning Roadmap
    async generateRoadmap(targetRole, missingSkills) {
        return this.request("/roadmap/generate", {
            method: "POST",
            body: JSON.stringify({
                target_role: targetRole,
                missing_skills: missingSkills
            })
        });
    },

    async getDailyChallenge() {
        return this.request("/challenge/daily");
    },

    // 8. RAG Chat & Search
    async sendMentorMessage(message, history = [], userProfile = null) {
        return this.request("/chat", {
            method: "POST",
            body: JSON.stringify({
                message,
                history,
                user_profile: userProfile
            })
        });
    },

    async semanticSearch(query, category = "all") {
        return this.request(`/semantic-search?query=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`);
    },

    // 9. Auth API
    async login(email, password) {
        return this.request("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
    },

    async signup(name, email, password, targetRole) {
        return this.request("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ name, email, password, target_role: targetRole })
        });
    },

    async getMe() {
        return this.request("/auth/me", {
            method: "GET"
        });
    },

    async updateProfile(profile) {
        return this.request("/auth/profile", {
            method: "PUT",
            body: JSON.stringify(profile)
        });
    },

    // 10. ATS Resume Suite
    async uploadResume(file) {
        const formData = new FormData();
        formData.append("file", file);
        return this.request("/resume/upload", {
            method: "POST",
            body: formData
        });
    },

    async analyzeFullResume(resumeText, targetRole, jobDescription = null) {
        return this.request("/resume/analyze-full", {
            method: "POST",
            body: JSON.stringify({
                resume_text: resumeText,
                target_role: targetRole,
                job_description: jobDescription
            })
        });
    },

    async getResumeHistory() {
        return this.request("/resume/history", {
            method: "GET"
        });
    },

    async clearResumeHistory() {
        return this.request("/resume/history", {
            method: "DELETE"
        });
    },

    // 11. Live Progress & Streaks
    async getUserStats() {
        return this.request("/user/stats", {
            method: "GET"
        });
    },

    async skipCodingChallenge(problemId) {
        return this.request("/coding/skip", {
            method: "POST",
            body: JSON.stringify({ problem_id: problemId })
        });
    },

    async bookmarkCodingChallenge(problemId) {
        return this.request("/coding/bookmark", {
            method: "POST",
            body: JSON.stringify({ problem_id: problemId })
        });
    },

    async removeCodingBookmark(problemId) {
        return this.request(`/coding/bookmark/${encodeURIComponent(problemId)}`, {
            method: "DELETE"
        });
    },

    async triggerLoginStreak() {
        return this.request("/login-streak", {
            method: "POST"
        });
    }
};
