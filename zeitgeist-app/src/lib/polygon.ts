import { sessionDate, stockFromBars, type DailyBar } from './quote';
import axios, { type AxiosResponse } from 'axios';
import { format, subDays } from 'date-fns';
import { 
  StockData, 
  CompanyDetails, 
  StockPriceData,
  StockAPIError 
} from '@/types/stock';
import { validateStockTicker } from '@/lib/stock-utils';

const POLYGON_BASE_URL = 'https://api.polygon.io';
export class MarketDataError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
// Short, bounded cache also shares in-flight requests across searches in this process.
const marketCache = new Map<string, { expires: number; promise: Promise<AxiosResponse> }>();
let cacheCredential: string | undefined;
const polygonAPI = {
  get(path: string, config?: Parameters<ReturnType<typeof axios.create>['get']>[1]) {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) throw new MarketDataError('Market data is not configured.', 503);
    if (cacheCredential !== apiKey) { marketCache.clear(); cacheCredential = apiKey; }
    const key = path + JSON.stringify(config?.params ?? {});
    const cached = marketCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const ttl = path.includes('marketstatus') ? 60_000 : 300_000;
    const promise = axios.create({ baseURL: POLYGON_BASE_URL, timeout: 10000,
      headers: { Authorization: `Bearer ${apiKey}` } }).get(path, config).catch(error => {
      marketCache.delete(key);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 429) throw new MarketDataError('Market data request limit reached. Wait one minute, then try again.', 429);
      if (status === 403) throw new MarketDataError('Your market data plan does not include this data.', 403);
      if (status === 401) throw new MarketDataError('Market data credentials are invalid.', 503);
      if (status === 404) throw new MarketDataError('No market data was found for this stock symbol.', 404);
      throw new MarketDataError('Market data is temporarily unavailable. Please try again.', 502);
    });
    if (marketCache.size >= 128) marketCache.delete(marketCache.keys().next().value!);
    marketCache.set(key, { expires: Date.now() + ttl, promise });
    return promise;
  },
};

/** Independent of the selected price provider; at most five seconds of snapshot latency. */
export async function getPolygonNews(ticker: string): Promise<unknown> {
  const response = await polygonAPI.get('/v2/reference/news', {
    timeout: 5000,
    params: { ticker, limit: 10, sort: 'published_utc', order: 'desc',
      'published_utc.gte': sessionDate(Date.now() - 7 * 86400000) },
  });
  return response.data;
}

/**
 * Fetches the latest stock data for a given ticker symbol
 * Uses the previous trading day's data as "current" price
 */
export async function getStockData(ticker: string): Promise<StockData> {
  return (await getStockQuote(ticker)).stockData;
}

