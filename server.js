const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for scraped results
const scrapedResults = new Map();

// Helper function to clean text
function cleanText(text) {
  return text ? text.trim().replace(/\s+/g, ' ') : '';
}

// Helper function to extract meta tags
function extractMetaTags($) {
  const metaTags = {};
  
  $('meta').each((i, elem) => {
    const name = $(elem).attr('name') || $(elem).attr('property');
    const content = $(elem).attr('content');
    
    if (name && content) {
      metaTags[name] = content;
    }
  });
  
  return metaTags;
}

// Helper function to extract images
function extractImages($, baseUrl) {
  const images = [];
  const seenImages = new Set();
  
  $('img').each((i, img) => {
    let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy');
    const alt = $(img).attr('alt') || '';
    
    if (src && !seenImages.has(src)) {
      // Handle relative URLs
      if (src.startsWith('/')) {
        const urlObj = new URL(baseUrl);
        src = `${urlObj.protocol}//${urlObj.host}${src}`;
      } else if (!src.startsWith('http')) {
        try {
          src = new URL(src, baseUrl).href;
        } catch (e) {
          return; // Skip invalid URLs
        }
      }
      
      // Filter out small images, icons, and common non-content images
      if (!src.includes('icon') && 
          !src.includes('logo') && 
          !src.includes('favicon') &&
          !src.includes('pixel') &&
          !alt.toLowerCase().includes('icon') &&
          !alt.toLowerCase().includes('logo')) {
        images.push({ src, alt: cleanText(alt) });
        seenImages.add(src);
      }
    }
  });

  return images.slice(0, 10); // Limit to 10 images
}

// Helper function to extract links
function extractLinks($, baseUrl) {
  const links = [];
  const seenLinks = new Set();
  
  $('a[href]').each((i, link) => {
    let href = $(link).attr('href');
    const text = cleanText($(link).text());
    
    if (href && text && !seenLinks.has(href)) {
      // Handle relative URLs
      if (href.startsWith('/')) {
        const urlObj = new URL(baseUrl);
        href = `${urlObj.protocol}//${urlObj.host}${href}`;
      } else if (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('tel')) {
        try {
          href = new URL(href, baseUrl).href;
        } catch (e) {
          return; // Skip invalid URLs
        }
      }
      
      if (text.length > 3 && text.length < 100) { // Filter out very short or very long link texts
        links.push({ href, text });
        seenLinks.add(href);
      }
    }
  });

  return links.slice(0, 20); // Limit to 20 links
}

// Helper function to extract headings
function extractHeadings($) {
  const headings = [];
  
  $('h1, h2, h3, h4, h5, h6').each((i, heading) => {
    const text = cleanText($(heading).text());
    const level = heading.tagName.toLowerCase();
    
    if (text && text.length > 2) {
      headings.push({ level, text });
    }
  });

  return headings.slice(0, 15); // Limit to 15 headings
}

// Helper function to extract paragraphs
function extractParagraphs($) {
  const paragraphs = [];
  
  $('p').each((i, p) => {
    const text = cleanText($(p).text());
    
    if (text && text.length > 20 && text.length < 500) { // Filter meaningful paragraphs
      paragraphs.push(text);
    }
  });

  return paragraphs.slice(0, 10); // Limit to 10 paragraphs
}

// Generic webpage scraper
async function scrapeWebpage(url) {
  try {
    console.log(`Scraping URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    const baseUrl = new URL(url).origin;

    // Extract basic page information
    const title = cleanText($('title').text()) || 'No title found';
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       'No description available';

    // Extract meta tags
    const metaTags = extractMetaTags($);

    // Extract images
    const images = extractImages($, baseUrl);

    // Extract links
    const links = extractLinks($, baseUrl);

    // Extract headings
    const headings = extractHeadings($);

    // Extract paragraphs
    const paragraphs = extractParagraphs($);

    // Extract page text content (first 1000 characters)
    const bodyText = cleanText($('body').text()).substring(0, 1000);

    // Get domain info
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const result = {
      title,
      description: cleanText(description),
      domain,
      url,
      metaTags,
      images,
      links,
      headings,
      paragraphs,
      bodyText,
      scrapedAt: new Date().toISOString(),
      responseStatus: response.status,
      contentType: response.headers['content-type'] || 'unknown'
    };

    console.log('Scraped result:', {
      title: result.title,
      domain: result.domain,
      imagesCount: result.images.length,
      linksCount: result.links.length,
      headingsCount: result.headings.length
    });

    return result;

  } catch (error) {
    console.error('Scraping error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      throw new Error('Website not found. Please check the URL.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Connection refused. The website may be down.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Request timed out. The website is taking too long to respond.');
    } else if (error.response && error.response.status) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      throw new Error(`Failed to scrape webpage: ${error.message}`);
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`Received scrape request for: ${url}`);
    
    // Check if we already have this result cached
    if (scrapedResults.has(url)) {
      console.log('Returning cached result');
      return res.json(scrapedResults.get(url));
    }

    // Scrape the webpage
    const scrapedData = await scrapeWebpage(url);
    
    // Store in memory
    scrapedResults.set(url, scrapedData);
    
    // Clean up old results (keep only last 50)
    if (scrapedResults.size > 50) {
      const firstKey = scrapedResults.keys().next().value;
      scrapedResults.delete(firstKey);
    }

    res.json(scrapedData);

  } catch (error) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to scrape webpage',
      details: error.message 
    });
  }
});

// Get all scraped results
app.get('/results', (req, res) => {
  const results = Array.from(scrapedResults.values());
  res.json(results);
});

// Clear results
app.delete('/results', (req, res) => {
  scrapedResults.clear();
  res.json({ message: 'Results cleared' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cachedResults: scrapedResults.size
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`URL Details Scraper server running on http://localhost:${PORT}`);
  console.log(`Ready to scrape any webpage!`);
});