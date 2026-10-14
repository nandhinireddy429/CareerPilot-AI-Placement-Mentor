/* UI helper utilities and Chart configuration */

const UI = {
    skillsChart: null,

    initChart(labels = [], dataValues = []) {
        const ctx = document.getElementById('skillsChart');
        if (!ctx) return;

        // Destroy existing chart if any
        if (this.skillsChart) {
            this.skillsChart.destroy();
        }

        // Standard categories if none provided
        const finalLabels = labels.length > 0 ? labels : ["Coding Mastery", "System Design", "SQL & DBs", "Problem Solving", "Behavioral Alignment", "Tool Proficiency"];
        const finalValues = dataValues.length > 0 ? dataValues : [65, 45, 55, 70, 60, 50];

        // Read CSS variables for consistent design
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();

        if (typeof Chart === "undefined") {
            console.warn("Chart.js is not loaded. Radar chart visualization is disabled.");
            return;
        }

        this.skillsChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: finalLabels,
                datasets: [{
                    label: 'Readiness Metrics',
                    data: finalValues,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    borderColor: primaryColor || '#8b5cf6',
                    borderWidth: 2,
                    pointBackgroundColor: secondaryColor || '#3b82f6',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: primaryColor || '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        angleLines: {
                            color: borderColor
                        },
                        grid: {
                            color: borderColor
                        },
                        pointLabels: {
                            color: textColor,
                            font: {
                                family: 'Plus Jakarta Sans',
                                size: 10,
                                weight: '600'
                            }
                        },
                        ticks: {
                            display: false,
                            maxTicksLimit: 5
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                }
            }
        });
    },

    toggleButtonLoading(buttonEl, isLoading, defaultHtml = "Submit") {
        if (!buttonEl) return;
        
        if (isLoading) {
            buttonEl.disabled = true;
            buttonEl.classList.add("loading-btn");
            buttonEl.innerHTML = `<span class="spinner"></span> Working...`;
        } else {
            buttonEl.disabled = false;
            buttonEl.classList.remove("loading-btn");
            buttonEl.innerHTML = defaultHtml;
        }
    },

    showNotification(message, type = "info") {
        // Create dynamic notification banner
        const banner = document.createElement("div");
        banner.className = `glass-card notification-banner ${type}`;
        banner.style.position = "fixed";
        banner.style.bottom = "24px";
        banner.style.right = "24px";
        banner.style.padding = "16px 24px";
        banner.style.zIndex = "1000";
        banner.style.display = "flex";
        banner.style.alignItems = "center";
        banner.style.gap = "12px";
        banner.style.fontSize = "13px";
        banner.style.fontWeight = "600";
        banner.style.animation = "slideUp 0.3s ease";
        
        let iconName = "info";
        if (type === "success") {
            iconName = "check-circle";
            banner.style.borderColor = "var(--success)";
            banner.style.color = "var(--success)";
        } else if (type === "error") {
            iconName = "alert-circle";
            banner.style.borderColor = "var(--error)";
            banner.style.color = "var(--error)";
        } else if (type === "warning") {
            iconName = "alert-triangle";
            banner.style.borderColor = "var(--warning)";
            banner.style.color = "var(--warning)";
        } else {
            banner.style.borderColor = "var(--info)";
            banner.style.color = "var(--info)";
        }

        banner.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
        document.body.appendChild(banner);
        
        // Re-compile icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        setTimeout(() => {
            banner.style.animation = "fadeIn 0.3s ease reverse";
            setTimeout(() => banner.remove(), 300);
        }, 4000);
    },

    // Simple markdown formatting subset
    formatMarkdown(text) {
        if (!text) return "";
        let formatted = text;
        
        // Headers
        formatted = formatted.replace(/^##### (.*?)$/gm, "<h5>$1</h5>");
        formatted = formatted.replace(/^#### (.*?)$/gm, "<h5>$1</h5>");
        formatted = formatted.replace(/^### (.*?)$/gm, "<h5>$1</h5>");
        formatted = formatted.replace(/^## (.*?)$/gm, "<h5>$1</h5>");
        
        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        
        // Unordered lists
        formatted = formatted.replace(/^\s*[\-\*]\s+(.*?)$/gm, "<li>$1</li>");
        // Wrap adjacent li tags in ul
        // Simplified approach: replace block of list items
        formatted = formatted.replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>");
        
        // Newlines
        formatted = formatted.replace(/\n\n/g, "<p></p>");
        
        return formatted;
    }
};

// Add standard styles for custom notification banner
const style = document.createElement('style');
style.textContent = `
    .notification-banner {
        background: rgba(25, 20, 48, 0.95) !important;
        border-width: 1px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
    }
    [data-theme="light"] .notification-banner {
        background: rgba(255, 255, 255, 0.95) !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1) !important;
    }
`;
document.head.appendChild(style);