async function getStockQuote(ticker: string, days = 30): Promise<{stockData: StockData; priceHistory: StockPriceData[]}> {
  try {
    const formattedTicker = ticker.toUpperCase().trim();
    
    // Get previous day's aggregate data (most recent complete trading day)
    const response = await polygonAPI.get(`/v2/aggs/ticker/${formattedTicker}/prev`);

    // "DELAYED" means valid data on a delayed-data plan
    if (response.data.status !== 'OK' && response.data.status !== 'DELAYED') {
      throw new Error(`Polygon API error: ${response.data.status}`);
    }

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`No data found for ticker: ${formattedTicker}`);
    }

    const result = response.data.results[0];
    
    // Compare two completed sessions; the opening price is not a previous close.
    const end = sessionDate(result.t);
    const start = format(subDays(new Date(result.t), Math.max(days, 30)), 'yyyy-MM-dd');
    const [history, market] = await Promise.all([
      polygonAPI.get(`/v2/aggs/ticker/${formattedTicker}/range/1/day/${start}/${end}`, {
        params: { adjusted: 'true', sort: 'asc', limit: 500 },
      }),
      polygonAPI.get('/v1/marketstatus/now').catch(() => null),
    ]);
    const bars: DailyBar[] = history.data.results ?? [];
    // /prev can timestamp the close while /range timestamps midnight on that same date.
    const prior = bars.filter(bar => sessionDate(bar.t) < end).sort((a, b) => b.t - a.t)[0];
    if (!prior) throw new Error('Previous trading session is unavailable');
    const marketStatus: StockData['market_status'] = market?.data.market === 'open' ? 'open'
      : market?.data.market === 'extended-hours' || market?.data.earlyHours || market?.data.afterHours ? 'extended-hours'
      : market?.data.market === 'closed' ? 'closed' : 'unknown';
    const stockData = stockFromBars(formattedTicker, result, prior, marketStatus);

    const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
    const priceHistory = bars.filter(bar => bar.t <= result.t && sessionDate(bar.t) >= cutoff)
      .sort((a, b) => a.t - b.t).map(bar => ({
        open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v,
        timestamp: bar.t, date: sessionDate(bar.t), vwap: bar.vw,
      }));
    return { stockData, priceHistory };
    
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    console.error('Error fetching stock data');
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Polygon.io API key');
      } else if (error.response?.status === 403) {
        throw new Error('Polygon.io API access forbidden - check your subscription');
      } else if (error.response?.status === 429) {
        throw new Error('Polygon.io API rate limit exceeded');
      } else if (error.response?.status === 404) {
        throw new Error(`Stock ticker "${ticker}" not found`);
      }
    }
    
    throw new Error(`Failed to fetch stock data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches historical stock data for the past 30 days
 */
export async function getStockHistory(ticker: string, days: number = 30): Promise<StockPriceData[]> {
  try {
    const formattedTicker = ticker.toUpperCase().trim();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    
    const fromDate = format(startDate, 'yyyy-MM-dd');
    const toDate = format(endDate, 'yyyy-MM-dd');
    
    // Get aggregates for date range
    const response = await polygonAPI.get(
      `/v2/aggs/ticker/${formattedTicker}/range/1/day/${fromDate}/${toDate}`,
      {
        params: {
          adjusted: 'true',
          sort: 'asc',
        },
      }
    );

    // "DELAYED" means valid data on a delayed-data plan
    if (response.data.status !== 'OK' && response.data.status !== 'DELAYED') {
      throw new Error(`Polygon API error: ${response.data.status}`);
    }

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`No historical data found for ticker: ${formattedTicker}`);
    }

    // Transform the data to match our interface
    const priceData: StockPriceData[] = response.data.results.map((item: {o: number; h: number; l: number; c: number; v: number; t: number; vw: number; n?: number}) => ({
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
      timestamp: item.t,
      date: sessionDate(item.t),
      vwap: item.vw,
      transactions: item.n,
    }));

    return priceData;
    
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    console.error('Error fetching stock history');
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Polygon.io API key');
      } else if (error.response?.status === 403) {
        throw new Error('Polygon.io API access forbidden - check your subscription');
      } else if (error.response?.status === 429) {
        throw new Error('Polygon.io API rate limit exceeded');
      } else if (error.response?.status === 404) {
        throw new Error(`Stock ticker "${ticker}" not found`);
      }
    }
    
    throw new Error(`Failed to fetch stock history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetches company details for a given ticker symbol
 */
export async function getCompanyDetails(ticker: string): Promise<CompanyDetails> {
  try {
    const formattedTicker = ticker.toUpperCase().trim();
    
    // Get ticker details from reference endpoint
    const response = await polygonAPI.get(`/v3/reference/tickers/${formattedTicker}`);

    // "DELAYED" means valid data on a delayed-data plan
    if (response.data.status !== 'OK' && response.data.status !== 'DELAYED') {
      throw new Error(`Polygon API error: ${response.data.status}`);
    }

    if (!response.data.results) {
      throw new Error(`No company details found for ticker: ${formattedTicker}`);
    }

    const result = response.data.results;
    
    const companyDetails: CompanyDetails = {
      source: 'Polygon.io company reference', primary_exchange: result.primary_exchange,
      ticker: formattedTicker,
      name: result.name || formattedTicker,
      description: result.description,
      homepage_url: result.homepage_url,
      logo_url: result.branding?.logo_url,
      list_date: result.list_date,
      market_cap: result.market_cap,
      weighted_shares_outstanding: result.weighted_shares_outstanding,
      total_employees: result.total_employees,
      
      sic_code: result.sic_code,
      sic_description: result.sic_description,
      
      address: result.address ? {
        address1: result.address.address1,
        city: result.address.city,
        state: result.address.state,
        postal_code: result.address.postal_code,
      } : undefined,
      
      phone_number: result.phone_number,
    };

    return companyDetails;
    
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    console.error('Error fetching company details');
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Polygon.io API key');
      } else if (error.response?.status === 403) {
        throw new Error('Polygon.io API access forbidden - check your subscription');
      } else if (error.response?.status === 429) {
        throw new Error('Polygon.io API rate limit exceeded');
      } else if (error.response?.status === 404) {
        throw new Error(`Company details for ticker "${ticker}" not found`);
      }
    }
    
    throw new Error(`Failed to fetch company details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/**
 * Utility function to handle API errors consistently
 */
export function createAPIError(message: string, statusCode?: number, details?: string): StockAPIError {
  return {
    error: 'POLYGON_API_ERROR',
    message,
    status_code: statusCode,
    details,
  };
}


/**
 * Enhanced function that combines stock data with company details
 */
export async function getCompleteStockInfo(ticker: string, days = 30): Promise<{ stockData: StockData; companyDetails: CompanyDetails; priceHistory: StockPriceData[] }> {
  try {
    // Validate ticker first
    const validation = validateStockTicker(ticker);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Fetch both stock data and company details in parallel
    const [quote, companyDetails] = await Promise.all([
      getStockQuote(validation.formattedTicker, days),
      getCompanyDetails(validation.formattedTicker),
    ]);

    const { stockData, priceHistory } = quote;
    // Enrich stock data with company name
    stockData.name = companyDetails.name;
    stockData.market_cap = companyDetails.market_cap;
    stockData.shares_outstanding = companyDetails.weighted_shares_outstanding;

    return { stockData, companyDetails, priceHistory };
    
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new Error(`Failed to fetch complete stock info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
