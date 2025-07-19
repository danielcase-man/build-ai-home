import FirecrawlApp from '@mendable/firecrawl-js';

interface ErrorResponse {
  success: false;
  error: string;
}

interface CrawlStatusResponse {
  success: true;
  status: string;
  completed: number;
  total: number;
  creditsUsed: number;
  expiresAt: string;
  data: any[];
}

type CrawlResponse = CrawlStatusResponse | ErrorResponse;

export class FirecrawlService {
  private static API_KEY_STORAGE_KEY = 'firecrawl_api_key';
  private static firecrawlApp: FirecrawlApp | null = null;

  static saveApiKey(apiKey: string): void {
    localStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    this.firecrawlApp = new FirecrawlApp({ apiKey });
    console.log('Firecrawl API key saved successfully');
  }

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_STORAGE_KEY);
  }

  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log('Testing API key with Firecrawl API');
      this.firecrawlApp = new FirecrawlApp({ apiKey });
      // A simple test scrape to verify the API key
      const testResponse = await this.firecrawlApp.scrapeUrl('https://example.com');
      return testResponse.success;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    }
  }

  static async searchVendors(
    query: string,
    location: string,
    zipCode: string,
    categoryName: string,
    specialization?: string,
    customContext?: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, error: 'Firecrawl API key not found' };
    }

    try {
      console.log('Starting vendor search with Firecrawl API');
      if (!this.firecrawlApp) {
        this.firecrawlApp = new FirecrawlApp({ apiKey });
      }

      const baseSearchTerm = specialization ? `${specialization} ${categoryName}` : categoryName;
      const contextInfo = customContext ? ` ${customContext}` : '';
      const searchQuery = `${baseSearchTerm} near ${location} ${zipCode}${contextInfo}`;

      // Search for vendors using targeted business directory sites
      const searchUrls = [
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' site:yelp.com')}`,
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' site:yellowpages.com')}`,
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' site:bbb.org')}`,
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' contractor directory')}`,
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' reviews ratings')}`
      ];

      const vendorData: any[] = [];

      // Crawl multiple sources for comprehensive vendor information
      for (const url of searchUrls) {
        try {
          console.log(`Crawling: ${url}`);
          const crawlResponse = await this.firecrawlApp.crawlUrl(url, {
            limit: 20,
            scrapeOptions: {
              formats: ['markdown', 'html'],
              onlyMainContent: true
            }
          }) as CrawlResponse;

          if (crawlResponse.success) {
            console.log(`Successfully crawled ${url}, found ${crawlResponse.data?.length || 0} pages`);
            if (crawlResponse.data) {
              vendorData.push(...crawlResponse.data);
            }
          } else {
            console.warn(`Failed to crawl ${url}:`, (crawlResponse as ErrorResponse).error);
          }
        } catch (error) {
          console.warn(`Error crawling ${url}:`, error);
          // Continue with other URLs
        }
      }

      console.log(`Firecrawl search complete. Collected ${vendorData.length} data points`);
      return { 
        success: true,
        data: vendorData 
      };
    } catch (error) {
      console.error('Error during Firecrawl vendor search:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search vendors with Firecrawl' 
      };
    }
  }
}