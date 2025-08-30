class URLScraper {
    constructor() {
        this.form = document.getElementById('scrapeForm');
        this.urlInput = document.getElementById('urlInput');
        this.scrapeBtn = document.getElementById('scrapeBtn');
        this.btnText = document.getElementById('btnText');
        this.loader = document.getElementById('loader');
        this.resultsContainer = document.getElementById('results');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
        this.historySection = document.getElementById('historySection');
        this.historyContainer = document.getElementById('historyContainer');
        this.clearHistoryBtn = document.getElementById('clearHistory');
        
        this.initializeEventListeners();
        this.loadHistory();
    }

    initializeEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        // Auto-clear messages after 5 seconds
        this.setupAutoHideMessages();
    }

    setupAutoHideMessages() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (!target.classList.contains('hidden')) {
                        setTimeout(() => {
                            target.classList.add('hidden');
                        }, 5000);
                    }
                }
            });
        });

        observer.observe(this.errorMessage, { attributes: true });
        observer.observe(this.successMessage, { attributes: true });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const url = this.urlInput.value.trim();
        if (!url) {
            this.showError('Please enter a valid URL');
            return;
        }

        this.setLoading(true);
        this.hideMessages();

        try {
            const response = await fetch('/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to scrape webpage');
            }

            this.displayWebpageDetails(data);
            this.showSuccess('Webpage details scraped successfully!');
            this.loadHistory();
            
        } catch (error) {
            console.error('Scraping failed:', error);
            this.showError(error.message || 'Failed to scrape webpage');
        } finally {
            this.setLoading(false);
        }
    }

    displayWebpageDetails(data) {
        const webpageHTML = this.createWebpageDetailsHTML(data);
        this.resultsContainer.innerHTML = webpageHTML;
        this.resultsContainer.classList.add('fade-in');
        
        // Scroll to results
        this.resultsContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    createWebpageDetailsHTML(data) {
        // Create meta tags section
        const metaTagsHTML = Object.entries(data.metaTags)
            .filter(([key, value]) => value && value.length > 0)
            .slice(0, 12) // Limit to 12 meta tags
            .map(([key, value]) => `
                <div class="meta-item">
                    <span class="meta-key">${this.escapeHtml(key)}</span>
                    <span class="meta-value">${this.escapeHtml(value)}</span>
                </div>
            `).join('');

        // Create images section
        const imagesHTML = data.images.length > 0 
            ? data.images.map((img, index) => `
                <div class="image-item">
                    <img src="${img.src}" 
                         alt="${this.escapeHtml(img.alt)}"
                         onerror="this.parentElement.style.display='none'"
                         loading="lazy"
                    >
                    ${img.alt ? `<div class="image-alt">${this.escapeHtml(img.alt)}</div>` : ''}
                </div>
              `).join('')
            : '<div class="empty-state"><p>No images found on this page</p></div>';

        // Create links section
        const linksHTML = data.links.length > 0
            ? data.links.map(link => `
                <a href="${link.href}" target="_blank" class="link-item">
                    <span class="link-text">${this.escapeHtml(link.text)}</span>
                </a>
              `).join('')
            : '<div class="empty-state"><p>No links found on this page</p></div>';

        // Create headings section
        const headingsHTML = data.headings.length > 0
            ? data.headings.map(heading => `
                <div class="heading-item">
                    <div class="heading-level">${heading.level}</div>
                    <div class="heading-text">${this.escapeHtml(heading.text)}</div>
                </div>
              `).join('')
            : '<div class="empty-state"><p>No headings found on this page</p></div>';

        // Create paragraphs section
        const paragraphsHTML = data.paragraphs.length > 0
            ? data.paragraphs.map(paragraph => `
                <div class="paragraph-item">${this.escapeHtml(paragraph)}</div>
              `).join('')
            : '<div class="empty-state"><p>No paragraphs found on this page</p></div>';

        // Status badge
        const statusBadge = data.responseStatus === 200 
            ? '<span class="status-badge status-success">Success</span>'
            : '<span class="status-badge status-error">Error</span>';

        return `
            <div class="webpage-details">
                <div class="webpage-header">
                    <h2 class="webpage-title">${this.escapeHtml(data.title)}</h2>
                    <a href="${data.url}" target="_blank" class="webpage-url">${this.escapeHtml(data.domain)}</a>
                    ${statusBadge}
                    <p class="webpage-description">${this.escapeHtml(data.description)}</p>
                </div>
                
                <div class="webpage-content">
                    ${metaTagsHTML ? `
                        <div class="section">
                            <h3 class="section-title">Meta Tags</h3>
                            <div class="meta-grid">
                                ${metaTagsHTML}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="section">
                        <h3 class="section-title">Images (${data.images.length})</h3>
                        <div class="images-grid">
                            ${imagesHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Headings (${data.headings.length})</h3>
                        <div class="headings-list">
                            ${headingsHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Links (${data.links.length})</h3>
                        <div class="links-list">
                            ${linksHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Content Paragraphs (${data.paragraphs.length})</h3>
                        <div class="paragraphs-list">
                            ${paragraphsHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Page Text Preview</h3>
                        <div class="body-text">${this.escapeHtml(data.bodyText)}${data.bodyText.length >= 1000 ? '...' : ''}</div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadHistory() {
        try {
            const response = await fetch('/results');
            const results = await response.json();
            
            if (results.length > 0) {
                this.displayHistory(results);
                this.historySection.classList.remove('hidden');
            } else {
                this.historySection.classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    displayHistory(results) {
        if (results.length === 0) {
            this.historyContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No previous scrapes</h3>
                    <p>Scraped webpage details will appear here</p>
                </div>
            `;
            return;
        }

        // Show recent results (exclude the current one if it's the first in results)
        const historyResults = results.slice(1);
        
        if (historyResults.length === 0) {
            this.historyContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No previous scrapes</h3>
                    <p>Previous scraped webpages will appear here</p>
                </div>
            `;
            return;
        }

        const historyHTML = historyResults
            .map((result) => this.createWebpageDetailsHTML(result))
            .join('');

        this.historyContainer.innerHTML = historyHTML;
    }

    async clearHistory() {
        try {
            const response = await fetch('/results', { method: 'DELETE' });
            if (response.ok) {
                this.historySection.classList.add('hidden');
                this.showSuccess('History cleared successfully!');
            }
        } catch (error) {
            console.error('Failed to clear history:', error);
            this.showError('Failed to clear history');
        }
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.scrapeBtn.disabled = true;
            this.btnText.textContent = 'Scraping...';
            this.loader.classList.remove('hidden');
        } else {
            this.scrapeBtn.disabled = false;
            this.btnText.textContent = 'Scrape Details';
            this.loader.classList.add('hidden');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        this.successMessage.classList.add('hidden');
    }

    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.classList.remove('hidden');
        this.errorMessage.classList.add('hidden');
    }

    hideMessages() {
        this.errorMessage.classList.add('hidden');
        this.successMessage.classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the URL scraper when the page loads
let urlScraper;
document.addEventListener('DOMContentLoaded', () => {
    urlScraper = new URLScraper();
});