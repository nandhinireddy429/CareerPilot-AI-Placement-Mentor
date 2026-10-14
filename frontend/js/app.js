/* CareerPilot AI Main Single Page Application Logic */

// Global State
const STATE = {
    profile: {
        name: "Guest Student",
        target_role: "SDE",
        skills: ["Python", "Data Structures", "Algorithms", "SQL", "Git"],
        education: "B.Tech Computer Science, ABC University, CGPA 8.5",
        experience: "Web Development Intern at StartupX - built database REST APIs",
        projects: "URL Shortener in Python; Personal Blog Website using FastAPI"
    },
    sampleResumes: [],
    companies: [],
    chatHistory: [],
    currentMockQuestion: null,
    currentCodingProblem: null,
    dailyChallenge: null
};

// Initialize app when DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    loadProfileFromStorage();
    checkLoginStatus();
    initApp();
    verifySession();
});

function loadProfileFromStorage() {
    const saved = localStorage.getItem("careerpilot_profile");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === "object") {
                STATE.profile = {
                    name: parsed.name || "Guest Student",
                    target_role: parsed.target_role || "SDE",
                    skills: Array.isArray(parsed.skills) ? parsed.skills : ["Python", "SQL", "Git"],
                    education: parsed.education || "B.Tech Student",
                    experience: parsed.experience || "Student",
                    projects: parsed.projects || "Personal Projects"
                };
            }
        } catch (e) {
            console.error("Failed to parse saved profile:", e);
        }
    }
    updateProfileUI();
}

function saveProfileToStorage() {
    localStorage.setItem("careerpilot_profile", JSON.stringify(STATE.profile));
    updateProfileUI();
}

function updateProfileUI() {
    const name = STATE.profile.name || "Guest Student";
    const role = STATE.profile.target_role || "SDE";
    const skills = Array.isArray(STATE.profile.skills) ? STATE.profile.skills : ["Python", "SQL", "Git"];
    const edu = STATE.profile.education || "";
    const exp = STATE.profile.experience || "";
    const proj = STATE.profile.projects || "";

    const userDispName = document.getElementById("user-display-name");
    if (userDispName) userDispName.textContent = name;
    
    const userDispRole = document.getElementById("user-display-role");
    if (userDispRole) userDispRole.textContent = `${role} Aspirant`;
    
    // Update profile modal inputs
    const pName = document.getElementById("profile-name");
    if (pName) pName.value = name;
    
    const pRole = document.getElementById("profile-role");
    if (pRole) pRole.value = role;
    
    const pSkills = document.getElementById("profile-skills-input");
    if (pSkills) pSkills.value = skills.join(", ");
    
    const pEdu = document.getElementById("profile-education");
    if (pEdu) pEdu.value = edu;
    
    const pExp = document.getElementById("profile-experience");
    if (pExp) pExp.value = exp;
    
    const pProj = document.getElementById("profile-projects");
    if (pProj) pProj.value = proj;
}

function initApp() {
    // 0. Setup authentication page handlers
    setupLoginHandlers();
    
    // 1. Setup Icons & Navigation
    if (window.lucide) {
        window.lucide.createIcons();
    }
    setupNavigation();
    setupThemeToggle();
    setupProfileModal();
    
    // 2. Load Core Data
    loadSampleResumes();
    loadCompanyList();
    loadDailyChallenge();
    
    // 3. Initialize Dashboard Graphics
    updateDashboardMetrics();
    
    // 4. Hook Event Handlers
    hookActionButtons();
}

let isNavigatingHistory = false;

function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const panels = document.querySelectorAll(".tab-panel");
    const backBtn = document.getElementById("header-back-btn");
    
    const titles = {
        dashboard: { title: "Placement Dashboard", subtitle: "Welcome back! Here's your career preparation readiness." },
        mentor: { title: "AI Career Mentor", subtitle: "Ask placement advice, job descriptions, and general career guidelines." },
        resume: { title: "Resume Suite", subtitle: "Scan your resume formatting, keywords, and get ATS feedback." },
        prep: { title: "Placement Preparation", subtitle: "Review companies, compensation packages, and recruitment guidelines." },
        interview: { title: "Interview Arena", subtitle: "Test your skill set in HR rounds, Technical Q&A, and Code sandboxes." },
        roadmap: { title: "Learning Roadmap", subtitle: "Track week-by-week goals to bridge key skill gaps." }
    };

    function switchToTab(tabId, pushHistory = true) {
        // Toggle active nav link
        navItems.forEach(n => n.classList.remove("active"));
        const activeLink = Array.from(navItems).find(n => n.getAttribute("data-tab") === tabId);
        if (activeLink) activeLink.classList.add("active");
        
        // Toggle active panel
        panels.forEach(p => p.classList.remove("active"));
        
        // Hide search panel overlay if visible
        document.getElementById("search-results-panel").classList.add("hidden");
        
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) {
            targetPanel.classList.add("active");
        }

        // Update page headers
        const info = titles[tabId] || { title: "CareerPilot AI", subtitle: "" };
        document.getElementById("current-tab-title").textContent = info.title;
        document.getElementById("current-tab-subtitle").textContent = info.subtitle;
        
        // Toggle header back button visibility
        if (backBtn) {
            if (tabId === "dashboard") {
                backBtn.classList.add("hidden");
            } else {
                backBtn.classList.remove("hidden");
            }
        }
        
        // Push state to history if requested
        if (pushHistory && !isNavigatingHistory) {
            window.history.pushState({ tabId }, "", `#${tabId}`);
        }
        
        // If returning to dashboard, redraw chart
        if (tabId === "dashboard") {
            updateDashboardMetrics();
        }
        
        // If navigating to roadmap, update roadmap checkboxes
        if (tabId === "roadmap") {
            populateRoadmapCheckboxes();
        }
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            // Check if there is history in our state to go back to
            if (window.history.state && window.history.state.tabId && window.history.state.tabId !== "dashboard") {
                window.history.back();
            } else {
                // Otherwise fallback directly to Home (dashboard)
                switchToTab("dashboard", true);
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            switchToTab(tabId, true);
        });
    });

    // Listen for back/forward browser buttons
    window.addEventListener("popstate", (e) => {
        isNavigatingHistory = true;
        const tabId = (e.state && e.state.tabId) ? e.state.tabId : "dashboard";
        switchToTab(tabId, false);
        isNavigatingHistory = false;
    });

    // Initial load tab resolution from hash URL
    const hash = window.location.hash.substring(1);
    if (hash && titles[hash]) {
        switchToTab(hash, false);
    } else {
        // Push initial state
        window.history.replaceState({ tabId: "dashboard" }, "", "#dashboard");
    }
}

function setupThemeToggle() {
    const toggle = document.getElementById("theme-switch");
    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
        }
        // Redraw chart with active theme text colors
        if (document.getElementById("dashboard").classList.contains("active")) {
            updateDashboardMetrics();
        }
    });
}

function setupProfileModal() {
    const modal = document.getElementById("profile-modal");
    const editBtn = document.getElementById("edit-profile-btn");
    const closeBtn = document.getElementById("close-profile-modal-btn");
    const cancelBtn = document.getElementById("cancel-profile-btn");
    const saveBtn = document.getElementById("save-profile-btn");

    editBtn.addEventListener("click", () => modal.classList.remove("hidden"));
    
    const closeModal = () => modal.classList.add("hidden");
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);

    saveBtn.addEventListener("click", async () => {
        const skillsRaw = document.getElementById("profile-skills-input").value;
        const submitBtn = saveBtn;
        UI.toggleButtonLoading(submitBtn, true, "Saving...");
        
        const updatedProfile = {
            name: document.getElementById("profile-name").value.trim() || "Guest Student",
            target_role: document.getElementById("profile-role").value,
            skills: skillsRaw.split(",").map(s => s.trim()).filter(s => s.length > 0),
            education: document.getElementById("profile-education").value.trim(),
            experience: document.getElementById("profile-experience").value.trim(),
            projects: document.getElementById("profile-projects").value.trim(),
            summary: STATE.profile.summary || ""
        };
        
        try {
            const savedProfile = await API.updateProfile(updatedProfile);
            STATE.profile = savedProfile;
            saveProfileToStorage();
            closeModal();
            UI.showNotification("Student profile details synced with backend successfully!", "success");
            updateDashboardMetrics();
        } catch (e) {
            UI.showNotification("Failed to save profile changes to the server database.", "error");
        } finally {
            UI.toggleButtonLoading(submitBtn, false, "Save changes");
        }
    });
}

