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
        this.totalScrapesEl = document.getElementById('totalScrapes');
        
        this.currentScrapedData = null;
        this.totalScrapes = 0;
        
        this.initializeEventListeners();
        this.loadHistory();
        this.initializeAnimations();
    }

    initializeEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
        // Auto-clear messages after 5 seconds
        this.setupAutoHideMessages();
        
        // Add input animations
        this.urlInput.addEventListener('focus', () => {
            this.urlInput.parentElement.classList.add('focused');
        });
        
        this.urlInput.addEventListener('blur', () => {
            this.urlInput.parentElement.classList.remove('focused');
        });
    }

    initializeAnimations() {
        // Animate elements on scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe elements that should animate in
        document.querySelectorAll('.webpage-details, .section').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
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

            this.currentScrapedData = data;
            this.displayWebpageDetails(data);
            this.showSuccess('Webpage analysis completed successfully!');
            this.loadHistory();
            this.updateStats();
            
        } catch (error) {
            console.error('Scraping failed:', error);
            this.showError(error.message || 'Failed to analyze webpage');
        } finally {
            this.setLoading(false);
        }
    }

    displayWebpageDetails(data) {
        const webpageHTML = this.createWebpageDetailsHTML(data);
        this.resultsContainer.innerHTML = webpageHTML;
        this.resultsContainer.classList.add('fade-in');
        
        // Add download button event listener
        const downloadBtn = document.getElementById('downloadPdf');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadPDF(data, downloadBtn));
        }
        
        // Scroll to results with smooth animation
        setTimeout(() => {
            this.resultsContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }

    createWebpageDetailsHTML(data, containerId = 'webpageDetails') {
        // Create meta tags section
        const metaTagsHTML = Object.entries(data.metaTags)
            .filter(([key, value]) => value && value.length > 0)
            .slice(0, 12)
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
            : '<div class="empty-state"><i class="fas fa-image"></i><h3>No images found</h3><p>This webpage doesn\'t contain any images</p></div>';

        // Create links section
        const linksHTML = data.links.length > 0
            ? data.links.map(link => `
                <a href="${link.href}" target="_blank" class="link-item">
                    <span class="link-text">${this.escapeHtml(link.text)}</span>
                    <i class="fas fa-external-link-alt"></i>
                </a>
              `).join('')
            : '<div class="empty-state"><i class="fas fa-link"></i><h3>No links found</h3><p>This webpage doesn\'t contain any external links</p></div>';

        // Create headings section
        const headingsHTML = data.headings.length > 0
            ? data.headings.map(heading => `
                <div class="heading-item">
                    <div class="heading-level">${heading.level}</div>
                    <div class="heading-text">${this.escapeHtml(heading.text)}</div>
                </div>
              `).join('')
            : '<div class="empty-state"><i class="fas fa-heading"></i><h3>No headings found</h3><p>This webpage doesn\'t contain any headings</p></div>';

        // Create paragraphs section
        const paragraphsHTML = data.paragraphs.length > 0
            ? data.paragraphs.map(paragraph => `
                <div class="paragraph-item">${this.escapeHtml(paragraph)}</div>
              `).join('')
            : '<div class="empty-state"><i class="fas fa-paragraph"></i><h3>No paragraphs found</h3><p>This webpage doesn\'t contain any readable paragraphs</p></div>';

        // Status badge
        const statusBadge = data.responseStatus === 200 
            ? '<span class="status-badge status-success"><i class="fas fa-check"></i>Success</span>'
            : '<span class="status-badge status-error"><i class="fas fa-times"></i>Error</span>';

        // Format scrape date
        const scrapeDate = new Date(data.scrapedAt).toLocaleString();

        return `
            <div class="webpage-details" id="${containerId}">
                <div class="webpage-header">
                    <h2 class="webpage-title">${this.escapeHtml(data.title)}</h2>
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                        <a href="${data.url}" target="_blank" class="webpage-url">${this.escapeHtml(data.domain)}</a>
                        ${statusBadge}
                    </div>
                    <p class="webpage-description">${this.escapeHtml(data.description)}</p>
                    <div class="webpage-actions">
                        <button class="download-btn">
                            <i class="fas fa-download"></i>
                            Download PDF Report
                        </button>
                        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-clock"></i>
                            Analyzed on ${scrapeDate}
                        </div>
                    </div>
                </div>
                
                <div class="webpage-content">
                    ${metaTagsHTML ? `
                        <div class="section">
                            <h3 class="section-title">
                                <i class="fas fa-tags"></i>
                                Meta Tags
                                <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">(${Object.keys(data.metaTags).length})</span>
                            </h3>
                            <div class="meta-grid">
                                ${metaTagsHTML}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="section">
                        <h3 class="section-title">
                            <i class="fas fa-images"></i>
                            Images
                            <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">(${data.images.length})</span>
                        </h3>
                        <div class="images-grid">
                            ${imagesHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">
                            <i class="fas fa-heading"></i>
                            Page Structure
                            <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">(${data.headings.length})</span>
                        </h3>
                        <div class="headings-list">
                            ${headingsHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">
                            <i class="fas fa-external-link-alt"></i>
                            External Links
                            <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">(${data.links.length})</span>
                        </h3>
                        <div class="links-list">
                            ${linksHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">
                            <i class="fas fa-align-left"></i>
                            Content Paragraphs
                            <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">(${data.paragraphs.length})</span>
                        </h3>
                        <div class="paragraphs-list">
                            ${paragraphsHTML}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">
                            <i class="fas fa-file-text"></i>
                            Page Content Preview
                        </h3>
                        <div class="body-text">${this.escapeHtml(data.bodyText)}${data.bodyText.length >= 1000 ? '...' : ''}</div>
                    </div>
                </div>
            </div>
        `;
    }

    async downloadPDF(data, buttonElement) {
        if (!this.currentScrapedData) {
            this.showError('No data available for download');
            return;
        }

        let originalContent = '';
        
        try {
            // Show loading state
            if (buttonElement) {
                originalContent = buttonElement.innerHTML;
                buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
                buttonElement.disabled = true;
            }

            // Create PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // PDF styling
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);
            let yPosition = margin;

            // Helper function to add text with word wrapping
            const addText = (text, fontSize = 10, fontStyle = 'normal', color = [0, 0, 0]) => {
                pdf.setFontSize(fontSize);
                pdf.setFont('helvetica', fontStyle);
                pdf.setTextColor(...color);
                
                const lines = pdf.splitTextToSize(text, contentWidth);
                
                // Check if we need a new page
                if (yPosition + (lines.length * fontSize * 0.5) > pageHeight - margin) {
                    pdf.addPage();
                    yPosition = margin;
                }
                
                pdf.text(lines, margin, yPosition);
                yPosition += lines.length * fontSize * 0.5 + 5;
                return yPosition;
            };

            // Add header
            pdf.setFillColor(99, 102, 241);
            pdf.rect(0, 0, pageWidth, 40, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('WebScrape Pro - Analysis Report', margin, 25);
            
            yPosition = 50;

            // Add title and basic info
            addText(data.title, 16, 'bold', [15, 23, 42]);
            addText(`URL: ${data.url}`, 10, 'normal', [99, 102, 241]);
            addText(`Domain: ${data.domain}`, 10, 'normal', [100, 116, 139]);
            addText(`Analyzed: ${new Date(data.scrapedAt).toLocaleString()}`, 10, 'normal', [100, 116, 139]);
            yPosition += 10;

            // Add description
            if (data.description) {
                addText('Description:', 12, 'bold', [15, 23, 42]);
                addText(data.description, 10, 'normal', [71, 85, 105]);
                yPosition += 5;
            }

            // Add meta tags
            if (Object.keys(data.metaTags).length > 0) {
                addText('Meta Tags:', 14, 'bold', [15, 23, 42]);
                Object.entries(data.metaTags).slice(0, 10).forEach(([key, value]) => {
                    addText(`${key}: ${value}`, 9, 'normal', [71, 85, 105]);
                });
                yPosition += 5;
            }

            // Add headings
            if (data.headings.length > 0) {
                addText('Page Structure:', 14, 'bold', [15, 23, 42]);
                data.headings.slice(0, 15).forEach(heading => {
                    addText(`${heading.level.toUpperCase()}: ${heading.text}`, 9, 'normal', [71, 85, 105]);
                });
                yPosition += 5;
            }

            // Add links
            if (data.links.length > 0) {
                addText('External Links:', 14, 'bold', [15, 23, 42]);
                data.links.slice(0, 20).forEach(link => {
                    addText(`• ${link.text}`, 9, 'normal', [71, 85, 105]);
                    addText(`  ${link.href}`, 8, 'normal', [99, 102, 241]);
                });
                yPosition += 5;
            }

            // Add images info
            if (data.images.length > 0) {
                addText('Images Found:', 14, 'bold', [15, 23, 42]);
                data.images.slice(0, 10).forEach(img => {
                    addText(`• ${img.alt || 'No alt text'}`, 9, 'normal', [71, 85, 105]);
                    addText(`  ${img.src}`, 8, 'normal', [99, 102, 241]);
                });
                yPosition += 5;
            }

            // Add content preview
            if (data.bodyText) {
                addText('Content Preview:', 14, 'bold', [15, 23, 42]);
                addText(data.bodyText.substring(0, 1500) + (data.bodyText.length > 1500 ? '...' : ''), 9, 'normal', [71, 85, 105]);
            }

            // Add footer
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`Page ${i} of ${totalPages} | Generated by WebScrape Pro`, margin, pageHeight - 10);
            }

            // Generate filename
            const domain = new URL(data.url).hostname.replace(/[^a-zA-Z0-9]/g, '_');
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `webscrape_${domain}_${timestamp}.pdf`;

            // Save the PDF
            pdf.save(filename);

            this.showSuccess(`PDF report downloaded successfully as ${filename}`);

        } catch (error) {
            console.error('PDF generation failed:', error);
            this.showError('Failed to generate PDF report');
        } finally {
            // Restore button state
            if (buttonElement && originalContent) {
                buttonElement.innerHTML = originalContent;
                buttonElement.disabled = false;
            }
        }
    }

    async loadHistory() {
        try {
            const response = await fetch('/results');
            const results = await response.json();
            
            this.totalScrapes = results.length;
            this.updateStats();
            
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
                    <i class="fas fa-history"></i>
                    <h3>No analysis history</h3>
                    <p>Your analyzed webpages will appear here</p>
                </div>
            `;
            return;
        }

        // Show recent results (exclude the current one if it's the first in results)
        const historyResults = results.slice(1);
        
        if (historyResults.length === 0) {
            this.historyContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No previous analyses</h3>
                    <p>Previous analyzed webpages will appear here</p>
                </div>
            `;
            return;
        }

        const historyHTML = historyResults
            .map((result, index) => this.createWebpageDetailsHTML(result, `historyItem${index}`))
            .join('');

        this.historyContainer.innerHTML = historyHTML;

        // Add event listeners for download buttons in history
        const downloadBtns = this.historyContainer.querySelectorAll('.download-btn');
        downloadBtns.forEach((downloadBtn, index) => {
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => this.downloadPDF(historyResults[index], downloadBtn));
            }
        });
    }

    async clearHistory() {
        try {
            const response = await fetch('/results', { method: 'DELETE' });
            if (response.ok) {
                this.historySection.classList.add('hidden');
                this.totalScrapes = 0;
                this.updateStats();
                this.showSuccess('Analysis history cleared successfully!');
            }
        } catch (error) {
            console.error('Failed to clear history:', error);
            this.showError('Failed to clear history');
        }
    }

    updateStats() {
        if (this.totalScrapesEl) {
            // Animate number change
            const currentValue = parseInt(this.totalScrapesEl.textContent) || 0;
            const targetValue = this.totalScrapes;
            
            if (currentValue !== targetValue) {
                this.animateNumber(this.totalScrapesEl, currentValue, targetValue, 500);
            }
        }
    }

    animateNumber(element, start, end, duration) {
        const startTime = performance.now();
        const difference = end - start;

        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.round(start + (difference * easeOutQuart));
            
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        };

        requestAnimationFrame(updateNumber);
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.scrapeBtn.disabled = true;
            this.btnText.classList.add('hidden');
            this.loader.classList.remove('hidden');
            this.scrapeBtn.classList.add('loading');
        } else {
            this.scrapeBtn.disabled = false;
            this.btnText.classList.remove('hidden');
            this.loader.classList.add('hidden');
            this.scrapeBtn.classList.remove('loading');
        }
    }

    showError(message) {
        const messageText = this.errorMessage.querySelector('.message-text');
        messageText.textContent = message;
        this.errorMessage.classList.remove('hidden');
        this.successMessage.classList.add('hidden');
        
        // Scroll to message
        this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showSuccess(message) {
        const messageText = this.successMessage.querySelector('.message-text');
        messageText.textContent = message;
        this.successMessage.classList.remove('hidden');
        this.errorMessage.classList.add('hidden');
        
        // Scroll to message
        this.successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    
    // Add some entrance animations
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// Add smooth scrolling for anchor links
document.addEventListener('click', (e) => {
    if (e.target.matches('a[href^="#"]')) {
        e.preventDefault();
        const target = document.querySelector(e.target.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    }
});