async function updateDashboardMetrics() {
    const skillsCount = STATE.profile ? STATE.profile.skills.length : 3;
    let stats = {
        total_solved: 0,
        easy_solved: 0,
        medium_solved: 0,
        hard_solved: 0,
        acceptance_rate: 0,
        rating: 1500,
        interviews_count: 0,
        resumes_count: 0,
        login_streak: 1,
        learning_hours: 0.0,
        skill_progress: 25,
        ai_readiness: 40,
        placement_readiness: 45
    };
    
    const token = localStorage.getItem("careerpilot_token");
    if (token) {
        try {
            stats = await API.getUserStats();
        } catch (err) {
            console.warn("Failed to fetch live stats from server. Using local calculated parameters.", err);
        }
    }
    
    // Bind 11 Live stats values
    const statCodingSolved = document.getElementById("stat-coding-solved");
    if (statCodingSolved) statCodingSolved.textContent = stats.total_solved;
    
    const statDifficultyBreakdown = document.getElementById("stat-difficulty-breakdown");
    if (statDifficultyBreakdown) {
        statDifficultyBreakdown.textContent = `Easy: ${stats.easy_solved} | Med: ${stats.medium_solved} | Hard: ${stats.hard_solved}`;
    }
    
    const statCodingAccuracy = document.getElementById("stat-coding-accuracy");
    if (statCodingAccuracy) statCodingAccuracy.textContent = `${stats.total_solved > 0 ? stats.acceptance_rate : 0}%`;
    
    const statAcceptanceRate = document.getElementById("stat-acceptance-rate");
    if (statAcceptanceRate) statAcceptanceRate.textContent = `Acceptance: ${stats.acceptance_rate}%`;
    
    const statCodingRating = document.getElementById("stat-coding-rating");
    if (statCodingRating) statCodingRating.textContent = stats.rating;
    
    const statRatingRank = document.getElementById("stat-rating-rank");
    if (statRatingRank) {
        statRatingRank.textContent = `Rank: ${stats.rating >= 2200 ? 'Grandmaster Candidate' : (stats.rating >= 1800 ? 'Advanced Specialist' : (stats.rating >= 1600 ? 'Rising Star' : 'Beginner Candidate'))}`;
    }
    
    const statInterviewsCount = document.getElementById("stat-interviews-count");
    if (statInterviewsCount) statInterviewsCount.textContent = stats.interviews_count;
    
    const statResumesCount = document.getElementById("stat-resumes-count");
    if (statResumesCount) statResumesCount.textContent = stats.resumes_count;
    
    const statLoginStreak = document.getElementById("stat-login-streak");
    if (statLoginStreak) statLoginStreak.textContent = `${stats.login_streak} Days`;
    
    const statLearningHours = document.getElementById("stat-learning-hours");
    if (statLearningHours) statLearningHours.textContent = `${stats.learning_hours} Hours`;
    
    const statSkillsProgress = document.getElementById("stat-skills-progress");
    if (statSkillsProgress) statSkillsProgress.textContent = `Skills Progress: ${stats.skill_progress}%`;
    
    const statReadinessScores = document.getElementById("stat-readiness-scores");
    if (statReadinessScores) {
        statReadinessScores.textContent = `AI: ${stats.ai_readiness}% | Placement: ${stats.placement_readiness}%`;
    }
    
    // Bind Summary Top-level Cards
    const atsScoreVal = stats.placement_readiness;
    document.getElementById("dash-ats-score").textContent = `${atsScoreVal}%`;
    document.getElementById("dash-ats-trend").textContent = atsScoreVal > 75 ? "Excellent" : (atsScoreVal > 60 ? "Good" : "Needs Work");
    document.getElementById("dash-ats-trend").className = `badge ${atsScoreVal > 75 ? 'badge-success' : (atsScoreVal > 60 ? 'badge-purple' : 'badge-warning')}`;
    
    const dashStreak = document.getElementById("dash-streak");
    if (dashStreak) dashStreak.textContent = `${stats.login_streak} Days`;
    
    const dashChallenges = document.getElementById("dash-challenges");
    if (dashChallenges) {
        dashChallenges.textContent = `${stats.total_solved} Solved`;
    }
    
    // Render Skills Radar Chart
    let labels = [];
    let values = [];
    
    const targetRole = STATE.profile ? STATE.profile.target_role : "SDE";
    if (targetRole === "SDE") {
        labels = ["Problem Solving", "System Design", "SQL & DBs", "Git & CI/CD", "Coding Speed", "CS Fundamentals"];
        values = [
            stats.skill_progress,
            stats.ai_readiness,
            stats.placement_readiness,
            Math.min(stats.total_solved * 12, 100),
            Math.min(stats.rating / 22, 100),
            75
        ];
    } else if (targetRole === "ML Engineer") {
        labels = ["Math & Stats", "Model Deploys", "Python Basics", "Deep Learning", "SQL & Querying", "Data Preprocessing"];
        values = [
            stats.skill_progress,
            stats.ai_readiness,
            stats.placement_readiness,
            Math.min(stats.total_solved * 12, 100),
            Math.min(stats.rating / 22, 100),
            80
        ];
    } else {
        labels = ["Data Viz", "SQL Analysis", "Excel/Sheets", "Statistics", "Presentation", "Domain Focus"];
        values = [
            stats.skill_progress,
            stats.ai_readiness,
            stats.placement_readiness,
            Math.min(stats.total_solved * 12, 100),
            Math.min(stats.rating / 22, 100),
            65
        ];
    }
    
    UI.initChart(labels, values);
    
    // Refresh Internship recommendations list
    updateJobRecommendations();
}

// ----------------------------------------------------
// Core feature methods
// ----------------------------------------------------

async function loadSampleResumes() {
    const row = document.getElementById("sample-resumes-btn-row");
    try {
        const samples = await API.getSampleResumes();
        STATE.sampleResumes = samples;
        
        row.innerHTML = "";
        samples.forEach((sample, idx) => {
            const btn = document.createElement("button");
            btn.className = "btn btn-sm btn-secondary";
            btn.textContent = sample.name;
            btn.addEventListener("click", () => {
                // Populate resume content inputs
                let resumeText = `NAME: ${sample.name}\nTARGET ROLE: ${sample.target_role}\n\n`;
                resumeText += `SUMMARY:\n${sample.sections.summary}\n\n`;
                resumeText += `EDUCATION:\n${sample.sections.education}\n\n`;
                resumeText += `EXPERIENCE:\n${sample.sections.experience}\n\n`;
                resumeText += `PROJECTS:\n${sample.sections.projects}\n\n`;
                resumeText += `SKILLS:\n${sample.sections.skills.join(", ")}`;
                
                document.getElementById("resume-text-input").value = resumeText;
                document.getElementById("resume-target-role").value = sample.target_role;
                UI.showNotification(`Loaded profile for ${sample.name}.`, "info");
            });
            row.appendChild(btn);
        });
    } catch (e) {
        row.innerHTML = `<span class="empty-msg">Error loading samples. Input manually.</span>`;
    }
}

async function loadCompanyList() {
    const select = document.getElementById("prep-company-select");
    try {
        const list = await API.getCompanies();
        STATE.companies = list;
        
        select.innerHTML = "";
        
        // Push top tier defaults first if any, then alphabetical
        const topTier = ["Amazon", "Google", "Flipkart", "TCS", "Wipro"];
        const others = list.filter(c => !topTier.includes(c));
        
        const finalSorted = [...topTier.filter(c => list.includes(c)), ...others];
        
        finalSorted.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            select.appendChild(opt);
        });
        
        // Load default prep strategy at start
        if (finalSorted.length > 0) {
            loadCompanyPrep(finalSorted[0]);
        }
    } catch (e) {
        select.innerHTML = `<option value="">Failed to load list</option>`;
    }
}

async function loadDailyChallenge() {
    try {
        const prob = await API.getDailyChallenge();
        STATE.dailyChallenge = prob;
        document.getElementById("dash-daily-title").textContent = prob.title;
        document.getElementById("dash-daily-diff").textContent = prob.difficulty;
        document.getElementById("dash-daily-diff").className = `difficulty-badge ${prob.difficulty.toLowerCase()}`;
        document.getElementById("dash-daily-topic").textContent = prob.topic;
    } catch (e) {
        console.error("Daily challenge fetch failed:", e);
        document.getElementById("dash-daily-title").textContent = "Dynamic Arrays Check";
    }
}

function populateRoadmapCheckboxes() {
    // Fill checkboxes based on selected target role in roadmap tab
    const roleSelect = document.getElementById("roadmap-role-select");
    const container = document.getElementById("roadmap-skills-checkboxes");
    
    // Map of role to skills taxonomy from our loaders
    const taxonomy = {
        "SDE": ["Data Structures", "Algorithms", "OOP", "System Design", "Git", "REST APIs", "SQL", "Problem Solving"],
        "ML Engineer": ["Python", "Machine Learning", "Deep Learning", "Model Deployment", "SQL", "Statistics", "MLOps", "Data Preprocessing"],
        "Data Analyst": ["SQL", "Excel", "Python", "Statistics", "Data Visualization", "Power BI/Tableau", "A/B Testing"],
        "QA Engineer": ["Manual Testing", "Automation Testing (Selenium)", "Test Case Design", "Bug Tracking (JIRA)", "SQL", "API Testing"],
        "System Engineer": ["Networking", "Linux", "Cloud Basics (AWS/Azure)", "Scripting (Bash/Python)", "Troubleshooting", "OS Concepts"]
    };

    const role = roleSelect.value;
    const skills = taxonomy[role] || taxonomy["SDE"];
    
    container.innerHTML = "";
    skills.forEach(skill => {
        const isAcquired = STATE.profile.skills.some(us => us.toLowerCase() === skill.toLowerCase());
        
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = skill;
        checkbox.checked = !isAcquired; // Auto-check missing skills to learn!
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(isAcquired ? ` ${skill} (Already Acquired)` : ` ${skill}`));
        if (isAcquired) {
            label.style.opacity = "0.6";
        }
        
        container.appendChild(label);
    });
}

function hookActionButtons() {
    // Global search
    const searchBtn = document.getElementById("global-search-btn");
    const searchInput = document.getElementById("global-search-input");
    const closeSearchBtn = document.getElementById("close-search-btn");
    
    const runSearch = async () => {
        const val = searchInput.value.trim();
        if (val.length < 2) {
            UI.showNotification("Search query must be at least 2 characters.", "warning");
            return;
        }
        
        // Show panel
        const panel = document.getElementById("search-results-panel");
        const panels = document.querySelectorAll(".tab-panel");
        panels.forEach(p => p.classList.remove("active"));
        panel.classList.remove("hidden");
        panel.classList.add("active");
        
        const backBtn = document.getElementById("header-back-btn");
        if (backBtn) backBtn.classList.remove("hidden");
        
        document.getElementById("current-tab-title").textContent = "Semantic Retrieval Search";
        document.getElementById("current-tab-subtitle").textContent = `Query results matching: "${val}"`;
        
        const container = document.getElementById("semantic-search-results");
        container.innerHTML = `<div class="no-citations"><span class="spinner"></span> Querying vector store...</div>`;
        
        try {
            const res = await API.semanticSearch(val);
            container.innerHTML = "";
            
            if (res.results.length === 0) {
                container.innerHTML = `<div class="no-citations">No relevant records found. Try another search.</div>`;
                return;
            }
            
            res.results.forEach(item => {
                const card = document.createElement("div");
                card.className = "glass-card search-result-card";
                
                card.innerHTML = `
                    <div class="result-meta-row">
                        <span class="result-type-tag ${item.category}">${item.category}</span>
                        <span class="result-score">Relevance: ${(item.score * 100).toFixed(0)}%</span>
                    </div>
                    <h5>${item.title}</h5>
                    <p class="result-snippet">${item.content}</p>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            container.innerHTML = `<div class="no-citations" style="color:var(--error)">Error searching semantic store database.</div>`;
        }
    };

    searchBtn.addEventListener("click", runSearch);
    searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") runSearch(); });
    closeSearchBtn.addEventListener("click", () => {
        document.getElementById("search-results-panel").classList.add("hidden");
        document.querySelector("[data-tab=dashboard]").click();
    });

    // Solve Daily button
    document.getElementById("solve-daily-btn").addEventListener("click", () => {
        if (!STATE.dailyChallenge) return;
        
        // Open Interview tab
        document.querySelector("[data-tab=interview]").click();
        // Toggle playground subtab
        document.querySelector("[data-arenatab=coding-playground-arena]").click();
        
        // Pop problem details
        populateCodingProblem(STATE.dailyChallenge);
    });

    // Chatbot send message
    const chatInput = document.getElementById("mentor-chat-input");
    const sendChatBtn = document.getElementById("mentor-send-btn");
    
    const sendChatMsg = async () => {
        const msg = chatInput.value.trim();
        if (!msg) return;
        
        chatInput.value = "";
        chatInput.disabled = true;
        sendChatBtn.disabled = true;
        
        // Render user message bubble
        const msgContainer = document.getElementById("mentor-chat-messages");
        const userBubble = document.createElement("div");
        userBubble.className = "chat-bubble user";
        userBubble.innerHTML = `<p>${msg}</p><span class="time">Just now</span>`;
        msgContainer.appendChild(userBubble);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        
        // Request backend response
        const aiBubble = document.createElement("div");
        aiBubble.className = "chat-bubble ai";
        aiBubble.innerHTML = `<p><span class="spinner"></span> AI is compiling context...</p>`;
        msgContainer.appendChild(aiBubble);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        
        try {
            const data = await API.sendMentorMessage(msg, STATE.chatHistory, STATE.profile);
            
            // Format answer with markdown
            const formatted = UI.formatMarkdown(data.response);
            aiBubble.innerHTML = `<p>${formatted}</p><span class="time">Just now</span>`;
            
            // Append history
            STATE.chatHistory.push({ role: "user", content: msg });
            STATE.chatHistory.push({ role: "assistant", content: data.response });
            
            // Keep history trimmed to last 10 messages for token boundaries
            if (STATE.chatHistory.length > 10) STATE.chatHistory.shift();
            
            // Populate RAG Citations
            const citeContainer = document.getElementById("mentor-citations");
            citeContainer.innerHTML = "";
            
            if (data.sources && data.sources.length > 0) {
                data.sources.forEach(src => {
                    const card = document.createElement("div");
                    card.className = "citation-card";
                    card.innerHTML = `
                        <div class="citation-header">
                            <span class="citation-title">${src.title}</span>
                            <span class="citation-score">Match: ${(src.score * 100).toFixed(0)}%</span>
                        </div>
                        <p class="citation-summary">${src.summary}</p>
                    `;
                    citeContainer.appendChild(card);
                });
            } else {
                citeContainer.innerHTML = `<div class="no-citations">No citations indexed for last query.</div>`;
            }
        } catch (e) {
            aiBubble.innerHTML = `<p style="color:var(--error)">Failed to contact Placement Mentor. Check backend terminal logs.</p>`;
        } finally {
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            chatInput.focus();
        }
        msgContainer.scrollTop = msgContainer.scrollHeight;
    };
    
    sendChatBtn.addEventListener("click", sendChatMsg);
    chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChatMsg(); });

    // --- Upgraded ATS Resume Suite Event Handlers & View Renders ---

    // 1. Circular Gauge Canvas Drawing
    function drawCircularGauge(score, strength) {
        const canvas = document.getElementById("atsScoreCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        const radius = 55;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Track circle outline
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 8;
        ctx.stroke();
        
        // Outer glow/stroke indicator
        let color = "#ef4444"; // default red
        if (score >= 80) color = "#10b981"; // success green
        else if (score >= 50) color = "#8b5cf6"; // warning purple
        
        ctx.beginPath();
        ctx.arc(x, y, radius, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * (score / 100)));
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.stroke();
        
        // Core score text
        ctx.font = "bold 26px Outfit";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${score}%`, x, y - 5);
        
        // Strength category label
        ctx.font = "700 9px Plus Jakarta Sans";
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillText(strength.toUpperCase(), x, y + 20);
    }

    // 2. Load and Display Full ATS report
    function displayFullReport(report) {
        // Render Circular Gauges
        drawCircularGauge(report.overall_score, report.resume_strength);
        
        // Text labels
        document.getElementById("ats-level-label").textContent = `ATS Grade: ${report.resume_strength}`;
        document.getElementById("ats-breakdown-desc").textContent = `Formatting completeness achieved ${report.completeness_score}%. Contact checks found ${Object.keys(report.contact_info).filter(k => k.startsWith("has_") && report.contact_info[k]).length}/4 items. Readability metrics analyzed words and bullets index to ${report.readability_score}%.`;
        
        // Set metrics progress bars
        document.getElementById("ats-format-bar").style.width = `${report.formatting_score}%`;
        document.getElementById("ats-format-val").textContent = `${report.formatting_score}%`;
        
        document.getElementById("ats-grammar-bar").style.width = `${report.grammar_score}%`;
        document.getElementById("ats-grammar-val").textContent = `${report.grammar_score}%`;
        
        document.getElementById("ats-readability-bar").style.width = `${report.readability_score}%`;
        document.getElementById("ats-readability-val").textContent = `${report.readability_score}%`;
        
        document.getElementById("ats-completeness-bar").style.width = `${report.completeness_score}%`;
        document.getElementById("ats-completeness-val").textContent = `${report.completeness_score}%`;
        
        // JD Match metrics conditional panel
        const jdMetrics = document.getElementById("ats-jd-metrics-section");
        const jdMatchedContainer = document.getElementById("jd-matched-badges");
        const jdPartialContainer = document.getElementById("jd-partial-badges");
        const jdMissingContainer = document.getElementById("jd-missing-badges");
        const explanationsContainer = document.getElementById("ats-score-explanations");
        
        if (report.jd_match) {
            jdMetrics.classList.remove("hidden");
            document.getElementById("ats-skillmatch-bar").style.width = `${report.jd_match.skill_match_score}%`;
            document.getElementById("ats-skillmatch-val").textContent = `${report.jd_match.skill_match_score}%`;
            document.getElementById("ats-exp-bar").style.width = `${report.jd_match.experience_match_score}%`;
            document.getElementById("ats-exp-val").textContent = `${report.jd_match.experience_match_score}%`;
            document.getElementById("ats-project-bar").style.width = `${report.jd_match.project_quality_score}%`;
            document.getElementById("ats-project-val").textContent = `${report.jd_match.project_quality_score}%`;
            document.getElementById("ats-density-val").textContent = `${report.jd_match.keyword_density.toFixed(1)}%`;
            
            document.getElementById("ats-level-label").textContent += ` (JD Match: ${report.jd_match.match_percentage}%)`;
            
            // Populate Matched Skills
            if (jdMatchedContainer) {
                jdMatchedContainer.innerHTML = "";
                if (report.jd_match.matched_skills.length === 0) {
                    jdMatchedContainer.innerHTML = `<span class="empty-msg" style="font-size:10px;">None</span>`;
                } else {
                    report.jd_match.matched_skills.forEach(s => {
                        const span = document.createElement("span");
                        span.className = "skill-badge acquired";
                        span.textContent = s;
                        jdMatchedContainer.appendChild(span);
                    });
                }
            }
            
            // Populate Partially Matched Skills
            if (jdPartialContainer) {
                jdPartialContainer.innerHTML = "";
                if (report.jd_match.partially_matched_skills.length === 0) {
                    jdPartialContainer.innerHTML = `<span class="empty-msg" style="font-size:10px;">None</span>`;
                } else {
                    report.jd_match.partially_matched_skills.forEach(p => {
                        const span = document.createElement("span");
                        span.className = "skill-badge";
                        span.style.background = "rgba(139, 92, 246, 0.15)";
                        span.style.color = "#8b5cf6";
                        span.style.border = "1px solid rgba(139, 92, 246, 0.3)";
                        span.textContent = `${p.jd_skill} ↔ ${p.matched_with}`;
                        span.title = p.reason;
                        jdPartialContainer.appendChild(span);
                    });
                }
            }
            
            // Populate Missing Skills
            if (jdMissingContainer) {
                jdMissingContainer.innerHTML = "";
                if (report.jd_match.missing_skills.length === 0) {
                    jdMissingContainer.innerHTML = `<span class="empty-msg" style="font-size:10px;">None</span>`;
                } else {
                    report.jd_match.missing_skills.forEach(s => {
                        const span = document.createElement("span");
                        span.className = "skill-badge missing";
                        span.textContent = s;
                        jdMissingContainer.appendChild(span);
                    });
                }
            }
            
            // Render Explanations
            if (explanationsContainer && report.jd_match.explanations) {
                explanationsContainer.innerHTML = "";
                const exp = report.jd_match.explanations;
                explanationsContainer.innerHTML = `
                    <div style="margin-bottom: 6px;">🎯 <strong>Overall Match:</strong> ${exp.ats_match}</div>
                    <div style="margin-bottom: 6px;">🛠️ <strong>Skill Profile:</strong> ${exp.skill_match}</div>
                    <div style="margin-bottom: 6px;">📝 <strong>Keyword Density:</strong> ${exp.keyword_match}</div>
                    <div style="margin-bottom: 6px;">💼 <strong>Experience Alignment:</strong> ${exp.experience_match}</div>
                    <div>🚀 <strong>Projects Structure:</strong> ${exp.project_match}</div>
                `;
            }
        } else {
            jdMetrics.classList.add("hidden");
            if (explanationsContainer) {
                explanationsContainer.innerHTML = `<p>Explanations are only generated when a Target Job Description is matched against the resume.</p>`;
            }
        }
        
        // Unhide download PDF report button
        document.getElementById("download-report-pdf-btn").classList.remove("hidden");
        
        // Recommendations list layout
        const suggsList = document.getElementById("resume-ai-suggs-list");
        suggsList.innerHTML = "";
        
        const cardColors = ["blue", "pink", "amber"];
        report.ai_suggestions.forEach((block, idx) => {
            const blockColor = cardColors[idx % cardColors.length];
            const div = document.createElement("div");
            div.className = `ai-sugg-block ${blockColor}`;
            
            let listHtml = block.suggestions.map(s => `<li style="font-size:12px; line-height:1.5; margin-bottom:4px; list-style-type:disc; margin-left:14px; color:var(--text-secondary);">${s}</li>`).join("");
            if (!listHtml) {
                listHtml = `<li style="font-size:12px; color:var(--text-muted); list-style-type:none;">No specific remarks generated.</li>`;
            }
            
            div.innerHTML = `
                <h6>${block.category}</h6>
                <ul style="padding-left:4px;">${listHtml}</ul>
            `;
            suggsList.appendChild(div);
        });
        
        // Skill gap badges
        const acquiredContainer = document.getElementById("acquired-skills-badges");
        acquiredContainer.innerHTML = "";
        if (report.skill_gap.acquired_skills.length === 0) {
            acquiredContainer.innerHTML = `<span class="empty-msg">No matching role taxonomy skills found.</span>`;
        } else {
            report.skill_gap.acquired_skills.forEach(s => {
                const span = document.createElement("span");
                span.className = "skill-badge acquired";
                span.textContent = s;
                acquiredContainer.appendChild(span);
            });
        }
        
        const missingContainer = document.getElementById("missing-skills-badges");
        missingContainer.innerHTML = "";
        if (report.skill_gap.missing_skills.length === 0) {
            missingContainer.innerHTML = `<span class="empty-msg">Perfect match! No missing skills.</span>`;
            document.getElementById("roadmap-action-box").classList.add("hidden");
        } else {
            report.skill_gap.missing_skills.forEach(s => {
                const span = document.createElement("span");
                span.className = "skill-badge missing";
                span.textContent = s;
                missingContainer.appendChild(span);
            });
            
            // Set roadmap trigger onclick handler
            document.getElementById("roadmap-action-box").classList.remove("hidden");
            document.getElementById("create-roadmap-from-gaps-btn").onclick = () => {
                document.querySelector("[data-tab=roadmap]").click();
                document.getElementById("roadmap-role-select").value = document.getElementById("resume-target-role").value;
                populateRoadmapCheckboxes();
                document.getElementById("generate-custom-roadmap-btn").click();
            };
        }
        
        // Suggested courses
        const coursesBody = document.getElementById("skills-courses-table-body");
        coursesBody.innerHTML = "";
        if (report.skill_gap.suggested_courses.length === 0) {
            coursesBody.innerHTML = `<tr><td colspan="3" style="padding:12px; text-align:center; color:var(--text-muted);">Skill alignment is fully complete.</td></tr>`;
        } else {
            report.skill_gap.suggested_courses.forEach(course => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="padding:8px; font-weight:600; text-align:left;">${course.course_name}</td>
                    <td style="padding:8px; color:var(--text-secondary); text-align:left;">${course.platform}</td>
                    <td style="padding:8px; text-align:right;">
                        <a href="${course.url || '#'}" target="_blank" class="btn btn-xs btn-purple" style="font-size:10px; padding: 2px 6px; text-decoration:none; display:inline-block;">Link</a>
                    </td>
                `;
                coursesBody.appendChild(tr);
            });
        }
        
        // Company benchmarks
        const readinessList = document.getElementById("company-readiness-list-container");
        readinessList.innerHTML = "";
        report.skill_gap.company_readiness.forEach(item => {
            const badgeClass = item.status.includes("Ready") ? "ready" : (item.status.includes("Bridging") ? "bridge" : "critical");
            const row = document.createElement("div");
            row.className = "readiness-row";
            row.innerHTML = `
                <span style="font-weight:700; font-size:12px;">${item.company}</span>
                <div style="display:flex; align-items:center; gap:12px;">
                    <strong style="color:var(--primary); font-size:13px;">${item.readiness_score}%</strong>
                    <span class="readiness-badge ${badgeClass}">${item.status}</span>
                </div>
            `;
            readinessList.appendChild(row);
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // 3. Populate Audits History Logs
    async function renderResumeHistory() {
        const listContainer = document.getElementById("resume-history-list");
        if (!listContainer) return;
        
        try {
            const res = await API.getResumeHistory();
            listContainer.innerHTML = "";
            
            if (!res.history || res.history.length === 0) {
                listContainer.innerHTML = `<span class="empty-msg">No previous audits found.</span>`;
                return;
            }
            
            res.history.forEach(item => {
                const btn = document.createElement("div");
                btn.className = "history-item-btn";
                btn.style.display = "flex";
                btn.style.flexDirection = "column";
                btn.style.alignItems = "flex-start";
                btn.style.gap = "4px";
                btn.style.marginBottom = "8px";
                btn.innerHTML = `
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:11px;">
                        <strong style="color:var(--primary);">${item.target_role}</strong>
                        <span style="color:var(--text-muted);">${item.timestamp}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:10px;">
                        <span>Score: <strong>${item.overall_score}%</strong> (${item.resume_strength})</span>
                        <span>${item.has_jd ? "JD Match" : "Solo Audit"}</span>
                    </div>
                `;
                btn.addEventListener("click", () => {
                    displayFullReport(item.report);
                    // Copy text back to textareas if user wants to review
                    document.getElementById("resume-text-input").value = item.report.raw_text || "";
                    document.getElementById("resume-target-role").value = item.target_role;
                    UI.showNotification(`Loaded history audit data for ${item.target_role} from ${item.timestamp}`, "info");
                });
                listContainer.appendChild(btn);
            });
        } catch (e) {
            listContainer.innerHTML = `<span class="empty-msg">Failed to retrieve history logs.</span>`;
        }
    }

    // 4. Drag & Drop zone triggers
    const dragDropZone = document.getElementById("resume-drag-drop-zone");
    const fileInput = document.getElementById("resume-file-input");
    const progressContainer = document.getElementById("upload-progress-container");
    const progressBar = document.getElementById("upload-progress-bar");
    const fileNameLabel = document.getElementById("uploaded-file-name");
    const clearResumeBtn = document.getElementById("clear-resume-btn");
    
    if (dragDropZone && fileInput) {
        dragDropZone.addEventListener("click", () => fileInput.click());
        
        dragDropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dragDropZone.classList.add("dragover");
        });
        
        dragDropZone.addEventListener("dragleave", () => {
            dragDropZone.classList.remove("dragover");
        });
        
        dragDropZone.addEventListener("drop", async (e) => {
            e.preventDefault();
            dragDropZone.classList.remove("dragover");
            const file = e.dataTransfer.files[0];
            if (file) handleResumeUpload(file);
        });
        
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) handleResumeUpload(file);
        });
    }
    
    async function handleResumeUpload(file) {
        progressContainer.classList.remove("hidden");
        progressBar.style.width = "0%";
        fileNameLabel.classList.add("hidden");
        
        let progress = 0;
        const timer = setInterval(() => {
            progress += 10;
            progressBar.style.width = `${progress}%`;
            if (progress >= 90) clearInterval(timer);
        }, 100);
        
        try {
            const res = await API.uploadResume(file);
            clearInterval(timer);
            progressBar.style.width = "100%";
            
            setTimeout(() => {
                progressContainer.classList.add("hidden");
            }, 600);
            
            document.getElementById("resume-text-input").value = res.text;
            fileNameLabel.textContent = `File: ${res.filename}`;
            fileNameLabel.classList.remove("hidden");
            clearResumeBtn.removeAttribute("disabled");
            
            UI.showNotification(`Resume successfully uploaded: ${res.filename}`, "success");
        } catch (err) {
            clearInterval(timer);
            progressContainer.classList.add("hidden");
            UI.showNotification("Failed to upload/extract text from resume.", "error");
        }
    }
    
    if (clearResumeBtn) {
        clearResumeBtn.addEventListener("click", () => {
            document.getElementById("resume-text-input").value = "";
            document.getElementById("resume-jd-input").value = "";
            fileInput.value = "";
            fileNameLabel.textContent = "--";
            fileNameLabel.classList.add("hidden");
            clearResumeBtn.setAttribute("disabled", "true");
            UI.showNotification("Cleared resume data input workspace.", "info");
        });
    }

    // 5. History sidebar toggler
    const showHistoryBtn = document.getElementById("show-history-btn");
    const historyPanel = document.getElementById("resume-history-panel");
    if (showHistoryBtn && historyPanel) {
        showHistoryBtn.addEventListener("click", () => {
            historyPanel.classList.toggle("hidden");
            if (!historyPanel.classList.contains("hidden")) {
                renderResumeHistory();
            }
        });
    }
    
    // Clear history logs
    const clearHistoryBtn = document.getElementById("clear-history-btn");
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", async () => {
            try {
                await API.clearResumeHistory();
                renderResumeHistory();
                UI.showNotification("Historical audit database cleared.", "success");
            } catch (err) {
                UI.showNotification("Failed to clear audit history database.", "error");
            }
        });
    }

    // 6. Download PDF Report (utilizing client-side html2pdf.js)
    const downloadPdfBtn = document.getElementById("download-report-pdf-btn");
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener("click", () => {
            const element = document.getElementById("ats-report-results");
            const role = document.getElementById("resume-target-role").value;
            const options = {
                margin: 10,
                filename: `CareerPilot_ATS_Report_${role}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: "#0b0c16" },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            UI.showNotification("Generating high-fidelity PDF report...", "info");
            html2pdf().set(options).from(element).save();
        });
    }

    // 7. Core Analyze Resume trigger binding
    const analyzeResumeBtn = document.getElementById("analyze-resume-btn");
    analyzeResumeBtn.addEventListener("click", async () => {
        const text = document.getElementById("resume-text-input").value.trim();
        const role = document.getElementById("resume-target-role").value;
        const jd = document.getElementById("resume-jd-input").value.trim();
        
        if (!text) {
            UI.showNotification("Resume content cannot be empty. Please upload file or paste text.", "warning");
            return;
        }

        UI.toggleButtonLoading(analyzeResumeBtn, true, "Analyzing resume...");
        
        try {
            const report = await API.analyzeFullResume(text, role, jd || null);
            
            // Render Report details
            displayFullReport(report);
            
            // Sync current state profile acquired skills for other modules
            STATE.profile.skills = report.skill_gap.acquired_skills;
            saveProfileToStorage();
            
            // Update Dashboard chart elements
            updateDashboardMetrics();
            
            // Refresh logs
            if (historyPanel && !historyPanel.classList.contains("hidden")) {
                renderResumeHistory();
            }
            
            UI.showNotification("Evaluation completed. View detailed suggestions inside panels.", "success");
        } catch (e) {
            UI.showNotification("Evaluation request failed. Verify backend logs.", "error");
        } finally {
            UI.toggleButtonLoading(analyzeResumeBtn, false, "Analyze Resume & Calculate Score");
        }
    });

    // Draw empty canvas gauge on page init
    setTimeout(() => {
        drawCircularGauge(0, "Pending");
        renderResumeHistory();
    }, 500);

    // Company Prep Page Load
    const loadPrepBtn = document.getElementById("load-prep-btn");
    const selectCompany = document.getElementById("prep-company-select");
    
    const triggerLoadPrep = async () => {
        const comp = selectCompany.value;
        const role = document.getElementById("prep-role-select").value;
        if (comp) {
            UI.toggleButtonLoading(loadPrepBtn, true, "Get Placement Guide");
            try {
                await loadCompanyPrep(comp, role);
            } catch (e) {
                UI.showNotification("Failed to retrieve company placement details.", "error");
            } finally {
                UI.toggleButtonLoading(loadPrepBtn, false, "Get Placement Guide");
            }
        }
    };

    loadPrepBtn.addEventListener("click", triggerLoadPrep);
    selectCompany.addEventListener("change", triggerLoadPrep);
    document.getElementById("prep-role-select").addEventListener("change", triggerLoadPrep);

    // Subtab routing inside Resume Analysis tab
    const subtabButtons = document.querySelectorAll(".analysis-tabs-panel .tab-btn");
    const subtabs = document.querySelectorAll(".subtab-content");
    
    subtabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            subtabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            subtabs.forEach(t => t.classList.remove("active"));
            document.getElementById(btn.getAttribute("data-subtab")).classList.add("active");
        });
    });

    // Subtab routing inside Interview Arena
    const arenaTabs = document.querySelectorAll(".arena-tabs .arena-tab-btn");
    const arenaSubpanels = document.querySelectorAll(".arena-subpanel");
    
    arenaTabs.forEach(btn => {
        btn.addEventListener("click", () => {
            arenaTabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            arenaSubpanels.forEach(p => p.classList.remove("active"));
            document.getElementById(btn.getAttribute("data-arenatab")).classList.add("active");
        });
    });

    // Start mock Q&A interview simulator
    const startMockBtn = document.getElementById("start-mock-btn");
    startMockBtn.addEventListener("click", async () => {
        const comp = document.getElementById("mock-company").value;
        const role = document.getElementById("mock-role").value;
        const type = document.getElementById("mock-type").value;
        const diff = document.getElementById("mock-difficulty").value;
        
        UI.toggleButtonLoading(startMockBtn, true, "Start Mock Interview");
        
        try {
            const qData = await API.startMockInterview(comp, role, type, diff);
            STATE.currentMockQuestion = qData;
            
            // Reset console
            const consoleArea = document.getElementById("interview-console-area");
            consoleArea.innerHTML = `
                <div class="chat-bubble ai">
                    <p>Welcome! I will be your interviewer. Let's begin the mock placement session.</p>
                </div>
                <div class="chat-bubble ai">
                    <p><strong>[Round: ${type.toUpperCase()} - Difficulty: ${diff}]</strong></p>
                    <p>${qData.question}</p>
                </div>
            `;
            
            // Show input block
            document.getElementById("interview-console-input-row").classList.remove("hidden");
            document.getElementById("sim-active-details").textContent = `Mocking: ${comp} (${role})`;
            document.getElementById("mock-answer-input").value = "";
            
            UI.showNotification("Simulated mock interview started!", "info");
        } catch (e) {
            UI.showNotification("Failed to start mock simulator.", "error");
        } finally {
            UI.toggleButtonLoading(startMockBtn, false, "Start Mock Interview");
        }
    });

    // Submit mock Q&A interview answer
    const submitMockAnswerBtn = document.getElementById("submit-mock-answer-btn");
    submitMockAnswerBtn.addEventListener("click", async () => {
        const ans = document.getElementById("mock-answer-input").value.trim();
        if (!ans) {
            UI.showNotification("Answer cannot be empty.", "warning");
            return;
        }

        UI.toggleButtonLoading(submitMockAnswerBtn, true, "Submit Answer");
        
        try {
            const q = STATE.currentMockQuestion;
            const res = await API.submitMockAnswer(q.question_id, q.question, ans, q.company, q.role, q.topic);
            
            // Print user answer, then AI feedback report
            const consoleArea = document.getElementById("interview-console-area");
            
            const userBubble = document.createElement("div");
            userBubble.className = "chat-bubble user";
            userBubble.innerHTML = `<p>${ans}</p>`;
            consoleArea.appendChild(userBubble);
            
            const feedbackBubble = document.createElement("div");
            feedbackBubble.className = "chat-bubble ai";
            
            let strengths = res.strengths.map(s => `<li><i data-lucide="check"></i> ${s}</li>`).join("");
            let gaps = res.weaknesses.map(w => `<li><i data-lucide="x"></i> ${w}</li>`).join("");
            let tips = res.suggestions.map(t => `<li><i data-lucide="help-circle"></i> ${t}</li>`).join("");
            
            feedbackBubble.innerHTML = `
                <h5>Evaluation Result Score: <strong style="color:var(--primary)">${res.score}%</strong></h5>
                <hr class="divider">
                <p><strong>Candidate Strengths:</strong></p>
                <ul class="check-list" style="margin-bottom:12px">${strengths}</ul>
                <p><strong>Key Gaps:</strong></p>
                <ul class="check-list" style="margin-bottom:12px">${gaps}</ul>
                <p><strong>Suggestions to improve:</strong></p>
                <ul class="check-list" style="margin-bottom:12px">${tips}</ul>
                <p><strong>Perfect Model Answer:</strong></p>
                <p style="font-style:italic; background:var(--bg-input); padding:10px; border-radius:8px; margin-bottom:16px">${res.model_answer}</p>
                <button class="btn btn-primary btn-sm" id="sim-next-btn">Next Mock Question</button>
            `;
            consoleArea.appendChild(feedbackBubble);
            
            // Hook simulator Q&A next question trigger
            document.getElementById("sim-next-btn").addEventListener("click", () => {
                document.getElementById("start-mock-btn").click();
            });

            if (window.lucide) {
                window.lucide.createIcons();
            }
            
            // Hide inputs
            document.getElementById("interview-console-input-row").classList.add("hidden");
            
            updateDashboardMetrics();
            
            // Show notification
            UI.showNotification(`Mock interview completed. Graded Score: ${res.score}%`, "success");
        } catch (e) {
            UI.showNotification("Evaluation submission failed.", "error");
        } finally {
            UI.toggleButtonLoading(submitMockAnswerBtn, false, "Submit Answer");
        }
    });

    // Generate new coding problem
    const generateNewCodeProbBtn = document.getElementById("generate-new-code-prob-btn");
    generateNewCodeProbBtn.addEventListener("click", async () => {
        const topic = document.getElementById("code-topic-select").value;
        const diff = document.getElementById("code-diff-select").value;
        
        UI.toggleButtonLoading(generateNewCodeProbBtn, true, "Generate New Problem");
        
        try {
            const prob = await API.generateCodingProblem(topic, diff);
            populateCodingProblem(prob);
            UI.showNotification("New coding challenge generated!", "success");
        } catch (e) {
            UI.showNotification("Failed to generate coding problem.", "error");
        } finally {
            UI.toggleButtonLoading(generateNewCodeProbBtn, false, "Generate New Problem");
        }
    });

    // Submit coding solution
    const submitCodeBtn = document.getElementById("submit-code-btn");
    submitCodeBtn.addEventListener("click", async () => {
        const code = document.getElementById("code-text-editor").value.trim();
        const lang = document.getElementById("code-lang-select").value;
        
        if (!code) {
            UI.showNotification("Coding workspace is empty.", "warning");
            return;
        }

        if (!STATE.currentCodingProblem) {
            UI.showNotification("Please generate or select a problem first.", "warning");
            return;
        }

        UI.toggleButtonLoading(submitCodeBtn, true, "Submit Code for Evaluation");
        
        try {
            const startTime = STATE.codeSolveStartTime || Date.now();
            const timeTaken = Math.max(10, Math.round((Date.now() - startTime) / 1000));
            
            const res = await API.evaluateCode(STATE.currentCodingProblem.problem_id, code, lang, timeTaken);
            
            // Render evaluation report panel
            document.getElementById("code-eval-score").textContent = `${res.correctness_score}%`;
            document.getElementById("code-eval-time").textContent = res.time_complexity;
            document.getElementById("code-eval-space").textContent = res.space_complexity;
            document.getElementById("code-eval-feedback").textContent = res.logical_feedback;
            
            // Bind Runtime & Memory
            document.getElementById("code-eval-runtime").textContent = `${res.runtime_ms} ms`;
            document.getElementById("code-eval-memory").textContent = `${res.memory_mb.toFixed(1)} MB`;
            
            // Bind Test Cases List
            const tcList = document.getElementById("code-eval-testcases-list");
            if (tcList) {
                tcList.innerHTML = "";
                res.test_cases.forEach((tc, idx) => {
                    const div = document.createElement("div");
                    div.style.padding = "8px 12px";
                    div.style.borderRadius = "8px";
                    div.style.background = tc.passed ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)";
                    div.style.border = tc.passed ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(239,68,68,0.2)";
                    div.style.color = tc.passed ? "var(--success)" : "var(--error)";
                    div.style.marginBottom = "4px";
                    div.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 2px;">Test Case ${idx + 1}: ${tc.passed ? 'PASSED ✅' : 'FAILED ❌'}</div>
                        <div style="color: var(--text-secondary); opacity: 0.85; font-family: monospace;">Input: ${tc.input}</div>
                        <div style="color: var(--text-secondary); opacity: 0.85; font-family: monospace;">Expected: ${tc.expected} | Actual: ${tc.actual}</div>
                    `;
                    tcList.appendChild(div);
                });
            }
            
            const sugList = document.getElementById("code-eval-suggestions");
            sugList.innerHTML = "";
            res.suggestions.forEach(s => {
                const li = document.createElement("li");
                li.className = "suggested";
                li.innerHTML = `<i data-lucide="info"></i> <span>${s}</span>`;
                sugList.appendChild(li);
            });
            
            document.getElementById("code-eval-optimized").textContent = res.optimized_code;
            
            if (window.lucide) {
                window.lucide.createIcons();
            }

            document.getElementById("code-evaluation-report").classList.remove("hidden");
            UI.showNotification("Code evaluation complete!", "success");
            
            // Instantly refresh dashboard analytics widgets
            updateDashboardMetrics();
        } catch (e) {
            UI.showNotification("Code evaluation query failed.", "error");
        } finally {
            UI.toggleButtonLoading(submitCodeBtn, false, "Submit Code for Evaluation");
        }
    });

    // Bookmark coding challenge
    const bookmarkCodeBtn = document.getElementById("bookmark-code-btn");
    if (bookmarkCodeBtn) {
        bookmarkCodeBtn.addEventListener("click", async () => {
            if (!STATE.currentCodingProblem) {
                UI.showNotification("Please generate or select a problem first.", "warning");
                return;
            }
            UI.toggleButtonLoading(bookmarkCodeBtn, true, "Saving...");
            try {
                await API.bookmarkCodingChallenge(STATE.currentCodingProblem.problem_id);
                UI.showNotification("Problem bookmarked successfully!", "success");
                updateDashboardMetrics();
            } catch (e) {
                UI.showNotification("Failed to bookmark problem.", "error");
            } finally {
                UI.toggleButtonLoading(bookmarkCodeBtn, false, "Bookmark");
            }
        });
    }

    // Skip coding challenge
    const skipCodeBtn = document.getElementById("skip-code-btn");
    if (skipCodeBtn) {
        skipCodeBtn.addEventListener("click", async () => {
            if (!STATE.currentCodingProblem) {
                UI.showNotification("Please generate or select a problem first.", "warning");
                return;
            }
            UI.toggleButtonLoading(skipCodeBtn, true, "Skipping...");
            try {
                await API.skipCodingChallenge(STATE.currentCodingProblem.problem_id);
                UI.showNotification("Problem marked as skipped. Generating next challenge...", "info");
                updateDashboardMetrics();
                document.getElementById("generate-new-code-prob-btn").click();
            } catch (e) {
                UI.showNotification("Failed to skip problem.", "error");
            } finally {
                UI.toggleButtonLoading(skipCodeBtn, false, "Skip Question");
            }
        });
    }

    // Roadmap generator button
    const generateCustomRoadmapBtn = document.getElementById("generate-custom-roadmap-btn");
    generateCustomRoadmapBtn.addEventListener("click", async () => {
        const role = document.getElementById("roadmap-role-select").value;
        
        // Grab checked skills
        const checkedBox = document.querySelectorAll("#roadmap-skills-checkboxes input:checked");
        const missing = Array.from(checkedBox).map(cb => cb.value);
        
        if (missing.length === 0) {
            UI.showNotification("Please select at least 1 skill checkbox to study.", "warning");
            return;
        }

        UI.toggleButtonLoading(generateCustomRoadmapBtn, true, "Build Learning Roadmap");
        
        try {
            const res = await API.generateRoadmap(role, missing);
            
            // Build timeline HTML
            const container = document.getElementById("timeline-weeks-container");
            container.innerHTML = "";
            
            document.getElementById("roadmap-timeline-title").textContent = `Your Custom ${role} Study Roadmap`;
            document.getElementById("roadmap-timeline-desc").textContent = `Tailored schedule targeting: ${missing.join(", ")}`;

            res.roadmap.forEach(week => {
                const card = document.createElement("div");
                card.className = "glass-card timeline-week-card";
                
                let topics = week.topics.map(t => `<li><i data-lucide="check-circle"></i> <span>${t}</span></li>`).join("");
                let resources = week.resources.map(r => `<a href="https://www.google.com/search?q=${encodeURIComponent(r)}" target="_blank" class="resource-link">${r}</a>`).join("");
                
                card.innerHTML = `
                    <h5><span class="week-num">Week ${week.week}</span> ${week.title}</h5>
                    <ul class="check-list">${topics}</ul>
                    <div class="timeline-proj">
                        <strong>Mini Project Goal:</strong> ${week.projects[0] || 'Build application prototype.'}
                    </div>
                    <div class="timeline-resources">
                        <strong>Study references:</strong> ${resources || 'Search standard web libraries.'}
                    </div>
                `;
                container.appendChild(card);
            });
            
            if (window.lucide) {
                window.lucide.createIcons();
            }

            UI.showNotification("Week timeline populated successfully!", "success");
        } catch (e) {
            UI.showNotification("Roadmap calculation query failed.", "error");
        } finally {
            UI.toggleButtonLoading(generateCustomRoadmapBtn, false, "Build Learning Roadmap");
        }
    });

    // Roadmap Role Select Listener
    document.getElementById("roadmap-role-select").addEventListener("change", populateRoadmapCheckboxes);
}

async function loadCompanyPrep(company, role = "SDE") {
    try {
        const prep = await API.getCompanyPrep(company, role);
        
        document.getElementById("comp-name").textContent = prep.company;
        document.getElementById("comp-industry").textContent = `${prep.industry || 'Tech / Engineering'} • ${prep.website || ''}`;
        
        const rating = document.getElementById("comp-rating");
        rating.textContent = prep.rating ? prep.rating.toFixed(1) : "N/A";
        
        const locVal = prep.locations.length > 0 ? prep.locations.slice(0, 3).join(", ") : "Global locations";
        document.getElementById("comp-locations").textContent = locVal;
        document.getElementById("comp-difficulty").textContent = `Interview: ${prep.interview_difficulty || 'Medium'}`;
        document.getElementById("comp-duration").textContent = `Duration: ${prep.interview_duration || 'Varies'}`;
        document.getElementById("comp-salary").textContent = `Salary Range: ${prep.salary_info || 'Competitive'}`;
        
        // Populate Strategy
        const strat = document.getElementById("comp-prep-strategy");
        strat.innerHTML = UI.formatMarkdown(prep.prep_strategy);
        
        // Populate questions
        const qList = document.getElementById("comp-prep-questions");
        qList.innerHTML = "";
        
        if (prep.questions.length === 0) {
            qList.innerHTML = `<p class="empty-msg">No interview questions matching filters inside database.</p>`;
        } else {
            prep.questions.forEach(q => {
                const item = document.createElement("div");
                item.className = "question-item";
                item.innerHTML = `
                    <div class="q-header">
                        <span class="q-topic">${q.topic}</span>
                        <span>Level: ${q.difficulty}</span>
                    </div>
                    <p class="q-body">${q.question}</p>
                `;
                qList.appendChild(item);
            });
        }
    } catch (e) {
        console.error("Failed to load company prep:", e);
    }
}

function populateCodingProblem(prob) {
    STATE.currentCodingProblem = prob;
    STATE.codeSolveStartTime = Date.now();
    
    document.getElementById("code-prob-title").textContent = prob.title;
    document.getElementById("code-prob-diff").textContent = prob.difficulty;
    document.getElementById("code-prob-diff").className = `difficulty-badge ${prob.difficulty.toLowerCase()}`;
    document.getElementById("code-prob-topic").textContent = prob.topic;
    
    // problem descriptions
    const cont = document.getElementById("code-prob-content");
    cont.innerHTML = `<p>${prob.description}</p>`;
    
    document.getElementById("code-prob-input-format").textContent = prob.input_format;
    document.getElementById("code-prob-output-format").textContent = prob.output_format;
    
    const cons = document.getElementById("code-prob-constraints");
    cons.innerHTML = "";
    prob.constraints.forEach(c => {
        const li = document.createElement("li");
        li.textContent = c;
        cons.appendChild(li);
    });
    
    document.getElementById("code-prob-sample-input").textContent = prob.sample_input;
    document.getElementById("code-prob-sample-output").textContent = prob.sample_output;
    
    // Hide default editor report, display description IOs
    document.getElementById("problem-io-section").classList.remove("hidden");
    document.getElementById("code-evaluation-report").classList.add("hidden");
    
    // Write default stub inside code text editor
    const editor = document.getElementById("code-text-editor");
    if (prob.topic.toLowerCase() === "sql") {
        editor.value = "SELECT * FROM Employees\nWHERE salary > 50000;";
    } else {
        editor.value = "def solve(*args, **kwargs):\n    # Write your solution code here\n    pass";
    }
}

function extractSkillsFromText(text) {
    const textLower = text.toLowerCase();
    const taxonomySkills = [
        "Data Structures", "Algorithms", "OOP", "System Design", "Git", "REST APIs", "SQL", "Problem Solving",
        "Python", "Machine Learning", "Deep Learning", "Model Deployment", "Statistics", "MLOps", "Data Preprocessing",
        "Manual Testing", "Automation Testing (Selenium)", "Test Case Design", "Bug Tracking (JIRA)", "API Testing",
        "Networking", "Linux", "Cloud Basics (AWS/Azure)", "Scripting (Bash/Python)", "Troubleshooting", "OS Concepts",
        "Excel", "Data Visualization", "Power BI/Tableau", "A/B Testing", "C#", "ASP.NET", "Entity Framework", "LINQ"
    ];
    
    const found = [];
    taxonomySkills.forEach(skill => {
        const pattern = new RegExp('\\b' + skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
        if (pattern.test(textLower) || textLower.includes(skill.toLowerCase())) {
            found.push(skill);
        }
    });
    return found;
}

function extractProfileFromResume(text, targetRole) {
    const skills = extractSkillsFromText(text);
    
    // Try to extract name
    let name = "Guest Student";
    const nameMatch = text.match(/(?:NAME|Name):\s*([^\n\r]+)/);
    if (nameMatch && nameMatch[1].trim()) {
        name = nameMatch[1].trim();
    }
    
    // Try to extract education
    let education = "";
    const eduMatch = text.match(/(?:EDUCATION|Education):\s*([^\n\r]+)/);
    if (eduMatch && eduMatch[1].trim()) {
        education = eduMatch[1].trim();
    }
    
    // Try to extract experience
    let experience = "";
    const expMatch = text.match(/(?:EXPERIENCE|Experience):\s*([^\n\r]+)/);
    if (expMatch && expMatch[1].trim()) {
        experience = expMatch[1].trim();
    }

    // Try to extract projects
    let projects = "";
    const projMatch = text.match(/(?:PROJECTS|Projects):\s*([^\n\r]+)/);
    if (projMatch && projMatch[1].trim()) {
        projects = projMatch[1].trim();
    }

    return {
        name,
        target_role: targetRole,
        skills: skills.length > 0 ? skills : ["Python", "SQL", "Git"],
        education: education || STATE.profile.education,
        experience: experience || STATE.profile.experience,
        projects: projects || STATE.profile.projects
    };
}

async function updateJobRecommendations() {
    const container = document.getElementById("dashboard-recommendations");
    if (!container) return;
    
    container.innerHTML = `<div class="empty-msg"><span class="spinner"></span> Matching jobs database...</div>`;
    
    try {
        const res = await API.getRecommendations(STATE.profile.skills, STATE.profile.target_role);
        container.innerHTML = "";
        
        if (!res.recommendations || res.recommendations.length === 0) {
            container.innerHTML = `<div class="empty-msg">No matching jobs found. Try expanding your skills profile.</div>`;
            return;
        }
        
        res.recommendations.forEach(job => {
            const card = document.createElement("div");
            card.className = "glass-card job-card";
            
            // Build skill badges (up to 4)
            const badges = job.matching_skills.slice(0, 3).map(s => `<span class="skill-badge acquired">${s}</span>`).join("")
                + job.missing_skills.slice(0, 2).map(s => `<span class="skill-badge missing">${s}</span>`).join("");
                
            let scoreClass = "low";
            if (job.match_score > 75) scoreClass = "high";
            else if (job.match_score > 50) scoreClass = "med";
            
            const companyName = job.job_id.split("-")[0] || 'Tech Partner';
            
            card.innerHTML = `
                <div>
                    <h5>${job.title}</h5>
                    <span class="job-company">${companyName}</span>
                    <div class="job-spec-row">
                        <span><i data-lucide="briefcase" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px"></i> ${job.experience_level}</span>
                        <span><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px"></i> ${job.years_of_experience} yrs</span>
                    </div>
                    <div class="job-skills-list">
                        ${badges || '<span class="empty-msg">General skill requirements</span>'}
                    </div>
                </div>
                <div class="job-card-footer">
                    <span class="match-percentage ${scoreClass}">Match: ${job.match_score}%</span>
                    <button class="btn btn-purple btn-sm prep-guide-btn">Prep Guide</button>
                </div>
            `;
            
            card.querySelector(".prep-guide-btn").addEventListener("click", () => {
                const mentorTab = document.querySelector("[data-tab=mentor]");
                if (mentorTab) mentorTab.click();
                
                const chatInput = document.getElementById("mentor-chat-input");
                const sendBtn = document.getElementById("mentor-send-btn");
                if (chatInput && sendBtn) {
                    chatInput.value = `Tell me about the requirements and interview focus for SDE role at ${companyName}`;
                    sendBtn.click();
                }
            });
            
            container.appendChild(card);
        });
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } catch (e) {
        container.innerHTML = `<div class="empty-msg" style="color:var(--error)">Failed to load job recommendations.</div>`;
    }
}

function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem("careerpilot_logged_in") === "true" && localStorage.getItem("careerpilot_token");
    const loginScreen = document.getElementById("login-screen");
    const appContainer = document.getElementById("main-app-container");
    
    if (isLoggedIn) {
        if (loginScreen) loginScreen.classList.add("hidden");
        if (appContainer) appContainer.classList.remove("hidden");
    } else {
        if (loginScreen) loginScreen.classList.remove("hidden");
        if (appContainer) appContainer.classList.add("hidden");
    }
}

async function verifySession() {
    const token = localStorage.getItem("careerpilot_token");
    if (!token) return;
    try {
        const profile = await API.getMe();
        STATE.profile = profile;
        saveProfileToStorage();
        try {
            await API.triggerLoginStreak();
        } catch (streakErr) {
            console.warn("Could not sync daily login streak:", streakErr);
        }
    } catch (e) {
        console.warn("Session expired or invalid, logging out:", e);
        logoutUser();
    }
}

function logoutUser() {
    localStorage.removeItem("careerpilot_logged_in");
    localStorage.removeItem("careerpilot_token");
    checkLoginStatus();
    setupLoginHandlers();
    UI.showNotification("Session expired. Please log in again.", "info");
}

function setupLoginHandlers() {
    const btnLoginTab = document.getElementById("btn-login-tab");
    const btnSignupTab = document.getElementById("btn-signup-tab");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const logoutBtn = document.getElementById("logout-btn");
    
    if (btnLoginTab && btnSignupTab && loginForm && signupForm) {
        btnLoginTab.addEventListener("click", () => {
            btnLoginTab.classList.add("active");
            btnSignupTab.classList.remove("active");
            loginForm.classList.remove("hidden");
            signupForm.classList.add("hidden");
        });
        
        btnSignupTab.addEventListener("click", () => {
            btnSignupTab.classList.add("active");
            btnLoginTab.classList.remove("active");
            signupForm.classList.remove("hidden");
            loginForm.classList.add("hidden");
        });
    }
    
    // Helper to render loading state in login card
    const showAuthenticatingLoader = (cardEl, message, callback) => {
        // Backup content
        const originalHtml = cardEl.innerHTML;
        cardEl.style.minHeight = cardEl.offsetHeight + "px";
        
        // Show spinning loader
        cardEl.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; animation: scaleIn 0.3s ease;">
                <span class="spinner" style="width: 32px; height: 32px; border-width: 4px; border-top-color: var(--primary);"></span>
                <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin-top: 24px; text-align: center;">${message}</h4>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Establishing secure session handshake...</p>
            </div>
        `;
        
        setTimeout(() => {
            cardEl.style.minHeight = "";
            cardEl.innerHTML = originalHtml;
            callback();
        }, 1500);
    };
    
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const pass = document.getElementById("login-password").value;
            
            const submitBtn = loginForm.querySelector("button[type=submit]");
            
            // Client-side validations
            if (email.includes("@")) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    UI.showNotification("Please enter a valid academic email address (e.g. guest@university.edu).", "warning");
                    return;
                }
            } else {
                if (email.length < 3) {
                    UI.showNotification("Student ID must be at least 3 characters.", "warning");
                    return;
                }
            }
            
            if (pass.length < 6) {
                UI.showNotification("Password must be at least 6 characters.", "warning");
                return;
            }
            
            UI.toggleButtonLoading(submitBtn, true, "Access Platform");
            
            try {
                const res = await API.login(email, pass);
                if (res.success && res.profile && res.token) {
                    const card = document.querySelector(".login-card");
                    
                    showAuthenticatingLoader(card, "Authenticating Student Credentials...", () => {
                        // Log in
                        localStorage.setItem("careerpilot_token", res.token);
                        localStorage.setItem("careerpilot_logged_in", "true");
                        
                        // Set active student state
                        STATE.profile = res.profile;
                        saveProfileToStorage();
                        
                        checkLoginStatus();
                        
                        // Re-bind listeners on the newly restored HTML
                        setupLoginHandlers();
                        
                        if (window.lucide) {
                            window.lucide.createIcons();
                        }
                        
                        UI.showNotification(`Welcome back, ${res.profile.name}!`, "success");
                        updateDashboardMetrics();
                    });
                } else {
                    UI.showNotification(res.message || "Authentication failed: Invalid credentials.", "error");
                }
            } catch (err) {
                UI.showNotification("Connection error. Is the backend server running?", "error");
            } finally {
                UI.toggleButtonLoading(submitBtn, false, "Access Platform");
            }
        });
    }
    
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("signup-name").value.trim();
            const role = document.getElementById("signup-role").value;
            const email = document.getElementById("signup-email").value.trim().toLowerCase();
            const pass = document.getElementById("signup-password").value;
            
            const submitBtn = signupForm.querySelector("button[type=submit]");
            
            // Client-side validations
            if (name.length < 2) {
                UI.showNotification("Full Name must be at least 2 characters.", "warning");
                return;
            }
            
            if (email.includes("@")) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    UI.showNotification("Please enter a valid email address.", "warning");
                    return;
                }
            } else {
                if (email.length < 3) {
                    UI.showNotification("Student ID/username must be at least 3 characters.", "warning");
                    return;
                }
            }
            
            if (pass.length < 6) {
                UI.showNotification("Password must be at least 6 characters.", "warning");
                return;
            }
            
            UI.toggleButtonLoading(submitBtn, true, "Register & Begin");
            
            try {
                const res = await API.signup(name, email, pass, role);
                if (res.success && res.profile && res.token) {
                    const card = document.querySelector(".login-card");
                    
                    showAuthenticatingLoader(card, "Registering Placement Credentials...", () => {
                        // Set active student state
                        localStorage.setItem("careerpilot_token", res.token);
                        localStorage.setItem("careerpilot_logged_in", "true");
                        STATE.profile = res.profile;
                        saveProfileToStorage();
                        
                        checkLoginStatus();
                        
                        // Re-bind listeners
                        setupLoginHandlers();
                        
                        if (window.lucide) {
                            window.lucide.createIcons();
                        }
                        
                        UI.showNotification("Account registered! Welcome to CareerPilot AI.", "success");
                        updateDashboardMetrics();
                    });
                } else {
                    UI.showNotification(res.message || "Registration failed.", "warning");
                }
            } catch (err) {
                UI.showNotification("Connection error. Check backend terminal.", "error");
            } finally {
                UI.toggleButtonLoading(submitBtn, false, "Register & Begin");
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("careerpilot_logged_in");
            localStorage.removeItem("careerpilot_token");
            checkLoginStatus();
            
            // Re-setup login tab event listeners
            setupLoginHandlers();
            
            UI.showNotification("Logged out of placement portal.", "info");
        });
    }
}


